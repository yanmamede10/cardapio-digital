import { useId, useState, type FormEvent, type ReactNode } from "react";
import type { MenuCategory } from "@cardapio/shared";
import { ApiError, api } from "../lib/api";
import { useBack } from "../lib/back";

/** What the box does (UX-07 · 2a–2d). For "delete", items = the names this screen knows are in the category (dishes in the
 *  Cardápio; produtos and insumos in Produtos); the API counts everything and answers 409 when the screen didn't know. */
export type CategoryDialogMode =
  | { kind: "create"; help: string; confirm?: string }
  | { kind: "rename"; category: MenuCategory }
  | { kind: "delete"; category: MenuCategory; items: string[] };

const plural = (n: number) => (n === 1 ? "1 item" : `${n} itens`);

/** Nova categoria, Renomear e Excluir — the same box in the Cardápio, in Produtos and in the item's cadastro (one list, J-1).
 *  onDone gets the list as it is now, the toast and, after a create, the new category. */
export function CategoryDialog({
  mode,
  categories,
  onClose,
  onDone
}: {
  mode: CategoryDialogMode;
  categories: MenuCategory[];
  onClose: () => void;
  onDone: (list: MenuCategory[], message: string, created?: MenuCategory) => void;
}) {
  const titleId = useId();
  const original = mode.kind === "rename" ? mode.category.name : "";
  const [name, setName] = useState(original);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Excluir with items: refused before asking (the screen knew) or after (the API's 409 says how many).
  const [blocked, setBlocked] = useState<{ text: string; names: string[] } | null>(
    mode.kind === "delete" && mode.items.length ? { text: `Esta categoria tem ${plural(mode.items.length)}. Mova os itens para outra categoria antes de excluir.`, names: mode.items } : null
  );

  useBack(onClose); // Esc (and the Android back) cancels; opened over the cadastro (3f), only this box closes

  const trimmed = name.trim();
  const self = mode.kind === "rename" ? mode.category.id : null;
  const taken = categories.some((c) => c.id !== self && c.name.trim().toLowerCase() === trimmed.toLowerCase());
  const fieldError = trimmed && taken ? "Já existe uma categoria com esse nome" : error;
  const ready = mode.kind === "delete" || (!!trimmed && !taken && trimmed !== original);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); // Enter confirms
    if (blocked) return onClose();
    if (busy || !ready) return;
    setBusy(true);
    try {
      if (mode.kind === "create") {
        const list = await api.createCategory(trimmed);
        onDone(list, `Categoria ${trimmed} criada`, list.find((c) => c.name === trimmed));
      } else if (mode.kind === "rename") {
        onDone(await api.renameCategory(mode.category.id, trimmed), `Categoria renomeada para ${trimmed}`);
      } else {
        onDone(await api.deleteCategory(mode.category.id), `Categoria ${mode.category.name} excluída`);
      }
    } catch (err) {
      if (mode.kind === "delete" && err instanceof ApiError && err.status === 409) setBlocked({ text: err.message, names: [] }); // "A categoria X tem 3 itens…"
      else setError(err instanceof ApiError && err.status === 409 ? "Já existe uma categoria com esse nome" : err instanceof ApiError && err.status === 400 ? "Use até 40 caracteres" : "Não foi possível salvar. Tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  const title = mode.kind === "create" ? "Nova categoria" : mode.kind === "rename" ? "Renomear categoria" : `Excluir “${mode.category.name}”?`;
  const text = { fontSize: 13.5, color: "var(--ink2)", lineHeight: 1.5 } as const;
  return (
    <div className="modal-overlay">
      <form className="modal-panel" role="dialog" aria-modal="true" aria-labelledby={titleId} style={{ maxWidth: 440 }} onSubmit={submit}>
        <div id={titleId} style={{ padding: "22px 24px 4px", fontSize: 17, fontWeight: 600, letterSpacing: "-.015em" }}>
          {title}
        </div>
        <div style={{ padding: "6px 24px 22px", display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>
          {mode.kind !== "delete" ? (
            <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink2)" }}>Nome da categoria</span>
              <input
                autoFocus
                className="field"
                maxLength={40}
                value={name}
                aria-invalid={!!fieldError}
                aria-describedby={`${titleId}-help`}
                onChange={(e) => (setName(e.target.value), setError(null))}
                style={fieldError ? { border: "1.5px solid var(--alert)" } : undefined}
              />
              <span id={`${titleId}-help`} style={{ fontSize: 12, lineHeight: 1.45, color: fieldError ? "var(--alert)" : "var(--ink2)", fontWeight: fieldError ? 500 : 400 }}>
                {fieldError ?? (mode.kind === "create" ? mode.help : "O novo nome aparece também no Cardápio e no cardápio do cliente.")}
              </span>
            </label>
          ) : blocked ? (
            <>
              <div style={text}>{blocked.text}</div>
              {blocked.names.length > 0 && (
                // Scrolls when long: focusable, so the keyboard can scroll it too (axe scrollable-region-focusable).
                <ul tabIndex={0} aria-label="Itens da categoria" style={{ margin: 0, padding: 0, listStyle: "none", border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface2)", maxHeight: 200, overflowY: "auto" }}>
                  {blocked.names.map((n, i) => (
                    <li key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", fontSize: 13, borderTop: i ? "1px solid var(--line)" : 0 }}>
                      <i className="fa-solid fa-box" style={{ fontSize: 11, color: "var(--ink2)" }} />
                      {n}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <div style={text}>Ela sai do Catálogo e do Cardápio.</div>
          )}
        </div>
        <div className="dialog-actions">
          {blocked ? (
            <button type="submit" className="btn btn-primary">
              Entendi
            </button>
          ) : (
            <>
              <button type="button" className="btn btn-outline" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className={`btn ${mode.kind === "delete" ? "btn-danger" : "btn-primary"}`} disabled={busy || !ready}>
                {mode.kind === "delete" ? "Excluir" : mode.kind === "rename" ? "Salvar" : mode.confirm ?? "Criar categoria"}
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}

/** The box wired to a screen: create(), rename(c), remove(c), and the element to render (null while closed). */
export function useCategoryDialog({
  categories,
  help,
  confirm,
  itemsIn,
  notify,
  onChanged
}: {
  categories: MenuCategory[];
  /** Under the name field on "Nova categoria": what this screen's user needs to know. */
  help: string;
  confirm?: string;
  itemsIn: (c: MenuCategory) => string[];
  notify: (message: string) => void;
  onChanged: (list: MenuCategory[], created?: MenuCategory) => void;
}): { create: () => void; rename: (c: MenuCategory) => void; remove: (c: MenuCategory) => void; dialog: ReactNode } {
  const [mode, setMode] = useState<CategoryDialogMode | null>(null);
  return {
    create: () => setMode({ kind: "create", help, confirm }),
    rename: (category) => setMode({ kind: "rename", category }),
    remove: (category) => setMode({ kind: "delete", category, items: itemsIn(category) }),
    dialog: mode && (
      <CategoryDialog
        mode={mode}
        categories={categories}
        onClose={() => setMode(null)}
        onDone={(list, message, created) => {
          setMode(null);
          notify(message);
          onChanged(list, created);
        }}
      />
    )
  };
}
