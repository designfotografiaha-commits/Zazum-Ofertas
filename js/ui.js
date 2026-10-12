// Componentes visuais compartilhados: cabeçalho, rodapé, cards, compartilhamento
import { SITE } from "./config.js";
import { mkt, isSafeUrl, logClick } from "./data.js";

const REG = new Map(); // produtos renderizados (para o botão compartilhar)
export const registerProduct = p => REG.set(p.id, p);

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const money = v => (v == null || v === "" || isNaN(v)) ? "" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const fmtDate = ms => ms ? new Date(ms).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
export const safeHref = u => isSafeUrl(u) ? u : "#";

export function timeAgo(ms) {
  if (!ms) return "";
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  if (d <= 30) return `há ${d} dia${d > 1 ? "s" : ""}`;
  return "em " + fmtDate(ms);
}

// ---------- Mídia ----------
export const PLACEHOLDER = "data:image/svg+xml;utf8," + encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'><rect width='400' height='400' fill='#F1EBFF'/><text x='200' y='212' font-family='sans-serif' font-size='30' font-weight='700' fill='#6D28D9' text-anchor='middle'>Zazum</text></svg>`);

// Cloudinary: entrega a imagem comprimida, no formato ideal e no tamanho certo
export function cld(url, w) {
  if (!url || !url.includes("res.cloudinary.com") || !url.includes("/upload/")) return url;
  return url.replace("/upload/", `/upload/f_auto,q_auto,w_${w},c_limit/`);
}
export function youtubeId(url) {
  const m = String(url || "").match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}
export function videoPoster(url) {
  if (url?.includes("res.cloudinary.com") && url.includes("/video/upload/"))
    return url.replace("/video/upload/", "/video/upload/so_0,w_600,q_auto/").replace(/\.\w+(\?.*)?$/, ".jpg");
  return "";
}
export function mediaThumb(m, w = 400) {
  if (!m?.url) return PLACEHOLDER;
  if (m.type === "image") return cld(m.url, w);
  if (m.type === "youtube") { const id = youtubeId(m.url); return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : PLACEHOLDER; }
  return videoPoster(m.url) || PLACEHOLDER;
}
export function coverOf(p, w) {
  const media = p.media || [];
  return mediaThumb(media.find(x => x.type === "image") || media[0], w);
}

export const productUrl = p => new URL("produto.html?c=" + encodeURIComponent(p.id), location.href).href;

// ---------- Pedaços de card ----------
export function mktBadge(id) {
  const m = mkt(id);
  return `<span class="mkt" style="background:${m.color};color:${m.text}">${esc(m.name)}</span>`;
}
export function couponHTML(code) {
  return `<div class="coupon"><span class="coupon-label">Cupom</span><code>${esc(code)}</code><button type="button" data-copy="${esc(code)}">Copiar</button></div>`;
}
export function goLink(p, o, section, label) {
  const m = mkt(o.marketplace);
  return `<a class="btn-cta" href="${esc(safeHref(o.affiliateUrl))}" target="_blank" rel="sponsored nofollow noopener"
    data-go data-p="${esc(p.id)}" data-c="${esc(p.categoryId || "")}" data-o="${esc(o.id)}" data-m="${esc(o.marketplace)}" data-s="${esc(section)}">
    ${label || "VER OFERTA"} <small>na ${esc(m.name)} ↗</small></a>`;
}

export function cardHTML(p, section, offer) {
  const o = offer || p.best;
  if (!o) return "";
  registerProduct(p);
  const url = esc(productUrl(p));
  const others = p.offers.length - 1;
  return `<article class="card">
    <a class="card-media" href="${url}" aria-label="Ver detalhes: ${esc(p.name)}">
      <img src="${esc(coverOf(p, 400))}" alt="${esc(p.name)}" loading="lazy" decoding="async" width="400" height="400">
      ${o.discount ? `<span class="badge-off">-${o.discount}%</span>` : ""}
      ${p.featured ? `<span class="badge-hl">★ Destaque</span>` : ""}
    </a>
    <div class="card-body">
      ${mktBadge(o.marketplace)}
      <a class="card-title" href="${url}">${esc(p.name)}</a>
      <div class="card-price">
        ${o.discount ? `<span class="price-old">${money(o.oldPrice)}</span>` : ""}
        <span class="price">${money(o.price)}</span>
      </div>
      ${others > 0 ? `<a class="more-stores" href="${url}">+ ${others} outra${others > 1 ? "s" : ""} loja${others > 1 ? "s" : ""}</a>` : ""}
      ${o.couponOk ? couponHTML(o.coupon) : ""}
      ${goLink(p, o, section)}
      <div class="card-meta">
        <span title="Última verificação do preço">Preço ${o.priceUpdatedAt ? "verificado " + timeAgo(o.priceUpdatedAt) : "sem data"}</span>
        <span class="code">${esc(p.id)}</span>
      </div>
      <button type="button" class="share-btn" data-share="${esc(p.id)}" aria-label="Compartilhar ${esc(p.name)}">Compartilhar</button>
    </div>
  </article>`;
}

export function sectionHTML(title, items, key, { grid = false, limit = 8, offer } = {}) {
  if (!items.length) return "";
  return `<section class="shelf" aria-labelledby="h-${key}">
    <div class="shelf-head"><h2 id="h-${key}">${esc(title)}</h2><a href="catalogo.html?v=${key}">Ver todos <span aria-hidden="true">→</span></a></div>
    <div class="${grid ? "grid" : "rail"}">${items.slice(0, limit).map(p => cardHTML(p, key, offer ? offer(p) : p.best)).join("")}</div>
  </section>`;
}

// ---------- Cabeçalho e rodapé ----------
export function renderChrome(cat, { activeCat = "", q = "" } = {}) {
  const header = document.getElementById("site-header");
  if (header) header.innerHTML = `
    <div class="container">
      <div class="header-row">
        <a class="logo" href="./" aria-label="Zazum Ofertas — página inicial">
          <img src="img/logo.svg" alt="" width="34" height="34"><span>Zazum<b>Ofertas</b></span>
        </a>
        <form class="search" action="catalogo.html" role="search">
          <input type="search" name="q" value="${esc(q)}" placeholder="O que você procura?" aria-label="Buscar produtos" enterkeyhint="search">
          <button type="submit" aria-label="Buscar"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg></button>
        </form>
      </div>
      <nav class="cat-nav" aria-label="Categorias">
        <a href="catalogo.html" class="${!activeCat && location.pathname.endsWith("catalogo.html") ? "active" : ""}">Todas</a>
        ${(cat.categories || []).map(c => `<a href="catalogo.html?cat=${encodeURIComponent(c.id)}" class="${c.id === activeCat ? "active" : ""}">${esc(c.icon || "")} ${esc(c.name)}</a>`).join("")}
      </nav>
    </div>`;

  const footer = document.getElementById("site-footer");
  if (footer) footer.innerHTML = `
    <div class="container footer-grid">
      <div>
        <p class="footer-logo">Zazum<b>Ofertas</b></p>
        <p>${esc(SITE.slogan)}</p>
        <p class="small">Reunimos ofertas e cupons de várias lojas. A compra é feita direto na loja escolhida.</p>
      </div>
      <div>
        <h3>Transparência</h3>
        <p class="small">Os links deste site são <strong>links de afiliado</strong>: podemos receber uma comissão quando você compra por eles, sem nenhum custo extra para você. Preços, estoque e cupons podem mudar a qualquer momento nas lojas. A data em cada oferta mostra quando conferimos o preço pela última vez — confira sempre o valor final antes de pagar.</p>
      </div>
      <div>
        <h3>Contato</h3>
        <ul class="footer-links">
          ${SITE.whatsapp ? `<li><a href="https://wa.me/${esc(SITE.whatsapp)}" target="_blank" rel="noopener">WhatsApp</a></li>` : ""}
          ${SITE.instagram ? `<li><a href="https://instagram.com/${esc(SITE.instagram)}" target="_blank" rel="noopener">Instagram @${esc(SITE.instagram)}</a></li>` : ""}
          ${SITE.email ? `<li><a href="mailto:${esc(SITE.email)}">${esc(SITE.email)}</a></li>` : ""}
          <li><a href="privacidade.html">Política de privacidade</a></li>
          <li><a href="catalogo.html">Todas as ofertas</a></li>
        </ul>
      </div>
    </div>
    <div class="container footer-bottom">© ${new Date().getFullYear()} Zazum Ofertas · <a href="admin.html" rel="nofollow">Área do administrador</a></div>`;
}

// ---------- Ações: copiar cupom, compartilhar, registrar clique ----------
export async function copyText(s) {
  try { await navigator.clipboard.writeText(s); return true; }
  catch {
    const ta = document.createElement("textarea");
    ta.value = s; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;opacity:0";
    document.body.append(ta); ta.select();
    let ok = false; try { ok = document.execCommand("copy"); } catch { /* ok */ }
    ta.remove(); return ok;
  }
}

export function toast(msg) {
  let t = document.getElementById("toast");
  if (!t) {
    t = document.createElement("div"); t.id = "toast";
    t.setAttribute("role", "status"); t.setAttribute("aria-live", "polite");
    document.body.append(t);
  }
  t.textContent = msg; t.classList.add("show");
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2400);
}

export function shareText(p) {
  const o = p.best;
  let t = p.name;
  if (o) t += ` por ${money(o.price)} na ${mkt(o.marketplace).name}`;
  if (o?.couponOk) t += ` (cupom ${o.coupon})`;
  return `${t}\nCódigo: ${p.id}\n${productUrl(p)}`;
}

let dlg;
export function openShare(p) {
  const url = productUrl(p), text = shareText(p);
  if (!dlg) {
    dlg = document.createElement("dialog");
    dlg.className = "share-dlg";
    document.body.append(dlg);
  }
  dlg.innerHTML = `
    <h3>Compartilhar oferta</h3>
    <p class="small muted">${esc(p.name)} · código <strong>${esc(p.id)}</strong></p>
    <div class="share-actions">
      <a class="btn wa" href="https://wa.me/?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">WhatsApp</a>
      <button type="button" class="btn secondary" data-act="copy">Copiar link</button>
      ${navigator.share ? `<button type="button" class="btn secondary" data-act="native">Outros apps…</button>` : ""}
      <button type="button" class="btn ghost" data-act="close">Fechar</button>
    </div>`;
  dlg.onclick = async e => {
    if (e.target === dlg) return dlg.close();
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "close") dlg.close();
    if (act === "copy") { toast(await copyText(url) ? "Link copiado!" : "Não foi possível copiar"); dlg.close(); }
    if (act === "native") { try { await navigator.share({ title: p.name, text: shareText(p).replace(url, "").trim(), url }); } catch { /* cancelado */ } dlg.close(); }
  };
  dlg.showModal();
}

let bound = false;
export function bindActions() {
  if (bound) return; bound = true;
  // Se alguma imagem falhar, mostra a imagem reserva da Zazum
  document.addEventListener("error", e => {
    const img = e.target;
    if (img?.tagName === "IMG" && !img.dataset.fallback) { img.dataset.fallback = "1"; img.src = PLACEHOLDER; }
  }, true);
  const onGo = e => {
    const go = e.target.closest("a[data-go]");
    if (!go) return false;
    logClick({ id: go.dataset.p, categoryId: go.dataset.c }, { id: go.dataset.o, marketplace: go.dataset.m }, go.dataset.s);
    return true;
  };
  document.addEventListener("auxclick", e => { if (e.button === 1) onGo(e); });
  document.addEventListener("click", e => {
    if (onGo(e)) return;
    const cp = e.target.closest("[data-copy]");
    if (cp) {
      const code = cp.dataset.copy;
      copyText(code).then(ok => {
        toast(ok ? `Cupom ${code} copiado!` : "Não foi possível copiar");
        if (ok) { const old = cp.textContent; cp.textContent = "Copiado ✓"; setTimeout(() => (cp.textContent = old), 1800); }
      });
      return;
    }
    const sh = e.target.closest("[data-share]");
    if (sh) { const p = REG.get(sh.dataset.share); if (p) openShare(p); }
  });
}

export function showError(el, e) {
  console.error(e);
  el.innerHTML = `<div class="notice error"><h2>Não foi possível carregar as ofertas</h2><p>Verifique sua conexão e tente novamente.</p><button class="btn" onclick="location.reload()">Tentar de novo</button></div>`;
}
