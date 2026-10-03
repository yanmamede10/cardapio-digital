import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Layout } from "./components/Layout";
import { EmptyState } from "./components/EmptyState";
import OrdersScreen from "./screens/OrdersScreen";
import MenuScreen from "./screens/MenuScreen";
import TablesScreen from "./screens/TablesScreen";
import TablesQrScreen from "./screens/TablesQrScreen";
import PromotionsScreen from "./screens/PromotionsScreen";
import SupportScreen from "./screens/SupportScreen";
import ReportsScreen from "./screens/ReportsScreen";
import FinanceScreen from "./screens/FinanceScreen";
import SettingsScreen from "./screens/SettingsScreen";
import ProductsScreen from "./screens/ProductsScreen";
import AccountsScreen from "./screens/AccountsScreen";
import FiscalScreen from "./screens/FiscalScreen";
import FinanceOverviewScreen from "./screens/FinanceOverviewScreen";
import LaunchOrderScreen from "./screens/LaunchOrderScreen";
import { homePath, knownPath } from "./lib/modules";

/** The desktop's screens: the router's list, and what knownPath checks an address against (UX-05). */
export const desktopScreens = () => (
  <>
    <Route path="/" element={homePath() === "/" ? <OrdersScreen /> : <Navigate to={homePath()} replace />} />
    <Route path="/pedidos" element={<Navigate to="/" replace />} />
    <Route path="/cardapio" element={<MenuScreen />} />
    <Route path="/mesas" element={<TablesScreen />} />
    <Route path="/mesas/qr" element={<TablesQrScreen />} />
    <Route path="/mesas/:number/pedido" element={<LaunchOrderScreen />} />
    <Route path="/promocoes" element={<PromotionsScreen />} />
    <Route path="/atendimento" element={<SupportScreen />} />
    <Route path="/relatorios" element={<ReportsScreen />} />
    <Route path="/financeiro" element={<FinanceScreen />} />
    <Route path="/produtos" element={<ProductsScreen />} />
    <Route path="/visao-geral" element={<FinanceOverviewScreen />} />
    <Route path="/contas-a-pagar" element={<AccountsScreen key="payable" kind="payable" />} />
    <Route path="/contas-a-receber" element={<AccountsScreen key="receivable" kind="receivable" />} />
    <Route path="/emissao-fiscal" element={<FiscalScreen />} />
    <Route path="/config" element={<SettingsScreen />} />
    <Route path="/configuracoes" element={<Navigate to="/config" replace />} />
  </>
);

export default function DesktopApp() {
  const { pathname } = useLocation();
  const screens = desktopScreens();
  return (
    <Routes>
      <Route element={<Layout notFound={!knownPath(screens, pathname)} />}>
        {screens}
        {/* UX-05: an unknown address says so, inside the dashboard, instead of jumping to the start. */}
        <Route
          path="*"
          element={
            <EmptyState
              icon="fa-link-slash"
              title="Esta página não existe"
              sub="O endereço pode ter sido digitado errado ou a página mudou de lugar."
              action={
                <Link to={homePath()} className="btn btn-primary">
                  Voltar ao início
                </Link>
              }
            />
          }
        />
      </Route>
    </Routes>
  );
}
