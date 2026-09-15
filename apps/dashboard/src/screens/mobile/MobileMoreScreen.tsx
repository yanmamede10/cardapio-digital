import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { initialsOf } from "../../lib/format";
import { useMobileScreen } from "../../components/mobile/MobileLayout";
import { useDashboardState } from "../../state/DashboardStateContext";

export default function MobileMoreScreen() {
  const navigate = useNavigate();
  const { staffName, staffRole, theme, toggleTheme } = useDashboardState();
  const [restaurantName, setRestaurantName] = useState("");
  const { tickets, notify } = useMobileScreen({ title: "Mais", subtitle: `${staffRole} · ${restaurantName}` });

  useEffect(() => {
    api.getProfile().then((p) => setRestaurantName(p.name)).catch(() => {});
  }, []);

  const unread = tickets.reduce((t, x) => t + x.unreadCount, 0);

  const items: { label: string; sub: string; icon: string; badge?: string; go: () => void }[] = [
    { label: "Atendimento", sub: "Tickets, chat e avaliações", icon: "fa-comments", badge: unread ? String(unread) : undefined, go: () => navigate("/atendimento") },
    { label: "Promoções e cupons", sub: "Cupons e combos ativos", icon: "fa-tag", go: () => navigate("/promocoes") },
    { label: "Relatórios", sub: "Faturamento, ranking e picos", icon: "fa-chart-line", go: () => navigate("/relatorios") },
    { label: "Financeiro", sub: "Taxas e mensalidade", icon: "fa-wallet", go: () => navigate("/financeiro") },
    { label: "Configurações", sub: "Perfil, horários, equipe", icon: "fa-gear", go: () => navigate("/config") }
  ];

  return (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
      <section style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: 13, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 46, height: 46, flex: "0 0 46px", borderRadius: "50%", background: "var(--brandSoft)", border: "1px solid var(--line2)", color: "var(--brandText)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600 }}>
          {initialsOf(staffName)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{staffName}</div>
          <div style={{ fontSize: 12, color: "var(--ink3)" }}>
            {staffRole} · {restaurantName}
          </div>
        </div>
        <button type="button" onClick={toggleTheme} style={{ width: 42, height: 42, borderRadius: 11, background: "var(--surface2)", border: "1px solid var(--line)", color: "var(--ink2)", cursor: "pointer" }}>
          <i className={`fa-solid ${theme === "dark" ? "fa-sun" : "fa-moon"}`} style={{ fontSize: 15 }} />
        </button>
      </section>

      <section style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden" }}>
        {items.map((m) => (
          <button key={m.label} type="button" onClick={m.go} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", background: "transparent", border: 0, borderBottom: "1px solid var(--line)", cursor: "pointer", font: "inherit", color: "var(--ink)", padding: "0 14px", minHeight: 58 }}>
            <div style={{ width: 36, height: 36, flex: "0 0 36px", borderRadius: 10, background: "var(--surface2)", border: "1px solid var(--line)", color: "var(--ink2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <i className={`fa-solid ${m.icon}`} style={{ fontSize: 15 }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 500 }}>{m.label}</div>
              <div style={{ fontSize: 11.5, color: "var(--ink3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.sub}</div>
            </div>
            {m.badge && (
              <span className="mono" style={{ fontSize: 11, fontWeight: 600, background: "var(--brand)", color: "var(--brandInk)", borderRadius: 20, padding: "2px 8px" }}>
                {m.badge}
              </span>
            )}
            <i className="fa-solid fa-chevron-right" style={{ fontSize: 13, color: "var(--ink3)" }} />
          </button>
        ))}
      </section>

      <button
        type="button"
        onClick={() => notify("Sessão encerrada")}
        style={{ minHeight: 50, background: "transparent", border: "1px solid var(--line2)", color: "var(--ink2)", borderRadius: 12, cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
      >
        <i className="fa-solid fa-power-off" style={{ fontSize: 13 }} />
        Sair da conta
      </button>
    </div>
  );
}
