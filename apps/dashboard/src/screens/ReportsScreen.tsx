import { Fragment, useEffect, useState } from "react";
import type { AnalyticsPeriod, AnalyticsSummary } from "@cardapio/shared";
import { ApiError, api } from "../lib/api";
import { brl } from "../lib/format";
import { Segmented } from "../components/Segmented";

const PERIOD_OPTIONS: { value: AnalyticsPeriod; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "7 dias" },
  { value: "month", label: "Mês" }
];

function Delta({ pct }: { pct: number }) {
  const good = pct >= 0;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: "var(--text-footnote)", fontWeight: 600, color: good ? "var(--ok)" : "var(--alert)" }}>
      <i className={`fa-solid ${good ? "fa-arrow-up" : "fa-arrow-down"}`} style={{ fontSize: 10 }} />
      {Math.abs(pct)}%
    </span>
  );
}

function StatTile({ icon, label, value, deltaPct }: { icon: string; label: string; value: string; deltaPct?: number }) {
  return (
    <div className="card" style={{ padding: 14, flex: 1, minWidth: 160, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--ink3)" }}>
        <i className={`fa-solid ${icon}`} style={{ fontSize: 15 }} />
        <span className="field-label">{label}</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <div className="mono" style={{ fontSize: "var(--text-title2)", fontWeight: 600, letterSpacing: "-.02em" }}>
          {value}
        </div>
        {deltaPct !== undefined && <Delta pct={deltaPct} />}
      </div>
    </div>
  );
}

export default function ReportsScreen() {
  const [period, setPeriod] = useState<AnalyticsPeriod>("today");
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    api.getAnalytics(period).catch((err) => {
      setError(err instanceof ApiError && err.status === 403 ? "Você não tem permissão para acessar Relatórios." : "Não foi possível carregar Relatórios.");
      return null;
    }).then((d) => { if (d) setData(d); });
  }, [period]);

  if (error) {
    return <p style={{ color: "var(--ink2)" }}>{error}</p>;
  }

  if (!data) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="skeleton" style={{ height: 40, width: 260 }} />
        <div className="skeleton" style={{ height: 380 }} />
      </div>
    );
  }

  const { kpis, revenueSeries, topSellers, bottomSellers, heatmap, reviewAverage, reviewCount } = data;
  const maxRevenue = Math.max(1, ...revenueSeries.map((p) => p.tableRevenue + p.deliveryRevenue));
  const maxItemQty = Math.max(1, ...topSellers.map((i) => i.quantity), ...bottomSellers.map((i) => i.quantity));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Segmented value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--text-subheadline)", color: "var(--ink2)" }}>
          <i className="fa-solid fa-star" style={{ color: "var(--sec)", fontSize: 14 }} />
          <span className="mono" style={{ fontWeight: 600 }}>
            {reviewAverage.toFixed(1)}
          </span>
          <span style={{ color: "var(--ink3)" }}>· {reviewCount} avaliações</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <StatTile icon="fa-sack-dollar" label="Vendas de produtos" value={brl(kpis.revenue)} deltaPct={kpis.revenueDeltaPct} />
        <StatTile icon="fa-bell-concierge" label="Serviço das mesas" value={brl(kpis.service)} />
        <StatTile icon="fa-equals" label="Total cobrado" value={brl(kpis.total)} />
        <StatTile icon="fa-receipt" label="Ticket médio" value={brl(kpis.avgTicket)} deltaPct={kpis.avgTicketDeltaPct} />
        <StatTile icon="fa-list-check" label="Pedidos" value={String(kpis.orderCount)} deltaPct={kpis.orderCountDeltaPct} />
        <StatTile icon="fa-triangle-exclamation" label="Cancelamentos" value={`${kpis.cancellationRatePct}%`} deltaPct={kpis.cancellationsDeltaPct} />
      </div>

      <section className="card" style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
          <div style={{ fontWeight: 600, fontSize: "var(--text-body)", flex: 1 }}>Faturamento por {period === "today" ? "hora" : "dia"}</div>
          <div style={{ display: "flex", gap: 14, fontSize: "var(--text-footnote)", color: "var(--ink2)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: "var(--brand)" }} />
              Mesa
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: "var(--sec)" }} />
              Delivery
            </span>
          </div>
        </div>
        <div tabIndex={0} role="group" aria-label="Gráfico de faturamento (role para os lados)" style={{ display: "flex", alignItems: "flex-end", gap: period === "today" ? 6 : 10, height: 160, overflowX: "auto", paddingBottom: 4 }}>
          {revenueSeries.map((p, i) => {
            const total = p.tableRevenue + p.deliveryRevenue;
            const h = Math.max(2, (total / maxRevenue) * 140);
            return (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: "0 0 auto", minWidth: 26 }}>
                <div style={{ width: 20, height: h, borderRadius: "11px 11px 0 0", overflow: "hidden", display: "flex", flexDirection: "column-reverse", background: "var(--surface2)" }} title={brl(total)}>
                  <div style={{ height: `${total ? (p.tableRevenue / total) * 100 : 0}%`, background: "var(--brand)" }} />
                  <div style={{ height: `${total ? (p.deliveryRevenue / total) * 100 : 0}%`, background: "var(--sec)" }} />
                </div>
                <div className="mono" style={{ fontSize: "var(--text-caption)", color: "var(--ink3)", whiteSpace: "nowrap" }}>
                  {p.label}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <section className="card" style={{ flex: 1, minWidth: 280, padding: 14 }}>
          <div style={{ fontWeight: 600, fontSize: "var(--text-body)", marginBottom: 10 }}>Mais vendidos</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {topSellers.length === 0 && <div style={{ fontSize: "var(--text-subheadline)", color: "var(--ink3)" }}>Sem vendas no período.</div>}
            {topSellers.map((it) => (
              <div key={it.itemId} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-subheadline)" }}>
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{it.name}</span>
                  <span className="mono" style={{ color: "var(--ink2)", marginLeft: 8 }}>
                    {it.quantity}× · {brl(it.revenue)}
                  </span>
                </div>
                <div style={{ height: 5, borderRadius: 4, background: "var(--surface2)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(it.quantity / maxItemQty) * 100}%`, background: "var(--ok)" }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card" style={{ flex: 1, minWidth: 280, padding: 14 }}>
          <div style={{ fontWeight: 600, fontSize: "var(--text-body)", marginBottom: 10 }}>Menos vendidos</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {bottomSellers.length === 0 && <div style={{ fontSize: "var(--text-subheadline)", color: "var(--ink3)" }}>Sem vendas no período.</div>}
            {bottomSellers.map((it) => (
              <div key={it.itemId} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-subheadline)" }}>
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{it.name}</span>
                  <span className="mono" style={{ color: "var(--ink2)", marginLeft: 8 }}>
                    {it.quantity}× · {brl(it.revenue)}
                  </span>
                </div>
                <div style={{ height: 5, borderRadius: 4, background: "var(--surface2)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(it.quantity / maxItemQty) * 100}%`, background: "var(--warn)" }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="card" tabIndex={0} aria-label="Mapa de calor dos pedidos por dia e hora" style={{ padding: 16, overflowX: "auto" }}>
        <div style={{ fontWeight: 600, fontSize: "var(--text-body)", marginBottom: 12 }}>Horários de pico</div>
        <div style={{ display: "grid", gridTemplateColumns: "44px repeat(5, 1fr)", gap: 5, minWidth: 460 }}>
          <div />
          {heatmap[0]?.cells.map((c) => (
            <div key={c.hourLabel} className="mono" style={{ fontSize: "var(--text-caption)", color: "var(--ink3)", textAlign: "center" }}>
              {c.hourLabel}
            </div>
          ))}
          {heatmap.map((row) => (
            <Fragment key={row.dayLabel}>
              <div className="mono" style={{ fontSize: "var(--text-caption)", color: "var(--ink2)", display: "flex", alignItems: "center" }}>
                {row.dayLabel}
              </div>
              {row.cells.map((c, i) => (
                <div
                  key={i}
                  title={`${c.orderCount} pedidos`}
                  style={{
                    height: 26,
                    borderRadius: 9,
                    background: c.orderCount === 0 ? "var(--surface2)" : `color-mix(in srgb, var(--brand) ${20 + c.intensity * 70}%, var(--surface2))`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "var(--text-caption)",
                    color: c.intensity > 0.5 ? "var(--brandInk)" : "var(--ink3)"
                  }}
                  className="mono"
                >
                  {c.orderCount || ""}
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      </section>
    </div>
  );
}
