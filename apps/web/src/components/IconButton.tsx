import type { CSSProperties } from "react";

export function IconButton({
  icon,
  onClick,
  glass,
  title,
  style
}: {
  icon: string;
  onClick: () => void;
  glass?: boolean;
  title?: string;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`icon-btn${glass ? " icon-btn--glass" : ""}`}
      style={style}
    >
      <i className={icon} style={{ fontSize: "var(--i-m)" }} />
    </button>
  );
}
