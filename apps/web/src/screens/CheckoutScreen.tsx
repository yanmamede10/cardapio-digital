import { couponDiscount, type PaymentMethod, type Restaurant } from "@cardapio/shared";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ScreenHeader } from "../components/ScreenHeader";
import { useApp } from "../context/AppContext";
import { useCart } from "../context/CartContext";
import { api } from "../lib/api";
import { brl } from "../lib/format";

export default function CheckoutScreen() {
  const navigate = useNavigate();
  const { mode, restaurantId, paymentMethodId, setPaymentMethodId, coupon, setCoupon } = useApp();
  const { subtotal, lines } = useCart();

  const [payments, setPayments] = useState<PaymentMethod[]>([]);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [couponNote, setCouponNote] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "table") {
      navigate("/review", { replace: true });
      return;
    }
    api.getPaymentMethods().then((list) => {
      setPayments(list);
      if (!paymentMethodId && list[0]) setPaymentMethodId(list[0].id);
    });
    if (restaurantId) api.getRestaurant(restaurantId).then(setRestaurant);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  if (mode === "table") return null;

  const fee = restaurant?.deliveryFee ?? 0;
  const discount = coupon ? couponDiscount(coupon, subtotal) : 0;
  const total = subtotal + fee - discount;

  const applyCoupon = async () => {
    if (!restaurantId) return;
    const result = await api.applyCoupon(restaurantId, couponInput);
    setCouponNote(result.message);
    setCoupon(result.valid ? couponInput : null, result.kind ? { kind: result.kind, value: result.value } : null);
  };

  return (
    <div className="screen">
      <ScreenHeader title="Pagamento" onBack={() => navigate("/cart")} />
      {/* G-1: no "Endereço de entrega" list — a customer's addresses aren't public any more (staff only). */}
      <div className="scroll no-scrollbar" style={{ padding: "16px var(--pad) 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, font: "600 var(--t-m) var(--font)", letterSpacing: "-.015em" }}>
          <i className="fa-solid fa-credit-card" style={{ fontSize: "var(--i-s)", color: "var(--acc)" }} />Forma de pagamento
        </div>
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          {payments.map((p) => {
            const selected = paymentMethodId === p.id;
            return (
              <div key={p.id} onClick={() => setPaymentMethodId(p.id)} className={`option-row${selected ? " option-row--selected" : ""}`}>
                <div className={`mark mark--round${selected ? " mark--selected" : ""}`}>{selected && <i className="fa-solid fa-circle" />}</div>
                <i className={p.icon} style={{ fontSize: "var(--i-m)", color: "var(--ink2)" }} />
                <div style={{ flex: 1, font: "500 var(--t-b) var(--font)" }}>{p.label}</div>
                <div style={{ font: "500 var(--t-s) var(--font)", color: "var(--ink2)" }}>{p.note}</div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 22, display: "flex", alignItems: "center", gap: 9, font: "600 var(--t-m) var(--font)", letterSpacing: "-.015em" }}>
          <i className="fa-solid fa-ticket" style={{ fontSize: "var(--i-s)", color: "var(--acc)" }} />Cupom
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          <input
            className="field"
            value={couponInput}
            onChange={(e) => setCouponInput(e.target.value)}
            placeholder="Insira o código"
          />
          <button type="button" onClick={applyCoupon} className="tap" style={{ border: "1px solid var(--pri)", background: "transparent", cursor: "pointer", borderRadius: "var(--r-standard)", padding: "14px 18px", color: "var(--acc)", font: "600 var(--t-b) var(--font)" }}>
            Aplicar
          </button>
        </div>
        {couponNote && (
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, font: "500 var(--t-s) var(--font)", color: "var(--acc)" }}>
            <i className={coupon ? "fa-solid fa-circle-check" : "fa-solid fa-circle-exclamation"} style={{ fontSize: "var(--i-s)" }} />{couponNote}
          </div>
        )}

        <div style={{ marginTop: 22, padding: 18, borderRadius: "var(--r-standard)", background: "var(--surf)", border: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 9 }}>
          <div style={{ display: "flex", justifyContent: "space-between", font: "500 var(--t-b) var(--font)", color: "var(--ink2)" }}>
            <span>Subtotal</span><span style={{ color: "var(--ink)" }}>{brl(subtotal)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", font: "500 var(--t-b) var(--font)", color: "var(--ink2)" }}>
            <span>Taxa de entrega</span><span style={{ color: "var(--ink)" }}>{fee === 0 ? "Grátis" : brl(fee)}</span>
          </div>
          {discount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", font: "500 var(--t-b) var(--font)", color: "var(--ink2)" }}>
              <span>Cupom {couponInput.toUpperCase()}</span><span style={{ color: "var(--ink)" }}>− {brl(discount)}</span>
            </div>
          )}
          <div style={{ height: 1, background: "var(--line)" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ font: "600 var(--t-b) var(--font)" }}>Total</span>
            <span style={{ font: "700 var(--t-l) var(--font)", letterSpacing: "-.02em" }}>{brl(total)}</span>
          </div>
        </div>
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, font: "500 var(--t-s) var(--font)", color: "var(--ink2)" }}>
          <i className="fa-solid fa-clock" style={{ fontSize: "var(--i-s)" }} />Entrega estimada em 30–40 min após a confirmação.
        </div>
        {lines.length === 0 && (
          <div style={{ marginTop: 14, padding: 18, borderRadius: "var(--r-standard)", background: "var(--surf2)", font: "500 var(--t-s) var(--font)", color: "var(--ink2)" }}>
            Seu carrinho está vazio — volte ao cardápio para adicionar itens antes de revisar o pedido.
          </div>
        )}
        <div style={{ height: 24 }} />
      </div>
      <div style={{ flex: "none", padding: "16px var(--pad) calc(16px + var(--safe))", borderTop: "1px solid var(--line)", background: "var(--glass)", backdropFilter: "saturate(180%) blur(22px)", WebkitBackdropFilter: "saturate(180%) blur(22px)" }}>
        <button className="btn-primary" disabled={lines.length === 0} onClick={() => navigate("/review")}>
          <i className="fa-solid fa-clipboard-check" style={{ fontSize: "var(--i-m)" }} />Revisar pedido
        </button>
      </div>
    </div>
  );
}
