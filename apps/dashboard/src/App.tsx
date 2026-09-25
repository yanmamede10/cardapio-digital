import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useIsMobile } from "./lib/useIsMobile";
import { getSession } from "./lib/api";
import DesktopApp from "./DesktopApp";
import MobileApp from "./MobileApp";
import LoginScreen from "./screens/LoginScreen";
import AdminScreen from "./screens/AdminScreen";

export default function App() {
  const isMobile = useIsMobile();
  const [loggedIn, setLoggedIn] = useState(() => getSession() !== null);
  const isAdmin = useLocation().pathname.startsWith("/admin");

  // Platform super admin: its own key, independent of any staff session.
  if (isAdmin) return <AdminScreen />;

  if (!loggedIn) {
    return <LoginScreen onLoggedIn={() => setLoggedIn(true)} />;
  }
  return isMobile ? <MobileApp /> : <DesktopApp />;
}
