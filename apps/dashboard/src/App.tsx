import { useState } from "react";
import { useIsMobile } from "./lib/useIsMobile";
import { getSession } from "./lib/api";
import DesktopApp from "./DesktopApp";
import MobileApp from "./MobileApp";
import LoginScreen from "./screens/LoginScreen";

export default function App() {
  const isMobile = useIsMobile();
  const [loggedIn, setLoggedIn] = useState(() => getSession() !== null);

  if (!loggedIn) {
    return <LoginScreen onLoggedIn={() => setLoggedIn(true)} />;
  }
  return isMobile ? <MobileApp /> : <DesktopApp />;
}
