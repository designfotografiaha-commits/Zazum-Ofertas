// Dados, regras de negócio e registro de cliques
import { isConfigured } from "./config.js";

// ---------- Lojas (marketplaces) ----------
export const MARKETPLACES = {
  shopee:       { name: "Shopee",        color: "#EE4D2D", text: "#fff",    domains: ["shopee.com.br", "shopee.com", "shope.ee"] },
  mercadolivre: { name: "Mercado Livre", color: "#FFE600", text: "#2D3277", domains: ["mercadolivre.com.br", "mercadolivre.com", "mercadolibre.com", "meli.la"] },
  amazon:       { name: "Amazon",        color: "#232F3E", text: "#fff",    domains: ["amazon.com.br", "amazon.com", "amzn.to"] },
  magalu:       { name: "Magalu",        color: "#0086FF", text: "#fff",    domains: ["magazineluiza.com.br", "magalu.com", "magazinevoce.com.br"] },
  aliexpress:   { name: "AliExpress",    color: "#E62E04", text: "#fff",    domains: ["aliexpress.com", "aliexpress.us"] },
  shein:        { name: "Shein",         color: "#111111", text: "#fff",    domains: ["shein.com", "shein.com.br"] },
  americanas:   { name: "Americanas",    color: "#E60014", text: "#fff",    domains: ["americanas.com.br"] },
  casasbahia:   { name: "Casas Bahia",   color: "#0033A0", text: "#fff",    domains: ["casasbahia.com.br"] },
  kabum:        { name: "KaBuM!",        color: "#FF6500", text: "#fff",    domains: ["kabum.com.br"] },
  outro:        { name: "Outra loja",    color: "#4B5563", text: "#fff",    domains: [] }
};
export const mkt = id => MARKETPLACES[id] || MARKETPLACES.outro;

// ---------- Vitrines ----------
export const SECTIONS = { dia: "Ofertas do dia", semana: "Ofertas da semana", achados: "Achados Zazum" };

export const SECTION_LABELS = {
  dia: "Ofertas do dia", semana: "Ofertas da semana", achados: "Achados Zazum",
  cupons: "Cupons disponíveis", mais: "Mais acessados", recentes: "Recém-adicionadas",
  busca: "Busca / catálogo", produto: "Página do produto", relacionados: "Relacionados"
};

const hasDiscount = p => p.offers.some(o => o.discount > 0);
export const VITRINES = {
  // "Do dia" e "da semana" exigem marcação no painel E desconto verificado
  dia:      { title: "Ofertas do dia",            pick: l => l.filter(p => p.sections?.includes("dia") && hasDiscount(p)),
              offer: p => [...p.offers].filter(o => o.discount > 0).sort((a, b) => a.price - b.price)[0] },
  semana:   { title: "Ofertas da semana",         pick: l => l.filter(p => p.sections?.includes("semana") && hasDiscount(p)),
              offer: p => [...p.offers].filter(o => o.discount > 0).sort((a, b) => a.price - b.price)[0] },
  achados:  { title: "Achados Zazum",             pick: l => l.filter(p => p.sections?.includes("achados")) },
  cupons:   { title: "Cupons disponíveis",        pick: l => l.filter(p => p.offers.some(o => o.couponOk)),
              offer: p => p.offers.find(o => o.couponOk) },
  recentes: { title: "Ofertas recém-adicionadas", pick: l => [...l].sort((a, b) => b.latest - a.latest) },
  mais:     { title: "Mais acessados",            pick: l => l.filter(p => p.clicks > 0).sort((a, b) => b.clicks - a.clicks) }
};

export const DEFAULT_CATEGORIES = [
  { id: "tecnologia",       name: "Tecnologia e eletrônicos",  icon: "📱" },
  { id: "casa-cozinha",     name: "Casa e cozinha",            icon: "🏠" },
  { id: "moda-masculina",   name: "Moda masculina",            icon: "👕" },
  { id: "moda-feminina",    name: "Moda feminina",             icon: "👗" },
  { id: "fitness-esportes", name: "Fitness e esportes",        icon: "🏋️" },
  { id: "beleza",           name: "Beleza e cuidados pessoais", icon: "💄" },
  { id: "ferramentas",      name: "Ferramentas e utilidades",  icon: "🔧" },
  { id: "games",            name: "Games",                     icon: "🎮" },
  { id: "pets",             name: "Pets",                      icon: "🐾" },
  { id: "outros",           name: "Outros achados",            icon: "✨" }
].map((c, i) => ({ ...c, order: i, active: true }));

// ---------- Utilidades ----------
export const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const slugify = s => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

export function hostOf(url) { try { return new URL(url).hostname.toLowerCase(); } catch { return ""; } }
export function isSafeUrl(url) {
  try { const u = new URL(String(url).trim()); return u.protocol === "https:" && !!u.hostname && !u.username && !u.password; }
  catch { return false; }
}
export function detectMarketplace(url) {
  const h = hostOf(url);
  if (!h) return null;
  for (const [id, m] of Object.entries(MARKETPLACES))
    if (m.domains.some(d => h === d || h.endsWith("." + d))) return id;
  return null;
}

export const discountOf = o => (o.oldPrice && o.price > 0 && o.oldPrice > o.price) ? Math.round((1 - o.price / o.oldPrice) * 100) : 0;
export const couponValid = (o, now = Date.now()) => !!o.coupon && (!o.couponExpires || o.couponExpires > now);
// Uma oferta "ativa" cuja validade passou é tratada como expirada imediatamente, mesmo antes do painel atualizar o status.
export const effectiveStatus = (o, now = Date.now()) => (o.status === "ativa" && o.expiresAt && o.expiresAt <= now) ? "expirada" : o.status;

export const byDefaultOrder = (a, b) =>
  (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || (a.order ?? 999) - (b.order ?? 999) || (b.latest || 0) - (a.latest || 0);

// ---------- Catálogo público ----------
// O site público lê UM único documento (public/catalog) gerado pelo painel.
// Isso mantém o consumo do Firestore baixíssimo (1 leitura por visita) e dentro do plano gratuito.
const CACHE_KEY = "zz_catalog_v1", TTL = 5 * 60 * 1000;

export async function loadSnapshot() {
  if (!isConfigured) return (await import("./demo-data.js")).DEMO;
  try {
    const c = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
    if (c && Date.now() - c.t < TTL) return c.data;
  } catch { /* sem cache */ }
  const { db, doc, getDoc } = await import("./fb.js");
  const snap = await getDoc(doc(db, "public", "catalog"));
  const data = snap.exists() ? snap.data() : { categories: [], products: [], offers: [], settings: {} };
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), data })); } catch { /* cheio/privado */ }
  return data;
}
export function clearCache() { try { sessionStorage.removeItem(CACHE_KEY); } catch { /* ok */ } }

export function buildCatalog(raw) {
  const now = Date.now();
  const categories = (raw.categories || []).filter(c => c.active !== false).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const catById = Object.fromEntries(categories.map(c => [c.id, c]));
  const offersBy = {};
  for (const o of raw.offers || []) {
    if (effectiveStatus(o, now) !== "ativa" || !isSafeUrl(o.affiliateUrl)) continue;
    (offersBy[o.productId] ||= []).push({ ...o, discount: discountOf(o), couponOk: couponValid(o, now) });
  }
  const products = (raw.products || []).filter(p => p.status === "ativo").map(p => {
    const offers = (offersBy[p.id] || []).sort((a, b) => a.price - b.price);
    return {
      ...p, category: catById[p.categoryId] || null, offers, best: offers[0] || null,
      clicks: offers.reduce((s, o) => s + (o.clicks || 0), 0),
      latest: Math.max(0, ...offers.map(o => o.publishedAt || o.createdAt || 0))
    };
  });
  return { categories, catById, products, live: products.filter(p => p.best), settings: raw.settings || {}, updatedAt: raw.updatedAt };
}
export async function getCatalog() { return buildCatalog(await loadSnapshot()); }

// ---------- Origem do tráfego / UTM ----------
export function captureUtm() {
  try {
    const p = new URLSearchParams(location.search);
    const found = {};
    ["utm_source", "utm_medium", "utm_campaign"].forEach(k => { const v = p.get(k); if (v) found[k] = v.slice(0, 80); });
    if (Object.keys(found).length) sessionStorage.setItem("zz_utm", JSON.stringify(found));
    const ref = document.referrer ? hostOf(document.referrer) : "";
    if (ref && ref !== location.hostname && !sessionStorage.getItem("zz_ref")) sessionStorage.setItem("zz_ref", ref.slice(0, 80));
  } catch { /* ok */ }
}
function trafficInfo() {
  try { return { ...JSON.parse(sessionStorage.getItem("zz_utm") || "{}"), referrer: sessionStorage.getItem("zz_ref") || "" }; }
  catch { return {}; }
}

// ---------- Registro de cliques (anônimo, sem dados pessoais) ----------
export async function logClick(product, offer, section) {
  if (!isConfigured || !offer?.id || !product?.id) return;
  try {
    const { db, collection, addDoc, doc, updateDoc, increment, serverTimestamp } = await import("./fb.js");
    const t = trafficInfo();
    await Promise.all([
      addDoc(collection(db, "clicks"), {
        at: serverTimestamp(),
        offerId: String(offer.id).slice(0, 60),
        productId: String(product.id).slice(0, 30),
        categoryId: String(product.categoryId || "").slice(0, 60),
        marketplace: String(offer.marketplace || "outro").slice(0, 30),
        section: String(section || "").slice(0, 30),
        source: String(t.utm_source || "").slice(0, 80),
        medium: String(t.utm_medium || "").slice(0, 80),
        campaign: String(t.utm_campaign || "").slice(0, 80),
        referrer: String(t.referrer || "").slice(0, 80)
      }),
      updateDoc(doc(db, "offers", offer.id), { clicks: increment(1) })
    ]);
  } catch (e) { console.warn("Clique não registrado:", e?.message); }
}
