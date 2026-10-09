import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { CartLineInput, MenuCategory, MenuItem } from "@cardapio/shared";
import { ApiError, api } from "../lib/api";
import { brl } from "../lib/format";
import { useMobileScreen } from "../components/mobile/MobileLayout";
import { Modal } from "../components/Modal";
import { useDashboardState } from "../state/DashboardStateContext";

/** A line of the order being launched: the dish, the choices (optionIds per group) and the note. */
interface Line {
  key: string;
  item: MenuItem;
  picks: Record<string, string[]>;
  notes: string;
  quantity: number;
}

const defaultPicks = (item: MenuItem) => Object.fromEntries(item.optionGroups.map((g) => [g.id, g.type === "single" && g.options[0] ? [g.options[0].id] : []]));
const unitPrice = (l: Pick<Line, "item" | "picks">) =>
  l.item.price + l.item.optionGroups.reduce((t, g) => t + g.options.filter((o) => l.picks[g.id]?.includes(o.id)).reduce((s, o) => s + o.priceDelta, 0), 0);
const choices = (l: Pick<Line, "item" | "picks">) => l.item.optionGroups.flatMap((g) => g.options.filter((o) => l.picks[g.id]?.includes(o.id)).map((o) => o.label)).join(" · ");
const keyOf = (item: MenuItem, picks: Line["picks"], notes: string) => `${item.id}|${JSON.stringify(picks)}|${notes}`;

/** Lançar pedido: the waiter takes the table's order from the menu — tap adds one (a dish with choices opens them with
 *  the usual ones already marked), then review and send. Same kitchen, comanda and stock as a QR order. */
export function LaunchOrder({ table, onSent }: { table: number; onSent: () => void }) {
  const { notify } = useDashboardState();
  const [items, setItems] = useState<MenuItem[] | null>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [cat, setCat] = useState("todos");
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [choosing, setChoosing] = useState<{ item: MenuItem; picks: Line["picks"]; notes: string; quantity: number } | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    Promise.all([api.listItems(), api.listMenuCategories()])
      .then(([i, c]) => {
        setItems(i);
        setCategories(c.filter((x) => i.some((it) => it.categoryId === x.id)));
      })
      .catch(() => notify("Não foi possível carregar o cardápio"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items ?? []).filter((i) => (cat === "todos" || i.categoryId === cat) && (!q || i.name.toLowerCase().includes(q)));
  }, [items, cat, query]);
  const count = lines.reduce((t, l) => t + l.quantity, 0);
  const total = lines.reduce((t, l) => t + unitPrice(l) * l.quantity, 0);
  const inOrder = (item: MenuItem) => lines.filter((l) => l.item.id === item.id).reduce((t, l) => t + l.quantity, 0);

  const add = (item: MenuItem, picks: Line["picks"], notes: string, quantity: number) => {
    const key = keyOf(item, picks, notes.trim());
    setLines((prev) => (prev.some((l) => l.key === key) ? prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + quantity } : l)) : [...prev, { key, item, picks, notes: notes.trim(), quantity }]));
  };
  const tap = (item: MenuItem) => {
    if (item.soldOut) return;
    if (item.optionGroups.length) setChoosing({ item, picks: defaultPicks(item), notes: "", quantity: 1 });
    else add(item, {}, "", 1);
  };
  const setQty = (key: string, quantity: number) => setLines((prev) => (quantity > 0 ? prev.map((l) => (l.key === key ? { ...l, quantity } : l)) : prev.filter((l) => l.key !== key)));

  const send = async () => {
    if (!lines.length || sending) return;
    setSending(true);
    const payload: CartLineInput[] = lines.map((l) => ({
      itemId: l.item.id,
      quantity: l.quantity,
      notes: l.notes,
      selectedOptions: l.item.optionGroups.flatMap((g) =>
        g.options.filter((o) => l.picks[g.id]?.includes(o.id)).map((o) => ({ groupId: g.id, groupLabel: g.label, optionId: o.id, label: o.label, priceDelta: o.priceDelta }))
      )
    }));
    try {
      await api.launchOrder(table, payload);
      notify(`Pedido da Mesa ${String(table).padStart(2, "0")} enviado para a cozinha`);
      setLines([]);
      setReviewing(false);
      onSent();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Não foi possível enviar o pedido");
    } finally {
      setSending(false);
    }
  };

  if (!items) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 12 }}>
        <div className="skeleton" style={{ height: 44 }} />
        <div className="skeleton" style={{ height: 320 }} />
      </div>
    );
  }

  const chip = (id: string, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setCat(id)}
      style={{ flex: "none", minHeight: 40, borderRadius: 999, padding: "0 15px", cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", background: cat === id ? "var(--brandSoft)" : "var(--surface)", color: cat === id ? "var(--brandText)" : "var(--ink2)", border: `1px solid ${cat === id ? "var(--brand)" : "var(--line)"}` }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <div style={{ padding: "12px 12px 8px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="field" style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <i className="fa-solid fa-magnifying-glass" style={{ fontSize: 14, color: "var(--ink3)" }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar no cardápio" aria-label="Buscar no cardápio" style={{ border: 0, background: "transparent", outline: "none", font: "inherit", color: "var(--ink)", width: "100%", minWidth: 0 }} />
        </div>
        <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 2 }}>{[chip("todos", "Todos"), ...categories.map((c) => chip(c.id, c.name))]}</div>
      </div>

      <div style={{ flex: 1, padding: "0 12px 12px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 8, alignContent: "start" }}>
        {shown.map((item) => {
          const n = inOrder(item);
          return (
            <button
              key={item.id}
              type="button"
              disabled={item.soldOut}
              onClick={() => tap(item)}
              aria-label={`Adicionar ${item.name}`}
              style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 60, textAlign: "left", padding: "10px 12px", borderRadius: 13, cursor: item.soldOut ? "not-allowed" : "pointer", font: "inherit", color: "var(--ink)", background: n ? "var(--brandSoft)" : "var(--surface)", border: `1px solid ${n ? "var(--brand)" : "var(--line)"}`, opacity: item.soldOut ? 0.5 : 1 }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</span>
                <span style={{ display: "block", fontSize: 12, color: "var(--ink3)" }}>{item.soldOut ? "Esgotado" : item.optionGroups.length ? "Com opções" : item.categoryName}</span>
              </span>
              <span className="mono" style={{ fontSize: 13.5, fontWeight: 600 }}>{brl(item.price)}</span>
              {n > 0 && (
                <span className="mono" aria-label={`${n} no pedido`} style={{ minWidth: 26, height: 26, borderRadius: 999, background: "var(--brand)", color: "var(--brandInk)", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700 }}>
                  {n}
                </span>
              )}
            </button>
          );
        })}
        {shown.length === 0 && <div style={{ padding: "28px 8px", textAlign: "center", fontSize: 13, color: "var(--ink3)" }}>Nenhum prato encontrado.</div>}
      </div>

      <div style={{ position: "sticky", bottom: 0, padding: "10px 12px calc(10px + env(safe-area-inset-bottom, 0px))", background: "var(--surface)", borderTop: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: "var(--ink3)" }}>Mesa {String(table).padStart(2, "0")} · {count} {count === 1 ? "item" : "itens"}</div>
          <div className="mono" style={{ fontSize: 17, fontWeight: 600 }}>{brl(total)}</div>
        </div>
        <button type="button" className="btn btn-primary" style={{ minHeight: 48 }} disabled={!count} onClick={() => setReviewing(true)}>
          Revisar e enviar
        </button>
      </div>

      {/* Item 7 (I-2): like every panel, it closes only by its own X (or Esc / the Android back), not on the background. */}
      {choosing && (
        <Modal label={choosing.item.name} onClose={() => setChoosing(null)} style={{ maxWidth: 460 }}>
          {(close) => (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 12px 2px 20px" }}>
              <div style={{ flex: 1, fontSize: 16, fontWeight: 600 }}>{choosing.item.name}</div>
              <button type="button" className="icon-btn" title="Fechar" aria-label="Fechar" onClick={close}>
                <i className="fa-solid fa-xmark" style={{ fontSize: 16 }} />
              </button>
            </div>
            <div style={{ padding: "6px 20px 16px", display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>
              {choosing.item.optionGroups.map((g) => (
                <fieldset key={g.id} style={{ border: 0, padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                  <legend className="field-label" style={{ marginBottom: 6 }}>{g.label}</legend>
                  {g.options.map((o) => {
                    const on = choosing.picks[g.id]?.includes(o.id);
                    const pick = () =>
                      setChoosing({ ...choosing, picks: { ...choosing.picks, [g.id]: g.type === "single" ? [o.id] : on ? choosing.picks[g.id].filter((x) => x !== o.id) : [...(choosing.picks[g.id] ?? []), o.id] } });
                    return (
                      <label key={o.id} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, padding: "0 12px", borderRadius: 11, border: `1px solid ${on ? "var(--brand)" : "var(--line)"}`, background: on ? "var(--brandSoft)" : "transparent", cursor: "pointer" }}>
                        <input type={g.type === "single" ? "radio" : "checkbox"} name={g.id} checked={!!on} onChange={pick} />
                        <span style={{ flex: 1, fontSize: 14 }}>{o.label}</span>
                        {o.priceDelta !== 0 && <span className="mono" style={{ fontSize: 12.5, color: "var(--ink2)" }}>+{brl(o.priceDelta)}</span>}
                      </label>
                    );
                  })}
                </fieldset>
              ))}
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="field-label">Observação</span>
                <input className="field" maxLength={300} placeholder="Ex.: sem cebola" value={choosing.notes} onChange={(e) => setChoosing({ ...choosing, notes: e.target.value })} />
              </label>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 20px 18px", borderTop: "1px solid var(--line)" }}>
              <button type="button" className="icon-btn" aria-label="Diminuir quantidade" onClick={() => setChoosing({ ...choosing, quantity: Math.max(1, choosing.quantity - 1) })}>
                <i className="fa-solid fa-minus" />
              </button>
              <span className="mono" aria-label="Quantidade" style={{ minWidth: 22, textAlign: "center", fontWeight: 600 }}>{choosing.quantity}</span>
              <button type="button" className="icon-btn" aria-label="Aumentar quantidade" onClick={() => setChoosing({ ...choosing, quantity: choosing.quantity + 1 })}>
                <i className="fa-solid fa-plus" />
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1, minHeight: 48 }}
                onClick={() => {
                  add(choosing.item, choosing.picks, choosing.notes, choosing.quantity);
                  setChoosing(null);
                }}
              >
                Adicionar · {brl(unitPrice(choosing) * choosing.quantity)}
              </button>
            </div>
          </>
          )}
        </Modal>
      )}

      {reviewing && (
        <div className="modal-overlay">
          <div className="modal-panel" role="dialog" aria-label="Revisar pedido" style={{ maxWidth: 520 }}>
            <div style={{ padding: "18px 20px 8px", fontSize: 16, fontWeight: 600 }}>Pedido da Mesa {String(table).padStart(2, "0")}</div>
            <div style={{ padding: "0 20px 12px", display: "flex", flexDirection: "column", overflowY: "auto" }}>
              {lines.map((l) => (
                <div key={l.key} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{l.item.name}</div>
                      {choices(l) && <div style={{ fontSize: 12, color: "var(--ink3)" }}>{choices(l)}</div>}
                    </div>
                    <button type="button" className="icon-btn" aria-label={`Menos ${l.item.name}`} onClick={() => setQty(l.key, l.quantity - 1)}>
                      <i className={`fa-solid ${l.quantity === 1 ? "fa-trash" : "fa-minus"}`} />
                    </button>
                    <span className="mono" style={{ minWidth: 20, textAlign: "center", fontWeight: 600 }}>{l.quantity}</span>
                    <button type="button" className="icon-btn" aria-label={`Mais ${l.item.name}`} onClick={() => setQty(l.key, l.quantity + 1)}>
                      <i className="fa-solid fa-plus" />
                    </button>
                    <span className="mono" style={{ minWidth: 76, textAlign: "right", fontWeight: 600 }}>{brl(unitPrice(l) * l.quantity)}</span>
                  </div>
                  <input
                    className="field"
                    maxLength={300}
                    placeholder="Observação (opcional)"
                    aria-label={`Observação de ${l.item.name}`}
                    value={l.notes}
                    onChange={(e) => setLines((prev) => prev.map((x) => (x.key === l.key ? { ...x, notes: e.target.value } : x)))}
                    style={{ padding: "8px 11px", fontSize: 13 }}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, padding: "14px 20px 18px", borderTop: "1px solid var(--line)" }}>
              <div style={{ flexBasis: "100%", display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 12.5, color: "var(--ink3)", flex: 1 }}>
                  {count} {count === 1 ? "item" : "itens"}
                </span>
                <span className="mono" style={{ fontSize: 18, fontWeight: 600 }}>{brl(total)}</span>
              </div>
              <button type="button" className="btn btn-outline" style={{ minHeight: 48 }} onClick={() => setReviewing(false)}>
                Continuar
              </button>
              <button type="button" className="btn btn-primary" style={{ minHeight: 48, flex: 1 }} disabled={sending || !lines.length} onClick={send}>
                {sending ? "Enviando…" : "Enviar para a cozinha"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Desktop and tablet: /mesas/:number/pedido — back to the salon map, with the table selected. */
export default function LaunchOrderScreen() {
  const num = Number(useParams<{ number: string }>().number);
  const navigate = useNavigate();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button type="button" className="btn btn-outline" onClick={() => navigate("/mesas", { state: { select: num } })}>
          <i className="fa-solid fa-arrow-left" style={{ fontSize: 13 }} />
          Mesas
        </button>
        <div style={{ fontSize: 16, fontWeight: 600 }}>Lançar pedido · Mesa {String(num).padStart(2, "0")}</div>
      </div>
      <section className="card" style={{ overflow: "visible" }}>
        <LaunchOrder table={num} onSent={() => navigate("/mesas", { state: { select: num } })} />
      </section>
    </div>
  );
}

/** Phone: /mesas/:number/pedido inside the mobile shell, tab bar hidden so the total bar sits at the bottom. */
export function MobileLaunchOrderScreen() {
  const { number } = useParams<{ number: string }>();
  const navigate = useNavigate();
  useMobileScreen({ title: `Mesa ${number}`, subtitle: "Lançar pedido", hideTabs: true });
  return <LaunchOrder table={Number(number)} onSent={() => navigate(`/mesas/${number}`)} />;
}
