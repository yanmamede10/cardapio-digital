import { useEffect, useMemo, useState } from "react";
import type { Coupon, CouponChannel, CouponKind, MenuItem } from "@cardapio/shared";
import { ApiError, api } from "../lib/api";
import { brl, fmtDate } from "../lib/format";
import { useDashboardState } from "../state/DashboardStateContext";
import { EmptyState } from "../components/EmptyState";
import { SlideOver, Field } from "../components/SlideOver";

const KIND_LABEL: Record<CouponKind, string> = { percent: "Percentual", fixed: "Valor fixo", combo: "Combo" };
const CHANNEL_LABEL: Record<CouponChannel, string> = { table: "Mesa", delivery: "Delivery", both: "Mesa e delivery" };

interface Draft {
  code: string;
  kind: CouponKind;
  value: string;
  channel: CouponChannel;
  validUntil: string;
  usageLimit: string;
  comboItemIds: string[];
  comboPrice: string;
}

const EMPTY_DRAFT: Draft = { code: "", kind: "percent", value: "10", channel: "both", validUntil: "", usageLimit: "100", comboItemIds: [], comboPrice: "" };

function valueLabel(c: Coupon): string {
  if (c.kind === "percent") return `${c.value}% off`;
  if (c.kind === "fixed") return `${brl(c.value)} off`;
  return c.comboPrice != null ? `Combo por ${brl(c.comboPrice)}` : "Combo";
}

export default function PromotionsScreen() {
  const { notify } = useDashboardState();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [drawer, setDrawer] = useState<Draft | null>(null);

  const reload = () =>
    api
      .listCoupons()
      .then((c) => {
        setCoupons(c);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof ApiError && err.status === 403 ? "Você não tem permissão para acessar Promoções e Cupons." : "Não foi possível carregar Promoções e Cupons.");
        setLoading(false);
      });

  useEffect(() => {
    reload();
    api.listItems().then(setItems);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => api.listCoupons(query || undefined).then(setCoupons), 200);
    return () => clearTimeout(id);
  }, [query]);

  const stats = useMemo(
    () => ({
      active: coupons.filter((c) => c.active).length,
      uses: coupons.reduce((t, c) => t + c.usedCount, 0)
    }),
    [coupons]
  );

  const openNew = () => setDrawer({ ...EMPTY_DRAFT, validUntil: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) });

  const toggleActive = async (c: Coupon) => {
    try {
      const updated = await api.setCouponActive(c.id, !c.active);
      setCoupons((prev) => prev.map((x) => (x.id === c.id ? updated : x)));
      notify(`Cupom ${c.code} ${updated.active ? "ativado" : "pausado"}`);
    } catch {
      notify("Não foi possível atualizar o cupom");
    }
  };

  const duplicate = async (c: Coupon) => {
    try {
      await api.duplicateCoupon(c.id);
      notify(`Cupom ${c.code} duplicado`);
      reload();
    } catch {
      notify("Não foi possível duplicar o cupom");
    }
  };

  const remove = async (c: Coupon) => {
    if (!window.confirm(`Excluir o cupom ${c.code}? Essa ação não pode ser desfeita.`)) return;
    try {
      await api.deleteCoupon(c.id);
      notify(`Cupom ${c.code} excluído`);
      reload();
    } catch {
      notify("Não foi possível excluir o cupom");
    }
  };

  const toggleComboItem = (itemId: string) => {
    if (!drawer) return;
    setDrawer({
      ...drawer,
      comboItemIds: drawer.comboItemIds.includes(itemId) ? drawer.comboItemIds.filter((i) => i !== itemId) : [...drawer.comboItemIds, itemId]
    });
  };

  const save = async () => {
    if (!drawer || !drawer.code.trim()) return;
    try {
      await api.createCoupon({
        code: drawer.code.trim().toUpperCase(),
        kind: drawer.kind,
        value: drawer.kind === "combo" ? 0 : Number(drawer.value.replace(",", ".")) || 0,
        channel: drawer.channel,
        validUntil: new Date(drawer.validUntil || Date.now()).toISOString(),
        usageLimit: Number(drawer.usageLimit) || 0,
        ...(drawer.kind === "combo" ? { comboItemIds: drawer.comboItemIds, comboPrice: Number(drawer.comboPrice.replace(",", ".")) || 0 } : {})
      });
      setDrawer(null);
      notify("Cupom criado e publicado");
      reload();
    } catch {
      notify("Não foi possível criar o cupom");
    }
  };

  if (error) {
    return <p style={{ color: "var(--ink2)" }}>{error}</p>;
  }

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="skeleton" style={{ height: 44 }} />
        <div className="skeleton" style={{ height: 320 }} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 13, padding: "9px 14px", width: 250 }}>
          <i className="fa-solid fa-magnifying-glass" style={{ fontSize: 18, lineHeight: 1, color: "var(--ink3)" }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar cupom" style={{ border: 0, background: "transparent", outline: "none", font: "inherit", fontSize: 13, color: "var(--ink)", width: "100%", minWidth: 0 }} />
        </div>
        <div style={{ display: "flex", gap: 8, fontSize: 12.5, color: "var(--ink2)" }}>
          <span className="pill" style={{ background: "var(--surface2)", border: "1px solid var(--line)" }}>
            <span className="dot" style={{ background: "var(--ok)" }} />
            {stats.active} ativos
          </span>
          <span className="pill" style={{ background: "var(--surface2)", border: "1px solid var(--line)" }}>
            <i className="fa-solid fa-ticket" style={{ fontSize: 13 }} />
            {stats.uses} usos totais
          </span>
        </div>
        <div style={{ flex: 1 }} />
        <button type="button" className="btn btn-primary" onClick={openNew}>
          <i className="fa-solid fa-plus" style={{ fontSize: 18, lineHeight: 1 }} />
          Novo cupom
        </button>
      </div>

      {coupons.length === 0 ? (
        <EmptyState
          icon="fa-tag"
          title="Nenhum cupom cadastrado"
          sub="Crie promoções por percentual, valor fixo ou combos para impulsionar pedidos na mesa e no delivery."
          action={
            <button type="button" className="btn btn-primary" onClick={openNew}>
              <i className="fa-solid fa-plus" style={{ fontSize: 18, lineHeight: 1 }} />
              Criar primeiro cupom
            </button>
          }
        />
      ) : (
        <section className="card" style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 130px 130px 90px 90px 92px", gap: 12, padding: "10px 14px", background: "var(--surface2)", borderBottom: "1px solid var(--line)", minWidth: 800 }}>
            {["Código", "Benefício", "Canal", "Validade", "Uso", "Status", ""].map((h) => (
              <div key={h} className="field-label">
                {h}
              </div>
            ))}
          </div>
          {coupons.map((c) => {
            const expired = new Date(c.validUntil).getTime() < Date.now();
            return (
              <div key={c.id} style={{ display: "grid", gridTemplateColumns: "120px 1fr 130px 130px 90px 90px 92px", gap: 12, alignItems: "center", padding: "11px 14px", borderBottom: "1px solid var(--line)", minWidth: 800 }}>
                <div className="mono" style={{ fontWeight: 600, fontSize: 13 }}>
                  {c.code}
                </div>
                <div style={{ fontSize: 13, color: "var(--ink2)" }}>
                  {valueLabel(c)}
                  <span style={{ color: "var(--ink3)" }}> · {KIND_LABEL[c.kind]}</span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--ink2)" }}>{CHANNEL_LABEL[c.channel]}</div>
                <div className="mono" style={{ fontSize: 12, color: expired ? "var(--alert)" : "var(--ink3)" }}>
                  {expired ? "Expirado" : `até ${fmtDate(c.validUntil)}`}
                </div>
                <div className="mono" style={{ fontSize: 12.5 }}>
                  {c.usedCount}/{c.usageLimit}
                </div>
                <button type="button" onClick={() => toggleActive(c)} aria-label={c.active ? `Desativar cupom ${c.code}` : `Ativar cupom ${c.code}`} style={{ display: "flex", alignItems: "center", gap: 7, background: "transparent", border: 0, cursor: "pointer", font: "inherit", padding: 0 }}>
                  <span className="toggle-track" style={{ background: c.active ? "var(--ok)" : "var(--line2)" }}>
                    <span className="toggle-knob" style={{ left: c.active ? 16 : 2 }} />
                  </span>
                </button>
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  <button type="button" title="Duplicar" aria-label={`Duplicar cupom ${c.code}`} className="icon-btn" onClick={() => duplicate(c)}>
                    <i className="fa-solid fa-copy" style={{ fontSize: 16, lineHeight: 1 }} />
                  </button>
                  <button type="button" title="Excluir" aria-label={`Excluir cupom ${c.code}`} className="icon-btn" style={{ color: "var(--alert)" }} onClick={() => remove(c)}>
                    <i className="fa-solid fa-trash" style={{ fontSize: 16, lineHeight: 1 }} />
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {drawer && (
        <SlideOver
          title="Novo cupom"
          subtitle="Publicado imediatamente ao salvar"
          onClose={() => setDrawer(null)}
          footer={
            <>
              <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={save}>
                Criar cupom
              </button>
              <button type="button" className="btn btn-outline" onClick={() => setDrawer(null)}>
                Cancelar
              </button>
            </>
          }
        >
          <Field label="Código">
            <input className="field mono" style={{ textTransform: "uppercase" }} value={drawer.code} onChange={(e) => setDrawer({ ...drawer, code: e.target.value })} placeholder="Ex.: VERAO25" />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Tipo">
              <select className="field" value={drawer.kind} onChange={(e) => setDrawer({ ...drawer, kind: e.target.value as CouponKind })}>
                {(Object.keys(KIND_LABEL) as CouponKind[]).map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Canal">
              <select className="field" value={drawer.channel} onChange={(e) => setDrawer({ ...drawer, channel: e.target.value as CouponChannel })}>
                {(Object.keys(CHANNEL_LABEL) as CouponChannel[]).map((c) => (
                  <option key={c} value={c}>
                    {CHANNEL_LABEL[c]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {drawer.kind !== "combo" ? (
            <Field label={drawer.kind === "percent" ? "Percentual de desconto" : "Valor do desconto"}>
              <input inputMode="decimal" className="field mono" value={drawer.value} onChange={(e) => setDrawer({ ...drawer, value: e.target.value })} placeholder={drawer.kind === "percent" ? "10" : "0,00"} />
            </Field>
          ) : (
            <>
              <Field label="Itens do combo">
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto", border: "1px solid var(--line)", borderRadius: 9, padding: 8 }}>
                  {items.map((it) => (
                    <label key={it.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                      <input type="checkbox" checked={drawer.comboItemIds.includes(it.id)} onChange={() => toggleComboItem(it.id)} />
                      {it.name}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="Preço do combo">
                <input inputMode="decimal" className="field mono" value={drawer.comboPrice} onChange={(e) => setDrawer({ ...drawer, comboPrice: e.target.value })} placeholder="R$ 0,00" />
              </Field>
            </>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Válido até">
              <input type="date" className="field mono" value={drawer.validUntil} onChange={(e) => setDrawer({ ...drawer, validUntil: e.target.value })} />
            </Field>
            <Field label="Limite de uso">
              <input inputMode="numeric" className="field mono" value={drawer.usageLimit} onChange={(e) => setDrawer({ ...drawer, usageLimit: e.target.value })} placeholder="100" />
            </Field>
          </div>
        </SlideOver>
      )}
    </div>
  );
}
