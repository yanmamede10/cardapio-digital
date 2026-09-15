import type { Address } from "@cardapio/shared";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ScreenHeader } from "../components/ScreenHeader";
import { useApp } from "../context/AppContext";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { api, ApiError } from "../lib/api";
import { formatMoney } from "../lib/format";

export default function ReviewScreen() {
  const navigate = useNavigate();
  const {
    mode, tableNumber, guestName, restaurantId, addressId, paymentMethodId, couponCode, discountPercent,
    registerTableOrder
  } = useApp();
  const { lines, subtotal, count, clear } = useCart();
  const { showToast } = useToast();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [restaurantFee, setRestaurantFee] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const isMesa = mode === "table";

  useEffect(() => {
    if (!isMesa) {
      api.getAddresses().then(setAddresses);
      if (restaurantId) api.getRestaurant(restaurantId).then((r) => setRestaurantFee(r.deliveryFee));
    }
  }, [isMesa, restaurantId]);

  const selectedAddress = addresses.find((a) => a.id === addressId);
  const fee = isMesa ? 0 : restaurantFee;
  const discount = !isMesa && discountPercent > 0 ? Math.round(subtotal * (discountPercent / 100) * 100) / 100 : 0;
  const total = subtotal + fee - discount;

  const backTo = () => navigate(isMesa ? "/cart" : "/checkout");

  const confirm = async () => {
    if (!restaurantId || lines.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const order = await api.createOrder({
        mode,
        restaurantId,
        tableNumber: isMesa ? tableNumber ?? undefined : undefined,
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
      if (isMesa) registerTableOrder(order.total, order.id);
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
        <div className="card" style={{ padding: 14, display: "flex", gap: 12 }}>
          <i className={isMesa ? "fa-solid fa-qrcode" : "fa-solid fa-location-dot"} style={{ fontSize: "var(--i-m)", color: "var(--acc)", marginTop: 2 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="mono-label">{isMesa ? "mesa" : "entrega"}</div>
            <div style={{ marginTop: 5, font: "600 var(--t-m) Archivo, sans-serif" }}>
              {isMesa ? `Mesa ${tableNumber ?? ""}` : `${selectedAddress?.label ?? ""} · 30–40 min`}
            </div>
            <div style={{ marginTop: 3, font: "400 var(--t-s) Archivo, sans-serif", color: "var(--ink2)" }}>
              {isMesa ? (guestName ? `Comanda de ${guestName}` : "Pedido vai direto para a cozinha") : selectedAddress?.detail}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          {lines.map((r) => {
            const optionsLabel = r.selectedOptions.map((o) => o.label).join(" · ");
            return (
              <div key={r.key} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ flex: "none", width: 34, height: 34, borderRadius: 10, background: "var(--surf2)", display: "flex", alignItems: "center", justifyContent: "center", font: "700 var(--t-s) Archivo, sans-serif" }}>
                  {r.quantity}×
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: "600 var(--t-b) Archivo, sans-serif" }}>{r.name}</div>
                  {optionsLabel && <div style={{ marginTop: 3, font: "400 var(--t-s) Archivo, sans-serif", color: "var(--ink2)", lineHeight: 1.35 }}>{optionsLabel}</div>}
                  {r.notes && <div style={{ marginTop: 3, font: "400 var(--t-s) Archivo, sans-serif", color: "var(--acc)", lineHeight: 1.35 }}>Obs: {r.notes}</div>}
                </div>
                <div style={{ font: "700 var(--t-b) Archivo, sans-serif" }}>{formatMoney(r.unitPrice * r.quantity)}</div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 9 }}>
          {isMesa ? (
            <div style={{ display: "flex", justifyContent: "space-between", font: "500 var(--t-b) Archivo, sans-serif", color: "var(--ink2)" }}>
              <span>Itens</span><span style={{ color: "var(--ink)" }}>{count}</span>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", font: "500 var(--t-b) Archivo, sans-serif", color: "var(--ink2)" }}>
                <span>Subtotal</span><span style={{ color: "var(--ink)" }}>{formatMoney(subtotal)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", font: "500 var(--t-b) Archivo, sans-serif", color: "var(--ink2)" }}>
                <span>Taxa de entrega</span><span style={{ color: "var(--ink)" }}>{fee === 0 ? "Grátis" : formatMoney(fee)}</span>
              </div>
              {discount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", font: "500 var(--t-b) Archivo, sans-serif", color: "var(--ink2)" }}>
                  <span>Cupom {(couponCode || "").toUpperCase()}</span><span style={{ color: "var(--ink)" }}>− {formatMoney(discount)}</span>
                </div>
              )}
            </>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
            <span style={{ font: "600 var(--t-m) Archivo, sans-serif" }}>Total</span>
            <span style={{ font: "700 var(--t-xl) Archivo, sans-serif", letterSpacing: "-.025em" }}>{formatMoney(total)}</span>
          </div>
        </div>
        <div style={{ height: 24 }} />
      </div>
      <div style={{ flex: "none", padding: "14px var(--pad) calc(14px + var(--safe))", borderTop: "1px solid var(--line)", background: "var(--surf)" }}>
        <button className="btn-primary" disabled={submitting || lines.length === 0} onClick={confirm}>
          <i className={isMesa ? "fa-solid fa-paper-plane" : "fa-solid fa-circle-check"} style={{ fontSize: "var(--i-m)" }} />
          {isMesa ? "Confirmar e enviar para a cozinha" : "Confirmar pedido"}
        </button>
      </div>
    </div>
  );
}
