import { useEffect, useState } from "react";
import { useDiscardGuard } from "../../components/Modal";
import { useNavigate } from "react-router-dom";
import type { CouponChannel, CouponKind, MenuItem } from "@cardapio/shared";
import { api } from "../../lib/api";
import { brl } from "../../lib/format";
import { useMobileScreen } from "../../components/mobile/MobileLayout";

const CHANNELS: { key: CouponChannel; label: string }[] = [
  { key: "table", label: "Mesa" },
  { key: "delivery", label: "Delivery" },
  { key: "both", label: "Ambos" }
];

export default function MobileCouponFormScreen() {
  const navigate = useNavigate();
  const { notify } = useMobileScreen({ title: "Novo cupom", subtitle: "Desconto ou combo", hideTabs: true });

  const [items, setItems] = useState<MenuItem[]>([]);
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<Extract<CouponKind, "percent" | "fixed">>("percent");
  const [value, setValue] = useState("20");
  const [validUntil, setValidUntil] = useState(() => new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  const [channel, setChannel] = useState<CouponChannel>("both");
  const [usageLimit, setUsageLimit] = useState("200");
  const [comboSel, setComboSel] = useState<string[]>([]);

  useEffect(() => {
    api.listItems().then(setItems);
  }, []);

  const toggleCombo = (id: string) => setComboSel((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const comboPrice = Math.round(items.filter((i) => comboSel.includes(i.id)).reduce((a, i) => a + i.price, 0) * 0.85 * 100) / 100;

  // UX-08: Cancelar, the header's back arrow and the Android back ask before losing what was typed.
  const fields = JSON.stringify([code, kind, value, validUntil, channel, usageLimit, comboSel]);
  const [start] = useState(fields);
  const guard = useDiscardGuard(fields !== start, () => navigate(-1));

  const save = async () => {
    if (!code.trim()) {
      notify("Informe o código do cupom");
      return;
    }
    try {
      await api.createCoupon({
        code: code.trim().toUpperCase(),
        kind: comboSel.length > 0 ? "combo" : kind,
        value: comboSel.length > 0 ? 0 : Number(value.replace(",", ".")) || 0,
        channel,
        validUntil: new Date(validUntil || Date.now()).toISOString(),
        usageLimit: Number(usageLimit) || 0,
        ...(comboSel.length > 0 ? { comboItemIds: comboSel, comboPrice } : {})
      });
      notify("Cupom criado e publicado");
      navigate(-1);
    } catch {
      notify("Não foi possível criar o cupom");
    }
  };

  return (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
      <section style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: 13, display: "flex", flexDirection: "column", gap: 11 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span className="field-label">Código do cupom</span>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="VERAO20" className="field-mobile mono" style={{ letterSpacing: ".06em", fontSize: "var(--text-body)" }} />
        </label>

        <div>
          <div className="field-label" style={{ marginBottom: 6 }}>Tipo de desconto</div>
          <div style={{ display: "flex", gap: 7 }}>
            {[
              { key: "percent" as const, label: "Percentual", icon: "fa-percent" },
              { key: "fixed" as const, label: "Valor fixo", icon: "fa-money-bill" }
            ].map((t) => {
              const active = kind === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setKind(t.key)}
                  style={{ flex: 1, minHeight: 46, borderRadius: 11, cursor: "pointer", font: "inherit", fontSize: "var(--text-subheadline)", fontWeight: 600, background: active ? "var(--brandSoft)" : "var(--surface2)", color: active ? "var(--brandText)" : "var(--ink2)", border: `1px solid ${active ? "var(--brand)" : "var(--line)"}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}
                >
                  <i className={`fa-solid ${t.icon}`} style={{ fontSize: "var(--icon-sm)" }} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span className="field-label">Valor</span>
            <input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder={kind === "percent" ? "20" : "15,00"} className="field-mobile mono" />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span className="field-label">Validade</span>
            <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="field-mobile mono" />
          </label>
        </div>

        <div>
          <div className="field-label" style={{ marginBottom: 6 }}>Canal de aplicação</div>
          <div style={{ display: "flex", gap: 7 }}>
            {CHANNELS.map((c) => {
              const active = channel === c.key;
              return (
                <button key={c.key} type="button" onClick={() => setChannel(c.key)} style={{ flex: 1, minHeight: 44, borderRadius: 11, cursor: "pointer", font: "inherit", fontSize: "var(--text-subheadline)", fontWeight: 500, background: active ? "var(--brandSoft)" : "var(--surface2)", color: active ? "var(--brandText)" : "var(--ink2)", border: `1px solid ${active ? "var(--brand)" : "var(--line)"}` }}>
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span className="field-label">Limite de uso</span>
          <input inputMode="numeric" value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} placeholder="200" className="field-mobile" />
        </label>
      </section>

      <section style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: 13, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: "var(--text-subheadline)", fontWeight: 600 }}>Combo promocional</div>
        <div style={{ fontSize: "var(--text-footnote)", color: "var(--ink3)" }}>Selecione itens do cardápio para transformar este cupom em um combo com preço fechado.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7, maxHeight: 220, overflowY: "auto" }}>
          {items.map((i) => {
            const on = comboSel.includes(i.id);
            return (
              <button
                key={i.id}
                type="button"
                onClick={() => toggleCombo(i.id)}
                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", minHeight: 48, background: "var(--surface2)", border: `1px solid ${on ? "var(--brand)" : "var(--line)"}`, borderRadius: 11, padding: "0 12px", cursor: "pointer", font: "inherit", color: "var(--ink)" }}
              >
                <i className={`fa-solid ${on ? "fa-square-check" : "fa-square"}`} style={{ fontSize: "var(--icon-sm)", color: on ? "var(--brandText)" : "var(--ink3)" }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: "var(--text-subheadline)" }}>{i.name}</span>
                <span className="mono" style={{ fontSize: "var(--text-subheadline)", color: "var(--ink2)" }}>
                  {brl(i.price)}
                </span>
              </button>
            );
          })}
        </div>
        {comboSel.length > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingTop: 6, borderTop: "1px solid var(--line)" }}>
            <span style={{ fontSize: "var(--text-subheadline)", color: "var(--ink2)" }}>Preço do combo</span>
            <span className="mono" style={{ fontSize: "var(--text-title3)", fontWeight: 600, color: "var(--brandText)" }}>
              {brl(comboPrice)}
            </span>
          </div>
        )}
      </section>

      <div style={{ display: "flex", gap: 9 }}>
        <button type="button" onClick={guard.request} style={{ flex: "0 0 36%", minHeight: 50, background: "transparent", border: "1px solid var(--line2)", color: "var(--ink2)", borderRadius: 12, cursor: "pointer", font: "inherit", fontSize: "var(--text-body)", fontWeight: 600 }}>
          Cancelar
        </button>
        <button type="button" onClick={save} style={{ flex: 1, minHeight: 50, background: "var(--brand)", color: "var(--brandInk)", border: 0, borderRadius: 12, cursor: "pointer", font: "inherit", fontSize: "var(--text-body)", fontWeight: 600 }}>
          Criar cupom
        </button>
      </div>
      {guard.confirm}
    </div>
  );
}
