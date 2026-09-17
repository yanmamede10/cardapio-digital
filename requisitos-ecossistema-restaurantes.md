# Documento de Requisitos — Ecossistema para Restaurantes

*v1 — 16/09/2026. Editável: preencha a coluna Status e as notas conforme for conferindo o código já implementado.*

*Auditoria de código realizada em 16/09/2026 contra o estado atual do repositório (branch `master`, commit `92cc22d`).*

## 0. Sobre este documento

Finalidade: servir de checklist para revisar se o código (já quase pronto) cobre os requisitos funcionais e não funcionais definidos até aqui. Não é uma PRD de negócio — os pontos de modelo de negócio/pricing já estão no documento de MVP; aqui o foco é o que o sistema precisa **fazer** e **garantir**.

**Prioridade:** P0 = não pode faltar para o piloto no balcão. P1 = importante, pode ser fast-follow. P2 = fora do escopo desta fase, mas a arquitetura não deve impedir.

**Status (preencher ao revisar o código):** ☐ não verificado · ✅ atende · ⚠️ parcial · ❌ não atende

## 1. Personas e entidades principais

- **Cliente final** — pede via QR na mesa, tablet fixo, ou app de delivery (Levva).
- **Operador do restaurante** (garçom/caixa/balcão) — usa a Central de Pedidos e fecha comandas.
- **Dono/gestor do restaurante** — configura a página, cardápio, acompanha pedidos e (futuramente) relatórios.
- **Admin da plataforma** (Yan/sócio) — gerencia restaurantes cadastrados, módulos contratados, cobrança.

Entidades centrais: Restaurante, Cardápio/Item, Pedido (mesa ou delivery), Comanda, Template de página, Estoque/Insumo, Fatura/Cobrança.

**Ação de valor primária:** um pedido é criado, aceito pelo restaurante e pago com sucesso. Se isso falhar sistematicamente, o produto falhou.

## 2. Requisitos Funcionais

### 2.1 Cardápio digital

| ID | P | Requisito | Critério de aceite | Status | Notas |
|---|---|---|---|---|---|
| RF-CARD-01 | P0 | Cardápio acessível via QR code na mesa | Dado um QR válido, ao escanear o cliente vê o cardápio do restaurante correto, sem login. | ✅ | `apps/web/src/screens/TableEntryScreen.tsx` resolve o QR via `api.resolveTable` sem exigir login e redireciona ao cardápio. |
| RF-CARD-02 | P0 | Cardápio acessível via tablet fixo na mesa | O mesmo motor de cardápio roda em modo tablet, associado à mesa física. | ✅ | Mesmo app `apps/web` roda em modo tablet via Capacitor Android (`apps/web/android`); mesma rota `/t/:tableCode` associada à mesa. |
| RF-CARD-03 | P0 | Mesmo motor serve o cardápio do delivery | Itens, preços e disponibilidade são a mesma fonte de dados nos três canais (QR, tablet, delivery). | ✅ | `MenuScreen.tsx` usa `api.getRestaurant/getCategories/getItems`; mesma fonte Prisma (`schema.prisma`) para mesa e delivery. |
| RF-CARD-04 | P0 | Itens organizados por categoria | Cliente navega por categorias (entradas, pratos, bebidas etc.) definidas pelo restaurante. | ✅ | Categorias via `Pill`/`activeCategory` em `apps/web/src/screens/MenuScreen.tsx`. |
| RF-CARD-05 | P0 | Item permite observações/customização | Cliente pode adicionar observação em texto livre por item (ex.: "sem cebola"). | ✅ | Campo `notes` livre por item (`ItemDetailScreen.tsx`, `lib/itemDraft.ts`). |
| RF-CARD-06 | P0 | Disponibilidade em tempo real | Item marcado como indisponível pelo restaurante some do cardápio do cliente em segundos, nos três canais. | ⚠️ | Toggle `soldOut` existe no dashboard (`menuManagement.ts` PATCH), mas `MenuScreen.tsx` do cliente busca os dados só uma vez no mount — sem polling/WS/SSE, não reflete a mudança "em segundos". |

### 2.2 Página do restaurante (personalização)

| ID | P | Requisito | Critério de aceite | Status | Notas |
|---|---|---|---|---|---|
| RF-PERS-01 | P0 | Restaurante escolhe entre 4 a 6 templates de layout | Configuração mostra as opções de template com preview visual antes de aplicar. | ❌ | Nenhum sistema de múltiplos templates de layout no código (grep por "template" só retorna CSS `gridTemplateColumns`); `SettingsScreen.tsx` não oferece opção de template/preview. |
| RF-PERS-02 | P0 | Aplicar cor de marca | Restaurante define uma cor primária que é refletida no template escolhido. | ❌ | Sem campo de cor de marca no `schema.prisma` nem na UI; a cor primária é um token CSS fixo global, igual para todos os restaurantes. |
| RF-PERS-03 | P0 | Upload de logo | Logo enviado aparece na página pública do restaurante em todos os canais (QR, tablet, delivery). | ⚠️ | `logoUrl` existe no schema/`settings.ts`, mas o botão "Trocar logo" (`MobileProfileScreen.tsx:38-40`) não tem `onClick` — parece UI morta, sem seletor de arquivo real; `logoUrl` nunca é renderizado no app do cliente (`apps/web`). |
| RF-PERS-04 | P0 | Upload de fotos de capa/pratos | Restaurante envia ao menos uma foto de capa; fotos exibidas respeitam o template escolhido. | ⚠️ | Mesmo padrão: botão "Fotos de capa" (`MobileProfileScreen.tsx:41-43`) sem handler (UI morta); no app cliente as "fotos" são só texto placeholder (`photoLabel`/`coverLabel`), sem imagem real enviada/exibida. |
| RF-PERS-05 | P0 | Preview antes de publicar | Restaurante visualiza a página como o cliente final veria, antes de tornar pública qualquer alteração. | ❌ | Nenhum fluxo de preview antes de publicar; `save`/`saveProfile` aplicam a alteração direto via `api.updateProfile`, sem etapa de revisão. |
| RF-PERS-06 | P1 | Área de descoberta mantém identidade da plataforma | Cor/tipografia da tela de descoberta não mudam por restaurante — só a página individual muda. | ⚠️ | A tela de descoberta de fato não muda (token de cor fixo), mas isso é subproduto de não existir personalização nenhuma (RF-PERS-02/03/04 ausentes) — a página individual também não muda, então o critério "só a individual muda" não é realmente demonstrável hoje. |

### 2.3 Comandas / Central de Pedidos

| ID | P | Requisito | Critério de aceite | Status | Notas |
|---|---|---|---|---|---|
| RF-COM-01 | P0 | Comanda criada automaticamente ao abrir a mesa | Primeiro pedido de uma mesa gera uma comanda; pedidos seguintes da mesma mesa somam à comanda existente. | ✅ | `apps/api/src/routes/orders.ts` abre a mesa automaticamente no 1º pedido (`RestaurantTable.openedAt`); `lib/tables.ts` soma pedidos seguintes por `createdAt >= openedAt`. |
| RF-COM-02 | P0 | Painel único mostra pedidos de mesa e delivery juntos | Operador vê ambos os tipos de pedido na mesma Central de Pedidos, com o canal de origem identificado. | ✅ | `apps/dashboard/src/screens/OrdersScreen.tsx` painel único com filtro Todos/Mesa/Delivery e ícone de canal, mesma lista de `api.listOrders()`. |
| RF-COM-03 | P0 | Pedido muda de status em formato kanban | Operador arrasta/atualiza o pedido entre status (ex.: recebido → em preparo → pronto → entregue). | ✅ | `OrdersScreen.tsx` implementa kanban real com `@dnd-kit/core` (`DndContext`/`useDraggable`/`useDroppable`) entre Recebido/Preparando/Pronto/Entregue, com `PATCH /:id/stage`. |
| RF-COM-04 | P0 | Fechar comanda | Operador fecha a comanda, calculando o total; comanda fechada não aceita novos itens sem reabrir. | ✅ | `apps/api/src/routes/restaurantTables.ts` `/close` marca pedidos como "served" e zera `openedAt`; UI (`TablesScreen.tsx`, `MobileTableDetailScreen.tsx`) mostra subtotal/serviço/total antes de fechar. |
| RF-COM-05 | P0 | Fechamento de comanda decrementa estoque | Ao fechar a comanda, os insumos dos itens vendidos são baixados automaticamente (ver RF-EST-03). | ❌ | Não existe nenhum modelo/lógica de estoque no schema; `/close` não decrementa nada (ver seção 2.9). |
| RF-COM-06 | P1 | Chamar garçom | Cliente aciona "chamar garçom" pela mesa; operador recebe notificação na Central de Pedidos. | ✅ | `apps/web/src/screens/OrderStatusScreen.tsx` + `FloatingControls.tsx` chamam `POST /api/orders/:id/call-waiter` (`orders.ts`), que cria `WaiterCall`; `OrdersScreen.tsx` mostra e resolve via polling de 4s (não é push/websocket). |

### 2.4 App de delivery (Levva)

| ID | P | Requisito | Critério de aceite | Status | Notas |
|---|---|---|---|---|---|
| RF-DELIV-01 | P0 | Cliente cria conta / faz login | Cadastro simples (nome, telefone/e-mail) antes de finalizar um pedido de delivery. | ❌ | `apps/web/src/lib/session.ts` só gera um UUID anônimo em localStorage; não há cadastro/login real, nenhum nome/telefone/e-mail é persistido em lugar nenhum. |
| RF-DELIV-02 | P0 | Checkout de delivery | Cliente conclui o pedido informando endereço e forma de pagamento (PIX). | ⚠️ | Checkout ponta a ponta com endereço funciona (`CheckoutScreen.tsx`, `ReviewScreen.tsx`), mas "Pix" é só um rótulo estático do seed — sem QR/PSP real (ver RF-PIX-01). |
| RF-DELIV-03 | P0 | Acompanhamento do pedido em tempo real | Cliente vê o status do pedido evoluir (aceito, em preparo, saiu para entrega etc.). | ✅ | `OrderStatusScreen.tsx` faz polling a cada 3s até "delivered", atualizando os estágios visualmente. |
| RF-DELIV-04 | P1 | Histórico de pedidos do cliente | Cliente acessa pedidos anteriores feitos pelo app. | ✅ | `HistoryScreen.tsx` + `api.listOrders("delivery")`, escopado pelo header `X-Session-Id`. |
| RF-DELIV-05 | P1 | Repetir pedido anterior | Cliente reconstrói um pedido passado com um clique. | ✅ | `HistoryScreen.tsx` `repeat()` recria o carrinho a partir de um pedido antigo e navega para `/cart`. |

### 2.5 Tela de descoberta de restaurantes

| ID | P | Requisito | Critério de aceite | Status | Notas |
|---|---|---|---|---|---|
| RF-DESC-01 | P0 | Listagem de restaurantes disponíveis para delivery | Cliente vê os restaurantes ativos na sua região/base. | ✅ | `DiscoveryScreen.tsx` consome `GET /api/restaurants` com dados reais do banco. |
| RF-DESC-02 | P1 | Busca/filtro por nome ou categoria | Cliente encontra um restaurante específico por busca de texto. | ✅ | Busca com debounce + filtro de culinária em `DiscoveryScreen.tsx`, filtragem server-side em `restaurants.ts`. |
| RF-DESC-03 | P0 | Só restaurantes com o módulo de delivery ativo aparecem na descoberta | Restaurante sem esse módulo contratado não é listado publicamente. | ❌ | `planModulesJson` (schema.prisma) nunca é usado para filtrar a listagem pública (`GET /api/restaurants`) — todo restaurante aparece independente de módulo contratado. |

### 2.6 Atendimento

| ID | P | Requisito | Critério de aceite | Status | Notas |
|---|---|---|---|---|---|
| RF-ATEND-01 | P1 | Chat por pedido | Cliente e restaurante trocam mensagens vinculadas a um pedido específico. | ❌ | Lado cliente (`apps/web`) não tem chat real: `SupportFab` (`FloatingControls.tsx`) só mostra um toast "Chat de suporte abrindo…"; `SupportTicket` não tem FK para `Order` (só `refLabel` texto livre) e `support.ts` não expõe endpoint para o cliente criar ticket/mensagem. |
| RF-ATEND-02 | P1 | Avaliação pós-pedido | Cliente pode avaliar o pedido após a conclusão. | ❌ | Não existe endpoint/tela para o cliente enviar avaliação; `support.ts` só tem GET `/reviews` e POST `/reviews/:id/reply` (lado restaurante). Reviews hoje só existem via `seed.ts`. |
| RF-ATEND-03 | P2 | SLA de resposta monitorado | Sistema sinaliza quando uma mensagem do cliente fica sem resposta além de X minutos. | ⚠️ | `MobileSupportScreen.tsx`/`MobileChatScreen.tsx` calculam "atrasado" (>60min desde `lastActivityAt`) e mostram banner, mas é threshold fixo (não configurável), calculado no cliente a cada reload (sem evento/alerta de backend), medindo inatividade geral e não especificamente "cliente aguardando resposta". |

### 2.7 Painel super admin

| ID | P | Requisito | Critério de aceite | Status | Notas |
|---|---|---|---|---|---|
| RF-ADMIN-01 | P0 | Cadastro e ativação de restaurantes | Admin cria um restaurante, define módulos contratados e ativa/desativa o acesso. | ❌ | Não existe endpoint `POST /api/restaurants` nem UI de cadastro/ativação; restaurantes só são criados via `apps/api/prisma/seed.ts` (script de dev). Não há painel super admin no repositório. |
| RF-ADMIN-02 | P0 | Visão consolidada de pedidos/receita entre restaurantes | Admin visualiza volume e receita agregada, sem acessar dados de outro restaurante fora desse resumo. | ❌ | `reports.ts`/`settings.ts` são sempre escopados a um único `:id`; não há rota nem tela agregando pedidos/receita entre múltiplos restaurantes. |
| RF-ADMIN-03 | P1 | Configuração de módulos por restaurante | Admin liga/desliga módulos contratados (cardápio, delivery, atendimento etc.) por restaurante individualmente. | ❌ | `planModulesJson` só é lido (exibido read-only em `FinanceScreen.tsx`/`MobileFinanceScreen.tsx`), nunca escrito por nenhuma rota; sem endpoint PATCH nem UI de toggle. |

### 2.8 Pagamentos — PIX

| ID | P | Requisito | Critério de aceite | Status | Notas |
|---|---|---|---|---|---|
| RF-PIX-01 | P0 | Gerar QR code dinâmico | Ao fechar comanda ou finalizar checkout, sistema gera um QR PIX com o valor exato. | ❌ | `orders.ts` cria `Order` direto com `status: "pending"`, sem geração de QR/cobrança; `PaymentMethod` (`paymentMethods.ts`) é só catálogo estático (label/ícone), sem valor/transação. |
| RF-PIX-02 | P0 | Confirmação automática via webhook | Pagamento confirmado pelo PSP baixa a comanda/pedido automaticamente, sem ação manual do operador. | ❌ | Nenhuma rota de webhook registrada em `apps/api/src/index.ts`; nenhuma lógica de confirmação de pagamento em lugar nenhum. |
| RF-PIX-03 | P0 | Expiração do QR | QR PIX expira após um tempo definido; expirado, não pode mais ser pago e o cliente precisa gerar outro. | ❌ | Não há cobrança/QR gerado (ver RF-PIX-01) — não existe o que expirar. |
| RF-PIX-04 | P1 | Conciliação de pagamentos PIX | Restaurante consegue ver a lista de pagamentos PIX recebidos por período. | ❌ | O "Extrato" em `FinanceScreen.tsx` (via `reports.ts`/model `BillingCharge`) é cobrança da plataforma SaaS para o restaurante (mensalidade/plano), não conciliação de PIX recebido de clientes — conceito diferente do requisito. |

### 2.9 Estoque

| ID | P | Requisito | Critério de aceite | Status | Notas |
|---|---|---|---|---|---|
| RF-EST-01 | P0 | Importar XML de NFe do fornecedor | Sistema lê um XML de NFe e extrai produtos, quantidades e valores. | ❌ | Nenhum parser de XML/NFe em todo o repositório (grep vazio por "nfe", "xml", "fornecedor"). |
| RF-EST-02 | P0 | Mapear produto do XML para o catálogo interno | Produto do XML é associado a um item/insumo já cadastrado, ou o restaurante cria um novo a partir dele. | ❌ | Não há catálogo de insumos nem mapeamento de produto — `schema.prisma` não tem nenhum modelo de estoque/insumo. |
| RF-EST-03 | P0 | Saída automática de estoque ao fechar pedido | Ao fechar a comanda (RF-COM-05), a quantidade de cada insumo vendido é decrementada — sem depender de XML de venda. | ❌ | Fechar comanda (`restaurantTables.ts`) não decrementa nenhuma quantidade; não existe campo de quantidade de insumo em lugar nenhum do schema. |
| RF-EST-04 | P1 | Alerta de estoque baixo | Restaurante é avisado quando um insumo cai abaixo de um limite configurado. | ❌ | Não existe conceito de limite/alerta de estoque no código (depende de RF-EST-01/02/03, ausentes). |

## 3. Requisitos Não Funcionais

### 3.1 Performance

| ID | P | Requisito | Critério de aceite | Status | Notas |
|---|---|---|---|---|---|
| RNF-PERF-01 | P0 | Carregamento do cardápio | Cardápio digital carrega em até 2s em conexão 4G típica. | ❌ | Sem code-splitting/lazy loading, cache ou CDN configurado em `apps/web` (nenhuma otimização de bundle no `vite.config.ts`); nenhum orçamento de performance medido/testado. |
| RNF-PERF-02 | P0 | Atualização da Central de Pedidos | Novo pedido aparece no painel do operador em até 5s após criado. | ❌ | `apps/dashboard/src/lib/live.ts` usa `POLL_MS = 15000` (polling de 15s) — acima do requisito de ≤5s; sem WebSocket/SSE. |
| RNF-PERF-03 | P1 | Suporte a picos de horário de almoço/jantar | Sistema mantém tempos de resposta sob carga simultânea de múltiplas mesas + delivery no mesmo restaurante. | ❌ | Nenhuma ferramenta de teste de carga (k6/artillery/autocannon) no repo; sem cache, fila ou rate-limit que sustente picos; SQLite single-file como banco. |

### 3.2 Segurança

| ID | P | Requisito | Critério de aceite | Status | Notas |
|---|---|---|---|---|---|
| RNF-SEG-01 | P0 | Autenticação por papel | Cliente, operador e admin têm níveis de acesso distintos; operador não acessa painel admin. | ✅ (autoavaliação — ver nota) | Implementado 17/09/2026: login real de `StaffMember` (`POST /api/auth/login`, senha com hash `scrypt` via `node:crypto`, token JWT de 12h assinado com `JWT_SECRET`). Middleware `requireStaff` (`apps/api/src/lib/auth.ts`) valida o token em toda rota do dashboard; `requireRole("owner","manager")` restringe configurações/fiscal/financeiro/cardápio/cupons/atendimento — `waiter`/`kitchen` só acessam pedidos, mesas e chamados de garçom. Não existe painel super admin (RF-ADMIN, fora de escopo desta correção), então "operador não acessa admin" está satisfeito por o admin simplesmente não existir ainda. **Autoavaliação do próprio Claude Code que implementou a correção — recomendo confirmar com uma auditoria independente antes de considerar fechado.** |
| RNF-SEG-02 | P0 | Isolamento entre restaurantes (multi-tenant) | Dados de um restaurante (pedidos, cardápio, estoque) nunca são visíveis para outro restaurante. | ✅ (autoavaliação — ver nota) | Implementado 17/09/2026: `requireOwnRestaurant` (`apps/api/src/lib/auth.ts`) rejeita com 403 sempre que o `:id` da URL não bate com o `restaurantId` do token autenticado; o restaurantId nunca mais é confiado a partir do `:id`/header do cliente para autorizar acesso — só serve para montar a URL. Ações sobre `Order` (accept/reject/stage) comparam `order.restaurantId` contra o token após carregar o registro (URL ali é o id do pedido, não do restaurante). Testado ao vivo: token de um restaurante tentando ler ou escrever em outro (`:id` diferente) agora retorna 403 em vez de 200 — reproduz e corrige o IDOR de leitura e escrita demonstrado na auditoria de segurança anterior. **Autoavaliação do próprio Claude Code que implementou a correção — recomendo confirmar com uma auditoria independente antes de considerar fechado.** Nota: o registro fiscal de `napoli` ficou com dado de teste (`"PWNED LTDA"`) de uma demonstração de IDOR feita antes desta correção, numa sessão anterior — como `napoli` não tem nenhum `StaffMember` cadastrado, não há mais como corrigir isso pela API; precisa de acesso direto ao banco ou `npm run db:seed` (que reseta todo o `dev.db`). |
| RNF-SEG-03 | P0 | Proteção contra injeção e XSS | Entradas de usuário (observações de pedido, nome, chat) são sanitizadas/parametrizadas antes de persistir ou renderizar. | ⚠️ | Sem `dangerouslySetInnerHTML` em todo o repo (React escapa por padrão no render) e sem `$queryRaw`/`$executeRaw` (Prisma parametriza todas as queries) — mas não há sanitização/validação de tamanho de input em texto livre (`notes` de pedido, chat) antes de persistir no banco. |
| RNF-SEG-04 | P0 | Segredos e chaves de PIX/PSP fora do código-fonte | Credenciais de integração ficam em variáveis de ambiente/cofre de segredos, nunca commitadas. | ✅ | `DATABASE_URL` via env (`schema.prisma`); nenhuma chave/segredo hardcoded encontrado; `.env.android` versionado não contém segredo real (só `VITE_API_URL`); `.gitignore` ignora `.env*`. Não há credenciais de PSP ainda porque não há integração PIX real (ver RF-PIX). |
| RNF-SEG-05 | P0 | Webhook do PSP validado | Sistema valida assinatura/origem do webhook de confirmação de pagamento antes de baixar a comanda. | ❌ | Não existe rota de webhook de PSP/PIX em `apps/api/src` — nada a validar porque a integração não existe (ver RF-PIX-02). |
| RNF-SEG-06 | P1 | Rate limiting em endpoints públicos | Endpoints do cardápio/checkout têm limite de requisições para mitigar abuso. | ❌ | Nenhum `express-rate-limit` ou equivalente no projeto/`package.json`. |

### 3.3 Disponibilidade e confiabilidade

| ID | P | Requisito | Critério de aceite | Status | Notas |
|---|---|---|---|---|---|
| RNF-DISP-01 | P0 | Central de Pedidos funciona mesmo se o delivery cair | Falha no app de delivery não impede pedidos de mesa via QR/tablet. | ⚠️ | `apps/dashboard` e `apps/web` são SPAs Vite totalmente separados (falha de build/runtime de um não derruba o outro no cliente), mas ambos dependem do mesmo processo Express único (`apps/api`) e mesmo SQLite — se a API cair, mesa e delivery caem juntos; não há isolamento de serviço real entre os dois canais no backend. |
| RNF-DISP-02 | P1 | Comportamento em caso de falha do PSP/PIX | Se o PSP estiver fora do ar, o sistema informa o cliente e permite tentar novamente sem duplicar cobrança. | ❌ | Sem PSP/PIX real integrado (ver RF-PIX), não há tratamento de falha, retry ou idempotência de pagamento em lugar nenhum do código. |

### 3.4 Escalabilidade

| ID | P | Requisito | Critério de aceite | Status | Notas |
|---|---|---|---|---|---|
| RNF-ESC-01 | P1 | Arquitetura multi-tenant pronta para múltiplos restaurantes | Adicionar um novo restaurante não exige mudança de código, só configuração/cadastro. | ⚠️ | Adicionar restaurante é só um INSERT (`prisma.restaurant.create`, ver `seed.ts`), sem mudar código backend; porém `apps/dashboard/src/lib/api.ts` fixa `RESTAURANT_ID` via variável de ambiente de build (fallback `"fogo"`) — cada restaurante do dashboard exige seu próprio build/deploy, sem seleção dinâmica de tenant/login. |

### 3.5 Compliance e privacidade

| ID | P | Requisito | Critério de aceite | Status | Notas |
|---|---|---|---|---|---|
| RNF-COMP-01 | P0 | Dados de pagamento não armazenados diretamente | Sistema nunca guarda dados sensíveis de pagamento — isso fica delegado ao PSP (tokenização). | ⚠️ | Nenhum dado sensível de pagamento (cartão, CVV, chave PIX) é armazenado hoje, mas só porque não há PSP/checkout de pagamento real integrado ainda (ver RF-PIX) — não é uma delegação deliberada com tokenização, é ausência de funcionalidade. |
| RNF-COMP-02 | P1 | LGPD — consentimento e exclusão de dados do cliente | Cliente final pode solicitar exclusão dos seus dados pessoais cadastrados no app de delivery. | ❌ | Nenhum endpoint/tela de exclusão de dados ou consentimento LGPD em `apps/web` ou `apps/api`. |

### 3.6 Usabilidade e acessibilidade

| ID | P | Requisito | Critério de aceite | Status | Notas |
|---|---|---|---|---|---|
| RNF-UX-01 | P0 | Responsivo em mobile e tablet | Cardápio e checkout funcionam bem tanto no celular do cliente quanto no tablet fixo da mesa. | ✅ | `apps/web/src/styles/tokens.css` define breakpoint tablet via media query, usado em 13 telas incl. `CheckoutScreen.tsx`; `apps/dashboard` tem split Desktop/Mobile via `useIsMobile.ts`. |
| RNF-UX-02 | P0 | Modo escuro | Todos os módulos (cardápio, delivery, painel) respeitam o tema escuro definido no design system. | ✅ | Dark mode real: `prefers-color-scheme` + toggle + persistência em ambos os apps (`AppContext.tsx` em `apps/web`, `DashboardStateContext.tsx` em `apps/dashboard`), tokens `[data-theme="dark"]`. |
| RNF-UX-03 | P1 | Contraste e toque acessíveis | Elementos seguem contraste mínimo AA e área de toque adequada para uso no balcão/mesa. | ⚠️ | Contraste parece adequado (tokens claros/escuros bem diferenciados), mas botões de ícone em `apps/web` são 38×38px (abaixo do mínimo recomendado de 44px) e há zero atributos `aria-*` em todo `apps/web/src`. |

### 3.7 Observabilidade / instrumentação

| ID | P | Requisito | Critério de aceite | Status | Notas |
|---|---|---|---|---|---|
| RNF-OBS-01 | P1 | Rastrear a ação de valor primária | Eventos de "pedido criado", "pedido pago" e "pedido concluído" são registrados, com o restaurante e canal de origem. | ❌ | `apps/api/src/lib/analytics.ts` só computa relatórios agregados sob demanda (GET `/reports/:id/analytics`, `/shift-stats`); nenhum evento individual de "pedido criado/pago/concluído" é registrado/persistido. |
| RNF-OBS-02 | P1 | Rastrear falhas de pagamento | Falha na geração ou confirmação do PIX gera um evento/log identificável para investigação. | ❌ | Nenhuma captura de falha de pagamento em código — também não há PSP integrado para gerar essas falhas (ver RF-PIX). |
| RNF-OBS-03 | P2 | Funil de conversão do delivery | Descoberta → página do restaurante → checkout → pagamento é rastreável como funil. | ❌ | Nenhum rastreamento de funil encontrado no código. |

## 4. Fora de escopo nesta fase

- Módulo fiscal próprio (emissão de NFC-e) — o piloto usa o PDV atual do restaurante.
- Integração TEF com maquininha de cartão — pagamento em cartão segue manual por enquanto.
- Frota própria de entregadores.
- Gestão com relatórios avançados (próxima fase do roadmap).

## 5. Notas gerais do Yan

*(espaço livre para considerações que não se encaixam em uma linha específica acima)*
