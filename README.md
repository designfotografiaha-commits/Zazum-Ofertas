# Zazum Ofertas — site de ofertas e links de afiliado

**A gente garimpa. Você economiza.**

Site estático (HTML + CSS + JavaScript puro) para hospedar **de graça** no GitHub Pages, usando:

| Função | Serviço | Custo |
|---|---|---|
| Hospedagem do site | GitHub Pages | Grátis |
| Banco de dados (produtos, ofertas, cliques) | Firebase Firestore — plano **Spark** | Grátis, sem cartão |
| Login do administrador | Firebase Authentication (e-mail/senha) | Grátis |
| Fotos e vídeos | **Cloudinary** — plano Free | Grátis (25 créditos/mês) |

> **Por que Cloudinary e não o Firebase Storage?** Desde 2026 o Cloud Storage for Firebase exige o plano pago Blaze, mesmo para uso pequeno. O Cloudinary aceita envio direto do navegador, comprime as imagens automaticamente (formato e tamanho ideais para celular) e serve os vídeos — tudo no plano gratuito.

Enquanto o `js/config.js` não for preenchido, o site abre em **modo demonstração** com produtos de exemplo. Assim você já pode ver o visual antes de configurar qualquer coisa.

---

## Passo a passo (uns 20 minutos)

### 1. Firebase (banco de dados e login)

1. Acesse <https://console.firebase.google.com> → **Adicionar projeto** (pode desativar o Google Analytics). O projeto já começa no plano gratuito **Spark**: não cadastre cartão.
2. Menu **Build → Firestore Database → Criar banco de dados** → modo **produção** → região `southamerica-east1 (São Paulo)`.
3. Aba **Regras**: apague tudo, cole o conteúdo do arquivo `firestore.rules` e clique em **Publicar**.
4. Menu **Build → Authentication → Começar → E-mail/senha → Ativar**.
5. Aba **Users → Adicionar usuário**: e-mail `admin@zazumofertas.com` e a senha do painel. No login do site basta digitar o usuário `admin` (o domínio é completado sozinho; ele é definido em `ADMIN_LOGIN_DOMAIN` no `js/config.js`). Copie o **UID** que aparece na lista.
6. Volte ao **Firestore → Iniciar coleção**:
   - ID da coleção: `admins`
   - ID do documento: **cole o UID** do passo anterior
   - Adicione um campo qualquer, ex.: `nome` = `Henrique` → Salvar.
   (Para ter mais administradores, repita os passos 5 e 6.)
7. Engrenagem ⚙ → **Configurações do projeto → Seus apps → ícone `</>` (Web)** → registre o app (não precisa de Hosting). Copie o objeto `firebaseConfig`.
8. Em **Authentication → Configurações → Domínios autorizados**, adicione `SEU-USUARIO.github.io`.

### 2. Cloudinary (fotos e vídeos)

1. Crie a conta grátis em <https://cloudinary.com/users/register_free>.
2. No **Dashboard**, copie o **Cloud name**.
3. **Settings (engrenagem) → Upload → Upload presets → Add upload preset**:
   - Nome: `zazum_unsigned`
   - **Signing mode: Unsigned**
   - Folder: `zazum`
   - Recomendado (segurança): em *Upload Control* limite **Allowed formats** a `jpg,jpeg,png,webp,gif,mp4,mov,webm` e defina um **Max file size**.
   - Salve.

> O preset "unsigned" permite enviar arquivos sem servidor. Como o nome dele fica visível no código do site, as restrições acima evitam abuso.

### 3. Configurar o site

Abra `js/config.js` e preencha:

- `firebaseConfig` → cole o objeto copiado no passo 1.7
- `cloudinaryConfig.cloudName` → o Cloud name
- `SITE` → WhatsApp, Instagram e e-mail (aparecem no rodapé)

### 4. Publicar no GitHub Pages

1. Crie um repositório no GitHub (ex.: `zazum-ofertas`), **público**.
2. Envie **todos os arquivos desta pasta** para a raiz do repositório (pelo site: *Add file → Upload files*, arrastando a pasta inteira; inclua o arquivo `.nojekyll`).
3. **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `(root)` → Save**.
4. Em 1–2 minutos o site estará em `https://SEU-USUARIO.github.io/zazum-ofertas/` (já com HTTPS).

Domínio próprio (ex.: `zazum.com.br`): em Settings → Pages → Custom domain. Depois adicione esse domínio também nos *Domínios autorizados* do Firebase.

### 5. Primeiro uso

1. Acesse `…/admin.html` (há um link discreto no rodapé) e entre com seu e-mail e senha.
2. Aba **Categorias → Criar as 10 categorias do briefing → Salvar categorias**.
3. Aba **Produtos → + Novo produto**: preencha nome, categoria, envie fotos/vídeos e cadastre uma ou mais ofertas (uma por loja) com o link de afiliado. **Salvar e publicar**.

---

## Como funciona

### Produto × Oferta (separados)

- **Produto** (`products/ZAZ001`): nome, descrição, categoria, fotos/vídeos, vitrines, destaque, ordem.
- **Oferta** (`offers/{id}`): uma por loja, ligada ao produto por `productId`, com loja, link de afiliado, preço, preço anterior, cupom e validade do cupom, status, data de publicação, validade e data da última conferência do preço, além do contador de cliques.

Um produto pode ter quantas ofertas quiser (Shopee, Mercado Livre, Amazon…). O card mostra a de **menor preço** e avisa "+ 2 outras lojas"; a página do produto lista todas, cada uma com seu botão **VER OFERTA** logo abaixo das fotos. Essa estrutura já deixa pronto o futuro comparador de preços e o histórico de preços.

### Custo zero no Firestore

Cada vez que você salva algo, o painel gera um documento único `public/catalog` com tudo o que está no ar. O visitante faz **uma leitura por visita** (com cache de 5 minutos), em vez de ler produto por produto. O plano grátis permite 50 mil leituras e 20 mil gravações por dia, o que dá para muitos milhares de visitas diárias.

Limite: o documento tem máximo de 1 MB, o que comporta cerca de 1.500 a 2.500 ofertas ativas. O painel avisa quando estiver chegando perto. Ofertas expiradas não entram nesse documento.

### Ofertas expiradas

- Ofertas com **validade vencida** somem do site na mesma hora (o site confere a data a cada visita).
- Ao abrir o painel, elas são marcadas como **Expirada** automaticamente e continuam no painel como histórico.
- **Substituir** marca a oferta atual como expirada e cria uma cópia nova para atualizar preço e link.
- Para reativar, basta mudar o status para **Ativa** (com validade futura).

### Painel: o que precisa de revisão

O filtro **Precisam de revisão** mostra produtos sem foto, com oferta ou cupom vencido, com preço não conferido há mais de 3 dias (ajustável em `SITE.reviewAfterDays`), sem oferta ativa ou marcados como "do dia/semana" sem desconto.

### Vitrines

| Vitrine | Critério |
|---|---|
| Ofertas do dia / da semana | Marcadas no painel **e** com desconto verificado (preço anterior maior que o atual) |
| Achados Zazum | Marcados no painel (não precisam de desconto) |
| Cupons disponíveis | Automático: ofertas com cupom dentro da validade |
| Mais acessados | Automático: mais cliques |
| Recém-adicionadas | Automático: data de publicação |

### Métricas

Cada clique em VER OFERTA grava um registro anônimo (sem IP nem dados pessoais) com oferta, produto, loja, categoria, vitrine, origem e campanha UTM. A aba **Métricas** mostra cliques por produto, oferta, categoria, loja, vitrine, origem e campanha, além de um gráfico por dia e exportação em CSV.

Para rastrear campanhas, divulgue links assim:
`https://SEU-USUARIO.github.io/zazum-ofertas/produto.html?c=ZAZ001&utm_source=instagram&utm_campaign=black-friday`

Lembrete: clique não é venda. Vendas e comissões ficam nos painéis de afiliado de cada loja.

### Segurança

- Só contas listadas na coleção `admins` podem gravar (garantido pelas regras do Firestore, não só pela tela).
- Visitantes só conseguem: ler o catálogo publicado, criar registros de clique com formato validado e somar +1 no contador.
- Links de afiliado precisam começar com `https://`; o painel identifica a loja pelo domínio e pede confirmação para domínios desconhecidos ou para loja diferente da selecionada.
- Todo texto exibido é tratado contra injeção de HTML.
- O link de afiliado nunca é alterado: o botão leva exatamente ao link cadastrado.

### Backup

**Configurações → Baixar backup (JSON)** salva produtos, ofertas, categorias e configurações. Faça isso com frequência. **Restaurar backup** recoloca tudo. As fotos e vídeos ficam guardados no Cloudinary.

---

## Limitações conhecidas (e como evoluir)

- **Prévia ao compartilhar:** WhatsApp e Instagram não executam JavaScript, então a prévia mostra a imagem e o texto gerais da Zazum (`img/og-image.png`), e não a foto de cada produto. O texto do compartilhamento já inclui nome, preço, loja, cupom e código. Para prévia por produto será preciso, no futuro, gerar páginas estáticas por produto (por exemplo, com uma GitHub Action).
- **Excluir mídia** no painel remove a foto do produto, mas o arquivo continua no Cloudinary (apagar exige chave secreta, que não pode ficar no site). Limpe pela Media Library do Cloudinary quando quiser.
- **Preços não se atualizam sozinhos.** O site mostra quando cada preço foi conferido e avisa o visitante para confirmar na loja. Atualização automática depende de APIs autorizadas dos programas de afiliados (etapa futura).
- **URL do produto:** `produto.html?c=ZAZ001`. É curta, fácil de ditar e funciona no GitHub Pages sem servidor.

## Estrutura de arquivos

```
index.html          Página inicial (vitrines)
catalogo.html       Busca, categorias, filtros e ordenação
produto.html        Página da oferta (fotos/vídeos + botões das lojas)
admin.html          Painel administrativo
privacidade.html    Política de privacidade (LGPD)
css/style.css       Visual (mobile primeiro)
js/config.js        ← ÚNICO arquivo que você precisa editar
js/data.js          Regras: lojas, vitrines, expiração, cliques
js/ui.js            Cards, cabeçalho, rodapé, compartilhamento
js/admin.js         Painel completo
js/demo-data.js     Produtos de exemplo do modo demonstração
firestore.rules     Regras de segurança do banco
```
