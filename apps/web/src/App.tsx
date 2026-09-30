import type { ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useApp } from "./context/AppContext";
import CartScreen from "./screens/CartScreen";
import CheckoutScreen from "./screens/CheckoutScreen";
import DiscoveryScreen from "./screens/DiscoveryScreen";
import HistoryScreen from "./screens/HistoryScreen";
import ItemDetailScreen from "./screens/ItemDetailScreen";
import MenuScreen from "./screens/MenuScreen";
import OrderStatusScreen from "./screens/OrderStatusScreen";
import ReviewScreen from "./screens/ReviewScreen";
import TableEntryScreen from "./screens/TableEntryScreen";
import { Toast } from "./components/Toast";

/** Opened from a table's QR (or its tablet), the app is that table's menu: the delivery screens (restaurant list, delivery
 *  history) send back to it. */
function NotAtATable({ children }: { children: ReactElement }) {
  const { mode, restaurantId } = useApp();
  return mode === "table" && restaurantId ? <Navigate to={`/r/${restaurantId}/menu`} replace /> : children;
}

export default function App() {
  return (
    // One Toast for every screen: the review and order-status screens had none, so their errors never showed.
    <div style={{ position: "relative", height: "100dvh", width: "100%", background: "var(--bg)" }}>
      <Routes>
        <Route path="/" element={<NotAtATable><DiscoveryScreen /></NotAtATable>} />
        <Route path="/t/:tableCode" element={<TableEntryScreen />} />
        <Route path="/r/:restaurantId/menu" element={<MenuScreen />} />
        <Route path="/r/:restaurantId/item/:itemId" element={<ItemDetailScreen />} />
        <Route path="/cart" element={<CartScreen />} />
        <Route path="/checkout" element={<CheckoutScreen />} />
        <Route path="/review" element={<ReviewScreen />} />
        <Route path="/order/:orderId" element={<OrderStatusScreen />} />
        <Route path="/history" element={<NotAtATable><HistoryScreen /></NotAtATable>} />
        <Route path="*" element={<NotAtATable><DiscoveryScreen /></NotAtATable>} />
      </Routes>
      <Toast />
    </div>
  );
}
