import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useIsMobile } from "./lib/useIsMobile";
import { getSession, refreshSession } from "./lib/api";
import DesktopApp from "./DesktopApp";
import MobileApp from "./MobileApp";
import LoginScreen, { ChangePasswordScreen } from "./screens/LoginScreen";
import AdminScreen from "./screens/AdminScreen";

export default function App() {
  const isMobile = useIsMobile();
  const [loggedIn, setLoggedIn] = useState(() => getSession() !== null);
  const [ready, setReady] = useState(false);
  const [, passwordChanged] = useState(0);
  const isAdmin = useLocation().pathname.startsWith("/admin");

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

  if (!loggedIn) {
    return <LoginScreen onLoggedIn={() => setLoggedIn(true)} />;
  }
  if (!ready) return null;
  if (getSession()?.mustChangePassword) return <ChangePasswordScreen onDone={() => passwordChanged((n) => n + 1)} />;
  return isMobile ? <MobileApp /> : <DesktopApp />;
}
