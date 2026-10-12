// =====================================================================
//  PAINEL ADMINISTRATIVO
//  Produtos (com fotos/vídeos) • Ofertas por loja • Categorias • Métricas • Backup
// =====================================================================
import { SITE, cloudinaryConfig, isConfigured, cloudinaryReady, ADMIN_LOGIN_DOMAIN } from "./config.js";
import {
  MARKETPLACES, SECTIONS, SECTION_LABELS, DEFAULT_CATEGORIES, detectMarketplace, isSafeUrl, hostOf,
  discountOf, effectiveStatus, clearCache, norm, slugify
} from "./data.js";
import { esc, money, timeAgo, fmtDate, mediaThumb, youtubeId, toast } from "./ui.js";

const root = document.getElementById("admin");
const dlg = document.getElementById("editor");
const OFFER_STATUS = { ativa: "Ativa", expirada: "Expirada", indisponivel: "Indisponível", rascunho: "Rascunho" };
const DAY = 864e5;
const $ = (sel, el = document) => el.querySelector(sel);

let F, db;
let S = { categories: [], products: [], offers: [], settings: {} };
let view = "produtos", filter = "todos", search = "";

// ---------- Utilidades ----------
function parseMoney(v) {
  if (typeof v === "number") return v;
  let s = String(v ?? "").trim().replace(/[R$\s]/g, "");
  if (!s) return NaN;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}
const fmtNum = v => typeof v === "number" ? v.toFixed(2).replace(".", ",") : (v ?? "");
const toLocal = ms => ms ? new Date(ms - new Date(ms).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
const fromLocal = s => s ? new Date(s).getTime() : null;
const catName = id => S.categories.find(c => c.id === id)?.name || "Sem categoria";
const offersOf = pid => S.offers.filter(o => o.productId === pid);
const activeOffers = pid => offersOf(pid).filter(o => effectiveStatus(o) === "ativa");
const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);
const clean = obj => JSON.parse(JSON.stringify(obj)); // remove undefined (Firestore não aceita)

function download(text, name, type = "application/json") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// O que precisa de revisão em um produto
function issues(p) {
  const now = Date.now(), list = [], offs = offersOf(p.id);
  const staleMs = (SITE.reviewAfterDays || 3) * DAY;
  if (!p.media?.length) list.push("Sem foto ou vídeo");
  if (offs.some(o => o.status === "ativa" && o.expiresAt && o.expiresAt <= now)) list.push("Oferta com validade vencida");
  if (offs.some(o => effectiveStatus(o) === "ativa" && o.coupon && o.couponExpires && o.couponExpires <= now)) list.push("Cupom vencido");
  if (offs.some(o => effectiveStatus(o) === "ativa" && now - (o.priceUpdatedAt || 0) > staleMs)) list.push(`Preço não conferido há mais de ${SITE.reviewAfterDays || 3} dias`);
  if (p.status === "ativo" && !activeOffers(p.id).length) list.push("Nenhuma oferta ativa (não aparece no site)");
  if ((p.sections || []).some(s => s === "dia" || s === "semana") && !activeOffers(p.id).some(o => discountOf(o) > 0))
    list.push("Marcado como oferta do dia/semana sem desconto verificado");
  return list;
}

// ---------- Inicialização e login ----------
if (!isConfigured) {
  root.innerHTML = `<div class="notice"><h1>Painel indisponível no modo demonstração</h1>
    <p>Preencha <code>js/config.js</code> com os dados do seu projeto Firebase. O passo a passo está no arquivo <strong>README.md</strong>.</p>
    <a class="btn" href="./">Voltar ao site</a></div>`;
} else {
  init();
}

async function init() {
  root.innerHTML = `<p class="loading">Carregando…</p>`;
  F = await import("./fb.js");
  db = F.db;
  F.onAuthStateChanged(F.auth, async user => {
    if (!user) return renderLogin();
    root.innerHTML = `<p class="loading">Carregando painel…</p>`;
    try {
      const adm = await F.getDoc(F.doc(db, "admins", user.uid));
      if (!adm.exists()) return renderNoAccess(user);
      await loadAll();
      await autoExpire();
      renderPanel();
    } catch (e) {
      console.error(e);
      root.innerHTML = `<div class="notice error"><h2>Erro ao carregar o painel</h2><p>${esc(e.message)}</p>
        <p class="small">Confira se as regras do Firestore foram publicadas (arquivo firestore.rules).</p>
        <button class="btn secondary" id="logout">Sair</button></div>`;
      $("#logout").onclick = () => F.signOut(F.auth);
    }
  });
}

function renderLogin() {
  root.innerHTML = `
    <form class="login box" id="login">
      <img src="img/logo.svg" alt="" width="48" height="48">
      <h1>Área administrativa</h1>
      <label>Usuário<input type="text" name="email" required autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="admin"></label>
      <label>Senha<input type="password" name="pass" required autocomplete="current-password"></label>
      <button class="btn block">Entrar</button>
      <p class="err" id="err" role="alert"></p>
      <p class="small muted">Esqueceu a senha? Redefina pelo Console do Firebase › Authentication.</p>
      <a class="small" href="./">← Voltar ao site</a>
    </form>`;
  const form = $("#login"), err = $("#err");
  form.onsubmit = async e => {
    e.preventDefault(); err.textContent = "";
    const btn = form.querySelector("button"); btn.disabled = true; btn.textContent = "Entrando…";
    const user = form.email.value.trim().toLowerCase();
    const email = user.includes("@") ? user : `${user}@${ADMIN_LOGIN_DOMAIN}`;
    try { await F.signInWithEmailAndPassword(F.auth, email, form.pass.value); }
    catch (ex) {
      err.textContent = ex?.code === "auth/too-many-requests"
        ? "Muitas tentativas. Aguarde alguns minutos e tente de novo."
        : "Usuário ou senha incorretos.";
      btn.disabled = false; btn.textContent = "Entrar";
    }
  };
}

function renderNoAccess(user) {
  root.innerHTML = `<div class="notice"><h1>Acesso não autorizado</h1>
    <p>Você entrou como <strong>${esc(user.email)}</strong>, mas esta conta ainda não é administradora.</p>
    <p>No Firestore, crie a coleção <code>admins</code> com um documento cujo ID seja exatamente:</p>
    <p><code class="uid">${esc(user.uid)}</code> <button class="btn small secondary" id="cp">Copiar UID</button></p>
    <button class="btn secondary" id="logout">Sair</button></div>`;
  $("#cp").onclick = () => navigator.clipboard?.writeText(user.uid).then(() => toast("UID copiado"));
  $("#logout").onclick = () => F.signOut(F.auth);
}

// ---------- Dados ----------
async function loadAll() {
  const [c, p, o, s] = await Promise.all([
    F.getDocs(F.collection(db, "categories")),
    F.getDocs(F.collection(db, "products")),
    F.getDocs(F.collection(db, "offers")),
    F.getDoc(F.doc(db, "settings", "site"))
  ]);
  S.categories = c.docs.map(d => ({ ...d.data(), id: d.id })).sort(byOrder);
  S.products = p.docs.map(d => ({ ...d.data(), id: d.id }));
  S.offers = o.docs.map(d => ({ ...d.data(), id: d.id }));
  S.settings = s.exists() ? s.data() : {};
}

// Ofertas cuja validade passou viram "expirada" (continuam no painel como histórico)
async function autoExpire() {
  const now = Date.now();
  const due = S.offers.filter(o => o.status === "ativa" && o.expiresAt && o.expiresAt <= now);
  if (!due.length) return;
  const b = F.writeBatch(db);
  due.forEach(o => { b.update(F.doc(db, "offers", o.id), { status: "expirada", updatedAt: now }); o.status = "expirada"; });
  await b.commit();
  await publish(false);
  toast(`${due.length} oferta(s) vencida(s) foram marcadas como expiradas.`);
}

// Gera o documento público "public/catalog" que o site lê (1 leitura por visita)
async function publish(reload = true) {
  if (reload) await loadAll();
  const now = Date.now();
  const products = S.products.filter(p => p.status === "ativo");
  const ids = new Set(products.map(p => p.id));
  const offers = S.offers.filter(o => ids.has(o.productId) && effectiveStatus(o, now) === "ativa");
  const data = clean({ updatedAt: now, settings: S.settings || {}, categories: S.categories, products, offers });
  const size = new Blob([JSON.stringify(data)]).size;
  if (size > 1000000) throw new Error(`A vitrine ficou grande demais (${Math.round(size / 1024)} KB; limite ~1 MB). Expire ou exclua ofertas antigas.`);
  await F.setDoc(F.doc(db, "public", "catalog"), data);
  clearCache();
  if (size > 750000) toast(`Atenção: vitrine com ${Math.round(size / 1024)} KB, perto do limite de 1 MB.`);
}

async function nextCode() {
  const ref = F.doc(db, "counters", "products");
  for (let t = 0; t < 100; t++) {
    const n = await F.runTransaction(db, async tx => {
      const s = await tx.get(ref);
      const n = (s.exists() && s.data().next) || 1;
      tx.set(ref, { next: n + 1 });
      return n;
    });
    const code = "ZAZ" + String(n).padStart(3, "0");
    if (!S.products.some(p => p.id === code) && !(await F.getDoc(F.doc(db, "products", code))).exists()) return code;
  }
  throw new Error("Não foi possível gerar um código.");
}

// ---------- Estrutura do painel ----------
function renderPanel() {
  root.innerHTML = `
    <div class="admin-top">
      <div><strong>Painel Zazum</strong> <span class="muted small">${esc(F.auth.currentUser?.email || "")}</span></div>
      <div class="row"><a class="btn secondary small" href="./" target="_blank" rel="noopener">Ver site ↗</a><button class="btn ghost small" id="logout">Sair</button></div>
    </div>
    <nav class="tabs" role="tablist">
      ${[["produtos", "Produtos"], ["categorias", "Categorias"], ["metricas", "Métricas"], ["config", "Configurações"]]
        .map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${view === k}">${l}</button>`).join("")}
    </nav>
    <div id="view"></div>`;
  $("#logout").onclick = () => F.signOut(F.auth);
  root.querySelector(".tabs").onclick = e => {
    const b = e.target.closest("[data-tab]"); if (!b) return;
    view = b.dataset.tab;
    root.querySelectorAll("[data-tab]").forEach(x => x.setAttribute("aria-selected", x === b));
    renderView();
  };
  renderView();
}
function renderView() {
  ({ produtos: viewProducts, categorias: viewCategories, metricas: viewMetrics, config: viewConfig })[view]();
}

// =====================================================================
//  PRODUTOS
// =====================================================================
function viewProducts() {
  const el = $("#view");
  el.innerHTML = `
    <div class="toolbar">
      <button class="btn" id="new">+ Novo produto</button>
      <input type="search" id="psearch" placeholder="Buscar por nome ou código" value="${esc(search)}" aria-label="Buscar produtos">
    </div>
    ${!S.categories.length ? `<div class="notice">Crie as categorias primeiro (aba <strong>Categorias</strong>).</div>` : ""}
    <div class="chips" id="pchips"></div>
    <div class="plist" id="plist"></div>`;
  $("#new").onclick = () => openEditor();
  $("#psearch").oninput = e => { search = e.target.value; renderProductList(); };
  $("#pchips").onclick = e => { const b = e.target.closest("[data-f]"); if (b) { filter = b.dataset.f; renderProductList(); } };
  $("#plist").onclick = e => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const id = b.dataset.id;
    if (b.dataset.act === "edit") openEditor(S.products.find(p => p.id === id), offersOf(id));
    if (b.dataset.act === "dup") dupProduct(id);
    if (b.dataset.act === "del") delProduct(id);
    if (b.dataset.act === "view") window.open("produto.html?c=" + encodeURIComponent(id), "_blank");
  };
  renderProductList();
}

function renderProductList() {
  const rev = S.products.filter(p => issues(p).length);
  const groups = {
    todos: ["Todos", S.products],
    revisar: ["Precisam de revisão", rev],
    ativo: ["No ar", S.products.filter(p => p.status === "ativo" && activeOffers(p.id).length)],
    rascunho: ["Rascunhos", S.products.filter(p => p.status === "rascunho")],
    destaque: ["Destaques", S.products.filter(p => p.featured)]
  };
  $("#pchips").innerHTML = Object.entries(groups).map(([k, [l, arr]]) =>
    `<button type="button" data-f="${k}" class="chip ${filter === k ? "on" : ""} ${k === "revisar" && arr.length ? "warn" : ""}">${l} <b>${arr.length}</b></button>`).join("");

  let list = [...(groups[filter] || groups.todos)[1]];
  const q = norm(search);
  if (q) list = list.filter(p => norm(`${p.name} ${p.id}`).includes(q));
  list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  $("#plist").innerHTML = list.map(p => {
    const ao = activeOffers(p.id).sort((a, b) => a.price - b.price), iss = issues(p);
    return `<div class="prow">
      <img src="${esc(mediaThumb(p.media?.[0], 120))}" alt="" loading="lazy">
      <div class="prow-info">
        <div class="small muted">${esc(p.id)} · ${esc(catName(p.categoryId))}${p.featured ? " · ★ destaque" : ""}</div>
        <strong>${esc(p.name)}</strong>
        <div class="small">
          <span class="pill ${p.status === "ativo" ? "ok" : ""}">${p.status === "ativo" ? "Ativo" : "Rascunho"}</span>
          ${ao.length} de ${offersOf(p.id).length} oferta(s) ativa(s)${ao[0] ? ` · a partir de ${money(ao[0].price)}` : ""}
          ${(p.sections || []).map(s => `<span class="pill">${esc(SECTIONS[s] || s)}</span>`).join("")}
        </div>
        ${iss.length ? `<ul class="issues">${iss.map(i => `<li>⚠ ${esc(i)}</li>`).join("")}</ul>` : ""}
      </div>
      <div class="prow-actions">
        <button class="btn small" data-act="edit" data-id="${esc(p.id)}">Editar</button>
        <button class="btn secondary small" data-act="view" data-id="${esc(p.id)}">Ver</button>
        <button class="btn secondary small" data-act="dup" data-id="${esc(p.id)}">Duplicar</button>
        <button class="btn danger small" data-act="del" data-id="${esc(p.id)}">Excluir</button>
      </div>
    </div>`;
  }).join("") || `<p class="empty">Nenhum produto aqui ainda.</p>`;
}

function dupProduct(id) {
  const p = S.products.find(x => x.id === id);
  const copy = { ...structuredClone(p), id: undefined, name: p.name + " (cópia)", status: "rascunho", createdAt: undefined };
  const offs = offersOf(id).map(o => ({ ...structuredClone(o), id: undefined, clicks: undefined, status: "rascunho", publishedAt: Date.now() }));
  openEditor(copy, offs);
  toast("Cópia criada como rascunho. Revise e salve.");
}

async function delProduct(id) {
  const p = S.products.find(x => x.id === id), offs = offersOf(id);
  if (!confirm(`Excluir ${id} — "${p.name}" e suas ${offs.length} oferta(s)?\n\nIsso não pode ser desfeito.\nDica: para só tirar do ar e manter o histórico, edite e mude o status para "Rascunho".`)) return;
  try {
    const b = F.writeBatch(db);
    b.delete(F.doc(db, "products", id));
    offs.forEach(o => b.delete(F.doc(db, "offers", o.id)));
    await b.commit();
    await publish();
    toast("Produto excluído.");
    renderProductList();
  } catch (e) { alert("Erro ao excluir: " + e.message); }
}

// ---------- Editor de produto ----------
let E = null;
const newOffer = () => ({ marketplace: "shopee", affiliateUrl: "", price: "", oldPrice: "", coupon: "", couponExpires: null,
  status: "ativa", publishedAt: Date.now(), expiresAt: null, priceUpdatedAt: null });

function openEditor(p, offers) {
  E = {
    p: structuredClone(p || { status: "ativo", sections: [], media: [], featured: false, order: 0, categoryId: "" }),
    offers: structuredClone(offers || []),
    removed: [],
    orig: Object.fromEntries((offers || []).filter(o => o.id).map(o => [o.id, { price: o.price, oldPrice: o.oldPrice ?? null }])),
    dirty: false
  };
  E.p.media ||= []; E.p.sections ||= [];
  if (!E.offers.length) E.offers.push(newOffer());
  renderEditor();
  dlg.showModal();
}

function renderEditor() {
  const p = E.p, isNew = !p.id;
  dlg.innerHTML = `
  <form id="pf" class="editor" novalidate>
    <header class="ed-head">
      <h2>${isNew ? "Novo produto" : "Editar " + esc(p.id)}</h2>
      <button type="button" class="icon-btn" data-close aria-label="Fechar">✕</button>
    </header>
    <div class="ed-body">
      <section class="ed-sec">
        <h3>1. Produto</h3>
        <div class="two">
          <label>Código ${isNew ? `<small>(vazio = gerar automático)</small>` : ""}
            <input name="code" value="${esc(p.id || "")}" ${isNew ? "" : "disabled"} placeholder="ZAZ001" maxlength="20" autocapitalize="characters"></label>
          <label>Status do produto
            <select name="status"><option value="ativo">Ativo (aparece no site)</option><option value="rascunho">Rascunho (oculto)</option></select></label>
        </div>
        <label>Nome do produto *<input name="name" required maxlength="140" placeholder="Ex.: Fone Bluetooth XYZ"></label>
        <label>Descrição<textarea name="description" rows="3" maxlength="3000" placeholder="Detalhes úteis para quem vai comprar"></textarea></label>
        <div class="two">
          <label>Categoria *
            <select name="categoryId" required><option value="">Selecione…</option>
              ${S.categories.map(c => `<option value="${esc(c.id)}">${esc(c.icon || "")} ${esc(c.name)}${c.active === false ? " (inativa)" : ""}</option>`).join("")}
            </select></label>
          <label>Ordem de exibição <small>(menor aparece antes)</small><input name="order" type="number" step="1" value="${Number(p.order) || 0}"></label>
        </div>
        <fieldset class="checks">
          <legend>Vitrines</legend>
          <label><input type="checkbox" name="featured" ${p.featured ? "checked" : ""}> ★ Destaque</label>
          ${Object.entries(SECTIONS).map(([k, l]) => `<label><input type="checkbox" name="sec" value="${k}" ${p.sections.includes(k) ? "checked" : ""}> ${l}</label>`).join("")}
          <p class="small muted">"Ofertas do dia" e "da semana" só exibem o produto se alguma oferta tiver desconto verificado (preço anterior maior que o atual). "Cupons" e "Mais acessados" são automáticos.</p>
        </fieldset>
      </section>

      <section class="ed-sec">
        <h3>2. Fotos e vídeos</h3>
        <div id="media" class="media-list"></div>
        <div class="media-add">
          <label class="btn secondary file-btn">📷 Enviar fotos ou vídeos
            <input type="file" id="files" accept="image/*,video/*" multiple></label>
          <div class="row grow">
            <input id="murl" type="url" inputmode="url" placeholder="ou cole um link: imagem, vídeo .mp4 ou YouTube">
            <button type="button" class="btn secondary" id="addurl">Adicionar</button>
          </div>
        </div>
        <p class="small muted">A primeira mídia é a capa do card. Limites do Cloudinary grátis: imagens até 10 MB, vídeos até 100 MB.
          ${cloudinaryReady ? "" : `<br><strong class="err">Envio de arquivos desativado: configure o Cloudinary em js/config.js.</strong> Links continuam funcionando.`}</p>
      </section>

      <section class="ed-sec">
        <h3>3. Ofertas (onde comprar)</h3>
        <p class="small muted">Cada loja é uma oferta separada, com preço, cupom, validade e link de afiliado próprios. O botão VER OFERTA aparece logo abaixo das fotos e leva ao link cadastrado.</p>
        <div id="offers"></div>
        <button type="button" class="btn secondary" id="addoffer">+ Adicionar oferta de outra loja</button>
      </section>
    </div>
    <footer class="ed-foot">
      <span id="ed-msg" class="small" role="alert"></span>
      <button type="button" class="btn ghost" data-close>Cancelar</button>
      <button type="submit" class="btn" id="save">Salvar e publicar</button>
    </footer>
  </form>`;

  const f = $("#pf", dlg);
  f.name.value = p.name || "";
  f.description.value = p.description || "";
  f.status.value = p.status || "ativo";
  f.categoryId.value = p.categoryId || "";

  renderMedia();
  renderOffers();

  f.addEventListener("input", () => (E.dirty = true));
  f.onsubmit = save;
  dlg.querySelectorAll("[data-close]").forEach(b => (b.onclick = closeEditor));
  dlg.oncancel = e => { e.preventDefault(); closeEditor(); };
  $("#files", dlg).onchange = e => { handleFiles([...e.target.files]); e.target.value = ""; };
  $("#addurl", dlg).onclick = addMediaUrl;
  $("#murl", dlg).onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); addMediaUrl(); } };
  $("#addoffer", dlg).onclick = () => { syncOffers(); E.offers.push(newOffer()); renderOffers(); E.dirty = true; };
  $("#media", dlg).onclick = onMediaAction;
  $("#offers", dlg).onclick = onOfferAction;
  $("#offers", dlg).oninput = onOfferInput;
}

function closeEditor() {
  if (E?.p.media.some(m => m.uploading) && !confirm("Ainda há envios em andamento. Fechar mesmo assim?")) return;
  if (E?.dirty && !confirm("Descartar as alterações não salvas?")) return;
  dlg.close();
}

// ----- Mídia -----
function renderMedia() {
  const box = $("#media", dlg);
  box.innerHTML = E.p.media.map((m, i) => `
    <div class="mitem">
      ${m.uploading
        ? `<div class="mprog"><span style="width:${Math.round((m.progress || 0) * 100)}%"></span></div><small>Enviando ${Math.round((m.progress || 0) * 100)}%</small>`
        : `<img src="${esc(mediaThumb(m, 200))}" alt="">${m.type !== "image" ? `<span class="play" aria-hidden="true">▶</span>` : ""}`}
      ${i === 0 ? `<span class="cover">Capa</span>` : ""}
      <div class="mbtns">
        <button type="button" data-m="left" data-i="${i}" aria-label="Mover para a esquerda" ${i === 0 ? "disabled" : ""}>◀</button>
        <button type="button" data-m="right" data-i="${i}" aria-label="Mover para a direita" ${i === E.p.media.length - 1 ? "disabled" : ""}>▶</button>
        <button type="button" data-m="del" data-i="${i}" aria-label="Remover">✕</button>
      </div>
    </div>`).join("") || `<p class="small muted">Nenhuma foto ou vídeo ainda.</p>`;
}
function onMediaAction(e) {
  const b = e.target.closest("[data-m]"); if (!b) return;
  const i = +b.dataset.i, m = E.p.media;
  if (b.dataset.m === "del") { if (m[i].uploading) return; m.splice(i, 1); }
  if (b.dataset.m === "left" && i > 0) [m[i - 1], m[i]] = [m[i], m[i - 1]];
  if (b.dataset.m === "right" && i < m.length - 1) [m[i + 1], m[i]] = [m[i], m[i + 1]];
  E.dirty = true; renderMedia();
}
function addMediaUrl() {
  const input = $("#murl", dlg), url = input.value.trim();
  if (!url) return;
  if (!isSafeUrl(url)) return toast("Use um link completo começando com https://");
  const type = youtubeId(url) ? "youtube" : (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(url) || url.includes("/video/upload/")) ? "video" : "image";
  E.p.media.push({ type, url });
  input.value = ""; E.dirty = true; renderMedia();
}

function uploadToCloudinary(file, onProgress) {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", cloudinaryConfig.uploadPreset);
    if (cloudinaryConfig.folder) fd.append("folder", cloudinaryConfig.folder);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudinaryConfig.cloudName)}/auto/upload`);
    xhr.upload.onprogress = e => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      let j = {}; try { j = JSON.parse(xhr.responseText); } catch { /* ok */ }
      if (xhr.status < 300 && j.secure_url) resolve({ type: j.resource_type === "video" ? "video" : "image", url: j.secure_url, publicId: j.public_id });
      else reject(new Error(j.error?.message || `erro ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("falha de conexão"));
    xhr.send(fd);
  });
}
function handleFiles(files) {
  if (!cloudinaryReady) return toast("Configure o Cloudinary em js/config.js para enviar arquivos.");
  for (const file of files) {
    const isVid = file.type.startsWith("video/"), lim = isVid ? 100 : 10;
    if (!isVid && !file.type.startsWith("image/")) { toast(`${file.name}: formato não suportado`); continue; }
    if (file.size > lim * 1024 * 1024) { toast(`${file.name}: maior que ${lim} MB`); continue; }
    const item = { type: isVid ? "video" : "image", uploading: true, progress: 0 };
    E.p.media.push(item); E.dirty = true; renderMedia();
    let last = 0;
    uploadToCloudinary(file, pr => { item.progress = pr; if (Date.now() - last > 150) { last = Date.now(); renderMedia(); } })
      .then(r => { Object.assign(item, r); delete item.uploading; delete item.progress; renderMedia(); })
      .catch(err => { E.p.media.splice(E.p.media.indexOf(item), 1); renderMedia(); toast(`Falha ao enviar ${file.name}: ${err.message}`); });
  }
}

// ----- Ofertas -----
function offerHTML(o, i) {
  const det = detectMarketplace(o.affiliateUrl);
  return `<div class="offer-ed" data-i="${i}">
    <div class="offer-ed-head">
      <strong>Oferta ${i + 1}</strong>
      <span class="pill ${effectiveStatus(o) === "ativa" ? "ok" : ""}">${OFFER_STATUS[effectiveStatus(o)] || o.status}</span>
      ${o.id ? `<span class="small muted">${o.clicks || 0} clique(s)</span>` : `<span class="small muted">nova</span>`}
      <div class="row end">
        ${o.id ? `<button type="button" class="btn secondary small" data-oact="replace" title="Marca esta como expirada e cria uma nova igual para você atualizar">Substituir</button>` : ""}
        <button type="button" class="btn secondary small" data-oact="dup">Duplicar</button>
        <button type="button" class="btn danger small" data-oact="del">Remover</button>
      </div>
    </div>
    <label>Link de afiliado *
      <input data-f="affiliateUrl" type="url" inputmode="url" placeholder="https://…" value="${esc(o.affiliateUrl || "")}" autocomplete="off"></label>
    <p class="small hint" data-hint>${o.affiliateUrl ? (isSafeUrl(o.affiliateUrl) ? `Destino: <b>${esc(hostOf(o.affiliateUrl))}</b>${det ? ` (${esc(MARKETPLACES[det].name)})` : " — domínio não reconhecido"}` : `<span class="err">Link inválido: use https://</span>`) : ""}</p>
    <div class="three">
      <label>Loja *<select data-f="marketplace">${Object.entries(MARKETPLACES).map(([k, m]) => `<option value="${k}" ${o.marketplace === k ? "selected" : ""}>${esc(m.name)}</option>`).join("")}</select></label>
      <label>Preço atual (R$) *<input data-f="price" inputmode="decimal" placeholder="99,90" value="${esc(fmtNum(o.price))}"></label>
      <label>Preço anterior <small>(só se verificado)</small><input data-f="oldPrice" inputmode="decimal" placeholder="opcional" value="${esc(fmtNum(o.oldPrice))}"></label>
    </div>
    <p class="small" data-disc>${discHint(o)}</p>
    <div class="three">
      <label>Cupom<input data-f="coupon" maxlength="40" placeholder="opcional" value="${esc(o.coupon || "")}" autocapitalize="characters"></label>
      <label>Cupom válido até<input data-f="couponExpires" type="datetime-local" value="${toLocal(o.couponExpires)}"></label>
      <label>Status da oferta<select data-f="status">${Object.entries(OFFER_STATUS).map(([k, l]) => `<option value="${k}" ${o.status === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
    </div>
    <div class="three">
      <label>Publicada em<input data-f="publishedAt" type="datetime-local" value="${toLocal(o.publishedAt)}"></label>
      <label>Oferta válida até <small>(se souber)</small><input data-f="expiresAt" type="datetime-local" value="${toLocal(o.expiresAt)}"></label>
      <div class="verify">
        <span class="small">Preço conferido: <b>${o.priceUpdatedAt ? timeAgo(o.priceUpdatedAt) : "ainda não"}</b></span>
        <button type="button" class="btn secondary small" data-oact="verify">✓ Conferi o preço agora</button>
      </div>
    </div>
  </div>`;
}
function discHint(o) {
  const p = parseMoney(o.price), op = parseMoney(o.oldPrice);
  if (!(p > 0) || !(op > 0)) return "";
  if (op <= p) return `<span class="err">O preço anterior precisa ser maior que o atual.</span>`;
  return `Desconto exibido: <b>-${Math.round((1 - p / op) * 100)}%</b>`;
}
function renderOffers() {
  $("#offers", dlg).innerHTML = E.offers.map(offerHTML).join("") || `<p class="small muted">Nenhuma oferta.</p>`;
}
function syncOffers() {
  dlg.querySelectorAll(".offer-ed").forEach(box => {
    const o = E.offers[+box.dataset.i];
    box.querySelectorAll("[data-f]").forEach(el => {
      const k = el.dataset.f;
      o[k] = el.type === "datetime-local" ? fromLocal(el.value) : el.value;
    });
  });
}
function onOfferInput(e) {
  const box = e.target.closest(".offer-ed"); if (!box) return;
  const f = e.target.dataset.f, o = E.offers[+box.dataset.i];
  if (f === "affiliateUrl") {
    const url = e.target.value.trim(), hint = $("[data-hint]", box);
    if (!url) hint.innerHTML = "";
    else if (!isSafeUrl(url)) hint.innerHTML = `<span class="err">Link inválido: use um link completo começando com https://</span>`;
    else {
      const det = detectMarketplace(url);
      hint.innerHTML = `Destino: <b>${esc(hostOf(url))}</b>${det ? ` (${esc(MARKETPLACES[det].name)})` : " — domínio não reconhecido, confira antes de salvar"}`;
      if (det) $('[data-f="marketplace"]', box).value = det;
    }
  }
  if (f === "price" || f === "oldPrice") {
    o[f] = e.target.value;
    o.price = $('[data-f="price"]', box).value; o.oldPrice = $('[data-f="oldPrice"]', box).value;
    $("[data-disc]", box).innerHTML = discHint(o);
  }
}
function onOfferAction(e) {
  const b = e.target.closest("[data-oact]"); if (!b) return;
  syncOffers();
  const i = +b.closest(".offer-ed").dataset.i, o = E.offers[i];
  const act = b.dataset.oact;
  if (act === "verify") { o.priceUpdatedAt = Date.now(); o._verified = true; toast("Marcado como conferido agora. Salve para publicar."); }
  if (act === "dup") { E.offers.splice(i + 1, 0, { ...structuredClone(o), id: undefined, clicks: undefined, affiliateUrl: "", marketplace: "outro", publishedAt: Date.now(), priceUpdatedAt: null }); toast("Oferta duplicada: escolha a loja e cole o link."); }
  if (act === "replace") {
    o.status = "expirada";
    E.offers.splice(i + 1, 0, { ...structuredClone(o), id: undefined, clicks: undefined, status: "ativa", publishedAt: Date.now(), priceUpdatedAt: null, expiresAt: null });
    toast("A antiga foi marcada como expirada. Atualize preço e link da nova.");
  }
  if (act === "del") {
    if (o.id && !confirm("Remover apaga o histórico desta oferta.\nPara manter o histórico, mude o status para \"Expirada\".\n\nRemover mesmo assim?")) return;
    if (o.id) E.removed.push(o.id);
    E.offers.splice(i, 1);
  }
  E.dirty = true;
  renderOffers();
}

// ----- Salvar -----
async function save(e) {
  e.preventDefault();
  syncOffers();
  const f = e.target, msg = $("#ed-msg", dlg), btn = $("#save", dlg);
  const fail = s => { msg.innerHTML = `<span class="err">${esc(s)}</span>`; return false; };
  msg.textContent = "";

  if (E.p.media.some(m => m.uploading)) return fail("Aguarde terminar o envio das fotos/vídeos.");
  const name = f.name.value.trim();
  if (!name) return fail("Informe o nome do produto.");
  const categoryId = f.categoryId.value;
  if (!categoryId) return fail("Escolha uma categoria.");

  const now = Date.now(), offers = [];
  for (const [i, o] of E.offers.entries()) {
    const n = i + 1, url = String(o.affiliateUrl || "").trim();
    if (!o.id && !url && !String(o.price || "").trim()) continue; // oferta nova vazia: ignora
    if (!isSafeUrl(url)) return fail(`Oferta ${n}: link inválido. Cole o link completo começando com https://`);
    const price = parseMoney(o.price);
    if (!(price > 0)) return fail(`Oferta ${n}: informe o preço atual.`);
    const oldRaw = String(o.oldPrice ?? "").trim();
    const oldPrice = oldRaw ? parseMoney(oldRaw) : null;
    if (oldRaw && !(oldPrice > price)) return fail(`Oferta ${n}: o preço anterior deve ser maior que o atual (ou deixe vazio).`);
    if (o.status === "ativa" && o.expiresAt && o.expiresAt <= now) return fail(`Oferta ${n}: a validade já passou. Ajuste a data ou mude o status.`);
    const det = detectMarketplace(url);
    if (!det && !confirm(`Oferta ${n}: o domínio "${hostOf(url)}" não é de uma loja conhecida.\nConfirma que esse link é seguro e é seu link de afiliado?`)) return;
    if (det && o.marketplace !== det && !confirm(`Oferta ${n}: o link parece ser da ${MARKETPLACES[det].name}, mas a loja selecionada é ${MARKETPLACES[o.marketplace]?.name}.\nSalvar assim mesmo?`)) return;

    const orig = o.id ? E.orig[o.id] : null;
    const priceChanged = !orig || orig.price !== price || (orig.oldPrice ?? null) !== oldPrice;
    offers.push({
      id: o.id,
      data: {
        marketplace: o.marketplace, affiliateUrl: url, price, oldPrice,
        coupon: String(o.coupon || "").trim(), couponExpires: o.couponExpires || null,
        status: o.status, publishedAt: o.publishedAt || now, expiresAt: o.expiresAt || null,
        priceUpdatedAt: (priceChanged || o._verified) ? now : (o.priceUpdatedAt || now),
        updatedAt: now
      }
    });
  }
  const sections = [...f.querySelectorAll('input[name="sec"]:checked')].map(x => x.value);
  if (f.status.value === "ativo" && !offers.some(x => x.data.status === "ativa") &&
      !confirm("Este produto não tem nenhuma oferta ativa, então não vai aparecer no site. Salvar mesmo assim?")) return;
  if (sections.some(s => s === "dia" || s === "semana") && !offers.some(x => x.data.status === "ativa" && x.data.oldPrice > x.data.price) &&
      !confirm("Marcado como Oferta do dia/semana, mas nenhuma oferta tem desconto verificado. Ele NÃO aparecerá nessas vitrines até ter. Continuar?")) return;

  btn.disabled = true; btn.textContent = "Salvando…";
  try {
    let id = E.p.id;
    if (!id) {
      const manual = f.code.value.trim().toUpperCase();
      if (manual) {
        if (!/^[A-Z0-9-]{3,20}$/.test(manual)) throw new Error("Código: use de 3 a 20 letras, números ou hífen.");
        if ((await F.getDoc(F.doc(db, "products", manual))).exists()) throw new Error(`O código ${manual} já existe.`);
        id = manual;
      } else id = await nextCode();
    }
    const pdata = clean({
      id, name, description: f.description.value.trim(), categoryId, status: f.status.value,
      featured: f.featured.checked, sections, order: Number(f.order.value) || 0,
      media: E.p.media.map(({ type, url, publicId }) => ({ type, url, publicId: publicId || null })),
      createdAt: E.p.createdAt || now, updatedAt: now
    });
    const b = F.writeBatch(db);
    b.set(F.doc(db, "products", id), pdata);
    for (const { id: oid, data } of offers) {
      data.productId = id;
      if (oid) b.set(F.doc(db, "offers", oid), clean(data), { merge: true }); // não mexe no contador de cliques
      else b.set(F.doc(F.collection(db, "offers")), clean({ ...data, clicks: 0, createdAt: now }));
    }
    E.removed.forEach(rid => b.delete(F.doc(db, "offers", rid)));
    await b.commit();
    await publish();
    E.dirty = false;
    dlg.close();
    toast(`${id} salvo e publicado!`);
    if (view === "produtos") renderProductList();
  } catch (ex) {
    console.error(ex);
    fail("Erro ao salvar: " + ex.message);
  } finally {
    btn.disabled = false; btn.textContent = "Salvar e publicar";
  }
}

// =====================================================================
//  CATEGORIAS
// =====================================================================
function viewCategories() {
  let W = structuredClone(S.categories);
  const removed = [];
  const el = $("#view");
  const count = id => S.products.filter(p => p.categoryId === id).length;

  function sync() {
    el.querySelectorAll(".cat-row").forEach(r => {
      const c = W[+r.dataset.i];
      c.icon = $('[data-f="icon"]', r).value.trim();
      c.name = $('[data-f="name"]', r).value.trim();
      c.active = $('[data-f="active"]', r).checked;
    });
  }
  function render() {
    el.innerHTML = `
      ${!W.length ? `<div class="notice"><p>Nenhuma categoria cadastrada.</p><button class="btn" id="seed">Criar as 10 categorias do briefing</button></div>` : ""}
      <p class="small muted">Edite o nome e o ícone (emoji), reordene com as setas e desative para esconder do site. Só é possível excluir categorias sem produtos.</p>
      <div class="cat-list">${W.map((c, i) => `
        <div class="cat-row" data-i="${i}">
          <input class="ico" data-f="icon" value="${esc(c.icon || "")}" maxlength="4" aria-label="Ícone">
          <input data-f="name" value="${esc(c.name)}" aria-label="Nome da categoria" maxlength="60">
          <label class="inline"><input type="checkbox" data-f="active" ${c.active !== false ? "checked" : ""}> Ativa</label>
          <span class="small muted">${count(c.id)} prod.</span>
          <div class="row">
            <button type="button" class="btn secondary small" data-c="up" aria-label="Subir" ${i === 0 ? "disabled" : ""}>↑</button>
            <button type="button" class="btn secondary small" data-c="down" aria-label="Descer" ${i === W.length - 1 ? "disabled" : ""}>↓</button>
            <button type="button" class="btn danger small" data-c="del" aria-label="Excluir" ${count(c.id) ? "disabled title=\"Mova os produtos para outra categoria antes\"" : ""}>✕</button>
          </div>
        </div>`).join("")}</div>
      <div class="row grow add-cat"><input id="newcat" placeholder="Nome da nova categoria" maxlength="60"><button type="button" class="btn secondary" id="addcat">Adicionar</button></div>
      <button type="button" class="btn" id="savecats">Salvar categorias</button>`;
    $("#seed")?.addEventListener("click", () => { W = structuredClone(DEFAULT_CATEGORIES); render(); });
    $("#addcat").onclick = () => {
      sync();
      const name = $("#newcat").value.trim(); if (!name) return;
      let id = slugify(name) || "categoria", n = 2;
      while (W.some(c => c.id === id) || removed.includes(id)) id = `${slugify(name)}-${n++}`;
      W.push({ id, name, icon: "🏷️", active: true, order: W.length });
      render();
    };
    el.querySelector(".cat-list").onclick = e => {
      const b = e.target.closest("[data-c]"); if (!b) return;
      sync();
      const i = +b.closest(".cat-row").dataset.i;
      if (b.dataset.c === "up" && i > 0) [W[i - 1], W[i]] = [W[i], W[i - 1]];
      if (b.dataset.c === "down" && i < W.length - 1) [W[i + 1], W[i]] = [W[i], W[i + 1]];
      if (b.dataset.c === "del" && confirm(`Excluir a categoria "${W[i].name}"?`)) { if (S.categories.some(c => c.id === W[i].id)) removed.push(W[i].id); W.splice(i, 1); }
      render();
    };
    $("#savecats").onclick = async e => {
      sync();
      if (W.some(c => !c.name)) return toast("Toda categoria precisa de um nome.");
      e.target.disabled = true; e.target.textContent = "Salvando…";
      try {
        const b = F.writeBatch(db);
        W.forEach((c, i) => b.set(F.doc(db, "categories", c.id), clean({ name: c.name, icon: c.icon || "", active: c.active !== false, order: i })));
        removed.forEach(id => b.delete(F.doc(db, "categories", id)));
        await b.commit();
        await publish();
        toast("Categorias salvas e publicadas!");
        viewCategories();
      } catch (ex) { toast("Erro: " + ex.message); e.target.disabled = false; e.target.textContent = "Salvar categorias"; }
    };
  }
  render();
}

// =====================================================================
//  MÉTRICAS
// =====================================================================
async function viewMetrics() {
  const el = $("#view");
  el.innerHTML = `
    <div class="toolbar">
      <label class="inline">Período
        <select id="per"><option value="1">Hoje (24 h)</option><option value="7" selected>Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option></select>
      </label>
    </div>
    <div id="mbody"><p class="loading">Carregando…</p></div>
    <p class="small muted">Atenção: cliques não equivalem a vendas. Vendas e comissões aparecem nos painéis de afiliado de cada loja. Para identificar campanhas, divulgue links com parâmetros UTM, por exemplo: <code>…/produto.html?c=ZAZ001&utm_source=instagram&utm_campaign=black-friday</code></p>`;
  $("#per").onchange = e => load(+e.target.value);
  load(7);

  async function load(days) {
    const body = $("#mbody");
    body.innerHTML = `<p class="loading">Carregando…</p>`;
    try {
      const since = Date.now() - days * DAY;
      const qs = await F.getDocs(F.query(F.collection(db, "clicks"), F.where("at", ">=", F.Timestamp.fromMillis(since))));
      const rows = qs.docs.map(d => d.data()).filter(r => r.at);
      const prodName = id => S.products.find(p => p.id === id)?.name || "(excluído)";
      const tally = keyFn => {
        const m = new Map();
        rows.forEach(r => { const k = keyFn(r); if (k) m.set(k, (m.get(k) || 0) + 1); });
        return [...m.entries()].sort((a, b) => b[1] - a[1]);
      };
      const offerLabel = id => { const o = S.offers.find(x => x.id === id); return o ? `${o.productId} · ${MARKETPLACES[o.marketplace]?.name || o.marketplace} · ${money(o.price)}` : id + " (excluída)"; };

      const byProduct = tally(r => r.productId).map(([k, n]) => [`${k} — ${prodName(k)}`, n]);
      const byOffer = tally(r => r.offerId).map(([k, n]) => [offerLabel(k), n]);
      const byCat = tally(r => r.categoryId || "—").map(([k, n]) => [catName(k), n]);
      const byMkt = tally(r => r.marketplace).map(([k, n]) => [MARKETPLACES[k]?.name || k, n]);
      const bySrc = tally(r => r.source ? `${r.source}${r.medium ? " / " + r.medium : ""}` : (r.referrer || "Direto / desconhecido"));
      const byCamp = tally(r => r.campaign);
      const bySec = tally(r => r.section || "—").map(([k, n]) => [SECTION_LABELS[k] || k, n]);

      // Histórico diário
      const daysArr = [];
      for (let i = Math.min(days, 90) - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * DAY);
        daysArr.push({ key: d.toLocaleDateString("pt-BR"), label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), n: 0 });
      }
      const idx = Object.fromEntries(daysArr.map((d, i) => [d.key, i]));
      rows.forEach(r => { const k = r.at.toDate().toLocaleDateString("pt-BR"); if (k in idx) daysArr[idx[k]].n++; });
      const maxDay = Math.max(1, ...daysArr.map(d => d.n));

      // Total histórico (contador nas ofertas)
      const allTime = S.products.map(p => [`${p.id} — ${p.name}`, offersOf(p.id).reduce((s, o) => s + (o.clicks || 0), 0)])
        .filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]);

      const table = (title, arr, limit = 10) => {
        const max = Math.max(1, ...arr.map(x => x[1]));
        return `<div class="mcard"><h3>${esc(title)}</h3>${arr.length ? `<table>${arr.slice(0, limit).map(([l, n]) =>
          `<tr><td>${esc(l)}<div class="bar"><span style="width:${(n / max) * 100}%"></span></div></td><td class="num">${n}</td></tr>`).join("")}</table>`
          : `<p class="small muted">Sem dados no período.</p>`}</div>`;
      };

      body.innerHTML = `
        <div class="kpis">
          <div class="kpi"><span>Cliques no período</span><b>${rows.length}</b></div>
          <div class="kpi"><span>Produtos clicados</span><b>${byProduct.length}</b></div>
          <div class="kpi"><span>Média por dia</span><b>${(rows.length / Math.max(1, days)).toFixed(1).replace(".", ",")}</b></div>
        </div>
        ${days > 1 ? `<div class="mcard"><h3>Cliques por dia</h3><div class="daychart" role="img" aria-label="Gráfico de cliques por dia">
          ${daysArr.map(d => `<div class="dcol" title="${esc(d.label)}: ${d.n} clique(s)"><span class="dval">${d.n || ""}</span><span class="dbar" style="height:${(d.n / maxDay) * 100}%"></span><span class="dlab">${esc(d.label)}</span></div>`).join("")}
        </div></div>` : ""}
        <div class="mgrid">
          ${table("Produtos mais clicados", byProduct)}
          ${table("Cliques por oferta (loja)", byOffer)}
          ${table("Categorias com mais interesse", byCat)}
          ${table("Cliques por loja", byMkt)}
          ${table("Desempenho das vitrines", bySec)}
          ${table("Origem do tráfego", bySrc)}
          ${byCamp.length ? table("Campanhas (utm_campaign)", byCamp) : ""}
          ${table("Mais acessados — total desde o início", allTime)}
        </div>
        <button type="button" class="btn secondary small" id="csv">Baixar cliques do período (CSV)</button>`;
      $("#csv").onclick = () => {
        const head = "data,produto,oferta,loja,categoria,vitrine,origem,meio,campanha,referencia";
        const lines = rows.map(r => [r.at.toDate().toISOString(), r.productId, r.offerId, r.marketplace, r.categoryId, r.section, r.source, r.medium, r.campaign, r.referrer]
          .map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
        download([head, ...lines].join("\n"), `zazum-cliques-${days}d.csv`, "text/csv");
      };
    } catch (e) {
      body.innerHTML = `<div class="notice error">Erro ao carregar métricas: ${esc(e.message)}</div>`;
    }
  }
}

// =====================================================================
//  CONFIGURAÇÕES: banner, publicação e backup
// =====================================================================
function viewConfig() {
  const b = S.settings.banner || {};
  const el = $("#view");
  el.innerHTML = `
    <section class="box">
      <h3>Banner da página inicial</h3>
      <p class="small muted">Uma faixa discreta para campanhas. Deixe desativado quando não houver campanha.</p>
      <label class="inline"><input type="checkbox" id="bact" ${b.active ? "checked" : ""}> Exibir banner</label>
      <label>Texto<input id="btext" maxlength="120" value="${esc(b.text || "")}" placeholder="Ex.: Semana do Consumidor: cupons extras em tecnologia"></label>
      <label>Link <small>(ex.: catalogo.html?v=cupons ou https://…)</small><input id="blink" maxlength="300" value="${esc(b.link || "")}"></label>
      <button type="button" class="btn" id="bsave">Salvar banner</button>
    </section>

    <section class="box">
      <h3>Publicação</h3>
      <p class="small muted">O site lê uma cópia publicada do catálogo (isso mantém o Firebase no plano gratuito). Ela é atualizada sempre que você salva algo. Use o botão abaixo se precisar forçar.</p>
      <button type="button" class="btn secondary" id="pub">Republicar vitrine agora</button>
    </section>

    <section class="box">
      <h3>Backup</h3>
      <p class="small muted">Baixe um backup completo (produtos, ofertas, categorias e configurações) regularmente. As fotos e vídeos ficam guardados no Cloudinary.</p>
      <div class="row">
        <button type="button" class="btn secondary" id="exp">⬇ Baixar backup (JSON)</button>
        <label class="btn secondary file-btn">⬆ Restaurar backup<input type="file" id="imp" accept="application/json,.json"></label>
      </div>
    </section>`;

  $("#bsave").onclick = async () => {
    const link = $("#blink").value.trim();
    if (link && link.includes(":") && !isSafeUrl(link)) return toast("Link do banner inválido: use https:// ou um endereço interno.");
    S.settings = { ...S.settings, banner: { active: $("#bact").checked, text: $("#btext").value.trim(), link } };
    try { await F.setDoc(F.doc(db, "settings", "site"), clean(S.settings)); await publish(); toast("Banner salvo e publicado!"); }
    catch (e) { toast("Erro: " + e.message); }
  };
  $("#pub").onclick = async e => {
    e.target.disabled = true;
    try { await publish(); toast("Vitrine republicada!"); } catch (ex) { toast("Erro: " + ex.message); }
    e.target.disabled = false;
  };
  $("#exp").onclick = async () => {
    await loadAll();
    const data = { app: "zazum-ofertas", exportedAt: new Date().toISOString(), categories: S.categories, products: S.products, offers: S.offers, settings: S.settings };
    download(JSON.stringify(data, null, 2), `zazum-backup-${new Date().toISOString().slice(0, 10)}.json`);
  };
  $("#imp").onchange = async e => {
    const file = e.target.files[0]; e.target.value = "";
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.products) || !Array.isArray(data.offers) || !Array.isArray(data.categories)) throw new Error("arquivo não é um backup da Zazum");
      if (!confirm(`Restaurar ${data.products.length} produtos, ${data.offers.length} ofertas e ${data.categories.length} categorias?\nItens com o mesmo código serão sobrescritos. Itens que não estão no backup serão mantidos.`)) return;
      const writes = [
        ...data.categories.map(c => ["categories", c]),
        ...data.products.map(p => ["products", p]),
        ...data.offers.filter(o => isSafeUrl(o.affiliateUrl)).map(o => ["offers", o])
      ];
      for (let i = 0; i < writes.length; i += 400) {
        const b = F.writeBatch(db);
        writes.slice(i, i + 400).forEach(([col, item]) => { const { id, ...rest } = item; if (id) b.set(F.doc(db, col, String(id)), clean(rest)); });
        await b.commit();
      }
      if (data.settings) await F.setDoc(F.doc(db, "settings", "site"), clean(data.settings));
      await publish();
      toast("Backup restaurado e publicado!");
    } catch (ex) { alert("Não foi possível restaurar: " + ex.message); }
  };
}
