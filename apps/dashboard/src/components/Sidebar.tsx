import { useState, type CSSProperties } from "react";
import { Link, NavLink } from "react-router-dom";
import { PLATFORM_NAME } from "@cardapio/shared";
import { Logo } from "./Logo";
import { NAV_GROUPS, canSee, moduleByKey, type ModuleDef } from "../lib/modules";
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
  fontSize: "var(--text-body)",
  fontWeight: 600,
  letterSpacing: "-.008em",
  textDecoration: "none",
  color: "var(--ink2)",
  transition: "background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease)"
};
const childStyle: CSSProperties = { ...rowStyle, gap: 9, padding: "9px 12px", borderRadius: 10, fontSize: "var(--text-subheadline)", fontWeight: 500, letterSpacing: 0 };
const activeStyle: CSSProperties = { background: "var(--brandSoft)", color: "var(--brandText)" };
const iconStyle: CSSProperties = { fontSize: "var(--icon-md)", lineHeight: 1, width: 21, textAlign: "center" };
const labelStyle: CSSProperties = { flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

function Badge({ n }: { n?: number }) {
  if (!n) return null;
  return (
    <span className="mono" style={{ fontSize: "var(--text-caption)", fontWeight: 600, background: "var(--brand)", color: "var(--brandInk)", borderRadius: 999, padding: "1px 8px" }}>
      {n}
    </span>
  );
}

/** `current`: the page's module (Layout's), none on a 404. */
export function Sidebar({ badges, current }: { badges: Record<string, number>; current?: ModuleDef }) {
  const { theme, toggleTheme } = useDashboardState();
  // Sections the user opened/closed by hand; untouched ones follow the default in the render below.
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <aside
      style={{
        width: 264,
        flex: "0 0 264px",
        background: "var(--bg)",
        borderRight: "1px solid var(--line)",
        display: "flex",
        flexDirection: "column",
        position: "sticky",
        top: 0,
        height: "100vh"
      }}
    >
      {/* Checklist 17: the logo goes home — "/" is each role's first screen (homePath). */}
      <Link to="/" aria-label={`${PLATFORM_NAME}: início`} style={{ padding: "22px 22px 18px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--line)", color: "inherit", textDecoration: "none" }}>
        <Logo size={34} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, letterSpacing: "-.01em" }}>{PLATFORM_NAME}</div>
          <div className="mono" style={{ fontSize: "var(--text-caption)", letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ink3)" }}>
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
          const active = mods.find((m) => m.key === current?.key);
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
                <span style={{ ...labelStyle, textAlign: "right", fontSize: "var(--text-caption)", fontWeight: 500, color: "var(--brandText)" }}>{!isOpen && active ? active.label : ""}</span>
                {!isOpen && <Badge n={badgeSum} />}
                <i className={`fa-solid ${isOpen ? "fa-chevron-down" : "fa-chevron-right"}`} style={{ fontSize: "var(--icon-sm)", lineHeight: 1, color: "var(--ink3)", width: 11, textAlign: "center" }} />
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
        <div style={{ fontSize: "var(--text-footnote)", color: "var(--ink3)" }}>{theme === "dark" ? "Modo escuro" : "Modo claro"}</div>
        <button
          type="button"
          onClick={toggleTheme}
          title="Alternar tema"
          aria-label="Alternar tema"
          className="btn-ghost"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, minWidth: 44, minHeight: 44, borderRadius: 999, padding: "7px 12px", border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--ink2)", cursor: "pointer" }}
        >
          <i key={theme} className={`fa-solid ${theme === "dark" ? "fa-sun" : "fa-moon"} icon-swap`} style={{ fontSize: "var(--icon-sm)", lineHeight: 1 }} />
        </button>
        <button
          type="button"
          onClick={logout}
          title="Sair"
          aria-label="Sair"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", minWidth: 44, minHeight: 44, borderRadius: 999, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--ink2)", cursor: "pointer" }}
        >
          <i className="fa-solid fa-power-off" style={{ fontSize: "var(--icon-sm)", lineHeight: 1 }} />
        </button>
      </div>
    </aside>
  );
}
