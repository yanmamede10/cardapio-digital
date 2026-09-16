import { useCallback, useEffect, useState } from "react";
import type { Order, SupportTicket, WaiterCall } from "@cardapio/shared";
import { api } from "./api";
import { fmtMinutes, minutesSince } from "./format";

/**
 * Runs a request and falls back to a default value if it fails. The management
 * API is still being extended, so a single missing endpoint must never blank a
 * whole screen — every initial fetch goes through this.
 */
async function safe<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch {
    return fallback;
  }
}

/**
 * Shell-level live data. Orders, waiter calls and tickets drive the sidebar/tab
 * badges and the notification dropdown on both the desktop and mobile shells,
 * so they are polled once here and shared instead of being fetched twice.
 */
export interface LiveData {
  orders: Order[];
  calls: WaiterCall[];
  tickets: SupportTicket[];
  liveLoaded: boolean;
  refreshLive: () => void;
}

const POLL_MS = 15000;

export function useLiveData(): LiveData {
  const [orders, setOrders] = useState<Order[]>([]);
  const [calls, setCalls] = useState<WaiterCall[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [liveLoaded, setLiveLoaded] = useState(false);
  const [tick, setTick] = useState(0);

  const refreshLive = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [o, c, t] = await Promise.all([
        safe(() => api.listOrders(), [] as Order[]),
        safe(() => api.listWaiterCalls(), [] as WaiterCall[]),
        safe(() => api.listTickets(), [] as SupportTicket[])
      ]);
      if (!alive) return;
      setOrders(o);
      setCalls(c);
      setTickets(t);
      setLiveLoaded(true);
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [tick]);

  return { orders, calls, tickets, liveLoaded, refreshLive };
}

export interface NotifItem {
  icon: string;
  color: string;
  title: string;
  sub: string;
  time: string;
}

/** Turns shell-level live data into the notification-bell dropdown items, shared by both shells. */
export function buildNotifs(data: Pick<LiveData, "orders" | "calls" | "tickets">): NotifItem[] {
  const notifs: NotifItem[] = [];
  const pendingCount = data.orders.filter((o) => o.status === "pending").length;
  const openCalls = data.calls.filter((c) => !c.resolvedAt);
  const unreadTicketCount = data.tickets.reduce((total, t) => total + t.unreadCount, 0);

  if (pendingCount > 0) {
    notifs.push({
      icon: "fa-receipt",
      color: "var(--brandText)",
      title: `${pendingCount} ${pendingCount === 1 ? "novo pedido aguardando" : "novos pedidos aguardando"}`,
      sub: "Aceite na Central de Pedidos",
      time: "agora"
    });
  }
  if (openCalls.length > 0) {
    const oldest = openCalls.reduce((a, b) => (minutesSince(a.createdAt) > minutesSince(b.createdAt) ? a : b));
    notifs.push({
      icon: "fa-bell-concierge",
      color: "var(--alert)",
      title: `${openCalls.length} ${openCalls.length === 1 ? "chamado de garçom" : "chamados de garçom"}`,
      sub: `Mesa ${oldest.tableNumber} espera há ${fmtMinutes(minutesSince(oldest.createdAt))}`,
      time: fmtMinutes(minutesSince(oldest.createdAt))
    });
  }
  if (unreadTicketCount > 0) {
    notifs.push({
      icon: "fa-comment-dots",
      color: "var(--sec)",
      title: `${unreadTicketCount} ${unreadTicketCount === 1 ? "mensagem não lida" : "mensagens não lidas"}`,
      sub: "Responda em Atendimento",
      time: "agora"
    });
  }
  return notifs;
}
