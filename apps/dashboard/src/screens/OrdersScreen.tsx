import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { Order, OrderStatus, WaiterCall } from "@cardapio/shared";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import { api } from "../lib/api";
import { brl, minutesSince } from "../lib/format";
import { useDashboardState } from "../state/DashboardStateContext";

const ALERT_MINUTES = 20;

type Bucket = "pending" | "preparing" | "ready" | "completed";

const BUCKET_DEFS: { key: Bucket; label: string; dot: string; statuses: OrderStatus[]; nextLabel: string | null }[] = [
  { key: "pending", label: "Recebido", dot: "var(--sec)", statuses: ["pending"], nextLabel: "Preparar" },
  { key: "preparing", label: "Preparando", dot: "var(--warn)", statuses: ["preparing"], nextLabel: "Marcar pronto" },
  { key: "ready", label: "Pronto", dot: "var(--ok)", statuses: ["ready", "out_for_delivery"], nextLabel: "Entregar" },
  { key: "completed", label: "Entregue / Servido", dot: "var(--ink3)", statuses: ["delivered", "served"], nextLabel: null }
];

function bucketOf(status: OrderStatus): Bucket {
  const found = BUCKET_DEFS.find((b) => b.statuses.includes(status));
  return (found?.key || "completed") as Bucket;
}

export const nextStatusFor = (o: Order): OrderStatus => {
  if (o.status === "pending") return "preparing";
  if (o.status === "preparing") return "ready";
  return o.mode === "delivery" ? "delivered" : "served";
};

/** A dropped-on column maps to the same target status the "next stage" button already uses. */
function targetStatusFor(col: Bucket, mode: Order["mode"]): OrderStatus | null {
  if (col === "pending") return null;
  if (col === "preparing") return "preparing";
  if (col === "ready") return "ready";
  return mode === "delivery" ? "delivered" : "served";
}

export default function OrdersScreen() {
  const { notify } = useDashboardState();
  const [orders, setOrders] = useState<Order[]>([]);
  const [calls, setCalls] = useState<WaiterCall[]>([]);
  const [shift, setShift] = useState<{ closedOrders: number; avgTicket: number; avgPrepMinutes: number; shiftRevenue: number } | null>(null);
  const [filter, setFilter] = useState<"todos" | "table" | "delivery">("todos");
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor)
  );

  useEffect(() => {
    let alive = true;
    const load = () => {
      api.listOrders().then((o) => alive && setOrders(o)).catch(() => {});
      api.listWaiterCalls().then((c) => alive && setCalls(c)).catch(() => {});
      api.getShiftStats().then((s) => alive && setShift(s)).catch(() => {});
    };
    load();
    const id = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const visible = useMemo(() => orders.filter((o) => filter === "todos" || o.mode === filter), [orders, filter]);

  const setStage = async (id: string, stage: OrderStatus, label: string, ref: string) => {
    try {
      const updated = await api.setOrderStage(id, stage);
      setOrders((prev) => prev.map((o) => (o.id === id ? updated : o)));
      notify(`${ref} → ${label}`);
    } catch {
      notify("Não foi possível atualizar o pedido");
    }
  };

  const accept = async (o: Order) => {
    try {
      const updated = await api.acceptOrder(o.id);
      setOrders((prev) => prev.map((x) => (x.id === o.id ? updated : x)));
      notify(`Pedido ${o.code} aceito`);
    } catch {
      notify("Não foi possível aceitar o pedido");
    }
  };
  const reject = async (o: Order) => {
    try {
      await api.rejectOrder(o.id);
      setOrders((prev) => prev.filter((x) => x.id !== o.id));
      notify(`Pedido ${o.code} recusado`);
    } catch {
      notify("Não foi possível recusar o pedido");
    }
  };

  const resolveCall = async (c: WaiterCall) => {
    try {
      await api.resolveWaiterCall(c.id);
      setCalls((prev) => prev.filter((x) => x.id !== c.id));
      notify(`Mesa ${c.tableNumber} atendida`);
    } catch {
      notify("Não foi possível atualizar o chamado");
    }
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over) return;
    const o = orders.find((x) => x.id === String(active.id));
    if (!o) return;
    const col = String(over.id) as Bucket;
    const target = targetStatusFor(col, o.mode);
    if (!target || target === o.status) return;
    const colDef = BUCKET_DEFS.find((b) => b.key === col)!;
    setStage(o.id, target, colDef.label, o.mode === "table" ? `Mesa ${o.tableNumber}` : o.code);
  };

  const activeOrder = activeId ? orders.find((o) => o.id === activeId) || null : null;

  const filters: { key: "todos" | "table" | "delivery"; label: string; icon: string }[] = [
    { key: "todos", label: "Todos", icon: "fa-list-check" },
    { key: "table", label: "Mesa", icon: "fa-chair" },
    { key: "delivery", label: "Delivery", icon: "fa-motorcycle" }
  ];

  return (
    <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 4, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 14, padding: 3 }}>
            {filters.map((f) => {
              const count = f.key === "todos" ? orders.length : orders.filter((o) => o.mode === f.key).length;
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className="tap"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    border: 0,
                    borderRadius: 11,
                    padding: "6px 12px",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 500,
                    background: active ? "var(--surface)" : "transparent",
                    color: active ? "var(--brandText)" : "var(--ink2)"
                  }}
                >
                  <i className={`fa-solid ${f.icon}`} style={{ fontSize: 17, lineHeight: 1 }} />
                  {f.label}
                  <span className="mono" style={{ fontSize: 11, opacity: 0.75 }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--ink3)" }}>
            <span className="dot" style={{ background: "var(--ok)" }} />
            Atualizando em tempo real
          </div>
          <button type="button" className="btn btn-outline" onClick={() => notify("Fila de produção enviada à impressora")}>
            <i className="fa-solid fa-print" style={{ fontSize: 17, lineHeight: 1 }} />
            Imprimir fila
          </button>
        </div>

        <DndContext sensors={sensors} onDragStart={({ active }) => setActiveId(String(active.id))} onDragEnd={handleDragEnd} onDragCancel={() => setActiveId(null)}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(232px, 1fr))", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
            {BUCKET_DEFS.map((col) => {
              const list = visible.filter((o) => bucketOf(o.status) === col.key);
              return (
                <KanbanColumn key={col.key} id={col.key} label={col.label} dot={col.dot} count={list.length}>
                  {list.map((o) => (
                    <KanbanCard key={o.id} order={o} nextLabel={col.nextLabel} onAccept={accept} onReject={reject} onAdvance={() => setStage(o.id, nextStatusFor(o), col.nextLabel!, o.mode === "table" ? `Mesa ${o.tableNumber}` : `Delivery ${o.code}`)} />
                  ))}
                  {list.length === 0 && (
                    <div style={{ border: "1px dashed var(--line2)", borderRadius: 12, padding: "18px 12px", textAlign: "center", color: "var(--ink3)", fontSize: 12.5 }}>Nenhum pedido aqui</div>
                  )}
                </KanbanColumn>
              );
            })}
          </div>
          <DragOverlay>{activeOrder && <KanbanCardBody order={activeOrder} nextLabel={BUCKET_DEFS.find((b) => b.key === bucketOf(activeOrder.status))?.nextLabel ?? null} overlay />}</DragOverlay>
        </DndContext>
      </div>

      <aside style={{ width: 272, flex: "0 0 272px", display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: 86 }}>
        <section className="card" style={{ overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 14px", borderBottom: "1px solid var(--line)" }}>
            <span style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", width: 8, height: 8 }}>
              <span style={{ position: "absolute", width: 8, height: 8, borderRadius: "50%", background: "var(--alert)", animation: "pulse 1.8s ease-out infinite" }} />
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--alert)" }} />
            </span>
            <div style={{ fontWeight: 600, fontSize: 13 }}>Chamar garçom</div>
            <div style={{ flex: 1 }} />
            <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: "var(--alert)" }}>
              {calls.length}
            </span>
          </div>
          {calls.map((c) => {
            const min = minutesSince(c.createdAt);
            const color = min >= 8 ? "var(--alert)" : min >= 4 ? "var(--warn)" : "var(--ink2)";
            return (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderBottom: "1px solid var(--line)" }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Mesa {c.tableNumber}</div>
                  <div style={{ fontSize: 11.5, color: "var(--ink3)" }}>{c.reason}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="mono" style={{ fontSize: 13, fontWeight: 600, color }}>
                    {min} min
                  </div>
                  <button type="button" onClick={() => resolveCall(c)} style={{ background: "transparent", border: 0, color: "var(--ink3)", font: "inherit", fontSize: 11.5, cursor: "pointer", padding: 0, textDecoration: "underline" }}>
                    atender
                  </button>
                </div>
              </div>
            );
          })}
          {calls.length === 0 && <div style={{ padding: "18px 14px", textAlign: "center", color: "var(--ink3)", fontSize: 12.5 }}>Nenhum chamado pendente</div>}
        </section>

        <section className="card" style={{ padding: 14 }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink3)", marginBottom: 10 }}>
            Turno de hoje
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: "Pedidos fechados", value: String(shift?.closedOrders ?? "—") },
              { label: "Ticket médio", value: shift ? brl(shift.avgTicket) : "—" },
              { label: "Tempo médio de preparo", value: shift ? `${shift.avgPrepMinutes} min` : "—" },
              { label: "Faturamento do turno", value: shift ? brl(shift.shiftRevenue) : "—" }
            ].map((s) => (
              <div key={s.label} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <div style={{ fontSize: 12.5, color: "var(--ink2)", flex: 1, minWidth: 0 }}>{s.label}</div>
                <div className="mono" style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-.02em" }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function KanbanColumn({ id, label, dot, count, children }: { id: string; label: string; dot: string; count: number; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section
      ref={setNodeRef}
      style={{
        background: "var(--surface2)",
        border: `1px solid ${isOver ? "var(--brand)" : "var(--line)"}`,
        borderRadius: 16,
        display: "flex",
        flexDirection: "column",
        minHeight: 380,
        transition: "border-color .12s var(--ease-spring)"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px", borderBottom: "1px solid var(--line)" }}>
        <span className="dot" style={{ background: dot }} />
        <div className="mono" style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".02em", textTransform: "uppercase" }}>
          {label}
        </div>
        <div style={{ flex: 1 }} />
        <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: "var(--ink2)", background: "var(--surface3)", borderRadius: 20, padding: "1px 8px" }}>
          {count}
        </span>
      </div>
      <div style={{ padding: 13, display: "flex", flexDirection: "column", gap: 11 }}>{children}</div>
    </section>
  );
}

function KanbanCard({
  order,
  nextLabel,
  onAccept,
  onReject,
  onAdvance
}: {
  order: Order;
  nextLabel: string | null;
  onAccept: (o: Order) => void;
  onReject: (o: Order) => void;
  onAdvance: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: order.id });
  return (
    <article ref={setNodeRef} {...listeners} {...attributes} style={{ opacity: isDragging ? 0.4 : 1, cursor: "grab" }}>
      <KanbanCardBody order={order} nextLabel={nextLabel} onAccept={() => onAccept(order)} onReject={() => onReject(order)} onAdvance={onAdvance} />
    </article>
  );
}

/** Pure visual card body, shared by the sortable card and the drag overlay clone. */
function KanbanCardBody({
  order: o,
  nextLabel,
  overlay,
  onAccept,
  onReject,
  onAdvance
}: {
  order: Order;
  nextLabel: string | null;
  overlay?: boolean;
  onAccept?: () => void;
  onReject?: () => void;
  onAdvance?: () => void;
}) {
  const { notify } = useDashboardState();
  const min = minutesSince(o.createdAt);
  const late = min >= ALERT_MINUTES;
  const mid = min >= ALERT_MINUTES * 0.55;
  const ref = o.mode === "table" ? `Mesa ${o.tableNumber}` : `Delivery ${o.code}`;
  const sub = o.mode === "table" ? (o.guestName ? `Cliente: ${o.guestName}` : "Comanda aberta") : o.addressId ? "Endereço salvo" : "";

  const style: CSSProperties = {
    background: "var(--surface)",
    border: `1px solid ${late ? "var(--alert)" : "var(--line)"}`,
    borderRadius: 15,
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 9,
    boxShadow: overlay ? "var(--shadow2)" : "0 1px 2px rgba(0,0,0,.18)",
    transform: overlay ? "scale(1.02)" : undefined,
    width: overlay ? 232 : undefined
  };

  return (
    <div style={style}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
        <i className={`fa-solid ${o.mode === "table" ? "fa-chair" : "fa-motorcycle"}`} style={{ fontSize: 19, lineHeight: 1, color: "var(--ink2)", marginTop: 1 }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5, letterSpacing: "-.01em" }}>{ref}</div>
          <div style={{ fontSize: 11.5, color: "var(--ink3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>
        </div>
        <span
          className="mono"
          style={{
            fontSize: 11,
            fontWeight: 600,
            borderRadius: 20,
            padding: "2px 7px",
            whiteSpace: "nowrap",
            background: late ? "color-mix(in srgb, var(--alert) 16%, transparent)" : mid ? "color-mix(in srgb, var(--warn) 18%, transparent)" : "var(--surface2)",
            color: late ? "var(--alert)" : mid ? "var(--warn)" : "var(--ink2)"
          }}
        >
          {min} min
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3, padding: "11px 0", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
        {o.lines.map((l) => (
          <div key={l.id} style={{ display: "flex", gap: 8, fontSize: 12.5, color: "var(--ink2)" }}>
            <span className="mono" style={{ color: "var(--ink)", fontWeight: 500 }}>
              {l.quantity}×
            </span>
            <span style={{ minWidth: 0, flex: 1 }}>{l.name}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div className="mono" style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-.02em" }}>
          {brl(o.total)}
        </div>
        <div style={{ flex: 1 }} />
        <button type="button" title="Chat do pedido" aria-label={`Abrir chat do pedido ${ref}`} className="icon-btn" onClick={() => notify(`Chat de ${ref} aberto`)}>
          <i className="fa-solid fa-comment" style={{ fontSize: 17, lineHeight: 1 }} />
        </button>
        <button type="button" title="Imprimir comanda" aria-label={`Imprimir comanda do pedido ${ref}`} className="icon-btn" onClick={() => notify(`Comanda de ${ref} enviada à impressora`)}>
          <i className="fa-solid fa-print" style={{ fontSize: 17, lineHeight: 1 }} />
        </button>
      </div>
      {o.status === "pending" ? (
        <div style={{ display: "flex", gap: 7 }}>
          <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={onAccept}>
            Aceitar
          </button>
          <button
            type="button"
            onClick={onReject}
            className="tap"
            style={{ background: "transparent", color: "var(--ink3)", border: "1px solid var(--line2)", borderRadius: 11, padding: "8px 12px", cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 500 }}
          >
            Recusar
          </button>
        </div>
      ) : nextLabel ? (
        <button
          type="button"
          onClick={onAdvance}
          className="tap"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            width: "100%",
            background: "var(--surface2)",
            color: "var(--ink)",
            border: "1px solid var(--line2)",
            borderRadius: 11,
            padding: 8,
            cursor: "pointer",
            font: "inherit",
            fontSize: 13,
            fontWeight: 600
          }}
        >
          {nextLabel}
          <i className="fa-solid fa-arrow-right" style={{ fontSize: 16, lineHeight: 1 }} />
        </button>
      ) : null}
    </div>
  );
}
