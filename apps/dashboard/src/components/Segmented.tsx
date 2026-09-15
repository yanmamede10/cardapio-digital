export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/** Pill-group segmented control (Todos / Mesa / Delivery, period switchers, tabs). */
export function Segmented<T extends string>({
  options,
  value,
  onChange
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "inline-flex", gap: 3, padding: 3, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 20 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              border: 0,
              cursor: "pointer",
              borderRadius: 20,
              padding: "6px 13px",
              fontSize: 13,
              fontWeight: active ? 600 : 500,
              background: active ? "var(--surface)" : "transparent",
              color: active ? "var(--brandText)" : "var(--ink2)"
            }}
          >
            {o.label}
            {typeof o.count === "number" && (
              <span className="mono" style={{ fontSize: 11, color: active ? "var(--brandText)" : "var(--ink3)" }}>
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Standalone filter chip (category filters, ticket status/channel filters). */
export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        cursor: "pointer",
        borderRadius: 20,
        padding: "5px 12px",
        fontSize: 12.5,
        fontWeight: active ? 600 : 500,
        whiteSpace: "nowrap",
        background: active ? "var(--brandSoft)" : "var(--surface)",
        border: `1px solid ${active ? "var(--brand)" : "var(--line)"}`,
        color: active ? "var(--brandText)" : "var(--ink2)"
      }}
    >
      {children}
    </button>
  );
}

export function SectionTitle({ icon, title, right }: { icon?: string; title: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
      {icon && <i className={`fa-solid ${icon}`} style={{ fontSize: 17, color: "var(--brandText)" }} />}
      <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-.015em" }}>{title}</div>
      <div style={{ flex: 1 }} />
      {right}
    </div>
  );
}
