/** UI-01 · 17 (input-clear-with-dissolve): the X at the end of a search field — the typed text blurs away (.dissolve, base.css),
 *  then the field empties and keeps the focus. Shown only while there's something to clear. */
export function ClearSearch({ value, onClear }: { value: string; onClear: () => void }) {
  if (!value) return null;
  return (
    <button
      type="button"
      aria-label="Limpar busca"
      onClick={(e) => {
        const input = e.currentTarget.parentElement?.querySelector("input");
        input?.classList.add("dissolve");
        window.setTimeout(() => {
          input?.classList.remove("dissolve");
          onClear();
          input?.focus();
        }, parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--dur")) || 200);
      }}
      style={{ flex: "none", width: 44, height: 44, border: 0, background: "transparent", color: "var(--ink3)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <i className="fa-solid fa-circle-xmark" aria-hidden="true" />
    </button>
  );
}
