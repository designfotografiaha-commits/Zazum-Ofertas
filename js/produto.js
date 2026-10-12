import { getCatalog, captureUtm } from "./data.js";
import {
  renderChrome, cardHTML, bindActions, esc, money, timeAgo, fmtDate, cld, youtubeId, videoPoster, mediaThumb,
  mktBadge, couponHTML, goLink, registerProduct, productUrl, shareText, copyText, toast, coverOf, PLACEHOLDER, showError
} from "./ui.js";

captureUtm();
bindActions();
const main = document.getElementById("main");

function setMeta(sel, attr, val) {
  let el = document.head.querySelector(sel);
  if (!el) { el = document.createElement(sel.startsWith("link") ? "link" : "meta"); document.head.append(el); }
  Object.entries(attr).forEach(([k, v]) => el.setAttribute(k, v));
  el.setAttribute(sel.startsWith("link") ? "href" : "content", val);
}

function stageHTML(m, name) {
  if (!m) return `<img src="${PLACEHOLDER}" alt="">`;
  if (m.type === "image") return `<img src="${esc(cld(m.url, 900))}" alt="${esc(name)}" decoding="async">`;
  if (m.type === "youtube") {
    const id = youtubeId(m.url);
    return id ? `<iframe src="https://www.youtube-nocookie.com/embed/${id}" title="Vídeo: ${esc(name)}" loading="lazy"
      allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>` : "";
  }
  return `<video src="${esc(m.url)}" controls playsinline preload="metadata" ${videoPoster(m.url) ? `poster="${esc(videoPoster(m.url))}"` : ""}></video>`;
}

try {
  const cat = await getCatalog();
  const code = (new URLSearchParams(location.search).get("c") || "").trim().toUpperCase();
  const p = cat.products.find(x => String(x.id).toUpperCase() === code);
  renderChrome(cat, { activeCat: p?.categoryId || "" });

  if (!p) {
    document.title = "Oferta não encontrada | Zazum Ofertas";
    main.innerHTML = `<div class="empty"><h1>Oferta não encontrada</h1><p>Ela pode ter expirado ou sido removida${code ? ` (código ${esc(code)})` : ""}.</p><a class="btn" href="catalogo.html">Ver todas as ofertas</a></div>`;
  } else {
    registerProduct(p);
    const media = (p.media || []).filter(m => m?.url);
    const url = productUrl(p);

    // SEO básico
    const desc = `${p.name}${p.best ? ` a partir de ${money(p.best.price)}` : ""}. Código ${p.id}. Ofertas e cupons garimpados pela Zazum.`;
    document.title = `${p.name} | Zazum Ofertas`;
    setMeta('meta[name="description"]', { name: "description" }, desc);
    setMeta('link[rel="canonical"]', { rel: "canonical" }, url);
    setMeta('meta[property="og:title"]', { property: "og:title" }, p.name);
    setMeta('meta[property="og:description"]', { property: "og:description" }, desc);
    setMeta('meta[property="og:image"]', { property: "og:image" }, coverOf(p, 1200));

    const offersHTML = p.offers.length ? p.offers.map((o, i) => `
      <div class="offer ${i === 0 ? "best" : ""}">
        <div class="offer-top">${mktBadge(o.marketplace)}${i === 0 && p.offers.length > 1 ? `<span class="tag">Menor preço</span>` : ""}</div>
        <div class="card-price">
          ${o.discount ? `<span class="price-old">${money(o.oldPrice)}</span> <span class="off-inline">-${o.discount}%</span>` : ""}
          <span class="price big">${money(o.price)}</span>
        </div>
        ${o.couponOk ? couponHTML(o.coupon) + (o.couponExpires ? `<p class="small muted">Cupom válido até ${fmtDate(o.couponExpires)}</p>` : "") : ""}
        ${goLink(p, o, "produto")}
        <p class="small muted">Preço verificado ${o.priceUpdatedAt ? timeAgo(o.priceUpdatedAt) : "—"}${o.expiresAt ? ` · oferta válida até ${fmtDate(o.expiresAt)}` : ""}. Valores e estoque podem mudar; confira na loja antes de pagar.</p>
      </div>`).join("")
      : `<div class="notice">Este produto está sem ofertas ativas no momento.</div>`;

    const related = cat.live.filter(x => x.categoryId === p.categoryId && x.id !== p.id).slice(0, 4);

    main.innerHTML = `
      <nav class="crumbs" aria-label="Navegação">
        <a href="catalogo.html">← Voltar ao catálogo</a>
        ${p.category ? ` <span aria-hidden="true">·</span> <a href="catalogo.html?cat=${encodeURIComponent(p.categoryId)}">${esc(p.category.name)}</a>` : ""}
      </nav>
      <article class="product">
        <div class="gallery">
          <div class="stage" id="stage">${stageHTML(media[0], p.name)}</div>
          ${media.length > 1 ? `<div class="thumbs" role="tablist" aria-label="Fotos e vídeos">${media.map((m, i) => `
            <button type="button" role="tab" data-i="${i}" aria-selected="${i === 0}" aria-label="${m.type === "image" ? "Foto" : "Vídeo"} ${i + 1}">
              <img src="${esc(mediaThumb(m, 140))}" alt="" loading="lazy">${m.type !== "image" ? `<span class="play" aria-hidden="true">▶</span>` : ""}
            </button>`).join("")}</div>` : ""}
        </div>
        <div class="info">
          <p class="code-line">Código <strong>${esc(p.id)}</strong></p>
          <h1>${esc(p.name)}</h1>
          <div class="offers">${offersHTML}</div>
          <div class="share-row">
            <a class="btn wa" href="https://wa.me/?text=${encodeURIComponent(shareText(p))}" target="_blank" rel="noopener">Enviar no WhatsApp</a>
            <button type="button" class="btn secondary" id="copylink">Copiar link</button>
            <button type="button" class="btn secondary" data-share="${esc(p.id)}">Compartilhar</button>
          </div>
          ${p.description ? `<section class="desc"><h2>Sobre o produto</h2><p>${esc(p.description).replace(/\n/g, "<br>")}</p></section>` : ""}
        </div>
      </article>
      ${related.length ? `<section class="shelf"><div class="shelf-head"><h2>Você também pode gostar</h2></div><div class="grid">${related.map(r => cardHTML(r, "relacionados")).join("")}</div></section>` : ""}`;

    main.querySelector(".thumbs")?.addEventListener("click", e => {
      const b = e.target.closest("button[data-i]"); if (!b) return;
      document.getElementById("stage").innerHTML = stageHTML(media[+b.dataset.i], p.name);
      main.querySelectorAll(".thumbs button").forEach(x => x.setAttribute("aria-selected", x === b));
    });
    document.getElementById("copylink").addEventListener("click", async () => toast(await copyText(url) ? "Link copiado!" : "Não foi possível copiar"));
  }
} catch (e) {
  renderChrome({ categories: [] });
  showError(main, e);
}
