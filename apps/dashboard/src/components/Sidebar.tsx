import { NavLink } from "react-router-dom";
import { MODULES } from "../lib/modules";
import { useDashboardState } from "../state/DashboardStateContext";

export function Sidebar({ badges }: { badges: Record<string, number> }) {
  const { theme, toggleTheme } = useDashboardState();

  return (
    <aside
      style={{
        width: 232,
        flex: "0 0 232px",
        background: "var(--surface)",
        borderRight: "1px solid var(--line)",
        display: "flex",
        flexDirection: "column",
        position: "sticky",
        top: 0,
        height: "100vh"
      }}
    >
      <div style={{ padding: "18px 18px 14px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--line)" }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            background: "var(--brand)",
            color: "var(--brandInk)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'IBM Plex Mono', monospace",
            fontWeight: 600,
            fontSize: 15
          }}
        >
          MP
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, letterSpacing: "-.01em" }}>MesaPronta</div>
          <div className="mono" style={{ fontSize: 10, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ink3)" }}>
            Gestão
          </div>
        </div>
      </div>

      <nav style={{ padding: "12px 10px", display: "flex", flexDirection: "column", gap: 2, flex: 1, overflowY: "auto" }}>
        <div className="mono" style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink3)", padding: "6px 10px 8px" }}>
          Módulos
        </div>
        {MODULES.map((m) => (
          <NavLink
            key={m.key}
            to={m.path}
            end={m.path === "/"}
            style={({ isActive }) => ({
              display: "flex",
              alignItems: "center",
              gap: 11,
              width: "100%",
              textAlign: "left",
              padding: "9px 11px",
              border: 0,
              borderRadius: 9,
              cursor: "pointer",
              fontWeight: 500,
              textDecoration: "none",
              background: isActive ? "var(--brandSoft)" : "transparent",
              color: isActive ? "var(--brandText)" : "var(--ink2)"
            })}
          >
            <i className={`fa-solid ${m.icon}`} style={{ fontSize: 20, lineHeight: 1 }} />
            <span style={{ flex: 1, minWidth: 0 }}>{m.label}</span>
            {!!badges[m.key] && (
              <span
                className="mono"
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  background: "var(--brand)",
                  color: "var(--brandInk)",
                  borderRadius: 20,
                  padding: "1px 7px"
                }}
              >
                {badges[m.key]}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div style={{ padding: "12px 14px", borderTop: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontSize: 12, color: "var(--ink3)" }}>{theme === "dark" ? "Modo escuro" : "Modo claro"}</div>
        <button
          type="button"
          onClick={toggleTheme}
          title="Alternar tema"
          className="btn-ghost"
          style={{ display: "flex", alignItems: "center", gap: 6, borderRadius: 20, padding: "5px 9px", border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--ink2)", cursor: "pointer" }}
        >
          <i className={`fa-solid ${theme === "dark" ? "fa-sun" : "fa-moon"}`} style={{ fontSize: 17, lineHeight: 1 }} />
        </button>
      </div>
    </aside>
  );
}
