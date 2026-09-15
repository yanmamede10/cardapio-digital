import type { ReactNode } from "react";
import { IconButton } from "./IconButton";

export function ScreenHeader({
  title,
  onBack,
  meta
}: {
  title: string;
  onBack: () => void;
  meta?: ReactNode;
}) {
  return (
    <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 12, padding: "14px var(--pad)", borderBottom: "1px solid var(--line)" }}>
      <IconButton icon="fa-solid fa-arrow-left" onClick={onBack} title="Voltar" />
      <div style={{ font: "700 var(--t-l) Archivo, sans-serif", letterSpacing: "-.025em" }}>{title}</div>
      {meta && <div style={{ marginLeft: "auto", font: "500 var(--t-s) 'IBM Plex Mono', monospace", color: "var(--ink2)" }}>{meta}</div>}
    </div>
  );
}
