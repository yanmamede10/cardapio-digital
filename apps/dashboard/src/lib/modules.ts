import { LEVEL, SUPPORT_ROLES, roleLevel, type StaffRole } from "@cardapio/shared";
import { getSession } from "./api";

export interface ModuleDef {
  key: string;
  path: string;
  label: string;
  icon: string;
  tagline: string;
  /** Minimum role level that sees it — mirrors the API guard of the data the screen loads. */
  level: number;
  /** Exact roles instead of a level, when a screen splits one (same list as the API guard). */
  roles?: StaffRole[];
}

const { FUNCIONARIO, ADMINISTRADOR, DONO } = LEVEL;

// Promoções sits in Operação but its API is Administrador+. Atendimento goes by role: waiter yes, kitchen no.
export const MODULES: ModuleDef[] = [
  { key: "pedidos", path: "/", label: "Central de Pedidos", icon: "fa-bell-concierge", tagline: "Central de pedidos · tempo real", level: FUNCIONARIO },
  { key: "cardapio", path: "/cardapio", label: "Cardápio", icon: "fa-utensils", tagline: "Pratos, categorias e disponibilidade", level: FUNCIONARIO },
  { key: "mesas", path: "/mesas", label: "Mesas", icon: "fa-chair", tagline: "Mapa do salão e comandas abertas", level: FUNCIONARIO },
  { key: "promocoes", path: "/promocoes", label: "Promoções e Cupons", icon: "fa-tag", tagline: "Cupons, combos e desempenho", level: ADMINISTRADOR },
  { key: "atendimento", path: "/atendimento", label: "Atendimento", icon: "fa-comments", tagline: "Tickets, conversas e avaliações", level: FUNCIONARIO, roles: SUPPORT_ROLES },
  { key: "produtos", path: "/produtos", label: "Produtos", icon: "fa-boxes-stacked", tagline: "Catálogo, estoque e movimentações", level: ADMINISTRADOR },
  { key: "relatorios", path: "/relatorios", label: "Relatórios", icon: "fa-chart-line", tagline: "Desempenho do restaurante", level: ADMINISTRADOR },
  { key: "visao", path: "/visao-geral", label: "Visão Geral", icon: "fa-scale-balanced", tagline: "Financeiro · Visão geral", level: ADMINISTRADOR },
  { key: "pagar", path: "/contas-a-pagar", label: "Contas a Pagar", icon: "fa-file-invoice-dollar", tagline: "Financeiro · Contas a pagar", level: ADMINISTRADOR },
  { key: "receber", path: "/contas-a-receber", label: "Contas a Receber", icon: "fa-hand-holding-dollar", tagline: "Financeiro · Contas a receber", level: ADMINISTRADOR },
  { key: "fiscal", path: "/emissao-fiscal", label: "Emissão Fiscal", icon: "fa-receipt", tagline: "Financeiro · Emissão fiscal", level: ADMINISTRADOR },
  { key: "financeiro", path: "/financeiro", label: "Minha Fatura", icon: "fa-wallet", tagline: "Taxas, mensalidade e extrato", level: ADMINISTRADOR },
  { key: "config", path: "/config", label: "Configurações", icon: "fa-gear", tagline: "Perfil, horários, equipe e fiscal", level: DONO }
];

/** Logged-in staff's level. Nav only — the API re-checks the role on every guarded request. */
export const myLevel = () => roleLevel(getSession()?.role);
export const canSee = (m: ModuleDef) => (m.roles ? m.roles.includes(getSession()?.role as StaffRole) : myLevel() >= m.level);

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
