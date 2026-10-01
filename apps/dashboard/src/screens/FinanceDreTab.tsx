import { useState, type CSSProperties } from "react";
import type { FinanceEntry } from "@cardapio/shared";
import { brl, todayIso } from "../lib/format";

// Where the fixed Contas a Pagar categories land in the traditional statement; anything else is despesa operacional.
const DEDUCTIONS = "Impostos (DAS)";
const COGS = "Insumos e bebidas";
const NO_CATEGORY = "Sem categoria";

const sum = (rows: [string, number][]) => rows.reduce((t, [, v]) => t + v, 0);

/** Amount per category, largest first. */
function byCategory(list: FinanceEntry[]): [string, number][] {
  const totals = new Map<string, number>();
  list.forEach((e) => totals.set(e.category || NO_CATEGORY, (totals.get(e.category || NO_CATEGORY) ?? 0) + e.amount));
  return [...totals].sort((a, b) => b[1] - a[1]);
}

/** Visão Geral · DRE — built from the same FinanceEntry list the Resumo already loaded. */
export default function FinanceDreTab({ entries }: { entries: FinanceEntry[] }) {
  const [month, setMonth] = useState(todayIso().slice(0, 7));
  const [accounting, setAccounting] = useState(false);

  // Regime de competência: everything due in the month, paid or not (same basis as "Maiores despesas do mês").
  const inMonth = entries.filter((e) => e.dueDate.startsWith(month));
  const revenue = byCategory(inMonth.filter((e) => e.kind === "receivable"));
  const expenses = byCategory(inMonth.filter((e) => e.kind === "payable"));
  const came = sum(revenue);
  const went = sum(expenses);
  const left = came - went;
  const pct = (v: number) => (came > 0 ? `${Math.round((v / came) * 100)}%` : "—");
  const monthName = new Date(`${month}-15T12:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <input type="month" aria-label="Mês" className="field" style={{ width: "auto" }} value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
        <div style={{ flex: 1 }} />
        <button type="button" className="btn btn-ghost" style={{ fontSize: 12.5, color: "var(--brandText)" }} onClick={() => setAccounting((v) => !v)}>
          {accounting ? "Ver resumo simples" : "Ver demonstrativo contábil"}
        </button>
      </div>

      {inMonth.length === 0 ? (
        <section className="card" style={{ padding: 22, fontSize: 13, color: "var(--ink3)" }}>
          Nenhum lançamento com vencimento em {monthName}.
        </section>
      ) : accounting ? (
        <Statement revenue={revenue} expenses={expenses} pct={pct} />
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
            {[
              { label: "Entrou", value: came, note: "Vendas e recebíveis do mês", fg: "var(--ok)" },
              { label: "Saiu", value: went, note: "Despesas do mês", fg: "var(--brandText)" },
              { label: "Sobrou", value: left, note: came > 0 ? `${pct(left)} de cada real que entrou` : "Nada entrou neste mês", fg: left >= 0 ? "var(--ok)" : "var(--alert)" }
            ].map((k) => (
              <section key={k.label} className="card" style={{ padding: "20px 22px 22px", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--ink2)" }}>{k.label}</div>
                <div className="mono" style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-.04em", lineHeight: 1.15, color: k.fg }}>
                  {brl(k.value)}
                </div>
                <div style={{ fontSize: 12, color: "var(--ink3)" }}>{k.note}</div>
              </section>
            ))}
          </div>
          <Bars title="De onde veio" rows={revenue} color="var(--ok)" scale={Math.max(came, went)} pct={pct} />
          <Bars title="Para onde foi" rows={expenses} color="var(--sec)" scale={Math.max(came, went)} pct={pct} />
        </>
      )}
    </div>
  );
}

function Bars({ title, rows, color, scale, pct }: { title: string; rows: [string, number][]; color: string; scale: number; pct: (v: number) => string }) {
  return (
    <section className="card" style={{ padding: 22 }}>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>{title}</div>
      {rows.length === 0 && <div style={{ padding: "12px 0", fontSize: 13, color: "var(--ink3)" }}>Nada neste mês.</div>}
      {rows.map(([name, value]) => (
        <div key={name} style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr) auto 38px", gap: 12, alignItems: "center", padding: "11px 0", borderBottom: "1px solid var(--line)" }}>
          <div style={{ fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
          <div style={{ height: 8, borderRadius: 8, background: "var(--surface2)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(value / scale) * 100}%`, background: color, borderRadius: 8 }} />
          </div>
          <div className="mono" style={{ fontSize: 13, fontWeight: 600, textAlign: "right" }}>
            {brl(value)}
          </div>
          <div className="mono" style={{ fontSize: 12, color: "var(--ink3)", textAlign: "right" }}>
            {pct(value)}
          </div>
        </div>
      ))}
    </section>
  );
}

/** Traditional DRE layout (for the accountant): gross revenue down to net result, with % of gross revenue. */
function Statement({ revenue, expenses, pct }: { revenue: [string, number][]; expenses: [string, number][]; pct: (v: number) => string }) {
  const gross = sum(revenue);
  const deductions = expenses.filter(([c]) => c === DEDUCTIONS);
  const cogs = expenses.filter(([c]) => c === COGS);
  const operating = expenses.filter(([c]) => c !== DEDUCTIONS && c !== COGS);
  const net = gross - sum(deductions);
  const grossProfit = net - sum(cogs);
  const result = grossProfit - sum(operating);

  type Row = { label: string; value: number; kind: "total" | "line" | "detail" };
  const detail = (rows: [string, number][], sign: 1 | -1): Row[] => rows.map(([label, v]) => ({ label, value: sign * v, kind: "detail" }));
  const rows: Row[] = [
    { label: "Receita bruta de vendas", value: gross, kind: "total" },
    ...detail(revenue, 1),
    { label: "(−) Deduções da receita (impostos sobre vendas)", value: -sum(deductions), kind: "line" },
    { label: "(=) Receita líquida", value: net, kind: "total" },
    { label: "(−) Custo das mercadorias vendidas (CMV)", value: -sum(cogs), kind: "line" },
    { label: "(=) Lucro bruto", value: grossProfit, kind: "total" },
    { label: "(−) Despesas operacionais", value: -sum(operating), kind: "line" },
    ...detail(operating, -1),
    { label: "(=) Resultado líquido do período", value: result, kind: "total" }
  ];

  const cell: CSSProperties = { padding: "9px 0", borderBottom: "1px solid var(--line)" };
  return (
    <section className="card" tabIndex={0} aria-label="Demonstrativo do resultado" style={{ padding: "12px 22px 18px", overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr className="field-label">
            <th style={{ ...cell, textAlign: "left", fontWeight: 500 }}>Conta</th>
            <th style={{ ...cell, textAlign: "right", fontWeight: 500 }}>Valor</th>
            <th style={{ ...cell, textAlign: "right", fontWeight: 500, width: 60 }}>% RB</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ fontWeight: r.kind === "total" ? 600 : 400, color: r.kind === "detail" ? "var(--ink2)" : "var(--ink)" }}>
              <td style={{ ...cell, paddingLeft: r.kind === "detail" ? 18 : 0 }}>{r.label}</td>
              <td className="mono" style={{ ...cell, textAlign: "right", whiteSpace: "nowrap" }}>
                {brl(r.value)}
              </td>
              <td className="mono" style={{ ...cell, textAlign: "right", color: "var(--ink3)" }}>
                {pct(r.value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
