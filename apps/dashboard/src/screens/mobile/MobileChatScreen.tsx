import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { SupportTicket, TicketStatus } from "@cardapio/shared";
import { ApiError, api } from "../../lib/api";
import { fmtMinutes, minutesSince, slaFg } from "../../lib/format";
import { useMobileScreen } from "../../components/mobile/MobileLayout";
import { MediaButtons, MessageBody, WhatsAppIndicator, useWhatsAppStatus } from "../../components/WhatsApp";

const STATUS_MAP: Record<TicketStatus, { label: string; bg: string; fg: string }> = {
  new: { label: "Novo", bg: "color-mix(in srgb, var(--sec) 22%, transparent)", fg: "var(--brandText)" },
  in_progress: { label: "Em andamento", bg: "color-mix(in srgb, var(--warn) 18%, transparent)", fg: "var(--warn)" },
  resolved: { label: "Resolvido", bg: "color-mix(in srgb, var(--ok) 16%, transparent)", fg: "var(--ok)" }
};

const QUICK_REPLIES = [
  "Obrigado pelo aviso! Já estamos verificando com a cozinha.",
  "Pedimos desculpa pelo atraso — seu pedido sai em 10 minutos.",
  "Podemos oferecer um cupom de 15% no próximo pedido?",
  "Seu item foi reenviado, chega em instantes."
];

export default function MobileChatScreen() {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [draft, setDraft] = useState("");
  const [quickOpen, setQuickOpen] = useState(false);
  const [whatsapp] = useWhatsAppStatus();

  const { notify } = useMobileScreen({ title: ticket?.customerName ?? "Conversa", subtitle: "Histórico completo", hideTabs: true });

  const reload = () => api.listTickets().then((list) => setTicket(list.find((t) => t.id === id) || null));

  useEffect(() => {
    reload();
    const poll = setInterval(reload, 6000);
    return () => clearInterval(poll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const resolve = async () => {
    if (!ticket) return;
    try {
      const updated = await api.updateTicket(ticket.id, { status: "resolved" });
      setTicket(updated);
      notify("Ticket resolvido");
    } catch {
      notify("Não foi possível resolver o ticket");
    }
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || !ticket) return;
    setDraft("");
    try {
      const updated = await api.sendTicketMessage(ticket.id, text);
      setTicket(updated);
    } catch {
      setDraft(text); // e.g. WhatsApp disconnected — keep what was typed
      notify("Não foi possível enviar a mensagem");
    }
  };

  const sendMedia = async (file: Blob, name: string) => {
    if (!ticket) return;
    try {
      setTicket(await api.sendTicketMedia(ticket.id, file, name));
    } catch (err) {
      notify(err instanceof ApiError && err.status === 413 ? err.message : "Não foi possível enviar pelo WhatsApp");
    }
  };

  if (!ticket) {
    return (
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="skeleton" style={{ height: 300 }} />
      </div>
    );
  }

  const since = minutesSince(ticket.lastActivityAt);
  const st = STATUS_MAP[ticket.status];

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <div style={{ padding: "10px 12px", background: "var(--surface2)", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 9 }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, borderRadius: 20, padding: "2px 9px", background: st.bg, color: st.fg }}>{st.label}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: slaFg(since) }}>
          <i className="fa-solid fa-stopwatch" style={{ fontSize: 12 }} />
          {since >= 60 ? `SLA estourado · ${fmtMinutes(since)}` : `Última resposta ${fmtMinutes(since)}`}
        </span>
        <div style={{ flex: 1 }} />
        {ticket.status !== "resolved" && (
          <button type="button" onClick={resolve} style={{ minHeight: 36, background: "var(--surface)", border: "1px solid var(--line2)", color: "var(--ink)", borderRadius: 10, padding: "0 11px", cursor: "pointer", font: "inherit", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            <i className="fa-solid fa-circle-check" style={{ fontSize: 12 }} />
            Resolver
          </button>
        )}
      </div>

      {ticket.channel === "whatsapp" && (
        <div style={{ padding: "8px 12px 0", display: "flex" }}>
          <WhatsAppIndicator status={whatsapp} />
        </div>
      )}

      <div style={{ flex: 1, padding: "14px 12px", display: "flex", flexDirection: "column", gap: 11 }}>
        {ticket.messages.map((m) => {
          const isStaff = m.from === "staff";
          return (
            <div key={m.id} style={{ display: "flex", flexDirection: "column", gap: 3, alignSelf: isStaff ? "flex-end" : "flex-start", maxWidth: "82%" }}>
              <div style={{ borderRadius: isStaff ? "13px 13px 4px 13px" : "13px 13px 13px 4px", padding: "10px 13px", fontSize: 13, lineHeight: 1.45, background: isStaff ? "var(--brand)" : "var(--surface2)", color: isStaff ? "var(--brandInk)" : "var(--ink)", textWrap: "pretty" }}>
                <MessageBody m={m} />
              </div>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--ink3)", textAlign: isStaff ? "right" : "left" }}>
                {isStaff ? m.authorName || "Você" : ticket.customerName} · {new Date(m.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          );
        })}
      </div>

      {quickOpen && (
        <div style={{ borderTop: "1px solid var(--line)", background: "var(--surface)", padding: "11px 12px", display: "flex", flexDirection: "column", gap: 7 }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ink3)" }}>
            Respostas rápidas
          </div>
          {QUICK_REPLIES.map((q, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setDraft(q);
                setQuickOpen(false);
              }}
              style={{ textAlign: "left", minHeight: 46, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--ink2)", borderRadius: 11, padding: "10px 12px", cursor: "pointer", font: "inherit", fontSize: 12.5 }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <div style={{ position: "sticky", bottom: 0, background: "var(--surface)", borderTop: "1px solid var(--line)", padding: "10px 12px", display: "flex", alignItems: "center", gap: 8 }}>
        <button
          type="button"
          onClick={() => setQuickOpen((v) => !v)}
          aria-label="Respostas rápidas"
          aria-expanded={quickOpen}
          style={{ width: 44, height: 44, flex: "0 0 44px", borderRadius: 11, background: quickOpen ? "var(--brandSoft)" : "var(--surface2)", border: `1px solid ${quickOpen ? "var(--brand)" : "var(--line)"}`, color: quickOpen ? "var(--brandText)" : "var(--ink2)", cursor: "pointer" }}
        >
          <i className="fa-solid fa-bolt" style={{ fontSize: 15 }} />
        </button>
        {ticket.channel === "whatsapp" && <MediaButtons onSend={sendMedia} onError={notify} />}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Responder ao cliente…"
          maxLength={2000}
          style={{ flex: 1, minWidth: 0, minHeight: 44, border: "1px solid var(--line)", background: "var(--surface2)", borderRadius: 22, padding: "0 15px", font: "inherit", fontSize: 13.5, color: "var(--ink)", outline: "none" }}
        />
        <button type="button" onClick={send} aria-label="Enviar resposta" style={{ width: 44, height: 44, flex: "0 0 44px", borderRadius: "50%", background: "var(--brand)", color: "var(--brandInk)", border: 0, cursor: "pointer" }}>
          <i className="fa-solid fa-paper-plane" style={{ fontSize: 15 }} />
        </button>
      </div>
    </div>
  );
}
