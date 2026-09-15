import { useEffect, useState } from "react";
import type { FiscalInfo } from "@cardapio/shared";
import { api } from "../../lib/api";
import { useMobileScreen } from "../../components/mobile/MobileLayout";

const fieldLabel = { fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: ".09em", textTransform: "uppercase" as const, color: "var(--ink3)" };
const fieldInput = { minHeight: 46, border: "1px solid var(--line)", background: "var(--surface2)", borderRadius: 11, padding: "0 12px", font: "inherit", fontSize: 13.5, color: "var(--ink)", outline: "none" };

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
        <i className="fa-solid fa-circle-info" style={{ fontSize: 14, color: "var(--ink3)", marginTop: 2 }} />
        <div style={{ fontSize: 12, color: "var(--ink2)", textWrap: "pretty" }}>Estes dados serão usados pelo módulo de emissão de nota fiscal, ainda em desenvolvimento.</div>
      </div>
      <section style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: 13, display: "flex", flexDirection: "column", gap: 11 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span style={fieldLabel}>Razão social</span>
          <input value={fiscal.legalName} onChange={(e) => setFiscal({ ...fiscal, legalName: e.target.value })} style={fieldInput} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span style={fieldLabel}>CNPJ</span>
          <input value={fiscal.cnpj} onChange={(e) => setFiscal({ ...fiscal, cnpj: e.target.value })} className="mono" style={fieldInput} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span style={fieldLabel}>Inscrição estadual</span>
          <input value={fiscal.stateRegistration} onChange={(e) => setFiscal({ ...fiscal, stateRegistration: e.target.value })} className="mono" style={fieldInput} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span style={fieldLabel}>Regime tributário</span>
          <input value={fiscal.taxRegime} onChange={(e) => setFiscal({ ...fiscal, taxRegime: e.target.value })} style={fieldInput} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span style={fieldLabel}>Endereço fiscal</span>
          <input value={fiscal.fiscalAddress} onChange={(e) => setFiscal({ ...fiscal, fiscalAddress: e.target.value })} style={fieldInput} />
        </label>
      </section>
      <button type="button" onClick={save} style={{ minHeight: 50, background: "var(--brand)", color: "var(--brandInk)", border: 0, borderRadius: 12, cursor: "pointer", font: "inherit", fontSize: 13.5, fontWeight: 600 }}>
        Salvar dados fiscais
      </button>
    </div>
  );
}
