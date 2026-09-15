export interface ModuleDef {
  key: string;
  path: string;
  label: string;
  icon: string;
  tagline: string;
}

export const MODULES: ModuleDef[] = [
  { key: "pedidos", path: "/", label: "Central de Pedidos", icon: "fa-bell-concierge", tagline: "Central de pedidos · tempo real" },
  { key: "cardapio", path: "/cardapio", label: "Gestão de Cardápio", icon: "fa-utensils", tagline: "Produtos, categorias e disponibilidade" },
  { key: "mesas", path: "/mesas", label: "Mesas e Comandas", icon: "fa-chair", tagline: "Mapa do salão e comandas abertas" },
  { key: "promocoes", path: "/promocoes", label: "Promoções e Cupons", icon: "fa-tag", tagline: "Cupons, combos e desempenho" },
  { key: "atendimento", path: "/atendimento", label: "Atendimento", icon: "fa-comments", tagline: "Tickets, conversas e avaliações" },
  { key: "relatorios", path: "/relatorios", label: "Relatórios", icon: "fa-chart-line", tagline: "Desempenho do restaurante" },
  { key: "financeiro", path: "/financeiro", label: "Financeiro", icon: "fa-wallet", tagline: "Taxas, mensalidade e extrato" },
  { key: "config", path: "/config", label: "Configurações", icon: "fa-gear", tagline: "Perfil, horários, equipe e fiscal" }
];

/** "/" is the landing module, so it only matches exactly. */
export function moduleForPath(pathname: string): ModuleDef {
  return MODULES.find((m) => m.path !== "/" && pathname.startsWith(m.path)) || MODULES[0];
}
