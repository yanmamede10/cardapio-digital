import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Coupon, CouponChannel, CouponKind } from "@cardapio/shared";
import { api } from "../../lib/api";
import { brl, fmtDate } from "../../lib/format";
import { useMobileScreen } from "../../components/mobile/MobileLayout";
import { MobileChip } from "../../components/mobile/MobileChip";
import { MobileEmptyState } from "../../components/mobile/MobileEmptyState";
import { MobileToggle } from "../../components/mobile/MobileToggle";

const KIND_ICON: Record<CouponKind, string> = { percent: "fa-percent", fixed: "fa-money-bill", combo: "fa-gift" };
const CHANNEL_LABEL: Record<CouponChannel, string> = { table: "Mesa", delivery: "Delivery", both: "Ambos" };

function valueLabel(c: Coupon): string {
  if (c.kind === "percent") return `${c.value}% off`;
  if (c.kind === "fixed") return `${brl(c.value)} off`;
  return c.comboPrice != null ? `Combo por ${brl(c.comboPrice)}` : "Combo";
}

export default function MobilePromotionsScreen() {
  const navigate = useNavigate();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<"Todos" | "Ativos" | "Expirados">("Todos");
  const { notify } = useMobileScreen({ title: "Promoções e Cupons", subtitle: "Campanhas ativas e expiradas", fab: { label: "Novo cupom", onClick: () => navigate("/promocoes/novo") } });

  const reload = () => api.listCoupons().then((c) => (setCoupons(c), setLoaded(true)));

  useEffect(() => {
    reload();
  }, []);

  const now = Date.now();
  const visible = coupons.filter((c) => {
    const expired = new Date(c.validUntil).getTime() < now;
    if (filter === "Ativos") return !expired && c.active;
    if (filter === "Expirados") return expired;
    return true;
  });

  const toggleActive = async (c: Coupon) => {
    try {
      const updated = await api.setCouponActive(c.id, !c.active);
      setCoupons((prev) => prev.map((x) => (x.id === c.id ? updated : x)));
      notify(`Cupom ${c.code} ${updated.active ? "ativado" : "pausado"}`);
    } catch {
      notify("Não foi possível atualizar o cupom");
    }
  };

  if (!loaded) {
    return (
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton" style={{ height: 110 }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ padding: "12px 12px 90px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 6 }}>
        {(["Todos", "Ativos", "Expirados"] as const).map((f) => (
          <MobileChip key={f} active={filter === f} onClick={() => setFilter(f)} grow>
            {f}
          </MobileChip>
        ))}
      </div>

      {visible.map((c) => {
        const expired = new Date(c.validUntil).getTime() < now;
        const status = expired ? "Expirado" : c.active ? "Ativo" : "Pausado";
        const stBg = status === "Ativo" ? "color-mix(in srgb, var(--ok) 16%, transparent)" : "var(--surface2)";
        const stFg = status === "Ativo" ? "var(--ok)" : "var(--ink3)";
        return (
          <article key={c.id} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 13, padding: 12, display: "flex", flexDirection: "column", gap: 9 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div style={{ width: 38, height: 38, flex: "0 0 38px", borderRadius: 10, background: "var(--surface2)", border: "1px solid var(--line)", color: "var(--ink2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <i className={`fa-solid ${KIND_ICON[c.kind]}`} style={{ fontSize: "var(--icon-sm)" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mono" style={{ fontSize: "var(--text-body)", fontWeight: 600, letterSpacing: ".04em" }}>
                  {c.code}
                </div>
                <div style={{ fontSize: "var(--text-footnote)", color: "var(--ink3)" }}>{valueLabel(c)}</div>
              </div>
              <span style={{ fontSize: "var(--text-caption)", fontWeight: 600, borderRadius: 20, padding: "2px 9px", background: stBg, color: stFg }}>{status}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: "var(--text-footnote)", color: "var(--ink2)", background: "var(--surface2)", borderRadius: 20, padding: "3px 10px" }}>
                <i className="fa-solid fa-calendar-days" style={{ fontSize: "var(--icon-sm)", marginRight: 6 }} />
                {expired ? `expirou ${fmtDate(c.validUntil)}` : `até ${fmtDate(c.validUntil)}`}
              </span>
              <span style={{ fontSize: "var(--text-footnote)", color: "var(--ink2)", background: "var(--surface2)", borderRadius: 20, padding: "3px 10px" }}>{CHANNEL_LABEL[c.channel]}</span>
              <span className="mono" style={{ fontSize: "var(--text-footnote)", fontWeight: 600, color: "var(--brandText)", background: "var(--brandSoft)", borderRadius: 20, padding: "3px 10px" }}>
                {c.usedCount}/{c.usageLimit} usos
              </span>
              {!expired && (
                <div style={{ marginLeft: "auto" }}>
                  <MobileToggle on={c.active} onClick={() => toggleActive(c)} label={`Cupom ${c.code} ativo`} />
                </div>
              )}
            </div>
          </article>
        );
      })}

      {visible.length === 0 && <MobileEmptyState icon="fa-tag" title="Nenhum cupom encontrado" sub="Crie um cupom para incentivar pedidos no delivery ou na mesa." />}
    </div>
  );
}
