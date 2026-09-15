import { Outlet, useLocation, useOutletContext } from "react-router-dom";
import { moduleForPath } from "../lib/modules";
import { type LiveData, buildNotifs, useLiveData } from "../lib/live";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { Toast } from "./Toast";

export function useLive(): LiveData {
  return useOutletContext<LiveData>();
}

export function Layout() {
  const location = useLocation();
  const live = useLiveData();
  const { orders, calls, tickets } = live;

  const pendingCount = orders.filter((o) => o.status === "pending").length;
  const openCalls = calls.filter((c) => !c.resolvedAt);
  const unreadTicketCount = tickets.reduce((total, t) => total + t.unreadCount, 0);
  const current = moduleForPath(location.pathname);
  const notifs = buildNotifs(live);

  const badges: Record<string, number> = { pedidos: pendingCount, atendimento: unreadTicketCount };
  const ctx: LiveData = { ...live, calls: openCalls };

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
