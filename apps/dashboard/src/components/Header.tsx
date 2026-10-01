import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { initialsOf } from "../lib/format";
import type { NotifItem } from "../lib/live";
import { useDashboardState } from "../state/DashboardStateContext";


export function Header({ tagline, notifs }: { tagline: string; notifs: NotifItem[] }) {
  const { staffName, staffRole } = useDashboardState();
  const [notifOpen, setNotifOpen] = useState(false);
  const [restaurantName, setRestaurantName] = useState("");
  useEffect(() => {
    api.getRestaurant().then((r) => setRestaurantName(r.name)).catch(() => {});
  }, []);
  const notifCount = notifs.length;

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 6,
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: "16px 26px",
        background: "var(--glassBg)",
        backdropFilter: "var(--blur)",
        WebkitBackdropFilter: "var(--blur)",
        borderBottom: "1px solid var(--glassBd)"
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <h1 style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: "-.015em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {restaurantName}
          </h1>
          <span className="pill" style={{ color: "var(--ok)", background: "var(--surface2)", border: "1px solid var(--line)" }}>
            <span className="dot" style={{ background: "var(--ok)" }} />
            Aberto
          </span>
        </div>
        <div style={{ fontSize: 12, color: "var(--ink3)" }}>{tagline}</div>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 9, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 13, padding: "9px 14px", minWidth: 0, width: 230 }}>
        <i className="fa-solid fa-magnifying-glass" style={{ fontSize: 18, lineHeight: 1, color: "var(--ink3)" }} />
        <input placeholder="Buscar pedido, mesa, item" style={{ border: 0, background: "transparent", outline: "none", font: "inherit", fontSize: 13, color: "var(--ink)", width: "100%", minWidth: 0 }} />
      </div>
      <div style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => setNotifOpen((v) => !v)}
          title="Notificações"
          aria-label={notifCount > 0 ? `Notificações — ${notifCount} novas` : "Notificações"}
          style={{ position: "relative", width: 44, height: 44, borderRadius: 13, background: "var(--surface2)", border: "1px solid var(--line)", color: "var(--ink2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <i className="fa-solid fa-bell" style={{ fontSize: 20, lineHeight: 1 }} />
          {notifCount > 0 && (
            <span
              className="mono"
              style={{
                position: "absolute",
                top: -5,
                right: -5,
                minWidth: 18,
                height: 18,
                borderRadius: 20,
                background: "var(--brand)",
                color: "var(--brandInk)",
                fontSize: 10,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 4px",
                border: "2px solid var(--surface)"
              }}
            >
              {notifCount}
            </span>
          )}
        </button>
        {notifOpen && (
          <div
            style={{
              position: "absolute",
              right: 0,
              top: 46,
              width: 310,
              background: "var(--glassBg)",
              backdropFilter: "var(--blur)",
              WebkitBackdropFilter: "var(--blur)",
              border: "1px solid var(--glassBd)",
              borderRadius: 16,
              boxShadow: "var(--shadow2)",
              overflow: "hidden",
              zIndex: 9,
              animation: "dcScaleIn .36s var(--ease-spring) both"
            }}
          >
            <div style={{ padding: "11px 14px", borderBottom: "1px solid var(--line)", fontWeight: 600, fontSize: 13 }}>Notificações</div>
            {notifs.length === 0 && <div style={{ padding: "16px 14px", fontSize: 12.5, color: "var(--ink3)" }}>Nenhuma notificação agora.</div>}
            {notifs.map((n, i) => (
              <div key={i} style={{ display: "flex", gap: 11, padding: "11px 14px", borderBottom: "1px solid var(--line)", alignItems: "flex-start" }}>
                <i className={`fa-solid ${n.icon}`} style={{ fontSize: 19, lineHeight: 1, color: n.color }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{n.title}</div>
                  <div style={{ fontSize: 12, color: "var(--ink3)" }}>{n.sub}</div>
                </div>
                <div className="mono" style={{ fontSize: 11, color: "var(--ink3)", whiteSpace: "nowrap" }}>
                  {n.time}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 12, borderLeft: "1px solid var(--line)" }}>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>{staffName}</div>
          <div className="mono" style={{ fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--secText)" }}>
            {staffRole}
          </div>
        </div>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "var(--brandSoft)",
            border: "1px solid var(--line2)",
            color: "var(--brandText)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 600,
            fontSize: 13
          }}
        >
          {initialsOf(staffName)}
        </div>
      </div>
    </header>
  );
}
