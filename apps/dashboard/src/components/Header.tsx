import { useState } from "react";
import { initialsOf } from "../lib/format";
import { useDashboardState } from "../state/DashboardStateContext";

export interface NotifItem {
  icon: string;
  color: string;
  title: string;
  sub: string;
  time: string;
}

// Single-restaurant app: there is no login and no open/closed schedule check yet.
const RESTAURANT_NAME = "Fogo & Nó";

export function Header({ tagline, notifs }: { tagline: string; notifs: NotifItem[] }) {
  const { staffName, staffRole } = useDashboardState();
  const [notifOpen, setNotifOpen] = useState(false);
  const notifCount = notifs.length;

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 6,
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "12px 22px",
        background: "var(--surface)",
        borderBottom: "1px solid var(--line)"
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <h1 style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: "-.015em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {RESTAURANT_NAME}
          </h1>
          <span className="pill" style={{ color: "var(--ok)", background: "var(--surface2)", border: "1px solid var(--line)" }}>
            <span className="dot" style={{ background: "var(--ok)" }} />
            Aberto
          </span>
        </div>
        <div style={{ fontSize: 12, color: "var(--ink3)" }}>{tagline}</div>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 9, padding: "7px 11px", minWidth: 0, width: 230 }}>
        <i className="fa-solid fa-magnifying-glass" style={{ fontSize: 18, lineHeight: 1, color: "var(--ink3)" }} />
        <input placeholder="Buscar pedido, mesa, item" style={{ border: 0, background: "transparent", outline: "none", font: "inherit", fontSize: 13, color: "var(--ink)", width: "100%", minWidth: 0 }} />
      </div>
      <div style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => setNotifOpen((v) => !v)}
          style={{ position: "relative", width: 38, height: 38, borderRadius: 9, background: "var(--surface2)", border: "1px solid var(--line)", color: "var(--ink2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
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
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 12,
              boxShadow: "0 18px 40px rgba(0,0,0,.18)",
              overflow: "hidden",
              zIndex: 9
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
          <div className="mono" style={{ fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--sec)" }}>
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
