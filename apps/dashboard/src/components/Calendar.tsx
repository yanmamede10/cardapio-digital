import { useState } from "react";
import { localIso, todayIso } from "../lib/format";

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/** Month grid. Pass only `from` for a single date; pass `from`+`to` to paint a range. */
export function Calendar({ from, to, onPick }: { from: string | null; to?: string | null; onPick: (iso: string) => void }) {
  const [ym, setYm] = useState(() => (from || todayIso()).slice(0, 7));
  const [y, m] = ym.split("-").map(Number);
  const offset = new Date(y, m - 1, 1).getDay();
  const total = Math.ceil((offset + new Date(y, m, 0).getDate()) / 7) * 7;
  const today = todayIso();
  const [a, b] = from && to && to < from ? [to, from] : [from, to || from];
  const shift = (k: number) => setYm(localIso(new Date(y, m - 1 + k, 1)).slice(0, 7));
  const navBtn = { width: 30, height: 30, borderRadius: "50%", border: 0, background: "transparent", color: "var(--brandText)", cursor: "pointer", display: "grid", placeItems: "center" } as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, userSelect: "none" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 2px 6px" }}>
        <div style={{ flex: 1, fontSize: 14, fontWeight: 600, letterSpacing: "-.01em" }}>
          {MONTHS[m - 1]} de {y}
        </div>
        <button type="button" title="Mês anterior" aria-label="Mês anterior" style={navBtn} onClick={() => shift(-1)}>
          <i className="fa-solid fa-chevron-left" style={{ fontSize: 12 }} />
        </button>
        <button type="button" title="Próximo mês" aria-label="Próximo mês" style={navBtn} onClick={() => shift(1)}>
          <i className="fa-solid fa-chevron-right" style={{ fontSize: 12 }} />
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))" }}>
        {WEEKDAYS.map((w, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: "var(--ink3)", padding: "2px 0 6px" }}>
            {w}
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", rowGap: 2 }}>
        {Array.from({ length: total }, (_, i) => {
          const dt = new Date(y, m - 1, 1 - offset + i);
          const iso = localIso(dt);
          const col = i % 7;
          const end = iso === a || iso === b;
          const band = !!a && !!b && a !== b && iso >= a && iso <= b;
          const left = iso === a || col === 0 ? 999 : 0;
          const right = iso === b || col === 6 ? 999 : 0;
          return (
            <div key={iso} style={{ height: 38, display: "flex", alignItems: "center", justifyContent: "center", background: band ? "var(--brandSoft)" : "transparent", borderRadius: `${left}px ${right}px ${right}px ${left}px` }}>
              <button
                type="button"
                onClick={() => onPick(iso)}
                aria-label={dt.toLocaleDateString("pt-BR")}
                aria-pressed={end}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  border: 0,
                  cursor: "pointer",
                  font: "inherit",
                  fontSize: 13.5,
                  fontVariantNumeric: "tabular-nums",
                  fontWeight: end || iso === today ? 600 : 400,
                  background: end ? "var(--brand)" : "transparent",
                  color: end ? "var(--brandInk)" : band || iso === today ? "var(--brandText)" : "var(--ink)",
                  boxShadow: iso === today && !end ? "inset 0 0 0 1.5px var(--brand)" : "none",
                  opacity: dt.getMonth() === m - 1 ? 1 : 0.32
                }}
              >
                {dt.getDate()}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
