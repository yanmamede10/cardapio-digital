import type { MenuItem } from "@cardapio/shared";
import { formatMoney } from "../../lib/format";

type Variant = "grid" | "wide" | "tile" | "row" | "gallery";

interface Props {
  item: MenuItem;
  variant: Variant;
  onOpen: () => void;
  onQuickAdd: () => void;
  /** grid only — Moderno's horizontal "Destaques" strip pins a width and drops the description. */
  width?: string;
  showDescription?: boolean;
  /** row only — Minimalista puts name/line-fill/price on one baseline; Editorial stacks name → desc → price. */
  rowLayout?: "stacked" | "inline";
  /** gallery only — masonry card height, cycled by the caller from a fixed height list. */
  photoHeight?: string;
}

const soldOutBadge = (
  <div style={{ position: "absolute", inset: 0, background: "rgba(2,3,4,.42)", display: "flex", alignItems: "center", justifyContent: "center" }}>
    <span style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 12px", borderRadius: 999, background: "var(--bg)", color: "var(--ink)", font: "700 var(--t-s) var(--font)" }}>
      <i className="fa-solid fa-ban" style={{ fontSize: "var(--i-s)", color: "var(--acc)" }} />Esgotado
    </span>
  </div>
);

function TagBadge({ item }: { item: MenuItem }) {
  if (item.soldOut || !item.tag) return null;
  return (
    <div style={{ position: "absolute", top: 8, left: 8, display: "flex", alignItems: "center", gap: 6, padding: "5px 9px", borderRadius: 999, background: "var(--pri)", color: "var(--priInk)", font: "600 var(--t-xs) var(--font)" }}>
      <i className={item.tagIcon || ""} style={{ fontSize: "var(--i-s)" }} />{item.tag}
    </div>
  );
}

function SolidQuickAdd({ item, onQuickAdd, size = "var(--fab)" }: { item: MenuItem; onQuickAdd: () => void; size?: string }) {
  if (item.soldOut) return <span style={{ flex: "none", font: "500 var(--t-xs) var(--font)", color: "var(--ink2)", letterSpacing: ".06em" }}>indisponível</span>;
  return (
    <button
      type="button"
      title="Adicionar"
      onClick={onQuickAdd}
      className="tap"
      style={{ flex: "none", width: size, height: size, borderRadius: 999, border: "none", cursor: "pointer", background: "var(--pri)", color: "var(--priInk)", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <i className="fa-solid fa-plus" style={{ fontSize: "var(--i-m)" }} />
    </button>
  );
}

function GhostQuickAdd({ item, onQuickAdd }: { item: MenuItem; onQuickAdd: () => void }) {
  if (item.soldOut) return null;
  return (
    <button
      type="button"
      title="Adicionar"
      onClick={onQuickAdd}
      className="tap"
      style={{ flex: "none", width: "var(--fab)", height: "var(--fab)", borderRadius: 999, border: "1px solid var(--line)", cursor: "pointer", background: "var(--surf)", color: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <i className="fa-solid fa-plus" style={{ fontSize: "var(--i-m)" }} />
    </button>
  );
}

/** The one item-card component every template composes from — only the container/photo/text arrangement changes. */
export function ItemCard({ item, variant, onOpen, onQuickAdd, width, showDescription = true, rowLayout = "stacked", photoHeight }: Props) {
  const dim = item.soldOut ? 0.55 : 1;

  if (variant === "grid") {
    return (
      <div className="card" style={{ overflow: "hidden", display: "flex", flexDirection: "column", opacity: dim, flex: width ? "none" : undefined, width }}>
        <div onClick={onOpen} style={{ cursor: "pointer" }}>
          <div className="photo-placeholder" style={{ position: "relative", height: "var(--photo)" }}>
            <span style={{ font: "500 10px var(--font)", letterSpacing: ".06em", color: "var(--ink2)", padding: "0 8px", textAlign: "center" }}>{item.photoLabel}</span>
            <TagBadge item={item} />
            {item.soldOut && soldOutBadge}
          </div>
          <div style={{ padding: "16px 18px 0" }}>
            <div style={{ font: "600 var(--t-m) var(--font)", letterSpacing: "-.015em" }}>{item.name}</div>
            {showDescription && (
              <div style={{ marginTop: 5, font: "400 var(--t-s) var(--font)", color: "var(--ink2)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {item.shortDescription}
              </div>
            )}
          </div>
        </div>
        <div style={{ padding: "14px 18px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ flex: "none", whiteSpace: "nowrap", font: "700 var(--t-m) var(--font)", letterSpacing: "-.02em" }}>{formatMoney(item.price)}</div>
          <SolidQuickAdd item={item} onQuickAdd={onQuickAdd} />
        </div>
      </div>
    );
  }

  if (variant === "wide") {
    return (
      <div className="card" style={{ overflow: "hidden", display: "flex", alignItems: "stretch", cursor: "pointer", opacity: dim }}>
        <div onClick={onOpen} className="photo-placeholder" style={{ position: "relative", flex: "none", width: "calc(var(--photo) * .95)" }}>
          {item.soldOut && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(2,3,4,.42)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <i className="fa-solid fa-ban" style={{ fontSize: "var(--i-m)", color: "#FCF7D3" }} />
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 6 }}>
          <div onClick={onOpen} style={{ cursor: "pointer" }}>
            <div style={{ font: "600 var(--t-m) var(--font)", lineHeight: 1.2, letterSpacing: "-.015em" }}>{item.name}</div>
            <div style={{ marginTop: 5, font: "400 var(--t-s) var(--font)", lineHeight: 1.55, color: "var(--ink2)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {item.shortDescription}
            </div>
          </div>
          <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ font: "700 var(--t-b) var(--font)", letterSpacing: "-.02em" }}>{formatMoney(item.price)}</div>
            <SolidQuickAdd item={item} onQuickAdd={onQuickAdd} />
          </div>
        </div>
      </div>
    );
  }

  if (variant === "tile") {
    return (
      <div style={{ background: "var(--surf)", border: "1px solid var(--line)", borderRadius: "var(--r-standard)", overflow: "hidden", display: "flex", flexDirection: "column", cursor: "pointer", opacity: dim, boxShadow: "0 18px 40px rgba(2,3,4,.26)" }}>
        <div onClick={onOpen}>
          <div className="photo-placeholder" style={{ position: "relative", height: "var(--photo)" }}>
            <span style={{ font: "500 10px var(--font)", letterSpacing: ".06em", color: "var(--ink2)", padding: "0 8px", textAlign: "center" }}>{item.photoLabel}</span>
            <TagBadge item={item} />
            {item.soldOut && soldOutBadge}
          </div>
          <div style={{ padding: "14px 16px 0" }}>
            <div style={{ font: "600 var(--t-b) var(--font)", lineHeight: 1.25, letterSpacing: "-.015em" }}>{item.name}</div>
          </div>
        </div>
        <div style={{ padding: "12px 16px 16px", marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ font: "700 var(--t-b) var(--font)", letterSpacing: "-.02em" }}>{formatMoney(item.price)}</div>
          <SolidQuickAdd item={item} onQuickAdd={onQuickAdd} />
        </div>
      </div>
    );
  }

  if (variant === "gallery") {
    return (
      <div style={{ position: "relative", breakInside: "avoid", marginBottom: 12, borderRadius: 20, overflow: "hidden", cursor: "pointer", opacity: dim, background: "var(--surf2)", boxShadow: "var(--shadow-card)" }}>
        <div onClick={onOpen} className="photo-placeholder" style={{ position: "relative", height: photoHeight }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top,rgba(2,3,4,.80),rgba(2,3,4,.16) 52%,rgba(2,3,4,0))" }} />
          <TagBadge item={item} />
          {item.soldOut && (
            <div style={{ position: "absolute", top: 10, left: 10, display: "flex", alignItems: "center", gap: 7, padding: "5px 10px", borderRadius: 999, background: "var(--bg)", color: "var(--ink)", font: "600 var(--t-xs) var(--font)" }}>
              <i className="fa-solid fa-ban" style={{ fontSize: "var(--i-s)", color: "var(--acc)" }} />Esgotado
            </div>
          )}
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "12px 14px", display: "flex", alignItems: "flex-end", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: "600 var(--t-b)/1.22 var(--font)", letterSpacing: "-.015em", color: "#FFF7EC", textWrap: "pretty" }}>{item.name}</div>
              <div style={{ marginTop: 5, font: "600 var(--t-s) var(--font)", color: "#F0E4C4" }}>{formatMoney(item.price)}</div>
            </div>
            {!item.soldOut && (
              <button type="button" title="Adicionar" onClick={onQuickAdd} className="tap" style={{ flex: "none", width: "var(--fab)", height: "var(--fab)", borderRadius: 999, border: "none", cursor: "pointer", background: "var(--priInk)", color: "var(--pri)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <i className="fa-solid fa-plus" style={{ fontSize: "var(--i-m)" }} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // row — Minimalista (inline) and Editorial (stacked) both drop the photo entirely.
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "18px 0", borderBottom: "1px solid var(--line)", opacity: dim }}>
      <div onClick={onOpen} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
        {rowLayout === "inline" ? (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <div style={{ font: "600 var(--t-m) var(--font)", lineHeight: 1.25, letterSpacing: "-.02em" }}>{item.name}</div>
              <div style={{ flex: 1, minWidth: 12, height: 1, background: "var(--line)" }} />
              <div style={{ flex: "none", whiteSpace: "nowrap", font: "600 var(--t-m) var(--font)", letterSpacing: "-.02em", fontVariantNumeric: "tabular-nums" }}>{formatMoney(item.price)}</div>
            </div>
            <div style={{ marginTop: 7, maxWidth: "44ch", font: "400 var(--t-s) var(--font)", lineHeight: 1.6, color: "var(--ink2)", textWrap: "pretty" }}>{item.shortDescription}</div>
          </>
        ) : (
          <>
            <div style={{ font: "600 var(--t-b) var(--font)", lineHeight: 1.25, letterSpacing: "-.015em", textWrap: "pretty" }}>{item.name}</div>
            <div style={{ marginTop: 6, font: "400 var(--t-s) var(--font)", lineHeight: 1.6, color: "var(--ink2)", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.shortDescription}</div>
            <div style={{ marginTop: 9, font: "700 var(--t-b) var(--font)", letterSpacing: "-.02em", fontVariantNumeric: "tabular-nums" }}>{formatMoney(item.price)}</div>
          </>
        )}
        {item.soldOut && <div style={{ marginTop: 8, font: "500 var(--t-xs) var(--font)", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink2)" }}>indisponível hoje</div>}
      </div>
      <GhostQuickAdd item={item} onQuickAdd={onQuickAdd} />
    </div>
  );
}
