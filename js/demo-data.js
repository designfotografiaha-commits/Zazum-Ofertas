// Dados de exemplo usados enquanto o Firebase não está configurado (modo demonstração)
import { DEFAULT_CATEGORIES } from "./data.js";

const now = Date.now(), H = 3600e3, D = 24 * H;
const img = s => ({ type: "image", url: `https://picsum.photos/seed/${s}/600/600` });
const P = (id, name, categoryId, extra = {}) => ({
  id, name, categoryId, status: "ativo", featured: false, sections: [], order: 0,
  description: "Produto de exemplo do modo demonstração. Cadastre os seus pelo painel administrativo.",
  media: [img(id.toLowerCase())], ...extra
});
const O = (id, productId, marketplace, price, oldPrice, extra = {}) => ({
  id, productId, marketplace, price, oldPrice, coupon: "", couponExpires: null, status: "ativa",
  affiliateUrl: { shopee: "https://shopee.com.br/", mercadolivre: "https://www.mercadolivre.com.br/", amazon: "https://www.amazon.com.br/", magalu: "https://www.magazineluiza.com.br/" }[marketplace],
  publishedAt: now - 5 * H, priceUpdatedAt: now - 2 * H, expiresAt: null, clicks: 0, ...extra
});

export const DEMO = {
  updatedAt: now,
  settings: { banner: { active: true, text: "Modo demonstração: configure o Firebase para publicar suas próprias ofertas", link: "catalogo.html" } },
  categories: DEFAULT_CATEGORIES,
  products: [
    P("ZAZ001", "Fone Bluetooth XYZ com cancelamento de ruído", "tecnologia", {
      featured: true, sections: ["dia", "semana"],
      media: [img("zaz001a"), img("zaz001b"), { type: "youtube", url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ" }]
    }),
    P("ZAZ002", "Air fryer digital 4 litros", "casa-cozinha", { sections: ["dia"] }),
    P("ZAZ003", "Kit organizador de gavetas com 6 peças", "casa-cozinha", { sections: ["achados"] }),
    P("ZAZ004", "Tênis de corrida leve e respirável", "fitness-esportes", { sections: ["semana"] }),
    P("ZAZ005", "Controle sem fio para PC e celular", "games", { sections: ["achados", "dia"] }),
    P("ZAZ006", "Comedouro elevado antiderrapante para pets", "pets"),
    P("ZAZ007", "Jogo de chaves de precisão com 25 pontas", "ferramentas", { sections: ["achados"] }),
    P("ZAZ008", "Sérum facial com vitamina C 30 ml", "beleza")
  ],
  offers: [
    O("d1", "ZAZ001", "shopee", 129.9, 199.9, { coupon: "ZAZUM10", couponExpires: now + 3 * D, clicks: 42 }),
    O("d2", "ZAZ001", "mercadolivre", 139.9, 189.9, { clicks: 17 }),
    O("d3", "ZAZ001", "amazon", 149.0, null, { clicks: 5 }),
    O("d4", "ZAZ002", "magalu", 279.9, 399.0, { clicks: 30, publishedAt: now - 1 * H }),
    O("d5", "ZAZ003", "shopee", 34.9, null, { clicks: 12, coupon: "ACHADO5", couponExpires: now + 2 * D }),
    O("d6", "ZAZ004", "mercadolivre", 189.9, 269.9, { clicks: 8, priceUpdatedAt: now - 26 * H }),
    O("d7", "ZAZ005", "amazon", 99.9, 129.9, { clicks: 21, publishedAt: now - 30 * 60e3 }),
    O("d8", "ZAZ006", "shopee", 45.5, null, { publishedAt: now - 3 * D, priceUpdatedAt: now - 1 * D }),
    O("d9", "ZAZ007", "mercadolivre", 39.9, 59.9, { clicks: 3 }),
    O("d10", "ZAZ008", "amazon", 59.9, 79.9, { coupon: "BELEZA15", couponExpires: now + 5 * D })
  ]
};
