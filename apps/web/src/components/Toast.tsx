import { useToast } from "../context/ToastContext";

export function Toast() {
  const { toast } = useToast();
  if (!toast) return null;
  return (
    <div style={{ position: "absolute", left: "var(--pad)", right: "var(--pad)", bottom: 96, display: "flex", justifyContent: "center", pointerEvents: "none", zIndex: 40 }}>
      <div className="toast">
        <i className={toast.icon} style={{ fontSize: "var(--i-s)", color: "#CD8C52" }} />
        {toast.message}
      </div>
    </div>
  );
}
