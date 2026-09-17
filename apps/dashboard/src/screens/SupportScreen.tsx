import { useEffect, useMemo, useState } from "react";
import type { Review, SupportTicket, TicketChannel, TicketStatus } from "@cardapio/shared";
import { ApiError, api } from "../lib/api";
import { fmtDateTime, stars } from "../lib/format";
import { useDashboardState } from "../state/DashboardStateContext";
import { EmptyState } from "../components/EmptyState";
import { Chip, Segmented } from "../components/Segmented";

const STATUS_LABEL: Record<TicketStatus, string> = { new: "Novo", in_progress: "Em andamento", resolved: "Resolvido" };
const STATUS_COLOR: Record<TicketStatus, string> = { new: "var(--brandText)", in_progress: "var(--warn)", resolved: "var(--ok)" };

export default function SupportScreen() {
  const { notify } = useDashboardState();
  const [tab, setTab] = useState<"tickets" | "reviews">("tickets");
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");
  const [channelFilter, setChannelFilter] = useState<TicketChannel | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, string>>({});

  const reloadTickets = () => api.listTickets({ status: statusFilter, channel: channelFilter }).then(setTickets);

  useEffect(() => {
    Promise.all([api.listTickets(), api.listReviews()])
      .then(([t, r]) => {
        setTickets(t);
        setReviews(r);
        setLoading(false);
        if (t.length) setSelectedId(t[0].id);
      })
      .catch((err) => {
        setError(err instanceof ApiError && err.status === 403 ? "Você não tem permissão para acessar Atendimento." : "Não foi possível carregar Atendimento.");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!loading) reloadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, channelFilter]);

  const selected = tickets.find((t) => t.id === selectedId) || null;

  const setStatus = async (t: SupportTicket, status: TicketStatus) => {
    try {
      const updated = await api.updateTicket(t.id, { status });
      setTickets((prev) => prev.map((x) => (x.id === t.id ? updated : x)));
      notify(`Ticket de ${t.customerName} marcado como ${STATUS_LABEL[status].toLowerCase()}`);
    } catch {
      notify("Não foi possível atualizar o ticket");
    }
  };

  const assignToMe = async (t: SupportTicket) => {
    try {
      const updated = await api.updateTicket(t.id, { assignee: "Marina Duarte" });
      setTickets((prev) => prev.map((x) => (x.id === t.id ? updated : x)));
    } catch {
      notify("Não foi possível atribuir o ticket");
    }
  };

  const send = async () => {
    if (!selected || !draft.trim()) return;
    try {
      const updated = await api.sendTicketMessage(selected.id, draft.trim());
      setTickets((prev) => prev.map((x) => (x.id === selected.id ? updated : x)));
      setDraft("");
    } catch {
      notify("Não foi possível enviar a mensagem");
    }
  };

  const reply = async (r: Review) => {
    const text = (reviewDrafts[r.id] || "").trim();
    if (!text) return;
    try {
      const updated = await api.replyReview(r.id, text);
      setReviews((prev) => prev.map((x) => (x.id === r.id ? updated : x)));
      setReviewDrafts((prev) => ({ ...prev, [r.id]: "" }));
      notify("Resposta publicada");
    } catch {
      notify("Não foi possível responder a avaliação");
    }
  };

  const reviewStats = useMemo(() => {
    if (reviews.length === 0) return { avg: 0, count: 0 };
    return { avg: Math.round((reviews.reduce((t, r) => t + r.rating, 0) / reviews.length) * 10) / 10, count: reviews.length };
  }, [reviews]);

  if (error) {
    return <p style={{ color: "var(--ink2)" }}>{error}</p>;
  }

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="skeleton" style={{ height: 44 }} />
        <div className="skeleton" style={{ height: 420 }} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "tickets", label: "Conversas", count: tickets.length },
            { value: "reviews", label: "Avaliações", count: reviews.length }
          ]}
        />
        {tab === "reviews" && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--ink2)" }}>
            <span style={{ color: "var(--sec)" }}>{stars(reviewStats.avg)}</span>
            <span className="mono">{reviewStats.avg.toFixed(1)}</span>
            <span style={{ color: "var(--ink3)" }}>· {reviewStats.count} avaliações</span>
          </div>
        )}
      </div>

      {tab === "tickets" ? (
        tickets.length === 0 && statusFilter === "all" && channelFilter === "all" ? (
          <EmptyState icon="fa-comments" title="Nenhuma conversa ainda" sub="Mensagens de clientes sobre pedidos na mesa ou no delivery aparecem aqui." />
        ) : (
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div style={{ width: 320, flex: "0 0 320px", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(["all", "new", "in_progress", "resolved"] as const).map((s) => (
                  <Chip key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>
                    {s === "all" ? "Todos" : STATUS_LABEL[s]}
                  </Chip>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {(["all", "table", "delivery"] as const).map((c) => (
                  <Chip key={c} active={channelFilter === c} onClick={() => setChannelFilter(c)}>
                    {c === "all" ? "Todos canais" : c === "table" ? "Mesa" : "Delivery"}
                  </Chip>
                ))}
              </div>
              <section className="card" style={{ overflow: "hidden" }}>
                {tickets.map((t) => {
                  const active = t.id === selectedId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedId(t.id)}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        width: "100%",
                        textAlign: "left",
                        padding: "11px 13px",
                        border: 0,
                        borderBottom: "1px solid var(--line)",
                        cursor: "pointer",
                        font: "inherit",
                        background: active ? "var(--brandSoft)" : "transparent"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <i className={`fa-solid ${t.channel === "table" ? "fa-chair" : "fa-motorcycle"}`} style={{ fontSize: 15, color: "var(--ink3)" }} />
                        <span style={{ fontWeight: 600, fontSize: 13, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.customerName}</span>
                        {t.unreadCount > 0 && (
                          <span className="mono" style={{ fontSize: 10, fontWeight: 600, background: "var(--brand)", color: "var(--brandInk)", borderRadius: 20, padding: "1px 6px" }}>
                            {t.unreadCount}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--ink3)" }}>{t.refLabel}</div>
                      <div className="pill" style={{ alignSelf: "flex-start", background: "var(--surface2)", color: STATUS_COLOR[t.status] }}>
                        {STATUS_LABEL[t.status]}
                      </div>
                    </button>
                  );
                })}
              </section>
            </div>

            <section className="card" style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 460 }}>
              {selected ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", borderBottom: "1px solid var(--line)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{selected.customerName}</div>
                      <div style={{ fontSize: 12, color: "var(--ink3)" }}>{selected.refLabel}</div>
                    </div>
                    {!selected.assignee && (
                      <button type="button" className="btn btn-outline" onClick={() => assignToMe(selected)}>
                        Atribuir a mim
                      </button>
                    )}
                    <select
                      className="field"
                      style={{ width: 160 }}
                      value={selected.status}
                      onChange={(e) => setStatus(selected, e.target.value as TicketStatus)}
                    >
                      {(Object.keys(STATUS_LABEL) as TicketStatus[]).map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                    {selected.messages.map((m) => (
                      <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: m.from === "staff" ? "flex-end" : "flex-start" }}>
                        <div
                          style={{
                            maxWidth: "72%",
                            borderRadius: 15,
                            padding: "10px 14px",
                            fontSize: 13,
                            lineHeight: 1.4,
                            background: m.from === "staff" ? "var(--brand)" : "var(--surface2)",
                            color: m.from === "staff" ? "var(--brandInk)" : "var(--ink)"
                          }}
                        >
                          {m.text}
                        </div>
                        <div style={{ fontSize: 10.5, color: "var(--ink3)", marginTop: 3 }}>{fmtDateTime(m.createdAt)}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid var(--line)" }}>
                    <input
                      className="field"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && send()}
                      placeholder="Responder ao cliente"
                    />
                    <button type="button" className="btn btn-primary" onClick={send}>
                      <i className="fa-solid fa-paper-plane" style={{ fontSize: 15 }} />
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink3)", fontSize: 13 }}>Selecione uma conversa</div>
              )}
            </section>
          </div>
        )
      ) : reviews.length === 0 ? (
        <EmptyState icon="fa-star" title="Nenhuma avaliação ainda" sub="Avaliações de clientes sobre a experiência na mesa ou no delivery aparecem aqui." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {reviews.map((r) => (
            <section key={r.id} className="card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <i className={`fa-solid ${r.channel === "table" ? "fa-chair" : "fa-motorcycle"}`} style={{ fontSize: 15, color: "var(--ink3)" }} />
                <div style={{ fontWeight: 600, fontSize: 13.5, flex: 1 }}>{r.customerName}</div>
                <span style={{ color: "var(--sec)", fontSize: 14 }}>{stars(r.rating)}</span>
                <span className="mono" style={{ fontSize: 11, color: "var(--ink3)" }}>
                  {fmtDateTime(r.createdAt)}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "var(--ink2)", lineHeight: 1.5 }}>{r.text}</div>
              {r.reply ? (
                <div style={{ marginLeft: 20, padding: "10px 14px", borderRadius: 13, background: "var(--surface2)", fontSize: 12.5, color: "var(--ink2)" }}>
                  <div className="field-label" style={{ marginBottom: 3 }}>
                    Resposta do restaurante
                  </div>
                  {r.reply}
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="field"
                    style={{ fontSize: 12.5 }}
                    value={reviewDrafts[r.id] || ""}
                    onChange={(e) => setReviewDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    placeholder="Responder publicamente"
                  />
                  <button type="button" className="btn btn-outline" onClick={() => reply(r)}>
                    Responder
                  </button>
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
