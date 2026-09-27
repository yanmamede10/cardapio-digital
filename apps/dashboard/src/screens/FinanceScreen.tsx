import { useEffect, useState } from "react";
import type { FinanceSummary } from "@cardapio/shared";
import { ApiError, api } from "../lib/api";
import { brDate, brl, fmtDate } from "../lib/format";
import { moduleByKey } from "../lib/modules";

const CHARGE_STATUS: Record<string, { label: string; color: string }> = {
  paid: { label: "Pago", color: "var(--ok)" },
  pending: { label: "Pendente", color: "var(--warn)" },
  overdue: { label: "Atrasado", color: "var(--alert)" },
  failed: { label: "Falhou", color: "var(--alert)" }
};

export default function FinanceScreen() {
  const [data, setData] = useState<FinanceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getFinance().catch((err) => {
      setError(err instanceof ApiError && err.status === 403 ? "Você não tem permissão para acessar o Financeiro." : "Não foi possível carregar o Financeiro.");
      return null;
    }).then((d) => { if (d) setData(d); });
  }, []);

  if (error) {
    return <p style={{ color: "var(--ink2)" }}>{error}</p>;
  }

  if (!data) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="skeleton" style={{ height: 140 }} />
        <div className="skeleton" style={{ height: 280 }} />
      </div>
    );
  }

  const feePct = data.deliveryFeeCap ? Math.min(100, Math.round((data.deliveryFeeMonthToDate / data.deliveryFeeCap) * 100)) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <section className="card" style={{ flex: 1, minWidth: 280, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="field-label">Taxas de entrega no mês</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <div className="mono" style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-.02em" }}>
              {brl(data.deliveryFeeMonthToDate)}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--ink3)" }}>de {brl(data.deliveryFeeCap)} no plano</div>
          </div>
          <div style={{ height: 8, borderRadius: 5, background: "var(--surface2)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${feePct}%`, background: feePct >= 90 ? "var(--alert)" : "var(--brand)" }} />
          </div>
          <div style={{ fontSize: 11.5, color: "var(--ink3)" }}>{feePct}% do limite mensal utilizado</div>
        </section>

        <section className="card" style={{ flex: 1, minWidth: 280, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="field-label">Plano de gestão</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <div className="mono" style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-.02em" }}>
              {brl(data.planPrice)}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--ink3)" }}>/mês · vence {fmtDate(data.planDueDate)}</div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {data.planModules.map((m) => (
              <span key={m} className="pill" style={{ background: "var(--surface2)", border: "1px solid var(--line)", color: "var(--ink2)" }}>
                {moduleByKey(m)?.label ?? m}
              </span>
            ))}
          </div>
        </section>
      </div>

      <section className="card" style={{ overflowX: "auto" }}>
        <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--line)", fontWeight: 600, fontSize: 13.5 }}>Extrato</div>
        <div style={{ display: "grid", gridTemplateColumns: "110px 1fr 130px 100px", gap: 12, padding: "9px 16px", background: "var(--surface2)", borderBottom: "1px solid var(--line)", minWidth: 520 }}>
          {["Data", "Descrição", "Valor", "Status"].map((h) => (
            <div key={h} className="field-label">
              {h}
            </div>
          ))}
        </div>
        {data.charges.map((c) => (
          <div key={c.id} style={{ display: "grid", gridTemplateColumns: "110px 1fr 130px 100px", gap: 12, alignItems: "center", padding: "11px 16px", borderBottom: "1px solid var(--line)", minWidth: 520 }}>
            <div className="mono" style={{ fontSize: 12, color: "var(--ink3)" }}>
              {fmtDate(c.date)}
            </div>
            <div style={{ fontSize: 13 }}>
              {c.description}
              {c.paidOn && (
                <div style={{ fontSize: 11.5, color: "var(--ink3)" }}>
                  Pago em {brDate(c.paidOn)}
                  {c.paymentMethod && ` · ${c.paymentMethod}`}
                </div>
              )}
            </div>
            <div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>
              {brl(c.value)}
            </div>
            <span className="pill" style={{ alignSelf: "start", background: "var(--surface2)", color: CHARGE_STATUS[c.status].color }}>
              {CHARGE_STATUS[c.status].label}
            </span>
          </div>
        ))}
        {data.charges.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "var(--ink3)", fontSize: 12.5 }}>Nenhum lançamento ainda.</div>}
      </section>
    </div>
  );
}
