import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, logout } from "../../lib/api";
import { initialsOf } from "../../lib/format";
import { useMobileScreen } from "../../components/mobile/MobileLayout";
import { useDashboardState } from "../../state/DashboardStateContext";
import { NAV_GROUPS, canSee, moduleByKey } from "../../lib/modules";

/** Screens the mobile app has behind "Mais" (Pedidos, Mesas and Cardápio live in the tab bar). */
const MOBILE_ITEMS: Record<string, { label: string; sub: string; icon: string; path: string }> = {
  atendimento: { label: "Atendimento", sub: "Tickets, chat e avaliações", icon: "fa-comments", path: "/atendimento" },
  promocoes: { label: "Promoções e cupons", sub: "Cupons e combos ativos", icon: "fa-tag", path: "/promocoes" },
  produtos: { label: "Produtos", sub: "Catálogo, estoque e movimentações", icon: "fa-boxes-stacked", path: "/produtos" },
  visao: { label: "Visão Geral", sub: "Saldo, contas da semana e atrasos", icon: "fa-scale-balanced", path: "/visao-geral" },
  pagar: { label: "Contas a Pagar", sub: "Despesas e vencimentos", icon: "fa-file-invoice-dollar", path: "/contas-a-pagar" },
  receber: { label: "Contas a Receber", sub: "Repasses e recebíveis", icon: "fa-hand-holding-dollar", path: "/contas-a-receber" },
  fiscal: { label: "Emissão Fiscal", sub: "Pedidos que precisam de nota", icon: "fa-receipt", path: "/emissao-fiscal" },
  financeiro: { label: "Minha Fatura", sub: "Taxas e mensalidade", icon: "fa-wallet", path: "/financeiro" },
  relatorios: { label: "Desempenho", sub: "Faturamento, ranking e picos", icon: "fa-chart-line", path: "/relatorios" },
  config: { label: "Configurações", sub: "Perfil, horários, equipe", icon: "fa-gear", path: "/config" }
};

export default function MobileMoreScreen() {
  const navigate = useNavigate();
  const { staffName, staffRole, theme, toggleTheme } = useDashboardState();
  const [restaurantName, setRestaurantName] = useState("");
  const { tickets } = useMobileScreen({ title: "Mais", subtitle: `${staffRole} · ${restaurantName}` });

  useEffect(() => {
    api.getRestaurant().then((r) => setRestaurantName(r.name)).catch(() => {}); // public: works for every role
  }, []);

  const unread = tickets.reduce((t, x) => t + x.unreadCount, 0);

  // Same sections as the desktop sidebar, minus what the tab bar already covers and screens the mobile app doesn't have.
  // Like the sidebar, a section left with one screen is a plain row named after the section; those rows share one card.
  const groups = NAV_GROUPS.map((g) => ({ label: g.label, items: g.keys.filter((k) => k in MOBILE_ITEMS && canSee(moduleByKey(k))).map((k) => ({ key: k, ...MOBILE_ITEMS[k] })) }));
  const sections = groups.filter((g) => g.items.length > 1);
  const loose = groups.filter((g) => g.items.length === 1).map((g) => ({ ...g.items[0], label: g.label }));
  const cards = [...sections, ...(loose.length ? [{ label: "", items: loose }] : [])];

  return (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
      <section style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: 13, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 46, height: 46, flex: "0 0 46px", borderRadius: "50%", background: "var(--brandSoft)", border: "1px solid var(--line2)", color: "var(--brandText)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "var(--text-body)", fontWeight: 600 }}>
          {initialsOf(staffName)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "var(--text-body)", fontWeight: 600 }}>{staffName}</div>
          <div style={{ fontSize: "var(--text-footnote)", color: "var(--ink3)" }}>
            {staffRole} · {restaurantName}
          </div>
        </div>
        <button type="button" onClick={toggleTheme} aria-label={theme === "dark" ? "Usar o tema claro" : "Usar o tema escuro"} style={{ width: 44, height: 44, borderRadius: 11, background: "var(--surface2)", border: "1px solid var(--line)", color: "var(--ink2)", cursor: "pointer" }}>
          <i className={`fa-solid ${theme === "dark" ? "fa-sun" : "fa-moon"}`} style={{ fontSize: 15 }} />
        </button>
      </section>

      {cards.map((g) => (
        <section key={g.label} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden" }}>
          {g.label && (
            <div className="mono" style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", fontSize: "var(--text-caption)", letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ink3)" }}>
              {g.label}
            </div>
          )}
          {g.items.map((m) => {
            const badge = m.key === "atendimento" && unread ? String(unread) : null;
            return (
              <button key={m.key} type="button" onClick={() => navigate(m.path)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", background: "transparent", border: 0, borderBottom: "1px solid var(--line)", cursor: "pointer", font: "inherit", color: "var(--ink)", padding: "0 14px", minHeight: 58 }}>
                <div style={{ width: 36, height: 36, flex: "0 0 36px", borderRadius: 10, background: "var(--surface2)", border: "1px solid var(--line)", color: "var(--ink2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <i className={`fa-solid ${m.icon}`} style={{ fontSize: 15 }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "var(--text-body)", fontWeight: 500 }}>{m.label}</div>
                  <div style={{ fontSize: "var(--text-footnote)", color: "var(--ink3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.sub}</div>
                </div>
                {badge && (
                  <span className="mono" style={{ fontSize: "var(--text-caption)", fontWeight: 600, background: "var(--brand)", color: "var(--brandInk)", borderRadius: 20, padding: "2px 8px" }}>
                    {badge}
                  </span>
                )}
                <i className="fa-solid fa-chevron-right" style={{ fontSize: 13, color: "var(--ink3)" }} />
              </button>
            );
          })}
        </section>
      ))}

      <button
        type="button"
        onClick={logout}
        style={{ minHeight: 50, background: "transparent", border: "1px solid var(--line2)", color: "var(--ink2)", borderRadius: 12, cursor: "pointer", font: "inherit", fontSize: "var(--text-subheadline)", fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
      >
        <i className="fa-solid fa-power-off" style={{ fontSize: 13 }} />
        Sair da conta
      </button>
    </div>
  );
}
