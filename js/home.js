import { getCatalog, captureUtm, byDefaultOrder, VITRINES } from "./data.js";
import { isConfigured } from "./config.js";
import { renderChrome, sectionHTML, bindActions, esc, showError } from "./ui.js";

captureUtm();
bindActions();
const main = document.getElementById("main");

// Banner: aceita links internos (sem ":") ou https://
const bannerHref = l => (/^https:\/\//i.test(l || "") || (l && !l.includes(":"))) ? l : "catalogo.html";

try {
  const cat = await getCatalog();
  renderChrome(cat);
  const live = [...cat.live].sort(byDefaultOrder);
  const V = k => VITRINES[k].pick(live);
  const b = cat.settings?.banner;

  const banner = b?.active && b.text
    ? `<a class="banner" href="${esc(bannerHref(b.link))}">${esc(b.text)} <span aria-hidden="true">→</span></a>` : "";

  const demo = !isConfigured ? `<p class="demo-note">Você está vendo o <strong>modo demonstração</strong>. Os produtos e links abaixo são exemplos.</p>` : "";

  const hero = `<div class="hero">
      <h1>A gente garimpa. <span>Você economiza.</span></h1>
      <p>Ofertas e cupons selecionados das principais lojas, num lugar só.</p>
    </div>`;

  const cats = cat.categories.length ? `<section class="shelf" aria-labelledby="h-cats">
      <div class="shelf-head"><h2 id="h-cats">Categorias</h2><a href="catalogo.html">Ver tudo <span aria-hidden="true">→</span></a></div>
      <div class="cat-grid">${cat.categories.map(c =>
        `<a href="catalogo.html?cat=${encodeURIComponent(c.id)}"><span class="cat-ico" aria-hidden="true">${esc(c.icon || "🏷️")}</span><span>${esc(c.name)}</span></a>`).join("")}</div>
    </section>` : "";

  // Se ainda não houver "ofertas do dia", a vitrine principal mostra as mais recentes
  const dia = V("dia");
  const principal = dia.length
    ? sectionHTML(VITRINES.dia.title, dia, "dia", { grid: true, offer: VITRINES.dia.offer })
    : sectionHTML(VITRINES.recentes.title, V("recentes"), "recentes", { grid: true });

  main.innerHTML = demo + banner + hero + principal + cats
    + sectionHTML(VITRINES.achados.title, V("achados"), "achados")
    + sectionHTML(VITRINES.cupons.title, V("cupons"), "cupons", { offer: VITRINES.cupons.offer })
    + sectionHTML(VITRINES.semana.title, V("semana"), "semana", { offer: VITRINES.semana.offer })
    + sectionHTML(VITRINES.mais.title, V("mais"), "mais")
    + (dia.length ? sectionHTML(VITRINES.recentes.title, V("recentes"), "recentes") : "")
    + (live.length ? "" : `<div class="empty"><h2>Nenhuma oferta publicada ainda</h2><p>Volte em breve — estamos garimpando!</p></div>`);
} catch (e) {
  renderChrome({ categories: [] });
  showError(main, e);
}
