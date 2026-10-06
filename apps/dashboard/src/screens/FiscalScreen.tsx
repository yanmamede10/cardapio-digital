import { useEffect, useState } from "react";
import type { Order } from "@cardapio/shared";
import { ApiError, api } from "../lib/api";
import { brl, dayMonth, localIso } from "../lib/format";
import { FilterPopover, PAST_PERIODS, inPeriod, type FilterGroup, type FilterValues } from "../components/FilterPopover";

export const FISCAL_FILTERS: FilterGroup[] = [
  { id: "canal", label: "Canal", options: ["Mesa", "Delivery"] },
  { id: "per", label: "Período", options: PAST_PERIODS }
];
export const fiscalMatch = (o: Order, f: FilterValues) => (!f.canal || (o.mode === "table" ? "Mesa" : "Delivery") === f.canal) && inPeriod(localIso(new Date(o.createdAt)), f);
export const orderRef = (o: Order) => (o.mode === "table" ? `Mesa ${String(o.tableNumber ?? "").padStart(2, "0")} · pedido ${o.code}` : `Delivery ${o.code}`);

// ponytail: no NFC-e provider is integrated yet, so every finished order is "Sem nota" and Emitir is
// disabled. Pendente/Autorizada/Rejeitada/Cancelada need a FiscalNote record + provider callbacks.
export default function FiscalScreen() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterValues>({});

  useEffect(() => {
    api
      .listClosedOrders()
      .then(setOrders)
      .catch((err) => setError(err instanceof ApiError && err.status === 403 ? "Você não tem permissão para acessar a Emissão Fiscal." : "Não foi possível carregar a Emissão Fiscal."));
  }, []);

  if (error) return <p style={{ color: "var(--ink2)" }}>{error}</p>;
  if (!orders) return <div className="skeleton" style={{ height: 320 }} />;

  const rows = orders.filter((o) => fiscalMatch(o, filter));
  const cols = "minmax(180px,1fr) 70px 90px 110px 110px 100px";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="card" style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, fontSize: 12.5, color: "var(--ink2)" }}>
        <i className="fa-solid fa-circle-info" style={{ fontSize: 15, color: "var(--ink3)" }} />
        A emissão de NFC-e ainda não está integrada. A lista já mostra os pedidos e comandas fechados que vão precisar de nota.
      </div>
      <section className="card">
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 20px", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
          <div style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>Pedidos e comandas</div>
          <FilterPopover
            groups={FISCAL_FILTERS}
            value={filter}
            onChange={setFilter}
            resultCount={rows.length}
          />
        </div>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 760 }}>
            <div style={{ display: "grid", gridTemplateColumns: cols, gap: 16, padding: "12px 20px", background: "var(--surface2)", borderBottom: "1px solid var(--line)" }}>
              {["Pedido / comanda", "Data", "Nota", "Valor", "Status", ""].map((h) => (
                <div key={h} className="field-label">
                  {h}
                </div>
              ))}
            </div>
            {rows.map((o) => (
              <div key={o.id} style={{ display: "grid", gridTemplateColumns: cols, gap: 16, padding: "13px 20px", borderBottom: "1px solid var(--line)", alignItems: "center", fontSize: 13 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <i className={`fa-solid ${o.mode === "table" ? "fa-chair" : "fa-motorcycle"}`} style={{ fontSize: 13, color: "var(--ink3)", width: 15, textAlign: "center" }} />
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {orderRef(o)}
                  </span>
                </div>
                <div className="mono" style={{ fontSize: 12.5, color: "var(--ink2)" }}>
                  {dayMonth(localIso(new Date(o.createdAt)))}
                </div>
                <div className="mono" style={{ fontSize: 12.5, color: "var(--ink3)" }}>
                  —
                </div>
                <div className="mono" style={{ fontWeight: 600 }}>
                  {brl(o.total)}
                </div>
                <div>
                  <span style={{ fontSize: 11.5, fontWeight: 600, borderRadius: 999, padding: "2px 11px", background: "var(--surface2)", color: "var(--ink2)", whiteSpace: "nowrap" }}>Sem nota</span>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button type="button" className="btn btn-primary" style={{ padding: "6px 13px", fontSize: 12.5 }} disabled title="Integração fiscal em breve">
                    Emitir
                  </button>
                </div>
              </div>
            ))}
            {rows.length === 0 && (
              <div style={{ padding: "36px 20px", textAlign: "center", fontSize: 13, color: "var(--ink3)" }}>
                {orders.length ? "Nenhum resultado com esses filtros." : "Nenhum pedido fechado ainda."}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
