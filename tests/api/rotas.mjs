// The API's routes, once (item 8): who may call each one, what it's for and where the dashboard calls it.
// - tests/api/autorizacao.test.ts checks this list against every route Express has and against the API's answers;
// - scripts/gerar-permissoes.ts writes docs/seguranca/permissoes.md from it;
// - scripts/conferir-permissoes.mjs calls its GET routes on a running stack and lists what answers differently.
// A new route has to be added here, or the authorization test fails.
//
// access: "public" (no token: the customer app and the login), "webhook" (Evolution → API, its shared secret),
//         "self" (any staff login, its own data), "own" (any staff role; the token's restaurant decides what comes back),
//         "admin" (the super admin key), "staff" (the restaurant's staff: min role and module, docs/adr/0005).
// min:    "funcionario" (cozinha and garçom) < "garcom" (the waiter, not the kitchen: Atendimento, Fechar conta) <
//         "administrador" < "dono".
// module: the PLAN_MODULES key that must be on (null: not a module; "a|b": either one).
// ui:     where it's called — "cliente" (customer app), "login", "admin" (Super Admin), "todas" (every dashboard screen:
//         header, session), a dashboard screen key (as the menu shows it: apps/dashboard/src/lib/modules.ts) or
//         "<screen>@<min>" (a part of that screen only those roles see). Empty: no screen calls it.

/** @typedef {"funcionario" | "garcom" | "administrador" | "dono"} Min */
/** @typedef {{ access: "public" | "webhook" | "self" | "own" | "admin" | "staff", min?: Min, module?: string | null, what: string, ui: string[] }} Rule */

const pub = (what, ...ui) => ({ access: "public", what, ui });
const admin = (what) => ({ access: "admin", what, ui: ["admin"] });
/** @returns {Rule} */
const staff = (min, module, what, ...ui) => ({ access: "staff", min, module, what, ui });

/** @type {[string, Rule][]} */
export const ROUTES = [
  ["GET /api/health", pub("Saúde da API (monitoramento, deploy)")],
  ["POST /api/auth/login", pub("Entrar (equipe)", "login")],
  ["GET /api/restaurants/", pub("Restaurantes do app do cliente (só os com Delivery)", "cliente")],
  ["GET /api/restaurants/:id", pub("Dados públicos do restaurante: nome, horários, aberto agora", "cliente", "todas")],
  ["GET /api/restaurants/:id/categories", pub("Categorias com prato, na ordem do cardápio", "cliente", "mesas")],
  ["GET /api/restaurants/:id/items", pub("Pratos do cardápio", "cliente", "cardapio", "mesas", "promocoes")],
  ["GET /api/restaurants/:id/items/:itemId", pub("Um prato, com as opções", "cliente")],
  ["GET /api/restaurants/:id/appearance", pub("Aparência publicada do cardápio", "cliente")],
  ["GET /api/tables/:tableCode", pub("A mesa do QR (restaurante e número)", "cliente")],
  ["GET /api/payment-methods/", pub("Formas de pagamento do checkout", "cliente")],
  ["POST /api/coupons/apply", pub("Aplicar cupom no checkout", "cliente")],
  ["POST /api/orders/", pub("Fazer pedido (mesa pelo QR ou delivery)", "cliente")],
  ["GET /api/orders/", pub("Pedidos deste aparelho (X-Session-Id)", "cliente")],
  ["GET /api/orders/:id", pub("Acompanhar um pedido deste aparelho", "cliente")],
  ["POST /api/orders/:id/call-waiter", pub("Chamar o garçom pela mesa", "cliente")],

  ["POST /api/whatsapp/webhook/", { access: "webhook", what: "Mensagens recebidas do WhatsApp (Evolution, cabeçalho secreto)", ui: [] }],

  ["GET /api/auth/me", { access: "self", what: "A própria sessão: papel e módulos", ui: ["todas"] }],
  ["POST /api/auth/password", { access: "self", what: "Trocar a própria senha", ui: ["todas"] }],
  ["GET /api/addresses/", { access: "own", what: "Endereços de entrega dos pedidos do próprio restaurante", ui: [] }],

  ["GET /api/admin/restaurants", admin("Lista de restaurantes")],
  ["POST /api/admin/restaurants", admin("Cadastrar restaurante e o Dono")],
  ["GET /api/admin/restaurants/:id", admin("Detalhe do restaurante, equipe e WhatsApp")],
  ["PATCH /api/admin/restaurants/:id", admin("Dados cadastrais")],
  ["PATCH /api/admin/restaurants/:id/status", admin("Ativar ou desativar")],
  ["PATCH /api/admin/restaurants/:id/modules", admin("Módulos contratados")],
  ["POST /api/admin/restaurants/:id/staff/:staffId/reset-password", admin("Senha provisória de alguém da equipe")],
  ["PATCH /api/admin/restaurants/:id/plan", admin("Valor e vencimento da mensalidade")],
  ["GET /api/admin/billing", admin("Mensalidades")],
  ["POST /api/admin/billing", admin("Gerar cobranças do mês")],
  ["POST /api/admin/billing/:chargeId/pay", admin("Marcar mensalidade como paga")],

  ["GET /api/restaurants/:id/orders", staff("funcionario", "pedidos", "Pedidos da Central", "pedidos")],
  ["GET /api/restaurants/:id/shift-stats", staff("funcionario", "pedidos", "Números do turno na Central", "pedidos")],
  ["POST /api/orders/:id/accept", staff("funcionario", "pedidos", "Aceitar pedido", "pedidos")],
  ["POST /api/orders/:id/reject", staff("funcionario", "pedidos", "Recusar pedido", "pedidos")],
  ["PATCH /api/orders/:id/stage", staff("funcionario", "pedidos", "Mudar a etapa do pedido", "pedidos")],

  ["GET /api/restaurants/:id/tables", staff("funcionario", "mesas", "Mesas e o estado de cada uma", "mesas")],
  ["POST /api/restaurants/:id/tables", staff("administrador", "mesas", "Criar mesa (Editar ambiente)", "mesas@administrador")],
  ["GET /api/restaurants/:id/salon-grid", staff("funcionario", "mesas", "Mapa do salão", "mesas")],
  ["PATCH /api/restaurants/:id/salon-grid", staff("administrador", "mesas", "Tamanho do mapa (Editar ambiente)", "mesas@administrador")],
  ["PATCH /api/restaurants/:id/tables/:number/position", staff("administrador", "mesas", "Posição da mesa no mapa", "mesas@administrador")],
  ["PATCH /api/restaurants/:id/tables/:number", staff("administrador", "mesas", "Renomear mesa", "mesas@administrador")],
  ["DELETE /api/restaurants/:id/tables/:number", staff("administrador", "mesas", "Excluir mesa", "mesas@administrador")],
  ["GET /api/restaurants/:id/tables/:number/comanda", staff("funcionario", "mesas", "Comanda aberta da mesa", "mesas")],
  ["POST /api/restaurants/:id/tables/:number/orders", staff("funcionario", "mesas", "Lançar pedido pela mesa", "mesas")],
  ["POST /api/restaurants/:id/tables/:number/close", staff("garcom", "mesas", "Fechar conta", "mesas@garcom")],
  ["POST /api/restaurants/:id/tables/:number/transfer", staff("funcionario", "mesas", "Transferir comanda", "mesas")],
  ["GET /api/restaurants/:id/tables/:number/qr", staff("funcionario", "mesas", "QR da mesa (Imprimir QR)", "mesas")],
  ["POST /api/restaurants/:id/tables/:number/qr", staff("administrador", "mesas", "Gerar novo QR (o impresso deixa de valer)", "mesas@administrador")],
  ["GET /api/restaurants/:id/waiter-calls", staff("funcionario", "mesas", "Chamados de garçom (Central)", "pedidos")],
  ["POST /api/restaurants/:id/waiter-calls/:callId/resolve", staff("funcionario", "mesas", "Atender chamado de garçom", "pedidos")],

  ["PATCH /api/restaurants/:id/items/:itemId/sold-out", staff("funcionario", "cardapio", "Esgotado / Disponível", "cardapio")],
  ["POST /api/restaurants/:id/items", staff("administrador", "cardapio", "Adicionar prato ao cardápio", "cardapio@administrador")],
  ["PATCH /api/restaurants/:id/items/:itemId", staff("administrador", "cardapio", "Organizar prato", "cardapio@administrador")],
  ["POST /api/restaurants/:id/items/:itemId/image", staff("administrador", "cardapio", "Foto do prato", "cardapio@administrador")],
  ["DELETE /api/restaurants/:id/items/:itemId", staff("administrador", "cardapio", "Remover do cardápio", "cardapio@administrador")],
  ["POST /api/restaurants/:id/items/:itemId/duplicate", staff("administrador", "cardapio", "Duplicar prato")],
  ["POST /api/restaurants/:id/items/:itemId/move", staff("administrador", "cardapio", "Reordenar prato", "cardapio@administrador")],
  // J-1: one list of categories for the Cardápio and the Catálogo — either module (both off: 403).
  ["GET /api/restaurants/:id/categories/all", staff("funcionario", "cardapio|produtos", "Todas as categorias, com quantos itens", "cardapio", "produtos")],
  ["POST /api/restaurants/:id/categories/:categoryId/move", staff("administrador", "cardapio|produtos", "Reordenar categoria", "cardapio@administrador", "produtos")],
  ["POST /api/restaurants/:id/categories", staff("administrador", "cardapio|produtos", "Nova categoria", "cardapio@administrador", "produtos")],
  ["PATCH /api/restaurants/:id/categories/:categoryId", staff("administrador", "cardapio|produtos", "Renomear categoria", "cardapio@administrador", "produtos")],
  ["DELETE /api/restaurants/:id/categories/:categoryId", staff("administrador", "cardapio|produtos", "Excluir categoria (ou mover os itens e excluir)", "cardapio@administrador", "produtos")],

  ["GET /api/restaurants/:id/coupons", staff("administrador", "promocoes", "Cupons", "promocoes")],
  ["POST /api/restaurants/:id/coupons", staff("administrador", "promocoes", "Novo cupom", "promocoes")],
  ["PATCH /api/restaurants/:id/coupons/:couponId", staff("administrador", "promocoes", "Ativar ou pausar cupom", "promocoes")],
  ["DELETE /api/restaurants/:id/coupons/:couponId", staff("administrador", "promocoes", "Excluir cupom", "promocoes")],
  ["POST /api/restaurants/:id/coupons/:couponId/duplicate", staff("administrador", "promocoes", "Duplicar cupom", "promocoes")],

  ["GET /api/restaurants/:id/tickets", staff("garcom", "atendimento", "Conversas do Atendimento", "atendimento")],
  ["PATCH /api/restaurants/:id/tickets/:ticketId", staff("garcom", "atendimento", "Status da conversa", "atendimento")],
  ["POST /api/restaurants/:id/tickets/:ticketId/messages", staff("garcom", "atendimento", "Responder (WhatsApp)", "atendimento")],
  ["POST /api/restaurants/:id/tickets/:ticketId/media", staff("garcom", "atendimento", "Enviar foto ou áudio", "atendimento")],
  ["GET /api/restaurants/:id/reviews", staff("garcom", "atendimento", "Avaliações", "atendimento", "relatorios")],
  ["POST /api/restaurants/:id/reviews/:reviewId/reply", staff("garcom", "atendimento", "Responder avaliação", "atendimento")],
  ["GET /api/restaurants/:id/whatsapp", staff("garcom", "atendimento", "Estado da conexão do WhatsApp", "atendimento", "config")],
  ["POST /api/restaurants/:id/whatsapp/terms", staff("dono", "atendimento", "Aceitar o aviso de risco do WhatsApp", "config")],
  ["POST /api/restaurants/:id/whatsapp/connect", staff("dono", "atendimento", "Conectar o WhatsApp (QR)", "config")],
  ["POST /api/restaurants/:id/whatsapp/disconnect", staff("dono", "atendimento", "Desconectar o WhatsApp", "config")],

  ["GET /api/restaurants/:id/products", staff("administrador", "produtos", "Catálogo (produtos e insumos)", "produtos", "cardapio@administrador")],
  ["POST /api/restaurants/:id/products", staff("administrador", "produtos", "Novo produto ou insumo", "produtos")],
  ["PATCH /api/restaurants/:id/products/:productId", staff("administrador", "produtos", "Editar produto ou insumo", "produtos")],
  ["GET /api/restaurants/:id/stock-movements", staff("administrador", "produtos", "Movimentações de estoque", "produtos")],
  ["POST /api/restaurants/:id/stock-movements/adjust", staff("administrador", "produtos", "Ajustar estoque (entrada, saída, contagem, custo)", "produtos")],
  ["POST /api/restaurants/:id/stock-movements/xml", staff("administrador", "produtos", "Importar XML de nota", "produtos")],

  ["GET /api/restaurants/:id/analytics", staff("administrador", "relatorios", "Relatórios", "relatorios")],
  // Contas a Pagar / a Receber / Visão Geral: one table, the module follows the entry's kind (no kind: Visão Geral).
  ["GET /api/restaurants/:id/finance-entries", staff("administrador", "visao", "Contas a pagar e a receber (sem tipo: Visão Geral)", "visao", "pagar", "receber")],
  ["POST /api/restaurants/:id/finance-entries", staff("administrador", "pagar", "Novo lançamento", "pagar", "receber")],
  ["POST /api/restaurants/:id/finance-entries/:entryId/pay", staff("administrador", "pagar", "Quitar conta", "pagar", "receber")],
  ["DELETE /api/restaurants/:id/finance-entries/:entryId", staff("administrador", "pagar", "Excluir lançamento", "pagar", "receber")],
  ["GET /api/restaurants/:id/closed-orders", staff("administrador", "fiscal", "Pedidos fechados para emitir nota", "fiscal")],
  // Minha Fatura and Configurações are not modules.
  ["GET /api/restaurants/:id/finance", staff("administrador", null, "Minha Fatura", "financeiro")],
  ["GET /api/restaurants/:id/payment-mode", staff("funcionario", null, "Como o restaurante cobra (maquininha ou PIX) e se aceita pedido pelo QR", "mesas", "config")],
  ["GET /api/restaurants/:id/profile", staff("dono", null, "Perfil do restaurante", "config")],
  ["PATCH /api/restaurants/:id/profile", staff("dono", null, "Editar perfil", "config")],
  ["GET /api/restaurants/:id/hours", staff("dono", null, "Horários", "config")],
  ["PATCH /api/restaurants/:id/hours", staff("dono", null, "Editar horários", "config")],
  ["GET /api/restaurants/:id/fiscal", staff("dono", null, "Dados fiscais", "config")],
  ["PATCH /api/restaurants/:id/fiscal", staff("dono", null, "Editar dados fiscais", "config")],
  ["PATCH /api/restaurants/:id/payment-mode", staff("dono", null, "Forma de cobrança, pedido pelo QR e serviço de 10%", "config")],
  ["GET /api/restaurants/:id/appearance/draft", staff("dono", null, "Rascunho da aparência", "config")],
  ["PATCH /api/restaurants/:id/appearance/draft", staff("dono", null, "Editar o rascunho da aparência", "config")],
  ["POST /api/restaurants/:id/appearance/publish", staff("dono", null, "Publicar a aparência", "config")],
  ["POST /api/restaurants/:id/appearance/upload", staff("dono", null, "Enviar logo ou capa", "config")],
  ["GET /api/restaurants/:id/staff", staff("dono", null, "Equipe", "config")],
  ["POST /api/restaurants/:id/staff", staff("dono", null, "Convidar alguém para a equipe", "config")],
  ["PATCH /api/restaurants/:id/staff/:staffId", staff("dono", null, "Papel, ativo e senha de alguém da equipe", "config")]
];

/** The staff roles, lowest first (StaffRole): kitchen and waiter are both Funcionário; "garcom" lets the waiter in, not the kitchen. */
export const ROLES = ["kitchen", "waiter", "manager", "owner"];
const RANK = { funcionario: 0, garcom: 1, administrador: 2, dono: 3 };
const ROLE_RANK = { kitchen: 0, waiter: 1, manager: 2, owner: 3 };
/** Whether a staff role reaches a minimum ("garcom": the waiter and up, not the kitchen). */
export const reaches = (role, min) => ROLE_RANK[role] >= RANK[min];

/** What the API answers to each caller, by the rule (modules on): 200, 401 or 403. "Sem login" is no token; "Super Admin" the
 *  admin key as Bearer (a staff route reads it as an invalid token: 401). */
export function expected(rule) {
  const out = {};
  const anyone = rule.access === "public";
  out.anon = anyone ? 200 : 401;
  for (const role of ROLES) {
    out[role] = anyone || rule.access === "self" || rule.access === "own" ? 200 : rule.access === "staff" ? (reaches(role, rule.min) ? 200 : 403) : 401;
  }
  out.superadmin = anyone || rule.access === "admin" ? 200 : 401;
  return out;
}
