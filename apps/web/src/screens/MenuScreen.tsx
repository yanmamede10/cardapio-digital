import type { MenuCategory, MenuItem, Restaurant } from "@cardapio/shared";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BottomBar, SupportFab } from "../components/FloatingControls";
import { IconButton } from "../components/IconButton";
import { Pill } from "../components/Pill";
import { MenuSkeleton } from "../components/Skeletons";
import { Toast } from "../components/Toast";
import { useApp } from "../context/AppContext";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { formatMoney, formatRating } from "../lib/format";
import { computeSelectedOptions, computeUnitPrice, defaultDraft } from "../lib/itemDraft";

export default function MenuScreen() {
  const { restaurantId = "" } = useParams();
  const navigate = useNavigate();
  const { mode, tableNumber, guestName, setGuestName, setActiveRestaurant, theme, toggleTheme, tableSession, addressId } = useApp();
  const { addLine } = useCart();
  const { showToast } = useToast();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[] | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("Todos");
  const [addressLabel, setAddressLabel] = useState("");

  const isMesa = mode === "table";

  useEffect(() => {
    setActiveRestaurant(restaurantId);
    setRestaurant(null);
    setItems(null);
    setActiveCategory("Todos");
    Promise.all([api.getRestaurant(restaurantId), api.getCategories(restaurantId), api.getItems(restaurantId)])
      .then(([r, c, i]) => {
        setRestaurant(r);
        setCategories(c);
        setItems(i);
      })
      .catch(() => showToast("Não foi possível carregar o cardápio", "fa-solid fa-triangle-exclamation"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  useEffect(() => {
    if (mode !== "delivery") return;
    api.getAddresses().then((list) => {
      const def = list.find((a) => a.id === addressId) || list.find((a) => a.isDefault) || list[0];
      if (def) setAddressLabel(def.detail);
    });
  }, [mode, addressId]);

  const visibleItems = useMemo(
    () => (items || []).filter((it) => activeCategory === "Todos" || it.categoryId === activeCategory),
    [items, activeCategory]
  );

  const quickAdd = (item: MenuItem) => {
    if (item.soldOut) return;
    const draft = defaultDraft(item);
    addLine({
      itemId: item.id,
      name: item.name,
      unitPrice: computeUnitPrice(item, draft),
      quantity: 1,
      notes: "",
      selectedOptions: computeSelectedOptions(item, draft)
    });
    showToast(`${item.name} adicionado`, "fa-solid fa-basket-shopping");
  };

  const loading = !restaurant || items === null;

  return (
    <div className="screen">
      {loading ? (
        <MenuSkeleton />
      ) : (
        <div className="scroll no-scrollbar">
          <div className="photo-placeholder" style={{ position: "relative", height: "var(--banner)" }}>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", font: "500 10px var(--font)", letterSpacing: ".08em", color: "var(--ink2)" }}>
              foto · fachada / salão
            </div>
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "64%", background: "linear-gradient(to top,rgba(2,3,4,.58),rgba(2,3,4,0))" }} />
            <div style={{ position: "absolute", top: 12, left: 12, right: 12, display: "flex", alignItems: "center", gap: 8 }}>
              {isMesa && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", borderRadius: 999, background: "rgba(2,3,4,.55)", backdropFilter: "blur(6px)", color: "#FCF7D3", font: "600 var(--t-s) var(--font)" }}>
                  <i className="fa-solid fa-qrcode" style={{ fontSize: "var(--i-s)", color: "#CD8C52" }} />Mesa {tableNumber}
                </div>
              )}
              {!isMesa && <IconButton icon="fa-solid fa-arrow-left" onClick={() => navigate("/")} title="Voltar" glass />}
              <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                {!isMesa && (
                  <button
                    type="button"
                    onClick={() => showToast("Chat de suporte abrindo…", "fa-solid fa-headset")}
                    style={{ border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, padding: "8px 13px", borderRadius: 999, background: "rgba(2,3,4,.55)", backdropFilter: "blur(6px)", color: "#FCF7D3", font: "600 var(--t-s) var(--font)" }}
                  >
                    <i className="fa-solid fa-headset" style={{ fontSize: "var(--i-s)" }} />Suporte
                  </button>
                )}
                <IconButton icon={theme === "dark" ? "fa-solid fa-sun" : "fa-solid fa-moon"} onClick={toggleTheme} title="Alternar tema" glass />
              </div>
            </div>
          </div>

          <div style={{ padding: "0 var(--pad)" }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: -30 }}>
              <div style={{ width: 66, height: 66, borderRadius: "var(--r-elevated)", background: "var(--pri)", border: "3px solid var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", color: "#FCF7D3", font: "700 20px var(--font)", letterSpacing: "-.02em" }}>
                {restaurant.initials}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", borderRadius: 999, background: "var(--surf)", border: "1px solid var(--line)", font: "600 var(--t-s) var(--font)" }}>
                <i className="fa-solid fa-circle-check" style={{ fontSize: "var(--i-s)", color: "var(--good)" }} />Aberto agora
              </div>
            </div>
            <div style={{ marginTop: 12, font: "700 var(--t-xl) var(--font)", letterSpacing: "-.025em" }}>{restaurant.name}</div>
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", font: "500 var(--t-s) var(--font)", color: "var(--ink2)" }}>
              <span style={{ display: "inline-flex", gap: 3, color: "var(--acc)", fontSize: "var(--i-s)" }}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <i key={i} className="fa-solid fa-star" style={{ opacity: i === 4 ? 0.32 : 1 }} />
                ))}
              </span>
              <span style={{ fontWeight: 700, color: "var(--ink)" }}>{formatRating(restaurant.rating)}</span>
              <span>{restaurant.reviewCount} avaliações</span>
              <span style={{ opacity: 0.5 }}>·</span>
              <span>{restaurant.cuisine}</span>
            </div>
            <div style={{ marginTop: 7, display: "flex", alignItems: "center", gap: 7, font: "500 var(--t-s) var(--font)", color: "var(--ink2)" }}>
              <i className="fa-solid fa-clock" style={{ fontSize: "var(--i-s)" }} />Hoje 11:00 – 23:00
            </div>

            {!isMesa && (
              <>
                <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", padding: "16px 18px", borderRadius: "var(--r-standard)", background: "var(--surf)", border: "1px solid var(--line)" }}>
                  <i className="fa-solid fa-location-dot" style={{ fontSize: "var(--i-m)", color: "var(--acc)" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="mono-label">entregar em</div>
                    <div style={{ marginTop: 3, font: "600 var(--t-b) var(--font)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{addressLabel}</div>
                  </div>
                  <button type="button" onClick={() => navigate("/checkout")} style={{ border: "1px solid var(--line)", background: "transparent", color: "var(--acc)", cursor: "pointer", borderRadius: 999, padding: "8px 13px", font: "600 var(--t-s) var(--font)" }}>
                    Trocar
                  </button>
                </div>
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", font: "500 var(--t-s) var(--font)", color: "var(--ink2)" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <i className="fa-solid fa-clock" style={{ fontSize: "var(--i-s)" }} />Entrega em <b style={{ color: "var(--ink)" }}>{restaurant.etaMinMinutes}–{restaurant.etaMaxMinutes} min</b>
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <i className="fa-solid fa-motorcycle" style={{ fontSize: "var(--i-s)" }} />Taxa <b style={{ color: "var(--ink)" }}>{restaurant.deliveryFee === 0 ? "Grátis" : formatMoney(restaurant.deliveryFee)}</b>
                  </span>
                  <button type="button" onClick={() => navigate("/history")} style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 7, border: "none", background: "transparent", padding: 0, cursor: "pointer", color: "var(--acc)", font: "600 var(--t-s) var(--font)" }}>
                    <i className="fa-solid fa-receipt" style={{ fontSize: "var(--i-s)" }} />Meus pedidos
                  </button>
                </div>
              </>
            )}

            {isMesa && (
              <div style={{ marginTop: 14, display: "flex", gap: 11, alignItems: "center", padding: "16px 18px", borderRadius: "var(--r-standard)", background: "var(--surf)", border: "1px solid var(--line)" }}>
                <i className="fa-solid fa-user" style={{ fontSize: "var(--i-m)", color: "var(--acc)" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="mono-label">seu nome (opcional)</div>
                  <input
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="para o garçom te chamar"
                    style={{ marginTop: 3, width: "100%", border: "none", background: "transparent", outline: "none", color: "var(--ink)", font: "600 var(--t-b) var(--font)" }}
                  />
                </div>
                {tableSession.rounds > 0 && (
                  <div style={{ textAlign: "right", font: "500 var(--t-xs) var(--font)", color: "var(--ink2)" }}>
                    comanda<br /><b style={{ fontSize: "var(--t-b)", color: "var(--ink)" }}>{tableSession.rounds} {tableSession.rounds === 1 ? "rodada" : "rodadas"}</b>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="no-scrollbar" style={{ marginTop: 18, display: "flex", gap: 8, overflowX: "auto", padding: "0 var(--pad) 2px" }}>
            <Pill active={activeCategory === "Todos"} onClick={() => setActiveCategory("Todos")}>Todos</Pill>
            {categories.map((c) => (
              <Pill key={c.id} active={activeCategory === c.id} onClick={() => setActiveCategory(c.id)}>
                {c.name}
              </Pill>
            ))}
          </div>

          <div style={{ padding: "16px var(--pad) 0", display: "grid", gridTemplateColumns: "repeat(var(--cols), minmax(0,1fr))", gap: 14 }}>
            {visibleItems.map((item) => (
              <div key={item.id} className="card" style={{ overflow: "hidden", display: "flex", flexDirection: "column", opacity: item.soldOut ? 0.55 : 1 }}>
                <div onClick={() => navigate(`/r/${restaurantId}/item/${item.id}`)} style={{ cursor: "pointer" }}>
                  <div className="photo-placeholder" style={{ position: "relative", height: "var(--photo)" }}>
                    <span style={{ font: "500 10px var(--font)", letterSpacing: ".06em", color: "var(--ink2)", padding: "0 8px", textAlign: "center" }}>{item.photoLabel}</span>
                    {!item.soldOut && item.tag && (
                      <div style={{ position: "absolute", top: 8, left: 8, display: "flex", alignItems: "center", gap: 6, padding: "5px 9px", borderRadius: 999, background: "var(--pri)", color: "var(--priInk)", font: "600 var(--t-xs) var(--font)" }}>
                        <i className={item.tagIcon || ""} style={{ fontSize: "var(--i-s)" }} />{item.tag}
                      </div>
                    )}
                    {item.soldOut && (
                      <div style={{ position: "absolute", inset: 0, background: "rgba(2,3,4,.42)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 12px", borderRadius: 999, background: "var(--bg)", color: "var(--ink)", font: "700 var(--t-s) var(--font)" }}>
                          <i className="fa-solid fa-ban" style={{ fontSize: "var(--i-s)", color: "var(--acc)" }} />Esgotado
                        </span>
                      </div>
                    )}
                  </div>
                  <div style={{ padding: "16px 18px 0" }}>
                    <div style={{ font: "600 var(--t-m) var(--font)", letterSpacing: "-.015em" }}>{item.name}</div>
                    <div style={{ marginTop: 5, font: "400 var(--t-s) var(--font)", color: "var(--ink2)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {item.shortDescription}
                    </div>
                  </div>
                </div>
                <div style={{ padding: "14px 18px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ font: "700 var(--t-m) var(--font)", letterSpacing: "-.02em" }}>{formatMoney(item.price)}</div>
                  {!item.soldOut ? (
                    <button
                      type="button"
                      title="Adicionar"
                      onClick={() => quickAdd(item)}
                      className="tap"
                      style={{ flex: "none", width: "var(--fab)", height: "var(--fab)", borderRadius: 999, border: "none", cursor: "pointer", background: "var(--pri)", color: "var(--priInk)", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <i className="fa-solid fa-plus" style={{ fontSize: "var(--i-m)" }} />
                    </button>
                  ) : (
                    <span style={{ font: "500 var(--t-xs) var(--font)", color: "var(--ink2)", letterSpacing: ".06em" }}>indisponível</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div style={{ height: isMesa ? 116 : 104 }} />
        </div>
      )}

      <BottomBar />
      <SupportFab />
      <Toast />
    </div>
  );
}
