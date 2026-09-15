import { useCallback, useEffect, useState } from "react";
import { Outlet, useLocation, useOutletContext } from "react-router-dom";
import type { Order, SupportTicket, WaiterCall } from "@cardapio/shared";
import { api } from "../lib/api";
import { moduleForPath } from "../lib/modules";
import { fmtMinutes, minutesSince } from "../lib/format";
import { safe } from "../lib/live";
import { Sidebar } from "./Sidebar";
import { Header, type NotifItem } from "./Header";
import { Toast } from "./Toast";

/**
 * Shell-level live data. Orders, waiter calls and tickets drive the sidebar
 * badges and the notification dropdown, so they are polled once here and shared
 * with the screens through the router outlet instead of being fetched twice.
 */
export interface LiveData {
  orders: Order[];
  calls: WaiterCall[];
  tickets: SupportTicket[];
  liveLoaded: boolean;
  refreshLive: () => void;
}

export function useLive(): LiveData {
  return useOutletContext<LiveData>();
}

const POLL_MS = 15000;

export function Layout() {
  const location = useLocation();
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

  const pendingCount = orders.filter((o) => o.status === "pending").length;
  const openCalls = calls.filter((c) => !c.resolvedAt);
  const unreadTicketCount = tickets.reduce((total, t) => total + t.unreadCount, 0);
  const current = moduleForPath(location.pathname);

  const notifs: NotifItem[] = [];
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

  const badges: Record<string, number> = { pedidos: pendingCount, atendimento: unreadTicketCount };
  const ctx: LiveData = { orders, calls: openCalls, tickets, liveLoaded, refreshLive };

  return (
    <div style={{ display: "flex", minHeight: "100vh", width: "100%", background: "var(--bg)", color: "var(--ink)" }}>
      <Sidebar badges={badges} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <Header tagline={current.tagline} notifs={notifs} />
        <main style={{ flex: 1, minWidth: 0, padding: "20px 22px 28px" }}>
          <Outlet context={ctx} />
        </main>
      </div>
      <Toast />
    </div>
  );
}
