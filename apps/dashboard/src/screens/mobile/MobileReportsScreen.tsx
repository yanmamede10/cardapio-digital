import { useEffect, useMemo, useState } from "react";
import type { AnalyticsPeriod, AnalyticsSummary, Review } from "@cardapio/shared";
import { api } from "../../lib/api";
import { brl, fmtDateTime, stars } from "../../lib/format";
import { useMobileScreen } from "../../components/mobile/MobileLayout";
import { MobileChip } from "../../components/mobile/MobileChip";

const PERIODS: { key: AnalyticsPeriod; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mês" },
  { key: "custom", label: "Personalizado" }
];

function Delta({ pct }: { pct: number }) {
  const good = pct >= 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "var(--text-footnote)", fontWeight: 600, color: good ? "var(--ok)" : "var(--alert)" }}>
      <i className={`fa-solid ${good ? "fa-arrow-trend-up" : "fa-arrow-trend-down"}`} style={{ fontSize: 11 }} />
      {good ? "+" : ""}
      {pct}%<span style={{ color: "var(--ink3)", fontWeight: 400 }}>vs. anterior</span>
    </div>
  );
}

export default function MobileReportsScreen() {
  useMobileScreen({ title: "Relatórios", subtitle: "Desempenho do período" });
  const [period, setPeriod] = useState<AnalyticsPeriod>("week");
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [chartChannel, setChartChannel] = useState<"Todos" | "Mesa" | "Delivery">("Todos");
  const [rankMode, setRankMode] = useState<"top" | "bottom">("top");

  useEffect(() => {
    setData(null);
    api.getAnalytics(period).then(setData);
  }, [period]);

  useEffect(() => {
    api.listReviews().then(setReviews);
  }, []);

  const heat = useMemo(() => {
    if (!data) return [];
    const byHour = new Map<string, { total: number; max: number }>();
    for (const row of data.heatmap) {
      for (const cell of row.cells) {
        const cur = byHour.get(cell.hourLabel) || { total: 0, max: 0 };
        cur.total += cell.orderCount;
        byHour.set(cell.hourLabel, cur);
      }
    }
    const maxTotal = Math.max(1, ...Array.from(byHour.values()).map((v) => v.total));
    return Array.from(byHour.entries()).map(([hourLabel, v]) => ({ hourLabel, orderCount: v.total, intensity: v.total / maxTotal }));
  }, [data]);

  if (!data) {
    return (
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="skeleton" style={{ height: 90 }} />
        <div className="skeleton" style={{ height: 220 }} />
      </div>
    );
  }

  const { kpis, revenueSeries, topSellers, bottomSellers, reviewAverage, reviewCount } = data;
  const ranking = rankMode === "top" ? topSellers : bottomSellers;
  const maxQty = Math.max(1, ...ranking.map((r) => r.quantity));
  const maxRevenue = Math.max(
    1,
    ...revenueSeries.map((p) => (chartChannel === "Mesa" ? p.tableRevenue : chartChannel === "Delivery" ? p.deliveryRevenue : p.tableRevenue + p.deliveryRevenue))
  );

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 5, background: "var(--bg)", padding: "11px 12px 9px", borderBottom: "1px solid var(--line)", display: "flex", gap: 6, overflowX: "auto" }}>
        {PERIODS.map((p) => (
          <MobileChip key={p.key} active={period === p.key} onClick={() => setPeriod(p.key)}>
            {p.label}
          </MobileChip>
        ))}
      </div>

      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 13, padding: 12, display: "flex", flexDirection: "column", gap: 5 }}>
            <div className="mono" style={{ fontSize: "var(--text-caption)", letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ink3)" }}>
              Vendas de produtos
            </div>
            <div className="mono" style={{ fontSize: "var(--text-title2)", fontWeight: 600, letterSpacing: "-.03em" }}>
              {brl(kpis.revenue)}
            </div>
            <Delta pct={kpis.revenueDeltaPct} />
          </div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 13, padding: 12, display: "flex", flexDirection: "column", gap: 5 }}>
            <div className="mono" style={{ fontSize: "var(--text-caption)", letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ink3)" }}>
              Ticket médio
            </div>
            <div className="mono" style={{ fontSize: "var(--text-title2)", fontWeight: 600, letterSpacing: "-.03em" }}>
              {brl(kpis.avgTicket)}
            </div>
            <Delta pct={kpis.avgTicketDeltaPct} />
          </div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 13, padding: 12, display: "flex", flexDirection: "column", gap: 5 }}>
            <div className="mono" style={{ fontSize: "var(--text-caption)", letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ink3)" }}>
              Pedidos
            </div>
            <div className="mono" style={{ fontSize: "var(--text-title2)", fontWeight: 600, letterSpacing: "-.03em" }}>
              {kpis.orderCount}
            </div>
            <Delta pct={kpis.orderCountDeltaPct} />
          </div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 13, padding: 12, display: "flex", flexDirection: "column", gap: 5 }}>
            <div className="mono" style={{ fontSize: "var(--text-caption)", letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ink3)" }}>
              Avaliação
            </div>
            <div className="mono" style={{ fontSize: "var(--text-title2)", fontWeight: 600, letterSpacing: "-.03em" }}>
              {reviewAverage.toFixed(1)}
            </div>
            <div style={{ fontSize: "var(--text-footnote)", color: "var(--ink3)" }}>{reviewCount} avaliações</div>
          </div>
        </div>

        {/* The table service apart from the products; products + service = what was charged (Contas a Receber). */}
        <section style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: 13, display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            { label: "Vendas de produtos", value: kpis.revenue },
            { label: "Serviço das mesas", value: kpis.service },
            { label: "Total cobrado", value: kpis.total, strong: true }
          ].map((r) => (
            <div key={r.label} style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: "var(--text-subheadline)", fontWeight: r.strong ? 600 : 400, color: r.strong ? "var(--ink)" : "var(--ink2)", paddingTop: r.strong ? 6 : 0, borderTop: r.strong ? "1px solid var(--line)" : undefined }}>
              <span style={{ flex: 1 }}>{r.label}</span>
              <span className="mono" style={{ fontWeight: 600, color: "var(--ink)" }}>{brl(r.value)}</span>
            </div>
          ))}
        </section>

        <section style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: 13, display: "flex", flexDirection: "column", gap: 11 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: "var(--text-subheadline)", fontWeight: 600, flex: 1 }}>Faturamento</div>
            <div style={{ display: "flex", gap: 4, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 9, padding: 2 }}>
              {(["Todos", "Mesa", "Delivery"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setChartChannel(c)}
                  style={{ minHeight: 30, border: 0, borderRadius: 7, padding: "0 9px", cursor: "pointer", font: "inherit", fontSize: "var(--text-caption)", fontWeight: 600, background: chartChannel === c ? "var(--surface)" : "transparent", color: chartChannel === c ? "var(--brandText)" : "var(--ink3)" }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div tabIndex={0} role="group" aria-label="Gráfico de faturamento (role para os lados)" style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, alignItems: "flex-end", height: 192 }}>
            {revenueSeries.map((p, i) => {
              const mesaPortion = chartChannel === "Delivery" ? 0 : p.tableRevenue;
              const deliveryPortion = chartChannel === "Mesa" ? 0 : p.deliveryRevenue;
              const shown = mesaPortion + deliveryPortion;
              const h = Math.max(2, Math.round((shown / maxRevenue) * 96));
              const mesaH = shown > 0 ? Math.round((mesaPortion / shown) * h) : 0;
              const deliveryH = h - mesaH;
              return (
                <div key={i} style={{ flex: "0 0 42px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}>
                  <div className="mono" style={{ fontSize: "var(--text-caption)", color: "var(--ink3)" }}>
                    {(shown / 1000).toFixed(1).replace(".", ",")}k
                  </div>
                  <div style={{ width: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 2, height: h }}>
                    {chartChannel !== "Mesa" && <div style={{ height: deliveryH, background: "var(--sec)", borderRadius: "5px 5px 0 0" }} />}
                    {chartChannel !== "Delivery" && <div style={{ height: mesaH, background: "var(--brand)", borderRadius: chartChannel === "Mesa" ? "5px 5px 0 0" : "0 0 5px 5px" }} />}
                  </div>
                  <div style={{ fontSize: "var(--text-caption)", color: "var(--ink3)" }}>{p.label}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 14, fontSize: "var(--text-footnote)", color: "var(--ink2)" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--brand)" }} />
              Mesa
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--sec)" }} />
              Delivery
            </span>
          </div>
        </section>

        <section style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "11px 13px", borderBottom: "1px solid var(--line)", display: "flex", gap: 4 }}>
            {(["top", "bottom"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setRankMode(m)} style={{ flex: 1, minHeight: 36, border: 0, borderRadius: 9, cursor: "pointer", font: "inherit", fontSize: "var(--text-footnote)", fontWeight: 600, background: rankMode === m ? "var(--surface2)" : "transparent", color: rankMode === m ? "var(--brandText)" : "var(--ink3)" }}>
                {m === "top" ? "Mais vendidos" : "Menos vendidos"}
              </button>
            ))}
          </div>
          {ranking.map((r, i) => (
            <div key={r.itemId} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", borderBottom: "1px solid var(--line)" }}>
              <div className="mono" style={{ fontSize: "var(--text-footnote)", fontWeight: 600, color: "var(--ink3)", width: 18 }}>
                {String(i + 1).padStart(2, "0")}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "var(--text-subheadline)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
                <div style={{ height: 5, borderRadius: 4, background: "var(--surface3)", marginTop: 5 }}>
                  <div style={{ height: 5, borderRadius: 4, background: rankMode === "top" ? "var(--brand)" : "var(--sec)", width: `${(r.quantity / maxQty) * 100}%` }} />
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="mono" style={{ fontSize: "var(--text-subheadline)", fontWeight: 600 }}>
                  {r.quantity}×
                </div>
                <div style={{ fontSize: "var(--text-caption)", color: "var(--ink3)" }}>{brl(r.revenue)}</div>
              </div>
            </div>
          ))}
          {ranking.length === 0 && <div style={{ padding: "18px 13px", textAlign: "center", color: "var(--ink3)", fontSize: "var(--text-subheadline)" }}>Sem vendas no período.</div>}
        </section>

        {heat.length > 0 && (
          <section style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: 13, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: "var(--text-subheadline)", fontWeight: 600 }}>Horários de pico</div>
            <div style={{ display: "flex", gap: 4 }}>
              {heat.map((h) => (
                <div key={h.hourLabel} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                  <div style={{ width: "100%", height: 34, borderRadius: 7, background: `color-mix(in srgb, var(--brand) ${Math.max(8, Math.round(h.intensity * 100))}%, var(--surface3))` }} />
                  <div className="mono" style={{ fontSize: "var(--text-caption)", color: "var(--ink3)" }}>
                    {h.hourLabel}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "11px 13px", borderBottom: "1px solid var(--line)", fontSize: "var(--text-subheadline)", fontWeight: 600 }}>Avaliações recentes</div>
          {reviews.slice(0, 3).map((r) => (
            <div key={r.id} style={{ padding: "12px 13px", borderBottom: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "var(--text-subheadline)", fontWeight: 600, flex: 1, minWidth: 0 }}>{r.customerName}</span>
                <span style={{ color: "var(--secText)", fontSize: "var(--text-subheadline)", letterSpacing: ".06em" }}>{stars(r.rating)}</span>
              </div>
              <div style={{ fontSize: "var(--text-subheadline)", color: "var(--ink2)", textWrap: "pretty" }}>{r.text}</div>
              <div style={{ fontSize: "var(--text-caption)", color: "var(--ink3)" }}>
                {r.channel === "table" ? "Mesa" : "Delivery"} · {fmtDateTime(r.createdAt)}
              </div>
            </div>
          ))}
          {reviews.length === 0 && <div style={{ padding: "18px 13px", textAlign: "center", color: "var(--ink3)", fontSize: "var(--text-subheadline)" }}>Nenhuma avaliação ainda.</div>}
        </section>
      </div>
    </div>
  );
}
