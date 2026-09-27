import type { Restaurant } from "@cardapio/shared";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DiscoveryListSkeleton } from "../components/Skeletons";
import { IconButton } from "../components/IconButton";
import { Pill } from "../components/Pill";
import { SupportFab } from "../components/FloatingControls";
import { useApp } from "../context/AppContext";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { formatMoney, formatRating } from "../lib/format";

const CUISINES = [
  { label: "Todos", icon: "fa-solid fa-border-all" },
  { label: "Pizza", icon: "fa-solid fa-pizza-slice" },
  { label: "Hambúrguer", icon: "fa-solid fa-burger" },
  { label: "Japonesa", icon: "fa-solid fa-fish" },
  { label: "Brasileira", icon: "fa-solid fa-drumstick-bite" },
  { label: "Doces", icon: "fa-solid fa-ice-cream" }
];

const SORTS = [
  { id: "near", label: "Mais próximo", icon: "fa-solid fa-location-crosshairs" },
  { id: "rating", label: "Melhor avaliado", icon: "fa-solid fa-star" },
  { id: "time", label: "Menor tempo", icon: "fa-solid fa-clock" },
  { id: "fee", label: "Taxa de entrega", icon: "fa-solid fa-motorcycle" }
];

const BANNERS = [
  { restaurantId: "fogo", kicker: "Promoção", title: "20% off em grelhados", sub: "Fogo & Nó · até domingo", icon: "fa-solid fa-tag" },
  { restaurantId: "napoli", kicker: "Frete grátis", title: "Pizzas sem taxa hoje", sub: "Forno di Napoli · pedidos acima de R$ 60", icon: "fa-solid fa-motorcycle" }
];

export default function DiscoveryScreen() {
  const navigate = useNavigate();
  const { mode, restaurantId, theme, toggleTheme, addressId, setAddressId } = useApp();
  const { showToast } = useToast();

  const [query, setQuery] = useState("");
  const [cuisine, setCuisine] = useState("Todos");
  const [sort, setSort] = useState("near");
  const [restaurants, setRestaurants] = useState<Restaurant[] | null>(null);
  const [addressLabel, setAddressLabel] = useState("Escolha um endereço");

  // Table mode has no discovery — bounce straight back to the resolved table's menu.
  useEffect(() => {
    if (mode === "table" && restaurantId) navigate(`/r/${restaurantId}/menu`, { replace: true });
  }, [mode, restaurantId, navigate]);

  useEffect(() => {
    api.getAddresses().then((list) => {
      const def = list.find((a) => a.id === addressId) || list.find((a) => a.isDefault) || list[0];
      if (def) {
        if (!addressId) setAddressId(def.id);
        setAddressLabel(def.detail);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      api
        .listRestaurants({ query, cuisine, sort })
        .then(setRestaurants)
        .catch(() => showToast("Não foi possível carregar os restaurantes", "fa-solid fa-triangle-exclamation"));
    }, 220);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, cuisine, sort]);

  const openRestaurant = (r: Restaurant) => {
    if (!r.isOpen) {
      showToast(`${r.name} · ${r.reopensAt}`, "fa-solid fa-clock");
      return;
    }
    navigate(`/r/${r.id}/menu`);
  };

  if (mode === "table") return null;

  return (
    <div className="screen">
      <div style={{ flex: "none", padding: "calc(var(--pad) - 2px) var(--pad)", background: "var(--glass)", backdropFilter: "saturate(180%) blur(22px)", WebkitBackdropFilter: "saturate(180%) blur(22px)", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="button"
          onClick={() => navigate("/checkout")}
          style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10, border: "none", background: "transparent", padding: 0, cursor: "pointer", textAlign: "left", color: "var(--ink)" }}
        >
          <i className="fa-solid fa-location-dot" style={{ fontSize: "var(--i-m)", color: "var(--acc)" }} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="mono-label" style={{ display: "block" }}>entregar em</span>
            <span style={{ display: "block", marginTop: 2, font: "600 var(--t-b) var(--font)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {addressLabel}
            </span>
          </span>
          <i className="fa-solid fa-chevron-down" style={{ fontSize: "var(--i-s)", color: "var(--ink2)" }} />
        </button>
        <IconButton icon={theme === "dark" ? "fa-solid fa-sun" : "fa-solid fa-moon"} onClick={toggleTheme} title="Alternar tema" />
        <IconButton icon="fa-solid fa-user" onClick={() => navigate("/history")} title="Minha conta" />
      </div>

      {restaurants === null ? (
        <DiscoveryListSkeleton />
      ) : (
        <div className="scroll no-scrollbar">
          <div style={{ padding: "var(--pad) var(--pad) 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "16px 18px", borderRadius: "var(--r-standard)", background: "var(--surf)", border: "1px solid var(--line)" }}>
              <i className="fa-solid fa-magnifying-glass" style={{ fontSize: "var(--i-m)", color: "var(--ink2)" }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar restaurante ou prato"
                style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", outline: "none", color: "var(--ink)", font: "500 var(--t-b) var(--font)" }}
              />
              {query.length > 0 && (
                <button type="button" title="Limpar" aria-label="Limpar busca" onClick={() => setQuery("")} className="tap" style={{ width: 44, height: 44, margin: "-11px -11px -11px 0", border: "none", background: "transparent", cursor: "pointer", color: "var(--ink2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <i className="fa-solid fa-circle-xmark" style={{ fontSize: "var(--i-m)" }} />
                </button>
              )}
            </div>
          </div>

          <div className="no-scrollbar" style={{ marginTop: 14, display: "flex", gap: 8, overflowX: "auto", padding: "0 var(--pad) 2px" }}>
            {CUISINES.map((c) => (
              <Pill key={c.label} icon={c.icon} active={cuisine === c.label} onClick={() => setCuisine(c.label)}>
                {c.label}
              </Pill>
            ))}
          </div>

          <div className="no-scrollbar" style={{ marginTop: 18, display: "flex", gap: 12, overflowX: "auto", padding: "0 var(--pad) 4px" }}>
            {BANNERS.map((b, i) => (
              <div
                key={b.restaurantId}
                onClick={() => navigate(`/r/${b.restaurantId}/menu`)}
                style={{
                  position: "relative", flex: "none", width: "min(84vw, 300px)", height: 156, borderRadius: "var(--r-standard)", overflow: "hidden", cursor: "pointer",
                  backgroundColor: "var(--surf2)",
                  backgroundImage: `repeating-linear-gradient(${i ? 115 : 135}deg,rgba(205,140,82,.34) 0 8px,rgba(205,140,82,.12) 8px 16px)`
                }}
              >
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(105deg,rgba(2,3,4,.72),rgba(2,3,4,.18))" }} />
                <div style={{ position: "relative", padding: "16px 18px", display: "flex", flexDirection: "column", height: "100%", boxSizing: "border-box" }}>
                  <div style={{ display: "inline-flex", alignSelf: "flex-start", alignItems: "center", gap: 7, padding: "6px 11px", borderRadius: 999, background: "var(--pri)", color: "var(--priInk)", font: "600 var(--t-xs) var(--font)" }}>
                    <i className={b.icon} style={{ fontSize: "var(--i-s)" }} />{b.kicker}
                  </div>
                  <div style={{ marginTop: "auto", font: "700 var(--t-l) var(--font)", letterSpacing: "-.02em", color: "#FCF7D3" }}>{b.title}</div>
                  <div style={{ marginTop: 5, font: "500 var(--t-s) var(--font)", color: "rgba(252,247,211,.82)" }}>{b.sub}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20, padding: "0 var(--pad)", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, font: "700 var(--t-m) var(--font)", letterSpacing: "-.02em" }}>
              {cuisine === "Todos" ? "Restaurantes perto de você" : cuisine}
            </div>
            <div style={{ font: "500 var(--t-s) var(--font)", color: "var(--ink2)" }}>
              {restaurants.length} {restaurants.length === 1 ? "lugar" : "lugares"}
            </div>
          </div>

          <div className="no-scrollbar" style={{ marginTop: 10, display: "flex", gap: 8, overflowX: "auto", padding: "0 var(--pad) 2px" }}>
            {SORTS.map((s) => (
              <Pill key={s.id} icon={s.icon} active={sort === s.id} onClick={() => setSort(s.id)}>
                {s.label}
              </Pill>
            ))}
          </div>

          <div style={{ padding: "16px var(--pad) 0", display: "grid", gridTemplateColumns: "repeat(var(--cols2), minmax(0,1fr))", gap: 14 }}>
            {restaurants.map((r) => (
              <div
                key={r.id}
                onClick={() => openRestaurant(r)}
                className="card"
                style={{ overflow: "hidden", cursor: "pointer", opacity: r.isOpen ? 1 : 0.62 }}
              >
                <div className="photo-placeholder" style={{ position: "relative", height: "var(--cover)" }}>
                  <span style={{ font: "500 10px var(--font)", letterSpacing: ".06em", color: "var(--ink2)" }}>{r.coverLabel}</span>
                  {r.isOpen && r.promoLabel && (
                    <div style={{ position: "absolute", top: 10, left: 10, display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 999, background: "var(--pri)", color: "var(--priInk)", font: "600 var(--t-xs) var(--font)" }}>
                      <i className="fa-solid fa-tag" style={{ fontSize: "var(--i-s)" }} />{r.promoLabel}
                    </div>
                  )}
                  <div style={{ position: "absolute", top: 10, right: 10, display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 999, backdropFilter: "blur(6px)", background: "rgba(2,3,4,.55)", color: r.isOpen ? "#8FD6A6" : "#E8B4A4", font: "600 var(--t-xs) var(--font)" }}>
                    <i className={r.isOpen ? "fa-solid fa-circle-check" : "fa-solid fa-circle-xmark"} style={{ fontSize: "var(--i-s)" }} />
                    {r.isOpen ? "Aberto" : "Fechado"}
                  </div>
                  {!r.isOpen && (
                    <div style={{ position: "absolute", inset: 0, background: "rgba(2,3,4,.46)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 999, background: "var(--bg)", color: "var(--ink)", font: "600 var(--t-s) var(--font)" }}>
                        <i className="fa-solid fa-clock" style={{ fontSize: "var(--i-s)", color: "var(--acc)" }} />{r.reopensAt}
                      </span>
                    </div>
                  )}
                </div>
                <div style={{ padding: "16px 18px 18px", display: "flex", gap: 12 }}>
                  <div style={{ flex: "none", width: 44, height: 44, borderRadius: "var(--r-standard)", background: "var(--pri)", color: "var(--priInk)", display: "flex", alignItems: "center", justifyContent: "center", font: "700 var(--t-s) var(--font)", letterSpacing: "-.01em" }}>
                    {r.initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: "600 var(--t-m) var(--font)", letterSpacing: "-.015em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
                    <div style={{ marginTop: 4, font: "400 var(--t-s) var(--font)", color: "var(--ink2)" }}>{r.cuisine}</div>
                    <div style={{ marginTop: 9, display: "flex", alignItems: "center", gap: 13, flexWrap: "wrap", font: "500 var(--t-s) var(--font)", color: "var(--ink2)" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <i className="fa-solid fa-star" style={{ fontSize: "var(--i-s)", color: "var(--acc)" }} />
                        <b style={{ color: "var(--ink)" }}>{formatRating(r.rating)}</b>({r.reviewCount})
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <i className="fa-solid fa-clock" style={{ fontSize: "var(--i-s)" }} />{r.etaMinMinutes}–{r.etaMaxMinutes} min
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: r.deliveryFee === 0 ? "var(--good)" : "var(--ink2)", fontWeight: r.deliveryFee === 0 ? 600 : 500 }}>
                        <i className="fa-solid fa-motorcycle" style={{ fontSize: "var(--i-s)" }} />{r.deliveryFee === 0 ? "Grátis" : formatMoney(r.deliveryFee)}
                      </span>
                    </div>
                  </div>
                  <i className="fa-solid fa-chevron-right" style={{ alignSelf: "center", fontSize: "var(--i-s)", color: "var(--ink2)" }} />
                </div>
              </div>
            ))}
          </div>

          {restaurants.length === 0 && (
            <div style={{ padding: "40px var(--pad)", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 14 }}>
              <i className="fa-solid fa-magnifying-glass" style={{ fontSize: 38, color: "var(--ink2)", opacity: 0.5 }} />
              <div style={{ font: "700 var(--t-m) var(--font)" }}>Nada encontrado</div>
              <div style={{ maxWidth: 260, font: "400 var(--t-s) var(--font)", color: "var(--ink2)", lineHeight: 1.5 }}>
                Tente outro termo ou limpe os filtros de culinária.
              </div>
            </div>
          )}
          <div style={{ height: 32 }} />
        </div>
      )}

      <SupportFab />
    </div>
  );
}
