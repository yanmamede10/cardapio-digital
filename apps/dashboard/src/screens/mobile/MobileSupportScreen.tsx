import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SupportTicket, TicketChannel, TicketStatus } from "@cardapio/shared";
import { api } from "../../lib/api";
import { fmtMinutes, minutesSince, slaFg } from "../../lib/format";
import { useMobileScreen } from "../../components/mobile/MobileLayout";
import { MobileEmptyState } from "../../components/mobile/MobileEmptyState";
import { FilterPopover, type FilterValues } from "../../components/FilterPopover";
import { CHANNEL_ICON, WhatsAppIndicator, lastMessagePreview, useWhatsAppStatus } from "../../components/WhatsApp";

const STATUS_MAP: Record<TicketStatus, { label: string; bg: string; fg: string }> = {
  new: { label: "Novo", bg: "color-mix(in srgb, var(--sec) 22%, transparent)", fg: "var(--brandText)" },
  in_progress: { label: "Em andamento", bg: "color-mix(in srgb, var(--warn) 18%, transparent)", fg: "var(--warn)" },
  resolved: { label: "Resolvido", bg: "color-mix(in srgb, var(--ok) 16%, transparent)", fg: "var(--ok)" }
};

const STATUS_BY_LABEL: Record<string, TicketStatus> = { Novo: "new", "Em andamento": "in_progress", Resolvido: "resolved" };
const CHANNEL_BY_LABEL: Record<string, TicketChannel> = { Mesa: "table", Delivery: "delivery", WhatsApp: "whatsapp" };
const FILTER_GROUPS = [
  { id: "status", label: "Status", options: Object.keys(STATUS_BY_LABEL) },
  { id: "canal", label: "Canal", options: Object.keys(CHANNEL_BY_LABEL) }
];

export default function MobileSupportScreen() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<FilterValues>({});
  const [whatsapp] = useWhatsAppStatus();
  useMobileScreen({ title: "Atendimento", subtitle: "Tickets e conversas" });

  const reload = () => api.listTickets({ status: STATUS_BY_LABEL[filter.status ?? ""] ?? "all", channel: CHANNEL_BY_LABEL[filter.canal ?? ""] ?? "all" }).then((t) => (setTickets(t), setLoaded(true)));

  useEffect(() => {
    reload();
    const id = setInterval(() => reload().catch(() => {}), 6000); // new WhatsApp conversations appear on their own
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const late = useMemo(() => tickets.filter((t) => minutesSince(t.lastActivityAt) >= 60 && t.status !== "resolved").length, [tickets]);

  if (!loaded) {
    return (
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 9 }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton" style={{ height: 74 }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 5, background: "var(--bg)", padding: "11px 12px 9px", borderBottom: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 7 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div className="mono" style={{ flex: 1, fontSize: "var(--text-footnote)", color: "var(--ink3)" }}>
            {tickets.length === 1 ? "1 conversa" : `${tickets.length} conversas`}
          </div>
          <FilterPopover sheet groups={FILTER_GROUPS} value={filter} onChange={setFilter} resultCount={tickets.length} />
        </div>
        <div style={{ display: "flex" }}>
          <WhatsAppIndicator status={whatsapp} />
        </div>
        {late > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--text-footnote)", fontWeight: 600, color: "var(--alert)" }}>
            <i className="fa-solid fa-stopwatch" style={{ fontSize: 13 }} />
            {late} ticket(s) sem resposta há mais de 1h
          </div>
        )}
      </div>

      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 9 }}>
        {tickets.map((t) => {
          const since = minutesSince(t.lastActivityAt);
          const st = STATUS_MAP[t.status];
          const last = t.messages[t.messages.length - 1];
          const initials = t.customerName.split(" ").map((w) => w[0]).slice(0, 2).join("");
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => navigate(`/atendimento/${t.id}`)}
              style={{ display: "flex", gap: 11, width: "100%", textAlign: "left", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 13, padding: 12, minHeight: 74, cursor: "pointer", font: "inherit", color: "var(--ink)" }}
            >
              <div style={{ width: 40, height: 40, flex: "0 0 40px", borderRadius: "50%", background: "var(--surface2)", border: "1px solid var(--line)", color: "var(--ink2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "var(--text-subheadline)", fontWeight: 600 }}>{initials}</div>
              <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ fontSize: "var(--text-body)", fontWeight: 600, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.customerName}</span>
                  <i className={CHANNEL_ICON[t.channel]} style={{ fontSize: 12, color: "var(--ink3)" }} />
                  <span className="mono" style={{ fontSize: "var(--text-footnote)", fontWeight: 600, color: slaFg(since) }}>
                    {fmtMinutes(since)}
                  </span>
                </div>
                <div style={{ fontSize: "var(--text-footnote)", color: "var(--ink2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lastMessagePreview(last)}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ fontSize: "var(--text-caption)", fontWeight: 600, borderRadius: 20, padding: "1px 8px", background: st.bg, color: st.fg }}>{st.label}</span>
                  <span style={{ fontSize: "var(--text-caption)", color: "var(--ink3)", minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.assignee || "Não atribuído"}</span>
                  {t.unreadCount > 0 && (
                    <span className="mono" style={{ minWidth: 17, height: 17, borderRadius: 20, background: "var(--alert)", color: "var(--alertInk)", fontSize: "var(--text-caption)", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>
                      {t.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
        {tickets.length === 0 && <MobileEmptyState icon="fa-envelope-open" title="Caixa de entrada vazia" sub="Nenhuma conversa com esses filtros no momento." />}
      </div>
    </div>
  );
}
