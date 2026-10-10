import { useLayoutEffect, useRef, useState } from "react";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/** Pill-group segmented control (Todos / Mesa / Delivery, period switchers, tabs). UI-01 · 17 (tabs-sliding): one white thumb
 *  slides under the chosen option; a count that changes pops in (.num-pop). */
export function Segmented<T extends string>({
  options,
  value,
  onChange
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null);
  const shape = options.map((o) => `${o.value}${o.label}${o.count ?? ""}`).join("|");
  useLayoutEffect(() => {
    const on = track.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    setThumb(on ? { x: on.offsetLeft, w: on.offsetWidth } : null);
  }, [value, shape]);
  return (
    // Narrower than its options (the Super Admin's four filters at 360 px): it scrolls inside instead of widening the page.
    <div ref={track} className="no-scrollbar" style={{ position: "relative", display: "inline-flex", maxWidth: "100%", overflowX: "auto", gap: 3, padding: 3, background: "var(--surface2)", borderRadius: 12 }}>
      {thumb && (
        <span
          aria-hidden="true"
          className="seg-thumb"
          style={{ position: "absolute", top: 3, bottom: 3, left: 0, width: thumb.w, transform: `translateX(${thumb.x}px)`, borderRadius: 9, background: "var(--surface)", boxShadow: "0 1px 2px rgba(0, 0, 0, .12)" }}
        />
      )}
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className="tap"
            style={{
              position: "relative",
              display: "inline-flex",
              flex: "none",
              whiteSpace: "nowrap",
              alignItems: "center",
              gap: 6,
              border: 0,
              cursor: "pointer",
              borderRadius: 9,
              padding: "6px 13px",
              fontSize: "var(--text-subheadline)",
              fontWeight: active ? 600 : 500,
              background: "transparent",
              color: active ? "var(--brandText)" : "var(--ink2)"
            }}
          >
            {o.label}
            {typeof o.count === "number" && (
              <span key={o.count} className="mono num-pop" style={{ fontSize: "var(--text-caption)", color: active ? "var(--brandText)" : "var(--ink3)" }}>
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
      className="tap"
      style={{
        cursor: "pointer",
        borderRadius: 20,
        padding: "5px 12px",
        fontSize: "var(--text-subheadline)",
        fontWeight: active ? 600 : 500,
        whiteSpace: "nowrap",
        background: active ? "var(--brandSoft)" : "var(--surface2)",
        border: "1px solid transparent",
        color: active ? "var(--brandText)" : "var(--ink2)"
      }}
    >
      {children}
    </button>
  );
}
