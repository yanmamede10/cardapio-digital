import type { MenuCategory } from "@cardapio/shared";

const square = { width: 40, height: 40, borderRadius: 10, border: "1px solid var(--line2)", background: "var(--surface2)", color: "var(--ink2)", cursor: "pointer" } as const;

/** Phone: the categories with rename, delete and up/down — the Cardápio's "Reordenar categorias", also Produtos' "Ordenar
 *  categorias" (one list, one order). onDone adds a "Concluir" for a screen that opened it from a menu. */
export function CategoryReorderPanel({
  categories,
  onCreate,
  onRename,
  onDelete,
  onMove,
  onDone
}: {
  categories: MenuCategory[];
  onCreate: () => void;
  onRename: (c: MenuCategory) => void;
  onDelete: (c: MenuCategory) => void;
  onMove: (c: MenuCategory, dir: "up" | "down") => void;
  onDone?: () => void;
}) {
  return (
    <div style={{ background: "var(--surface)", border: "1px dashed var(--sec)", borderRadius: 13, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 13px", fontSize: "var(--text-footnote)", color: "var(--ink2)", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
        <span style={{ flex: 1 }}>Use as setas para reordenar as categorias.</span>
        <button type="button" className="btn btn-outline" style={{ minHeight: 40, padding: "0 12px", fontSize: "var(--text-subheadline)" }} onClick={onCreate}>
          <i className="fa-solid fa-plus" style={{ fontSize: 12 }} />
          Nova categoria
        </button>
        {onDone && (
          <button type="button" className="btn btn-primary" style={{ minHeight: 40, padding: "0 12px", fontSize: "var(--text-subheadline)" }} onClick={onDone}>
            Concluir
          </button>
        )}
      </div>
      {categories.map((c) => (
        <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", borderBottom: "1px solid var(--line)", minHeight: 52 }}>
          <i className="fa-solid fa-grip-vertical" style={{ fontSize: 15, color: "var(--ink3)" }} />
          <div style={{ flex: 1, minWidth: 0, fontSize: "var(--text-subheadline)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
          <button type="button" aria-label={`Renomear categoria ${c.name}`} onClick={() => onRename(c)} style={square}>
            <i className="fa-solid fa-pen" style={{ fontSize: 13 }} />
          </button>
          <button type="button" aria-label={`Excluir categoria ${c.name}`} onClick={() => onDelete(c)} style={square}>
            <i className="fa-solid fa-trash" style={{ fontSize: 13 }} />
          </button>
          <button type="button" aria-label={`Subir ${c.name}`} onClick={() => onMove(c, "up")} style={square}>
            <i className="fa-solid fa-angle-up" style={{ fontSize: 14 }} />
          </button>
          <button type="button" aria-label={`Descer ${c.name}`} onClick={() => onMove(c, "down")} style={square}>
            <i className="fa-solid fa-angle-down" style={{ fontSize: 14 }} />
          </button>
        </div>
      ))}
    </div>
  );
}
