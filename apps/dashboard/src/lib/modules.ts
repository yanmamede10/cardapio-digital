export interface ModuleDef {
  key: string;
  path: string;
  label: string;
  icon: string;
  tagline: string;
}

export const MODULES: ModuleDef[] = [
  { key: "pedidos", path: "/", label: "Central de Pedidos", icon: "fa-bell-concierge", tagline: "Central de pedidos · tempo real" },
  { key: "cardapio", path: "/cardapio", label: "Cardápio", icon: "fa-utensils", tagline: "Pratos, categorias e disponibilidade" },
  { key: "mesas", path: "/mesas", label: "Mesas", icon: "fa-chair", tagline: "Mapa do salão e comandas abertas" },
  { key: "promocoes", path: "/promocoes", label: "Promoções e Cupons", icon: "fa-tag", tagline: "Cupons, combos e desempenho" },
  { key: "atendimento", path: "/atendimento", label: "Atendimento", icon: "fa-comments", tagline: "Tickets, conversas e avaliações" },
  { key: "produtos", path: "/produtos", label: "Produtos", icon: "fa-boxes-stacked", tagline: "Catálogo, estoque e movimentações" },
  { key: "relatorios", path: "/relatorios", label: "Relatórios", icon: "fa-chart-line", tagline: "Desempenho do restaurante" },
  { key: "visao", path: "/visao-geral", label: "Visão Geral", icon: "fa-scale-balanced", tagline: "Financeiro · Visão geral" },
  { key: "pagar", path: "/contas-a-pagar", label: "Contas a Pagar", icon: "fa-file-invoice-dollar", tagline: "Financeiro · Contas a pagar" },
  { key: "receber", path: "/contas-a-receber", label: "Contas a Receber", icon: "fa-hand-holding-dollar", tagline: "Financeiro · Contas a receber" },
  { key: "fiscal", path: "/emissao-fiscal", label: "Emissão Fiscal", icon: "fa-receipt", tagline: "Financeiro · Emissão fiscal" },
  { key: "financeiro", path: "/financeiro", label: "Minha Fatura", icon: "fa-wallet", tagline: "Taxas, mensalidade e extrato" },
  { key: "config", path: "/config", label: "Configurações", icon: "fa-gear", tagline: "Perfil, horários, equipe e fiscal" }
];

/** Menu sections, shared by the desktop sidebar and the mobile "Mais" screen.
 *  A section with a single module is shown as a plain link under the section's name. */
export const NAV_GROUPS: { label: string; icon: string; keys: string[] }[] = [
  { label: "Operação", icon: "fa-bell-concierge", keys: ["pedidos", "mesas", "cardapio", "atendimento", "promocoes"] },
  { label: "Produtos", icon: "fa-boxes-stacked", keys: ["produtos"] },
  { label: "Financeiro", icon: "fa-wallet", keys: ["visao", "pagar", "receber", "fiscal", "financeiro"] },
  { label: "Relatórios", icon: "fa-chart-line", keys: ["relatorios"] },
  { label: "Configurações", icon: "fa-gear", keys: ["config"] }
];

export const moduleByKey = (key: string) => MODULES.find((m) => m.key === key)!;

/** "/" is the landing module, so it only matches exactly. */
export function moduleForPath(pathname: string): ModuleDef {
  return MODULES.find((m) => m.path !== "/" && pathname.startsWith(m.path)) || MODULES[0];
}
