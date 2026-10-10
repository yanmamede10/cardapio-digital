import { useEffect, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { PLATFORM_NAME } from "@cardapio/shared";
import { useIsMobile } from "./lib/useIsMobile";
import { SESSION_ENDED, getSession, refreshSession } from "./lib/api";
import { homePath, knownPath, routeAllowed } from "./lib/modules";
import DesktopApp, { desktopScreens } from "./DesktopApp";
import MobileApp, { mobileScreens } from "./MobileApp";
import LoginScreen, { ChangePasswordScreen } from "./screens/LoginScreen";
import AdminScreen from "./screens/AdminScreen";

export default function App() {
  const isMobile = useIsMobile();
  const [loggedIn, setLoggedIn] = useState(() => getSession() !== null);
  const [ready, setReady] = useState(false);
  const [, passwordChanged] = useState(0);
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith("/admin");
  // UX-05: logged out, an address the router doesn't know (the same screen lists it routes with) gets the 404 card, not the
  // login. Each app also takes the other's addresses (U-4, U-5), so known = in either list.
  const known = knownPath(mobileScreens(), pathname) || knownPath(desktopScreens(), pathname);
  const lost = !loggedIn && !isAdmin && !known;
  useEffect(() => {
    if (lost) document.title = `Página não encontrada · ${PLATFORM_NAME}`;
  }, [lost]);

  // Without this, an expired token left the screens polling in silence: the Central went empty instead of asking to log in.
  useEffect(() => {
    const ended = () => setLoggedIn(false);
    window.addEventListener(SESSION_ENDED, ended);
    return () => window.removeEventListener(SESSION_ENDED, ended);
  }, []);

  // Role and contracted modules may have changed since the session was stored: re-read them before drawing the menu.
  // A 401 clears the session (back to login); a network error keeps the stored one.
  useEffect(() => {
    if (!loggedIn || isAdmin) return;
    setReady(false);
    refreshSession()
      .catch(() => {})
      .finally(() => {
        setLoggedIn(getSession() !== null);
        setReady(true);
      });
  }, [loggedIn, isAdmin]);

  // Platform super admin: its own key, independent of any staff session.
  if (isAdmin) return <AdminScreen />;

  if (lost) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "var(--bg)", fontFamily: "var(--font)" }}>
        <main className="card" style={{ width: 340, maxWidth: "100%", padding: 28, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "var(--surface2)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink3)" }}>
            <i className="fa-solid fa-link-slash" style={{ fontSize: "var(--icon-lg)", lineHeight: 1 }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: "var(--text-title2)", fontWeight: 600, letterSpacing: "-.015em", color: "var(--ink)" }}>Esta página não existe</h1>
            <p style={{ margin: "6px 0 0", fontSize: "var(--text-body)", color: "var(--ink2)" }}>O endereço pode ter sido digitado errado. Entre com sua conta para abrir o painel.</p>
          </div>
          <Link to="/" className="btn btn-primary" style={{ width: "100%", marginTop: 6, borderRadius: 10, padding: "11px 0", fontSize: "var(--text-headline)" }}>
            Entrar
          </Link>
        </main>
      </div>
    );
  }
  if (!loggedIn) {
    return <LoginScreen onLoggedIn={() => setLoggedIn(true)} />;
  }
  if (!ready) return null;
  if (getSession()?.mustChangePassword) return <ChangePasswordScreen onDone={() => passwordChanged((n) => n + 1)} />;
  // G-3: the one route guard, for both apps: a typed address of a screen the menu doesn't offer this role (or this plan)
  // goes to the role's start. The API still refuses the data either way.
  if (!routeAllowed(pathname)) return <Navigate to={homePath()} replace />;
  return isMobile ? <MobileApp /> : <DesktopApp />;
}
