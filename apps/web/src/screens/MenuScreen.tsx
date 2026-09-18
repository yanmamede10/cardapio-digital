import type { MenuCategory, MenuItem, PublicAppearance, Restaurant } from "@cardapio/shared";
import { onColor } from "@cardapio/shared";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BottomBar, SupportFab } from "../components/FloatingControls";
import { IconButton } from "../components/IconButton";
import { CategoryNav } from "../components/menu/CategoryNav";
import { ItemCard } from "../components/menu/ItemCard";
import { MenuSkeleton } from "../components/Skeletons";
import { Toast } from "../components/Toast";
import { useApp } from "../context/AppContext";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { formatMoney, formatRating } from "../lib/format";
import { computeSelectedOptions, computeUnitPrice, defaultDraft } from "../lib/itemDraft";

const DEFAULT_APPEARANCE: PublicAppearance = { template: "classico", brandColor: "#732009", logoUrl: null, coverPhotos: [], publishedAt: null };
const GALLERY_HEIGHTS = [196, 148, 222, 164, 206, 144, 184, 228];

export default function MenuScreen() {
  const { restaurantId = "" } = useParams();
  const navigate = useNavigate();
  const { mode, tableNumber, guestName, setGuestName, setActiveRestaurant, theme, toggleTheme, tableSession, addressId } = useApp();
  const { addLine } = useCart();
  const { showToast } = useToast();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[] | null>(null);
  const [appearance, setAppearance] = useState<PublicAppearance>(DEFAULT_APPEARANCE);
  const [activeCategory, setActiveCategory] = useState<string>("Todos");
  const [addressLabel, setAddressLabel] = useState("");

  const isMesa = mode === "table";
  const isDelivery = !isMesa;

  useEffect(() => {
    setActiveRestaurant(restaurantId);
    setRestaurant(null);
    setItems(null);
    setAppearance(DEFAULT_APPEARANCE);
    setActiveCategory("Todos");
    Promise.all([api.getRestaurant(restaurantId), api.getCategories(restaurantId), api.getItems(restaurantId)])
      .then(([r, c, i]) => {
        setRestaurant(r);
        setCategories(c);
        setItems(i);
      })
      .catch(() => showToast("Não foi possível carregar o cardápio", "fa-solid fa-triangle-exclamation"));
    // Appearance is a soft-fail enhancement — the menu itself must not break if this one fails.
    api.getAppearance(restaurantId).then(setAppearance).catch(() => {});

    // Poll for availability (soldOut toggled from the dashboard) — same recurring-fetch idiom
    // used elsewhere (order status every 3s, table map every 10s); 12s is plenty here since
    // this only needs to reflect availability, not drive an instant UI change.
    const id = setInterval(() => {
      api.getItems(restaurantId).then(setItems).catch(() => {});
    }, 12000);
    return () => clearInterval(id);
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
  const openItem = (item: MenuItem) => navigate(`/r/${restaurantId}/item/${item.id}`);

  const loading = !restaurant || items === null;

  if (loading) {
    return (
      <div className="screen">
        <MenuSkeleton />
        <BottomBar />
        <SupportFab />
        <Toast />
      </div>
    );
  }

  const brandVars = { "--pri": appearance.brandColor, "--priInk": onColor(appearance.brandColor) } as CSSProperties;
  const cover = appearance.coverPhotos[0];
  const coverStyle: CSSProperties = cover ? { backgroundImage: `url(${cover})`, backgroundSize: "cover", backgroundPosition: "center" } : {};
  const logo = appearance.logoUrl;

  const themeButton = (right?: boolean) => (
    <IconButton icon={theme === "dark" ? "fa-solid fa-sun" : "fa-solid fa-moon"} onClick={toggleTheme} title="Alternar tema" glass style={right ? { marginLeft: "auto" } : undefined} />
  );

  /** Address switcher (delivery) / guest-name field (mesa) — identical in every template, just placed in different headers. */
  const EntryContextRow = () =>
    isDelivery ? (
      <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "16px 18px", borderRadius: "var(--r-standard)", background: "var(--surf)", border: "1px solid var(--line)" }}>
        <i className="fa-solid fa-location-dot" style={{ fontSize: "var(--i-m)", color: "var(--acc)" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mono-label">entregar em</div>
          <div style={{ marginTop: 3, font: "600 var(--t-b) var(--font)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{addressLabel}</div>
        </div>
        <button type="button" onClick={() => navigate("/checkout")} style={{ border: "1px solid var(--line)", background: "transparent", color: "var(--acc)", cursor: "pointer", borderRadius: 999, padding: "8px 13px", font: "600 var(--t-s) var(--font)" }}>
          Trocar
        </button>
      </div>
    ) : (
      <div style={{ display: "flex", gap: 11, alignItems: "center", padding: "16px 18px", borderRadius: "var(--r-standard)", background: "var(--surf)", border: "1px solid var(--line)" }}>
        <i className="fa-solid fa-user" style={{ fontSize: "var(--i-m)", color: "var(--acc)" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mono-label">seu nome (opcional)</div>
          <input
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="para o garçom te chamar"
            maxLength={120}
            style={{ marginTop: 3, width: "100%", border: "none", background: "transparent", outline: "none", color: "var(--ink)", font: "600 var(--t-b) var(--font)" }}
          />
        </div>
        {tableSession.rounds > 0 && (
          <div style={{ textAlign: "right", font: "500 var(--t-xs) var(--font)", color: "var(--ink2)" }}>
            comanda<br /><b style={{ fontSize: "var(--t-b)", color: "var(--ink)" }}>{tableSession.rounds} {tableSession.rounds === 1 ? "rodada" : "rodadas"}</b>
          </div>
        )}
      </div>
    );

  const deliveryOrMesaBadge = (glass: boolean) =>
    isMesa ? (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", borderRadius: 999, background: glass ? "rgba(2,3,4,.55)" : "rgba(252,247,211,.16)", border: glass ? undefined : "1px solid rgba(252,247,211,.46)", backdropFilter: glass ? "blur(6px)" : undefined, color: "#FCF7D3", font: "600 var(--t-s) var(--font)" }}>
        <i className="fa-solid fa-qrcode" style={{ fontSize: "var(--i-s)", color: "#CD8C52" }} />Mesa {tableNumber}
      </div>
    ) : (
      <IconButton icon="fa-solid fa-arrow-left" onClick={() => navigate("/")} title="Voltar" glass={glass} />
    );

  const rating = (
    <span style={{ display: "inline-flex", gap: 3, color: "var(--acc)", fontSize: "var(--i-s)" }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <i key={i} className="fa-solid fa-star" style={{ opacity: i === 4 ? 0.32 : 1 }} />
      ))}
    </span>
  );

  const categoryNav = (variant: "pill" | "vibrant" | "text") => <CategoryNav categories={categories} active={activeCategory} onPick={setActiveCategory} variant={variant} />;
  const bottomSpacer = <div style={{ height: isMesa ? 116 : 104 }} />;
  const logoCircle = (size: number, radius: number) =>
    logo ? (
      <img src={logo} alt="" style={{ width: size, height: size, borderRadius: radius, objectFit: "cover", display: "block" }} />
    ) : (
      restaurant.initials
    );

  let content: ReactNode;

  if (appearance.template === "moderno") {
    const featured = visibleItems.filter((it) => !it.soldOut).slice(0, 3);
    content = (
      <div className="scroll no-scrollbar">
        <div className="photo-placeholder" style={{ position: "relative", height: "calc(var(--banner) + 76px)", ...coverStyle }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top,rgba(2,3,4,.82),rgba(2,3,4,.28) 52%,rgba(2,3,4,.06))" }} />
          <div style={{ position: "absolute", top: 12, left: 12, right: 12, display: "flex", alignItems: "center", gap: 8 }}>
            {deliveryOrMesaBadge(true)}
            {themeButton(true)}
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "0 var(--pad) 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 999, background: "rgba(252,247,211,.94)", color: "#24160F", fontWeight: 600, fontSize: "var(--t-xs)", letterSpacing: ".1em", textTransform: "uppercase" }}>
              <i className="fa-solid fa-circle-check" style={{ fontSize: "var(--i-s)", color: "#2F7A4F" }} />aberto agora
            </div>
            <div style={{ fontWeight: 700, fontSize: "calc(var(--t-xl) * 1.14)", lineHeight: 1.04, letterSpacing: "-.03em", color: "#FFF7EC" }}>{restaurant.name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", color: "#F0E4C4", fontWeight: 500, fontSize: "var(--t-s)" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><i className="fa-solid fa-star" style={{ fontSize: "var(--i-s)", color: "#CD8C52" }} /><b style={{ color: "#FFF7EC" }}>{formatRating(restaurant.rating)}</b>({restaurant.reviewCount})</span>
              <span>{restaurant.cuisine}</span>
              <span style={{ opacity: 0.55 }}>·</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><i className="fa-solid fa-clock" style={{ fontSize: "var(--i-s)" }} />11:00 – 23:00</span>
            </div>
          </div>
        </div>

        <div style={{ padding: "16px var(--pad) 0" }}>
          <EntryContextRow />
        </div>

        <div style={{ padding: "20px var(--pad) 0", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontWeight: 700, fontSize: "var(--t-l)", letterSpacing: "-.025em" }}>Destaques</div>
          <div style={{ fontWeight: 500, fontSize: "var(--t-xs)", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ink2)" }}>escolhas da casa</div>
        </div>
        <div className="no-scrollbar" style={{ marginTop: 12, display: "flex", gap: 14, overflowX: "auto", padding: "0 var(--pad) 4px" }}>
          {featured.map((it) => (
            <ItemCard key={it.id} item={it} variant="grid" width="calc(var(--photo) * 2)" showDescription={false} onOpen={() => openItem(it)} onQuickAdd={() => quickAdd(it)} />
          ))}
        </div>

        <div className="no-scrollbar" style={{ marginTop: 22, display: "flex", gap: 8, overflowX: "auto", padding: "0 var(--pad) 2px" }}>{categoryNav("pill")}</div>

        <div style={{ padding: "16px var(--pad) 0", display: "flex", flexDirection: "column", gap: 12 }}>
          {visibleItems.map((it) => (
            <ItemCard key={it.id} item={it} variant="wide" onOpen={() => openItem(it)} onQuickAdd={() => quickAdd(it)} />
          ))}
        </div>
        {bottomSpacer}
      </div>
    );
  } else if (appearance.template === "minimalista") {
    content = (
      <div className="scroll no-scrollbar">
        <div style={{ padding: "calc(var(--pad) + 6px) var(--pad) 0", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 500, fontSize: "var(--t-xs)", letterSpacing: ".16em", textTransform: "uppercase", color: "var(--ink2)" }}>
              {isMesa ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><i className="fa-solid fa-qrcode" style={{ fontSize: "var(--i-s)", color: "var(--acc)" }} />mesa {tableNumber}</span>
              ) : (
                <span>entrega · {restaurant.etaMinMinutes}–{restaurant.etaMaxMinutes} min</span>
              )}
              <span style={{ opacity: 0.45 }}>·</span>
              <span>aberto</span>
            </div>
            <div style={{ marginTop: 14, fontWeight: 700, fontSize: "calc(var(--t-xl) * 1.34)", lineHeight: 1.02, letterSpacing: "-.04em", textWrap: "pretty" }}>{restaurant.name}</div>
            <div style={{ marginTop: 12, fontWeight: 400, fontSize: "var(--t-b)", lineHeight: 1.55, color: "var(--ink2)" }}>{restaurant.cuisine} · {formatRating(restaurant.rating)} de 5 em {restaurant.reviewCount} avaliações</div>
          </div>
          {themeButton()}
        </div>

        <div style={{ padding: "16px var(--pad) 0" }}>
          <EntryContextRow />
        </div>

        <div className="no-scrollbar" style={{ marginTop: 22, padding: "0 var(--pad)", display: "flex", gap: 20, overflowX: "auto", borderBottom: "1px solid var(--line)" }}>{categoryNav("text")}</div>

        <div style={{ padding: "8px var(--pad) 0" }}>
          {visibleItems.map((it) => (
            <ItemCard key={it.id} item={it} variant="row" rowLayout="inline" onOpen={() => openItem(it)} onQuickAdd={() => quickAdd(it)} />
          ))}
        </div>
        {bottomSpacer}
      </div>
    );
  } else if (appearance.template === "vibrante") {
    content = (
      <div className="scroll no-scrollbar" style={{ background: "var(--vibBg)" }}>
        <div style={{ background: "var(--vibHead)", borderRadius: "0 0 var(--vibHeadR) var(--vibHeadR)", paddingBottom: "var(--vibHeadPad)" }}>
          <div style={{ padding: "calc(var(--pad) + 4px) var(--pad) 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: "none", width: 44, height: 44, borderRadius: 18, background: "#FCF7D3", color: "#732009", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "var(--t-b)", letterSpacing: "-.02em", overflow: "hidden" }}>{logoCircle(44, 18)}</div>
              {isMesa && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 13px", borderRadius: 999, background: "rgba(252,247,211,.16)", border: "1px solid rgba(252,247,211,.46)", color: "#FCF7D3", fontWeight: 600, fontSize: "var(--t-s)" }}>
                  <i className="fa-solid fa-qrcode" style={{ fontSize: "var(--i-s)" }} />Mesa {tableNumber}
                </div>
              )}
              {isDelivery && (
                <button type="button" onClick={() => navigate("/")} title="Voltar" style={{ border: "1px solid rgba(252,247,211,.46)", background: "rgba(252,247,211,.16)", color: "#FCF7D3", cursor: "pointer", borderRadius: 999, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <i className="fa-solid fa-arrow-left" style={{ fontSize: "var(--i-m)" }} />
                </button>
              )}
              <button type="button" onClick={toggleTheme} title="Alternar tema" style={{ marginLeft: "auto", border: "1px solid rgba(252,247,211,.46)", background: "rgba(252,247,211,.16)", color: "#FCF7D3", cursor: "pointer", borderRadius: 999, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <i className={theme === "dark" ? "fa-solid fa-sun" : "fa-solid fa-moon"} style={{ fontSize: "var(--i-m)" }} />
              </button>
            </div>
            <div style={{ marginTop: 18, fontWeight: 700, fontSize: "calc(var(--t-xl) * 1.1)", lineHeight: 1.04, letterSpacing: "-.03em", color: "#FCF7D3" }}>{restaurant.name}</div>
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontWeight: 500, fontSize: "var(--t-s)", color: "#F2E3BE" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><i className="fa-solid fa-star" style={{ fontSize: "var(--i-s)", color: "#FCF7D3" }} /><b style={{ color: "#FCF7D3" }}>{formatRating(restaurant.rating)}</b>({restaurant.reviewCount})</span>
              <span>{restaurant.cuisine}</span>
              <span style={{ opacity: 0.55 }}>·</span>
              <span>11:00 – 23:00</span>
            </div>
          </div>
          <div className="no-scrollbar" style={{ marginTop: 20, display: "flex", gap: 8, overflowX: "auto", padding: "0 var(--pad) 2px" }}>{categoryNav("vibrant")}</div>
        </div>

        <div style={{ padding: "18px var(--pad) 0" }}>
          <EntryContextRow />
        </div>

        <div style={{ padding: "18px var(--pad) 0", display: "grid", gridTemplateColumns: "repeat(var(--cols), minmax(0,1fr))", gap: 14 }}>
          {visibleItems.map((it) => (
            <ItemCard key={it.id} item={it} variant="tile" onOpen={() => openItem(it)} onQuickAdd={() => quickAdd(it)} />
          ))}
        </div>
        {bottomSpacer}
      </div>
    );
  } else if (appearance.template === "editorial") {
    content = (
      <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
        <div className="photo-placeholder" style={{ flex: "none", width: "38%", position: "relative", ...coverStyle }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top,rgba(2,3,4,.84),rgba(2,3,4,.34) 58%,rgba(2,3,4,.12))" }} />
          <div style={{ position: "absolute", top: 12, left: 12, right: 12, display: "flex" }}>
            {isDelivery && <IconButton icon="fa-solid fa-arrow-left" onClick={() => navigate("/")} title="Voltar" glass />}
            {themeButton(true)}
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "18px 16px 136px", display: "flex", flexDirection: "column", gap: 9 }}>
            <div style={{ fontWeight: 500, fontSize: "var(--t-xs)", letterSpacing: ".18em", textTransform: "uppercase", color: "#E4D3A8" }}>cardápio</div>
            <div style={{ fontWeight: 700, fontSize: "var(--t-l)", lineHeight: 1.06, letterSpacing: "-.03em", color: "#FFF7EC", textWrap: "pretty" }}>{restaurant.name}</div>
            <div style={{ fontWeight: 500, fontSize: "var(--t-xs)", lineHeight: 1.5, color: "#E4D3A8" }}>{restaurant.cuisine}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 600, fontSize: "var(--t-xs)", color: "#FFF7EC" }}>
              <i className="fa-solid fa-star" style={{ fontSize: "var(--i-s)", color: "#CD8C52" }} />{formatRating(restaurant.rating)}
              {isMesa && (<><span style={{ opacity: 0.5 }}>·</span><span>Mesa {tableNumber}</span></>)}
            </div>
          </div>
        </div>

        <div className="scroll no-scrollbar" style={{ flex: 1, minWidth: 0 }}>
          <div style={{ padding: "14px 16px 0" }}>
            <EntryContextRow />
          </div>
          <div style={{ position: "sticky", top: 0, zIndex: 2, padding: "14px 16px 0", background: "var(--glass)", backdropFilter: "saturate(180%) blur(22px)" }}>
            <div className="no-scrollbar" style={{ display: "flex", gap: 18, overflowX: "auto", borderBottom: "1px solid var(--line)" }}>{categoryNav("text")}</div>
          </div>
          <div style={{ padding: "16px 16px 0" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontWeight: 700, fontSize: "var(--t-m)", letterSpacing: "-.02em" }}>{activeCategory === "Todos" ? "Cardápio completo" : categories.find((c) => c.id === activeCategory)?.name}</div>
              <div style={{ fontWeight: 500, fontSize: "var(--t-xs)", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink2)" }}>{visibleItems.length} {visibleItems.length === 1 ? "item" : "itens"}</div>
            </div>
            {visibleItems.map((it) => (
              <ItemCard key={it.id} item={it} variant="row" rowLayout="stacked" onOpen={() => openItem(it)} onQuickAdd={() => quickAdd(it)} />
            ))}
            {bottomSpacer}
          </div>
        </div>
      </div>
    );
  } else if (appearance.template === "galeria") {
    content = (
      <div className="scroll no-scrollbar">
        <div style={{ position: "sticky", top: 0, zIndex: 3, display: "flex", alignItems: "center", gap: 12, padding: "12px var(--pad)", background: "var(--glass)", backdropFilter: "saturate(180%) blur(22px)", borderBottom: "1px solid var(--line)" }}>
          <div style={{ flex: "none", width: 38, height: 38, borderRadius: 14, background: "var(--pri)", color: "var(--priInk)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "var(--t-s)", letterSpacing: "-.01em", overflow: "hidden" }}>{logoCircle(38, 14)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: "var(--t-b)", lineHeight: 1.2, letterSpacing: "-.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{restaurant.name}</div>
            <div style={{ marginTop: 2, display: "flex", alignItems: "center", gap: 7, fontWeight: 500, fontSize: "var(--t-xs)", color: "var(--ink2)" }}>
              <i className="fa-solid fa-star" style={{ fontSize: "var(--i-s)", color: "var(--acc)" }} />{formatRating(restaurant.rating)}
              {isMesa && (<><span style={{ opacity: 0.5 }}>·</span><span>Mesa {tableNumber}</span></>)}
            </div>
          </div>
          {isDelivery && <IconButton icon="fa-solid fa-arrow-left" onClick={() => navigate("/")} title="Voltar" />}
          {themeButton()}
        </div>

        <div style={{ padding: "14px var(--pad) 0" }}>
          <EntryContextRow />
        </div>

        <div className="no-scrollbar" style={{ display: "flex", gap: 8, overflowX: "auto", padding: "14px var(--pad) 2px" }}>{categoryNav("pill")}</div>

        <div style={{ padding: "14px var(--pad) 0", columnCount: "var(--cols)" as unknown as number, columnGap: 12 }}>
          {visibleItems.map((it, i) => (
            <ItemCard key={it.id} item={it} variant="gallery" photoHeight={`${GALLERY_HEIGHTS[i % GALLERY_HEIGHTS.length]}px`} onOpen={() => openItem(it)} onQuickAdd={() => quickAdd(it)} />
          ))}
        </div>
        {bottomSpacer}
      </div>
    );
  } else {
    // classico — the original, still the default template.
    content = (
      <div className="scroll no-scrollbar">
        <div className="photo-placeholder" style={{ position: "relative", height: "var(--banner)", ...coverStyle }}>
          {!cover && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", font: "500 10px var(--font)", letterSpacing: ".08em", color: "var(--ink2)" }}>foto · fachada / salão</div>}
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "64%", background: "linear-gradient(to top,rgba(2,3,4,.58),rgba(2,3,4,0))" }} />
          <div style={{ position: "absolute", top: 12, left: 12, right: 12, display: "flex", alignItems: "center", gap: 8 }}>
            {deliveryOrMesaBadge(true)}
            <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
              {isDelivery && (
                <button type="button" onClick={() => showToast("Chat de suporte abrindo…", "fa-solid fa-headset")} style={{ border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, padding: "8px 13px", borderRadius: 999, background: "rgba(2,3,4,.55)", backdropFilter: "blur(6px)", color: "#FCF7D3", font: "600 var(--t-s) var(--font)" }}>
                  <i className="fa-solid fa-headset" style={{ fontSize: "var(--i-s)" }} />Suporte
                </button>
              )}
              {themeButton()}
            </div>
          </div>
        </div>

        <div style={{ padding: "0 var(--pad)" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: -30 }}>
            <div style={{ width: 66, height: 66, borderRadius: "var(--r-elevated)", background: "var(--pri)", border: "3px solid var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--priInk)", font: "700 20px var(--font)", letterSpacing: "-.02em", overflow: "hidden" }}>{logoCircle(66, 24)}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", borderRadius: 999, background: "var(--surf)", border: "1px solid var(--line)", font: "600 var(--t-s) var(--font)" }}>
              <i className="fa-solid fa-circle-check" style={{ fontSize: "var(--i-s)", color: "var(--good)" }} />Aberto agora
            </div>
          </div>
          <div style={{ marginTop: 12, font: "700 var(--t-xl) var(--font)", letterSpacing: "-.025em" }}>{restaurant.name}</div>
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", font: "500 var(--t-s) var(--font)", color: "var(--ink2)" }}>
            {rating}
            <span style={{ fontWeight: 700, color: "var(--ink)" }}>{formatRating(restaurant.rating)}</span>
            <span>{restaurant.reviewCount} avaliações</span>
            <span style={{ opacity: 0.5 }}>·</span>
            <span>{restaurant.cuisine}</span>
          </div>
          <div style={{ marginTop: 7, display: "flex", alignItems: "center", gap: 7, font: "500 var(--t-s) var(--font)", color: "var(--ink2)" }}>
            <i className="fa-solid fa-clock" style={{ fontSize: "var(--i-s)" }} />Hoje 11:00 – 23:00
          </div>

          {isDelivery && (
            <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", font: "500 var(--t-s) var(--font)", color: "var(--ink2)" }}>
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
          )}

          <div style={{ marginTop: 14 }}>
            <EntryContextRow />
          </div>
        </div>

        <div className="no-scrollbar" style={{ marginTop: 18, display: "flex", gap: 8, overflowX: "auto", padding: "0 var(--pad) 2px" }}>{categoryNav("pill")}</div>

        <div style={{ padding: "16px var(--pad) 0", display: "grid", gridTemplateColumns: "repeat(var(--cols), minmax(0,1fr))", gap: 14 }}>
          {visibleItems.map((it) => (
            <ItemCard key={it.id} item={it} variant="grid" onOpen={() => openItem(it)} onQuickAdd={() => quickAdd(it)} />
          ))}
        </div>
        {bottomSpacer}
      </div>
    );
  }

  return (
    <div className="screen" style={brandVars}>
      {content}
      <BottomBar />
      <SupportFab />
      <Toast />
    </div>
  );
}
