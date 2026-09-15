import type { ReactNode } from "react";

export function Pill({
  active,
  onClick,
  icon,
  children
}: {
  active: boolean;
  onClick: () => void;
  icon?: string;
  children: ReactNode;
}) {
  return (
    <button className={`pill${active ? " pill--active" : ""}`} onClick={onClick} type="button">
      {icon && <i className={icon} style={{ fontSize: "var(--i-s)" }} />}
      {children}
    </button>
  );
}
