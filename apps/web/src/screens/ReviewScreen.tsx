import { couponDiscount, type Address } from "@cardapio/shared";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ScreenHeader } from "../components/ScreenHeader";
import { useApp } from "../context/AppContext";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { api, ApiError } from "../lib/api";
import { brl } from "../lib/format";

export default function ReviewScreen() {
  const navigate = useNavigate();
  const {
    mode, tableNumber, tableCode, guestName, restaurantId, addressId, paymentMethodId, couponCode, coupon,
    registerTableOrder
  } = useApp();
  const { lines, subtotal, count, clear } = useCart();
  const { showToast } = useToast();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [restaurantFee, setRestaurantFee] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  // At the table the order ends with one of two choices: eat here or take away (still on the table's bill).
  const [takeaway, setTakeaway] = useState(false);

  const isMesa = mode === "table";

  useEffect(() => {
    if (!isMesa) {
      api.getAddresses().then(setAddresses);
      if (restaurantId) api.getRestaurant(restaurantId).then((r) => setRestaurantFee(r.deliveryFee));
    }
  }, [isMesa, restaurantId]);

  const selectedAddress = addresses.find((a) => a.id === addressId);
  const fee = isMesa ? 0 : restaurantFee;
  const discount = !isMesa && coupon ? couponDiscount(coupon, subtotal) : 0;
  const total = subtotal + fee - discount;

  const backTo = () => navigate(isMesa ? "/cart" : "/checkout");

  const confirm = async () => {
    if (!restaurantId || lines.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const order = await api.createOrder({
        mode,
        restaurantId,
        tableCode: isMesa ? tableCode ?? undefined : undefined,
        takeaway: isMesa ? takeaway : undefined,
        guestName: isMesa ? guestName || undefined : undefined,
        addressId: isMesa ? undefined : addressId ?? undefined,
        paymentMethodId: isMesa ? undefined : paymentMethodId ?? undefined,
        couponCode: isMesa ? undefined : couponCode ?? undefined,
        lines: lines.map((l) => ({
          itemId: l.itemId,
          quantity: l.quantity,
          notes: l.notes,
          selectedOptions: l.selectedOptions
        }))
      });
      // A free table's first order counts in the table's total only once the restaurant accepts it (OrderStatusScreen).
      if (isMesa && order.status !== "awaiting") registerTableOrder(order.total, order.id);
      clear();
      navigate(`/order/${order.id}`, { replace: true });
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Não foi possível confirmar o pedido", "fa-solid fa-triangle-exclamation");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="screen">
      <ScreenHeader title={isMesa ? "Revisar e enviar" : "Revisar pedido"} onBack={backTo} />
      <div className="scroll no-scrollbar" style={{ padding: "16px var(--pad) 0" }}>
        {isMesa ? (
          <div role="radiogroup" aria-label="Como você vai querer o pedido" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { value: false, icon: "fa-solid fa-utensils", title: `Comer aqui (Mesa ${tableNumber ?? ""})`, note: guestName ? `Comanda de ${guestName}` : "Servido na mesa" },
              { value: true, icon: "fa-solid fa-bag-shopping", title: "Para levar", note: "Embalado para viagem, na conta da mesa" }
            ].map((o) => {
              const on = takeaway === o.value;
              return (
                <button
                  key={o.title}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setTakeaway(o.value)}
                  className="card"
                  style={{ minHeight: 64, padding: "16px 18px", display: "flex", alignItems: "center", gap: 12, textAlign: "left", cursor: "pointer", font: "inherit", color: "var(--ink)", border: on ? "2px solid var(--pri)" : "1px solid var(--line)" }}
                >
                  <i className={o.icon} aria-hidden="true" style={{ fontSize: "var(--i-m)", color: "var(--acc)" }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", font: "600 var(--t-m) var(--font)" }}>{o.title}</span>
                    <span style={{ display: "block", marginTop: 3, font: "400 var(--t-s) var(--font)", color: "var(--ink2)" }}>{o.note}</span>
                  </span>
                  <i className={on ? "fa-solid fa-circle-check" : "fa-regular fa-circle"} aria-hidden="true" style={{ fontSize: 22, color: on ? "var(--pri)" : "var(--ink2)" }} />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="card" style={{ padding: 18, display: "flex", gap: 12 }}>
            <i className="fa-solid fa-location-dot" style={{ fontSize: "var(--i-m)", color: "var(--acc)", marginTop: 2 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="mono-label">entrega</div>
              <div style={{ marginTop: 5, font: "600 var(--t-m) var(--font)" }}>{`${selectedAddress?.label ?? ""} · 30–40 min`}</div>
              <div style={{ marginTop: 3, font: "400 var(--t-s) var(--font)", color: "var(--ink2)" }}>{selectedAddress?.detail}</div>
            </div>
          </div>
        )}

        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          {lines.map((r) => {
            const optionsLabel = r.selectedOptions.map((o) => o.label).join(" · ");
            return (
              <div key={r.key} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ flex: "none", width: 34, height: 34, borderRadius: "var(--r-standard)", background: "var(--surf2)", display: "flex", alignItems: "center", justifyContent: "center", font: "700 var(--t-s) var(--font)" }}>
                  {r.quantity}×
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: "600 var(--t-b) var(--font)" }}>{r.name}</div>
                  {optionsLabel && <div style={{ marginTop: 3, font: "400 var(--t-s) var(--font)", color: "var(--ink2)", lineHeight: 1.6 }}>{optionsLabel}</div>}
                  {r.notes && <div style={{ marginTop: 3, font: "400 var(--t-s) var(--font)", color: "var(--acc)", lineHeight: 1.6 }}>Obs: {r.notes}</div>}
                </div>
                <div style={{ font: "700 var(--t-b) var(--font)" }}>{brl(r.unitPrice * r.quantity)}</div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 9 }}>
          {isMesa ? (
            <div style={{ display: "flex", justifyContent: "space-between", font: "500 var(--t-b) var(--font)", color: "var(--ink2)" }}>
              <span>Itens</span><span style={{ color: "var(--ink)" }}>{count}</span>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", font: "500 var(--t-b) var(--font)", color: "var(--ink2)" }}>
                <span>Subtotal</span><span style={{ color: "var(--ink)" }}>{brl(subtotal)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", font: "500 var(--t-b) var(--font)", color: "var(--ink2)" }}>
                <span>Taxa de entrega</span><span style={{ color: "var(--ink)" }}>{fee === 0 ? "Grátis" : brl(fee)}</span>
              </div>
              {discount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", font: "500 var(--t-b) var(--font)", color: "var(--ink2)" }}>
                  <span>Cupom {(couponCode || "").toUpperCase()}</span><span style={{ color: "var(--ink)" }}>− {brl(discount)}</span>
                </div>
              )}
            </>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
            <span style={{ font: "600 var(--t-m) var(--font)" }}>Total</span>
            <span style={{ font: "700 var(--t-xl) var(--font)", letterSpacing: "-.025em" }}>{brl(total)}</span>
          </div>
        </div>
        <div style={{ height: 24 }} />
      </div>
      <div style={{ flex: "none", padding: "16px var(--pad) calc(16px + var(--safe))", borderTop: "1px solid var(--line)", background: "var(--glass)", backdropFilter: "saturate(180%) blur(22px)", WebkitBackdropFilter: "saturate(180%) blur(22px)" }}>
        <button className="btn-primary" disabled={submitting || lines.length === 0} onClick={confirm}>
          <i className={isMesa ? "fa-solid fa-paper-plane" : "fa-solid fa-circle-check"} style={{ fontSize: "var(--i-m)" }} />
          {isMesa ? "Confirmar e enviar para a cozinha" : "Confirmar pedido"}
        </button>
      </div>
    </div>
  );
}
