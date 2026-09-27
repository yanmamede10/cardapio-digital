import { useEffect, useState } from "react";
import type { FinanceSummary } from "@cardapio/shared";
import { api } from "../../lib/api";
import { brl, fmtDate } from "../../lib/format";
import { moduleByKey } from "../../lib/modules";
import { useMobileScreen } from "../../components/mobile/MobileLayout";

const CHARGE_STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  paid: { label: "Pago", bg: "color-mix(in srgb, var(--ok) 16%, transparent)", fg: "var(--ok)" },
  pending: { label: "Pendente", bg: "color-mix(in srgb, var(--warn) 18%, transparent)", fg: "var(--warn)" },
  failed: { label: "Falhou", bg: "color-mix(in srgb, var(--alert) 16%, transparent)", fg: "var(--alert)" }
};

export default function MobileFinanceScreen() {
  useMobileScreen({ title: "Financeiro", subtitle: "Taxas e mensalidade" });
  const [data, setData] = useState<FinanceSummary | null>(null);

  useEffect(() => {
    api.getFinance().then(setData);
  }, []);

  if (!data) {
    return (
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="skeleton" style={{ height: 140 }} />
        <div className="skeleton" style={{ height: 220 }} />
      </div>
    );
  }

  const pct = data.deliveryFeeCap ? Math.min(100, Math.round((data.deliveryFeeMonthToDate / data.deliveryFeeCap) * 100)) : 0;
  const capTone = pct >= 100 ? { label: "Teto atingido", fg: "var(--alert)" } : pct >= 90 ? { label: "Próximo do teto", fg: "var(--warn)" } : { label: "Dentro do teto", fg: "var(--ok)" };
  const monthLabel = new Date().toLocaleDateString("pt-BR", { month: "long" });

  return (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
      <section style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 11 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ink3)", flex: 1 }}>
            Taxa sobre delivery · {monthLabel}
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: capTone.fg, background: "color-mix(in srgb, currentColor 15%, transparent)", borderRadius: 20, padding: "2px 9px" }}>{capTone.label}</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <div className="mono" style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-.03em" }}>
            {brl(data.deliveryFeeMonthToDate)}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--ink3)" }}>de {brl(data.deliveryFeeCap)}</div>
        </div>
        <div style={{ height: 10, borderRadius: 6, background: "var(--surface3)", overflow: "hidden" }}>
          <div style={{ height: 10, borderRadius: 6, background: pct >= 90 ? "var(--alert)" : "var(--brand)", width: `${pct}%` }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--ink3)" }}>
          <span>{pct}% do teto mensal</span>
          <span>Restam {brl(Math.max(0, data.deliveryFeeCap - data.deliveryFeeMonthToDate))}</span>
        </div>
      </section>

      <section style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ink3)" }}>
            Mensalidade dos módulos
          </div>
          <div className="mono" style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-.03em" }}>
            {brl(data.planPrice)}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink3)" }}>{data.planModules.map((m) => moduleByKey(m)?.label ?? m).join(" + ")}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11.5, color: "var(--ink3)" }}>Vence em</div>
          <div className="mono" style={{ fontSize: 14, fontWeight: 600, color: "var(--warn)" }}>
            {fmtDate(data.planDueDate)}
          </div>
        </div>
      </section>

      <section style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "11px 13px", borderBottom: "1px solid var(--line)", fontSize: 13, fontWeight: 600 }}>Extrato de cobranças</div>
        {data.charges.map((c) => {
          const st = CHARGE_STATUS[c.status];
          return (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 13px", borderBottom: "1px solid var(--line)", minHeight: 58 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.description}</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--ink3)" }}>
                  {fmtDate(c.date)}
                </div>
              </div>
              <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                <div className="mono" style={{ fontSize: 13.5, fontWeight: 600 }}>
                  {brl(c.value)}
                </div>
                <span style={{ fontSize: 10.5, fontWeight: 600, borderRadius: 20, padding: "1px 8px", background: st.bg, color: st.fg }}>{st.label}</span>
              </div>
            </div>
          );
        })}
        {data.charges.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "var(--ink3)", fontSize: 12.5 }}>Nenhum lançamento ainda.</div>}
      </section>
    </div>
  );
}
