import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { MobileLayout } from "./components/mobile/MobileLayout";
import { MobileEmptyState } from "./components/mobile/MobileEmptyState";
import MobileOrdersScreen from "./screens/mobile/MobileOrdersScreen";
import MobileTablesScreen from "./screens/mobile/MobileTablesScreen";
import MobileTableDetailScreen from "./screens/mobile/MobileTableDetailScreen";
import { MobileTablesQrScreen } from "./screens/TablesQrScreen";
import MobileMenuScreen from "./screens/mobile/MobileMenuScreen";
import MobileProductFormScreen from "./screens/mobile/MobileProductFormScreen";
import MobileMoreScreen from "./screens/mobile/MobileMoreScreen";
import MobileSupportScreen from "./screens/mobile/MobileSupportScreen";
import MobileChatScreen from "./screens/mobile/MobileChatScreen";
import MobilePromotionsScreen from "./screens/mobile/MobilePromotionsScreen";
import MobileCouponFormScreen from "./screens/mobile/MobileCouponFormScreen";
import MobileReportsScreen from "./screens/mobile/MobileReportsScreen";
import MobileFinanceScreen from "./screens/mobile/MobileFinanceScreen";
import MobileSettingsScreen from "./screens/mobile/MobileSettingsScreen";
import MobileProfileScreen from "./screens/mobile/MobileProfileScreen";
import MobileHoursScreen from "./screens/mobile/MobileHoursScreen";
import MobileTeamScreen from "./screens/mobile/MobileTeamScreen";
import MobileFiscalScreen from "./screens/mobile/MobileFiscalScreen";
import MobileProductsScreen from "./screens/mobile/MobileProductsScreen";
import MobileOverviewScreen from "./screens/mobile/MobileOverviewScreen";
import MobileAccountsScreen from "./screens/mobile/MobileAccountsScreen";
import MobileFiscalEmissionScreen from "./screens/mobile/MobileFiscalEmissionScreen";
import { MobileWhatsAppScreen } from "./screens/SettingsWhatsAppTab";
import { MobileLaunchOrderScreen } from "./screens/LaunchOrderScreen";
import { MobileSalonScreen } from "./screens/SettingsSalonTab";
import { homePath, knownPath } from "./lib/modules";

/** The phone's screens: the router's list, and what knownPath checks an address against (UX-05). */
export const mobileScreens = () => (
  <>
    <Route path="/" element={homePath() === "/" ? <MobileOrdersScreen /> : <Navigate to={homePath()} replace />} />
    <Route path="/mesas" element={<MobileTablesScreen />} />
    <Route path="/mesas/qr" element={<MobileTablesQrScreen />} />
    <Route path="/mesas/:number" element={<MobileTableDetailScreen />} />
    <Route path="/mesas/:number/pedido" element={<MobileLaunchOrderScreen />} />
    <Route path="/cardapio" element={<MobileMenuScreen />} />
    <Route path="/cardapio/:id/editar" element={<MobileProductFormScreen />} />
    <Route path="/mais" element={<MobileMoreScreen />} />
    <Route path="/atendimento" element={<MobileSupportScreen />} />
    <Route path="/atendimento/:id" element={<MobileChatScreen />} />
    <Route path="/promocoes" element={<MobilePromotionsScreen />} />
    <Route path="/promocoes/novo" element={<MobileCouponFormScreen />} />
    <Route path="/relatorios" element={<MobileReportsScreen />} />
    <Route path="/financeiro" element={<MobileFinanceScreen />} />
    <Route path="/produtos" element={<MobileProductsScreen />} />
    <Route path="/visao-geral" element={<MobileOverviewScreen />} />
    <Route path="/contas-a-pagar" element={<MobileAccountsScreen key="payable" kind="payable" />} />
    <Route path="/contas-a-receber" element={<MobileAccountsScreen key="receivable" kind="receivable" />} />
    <Route path="/emissao-fiscal" element={<MobileFiscalEmissionScreen />} />
    <Route path="/config" element={<MobileSettingsScreen />} />
    <Route path="/config/perfil" element={<MobileProfileScreen />} />
    <Route path="/config/horarios" element={<MobileHoursScreen />} />
    <Route path="/config/equipe" element={<MobileTeamScreen />} />
    <Route path="/config/fiscal" element={<MobileFiscalScreen />} />
    <Route path="/config/whatsapp" element={<MobileWhatsAppScreen />} />
    <Route path="/config/salao" element={<MobileSalonScreen />} />
  </>
);

export default function MobileApp() {
  const { pathname } = useLocation();
  const screens = mobileScreens();
  return (
    <Routes>
      <Route element={<MobileLayout notFound={!knownPath(screens, pathname)} />}>
        {screens}
        {/* UX-05: an unknown address says so, inside the dashboard, instead of jumping to the start. */}
        <Route
          path="*"
          element={
            <MobileEmptyState
              icon="fa-link-slash"
              title="Esta página não existe"
              sub="O endereço pode ter sido digitado errado ou a página mudou de lugar."
              action={
                <Link to={homePath()} className="btn btn-primary" style={{ marginTop: 6, padding: "11px 20px", fontSize: 14 }}>
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
