import { useIsMobile } from "./lib/useIsMobile";
import DesktopApp from "./DesktopApp";
import MobileApp from "./MobileApp";

export default function App() {
  return useIsMobile() ? <MobileApp /> : <DesktopApp />;
}
