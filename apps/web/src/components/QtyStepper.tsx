export function QtyStepper({
  qty,
  onInc,
  onDec,
  size = 38
}: {
  qty: number;
  onInc: () => void;
  onDec: () => void;
  size?: number;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: 4, borderRadius: 999, background: "var(--surf2)" }}>
      <button
        type="button"
        title="Menos"
        onClick={onDec}
        className="tap"
        style={{ width: size - 8, height: size - 8, borderRadius: 999, border: "none", cursor: "pointer", background: "transparent", color: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <i className="fa-solid fa-minus" style={{ fontSize: "var(--i-s)" }} />
      </button>
      <div style={{ minWidth: 20, textAlign: "center", font: "700 var(--t-s) var(--font)" }}>{qty}</div>
      <button
        type="button"
        title="Mais"
        onClick={onInc}
        className="tap"
        style={{ width: size - 8, height: size - 8, borderRadius: 999, border: "none", cursor: "pointer", background: "transparent", color: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <i className="fa-solid fa-plus" style={{ fontSize: "var(--i-s)" }} />
      </button>
    </div>
  );
}
