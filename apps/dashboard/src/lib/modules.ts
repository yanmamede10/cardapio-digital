import type { ReactNode } from "react";
import { createRoutesFromChildren, matchRoutes } from "react-router-dom";
import { PLAN_MODULES, SCREENS, roleLevel, type StaffRole } from "@cardapio/shared";
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

// Who sees each screen (label, level, roles) is SCREENS in @cardapio/shared — the permission matrix reads it too (item 8).
// Promoções sits in Operação but its API is Administrador+. Atendimento goes by role: waiter yes, kitchen no.
const screen = (key: string, path: string, icon: string, tagline: string): ModuleDef => ({ key, path, icon, tagline, ...SCREENS[key] });
export const MODULES: ModuleDef[] = [
  screen("pedidos", "/", "fa-bell-concierge", "Central de pedidos · tempo real"),
  screen("cardapio", "/cardapio", "fa-utensils", "Pratos, categorias e disponibilidade"),
  screen("mesas", "/mesas", "fa-chair", "Mapa do salão e comandas abertas"),
  screen("promocoes", "/promocoes", "fa-tag", "Cupons, combos e desempenho"),
  screen("atendimento", "/atendimento", "fa-comments", "Tickets, conversas e avaliações"),
  screen("produtos", "/produtos", "fa-boxes-stacked", "Catálogo, estoque e movimentações"),
  screen("relatorios", "/relatorios", "fa-chart-line", "Desempenho do restaurante"),
  screen("visao", "/visao-geral", "fa-scale-balanced", "Financeiro · Visão geral"),
  screen("pagar", "/contas-a-pagar", "fa-file-invoice-dollar", "Financeiro · Contas a pagar"),
  screen("receber", "/contas-a-receber", "fa-hand-holding-dollar", "Financeiro · Contas a receber"),
  screen("fiscal", "/emissao-fiscal", "fa-receipt", "Financeiro · Emissão fiscal"),
  screen("financeiro", "/financeiro", "fa-wallet", "Taxas, mensalidade e extrato"),
  screen("config", "/config", "fa-gear", "Perfil, horários, equipe e fiscal")
];

/** Logged-in staff's level. Nav only — the API re-checks the role on every guarded request. */
export const myLevel = () => roleLevel(getSession()?.role);
/** Contracted by the restaurant (the super admin toggles them; the API answers 403 when off). Minha Fatura and
 *  Configurações aren't modules. No list yet (a session from before the refresh) → show all; the API has the last word. */
export const moduleOn = (key: string) => {
  const on = getSession()?.modules;
  return !on || !(PLAN_MODULES as readonly string[]).includes(key) || on.includes(key);
};
export const canSee = (m: ModuleDef) => moduleOn(m.key) && (m.roles ? m.roles.includes(getSession()?.role as StaffRole) : myLevel() >= m.level);

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
/** A PLAN_MODULES key's name: its screen's, or "Delivery" — the one module without a screen (the customer app's list). */
export const moduleLabel = (key: string) => MODULES.find((m) => m.key === key)?.label ?? (key === "delivery" ? "Delivery" : key);

/** Where "/" lands: Central de Pedidos, or the first screen this user sees when it's off. */
export const homePath = () => (canSee(MODULES[0]) ? "/" : MODULES.find(canSee)?.path ?? "/");

/** G-3: the menu's rule (canSee) for a typed address — a module's screen or one below it (/config/perfil); "/" and the
 *  addresses of no module pass ("/" already sends to homePath; an unknown one is a 404, UX-05). */
export function routeAllowed(pathname: string) {
  const m = MODULES.find((m) => m.path !== "/" && (pathname === m.path || pathname.startsWith(`${m.path}/`)));
  return !m || canSee(m);
}

/** UX-05: whether the router knows this address — matched against the app's own <Route> list, not a copy of it. */
export const knownPath = (screens: ReactNode, pathname: string) => matchRoutes(createRoutesFromChildren(screens), pathname) !== null;

/** "/" is the landing module, so it only matches exactly. */
export function moduleForPath(pathname: string): ModuleDef {
  return MODULES.find((m) => m.path !== "/" && pathname.startsWith(m.path)) || MODULES[0];
}
