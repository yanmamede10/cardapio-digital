import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PAYMENT_METHODS, type AdminCharge } from "@cardapio/shared";
import { brDate, brl, fmtDate, todayIso } from "../lib/format";
import { useDashboardState } from "../state/DashboardStateContext";
import { Segmented } from "../components/Segmented";
import type { AdminCall } from "./AdminScreen";

type Filter = "todos" | "pending" | "overdue" | "paid";
const STATUS: Record<AdminCharge["status"], { label: string; color: string }> = {
  pending: { label: "Pendente", color: "var(--warn)" },
  overdue: { label: "Atrasado", color: "var(--alert)" },
  paid: { label: "Pago", color: "var(--ok)" },
  failed: { label: "Falhou", color: "var(--alert)" }
};
const monthLabel = (m: string | null) => (m ? `${m.slice(5)}/${m.slice(0, 4)}` : "—");

/** Super admin → every restaurant's mensalidades: generate a month, filter by status, mark as paid.
 *  Overdue is flagged here only — deactivating stays a manual call in the restaurant list. */
export default function AdminBillingScreen({ call }: { call: AdminCall }) {
  const { notify } = useDashboardState();
  const [list, setList] = useState<AdminCharge[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("todos");
  const [month, setMonth] = useState(todayIso().slice(0, 7));
  const [paying, setPaying] = useState<{ id: string; paidOn: string; paymentMethod: string } | null>(null);

  const load = () => call<AdminCharge[]>("/billing").then(setList).catch((e: Error) => setError(e.message));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generate = async () => {
    try {
      const { created } = await call<{ created: number }>("/billing", { method: "POST", body: JSON.stringify({ month }) });
      notify(created ? `${created} ${created === 1 ? "cobrança gerada" : "cobranças geradas"} para ${monthLabel(month)}` : `Nenhuma cobrança nova: todos já têm ${monthLabel(month)}`);
      load();
    } catch {
      notify("Não foi possível gerar as cobranças");
    }
  };

  const pay = async () => {
    if (!paying) return;
    try {
      const updated = await call<AdminCharge>(`/billing/${paying.id}/pay`, { method: "POST", body: JSON.stringify({ paidOn: paying.paidOn, paymentMethod: paying.paymentMethod }) });
      setList((prev) => prev!.map((c) => (c.id === updated.id ? updated : c)));
      setPaying(null);
      notify(`Pagamento de ${updated.restaurantName} registrado`);
    } catch {
      notify("Não foi possível registrar o pagamento");
    }
  };

  if (!list) return error ? <p style={{ color: "var(--ink2)" }}>{error}</p> : <div className="skeleton" style={{ height: 300 }} />;

  const count = (s: AdminCharge["status"]) => list.filter((c) => c.status === s).length;
  const overdue = list.filter((c) => c.status === "overdue");
  const shown = list.filter((c) => filter === "todos" || c.status === filter);
  const cols = "minmax(0,1.4fr) 80px 100px 110px 100px minmax(260px,1.3fr)";

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "todos", label: "Todas", count: list.length },
            { value: "pending", label: "Pendentes", count: count("pending") },
            { value: "overdue", label: "Atrasadas", count: overdue.length },
            { value: "paid", label: "Pagas", count: count("paid") }
          ]}
        />
        <div style={{ flex: 1 }} />
        <input className="field mono" type="month" aria-label="Mês" style={{ width: 170 }} value={month} onChange={(e) => setMonth(e.target.value)} />
        <button type="button" className="btn btn-primary" disabled={!month} onClick={generate}>
          Gerar cobranças do mês
        </button>
      </div>
      <div style={{ fontSize: "var(--text-footnote)", color: "var(--ink3)" }}>
        Gera a mensalidade de cada restaurante ativo com valor definido no detalhe dele, vencendo no dia escolhido. Gerar de novo só acrescenta quem ainda não tem o mês.
      </div>
      {overdue.length > 0 && (
        <div style={{ fontSize: "var(--text-subheadline)", fontWeight: 600, color: "var(--alert)" }}>
          {overdue.length} {overdue.length === 1 ? "mensalidade atrasada" : "mensalidades atrasadas"} · {brl(overdue.reduce((t, c) => t + c.value, 0))} em aberto
        </div>
      )}

      <section className="card" style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 860 }}>
          <div style={{ display: "grid", gridTemplateColumns: cols, gap: 12, padding: "9px 16px", background: "var(--surface2)", borderBottom: "1px solid var(--line)" }}>
            {["Restaurante", "Mês", "Vencimento", "Valor", "Status", ""].map((h) => (
              <div key={h} className="field-label">
                {h}
              </div>
            ))}
          </div>
          {shown.length === 0 && <div style={{ padding: "20px 16px", fontSize: "var(--text-subheadline)", color: "var(--ink3)" }}>Nenhuma mensalidade aqui.</div>}
          {shown.map((c) => {
            const late = c.status === "overdue";
            return (
              <div
                key={c.id}
                data-status={c.status}
                style={{
                  display: "grid",
                  gridTemplateColumns: cols,
                  gap: 12,
                  alignItems: "center",
                  padding: "10px 16px",
                  borderBottom: "1px solid var(--line)",
                  // Inadimplente: tinted row + red edge, so it stands out in "Todas".
                  background: late ? "color-mix(in srgb, var(--alert) 8%, transparent)" : undefined,
                  boxShadow: late ? "inset 3px 0 0 var(--alert)" : undefined
                }}
              >
                <Link to={`/admin/restaurantes/${encodeURIComponent(c.restaurantId)}`} style={{ fontSize: "var(--text-body)", fontWeight: 500, color: "var(--ink)", minWidth: 0 }}>
                  {c.restaurantName}
                </Link>
                <div className="mono" style={{ fontSize: "var(--text-subheadline)" }}>
                  {monthLabel(c.month)}
                </div>
                <div className="mono" style={{ fontSize: "var(--text-subheadline)", color: late ? "var(--alert)" : "var(--ink2)" }}>
                  {fmtDate(c.date)}
                </div>
                <div className="mono" style={{ fontSize: "var(--text-subheadline)", fontWeight: 600 }}>
                  {brl(c.value)}
                </div>
                <span className="pill" style={{ justifySelf: "start", background: "var(--surface2)", color: STATUS[c.status].color, fontWeight: late ? 700 : undefined }}>
                  <span className="dot" style={{ background: STATUS[c.status].color }} />
                  {STATUS[c.status].label}
                </span>
                {c.status === "paid" ? (
                  <div style={{ fontSize: "var(--text-subheadline)", color: "var(--ink2)" }}>
                    Pago em {c.paidOn ? brDate(c.paidOn) : "—"}
                    {c.paymentMethod && ` · ${c.paymentMethod}`}
                  </div>
                ) : paying?.id === c.id ? (
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <input className="field mono" type="date" aria-label="Data do pagamento" style={{ width: 140, padding: "5px 8px" }} value={paying.paidOn} onChange={(e) => setPaying({ ...paying, paidOn: e.target.value })} />
                    <select className="field" aria-label="Forma de pagamento" style={{ width: 130, padding: "5px 8px" }} value={paying.paymentMethod} onChange={(e) => setPaying({ ...paying, paymentMethod: e.target.value })}>
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                    <button type="button" className="btn btn-primary" style={{ padding: "6px 11px", fontSize: "var(--text-subheadline)" }} disabled={!paying.paidOn} onClick={pay}>
                      Confirmar
                    </button>
                    <button type="button" className="btn btn-outline" style={{ padding: "6px 11px", fontSize: "var(--text-subheadline)" }} onClick={() => setPaying(null)}>
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button type="button" className="btn btn-outline" style={{ justifySelf: "start", padding: "6px 13px", fontSize: "var(--text-subheadline)" }} onClick={() => setPaying({ id: c.id, paidOn: todayIso(), paymentMethod: "PIX" })}>
                    Marcar como pago
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
