import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import OrdersScreen from "./screens/OrdersScreen";
import MenuScreen from "./screens/MenuScreen";
import TablesScreen from "./screens/TablesScreen";
import PromotionsScreen from "./screens/PromotionsScreen";
import SupportScreen from "./screens/SupportScreen";
import ReportsScreen from "./screens/ReportsScreen";
import FinanceScreen from "./screens/FinanceScreen";
import SettingsScreen from "./screens/SettingsScreen";
import ProductsScreen from "./screens/ProductsScreen";
import AccountsScreen from "./screens/AccountsScreen";
import FiscalScreen from "./screens/FiscalScreen";
import FinanceOverviewScreen from "./screens/FinanceOverviewScreen";
import { homePath } from "./lib/modules";

export default function DesktopApp() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={homePath() === "/" ? <OrdersScreen /> : <Navigate to={homePath()} replace />} />
        <Route path="/pedidos" element={<Navigate to="/" replace />} />
        <Route path="/cardapio" element={<MenuScreen />} />
        <Route path="/mesas" element={<TablesScreen />} />
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
