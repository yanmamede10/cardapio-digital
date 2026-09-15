import { useDashboardState } from "../state/DashboardStateContext";

export function Toast() {
  const { toast } = useDashboardState();
  if (!toast) return null;
  return (
    <div className="toast-bubble">
      <i className="fa-solid fa-circle-check" style={{ fontSize: 18 }} />
      {toast.message}
    </div>
  );
}
