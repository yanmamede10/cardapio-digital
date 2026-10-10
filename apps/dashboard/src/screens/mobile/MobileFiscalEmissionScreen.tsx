import { useEffect, useState } from "react";
import type { Order } from "@cardapio/shared";
import { ApiError, api } from "../../lib/api";
import { brl, dayMonth, localIso } from "../../lib/format";
import { useMobileScreen } from "../../components/mobile/MobileLayout";
import { MobileEmptyState } from "../../components/mobile/MobileEmptyState";
import { FilterPopover, type FilterValues } from "../../components/FilterPopover";
import { FISCAL_FILTERS, fiscalMatch, orderRef } from "../FiscalScreen";

// ponytail: same limitation as the desktop screen — no NFC-e provider yet, so every row is "Sem nota" and Emitir is disabled.
export default function MobileFiscalEmissionScreen() {
  useMobileScreen({ title: "Emissão fiscal", subtitle: "Financeiro" });
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterValues>({});

  useEffect(() => {
    api
      .listClosedOrders()
      .then(setOrders)
      .catch((err) => setError(err instanceof ApiError && err.status === 403 ? "Você não tem permissão para acessar a Emissão Fiscal." : "Não foi possível carregar a Emissão Fiscal."));
  }, []);

  if (error) return <p style={{ padding: 16, color: "var(--ink2)" }}>{error}</p>;
  if (!orders) {
    return (
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton" style={{ height: 64 }} />
        ))}
      </div>
    );
  }

  const rows = orders.filter((o) => fiscalMatch(o, filter));

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 5, background: "var(--bg)", padding: "11px 12px 9px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 9 }}>
        <div className="mono" style={{ flex: 1, fontSize: "var(--text-footnote)", color: "var(--ink3)" }}>
          {rows.length === 1 ? "1 pedido" : `${rows.length} pedidos`}
        </div>
        <FilterPopover sheet groups={FISCAL_FILTERS} value={filter} onChange={setFilter} resultCount={rows.length} />
      </div>

      <div style={{ padding: "12px 12px 28px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 13px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, fontSize: "var(--text-footnote)", color: "var(--ink2)" }}>
          <i className="fa-solid fa-circle-info" style={{ fontSize: 14, color: "var(--ink3)", marginTop: 1 }} />
          A emissão de NFC-e ainda não está integrada. A lista já mostra os pedidos e comandas fechados que vão precisar de nota.
        </div>

        {rows.length === 0 ? (
          <MobileEmptyState icon="fa-receipt" title="Nenhum pedido" sub={orders.length ? "Nenhum resultado com esses filtros." : "Pedidos e comandas fechados aparecem aqui."} />
        ) : (
          <section style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden" }}>
            {rows.map((o) => (
              <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", borderBottom: "1px solid var(--line)", minHeight: 62 }}>
                <i className={`fa-solid ${o.mode === "table" ? "fa-chair" : "fa-motorcycle"}`} style={{ fontSize: 14, color: "var(--ink3)", width: 16, textAlign: "center" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "var(--text-body)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{orderRef(o)}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: "var(--text-footnote)", color: "var(--ink3)" }}>
                    <span className="mono">{dayMonth(localIso(new Date(o.createdAt)))}</span>
                    <span style={{ fontSize: "var(--text-caption)", fontWeight: 600, borderRadius: 20, padding: "1px 8px", background: "var(--surface2)", color: "var(--ink2)" }}>Sem nota</span>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
                  <span className="mono" style={{ fontSize: "var(--text-body)", fontWeight: 600 }}>
                    {brl(o.total)}
                  </span>
                  <button type="button" className="btn btn-primary" style={{ padding: "4px 12px", fontSize: "var(--text-footnote)" }} disabled title="Integração fiscal em breve">
                    Emitir
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
