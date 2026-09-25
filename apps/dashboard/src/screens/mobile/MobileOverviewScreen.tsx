import { useMobileScreen } from "../../components/mobile/MobileLayout";
import FinanceOverviewScreen from "../FinanceOverviewScreen";

/** Visão Geral is already responsive — the mobile shell just gives it a header and gutter. */
export default function MobileOverviewScreen() {
  useMobileScreen({ title: "Visão geral", subtitle: "Financeiro" });
  return (
    <div style={{ padding: 12 }}>
      <FinanceOverviewScreen />
    </div>
  );
}
