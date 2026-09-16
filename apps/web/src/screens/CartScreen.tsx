import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { QtyStepper } from "../components/QtyStepper";
import { ScreenHeader } from "../components/ScreenHeader";
import { Toast } from "../components/Toast";
import { useApp } from "../context/AppContext";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { formatMoney } from "../lib/format";

export default function CartScreen() {
  const navigate = useNavigate();
  const { mode, tableNumber, restaurantId } = useApp();
  const { lines, subtotal, count, incQty, decQty, removeLine, setNotes } = useCart();
  const { showToast } = useToast();
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const isMesa = mode === "table";
  const goMenu = () => navigate(restaurantId ? `/r/${restaurantId}/menu` : "/");
  const hasItems = lines.length > 0;

  return (
    <div className="screen">
      <ScreenHeader
        title={isMesa ? "Sua rodada" : "Seu carrinho"}
        onBack={goMenu}
        meta={isMesa ? `Mesa ${tableNumber ?? ""}` : `${count} itens`}
      />
      <div className="scroll no-scrollbar" style={{ padding: "16px var(--pad) 0" }}>
        {!hasItems && (
          <div style={{ padding: "44px 8px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 16 }}>
            <div style={{ width: 104, height: 104, borderRadius: 999, background: "var(--surf2)", border: "1px dashed var(--line)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <i className="fa-solid fa-basket-shopping" style={{ fontSize: 38, color: "var(--acc)", opacity: 0.55 }} />
            </div>
            <div style={{ font: "700 var(--t-l) var(--font)", letterSpacing: "-.02em" }}>Seu carrinho está vazio</div>
            <div style={{ maxWidth: 280, font: "400 var(--t-b) var(--font)", color: "var(--ink2)", lineHeight: 1.5 }}>
              Dá uma olhada no cardápio — os mais pedidos da casa estão logo no começo.
            </div>
            <button className="btn-primary" style={{ width: "auto", padding: "14px 22px" }} onClick={goMenu}>
              <i className="fa-solid fa-utensils" style={{ fontSize: "var(--i-s)" }} />Explorar o cardápio
            </button>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {lines.map((r) => {
            const optionsLabel = r.selectedOptions.map((o) => o.label).join(" · ");
            const editing = editingKey === r.key;
            return (
              <div key={r.key} className="card" style={{ padding: 15 }}>
                <div style={{ display: "flex", gap: 12 }}>
                  <div className="photo-placeholder" style={{ flex: "none", width: 62, height: 62, borderRadius: "var(--r-standard)" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                      <div style={{ flex: 1, font: "600 var(--t-b) var(--font)", lineHeight: 1.25 }}>{r.name}</div>
                      <div style={{ font: "700 var(--t-b) var(--font)" }}>{formatMoney(r.unitPrice * r.quantity)}</div>
                    </div>
                    {optionsLabel && (
                      <div style={{ marginTop: 4, font: "400 var(--t-s) var(--font)", color: "var(--ink2)", lineHeight: 1.6 }}>{optionsLabel}</div>
                    )}
                    {r.notes && (
                      <div style={{ marginTop: 4, font: "400 var(--t-s) var(--font)", color: "var(--acc)", lineHeight: 1.6 }}>Obs: {r.notes}</div>
                    )}
                    <div style={{ marginTop: 9, display: "flex", alignItems: "center", gap: 10 }}>
                      <QtyStepper qty={r.quantity} onInc={() => incQty(r.key)} onDec={() => decQty(r.key)} />
                      <button
                        type="button"
                        onClick={() => setEditingKey(editing ? null : r.key)}
                        className="tap"
                        style={{ display: "inline-flex", alignItems: "center", gap: 7, border: "none", background: "transparent", padding: 0, cursor: "pointer", color: "var(--ink2)", font: "600 var(--t-s) var(--font)" }}
                      >
                        <i className="fa-solid fa-pen" style={{ fontSize: "var(--i-s)" }} />Observações
                      </button>
                      <button
                        type="button"
                        title="Remover"
                        onClick={() => removeLine(r.key)}
                        className="tap"
                        style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 7, border: "none", background: "transparent", padding: 0, cursor: "pointer", color: "var(--ink2)", font: "600 var(--t-s) var(--font)" }}
                      >
                        <i className="fa-solid fa-trash-can" style={{ fontSize: "var(--i-s)" }} />Remover
                      </button>
                    </div>
                  </div>
                </div>
                {editing && (
                  <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "flex-end" }}>
                    <textarea
                      value={r.notes}
                      onChange={(e) => setNotes(r.key, e.target.value)}
                      placeholder="Ex: sem cebola"
                      style={{ flex: 1, boxSizing: "border-box", minHeight: 56, resize: "vertical", padding: "14px 16px", borderRadius: "var(--r-standard)", border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)", font: "400 var(--t-s) var(--font)", lineHeight: 1.6, outline: "none" }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setEditingKey(null);
                        showToast("Observação salva", "fa-solid fa-pen");
                      }}
                      className="tap"
                      style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "none", cursor: "pointer", borderRadius: "var(--r-standard)", padding: "12px 14px", background: "var(--pri)", color: "var(--priInk)", font: "600 var(--t-s) var(--font)" }}
                    >
                      <i className="fa-solid fa-check" style={{ fontSize: "var(--i-s)" }} />Salvar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {hasItems && (
          <button className="btn-dashed" style={{ marginTop: 12 }} onClick={goMenu}>
            <i className="fa-solid fa-plus" style={{ fontSize: "var(--i-s)" }} />Adicionar mais itens
          </button>
        )}
        <div style={{ height: 24 }} />
      </div>

      {hasItems && (
        <div style={{ flex: "none", padding: "16px var(--pad) calc(16px + var(--safe))", borderTop: "1px solid var(--line)", background: "var(--glass)", backdropFilter: "saturate(180%) blur(22px)", WebkitBackdropFilter: "saturate(180%) blur(22px)" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <div style={{ font: "500 var(--t-b) var(--font)", color: "var(--ink2)" }}>{isMesa ? "Total da rodada" : "Subtotal"}</div>
            <div style={{ font: "700 var(--t-l) var(--font)", letterSpacing: "-.02em" }}>{formatMoney(subtotal)}</div>
          </div>
          <button
            className="btn-primary"
            style={{ marginTop: 12 }}
            onClick={() => navigate(isMesa ? "/review" : "/checkout")}
          >
            <i className={isMesa ? "fa-solid fa-paper-plane" : "fa-solid fa-credit-card"} style={{ fontSize: "var(--i-m)" }} />
            {isMesa ? "Enviar pedido para a cozinha" : "Ir para pagamento"}
          </button>
        </div>
      )}
      <Toast />
    </div>
  );
}
