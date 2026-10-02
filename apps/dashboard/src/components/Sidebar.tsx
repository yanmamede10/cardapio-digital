import { useState, type CSSProperties } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { NAV_GROUPS, canSee, moduleByKey, moduleForPath } from "../lib/modules";
import { useDashboardState } from "../state/DashboardStateContext";
import { logout } from "../lib/api";

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 11,
  width: "100%",
  textAlign: "left",
  padding: "11px 13px",
  border: 0,
  borderRadius: 12,
  cursor: "pointer",
  fontSize: 13.5,
  fontWeight: 600,
  letterSpacing: "-.008em",
  textDecoration: "none",
  color: "var(--ink2)",
  transition: "background .12s var(--ease-spring), color .12s var(--ease-spring)"
};
const childStyle: CSSProperties = { ...rowStyle, gap: 9, padding: "9px 12px", borderRadius: 10, fontSize: 13, fontWeight: 500, letterSpacing: 0 };
const activeStyle: CSSProperties = { background: "var(--brandSoft)", color: "var(--brandText)" };
const iconStyle: CSSProperties = { fontSize: 18, lineHeight: 1, width: 21, textAlign: "center" };
const labelStyle: CSSProperties = { flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

function Badge({ n }: { n?: number }) {
  if (!n) return null;
  return (
    <span className="mono" style={{ fontSize: 11, fontWeight: 600, background: "var(--brand)", color: "var(--brandInk)", borderRadius: 999, padding: "1px 8px" }}>
      {n}
    </span>
  );
}

export function Sidebar({ badges }: { badges: Record<string, number> }) {
  const { theme, toggleTheme } = useDashboardState();
  const current = moduleForPath(useLocation().pathname);
  // Sections the user opened/closed by hand; untouched ones follow the default in the render below.
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <aside
      style={{
        width: 264,
        flex: "0 0 264px",
        background: "var(--glassBg)",
        backdropFilter: "var(--blur)",
        WebkitBackdropFilter: "var(--blur)",
        borderRight: "1px solid var(--glassBd)",
        display: "flex",
        flexDirection: "column",
        position: "sticky",
        top: 0,
        height: "100vh"
      }}
    >
      {/* Checklist 17: the logo goes home — "/" is each role's first screen (homePath). */}
      <Link to="/" aria-label="MesaPronta: início" style={{ padding: "22px 22px 18px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--line)", color: "inherit", textDecoration: "none" }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 13,
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
      </Link>

      <nav style={{ padding: "14px 12px 18px", display: "flex", flexDirection: "column", gap: 2, flex: 1, overflowY: "auto" }}>
        {NAV_GROUPS.map((g) => {
          const mods = g.keys.map(moduleByKey).filter(canSee);
          if (!mods.length) return null;
          if (mods.length === 1) {
            return (
              <NavLink key={g.label} className="nav-row" to={mods[0].path} end={mods[0].path === "/"} style={({ isActive }) => ({ ...rowStyle, ...(isActive ? activeStyle : {}) })}>
                <i className={`fa-solid ${g.icon}`} style={iconStyle} />
                <span style={labelStyle}>{g.label}</span>
                <Badge n={badges[mods[0].key]} />
              </NavLink>
            );
          }
          const active = mods.find((m) => m.key === current.key);
          // Open by default for Operação (the day-to-day screens) and for whichever section holds the current page.
          const isOpen = open[g.label] ?? (g.label === "Operação" || !!active);
          const badgeSum = mods.reduce((t, m) => t + (badges[m.key] || 0), 0);
          return (
            <div key={g.label} style={{ display: "flex", flexDirection: "column", gap: 2, paddingBottom: 3 }}>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen((prev) => ({ ...prev, [g.label]: !isOpen }))}
                className="nav-row"
                style={{ ...rowStyle, color: active ? "var(--ink)" : "var(--ink2)" }}
              >
                <i className={`fa-solid ${g.icon}`} style={iconStyle} />
                <span style={{ whiteSpace: "nowrap" }}>{g.label}</span>
                {/* Doubles as the spacer; when collapsed it names the current page and gives way before the section name does. */}
                <span style={{ ...labelStyle, textAlign: "right", fontSize: 11, fontWeight: 500, color: "var(--brandText)" }}>{!isOpen && active ? active.label : ""}</span>
                {!isOpen && <Badge n={badgeSum} />}
                <i className={`fa-solid ${isOpen ? "fa-chevron-down" : "fa-chevron-right"}`} style={{ fontSize: 11, lineHeight: 1, color: "var(--ink3)", width: 11, textAlign: "center" }} />
              </button>
              {isOpen && (
                <div style={{ display: "flex", flexDirection: "column", gap: 1, margin: "1px 0 7px 21px", paddingLeft: 13, borderLeft: "1px solid var(--line)" }}>
                  {mods.map((m) => (
                    <NavLink
                      key={m.key}
                      className="nav-row"
                      to={m.path}
                      end={m.path === "/"}
                      style={({ isActive }) => ({ ...childStyle, ...(isActive ? activeStyle : {}) })}
                    >
                      <span style={labelStyle}>{m.label}</span>
                      <Badge n={badges[m.key]} />
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div style={{ padding: "12px 14px", borderTop: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontSize: 12, color: "var(--ink3)" }}>{theme === "dark" ? "Modo escuro" : "Modo claro"}</div>
        <button
          type="button"
          onClick={toggleTheme}
          title="Alternar tema"
          aria-label="Alternar tema"
          className="btn-ghost"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, minWidth: 44, minHeight: 44, borderRadius: 999, padding: "7px 12px", border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--ink2)", cursor: "pointer" }}
        >
          <i className={`fa-solid ${theme === "dark" ? "fa-sun" : "fa-moon"}`} style={{ fontSize: 17, lineHeight: 1 }} />
        </button>
        <button
          type="button"
          onClick={logout}
          title="Sair"
          aria-label="Sair"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", minWidth: 44, minHeight: 44, borderRadius: 999, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--ink2)", cursor: "pointer" }}
        >
          <i className="fa-solid fa-power-off" style={{ fontSize: 15, lineHeight: 1 }} />
        </button>
      </div>
    </aside>
  );
}
