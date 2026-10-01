import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate, useOutletContext } from "react-router-dom";
import { App } from "@capacitor/app";
import { type LiveData, buildNotifs, useLiveData } from "../../lib/live";
import { initialsOf } from "../../lib/format";
import { canSee, moduleByKey } from "../../lib/modules";
import { useDashboardState } from "../../state/DashboardStateContext";
import { Toast } from "../Toast";

export interface MobileFabConfig {
  label: string;
  onClick: () => void;
}

export interface MobileHeaderConfig {
  title: string;
  subtitle: string;
  hideTabs?: boolean;
  fab?: MobileFabConfig;
}

export interface MobileOutletContext extends LiveData {
  notify: (message: string) => void;
  setHeader: (config: MobileHeaderConfig | null) => void;
}

function headerEqual(a: MobileHeaderConfig | null, b: MobileHeaderConfig | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.title === b.title && a.subtitle === b.subtitle && !!a.hideTabs === !!b.hideTabs && (a.fab?.label || "") === (b.fab?.label || "");
}

/** Screens call this once to publish their header/tab-bar/FAB config to MobileLayout. */
export function useMobileScreen(config: MobileHeaderConfig): MobileOutletContext {
  const ctx = useOutletContext<MobileOutletContext>();
  const { setHeader } = ctx;
  useEffect(() => {
    setHeader(config);
  });
  useEffect(() => () => setHeader(null), [setHeader]);
  return ctx;
}

const ROOT_PATHS = ["/", "/mesas", "/cardapio", "/mais"];

const TABS: { key: string; path: string; label: string; icon: string }[] = [
  { key: "pedidos", path: "/", label: "Pedidos", icon: "fa-receipt" },
  { key: "mesas", path: "/mesas", label: "Mesas", icon: "fa-chair" },
  { key: "cardapio", path: "/cardapio", label: "Cardápio", icon: "fa-utensils" },
  { key: "mais", path: "/mais", label: "Mais", icon: "fa-ellipsis" }
];

function tabForPath(pathname: string): string {
  if (pathname === "/") return "pedidos";
  if (pathname.startsWith("/mesas")) return "mesas";
  if (pathname.startsWith("/cardapio")) return "cardapio";
  return "mais";
}

export function MobileLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { staffName, staffRole, notify } = useDashboardState();
  const live = useLiveData();
  const [header, setHeaderState] = useState<MobileHeaderConfig | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);

  const setHeader = useCallback((next: MobileHeaderConfig | null) => setHeaderState((prev) => (headerEqual(prev, next) ? prev : next)), []);

  useEffect(() => {
    setNotifOpen(false);
  }, [location.pathname]);

  const pendingCount = live.orders.filter((o) => o.status === "pending").length;
  const openCalls = live.calls.filter((c) => !c.resolvedAt);
  const unreadTicketCount = live.tickets.reduce((total, t) => total + t.unreadCount, 0);
  const notifCount = pendingCount + openCalls.length + unreadTicketCount;
  const notifs = buildNotifs(live).map((n) => ({
    ...n,
    go: () => {
      setNotifOpen(false);
      navigate(n.icon === "fa-comment-dots" ? "/atendimento" : "/");
    }
  }));

  const isRoot = ROOT_PATHS.includes(location.pathname);
  const activeTab = tabForPath(location.pathname);
  const showTabs = !header?.hideTabs;

  // React Router's client-side history isn't reliably followed by Capacitor's
  // default WebView back-button handling on Android, so drive it ourselves:
  // pop one route on a drill-down screen, exit the app from a root tab.
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const isRootRef = useRef(isRoot);
  isRootRef.current = isRoot;
  useEffect(() => {
    const listener = App.addListener("backButton", () => {
      if (isRootRef.current) App.exitApp();
      else navigateRef.current(-1);
    });
    return () => {
      listener.then((h) => h.remove());
    };
  }, []);

  const ctx: MobileOutletContext = { ...live, calls: openCalls, notify, setHeader };

  return (
    // Exactly the screen: only <main> scrolls, so the tab bar and the screens' sticky bars stay put (with minHeight the page
    // grew with the content and the tabs ended up below a long list).
    <div style={{ height: "100dvh", width: "100%", display: "flex", flexDirection: "column", background: "var(--bg)", color: "var(--ink)" }}>
      <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <header
          style={{
            flex: "0 0 auto",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "calc(9px + env(safe-area-inset-top, 0px)) 14px 9px",
            background: "var(--surface)",
            borderBottom: "1px solid var(--line)",
            position: "sticky",
            top: 0,
            zIndex: 6
          }}
        >
          {isRoot ? (
            <div
              style={{
                width: 38,
                height: 38,
                flex: "0 0 38px",
                borderRadius: 11,
                background: "var(--brand)",
                color: "var(--brandInk)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'IBM Plex Mono', monospace",
                fontWeight: 600,
                fontSize: 14
              }}
            >
              MP
            </div>
          ) : (
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label="Voltar"
              style={{ width: 44, height: 44, flex: "0 0 44px", borderRadius: 11, background: "var(--surface2)", border: "1px solid var(--line)", color: "var(--ink)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <i className="fa-solid fa-chevron-left" style={{ fontSize: 16 }} />
            </button>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-.015em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{header?.title ?? ""}</div>
            <div style={{ fontSize: 11.5, color: "var(--ink3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{header?.subtitle ?? ""}</div>
          </div>
          <button
            type="button"
            onClick={() => setNotifOpen((v) => !v)}
            aria-label={notifCount ? `Notificações: ${notifCount} novas` : "Notificações"}
            aria-expanded={notifOpen}
            style={{ position: "relative", width: 44, height: 44, flex: "0 0 44px", borderRadius: 11, background: "var(--surface2)", border: "1px solid var(--line)", color: "var(--ink2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <i className="fa-solid fa-bell" style={{ fontSize: 16 }} />
            {notifCount > 0 && (
              <span
                className="mono"
                style={{
                  position: "absolute",
                  top: -5,
                  right: -5,
                  minWidth: 18,
                  height: 18,
                  borderRadius: 20,
                  background: "var(--brand)",
                  color: "var(--brandInk)",
                  fontSize: 10,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 4px",
                  border: "2px solid var(--surface)"
                }}
              >
                {notifCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => navigate("/config/perfil")}
            title={staffRole}
            aria-label={`Minha conta: ${staffName}, ${staffRole}`}
            style={{ width: 44, height: 44, flex: "0 0 44px", borderRadius: "50%", background: "var(--brandSoft)", border: "1px solid var(--line2)", color: "var(--brandText)", cursor: "pointer", font: "inherit", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            {initialsOf(staffName)}
          </button>

          {notifOpen && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                right: 12,
                left: 12,
                marginTop: 8,
                zIndex: 20,
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: 14,
                boxShadow: "0 20px 44px rgba(0,0,0,.28)",
                overflow: "hidden"
              }}
            >
              <div style={{ padding: "11px 14px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>Notificações</div>
                <button type="button" aria-label="Fechar notificações" onClick={() => setNotifOpen(false)} style={{ background: "transparent", border: 0, color: "var(--ink3)", cursor: "pointer", fontSize: 14 }}>
                  <i className="fa-solid fa-xmark" aria-hidden="true" />
                </button>
              </div>
              {notifs.length === 0 && <div style={{ padding: "16px 14px", fontSize: 12.5, color: "var(--ink3)" }}>Nenhuma notificação agora.</div>}
              {notifs.map((n, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={n.go}
                  style={{ display: "flex", gap: 11, width: "100%", textAlign: "left", padding: "11px 14px", border: 0, borderBottom: "1px solid var(--line)", background: "transparent", color: "var(--ink)", cursor: "pointer", font: "inherit" }}
                >
                  <i className={`fa-solid ${n.icon}`} style={{ fontSize: 15, color: n.color, marginTop: 2 }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>{n.title}</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink3)" }}>{n.sub}</div>
                  </div>
                  <div className="mono" style={{ fontSize: 10.5, color: "var(--ink3)" }}>
                    {n.time}
                  </div>
                </button>
              ))}
            </div>
          )}
        </header>

        {/* The one scroller of the phone shell: focusable, so the keyboard can scroll screens with nothing to focus (UX-03). */}
        <main tabIndex={0} style={{ flex: 1, minHeight: 0, overflowY: "auto", background: "var(--bg)" }}>
          <Outlet context={ctx} />
        </main>

        {header?.fab && (
          <button
            type="button"
            onClick={header.fab.onClick}
            title={header.fab.label}
            aria-label={header.fab.label}
            style={{
              position: "fixed",
              right: 16,
              bottom: "calc(78px + env(safe-area-inset-bottom, 0px))",
              width: 58,
              height: 58,
              borderRadius: "50%",
              background: "var(--brand)",
              color: "var(--brandInk)",
              border: 0,
              cursor: "pointer",
              boxShadow: "0 12px 24px rgba(0,0,0,.28)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 12
            }}
          >
            <i className="fa-solid fa-plus" style={{ fontSize: 21 }} />
          </button>
        )}
      </div>

      {showTabs && (
        <nav
          style={{
            flex: "0 0 auto",
            background: "var(--surface)",
            borderTop: "1px solid var(--line)",
            display: "flex",
            padding: "6px 6px calc(14px + env(safe-area-inset-bottom, 0px))"
          }}
        >
          {TABS.filter((t) => t.key === "mais" || canSee(moduleByKey(t.key))).map((t) => {
            const active = activeTab === t.key;
            const badge = t.key === "pedidos" && pendingCount > 0 ? String(pendingCount) : null;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => navigate(t.path)}
                style={{
                  flex: 1,
                  minHeight: 56,
                  background: "transparent",
                  border: 0,
                  cursor: "pointer",
                  font: "inherit",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  color: active ? "var(--brandText)" : "var(--ink3)",
                  position: "relative"
                }}
              >
                <i className={`fa-solid ${t.icon}`} style={{ fontSize: 19 }} />
                <span style={{ fontSize: 10.5, fontWeight: 600 }}>{t.label}</span>
                {badge && (
                  <span
                    className="mono"
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 22,
                      minWidth: 17,
                      height: 17,
                      borderRadius: 20,
                      background: "var(--alert)",
                      color: "#fff",
                      fontSize: 9.5,
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "0 5px"
                    }}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      )}
      <Toast />
    </div>
  );
}
