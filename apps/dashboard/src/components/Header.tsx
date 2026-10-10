import { useEffect, useState } from "react";
import { PLATFORM_NAME } from "@cardapio/shared";
import { api } from "../lib/api";
import { initialsOf } from "../lib/format";
import type { NotifItem } from "../lib/live";
import { useDashboardState } from "../state/DashboardStateContext";


export function Header({ screen, tagline, notifs }: { screen: string; tagline: string; notifs: NotifItem[] }) {
  const { staffName, staffRole } = useDashboardState();
  const [notifOpen, setNotifOpen] = useState(false);
  const [restaurantName, setRestaurantName] = useState("");
  useEffect(() => {
    api.getRestaurant().then((r) => setRestaurantName(r.name)).catch(() => {});
  }, []);
  // Checklist 5: the tab says which screen, which restaurant and the platform ("Central de Pedidos · Chapa 27 Burgers · Pyro").
  useEffect(() => {
    document.title = [screen, restaurantName, PLATFORM_NAME].filter(Boolean).join(" · ");
  }, [screen, restaurantName]);
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
        background: "var(--bg)",
        borderBottom: "1px solid var(--line)"
      }}
    >
      {/* UI-01 · 14: the screen's name is the title (title2); the restaurant and what the screen is for, a line below. */}
      <div style={{ minWidth: 0 }}>
        <h1 style={{ margin: 0, fontSize: "var(--text-title2)", fontWeight: 600, letterSpacing: "-.015em", lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {screen}
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--text-footnote)", color: "var(--ink2)", whiteSpace: "nowrap" }}>
          <span data-restaurant style={{ fontWeight: 500, color: "var(--ink)" }}>{restaurantName}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--ok)" }}>
            <span className="dot" style={{ background: "var(--ok)" }} />
            Aberto
          </span>
          {tagline && <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>· {tagline}</span>}
        </div>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => setNotifOpen((v) => !v)}
          title="Notificações"
          aria-label={notifCount > 0 ? `Notificações — ${notifCount} novas` : "Notificações"}
          className="icon-btn"
          style={{ position: "relative" }}
        >
          <i className="fa-solid fa-bell" style={{ fontSize: "var(--icon-md)", lineHeight: 1 }} />
          {notifCount > 0 && (
            <span
              key={notifCount}
              className="mono badge-pop"
              style={{
                position: "absolute",
                top: -5,
                right: -5,
                minWidth: 18,
                height: 18,
                borderRadius: 20,
                background: "var(--brand)",
                color: "var(--brandInk)",
                fontSize: "var(--text-caption)",
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
            className="glass menu-pop"
            style={{
              position: "absolute",
              right: 0,
              top: 46,
              width: 310,
              border: "1px solid var(--glassBd)",
              borderRadius: 16,
              boxShadow: "var(--shadow2)",
              overflow: "hidden",
              zIndex: 9
            }}
          >
            <div style={{ padding: "11px 14px", borderBottom: "1px solid var(--line)", fontWeight: 600, fontSize: "var(--text-subheadline)" }}>Notificações</div>
            {notifs.length === 0 && <div style={{ padding: "16px 14px", fontSize: "var(--text-subheadline)", color: "var(--ink3)" }}>Nenhuma notificação agora.</div>}
            {notifs.map((n, i) => (
              <div key={i} style={{ display: "flex", gap: 11, padding: "11px 14px", borderBottom: "1px solid var(--line)", alignItems: "flex-start" }}>
                <i className={`fa-solid ${n.icon}`} style={{ fontSize: "var(--icon-md)", lineHeight: 1, color: n.color }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: "var(--text-subheadline)", fontWeight: 500 }}>{n.title}</div>
                  <div style={{ fontSize: "var(--text-footnote)", color: "var(--ink3)" }}>{n.sub}</div>
                </div>
                <div className="mono" style={{ fontSize: "var(--text-caption)", color: "var(--ink3)", whiteSpace: "nowrap" }}>
                  {n.time}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 12, borderLeft: "1px solid var(--line)" }}>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "var(--text-subheadline)", fontWeight: 600, whiteSpace: "nowrap" }}>{staffName}</div>
          <div className="mono" style={{ fontSize: "var(--text-caption)", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--secText)" }}>
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
            fontSize: "var(--text-subheadline)"
          }}
        >
          {initialsOf(staffName)}
        </div>
      </div>
    </header>
  );
}
