import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { addDays, localIso, shortDate, todayIso } from "../lib/format";
import { Calendar } from "./Calendar";

/** One value per group id (single choice), plus `from`/`to` when the period is "Personalizado". */
export type FilterValues = Record<string, string | undefined>;

/** A tab in the popover. The group with id "per" is the period picker; its options are preset labels. */
export interface FilterGroup {
  id: string;
  label: string;
  options: string[];
}

export const PAST_PERIODS = ["Hoje", "Esta semana", "Este mês", "Mês passado", "Personalizado"];
export const DUE_PERIODS = ["Próximos 7 dias", "Próximos 30 dias", "Este mês", "Personalizado"];

export function periodRange(v: FilterValues): [string, string] | null {
  const t = todayIso();
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (v.per) {
    case "Hoje":
      return [t, t];
    case "Esta semana": {
      const monday = addDays(t, -((now.getDay() + 6) % 7));
      return [monday, addDays(monday, 6)];
    }
    case "Este mês":
      return [localIso(new Date(y, m, 1)), localIso(new Date(y, m + 1, 0))];
    case "Mês passado":
      return [localIso(new Date(y, m - 1, 1)), localIso(new Date(y, m, 0))];
    case "Próximos 7 dias":
      return [t, addDays(t, 7)];
    case "Próximos 30 dias":
      return [t, addDays(t, 30)];
    case "Personalizado":
      if (!v.from) return null;
      return v.to && v.to < v.from ? [v.to, v.from] : [v.from, v.to || v.from];
    default:
      return null;
  }
}

/** True when `iso` (YYYY-MM-DD) is inside the selected period, or no period is selected. */
export function inPeriod(iso: string, v: FilterValues): boolean {
  const r = periodRange(v);
  return !r || (iso >= r[0] && iso <= r[1]);
}

const rangeLabel = (r: [string, string] | null) => (!r ? "" : r[0] === r[1] ? shortDate(r[0]) : `${shortDate(r[0])} – ${shortDate(r[1])}`);

/** "Filtros" button + popover: one tab per group, "Mostrar N resultados" pinned below the tabs.
 *  `sheet` (mobile) opens the same panel as a bottom sheet instead of an anchored popover. */
export function FilterPopover({
  groups,
  value,
  onChange,
  resultCount,
  align = "right",
  sheet = false
}: {
  groups: FilterGroup[];
  value: FilterValues;
  onChange: (v: FilterValues) => void;
  resultCount: number;
  align?: "left" | "right";
  sheet?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(groups[0].id);
  const active = groups.filter((g) => value[g.id]).length;
  const group = groups.find((g) => g.id === tab) || groups[0];
  const toggle = (id: string, option: string) => onChange({ ...value, [id]: value[id] === option ? undefined : option, ...(id === "per" ? { from: undefined, to: undefined } : {}) });
  // Custom range: first click sets "De", second sets "Até"; a click after a full range starts over.
  const pickDay = (iso: string) => onChange(value.from && !value.to ? { ...value, to: iso } : { ...value, from: iso, to: undefined });
  const custom = periodRange(value);
  // The mobile sheet leaves the screen (its sticky header is its own stacking context) but stays inside the themed root.
  const portal = (node: ReactNode) => (sheet ? createPortal(node, document.getElementById("theme-root") ?? document.body) : node);

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        className="tap"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          border: `1px solid ${active ? "var(--brand)" : "var(--line)"}`,
          borderRadius: sheet ? 11 : 12,
          padding: "8px 14px",
          minHeight: sheet ? 44 : undefined,
          cursor: "pointer",
          fontSize: "var(--text-subheadline)",
          fontWeight: 500,
          whiteSpace: "nowrap",
          background: active ? "var(--brandSoft)" : "var(--surface)",
          color: active ? "var(--brandText)" : "var(--ink)"
        }}
      >
        <i className="fa-solid fa-filter" style={{ fontSize: 12 }} />
        Filtros
        {active > 0 && (
          <span className="mono" style={{ fontSize: "var(--text-caption)", fontWeight: 600, background: "var(--brand)", color: "var(--brandInk)", borderRadius: 999, padding: "1px 8px" }}>
            {active}
          </span>
        )}
      </button>

      {open && portal(
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: sheet ? 25 : 20, background: sheet ? "rgba(0,0,0,.42)" : undefined }} />
          <div
            role="dialog"
            aria-label="Filtros"
            className="glass"
            style={{
              ...(sheet
                ? { position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 26, maxHeight: "88dvh", borderRadius: "20px 20px 0 0", paddingBottom: "env(safe-area-inset-bottom, 0px)" }
                : { position: "absolute", [align]: 0, top: "calc(100% + 8px)", zIndex: 21, width: 360, maxWidth: "calc(100vw - 40px)", borderRadius: 18 }),
              border: "1px solid var(--glassBd)",
              boxShadow: "var(--shadow2)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              animation: "dcScaleIn .36s var(--ease-spring) both"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", padding: "16px 18px 12px" }}>
              <div style={{ fontWeight: 600, fontSize: "var(--text-body)", flex: 1 }}>Filtros</div>
              <button type="button" onClick={() => onChange({})} style={{ border: 0, background: "transparent", color: "var(--brandText)", fontSize: "var(--text-subheadline)", fontWeight: 500, cursor: "pointer", padding: "4px 2px" }}>
                Limpar
              </button>
            </div>
            <div style={{ padding: "0 14px", overflowX: "auto" }}>
              <div role="tablist" style={{ display: "flex", gap: 3, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 13, padding: 3, minWidth: "max-content" }}>
                {groups.map((g) => {
                  const on = g.id === group.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      onClick={() => setTab(g.id)}
                      style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, border: 0, borderRadius: 10, padding: "7px 12px", cursor: "pointer", fontSize: "var(--text-subheadline)", fontWeight: 500, whiteSpace: "nowrap", background: on ? "var(--surface)" : "transparent", color: on ? "var(--brandText)" : "var(--ink2)", boxShadow: on ? "var(--shadow1)" : "none" }}
                    >
                      {g.label}
                      {value[g.id] && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--brand)" }} />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ padding: "16px 18px 18px", minHeight: sheet ? 0 : 112, maxHeight: sheet ? undefined : "min(480px,62vh)", flex: sheet ? "1 1 auto" : undefined, overflowY: "auto" }}>
              {group.id !== "per" ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {group.options.map((o) => {
                    const on = value[group.id] === o;
                    return (
                      <button
                        key={o}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggle(group.id, o)}
                        style={{ display: "flex", alignItems: "center", gap: 6, border: `1px solid ${on ? "var(--brand)" : "var(--line)"}`, borderRadius: 999, padding: "7px 13px", cursor: "pointer", fontSize: "var(--text-subheadline)", fontWeight: 500, background: on ? "var(--brandSoft)" : "var(--surface)", color: on ? "var(--brandText)" : "var(--ink2)" }}
                      >
                        {on && <i className="fa-solid fa-check" style={{ fontSize: 10 }} />}
                        {o}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", flexDirection: "column", padding: 5, border: "1px solid var(--line)", borderRadius: 14 }}>
                    {group.options.map((p) => {
                      const on = value.per === p;
                      const hint = p === "Personalizado" ? "" : rangeLabel(periodRange({ per: p }));
                      return (
                        <button
                          key={p}
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggle("per", p)}
                          style={{ display: "flex", alignItems: "center", gap: 10, border: 0, borderRadius: 10, padding: "10px 12px", cursor: "pointer", fontSize: "var(--text-body)", textAlign: "left", background: on ? "var(--brandSoft)" : "transparent", color: "var(--ink)" }}
                        >
                          <i className="fa-solid fa-check" style={{ fontSize: 11, width: 12, color: "var(--brandText)", opacity: on ? 1 : 0 }} />
                          <span style={{ flex: 1, fontWeight: on ? 600 : 400 }}>{p}</span>
                          <span style={{ fontSize: "var(--text-footnote)", color: "var(--ink3)", fontVariantNumeric: "tabular-nums" }}>{hint}</span>
                          {p === "Personalizado" && <i className="fa-solid fa-chevron-right" style={{ fontSize: 10, color: "var(--ink3)" }} />}
                        </button>
                      );
                    })}
                  </div>
                  {value.per === "Personalizado" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        {(["De", "Até"] as const).map((label, i) => {
                          const v = custom && (i === 0 || value.to) ? custom[i] : null;
                          const next = (i === 0) === !(value.from && !value.to);
                          return (
                            <div key={label} style={{ display: "flex", flexDirection: "column", gap: 2, border: `1px solid ${next ? "var(--brand)" : "var(--line)"}`, borderRadius: 12, padding: "8px 12px", boxShadow: next ? "0 0 0 3px var(--brandSoft)" : "none" }}>
                              <span style={{ fontSize: "var(--text-caption)", fontWeight: 500, color: "var(--ink3)" }}>{label}</span>
                              <span style={{ fontSize: "var(--text-body)", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: v ? "var(--ink)" : "var(--ink3)" }}>{v ? `${shortDate(v)} ${v.slice(0, 4)}` : "Selecione"}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ border: "1px solid var(--line)", borderRadius: 16, padding: "10px 10px 8px" }}>
                        <Calendar from={value.from ?? null} to={value.to ?? null} onPick={pickDay} />
                      </div>
                      <div style={{ fontSize: "var(--text-footnote)", color: "var(--ink3)", textAlign: "center" }}>Clique no dia de início e depois no dia de fim</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ padding: "14px 18px 16px", borderTop: "1px solid var(--line)" }}>
              <button type="button" className="btn btn-primary" style={{ width: "100%" }} onClick={() => setOpen(false)}>
                Mostrar {resultCount === 1 ? "1 resultado" : `${resultCount} resultados`}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
