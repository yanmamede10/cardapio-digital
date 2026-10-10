import { useEffect, useState } from "react";
import type { Order, OrderStatus, WaiterCall } from "@cardapio/shared";
import { api } from "../../lib/api";
import { brl, minutesSince } from "../../lib/format";
import { AwaitingTag, InHouseTag, LineExtras, TakeawayTag, orderRef, orderSubtitle } from "../../components/OrderCard";
import { nextStatusFor } from "../OrdersScreen";
import { useMobileScreen } from "../../components/mobile/MobileLayout";
import { MobileChip } from "../../components/mobile/MobileChip";
import { MobileEmptyState } from "../../components/mobile/MobileEmptyState";
import { moduleOn } from "../../lib/modules";

type Tab = "pending" | "preparing" | "ready" | "done";

const TABS: { key: Tab; label: string; statuses: OrderStatus[] }[] = [
  { key: "pending", label: "Recebido", statuses: ["awaiting", "pending"] },
  { key: "preparing", label: "Preparando", statuses: ["preparing"] },
  { key: "ready", label: "Pronto", statuses: ["ready", "out_for_delivery"] },
  { key: "done", label: "Entregue", statuses: ["delivered", "served"] }
];

function timeTone(min: number): { bg: string; fg: string; accent: string } {
  if (min >= 25) return { bg: "color-mix(in srgb, var(--alert) 15%, transparent)", fg: "var(--alert)", accent: "var(--alert)" };
  if (min >= 12) return { bg: "color-mix(in srgb, var(--warn) 18%, transparent)", fg: "var(--warn)", accent: "var(--warn)" };
  return { bg: "var(--surface2)", fg: "var(--ink2)", accent: "var(--line)" };
}

export default function MobileOrdersScreen() {
  const { notify, refreshLive } = useMobileScreen({ title: "Central de Pedidos", subtitle: "Fila de atendimento em tempo real" });
  const [orders, setOrders] = useState<Order[]>([]);
  const [calls, setCalls] = useState<WaiterCall[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [channel, setChannel] = useState<"todos" | "table" | "delivery">("todos");
  const [tab, setTab] = useState<Tab>("pending");
  const [callsOpen, setCallsOpen] = useState(true);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () => {
      api
        .listOrders()
        .then((o) => alive && (setOrders(o), setLoaded(true), setOffline(false)))
        .catch(() => alive && setOffline(true)); // cards stay; the banner says the list is stale
      api.listWaiterCalls().then((c) => alive && setCalls(c)).catch(() => {});
    };
    load();
    const id = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const byChannel = orders.filter((o) => channel === "todos" || o.mode === channel);
  const current = TABS.find((t) => t.key === tab)!;
  const visible = byChannel.filter((o) => current.statuses.includes(o.status));
  const openCalls = calls.filter((c) => !c.resolvedAt);

  const advance = async (o: Order) => {
    try {
      const target = nextStatusFor(o);
      const updated = await api.setOrderStage(o.id, target);
      setOrders((prev) => prev.map((x) => (x.id === o.id ? updated : x)));
      notify(`${orderRef(o)} → ${target === "preparing" ? "Preparando" : target === "ready" ? "Pronto" : "Entregue"}`);
      refreshLive();
    } catch {
      notify("Não foi possível atualizar o pedido");
    }
  };
  const accept = async (o: Order) => {
    try {
      const updated = await api.acceptOrder(o.id);
      setOrders((prev) => prev.map((x) => (x.id === o.id ? updated : x)));
      notify(o.status === "awaiting" ? `Mesa ${o.tableNumber} aberta · o pedido ${o.code} entrou em Recebido` : `Pedido ${o.code} aceito`);
      refreshLive();
    } catch {
      notify("Não foi possível aceitar o pedido");
    }
  };
  const reject = async (o: Order) => {
    try {
      await api.rejectOrder(o.id);
      setOrders((prev) => prev.filter((x) => x.id !== o.id));
      notify(`Pedido ${o.code} recusado`);
      refreshLive();
    } catch {
      notify("Não foi possível recusar o pedido");
    }
  };
  const resolveCall = async (c: WaiterCall) => {
    try {
      await api.resolveWaiterCall(c.id);
      setCalls((prev) => prev.filter((x) => x.id !== c.id));
      notify(`Mesa ${c.tableNumber} atendida`);
      refreshLive();
    } catch {
      notify("Não foi possível atualizar o chamado");
    }
  };

  if (!loaded) {
    return (
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 11 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton" style={{ height: 150 }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 5, background: "var(--bg)", padding: "11px 12px 9px", borderBottom: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 9 }}>
        {offline && (
          <div role="alert" style={{ fontSize: "var(--text-subheadline)", fontWeight: 600, color: "var(--alert)" }}>
            Sem conexão com o servidor — tentando de novo
          </div>
        )}
        {/* Mesa / Delivery: only with Delivery contracted (checklist 15). */}
        {moduleOn("delivery") && (
          <div style={{ display: "flex", gap: 6 }}>
            <MobileChip active={channel === "todos"} onClick={() => setChannel("todos")} icon="fa-list-check" grow>
              Todos
            </MobileChip>
            <MobileChip active={channel === "table"} onClick={() => setChannel("table")} icon="fa-chair" grow>
              Mesa
            </MobileChip>
            <MobileChip active={channel === "delivery"} onClick={() => setChannel("delivery")} icon="fa-motorcycle" grow>
              Delivery
            </MobileChip>
          </div>
        )}
        <div style={{ display: "flex", gap: 4, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 12, padding: 3 }}>
          {TABS.map((t) => {
            const active = t.key === tab;
            const count = byChannel.filter((o) => t.statuses.includes(o.status)).length;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                style={{
                  flex: 1,
                  minHeight: 38,
                  border: 0,
                  borderRadius: 9,
                  cursor: "pointer",
                  font: "inherit",
                  fontSize: "var(--text-footnote)",
                  fontWeight: 600,
                  background: active ? "var(--surface)" : "transparent",
                  color: active ? "var(--ink)" : "var(--ink3)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 1,
                  boxShadow: active ? "0 1px 3px rgba(0,0,0,.12)" : "none"
                }}
              >
                <span>{t.label}</span>
                <span className="mono" style={{ fontSize: "var(--text-caption)", color: active ? "var(--brandText)" : "var(--ink3)" }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 11 }}>
        {openCalls.length > 0 && (
          <div style={{ background: "color-mix(in srgb, var(--alert) 12%, var(--surface))", border: "1px solid var(--alert)", borderRadius: 14, overflow: "hidden" }}>
            <button
              type="button"
              onClick={() => setCallsOpen((v) => !v)}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: "transparent", border: 0, cursor: "pointer", font: "inherit", padding: "12px 13px", color: "var(--ink)", minHeight: 48 }}
            >
              <i className="fa-solid fa-hand" style={{ fontSize: 16, color: "var(--alert)" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "var(--text-subheadline)", fontWeight: 600, color: "var(--alert)" }}>
                  {openCalls.length} {openCalls.length === 1 ? "mesa chamando garçom" : "mesas chamando garçom"}
                </div>
                <div style={{ fontSize: "var(--text-footnote)", color: "var(--ink2)" }}>A mais antiga espera há {Math.max(...openCalls.map((c) => minutesSince(c.createdAt)))} min</div>
              </div>
              <i className={`fa-solid ${callsOpen ? "fa-chevron-up" : "fa-chevron-down"}`} style={{ fontSize: 13, color: "var(--ink3)" }} />
            </button>
            {callsOpen && (
              <div style={{ borderTop: "1px solid color-mix(in srgb, var(--alert) 40%, transparent)", display: "flex", flexDirection: "column" }}>
                {openCalls.map((c) => {
                  const min = minutesSince(c.createdAt);
                  return (
                    <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 13px", borderBottom: "1px solid color-mix(in srgb, var(--alert) 22%, transparent)" }}>
                      <div style={{ fontSize: "var(--text-subheadline)", fontWeight: 600, flex: 1 }}>Mesa {c.tableNumber}</div>
                      <div className="mono" style={{ fontSize: "var(--text-footnote)", fontWeight: 600, color: min >= 5 ? "var(--alert)" : "var(--warn)" }}>
                        {min} min
                      </div>
                      <button type="button" onClick={() => resolveCall(c)} style={{ minHeight: 34, background: "var(--brand)", color: "var(--brandInk)", border: 0, borderRadius: 9, padding: "0 12px", cursor: "pointer", font: "inherit", fontSize: "var(--text-footnote)", fontWeight: 600 }}>
                        Atender
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {visible.map((o) => {
          const min = minutesSince(o.createdAt);
          const tone = timeTone(min);
          const isNew = o.status === "pending" || o.status === "awaiting";
          const canAdvance = o.status === "preparing" || o.status === "ready" || o.status === "out_for_delivery";
          const isDone = o.status === "delivered" || o.status === "served";
          const nextLabel = o.status === "preparing" ? "Marcar como pronto" : "Marcar como entregue";
          return (
            <article key={o.id} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderLeft: `3px solid ${tone.accent}`, borderRadius: 14, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              <AwaitingTag order={o} />
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ width: 36, height: 36, flex: "0 0 36px", borderRadius: 10, background: "var(--surface2)", border: "1px solid var(--line)", color: "var(--ink2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <i className={`fa-solid ${o.mode === "table" ? "fa-chair" : "fa-motorcycle"}`} style={{ fontSize: 15 }} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ fontSize: "var(--text-body)", fontWeight: 600, letterSpacing: "-.015em" }}>{orderRef(o)}</span>
                    <span className="mono" style={{ fontSize: "var(--text-caption)", color: "var(--ink3)" }}>
                      {o.code}
                    </span>
                  </div>
                  <div style={{ fontSize: "var(--text-footnote)", color: "var(--ink3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{orderSubtitle(o)}</div>
                  <InHouseTag order={o} />
                  <TakeawayTag order={o} />
                </div>
                <div className="mono" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "var(--text-footnote)", fontWeight: 600, borderRadius: 20, padding: "4px 9px", background: tone.bg, color: tone.fg }}>
                  <i className="fa-solid fa-stopwatch" style={{ fontSize: 11 }} />
                  {min} min
                </div>
              </div>

              <div style={{ background: "var(--surface2)", borderRadius: 10, padding: "9px 11px", display: "flex", flexDirection: "column", gap: 3 }}>
                {o.lines.map((l) => (
                  <div key={l.id}>
                    <div style={{ fontSize: "var(--text-subheadline)", color: "var(--ink2)" }}>
                      {l.quantity}× {l.name}
                    </div>
                    <LineExtras line={l} />
                  </div>
                ))}
                {o.lines.length === 0 && <div style={{ fontSize: "var(--text-subheadline)", color: "var(--ink3)" }}>Sem itens</div>}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="mono" style={{ fontSize: "var(--text-caption)", letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ink3)" }}>
                    Total
                  </div>
                  <div className="mono" style={{ fontSize: "var(--text-title3)", fontWeight: 600, letterSpacing: "-.02em" }}>
                    {brl(o.total)}
                  </div>
                </div>
              </div>

              {isNew && (
                <div style={{ display: "flex", gap: 9 }}>
                  <button type="button" onClick={() => reject(o)} style={{ flex: "0 0 38%", minHeight: 46, background: "transparent", border: "1px solid var(--line2)", color: "var(--ink2)", borderRadius: 11, cursor: "pointer", font: "inherit", fontSize: "var(--text-subheadline)", fontWeight: 600 }}>
                    Recusar
                  </button>
                  <button type="button" onClick={() => accept(o)} style={{ flex: 1, minHeight: 46, background: "var(--brand)", color: "var(--brandInk)", border: 0, borderRadius: 11, cursor: "pointer", font: "inherit", fontSize: "var(--text-subheadline)", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                    <i className="fa-solid fa-circle-check" style={{ fontSize: 14 }} />
                    Aceitar pedido
                  </button>
                </div>
              )}
              {canAdvance && (
                <button
                  type="button"
                  onClick={() => advance(o)}
                  style={{ minHeight: 46, width: "100%", background: "var(--brand)", color: "var(--brandInk)", border: 0, borderRadius: 11, cursor: "pointer", font: "inherit", fontSize: "var(--text-subheadline)", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}
                >
                  <i className="fa-solid fa-arrow-right" style={{ fontSize: 13 }} />
                  {nextLabel}
                </button>
              )}
              {isDone && (
                <div style={{ minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, border: "1px dashed var(--line2)", borderRadius: 11, color: "var(--ok)", fontSize: "var(--text-subheadline)", fontWeight: 600 }}>
                  <i className="fa-solid fa-circle-check" style={{ fontSize: 13 }} />
                  Pedido concluído há {min} min
                </div>
              )}
            </article>
          );
        })}

        {visible.length === 0 && (
          <MobileEmptyState icon="fa-receipt" title="Nenhum pedido nesta etapa" sub="Assim que um pedido chegar pelo cardápio digital ou pela mesa, ele aparece aqui." />
        )}
      </div>
    </div>
  );
}
