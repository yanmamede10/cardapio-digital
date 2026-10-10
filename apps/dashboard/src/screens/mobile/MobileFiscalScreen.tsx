import { useEffect, useState } from "react";
import type { FiscalInfo, TaxRegime } from "@cardapio/shared";
import { TAX_REGIME_LABEL } from "@cardapio/shared";
import { api } from "../../lib/api";
import { useMobileScreen } from "../../components/mobile/MobileLayout";

export default function MobileFiscalScreen() {
  const { notify } = useMobileScreen({ title: "Dados fiscais", subtitle: "Preparo para nota fiscal" });
  const [fiscal, setFiscal] = useState<FiscalInfo | null>(null);

  useEffect(() => {
    api.getFiscal().then(setFiscal);
  }, []);

  const save = async () => {
    if (!fiscal) return;
    try {
      await api.updateFiscal(fiscal);
      notify("Dados fiscais atualizados");
    } catch {
      notify("Não foi possível salvar os dados fiscais");
    }
  };

  if (!fiscal) {
    return (
      <div style={{ padding: 12 }}>
        <div className="skeleton" style={{ height: 320 }} />
      </div>
    );
  }

  return (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 10, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 12, padding: 12 }}>
        <i className="fa-solid fa-circle-info" style={{ fontSize: "var(--icon-sm)", color: "var(--ink3)", marginTop: 2 }} />
        <div style={{ fontSize: "var(--text-footnote)", color: "var(--ink2)", textWrap: "pretty" }}>Estes dados serão usados pelo módulo de emissão de nota fiscal, ainda em desenvolvimento.</div>
      </div>
      <section style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: 13, display: "flex", flexDirection: "column", gap: 11 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span className="field-label">Razão social</span>
          <input value={fiscal.legalName} onChange={(e) => setFiscal({ ...fiscal, legalName: e.target.value })} className="field-mobile" />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span className="field-label">CNPJ</span>
          <input inputMode="numeric" value={fiscal.cnpj} onChange={(e) => setFiscal({ ...fiscal, cnpj: e.target.value })} className="field-mobile mono" />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span className="field-label">Inscrição estadual</span>
          <input value={fiscal.stateRegistration} onChange={(e) => setFiscal({ ...fiscal, stateRegistration: e.target.value })} className="field-mobile mono" />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span className="field-label">Regime tributário</span>
          <select value={fiscal.taxRegime} onChange={(e) => setFiscal({ ...fiscal, taxRegime: e.target.value as TaxRegime })} className="field-mobile">
            {(Object.keys(TAX_REGIME_LABEL) as TaxRegime[]).map((r) => (
              <option key={r} value={r}>
                {TAX_REGIME_LABEL[r]}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span className="field-label">Endereço fiscal</span>
          <input value={fiscal.fiscalAddress} onChange={(e) => setFiscal({ ...fiscal, fiscalAddress: e.target.value })} className="field-mobile" />
        </label>
      </section>
      <button type="button" onClick={save} style={{ minHeight: 50, background: "var(--brand)", color: "var(--brandInk)", border: 0, borderRadius: 12, cursor: "pointer", font: "inherit", fontSize: "var(--text-body)", fontWeight: 600 }}>
        Salvar dados fiscais
      </button>
    </div>
  );
}
