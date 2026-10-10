import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate, useNavigationType, useOutletContext } from "react-router-dom";
import { PLATFORM_NAME } from "@cardapio/shared";
import { App } from "@capacitor/app";
import { back } from "../../lib/back";
import { type LiveData, buildNotifs, useLiveData } from "../../lib/live";
import { api } from "../../lib/api";
import { initialsOf } from "../../lib/format";
import { canSee, moduleByKey } from "../../lib/modules";
import { useDashboardState } from "../../state/DashboardStateContext";
import { Toast } from "../Toast";
import { Logo } from "../Logo";

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

export function MobileLayout({ notFound }: { notFound: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { staffName, staffRole, notify } = useDashboardState();
  const live = useLiveData();
  const [header, setHeaderState] = useState<MobileHeaderConfig | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [restaurantName, setRestaurantName] = useState("");
  // UI-01 · 17 (page-side-by-side): a new screen comes in from the right, going back from the left (base.css .page-fwd/-back).
  const navType = useNavigationType();
  const mainRef = useRef<HTMLElement>(null);
  const firstPage = useRef(true);
  useLayoutEffect(() => {
    const main = mainRef.current;
    if (firstPage.current || !main) return void (firstPage.current = false);
    main.classList.remove("page-fwd", "page-back");
    void main.offsetWidth; // restart the animation
    main.classList.add(navType === "POP" ? "page-back" : "page-fwd");
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    api.getRestaurant().then((r) => setRestaurantName(r.name)).catch(() => {});
  }, []);
  // UX-05: an address the router doesn't know has no screen to name itself: the header says so.
  const screen = notFound ? "Página não encontrada" : header?.title ?? "";
  const subtitle = notFound ? restaurantName : header?.subtitle ?? "";
  // Checklist 5: the tab (and the Android task switcher) says which screen, which restaurant and the platform.
  useEffect(() => {
    if (screen) document.title = [screen, restaurantName, PLATFORM_NAME].filter(Boolean).join(" · ");
  }, [screen, restaurantName]);

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
  const activeTab = notFound ? null : tabForPath(location.pathname); // a 404 is no tab's — tabForPath would say "mais"
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
      if (back()) return; // an open sheet or box (or a form screen with changes) handles it first (UX-08)
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
            <Link to="/" aria-label={`${PLATFORM_NAME}: início`} style={{ width: 44, height: 44, flex: "0 0 44px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Logo size={36} />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => back() || navigate(-1)}
              aria-label="Voltar"
              className="icon-btn"
              style={{ flex: "0 0 44px", color: "var(--brandText)" }}
            >
              <i className="fa-solid fa-chevron-left" style={{ fontSize: "var(--icon-sm)" }} />
            </button>
          )}
          {/* UI-01 · 14: the screen's name is the title, in title2. */}
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: "var(--text-title2)", fontWeight: 600, letterSpacing: "-.015em", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{screen}</h1>
            <div style={{ fontSize: "var(--text-footnote)", color: "var(--ink3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{subtitle}</div>
          </div>
          <button
            type="button"
            onClick={() => setNotifOpen((v) => !v)}
            aria-label={notifCount ? `Notificações: ${notifCount} novas` : "Notificações"}
            aria-expanded={notifOpen}
            className="icon-btn"
            style={{ position: "relative", flex: "0 0 44px" }}
          >
            <i className="fa-solid fa-bell" style={{ fontSize: "var(--icon-sm)" }} />
            {notifCount > 0 && (
              <span
                key={notifCount}
                aria-hidden="true"
                className="mono badge-pop"
                style={{
                  position: "absolute",
                  top: -5,
                  right: -5,
                  minWidth: 18,
                  height: 18,
                  borderRadius: 20,
                  background: "var(--brand)",
                  color: "var(--brandInk)",
                  fontSize: "var(--text-caption)",
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
            aria-label={`Minha conta: ${staffName}, ${staffRole}`}
            style={{ width: 44, height: 44, flex: "0 0 44px", borderRadius: "50%", background: "var(--brandSoft)", border: "1px solid var(--line2)", color: "var(--brandText)", cursor: "pointer", font: "inherit", fontSize: "var(--text-footnote)", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            {initialsOf(staffName)}
          </button>

          {notifOpen && (
            <div
              className="glass menu-pop"
              style={{
                position: "absolute",
                top: "100%",
                right: 12,
                left: 12,
                marginTop: 8,
                zIndex: 20,
                border: "1px solid var(--glassBd)",
                borderRadius: 14,
                boxShadow: "0 20px 44px rgba(0,0,0,.28)",
                overflow: "hidden"
              }}
            >
              <div style={{ padding: "11px 14px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontWeight: 600, fontSize: "var(--text-subheadline)", flex: 1 }}>Notificações</div>
                <button type="button" aria-label="Fechar notificações" onClick={() => setNotifOpen(false)} style={{ background: "transparent", border: 0, color: "var(--ink3)", cursor: "pointer", fontSize: "var(--text-body)" }}>
                  <i className="fa-solid fa-xmark" aria-hidden="true" />
                </button>
              </div>
              {notifs.length === 0 && <div style={{ padding: "16px 14px", fontSize: "var(--text-subheadline)", color: "var(--ink3)" }}>Nenhuma notificação agora.</div>}
              {notifs.map((n, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={n.go}
                  style={{ display: "flex", gap: 11, width: "100%", textAlign: "left", padding: "11px 14px", border: 0, borderBottom: "1px solid var(--line)", background: "transparent", color: "var(--ink)", cursor: "pointer", font: "inherit" }}
                >
                  <i className={`fa-solid ${n.icon}`} style={{ fontSize: "var(--icon-sm)", color: n.color, marginTop: 2 }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: "var(--text-subheadline)", fontWeight: 600 }}>{n.title}</div>
                    <div style={{ fontSize: "var(--text-footnote)", color: "var(--ink3)" }}>{n.sub}</div>
                  </div>
                  <div className="mono" style={{ fontSize: "var(--text-caption)", color: "var(--ink3)" }}>
                    {n.time}
                  </div>
                </button>
              ))}
            </div>
          )}
        </header>

        {/* The one scroller of the phone shell: focusable, so the keyboard can scroll screens with nothing to focus (UX-03). */}
        <main ref={mainRef} tabIndex={0} style={{ flex: 1, minHeight: 0, overflowY: "auto", background: "var(--bg)" }}>
          <Outlet context={ctx} />
        </main>

        {header?.fab && (
          <button
            type="button"
            onClick={header.fab.onClick}
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
            <i className="fa-solid fa-plus" style={{ fontSize: "var(--icon-md)" }} />
          </button>
        )}
      </div>

      {showTabs && (
        <nav
          className="glass"
          style={{
            flex: "0 0 auto",
            borderTop: "1px solid var(--glassBd)",
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
                aria-current={active ? "page" : undefined}
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
                <i className={`fa-solid ${t.icon}`} style={{ fontSize: "var(--icon-md)" }} />
                <span style={{ fontSize: "var(--text-caption)", fontWeight: 600 }}>{t.label}</span>
                {badge && (
                  <span
                    key={badge}
                    className="mono badge-pop"
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 22,
                      minWidth: 17,
                      height: 17,
                      borderRadius: 20,
                      background: "var(--alert)",
                      color: "var(--alertInk)",
                      fontSize: "var(--text-caption)",
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
