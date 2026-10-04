import type { MenuItem } from "@cardapio/shared";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { IconButton } from "../components/IconButton";
import { photoStyle } from "../components/menu/ItemCard";
import { useApp } from "../context/AppContext";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { usePageTitle } from "../lib/title";
import { brl } from "../lib/format";
import { computeSelectedOptions, computeUnitPrice, defaultDraft, type ItemDraft } from "../lib/itemDraft";

export default function ItemDetailScreen() {
  const { restaurantId = "", itemId = "" } = useParams();
  const navigate = useNavigate();
  const { addLine } = useCart();
  const { showToast } = useToast();

  const [item, setItem] = useState<MenuItem | null>(null);
  usePageTitle(item?.name ?? "", restaurantId);
  const [draft, setDraft] = useState<ItemDraft | null>(null);
  // G-2: outside a table, ordering needs the restaurant's Delivery module; without it the dish is only for looking.
  const { mode } = useApp();
  const [delivers, setDelivers] = useState<boolean | null>(null);
  const canOrder = mode === "table" || delivers === true;

  useEffect(() => {
    api.getItem(restaurantId, itemId).then((it) => {
      setItem(it);
      setDraft(defaultDraft(it));
    });
    if (mode !== "table") api.getRestaurant(restaurantId).then((r) => setDelivers(r.delivery)).catch(() => setDelivers(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, itemId]);

  const goBack = () => navigate(`/r/${restaurantId}/menu`);

  if (!item || !draft) {
    return (
      <div className="screen" style={{ alignItems: "center", justifyContent: "center" }}>
        <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: 24, color: "var(--acc)" }} />
      </div>
    );
  }

  const unit = computeUnitPrice(item, draft);

  const pickRadio = (groupId: string, index: number) => {
    setDraft((d) => (d ? { ...d, radios: { ...d.radios, [groupId]: index } } : d));
  };
  const toggleCheck = (groupId: string, index: number) => {
    setDraft((d) => {
      if (!d) return d;
      const group = { ...(d.checks[groupId] || {}) };
      group[index] = !group[index];
      return { ...d, checks: { ...d.checks, [groupId]: group } };
    });
  };

  const addToCart = () => {
    addLine({
      itemId: item.id,
      name: item.name,
      unitPrice: unit,
      quantity: draft.qty,
      notes: draft.notes,
      selectedOptions: computeSelectedOptions(item, draft)
    });
    showToast(`${draft.qty}× ${item.name} no carrinho`, "fa-solid fa-basket-shopping");
    goBack();
  };

  return (
    <div className="screen">
      <div className="scroll no-scrollbar">
        <div className="photo-placeholder" style={{ position: "relative", height: "calc(var(--banner) + 40px)", ...photoStyle(item) }}>
          <IconButton icon="fa-solid fa-arrow-left" onClick={goBack} title="Voltar" glass style={{ position: "absolute", top: 12, left: 12 }} />
        </div>
        <div style={{ padding: "18px var(--pad) 0" }}>
          <div style={{ font: "700 var(--t-l) var(--font)", letterSpacing: "-.025em" }}>{item.name}</div>
          <div style={{ marginTop: 8, font: "400 var(--t-b) var(--font)", color: "var(--ink2)", lineHeight: 1.6 }}>{item.longDescription}</div>
          <div style={{ marginTop: 12, font: "700 var(--t-m) var(--font)", color: "var(--acc)" }}>{brl(item.price)}</div>

          {item.optionGroups.map((g) => (
            <div key={g.id} style={{ marginTop: 22 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <div style={{ font: "600 var(--t-m) var(--font)", letterSpacing: "-.015em" }}>{g.label}</div>
                <div className="mono-label">{g.hint}</div>
              </div>
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                {g.options.map((o, i) => {
                  const selected = g.type === "single" ? (draft.radios[g.id] ?? 0) === i : !!draft.checks[g.id]?.[i];
                  return (
                    <div
                      key={o.id}
                      onClick={() => (g.type === "single" ? pickRadio(g.id, i) : toggleCheck(g.id, i))}
                      className={`option-row${selected ? " option-row--selected" : ""}`}
                    >
                      <div className={`mark ${g.type === "single" ? "mark--round" : "mark--square"}${selected ? " mark--selected" : ""}`}>
                        {selected && <i className={g.type === "single" ? "fa-solid fa-circle" : "fa-solid fa-check"} />}
                      </div>
                      <div style={{ flex: 1, font: "500 var(--t-b) var(--font)" }}>{o.label}</div>
                      <div style={{ font: "600 var(--t-s) var(--font)", color: "var(--ink2)" }}>
                        {o.priceDelta > 0 ? `+ ${brl(o.priceDelta)}` : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {canOrder && (<>
          <div style={{ marginTop: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, font: "600 var(--t-m) var(--font)", letterSpacing: "-.015em" }}>
              <i className="fa-solid fa-pen" style={{ fontSize: "var(--i-s)", color: "var(--ink2)" }} />Observações
            </div>
            <textarea
              className="field"
              value={draft.notes}
              onChange={(e) => setDraft((d) => (d ? { ...d, notes: e.target.value } : d))}
              placeholder="Ex: tirar cebola, ponto da carne bem passado, sem pimenta…"
              maxLength={300}
              style={{ marginTop: 10 }}
            />
          </div>

          <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: 6, borderRadius: 999, background: "var(--surf)", border: "1px solid var(--line)" }}>
              <button
                type="button"
                title="Menos"
                aria-label="Diminuir quantidade"
                onClick={() => setDraft((d) => (d ? { ...d, qty: Math.max(1, d.qty - 1) } : d))}
                className="tap"
                style={{ width: "var(--fab)", height: "var(--fab)", borderRadius: 999, border: "none", cursor: "pointer", background: "var(--surf2)", color: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <i className="fa-solid fa-minus" style={{ fontSize: "var(--i-m)" }} />
              </button>
              <div style={{ minWidth: 30, textAlign: "center", font: "700 var(--t-m) var(--font)" }}>{draft.qty}</div>
              <button
                type="button"
                title="Mais"
                aria-label="Aumentar quantidade"
                onClick={() => setDraft((d) => (d ? { ...d, qty: d.qty + 1 } : d))}
                className="tap"
                style={{ width: "var(--fab)", height: "var(--fab)", borderRadius: 999, border: "none", cursor: "pointer", background: "var(--surf2)", color: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <i className="fa-solid fa-plus" style={{ fontSize: "var(--i-m)" }} />
              </button>
            </div>
            <div style={{ font: "500 var(--t-s) var(--font)", color: "var(--ink2)" }}>Unidade {brl(unit)}</div>
          </div>
          </>)}
          <div style={{ height: 20 }} />
        </div>
        <div style={{ height: 104 }} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "12px var(--pad) calc(12px + var(--safe))", background: "linear-gradient(to top,var(--bg) 55%,rgba(0,0,0,0))", backdropFilter: "saturate(180%) blur(22px)", WebkitBackdropFilter: "saturate(180%) blur(22px)" }}>
        {canOrder ? (
          <button className="btn-primary" onClick={addToCart} style={{ justifyContent: "space-between" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              <i className="fa-solid fa-basket-shopping" style={{ fontSize: "var(--i-m)" }} />Adicionar ao carrinho
            </span>
            <span style={{ fontWeight: 700 }}>{brl(unit * draft.qty)}</span>
          </button>
        ) : (
          delivers === false && <OrderAtTheTable />
        )}
      </div>
    </div>
  );
}

/** G-2: what a cardápio that's only for looking says instead of the cart (menu, dish). */
export function OrderAtTheTable() {
  return (
    <div role="note" style={{ display: "flex", gap: 11, alignItems: "center", padding: "16px 18px", borderRadius: "var(--r-standard)", background: "var(--surf)", border: "1px solid var(--line)" }}>
      <i className="fa-solid fa-qrcode" style={{ fontSize: "var(--i-m)", color: "var(--acc)" }} />
      <div style={{ font: "600 var(--t-b) var(--font)" }}>Para pedir, use o QR da sua mesa.</div>
    </div>
  );
}
