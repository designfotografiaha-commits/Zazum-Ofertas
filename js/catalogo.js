import { getCatalog, captureUtm, byDefaultOrder, VITRINES, MARKETPLACES, norm } from "./data.js";
import { renderChrome, cardHTML, bindActions, esc, showError } from "./ui.js";

captureUtm();
bindActions();
const main = document.getElementById("main");

const parseNum = v => { const s = String(v || "").replace(/[R$\s]/g, ""); const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s); return Number.isFinite(n) && s !== "" ? n : null; };

try {
  const cat = await getCatalog();
  const P = new URLSearchParams(location.search);
  const st = {
    q: P.get("q") || "", cat: P.get("cat") || "", mkt: P.get("mkt") || "",
    min: P.get("min") || "", max: P.get("max") || "", sort: P.get("sort") || "relevancia", v: VITRINES[P.get("v")] ? P.get("v") : ""
  };
  renderChrome(cat, { activeCat: st.cat, q: st.q });

  const mktsInUse = [...new Set(cat.live.flatMap(p => p.offers.map(o => o.marketplace)))];
  const anyFilter = st.mkt || st.min || st.max || st.sort !== "relevancia";

  main.innerHTML = `
    <nav class="crumbs" aria-label="Navegação"><a href="./">← Início</a></nav>
    <h1 id="title" class="page-title"></h1>
    <div id="vchip"></div>
    <form id="filters" class="filters" role="search" onsubmit="return false">
      <input type="search" name="q" value="${esc(st.q)}" placeholder="Buscar por nome ou código (ex.: ZAZ001)" aria-label="Buscar no catálogo" enterkeyhint="search">
      <details class="more-filters" ${anyFilter ? "open" : ""}>
        <summary>Filtros e ordenação</summary>
        <div class="filters-grid">
          <label>Categoria
            <select name="cat"><option value="">Todas</option>${cat.categories.map(c => `<option value="${esc(c.id)}" ${c.id === st.cat ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
          </label>
          <label>Loja
            <select name="mkt"><option value="">Todas</option>${mktsInUse.map(k => `<option value="${esc(k)}" ${k === st.mkt ? "selected" : ""}>${esc(MARKETPLACES[k]?.name || k)}</option>`).join("")}</select>
          </label>
          <label>Preço mínimo (R$)<input name="min" inputmode="decimal" value="${esc(st.min)}" placeholder="0"></label>
          <label>Preço máximo (R$)<input name="max" inputmode="decimal" value="${esc(st.max)}" placeholder="sem limite"></label>
          <label>Ordenar por
            <select name="sort">
              ${[["relevancia", "Relevância"], ["preco", "Menor preço"], ["desconto", "Maior desconto"], ["recentes", "Mais recentes"]]
                .map(([k, l]) => `<option value="${k}" ${k === st.sort ? "selected" : ""}>${l}</option>`).join("")}
            </select>
          </label>
        </div>
        <button type="button" class="btn ghost small" id="clear">Limpar filtros</button>
      </details>
    </form>
    <p id="count" class="muted" aria-live="polite"></p>
    <div id="results" class="grid"></div>`;

  const form = document.getElementById("filters");
  const $ = id => document.getElementById(id);

  function apply() {
    let list = cat.live;
    if (st.v) list = VITRINES[st.v].pick([...list].sort(byDefaultOrder));
    if (st.cat) list = list.filter(p => p.categoryId === st.cat);
    const words = norm(st.q).split(/\s+/).filter(Boolean);
    if (words.length) list = list.filter(p => {
      const hay = norm(`${p.name} ${p.id} ${p.description || ""} ${p.category?.name || ""}`);
      return words.every(w => hay.includes(w));
    });

    const pickV = st.v && VITRINES[st.v].offer;
    let rows = list.map(p => {
      const o = st.mkt ? p.offers.find(x => x.marketplace === st.mkt) : (pickV ? pickV(p) : p.best);
      return { p, o };
    }).filter(r => r.o);

    const min = parseNum(st.min), max = parseNum(st.max);
    if (min != null) rows = rows.filter(r => r.o.price >= min);
    if (max != null) rows = rows.filter(r => r.o.price <= max);

    const sorters = {
      preco: (a, b) => a.o.price - b.o.price,
      desconto: (a, b) => b.o.discount - a.o.discount || a.o.price - b.o.price,
      recentes: (a, b) => (b.o.publishedAt || 0) - (a.o.publishedAt || 0),
      relevancia: (st.v === "mais" || st.v === "recentes") ? null : (a, b) => byDefaultOrder(a.p, b.p)
    };
    if (sorters[st.sort]) rows.sort(sorters[st.sort]);

    const catName = st.cat ? cat.catById[st.cat]?.name : "";
    $("title").textContent = catName || (st.v ? VITRINES[st.v].title : (st.q ? `Resultados para “${st.q}”` : "Todas as ofertas"));
    document.title = `${$("title").textContent} | Zazum Ofertas`;
    $("vchip").innerHTML = st.v && catName ? `<span class="chip">Vitrine: ${esc(VITRINES[st.v].title)} <button type="button" data-clear-v aria-label="Remover vitrine">✕</button></span>` : "";
    $("count").textContent = rows.length ? `${rows.length} oferta${rows.length > 1 ? "s" : ""} encontrada${rows.length > 1 ? "s" : ""}` : "";
    $("results").innerHTML = rows.map(r => cardHTML(r.p, st.v || "busca", r.o)).join("")
      || `<div class="empty wide"><h2>Nenhuma oferta encontrada</h2><p>Tente outra palavra ou limpe os filtros.</p><a class="btn" href="catalogo.html">Ver todas as ofertas</a></div>`;

    const qs = new URLSearchParams();
    Object.entries(st).forEach(([k, v]) => { if (v && !(k === "sort" && v === "relevancia")) qs.set(k, v); });
    history.replaceState(null, "", "catalogo.html" + (qs.toString() ? "?" + qs : ""));
    document.querySelectorAll(".cat-nav a").forEach(a => {
      const id = new URL(a.href).searchParams.get("cat") || "";
      a.classList.toggle("active", id === st.cat && !st.v);
    });
  }

  let t;
  form.addEventListener("input", e => {
    const el = e.target; if (!el.name) return;
    st[el.name] = el.value;
    clearTimeout(t); t = setTimeout(apply, el.name === "q" ? 200 : 0);
  });
  $("clear").addEventListener("click", () => {
    Object.assign(st, { q: "", cat: "", mkt: "", min: "", max: "", sort: "relevancia" });
    form.reset(); [...form.elements].forEach(el => { if (el.name) el.value = st[el.name] ?? ""; });
    apply();
  });
  main.addEventListener("click", e => { if (e.target.closest("[data-clear-v]")) { st.v = ""; apply(); } });
  apply();
} catch (e) {
  renderChrome({ categories: [] });
  showError(main, e);
}
