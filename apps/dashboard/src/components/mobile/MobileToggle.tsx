/** A 48×28 switch (availability, hours, coupons) inside a 52×44 touch target, announced as a switch with its label. */
export function MobileToggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      style={{ width: 52, height: 44, border: 0, background: "transparent", cursor: "pointer", padding: 0, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 48,
          height: 28,
          borderRadius: 20,
          border: `1px solid ${on ? "var(--brand)" : "var(--line2)"}`,
          background: on ? "var(--brand)" : "var(--surface3)",
          position: "relative"
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: on ? 23 : 2,
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: "var(--surface)",
            boxShadow: "0 1px 3px rgba(0,0,0,.25)",
            transition: "left var(--dur-fast) var(--ease)"
          }}
        />
      </span>
    </button>
  );
}
