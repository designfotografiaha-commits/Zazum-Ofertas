// Páginas simples (ex.: política de privacidade): apenas cabeçalho e rodapé
import { getCatalog } from "./data.js";
import { renderChrome, bindActions } from "./ui.js";

bindActions();
getCatalog().then(c => renderChrome(c)).catch(() => renderChrome({ categories: [] }));
