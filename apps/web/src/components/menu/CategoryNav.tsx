import type { MenuCategory } from "@cardapio/shared";

type Variant = "pill" | "vibrant" | "text";

interface Props {
  categories: MenuCategory[];
  active: string;
  onPick: (id: string) => void;
  variant: Variant;
}

/** The three category-nav looks the templates use: plain pills, cream chips on a brand background, or underlined text. */
export function CategoryNav({ categories, active, onPick, variant }: Props) {
  const items = [{ id: "Todos", name: "Todos" }, ...categories];

  if (variant === "text") {
    return (
      <>
        {items.map((c) => {
          const on = active === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onPick(c.id)}
              style={{
                flex: "none", whiteSpace: "nowrap", cursor: "pointer", border: "none", background: "transparent",
                padding: "4px 0 9px", borderBottom: `2px solid ${on ? "var(--pri)" : "transparent"}`,
                color: on ? "var(--ink)" : "var(--ink2)", font: `${on ? 600 : 500} var(--t-b) var(--font)`, letterSpacing: "-.01em"
              }}
            >
              {c.name}
            </button>
          );
        })}
      </>
    );
  }

  if (variant === "vibrant") {
    return (
      <>
        {items.map((c) => {
          const on = active === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onPick(c.id)}
              style={{
                flex: "none", whiteSpace: "nowrap", cursor: "pointer", borderRadius: 999, padding: "10px 16px",
                background: on ? "#FCF7D3" : "rgba(252,247,211,.14)", border: `1px solid ${on ? "#FCF7D3" : "rgba(252,247,211,.46)"}`,
                color: on ? "#732009" : "#FCF7D3", font: `${on ? 600 : 500} var(--t-b) var(--font)`
              }}
            >
              {c.name}
            </button>
          );
        })}
      </>
    );
  }

  return (
    <>
      {items.map((c) => (
        <button key={c.id} className={`pill${active === c.id ? " pill--active" : ""}`} onClick={() => onPick(c.id)} type="button">
          {c.name}
        </button>
      ))}
    </>
  );
}
