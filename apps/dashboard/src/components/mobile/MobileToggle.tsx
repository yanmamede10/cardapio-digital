/** 48×28 touch-target switch used for availability and hours toggles. */
export function MobileToggle({ on, onClick, title }: { on: boolean; onClick: () => void; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        width: 48,
        height: 28,
        borderRadius: 20,
        border: `1px solid ${on ? "var(--brand)" : "var(--line2)"}`,
        background: on ? "var(--brand)" : "var(--surface3)",
        cursor: "pointer",
        position: "relative",
        padding: 0,
        flex: "0 0 auto"
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
          transition: "left .15s ease"
        }}
      />
    </button>
  );
}
