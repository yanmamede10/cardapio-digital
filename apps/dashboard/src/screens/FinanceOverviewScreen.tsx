import { useEffect, useState } from "react";
import type { FinanceEntry } from "@cardapio/shared";
import { ApiError, api } from "../lib/api";
import { addDays, brl, dayMonth, shortDate, todayIso } from "../lib/format";
import { entryStatus } from "./AccountsScreen";

/** Visão Geral · Resumo — everything derived from Contas a Pagar/Receber. */
export default function FinanceOverviewScreen() {
  const [entries, setEntries] = useState<FinanceEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listFinanceEntries()
      .then(setEntries)
      .catch((err) => setError(err instanceof ApiError && err.status === 403 ? "Você não tem permissão para acessar o Financeiro." : "Não foi possível carregar o Financeiro."));
  }, []);

  if (error) return <p style={{ color: "var(--ink2)" }}>{error}</p>;
  if (!entries) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="skeleton" style={{ height: 120 }} />
        <div className="skeleton" style={{ height: 260 }} />
      </div>
    );
  }

  const today = todayIso();
  const total = (list: FinanceEntry[]) => list.reduce((t, e) => t + e.amount, 0);

  // Cash flow = what was actually settled (paidOn), receivables in, payables out.
  const days = Array.from({ length: 30 }, (_, i) => {
    const iso = addDays(today, i - 29);
    const paid = entries.filter((e) => e.paidOn === iso);
    return { iso, in: total(paid.filter((e) => e.kind === "receivable")), out: total(paid.filter((e) => e.kind === "payable")) };
  });
  const sumIn = days.reduce((t, d) => t + d.in, 0);
  const sumOut = days.reduce((t, d) => t + d.out, 0);
  const max = Math.max(1, ...days.map((d) => Math.max(d.in, d.out)));

  const dueSoon = (kind: FinanceEntry["kind"]) => entries.filter((e) => e.kind === kind && e.status === "pending" && e.dueDate >= today && e.dueDate <= addDays(today, 7));
  const toPay = dueSoon("payable");
  const toReceive = dueSoon("receivable");
  const late = entries.filter((e) => entryStatus(e) === "Atrasado");

  const month = today.slice(0, 7);
  const byCategory = new Map<string, number>();
  entries
    .filter((e) => e.kind === "payable" && e.dueDate.startsWith(month))
    .forEach((e) => byCategory.set(e.category || "Sem categoria", (byCategory.get(e.category || "Sem categoria") ?? 0) + e.amount));
  const monthTotal = [...byCategory.values()].reduce((t, v) => t + v, 0);
  const topCats = [...byCategory].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const kpis = [
    { label: "Saldo do período", icon: "fa-scale-balanced", value: brl(sumIn - sumOut), note: "Entradas − saídas quitadas · 30 dias", fg: sumIn - sumOut >= 0 ? "var(--ok)" : "var(--alert)" },
    { label: "A pagar · próximos 7 dias", icon: "fa-file-invoice-dollar", value: brl(total(toPay)), note: `${plural(toPay.length, "conta", "contas")} a vencer`, fg: "var(--ink)" },
    { label: "A receber · próximos 7 dias", icon: "fa-hand-holding-dollar", value: brl(total(toReceive)), note: `${plural(toReceive.length, "recebível previsto", "recebíveis previstos")}`, fg: "var(--ink)" },
    {
      label: "Contas em atraso",
      icon: late.length ? "fa-triangle-exclamation" : "fa-circle-check",
      value: String(late.length),
      note: late.length ? `${brl(total(late))} vencidos` : "Tudo em dia",
      fg: late.length ? "var(--alert)" : "var(--ok)",
      alert: late.length > 0
    }
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 1080 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14 }}>
        {kpis.map((k) => (
          <section
            key={k.label}
            className="card"
            style={{
              padding: "20px 22px 22px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              background: k.alert ? "color-mix(in srgb, var(--alert) 8%, var(--surface))" : undefined,
              borderColor: k.alert ? "color-mix(in srgb, var(--alert) 45%, transparent)" : undefined
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 500, color: k.alert ? "var(--alert)" : "var(--ink2)" }}>
              <i className={`fa-solid ${k.icon}`} style={{ fontSize: 13 }} />
              {k.label}
            </div>
            <div className="mono" style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-.04em", lineHeight: 1.15, color: k.fg }}>
              {k.value}
            </div>
            <div style={{ fontSize: 12, color: "var(--ink3)" }}>{k.note}</div>
          </section>
        ))}
      </div>

      <section className="card" style={{ padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap", marginBottom: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>Entradas vs. saídas · últimos 30 dias</div>
          {[
            { label: "Entradas", color: "var(--ok)", value: sumIn },
            { label: "Saídas", color: "var(--brandText)", value: sumOut }
          ].map((s) => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--ink2)" }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color }} />
              {s.label}
              <span className="mono" style={{ fontWeight: 600, color: "var(--ink)" }}>
                {brl(s.value)}
              </span>
            </div>
          ))}
        </div>
        {sumIn + sumOut === 0 ? (
          <div style={{ height: 190, display: "grid", placeItems: "center", fontSize: 13, color: "var(--ink3)", borderBottom: "1px solid var(--line)" }}>Nenhuma conta quitada nos últimos 30 dias.</div>
        ) : (
          <div role="img" aria-label={`Entradas ${brl(sumIn)} e saídas ${brl(sumOut)} nos últimos 30 dias`} style={{ height: 190, display: "flex", alignItems: "flex-end", gap: 5, borderBottom: "1px solid var(--line)" }}>
            {days.map((d) => (
              // Whole day column is the hover target; in is always left, out always right (position backs up color).
              <div key={d.iso} title={`${dayMonth(d.iso)} · entradas ${brl(d.in)} · saídas ${brl(d.out)}`} style={{ flex: 1, minWidth: 0, height: "100%", display: "flex", alignItems: "flex-end", gap: 2 }}>
                <div style={{ flex: 1, height: `${(d.in / max) * 100}%`, background: "var(--ok)", borderRadius: "4px 4px 0 0" }} />
                <div style={{ flex: 1, height: `${(d.out / max) * 100}%`, background: "var(--brandText)", borderRadius: "4px 4px 0 0" }} />
              </div>
            ))}
          </div>
        )}
        <div className="mono" style={{ display: "flex", justifyContent: "space-between", marginTop: 9, fontSize: 11, color: "var(--ink3)" }}>
          {[0, 10, 20, 29].map((i) => (
            <span key={i}>{shortDate(days[i].iso)}</span>
          ))}
        </div>
      </section>

      <section className="card" style={{ padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>Maiores despesas do mês</div>
          <div style={{ fontSize: 12.5, color: "var(--ink3)" }}>{new Date().toLocaleDateString("pt-BR", { month: "long" })}</div>
        </div>
        {topCats.length === 0 && <div style={{ padding: "20px 0", fontSize: 13, color: "var(--ink3)" }}>Nenhuma despesa com vencimento neste mês.</div>}
        {topCats.map(([name, value]) => (
          <div key={name} style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr) auto 38px", gap: 12, alignItems: "center", padding: "11px 0", borderBottom: "1px solid var(--line)" }}>
            <div style={{ fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
            <div style={{ height: 8, borderRadius: 8, background: "var(--surface2)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(value / topCats[0][1]) * 100}%`, background: "var(--sec)", borderRadius: 8 }} />
            </div>
            <div className="mono" style={{ fontSize: 13, fontWeight: 600, textAlign: "right" }}>
              {brl(value)}
            </div>
            <div className="mono" style={{ fontSize: 12, color: "var(--ink3)", textAlign: "right" }}>
              {Math.round((value / monthTotal) * 100)}%
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
