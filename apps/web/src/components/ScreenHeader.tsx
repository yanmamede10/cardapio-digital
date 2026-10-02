import type { ReactNode } from "react";
import { IconButton } from "./IconButton";
import { useApp } from "../context/AppContext";
import { usePageTitle } from "../lib/title";

export function ScreenHeader({
  title,
  onBack,
  meta
}: {
  title: string;
  onBack: () => void;
  meta?: ReactNode;
}) {
  usePageTitle(title, useApp().restaurantId);
  return (
    <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 12, padding: "16px var(--pad)", borderBottom: "1px solid var(--line)", background: "var(--glass)", backdropFilter: "saturate(180%) blur(22px)", WebkitBackdropFilter: "saturate(180%) blur(22px)" }}>
      <IconButton icon="fa-solid fa-arrow-left" onClick={onBack} title="Voltar" />
      <div style={{ font: "700 var(--t-l) var(--font)", letterSpacing: "-.025em" }}>{title}</div>
      {meta && <div style={{ marginLeft: "auto", font: "500 var(--t-s) var(--font)", color: "var(--ink2)" }}>{meta}</div>}
    </div>
  );
}
