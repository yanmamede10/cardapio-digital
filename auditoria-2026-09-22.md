# Re-auditoria de código — Ecossistema para Restaurantes (2026-09-22)

Repositório: `cardapio-digital`. Auditoria feita lendo o código real (rotas Express, schema Prisma, telas React) — não apenas nomes de função ou existência visual de tela. Todos os vereditos abaixo têm evidência em arquivo + linha.

**Nota de contagem**: o documento de requisitos fala em "68 requisitos", mas só há 64 IDs distintos no arquivo (`RF-PIX-SUB` + 63 IDs numerados). Auditei todos os 64.

**Nota de metodologia em RNF-SEG-02**: o pedido original pede teste ativo manipulando IDs contra um servidor rodando. Não subi o servidor nesta sessão — a evidência abaixo é 100% leitura de código (extensa: todas as rotas de dashboard foram inspecionadas uma a uma). Tratem o veredito como "revisão estática completa", não como pentest.

---

## 2.1 Cardápio digital (RF-CARD)

**RF-CARD-01** — ✅ atende — `apps/web/src/App.tsx:16-24`: rotas `/`, `/t/:tableCode`, `/r/:id/menu` não têm guard de autenticação nenhum. Nenhuma tela de login existe no app `web`. Cliente acessa o cardápio direto.

**RF-CARD-02** — ✅ atende — `apps/web/src/screens/TableEntryScreen.tsx:15-21`: `/t/:tableCode` resolve a mesa via `api.resolveTable` e navega para a **mesma rota** `/r/:restaurantId/menu` usada pelo delivery — mesmo componente `MenuScreen`, mesmo motor. Não existe um app de tablet separado; é o mesmo `apps/web` aberto no tablet.

**RF-CARD-03** — ✅ atende — Mesa, tablet (mesma rota do item acima) e delivery chamam os mesmos endpoints (`GET /api/restaurants/:id/categories`, `/items`) em `apps/api/src/routes/restaurants.ts:46-68`. Fonte única de dados (Postgres via Prisma), sem duplicação por canal.

**RF-CARD-04** — ✅ atende — `apps/web/src/screens/MenuScreen.tsx:32,73-74,165`: `activeCategory` filtra `items` por `categoryId`, navegação por `CategoryNav` real (não decorativa).

**RF-CARD-05** — ✅ atende — `apps/web/src/screens/ItemDetailScreen.tsx:114-115`: campo de texto livre `draft.notes` por item, `maxLength={300}` no client; validado de novo no servidor (`apps/api/src/routes/orders.ts:11,29-31`, `MAX_NOTES_LENGTH = 300`).

**RF-CARD-06** [PROMPT ENTREGUE] — ✅ atende — `apps/web/src/screens/MenuScreen.tsx:57-59`: `setInterval` a cada 12s chama `api.getItems` de novo e atualiza `items` (que carrega `soldOut`). Fechando o loop: `apps/dashboard/src/screens/MenuScreen.tsx:141` chama `api.updateItem(m.id, { soldOut: !m.soldOut })` → `apps/api/src/routes/menuManagement.ts:83-105` persiste. Ciclo completo real, não é só no load da página.

---

## 2.2 Personalização da página do restaurante (RF-PERS)

**RF-PERS-01** [AUTOAVAL] — ✅ atende — `apps/api/src/routes/appearance.ts:13`: `TEMPLATES = ["classico","moderno","minimalista","vibrante","editorial","galeria"]` (6, dentro do range 4-6), validado no PATCH do draft. `apps/web/src/screens/MenuScreen.tsx:176,224,258,302,342`: branches de layout reais por `appearance.template` (não é só uma cor/label — o JSX muda estrutura). Persiste (`draftTemplate`/`template` no schema) e só aparece pro cliente após publish.

**RF-PERS-02** [AUTOAVAL] — ✅ atende — `apps/api/src/routes/appearance.ts:39-40`: `brandColor` validado por regex hex (`#rrggbb`); aplicado nos templates do cliente via `appearance.brandColor` (mesmo arquivo `MenuScreen.tsx` consome `serializePublicAppearance`).

**RF-PERS-03** [AUTOAVAL] — ✅ atende — `apps/api/src/routes/appearance.ts:74-109` faz upload real via `uploadPublicFile` (`apps/api/src/lib/storage.ts:1-33`, cliente S3 real com `PutObjectCommand`). **Ressalva de evidência**: o comentário em `storage.ts:4-6` diz que o endpoint configurado é o S3 do **Supabase Storage**, não Cloudflare R2 como o contexto da auditoria afirma — é S3-compatible (funcionaria com R2 trocando envs), mas hoje não está apontado pra R2. Vale confirmar com o time qual é o provider real em produção.

**RF-PERS-04** [AUTOAVAL] — ✅ atende — mesmo endpoint, `kind === "cover"` (`appearance.ts:87-90,100-106`), array `draftCoverPhotosJson` com limite `MAX_COVER_PHOTOS = 6`. Mesmo padrão do logo.

**RF-PERS-05** [AUTOAVAL] — ✅ atende — schema (`apps/api/prisma/schema.prisma:48-57`) tem campos `draftTemplate/draftBrandColor/draftLogoUrl/draftCoverPhotosJson` separados dos campos publicados `template/brandColor/appearanceLogoUrl/coverPhotosJson`. `POST /:id/appearance/publish` (`appearance.ts:58-72`) é o único lugar que copia draft→live. O endpoint público que o cliente lê (`GET /:id/appearance`, linha 112-116) serve só os campos publicados.

**RF-PERS-06** [AUTOAVAL] — ✅ atende — `apps/web/src/screens/DiscoveryScreen.tsx`: zero ocorrências de `brandColor`/`template`/`appearance` (busquei no arquivo inteiro). A listagem usa só o design fixo da plataforma.

---

## 2.3 Comandas / Central de Pedidos (RF-COM)

**RF-COM-01** — ✅ atende — `apps/api/src/routes/orders.ts:80-131`: primeiro pedido de mesa cria/abre `RestaurantTable.openedAt`; pedidos seguintes contam via `round` (linhas 80-95) e todos entram na mesma comanda por `openOrdersForTable` (`apps/api/src/lib/tables.ts:13-26`, filtra por `createdAt >= table.openedAt`).

**RF-COM-02** — ✅ atende — `apps/dashboard/src/screens/OrdersScreen.tsx:54,78,133-146`: filtro `todos/table/delivery` sobre a mesma lista de pedidos, ícone por canal (`fa-chair` vs `fa-motorcycle`, linha 358).

**RF-COM-03** — ✅ atende — `apps/dashboard/src/screens/OrdersScreen.tsx:187`: `<DndContext>` real (`@dnd-kit`), `onDragEnd={handleDragEnd}` chama `setStage` que faz `PATCH /:id/stage` (`apps/api/src/routes/orders.ts:246-254`).

**RF-COM-04** — ✅ atende — `apps/api/src/lib/tables.ts:34-65` (`buildComanda`): soma linhas, aplica `SERVICE_PCT = 10`, retorna `total = subtotal + service`. `POST /:id/tables/:number/close` (`apps/api/src/routes/restaurantTables.ts:129-136`) marca todos os pedidos abertos como `served` e zera `openedAt`.

**RF-COM-05** — ❌ não atende — nenhum decremento de estoque em lugar nenhum (`close` em `restaurantTables.ts:129-136` só atualiza status e `openedAt`; `orders.ts` não toca estoque). Além disso EST-01/EST-02 (dos quais este item depende, por regra explícita da metodologia) também são ❌ — teto do veredito confirmado por duas vias independentes.

**RF-COM-06** — ✅ atende — `apps/web/src/screens/OrderStatusScreen.tsx:55-63`: botão "Chamar garçom" chama `api.callWaiter(order.id)` → `POST /:id/call-waiter` (`apps/api/src/routes/orders.ts:153-163`) cria `WaiterCall` real; dashboard lê via `GET /:id/waiter-calls` (`restaurantTables.ts:161-167`) e resolve via `POST .../resolve`.

---

## 2.4 App de delivery (RF-DELIV)

**RF-DELIV-01** — ❌ não atende — `apps/web/src/lib/session.ts:1-10`: `getSessionId()` é exatamente o padrão que o requisito diz que não deveria mais existir — `crypto.randomUUID()` guardado em `localStorage`. Não existe rota de cadastro/login de cliente em `apps/api/src/routes` (só `auth.ts`, que é login de `StaffMember`/funcionário). Nenhum modelo `Customer` no schema.

**RF-DELIV-02** [PROMPT ENTREGUE — depende do PIX] — ❌ não atende — `apps/web/src/screens/CheckoutScreen.tsx` e `ReviewScreen.tsx`: o botão "Confirmar pedido" (`ReviewScreen.tsx:132-135`) chama `api.createOrder` direto e navega pro status — **não existe nenhuma etapa de pagamento** no checkout de delivery (nem mock: `PixPaymentModal` só é usado em `apps/dashboard/src/screens/TablesScreen.tsx`, fluxo de mesa/dashboard, nunca no app de delivery). Confirma também RF-PIX-01, do qual depende.

**RF-DELIV-03** — ✅ atende — `apps/web/src/screens/OrderStatusScreen.tsx:24-42`: polling real a cada 3s (`setTimeout(poll, 3000)`) até `status === "delivered"`, refletindo os 5 estágios definidos em `STAGES` (linhas 9-15), atualizados pelo dashboard via `PATCH /:id/stage`.

**RF-DELIV-04** — ✅ atende — `apps/web/src/screens/HistoryScreen.tsx:26-28`: `api.listOrders("delivery")` → `GET /api/orders?mode=delivery` (`apps/api/src/routes/orders.ts:142-151`), filtrado por `guestSessionId` real do banco.

**RF-DELIV-05** — ✅ atende — `apps/web/src/screens/HistoryScreen.tsx:30-44`: `repeat()` reconstrói o carrinho a partir de `order.lines` e navega pro `/cart`. **Ressalva**: reconstrói client-side usando o `unitPrice` histórico do pedido antigo, sem passar pelo endpoint `POST /:id/repeat` (`apps/api/src/routes/orders.ts:165-226`) que existe no backend e re-precifica/filtra itens esgotados — então preço exibido pode ficar desatualizado se o item mudou de preço. Funcionalmente atende o texto do requisito.

---

## 2.5 Descoberta (RF-DESC)

**RF-DESC-01** — ✅ atende — `apps/api/src/routes/restaurants.ts:22-38`: `GET /` lê `prisma.restaurant.findMany` de verdade, sem mock.

**RF-DESC-02** — ✅ atende — mesmo endpoint, linhas 26-35: filtro de `cuisine` e busca por `query` (nome/cuisine) e `sort` (rating/time/fee) todos aplicados no servidor sobre os dados do Postgres.

**RF-DESC-03** — ❌ não atende — `planModulesJson` (campo que guarda módulos contratados) só é lido em `apps/api/src/routes/reports.ts:43`, para exibição de faturamento — o endpoint de listagem (`restaurants.ts:22-38`) não filtra por módulo de delivery ativo nenhum. Todo restaurante cadastrado aparece na descoberta, tenha ou não delivery habilitado.

---

## 2.6 Atendimento (RF-ATEND)

**RF-ATEND-01** — ❌ não atende — `SupportTicket` no schema (`schema.prisma:203-217`) não tem FK pra `Order`, só um `refLabel` (string livre). Além disso não existe **nenhuma rota pública** pra criar ticket — `apps/api/src/routes/support.ts` só tem `staffGuard` (dashboard responde tickets pré-existentes, sempre de seed). Cliente não consegue abrir chat vinculado a pedido nenhum hoje.

**RF-ATEND-02** — ❌ não atende — não existe rota de criação de `Review` em lugar nenhum (`support.ts` só tem `GET /:id/reviews` e `POST /:id/reviews/:id/reply`, ambos staff). A tela `apps/web/src/screens/ReviewScreen.tsx` — apesar do nome — é a tela de **revisão do pedido antes de enviar** (confirma endereço/itens/total), não uma tela de avaliação pós-entrega. Não achei nenhuma tela de avaliação pós-pedido no app web.

**RF-ATEND-03** — ❌ não atende — decorre diretamente do item anterior: sem criação de ticket/evento de mensagem do cliente, não há nada pra medir SLA sobre. Nenhuma ocorrência de "SLA" no código.

---

## 2.7 Painel Super Admin (RF-ADMIN)

**RF-ADMIN-01** — ❌ não atende — busquei "admin" (case-insensitive) em `apps/dashboard/src`, `apps/web/src` e `apps/api/src`: zero ocorrências. Não existe app, rota ou tela de super admin em código — só o design no Claude Design, como o próprio documento já avisava.

**RF-ADMIN-02** — ❌ não atende — mesma ausência. O único endpoint de faturamento (`apps/api/src/routes/reports.ts:24-46`) é `requireOwnRestaurant` — escopado a **um** restaurante, não uma visão consolidada entre restaurantes.

**RF-ADMIN-03** — ❌ não atende — não existe rota pra habilitar/desabilitar módulo por restaurante (nem leitura teria sentido reportar como parcial, já que nem existe consumo do campo pra esse fim — ver RF-DESC-03).

**RF-ADMIN-04** — ❌ não atende — sem painel super admin, não há visão cross-restaurante nenhuma. O que existe (`reports.ts:24-46`) é o espelho do lado do restaurante (ele vendo a própria mensalidade/taxa/teto via `deliveryFeeCap`, `planPrice`, `BillingCharge`), não uma tela de plataforma vendo todos.

---

## 2.8 Pagamentos — PIX (RF-PIX / RF-FIN)

**RF-PIX-SUB** — ❌ não atende — `apps/dashboard/src/screens/SettingsFinanceTab.tsx:79,89`: o próprio código rotula o estado como `"Estado mockado — troque para visualizar"`, controlado por um `<Segmented>` que só troca um `useState` local. Nenhum `fetch`/`api.*` é chamado no arquivo inteiro — não envia nada a lugar nenhum, não persiste CNPJ/documento, não existe rota de onboarding de subconta em `apps/api/src/routes`.

**RF-PIX-01** — ❌ não atende — busquei `asaas`/`pix`/`PIX` em `apps/api/src` inteiro: zero resultado fora de nome de componente do dashboard. `apps/dashboard/src/components/pix/PixPaymentModal.tsx:9-37` gera um QR **falso** (`fakeQrDataUri`, um SVG desenhado localmente, comentário próprio diz "no real payload"). Sem Asaas, sem delivery (ver RF-DELIV-02).

**RF-PIX-02** — ❌ não atende — nenhuma rota de webhook existe em `apps/api/src/routes` (busquei "webhook" no projeto inteiro, zero ocorrências fora deste documento).

**RF-PIX-03** — ❌ não atende — `PixPaymentModal.tsx:7,41-63`: existe um timer (`WAIT_SECONDS = 296`) que muda pra `"expired"` — mas é um `setInterval` no client controlando um `useState` local, sem QR real nem geração real por trás (decorre de RF-PIX-01 ser ❌).

**RF-PIX-04** — ❌ não atende — sem split/Asaas implementado, não há nada a conciliar. Nenhum campo de "quanto ficou pro restaurante vs taxa" em `Order` ou em qualquer model.

**RF-FIN-01** [PROMPT ENTREGUE] — ❌ não atende — busquei `paymentMode` no repositório inteiro (schema, rotas, telas): **zero ocorrências**. O campo não existe no `Restaurant` do Prisma, não há seletor "PIX via sistema" vs "maquininha própria" em nenhuma tela, e o fechamento de comanda (`TablesScreen.tsx`) sempre abre o mesmo `PixPaymentModal`, sem branch. O prompt foi entregue mas não rodou, ou rodou e foi revertido — de qualquer forma, não está no código hoje.

---

## 2.9 Estoque (RF-EST)

**RF-EST-01** — ❌ não atende — busquei `estoque|stock|insumo|nfe` em todo `apps/`/`packages/`: as únicas ocorrências reais de código são menções textuais soltas em `SettingsFinanceTab.tsx` (não relacionadas a NFe) e `seed.ts`. Nenhum parser de XML de NFe, nenhuma rota de importação.

**RF-EST-02** — ❌ não atende — não existe modelo de insumo/ingrediente no `schema.prisma` (só `MenuItem`, que é o item de venda, não insumo).

**RF-EST-03** — ❌ não atende — confirma RF-COM-05: `restaurantTables.ts` (fechamento) e `orders.ts` (criação/mudança de status) não tocam estoque em nenhuma linha.

**RF-EST-04** — ❌ não atende — sem modelo de estoque, não há o que alertar. Nenhuma tela ou rota de alerta de estoque baixo encontrada.

---

## 2.10 Mapa do salão (RF-SALAO)

**RF-SALAO-01** [PROMPT ENTREGUE] — ⚠️ parcial — implementação real e sólida (`apps/api/src/routes/restaurantTables.ts:52-95`): `PATCH /:id/salon-grid` valida tamanho, `PATCH /:id/tables/:number/position` faz swap atômico via `prisma.$transaction` (linhas 87-93) quando a célula de destino já tem mesa, e mesas sem posição vão pra lista separada sem reflow (`apps/dashboard/src/screens/TablesScreen.tsx:204-205,281-287`, "Mesas sem posição · arraste pra grade") — tudo bate com o requisito. **Mas o range de grade implementado não é o pedido**: código usa `MIN_GRID_SIZE = 7`, `MAX_GRID_SIZE = 15`, **só tamanhos ímpares** (`restaurantTables.ts:13-14,54`, default `9` no schema) — ou seja, tamanhos possíveis são 7×7, 9×9, 11×11, 13×13, 15×15. O requisito pede "6x6 até 14x14". Nem os limites nem a restrição a ímpares batem com o texto atualizado do requisito — vale confirmar se o requisito mudou depois da implementação ou se é um desvio a corrigir.

---

## 3.1 Performance (RNF-PERF)

**RNF-PERF-01** — ⚠️ parcial — não verificável por leitura de código isolada (é uma medição de runtime). Nenhuma infra de teste de performance (Lighthouse CI, budget de bundle) encontrada em `package.json` dos três apps. O app `web` é uma SPA relativamente enxuta (poucas dependências, sem bibliotecas pesadas de UI), o que favorece o alvo de 2s, mas isso é inferência, não medição. Recomendo medir com o app rodando antes de fechar este item.

**RNF-PERF-02** — ✅ atende (por design) — `apps/dashboard/src/screens/OrdersScreen.tsx:71`: painel do operador faz polling a cada `4000`ms (4s), dentro do orçamento de 5s — mas isso é o intervalo de poll, não uma garantia testada sob carga real.

**RNF-PERF-03** — ⚠️ parcial — mesma ressalva do PERF-01: nenhum teste de carga (k6/artillery/etc.) no repositório, nenhuma métrica de capacidade documentada. Não há evidência de que picos de almoço/jantar foram simulados.

---

## 3.2 Segurança (RNF-SEG)

**RNF-SEG-01** [AUTOAVAL] — ✅ atende — `apps/api/src/lib/auth.ts:18-30`: hash real com `scryptSync` + salt + `timingSafeEqual` (não é hash ingênuo). `signStaffToken`/`requireStaff` (linhas 32-55) usa JWT de verdade com `JWT_SECRET` obrigatório em produção (linhas 6-9, processo recusa subir sem o env). `requireRole`/`requireOwnRestaurant` (linhas 57-72) aplicados como middleware nas rotas.

**RNF-SEG-02** [AUTOAVAL] — ⚠️ parcial — evidência de código é forte: **todas** as rotas de dashboard (`appearance`, `dashboardCoupons`, `menuManagement`, `reports`, `restaurantTables`, `settings`, `support`) usam `staffGuard = [requireStaff, requireOwnRestaurant, ...]` e, quando o recurso não está direto na URL (ex.: `couponId`), checam `existing.restaurantId !== req.params.id` antes de qualquer leitura/escrita — sem exceção encontrada. **Porém achei um furo real**: `GET /api/orders/:id` (`apps/api/src/routes/orders.ts:136-140`) não tem checagem nenhuma de dono — qualquer cliente que souber/adivinhar o `id` (cuid) de um pedido de **qualquer** restaurante consegue ler os dados completos dele (endereço referenciado, itens, valores), sem sessão nem autenticação. Não testei ativamente contra um servidor rodando (ver nota de metodologia no topo) — o veredito é baseado em leitura completa das rotas, com esse achado concreto puxando pra "parcial" em vez de "atende".

**RNF-SEG-03** [PROMPT ENTREGUE] — ✅ atende — servidor: `orders.ts:11-12,26-31` (`MAX_NOTES_LENGTH=300`, `MAX_GUEST_NAME_LENGTH=120`) e `support.ts:11,46,73` (`MAX_MESSAGE_LENGTH=2000`), ambos retornando 400 se excedido. Client: `apps/web/src/screens/CartScreen.tsx:92` e `ItemDetailScreen.tsx:117` (`maxLength={300}`, bate com o servidor), `apps/dashboard/src/screens/mobile/MobileChatScreen.tsx:137` e `SupportScreen.tsx:243,286` (`maxLength={2000}`, bate com o servidor).

**RNF-SEG-04** — ✅ atende — `apps/api/.env.example`, `apps/dashboard/.env.android`, `apps/web/.env.android` só têm placeholders/URLs de dev, sem segredo real. `apps/api/src/lib/storage.ts:7-12` lê tudo de `process.env`. `.gitignore` (raiz) ignora `.env*` exceto os `.example`/`.android`. `dev.db` (SQLite) não está versionado (`git ls-files` não lista). Busca por padrão `key/secret/password = "..."` no código não achou nada hardcoded fora de `process.env`/placeholders.

**RNF-SEG-05** — ❌ não atende — decorre de RF-PIX-02: não existe rota de webhook, logo não há nada validando assinatura/token de PSP nenhum.

**RNF-SEG-06** — ❌ não atende — busquei `rateLimit`/`express-rate-limit` em `apps/api/src` e `package.json`: zero ocorrências. Nenhum middleware de rate limiting em nenhuma rota pública (`POST /api/orders`, `POST /api/orders/:id/call-waiter`, login, etc.).

---

## 3.3 Disponibilidade (RNF-DISP)

**RNF-DISP-01** — ❌ não atende — busquei documentação (`*.md` na raiz e `acoplamento`/`coupling`/`mesmo banco`) no repositório inteiro: só existe menção ao risco dentro do próprio arquivo de requisitos/auditoria — não há README, ADR ou comentário no código do `apps/api` explicando/confirmando esse acoplamento aceito. O requisito pede só "confirme que segue documentado", e não está.

**RNF-DISP-02** — ❌ não atende — sem integração de PSP nenhuma (RF-PIX-01/02), não há tratamento de falha de PSP pra auditar — não existe o quê falhar ainda.

---

## 3.4 Escalabilidade (RNF-ESC)

**RNF-ESC-01** — ✅ atende — `apps/dashboard/src/lib/api.ts:55,59,110-116`: `RESTAURANT_ID` é setado em runtime a partir de `staff.restaurantId` retornado pelo `POST /login` (que vem do JWT decodificado no servidor, `apps/api/src/routes/auth.ts:18`) — não há restaurantId hardcoded em nenhum lugar do dashboard (busquei `restaurantId = "..."` literal, zero resultado). Adicionar restaurante = inserir linhas no banco (`Restaurant` + `StaffMember`), sem tocar no build do dashboard.

---

## 3.5 Compliance (RNF-COMP)

**RNF-COMP-01** — ✅ atende — `PaymentMethod` (`schema.prisma:113-118`) só guarda `label/note/icon` (descrição de forma de pagamento, tipo "Cartão na entrega"), nunca número de cartão/CVV. Como não há integração de PSP real ainda (RF-PIX), não há dado sensível de pagamento sendo processado/armazenado hoje — nada a violar. Vale reavaliar quando o PIX real for implementado.

**RNF-COMP-02** — ❌ não atende — busquei `exclus|LGPD|privacidade|privacy|delete.*data` em `apps/web/src` e `apps/api/src`: zero ocorrências. Não existe fluxo de solicitação de exclusão de dados nem endpoint pra isso — consistente com não haver conta de cliente real (RF-DELIV-01 ❌), então nem haveria o que "excluir" de forma estruturada hoje.

---

## 3.6 UX (RNF-UX)

**RNF-UX-01** — ✅ atende — `apps/dashboard/src/App.tsx:9,15`: `isMobile = useIsMobile()` decide entre `<MobileApp />` (22 telas dedicadas em `apps/dashboard/src/screens/mobile/`) e `<DesktopApp />` — não é só CSS responsivo espremendo o layout desktop, é uma árvore de telas mobile própria. O app `web` (cliente) já é mobile-first por natureza (classe `.screen`, `safe-area`) e ambos têm wrapper Capacitor Android (`apps/*/android/`).

**RNF-UX-02** — ✅ atende — `apps/web/src/context/AppContext.tsx:39,48-49,72-73` e `apps/dashboard/src/state/DashboardStateContext.tsx:4,22-25,39`: tema real (`data-theme` no `documentElement`), persistido em `localStorage` (chaves `cardapio.theme`/`mesapronta.theme`), com fallback pra `prefers-color-scheme` no app web.

**RNF-UX-03** [PROMPT ENTREGUE] — ⚠️ parcial — o padrão certo existe e é usado na maioria dos lugares: classe `.icon-btn` é `44×44` em ambos os apps (`apps/dashboard/src/styles/base.css:97-99`, `apps/web/src/styles/base.css:146-149`), e a maioria dos botões só-ícone tem `aria-label` (ex.: `Header.tsx:52`, `Sidebar.tsx:104`, `PixPaymentModal.tsx:125-126`). **Mas achei violação concreta**: `apps/dashboard/src/screens/mobile/MobileOrdersScreen.tsx:242` — botão de imprimir comanda, só ícone (`fa-print`), com `title` mas **sem `aria-label`**, e dimensionado inline em `42×42` (abaixo do mínimo de 44×44). Não é sistemático (é estilo inline, fora do `.icon-btn` compartilhado), mas mostra que a regra não é aplicada 100% — não fiz varredura exaustiva de toda tela mobile, então pode haver outros casos.

---

## 3.7 Observabilidade (RNF-OBS)

**RNF-OBS-01** — ❌ não atende — `apps/api/src/lib/analytics.ts` inteiro é relatório agregado sob demanda: `buildAnalytics`/`buildShiftStats` fazem `prisma.order.findMany` e agregam na hora da requisição (`reportsRouter.get("/:id/analytics", ...)`, `apps/api/src/routes/reports.ts:14-17`). Não existe tabela de evento nem qualquer registro criado no momento em que o pedido muda de estado — é reconstruído do zero a cada chamada.

**RNF-OBS-02** — ❌ não atende — decorre de não haver PSP integrado (RF-PIX): sem pagamento real, não há falha de pagamento pra capturar como evento.

**RNF-OBS-03** — ❌ não atende — nenhum rastreamento de funil (visualização → carrinho → checkout → pedido) encontrado em `apps/web/src` nem em `apps/api/src`.

---

## Fora de escopo (confirmação)

Busquei `NFC-e|NFCe|TEF|frota|entregador` em todo o código: a única ocorrência real é o texto "Entregador a caminho" em `apps/web/src/screens/OrderStatusScreen.tsx` (label de UI do estágio "saiu para entrega", não uma feature de frota). Módulo fiscal, TEF, frota própria e relatórios avançados seguem não implementados — confirmado, nada a mais a auditar aqui.

---

## Resumo

| Veredito | Qtd |
|---|---|
| ✅ atende | 30 |
| ⚠️ parcial | 5 |
| ❌ não atende | 29 |

Blocos mais sólidos: **RF-PERS** (personalização, 6/6 ✅) e **RF-CARD** (cardápio, 6/6 ✅) — condizem com o que o contexto da auditoria já indicava como "fase mais recente e mais testada". Blocos mais fracos: **RF-PIX/RF-FIN** (0/6 ✅ — tudo mock ou ausente), **RF-EST** (0/4 — não iniciado), **RF-ADMIN** (0/4 — não iniciado, confirma a nota do próprio documento) e **RF-ATEND** (0/3).
