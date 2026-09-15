import { Route, Routes } from "react-router-dom";
import CartScreen from "./screens/CartScreen";
import CheckoutScreen from "./screens/CheckoutScreen";
import DiscoveryScreen from "./screens/DiscoveryScreen";
import HistoryScreen from "./screens/HistoryScreen";
import ItemDetailScreen from "./screens/ItemDetailScreen";
import MenuScreen from "./screens/MenuScreen";
import OrderStatusScreen from "./screens/OrderStatusScreen";
import ReviewScreen from "./screens/ReviewScreen";
import TableEntryScreen from "./screens/TableEntryScreen";

export default function App() {
  return (
    <div style={{ height: "100dvh", width: "100%", background: "var(--bg)" }}>
      <Routes>
        <Route path="/" element={<DiscoveryScreen />} />
        <Route path="/t/:tableCode" element={<TableEntryScreen />} />
        <Route path="/r/:restaurantId/menu" element={<MenuScreen />} />
        <Route path="/r/:restaurantId/item/:itemId" element={<ItemDetailScreen />} />
        <Route path="/cart" element={<CartScreen />} />
        <Route path="/checkout" element={<CheckoutScreen />} />
        <Route path="/review" element={<ReviewScreen />} />
        <Route path="/order/:orderId" element={<OrderStatusScreen />} />
        <Route path="/history" element={<HistoryScreen />} />
        <Route path="*" element={<DiscoveryScreen />} />
      </Routes>
    </div>
  );
}
