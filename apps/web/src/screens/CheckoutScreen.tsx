import type { Address, PaymentMethod, Restaurant } from "@cardapio/shared";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ScreenHeader } from "../components/ScreenHeader";
import { useApp } from "../context/AppContext";
import { useCart } from "../context/CartContext";
import { api } from "../lib/api";
import { formatMoney } from "../lib/format";

export default function CheckoutScreen() {
  const navigate = useNavigate();
  const { mode, restaurantId, addressId, setAddressId, paymentMethodId, setPaymentMethodId, discountPercent, setCoupon } = useApp();
  const { subtotal, lines } = useCart();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [payments, setPayments] = useState<PaymentMethod[]>([]);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [couponNote, setCouponNote] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "table") {
      navigate("/review", { replace: true });
      return;
    }
    api.getAddresses().then((list) => {
      setAddresses(list);
      if (!addressId) {
        const def = list.find((a) => a.isDefault) || list[0];
        if (def) setAddressId(def.id);
      }
    });
    api.getPaymentMethods().then((list) => {
      setPayments(list);
      if (!paymentMethodId && list[0]) setPaymentMethodId(list[0].id);
    });
    if (restaurantId) api.getRestaurant(restaurantId).then(setRestaurant);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  if (mode === "table") return null;

  const fee = restaurant?.deliveryFee ?? 0;
  const discount = discountPercent > 0 ? Math.round(subtotal * (discountPercent / 100) * 100) / 100 : 0;
  const total = subtotal + fee - discount;

  const applyCoupon = async () => {
    const result = await api.applyCoupon(couponInput);
    setCouponNote(result.message);
    setCoupon(result.valid ? couponInput : null, result.valid ? result.discountPercent : 0);
  };

  return (
    <div className="screen">
      <ScreenHeader title="Pagamento" onBack={() => navigate("/cart")} />
      <div className="scroll no-scrollbar" style={{ padding: "16px var(--pad) 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, font: "600 var(--t-m) Archivo, sans-serif", letterSpacing: "-.015em" }}>
          <i className="fa-solid fa-location-dot" style={{ fontSize: "var(--i-s)", color: "var(--acc)" }} />Endereço de entrega
        </div>
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          {addresses.map((a) => {
            const selected = addressId === a.id;
            return (
              <div key={a.id} onClick={() => setAddressId(a.id)} className={`option-row${selected ? " option-row--selected" : ""}`}>
                <div className={`mark mark--round${selected ? " mark--selected" : ""}`}>{selected && <i className="fa-solid fa-circle" />}</div>
                <i className={a.icon} style={{ fontSize: "var(--i-m)", color: "var(--ink2)" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: "600 var(--t-b) Archivo, sans-serif" }}>{a.label}</div>
                  <div style={{ marginTop: 2, font: "400 var(--t-s) Archivo, sans-serif", color: "var(--ink2)" }}>{a.detail}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 22, display: "flex", alignItems: "center", gap: 9, font: "600 var(--t-m) Archivo, sans-serif", letterSpacing: "-.015em" }}>
          <i className="fa-solid fa-credit-card" style={{ fontSize: "var(--i-s)", color: "var(--acc)" }} />Forma de pagamento
        </div>
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          {payments.map((p) => {
            const selected = paymentMethodId === p.id;
            return (
              <div key={p.id} onClick={() => setPaymentMethodId(p.id)} className={`option-row${selected ? " option-row--selected" : ""}`}>
                <div className={`mark mark--round${selected ? " mark--selected" : ""}`}>{selected && <i className="fa-solid fa-circle" />}</div>
                <i className={p.icon} style={{ fontSize: "var(--i-m)", color: "var(--ink2)" }} />
                <div style={{ flex: 1, font: "500 var(--t-b) Archivo, sans-serif" }}>{p.label}</div>
                <div style={{ font: "500 var(--t-s) Archivo, sans-serif", color: "var(--ink2)" }}>{p.note}</div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 22, display: "flex", alignItems: "center", gap: 9, font: "600 var(--t-m) Archivo, sans-serif", letterSpacing: "-.015em" }}>
          <i className="fa-solid fa-ticket" style={{ fontSize: "var(--i-s)", color: "var(--acc)" }} />Cupom
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          <input
            className="field"
            value={couponInput}
            onChange={(e) => setCouponInput(e.target.value)}
            placeholder="Insira o código"
          />
          <button type="button" onClick={applyCoupon} style={{ border: "1px solid var(--pri)", background: "transparent", cursor: "pointer", borderRadius: 14, padding: "14px 18px", color: "var(--acc)", font: "600 var(--t-b) Archivo, sans-serif" }}>
            Aplicar
          </button>
        </div>
        {couponNote && (
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, font: "500 var(--t-s) Archivo, sans-serif", color: "var(--acc)" }}>
            <i className={discountPercent > 0 ? "fa-solid fa-circle-check" : "fa-solid fa-circle-exclamation"} style={{ fontSize: "var(--i-s)" }} />{couponNote}
          </div>
        )}

        <div style={{ marginTop: 22, padding: 14, borderRadius: 18, background: "var(--surf)", border: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 9 }}>
          <div style={{ display: "flex", justifyContent: "space-between", font: "500 var(--t-b) Archivo, sans-serif", color: "var(--ink2)" }}>
            <span>Subtotal</span><span style={{ color: "var(--ink)" }}>{formatMoney(subtotal)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", font: "500 var(--t-b) Archivo, sans-serif", color: "var(--ink2)" }}>
            <span>Taxa de entrega</span><span style={{ color: "var(--ink)" }}>{fee === 0 ? "Grátis" : formatMoney(fee)}</span>
          </div>
          {discount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", font: "500 var(--t-b) Archivo, sans-serif", color: "var(--ink2)" }}>
              <span>Cupom {couponInput.toUpperCase()}</span><span style={{ color: "var(--ink)" }}>− {formatMoney(discount)}</span>
            </div>
          )}
          <div style={{ height: 1, background: "var(--line)" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ font: "600 var(--t-b) Archivo, sans-serif" }}>Total</span>
            <span style={{ font: "700 var(--t-l) Archivo, sans-serif", letterSpacing: "-.02em" }}>{formatMoney(total)}</span>
          </div>
        </div>
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, font: "500 var(--t-s) Archivo, sans-serif", color: "var(--ink2)" }}>
          <i className="fa-solid fa-clock" style={{ fontSize: "var(--i-s)" }} />Entrega estimada em 30–40 min após a confirmação.
        </div>
        {lines.length === 0 && (
          <div style={{ marginTop: 14, padding: 14, borderRadius: 14, background: "var(--surf2)", font: "500 var(--t-s) Archivo, sans-serif", color: "var(--ink2)" }}>
            Seu carrinho está vazio — volte ao cardápio para adicionar itens antes de revisar o pedido.
          </div>
        )}
        <div style={{ height: 24 }} />
      </div>
      <div style={{ flex: "none", padding: "14px var(--pad) calc(14px + var(--safe))", borderTop: "1px solid var(--line)", background: "var(--surf)" }}>
        <button className="btn-primary" disabled={lines.length === 0} onClick={() => navigate("/review")}>
          <i className="fa-solid fa-clipboard-check" style={{ fontSize: "var(--i-m)" }} />Revisar pedido
        </button>
      </div>
    </div>
  );
}
