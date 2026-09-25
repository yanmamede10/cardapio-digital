import { useEffect, useRef, useState } from "react";
import type { PaymentMode, TaxRegime } from "@cardapio/shared";
import { PAYMENT_MODE_LABEL, TAX_REGIME_LABEL } from "@cardapio/shared";
import { useNavigate } from "react-router-dom";
import { Field } from "../components/SlideOver";
import { Segmented } from "../components/Segmented";
import { api } from "../lib/api";
import { useDashboardState } from "../state/DashboardStateContext";

type SubStatus = "form" | "pending" | "approved" | "rejected";

interface DocState {
  status: "empty" | "loading" | "preview" | "error";
  fileName?: string;
  sizeLabel?: string;
  error?: string;
}

const emptyDoc: DocState = { status: "empty" };

const STEPS = (status: SubStatus) => [
  { label: "Dados e documento enviados", sub: "enviado agora", icon: "fa-circle-check", fg: "var(--ok)" },
  {
    label: "Análise do parceiro de pagamento",
    sub: status === "pending" ? "em andamento · até 1 dia útil" : status === "rejected" ? "reprovada" : "concluída",
    icon: status === "pending" ? "fa-clock" : status === "rejected" ? "fa-circle-xmark" : "fa-circle-check",
    fg: status === "pending" ? "var(--warn)" : status === "rejected" ? "var(--alert)" : "var(--ok)"
  },
  {
    label: "Subconta ativa no seu CNPJ",
    sub: status === "approved" ? "liberada · recebendo pagamentos" : "aguardando aprovação",
    icon: status === "approved" ? "fa-circle-check" : "fa-circle",
    fg: status === "approved" ? "var(--ok)" : "var(--ink3)"
  }
];

export default function PaymentSubaccountTab() {
  const { notify } = useDashboardState();
  const navigate = useNavigate();
  const [status, setStatus] = useState<SubStatus>("form");
  const [cnpj, setCnpj] = useState("");
  const [legalName, setLegalName] = useState("");
  const [taxRegime, setTaxRegime] = useState<TaxRegime>("simples_nacional");
  const [doc, setDoc] = useState<DocState>(emptyDoc);
  const docInput = useRef<HTMLInputElement>(null);
  const [paymentMode, setPaymentModeValue] = useState<PaymentMode>("maquininha_propria");

  useEffect(() => {
    api.getPaymentMode().then((r) => setPaymentModeValue(r.paymentMode)).catch(() => {});
  }, []);

  const changePaymentMode = async (mode: PaymentMode) => {
    const previous = paymentMode;
    setPaymentModeValue(mode);
    try {
      await api.setPaymentMode(mode);
      notify("Forma de recebimento no balcão atualizada");
    } catch {
      setPaymentModeValue(previous);
      notify("Não foi possível salvar — tente de novo");
    }
  };

  const onDocFile = (file: File) => {
    if (!/pdf|jpe?g|png/i.test(file.type)) {
      setDoc({ status: "error", error: `${file.name} não é suportado — envie PDF, JPG ou PNG.` });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setDoc({ status: "error", error: "Arquivo de até 10 MB." });
      return;
    }
    setDoc({ status: "loading", fileName: file.name, sizeLabel: `${(file.size / 1024 / 1024).toFixed(1)} MB` });
    setTimeout(() => setDoc((d) => (d.status === "loading" ? { ...d, status: "preview" } : d)), 900);
  };

  const onSubmitOnboarding = () => {
    setStatus("pending");
    notify("Dados enviados para análise");
  };

  const goSupport = () => navigate("/atendimento");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <section className="card" style={{ padding: 22, display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240, display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Como vocês recebem pagamento no balcão?</div>
          <div style={{ fontSize: 12.5, color: "var(--ink2)", lineHeight: 1.6 }}>
            Define se o fechamento de comanda mostra o QR PIX da MesaPronta ou só registra a forma paga na maquininha de vocês.
          </div>
        </div>
        <Segmented
          value={paymentMode}
          onChange={changePaymentMode}
          options={[
            { value: "maquininha_propria", label: PAYMENT_MODE_LABEL.maquininha_propria },
            { value: "sistema", label: PAYMENT_MODE_LABEL.sistema }
          ]}
        />
      </section>

      {paymentMode !== "sistema" && (
        <section className="card" style={{ padding: 22, display: "flex", gap: 18, alignItems: "flex-start" }}>
          <div style={{ width: 46, height: 46, borderRadius: 16, background: "var(--surface2)", color: "var(--ink2)", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 46px" }}>
            <i className="fa-solid fa-credit-card" style={{ fontSize: 20, lineHeight: 1 }} />
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Não é necessário abrir subconta</div>
            <div style={{ fontSize: 12.5, color: "var(--ink2)", lineHeight: 1.6, marginTop: 4 }}>
              Como vocês recebem pela maquininha própria, o fechamento de comanda só registra a forma de pagamento usada — sem QR nem repasse pela MesaPronta.
            </div>
          </div>
        </section>
      )}

      {paymentMode === "sistema" && (
      <>
      <section className="card" style={{ padding: 22, display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ width: 46, height: 46, borderRadius: 16, background: "var(--brandSoft)", color: "var(--brandText)", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 46px" }}>
          <i className="fa-solid fa-shield-halved" style={{ fontSize: 22, lineHeight: 1 }} />
        </div>
        <div style={{ flex: 1, minWidth: 240, display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>O dinheiro cai direto na conta do seu restaurante</div>
          <div style={{ fontSize: 12.5, color: "var(--ink2)", lineHeight: 1.6 }}>
            A subconta é aberta no seu CNPJ, no banco que você indicar. Cada pagamento é liquidado direto para você — a MesaPronta nunca fica com o seu caixa, só desconta a taxa por transação no momento do repasse.
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
          <Segmented
            value={status}
            onChange={setStatus}
            options={[
              { value: "form", label: "Formulário" },
              { value: "pending", label: "Pendente" },
              { value: "approved", label: "Aprovado" },
              { value: "rejected", label: "Rejeitado" }
            ]}
          />
          <span style={{ fontSize: 10.5, color: "var(--ink3)" }}>Estado mockado — troque para visualizar</span>
        </div>
      </section>

      {status === "form" && (
        <section className="card" style={{ padding: 24, maxWidth: 560, display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Abrir subconta de pagamento</div>
            <div style={{ fontSize: 12.5, color: "var(--ink2)" }}>Leva cerca de 3 minutos. A análise do parceiro sai em até 1 dia útil.</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            <Field label="CNPJ">
              <input className="field mono" placeholder="00.000.000/0000-00" value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
            </Field>
            <Field label="Razão social">
              <input className="field" placeholder="Nome da empresa" value={legalName} onChange={(e) => setLegalName(e.target.value)} />
            </Field>
            <Field label="Regime tributário">
              <select className="field" value={taxRegime} onChange={(e) => setTaxRegime(e.target.value as TaxRegime)}>
                {(Object.keys(TAX_REGIME_LABEL) as TaxRegime[]).map((r) => (
                  <option key={r} value={r}>
                    {TAX_REGIME_LABEL[r]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            <span className="field-label">Documento da empresa</span>
            <input ref={docInput} type="file" accept="application/pdf,image/jpeg,image/png" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && onDocFile(e.target.files[0])} />
            {doc.status === "empty" && (
              <button type="button" onClick={() => docInput.current?.click()} className="tap" style={{ border: "1.5px dashed var(--line2)", background: "transparent", color: "var(--ink2)", borderRadius: 16, padding: 22, cursor: "pointer", font: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <i className="fa-solid fa-arrow-up-from-bracket" style={{ fontSize: 21, lineHeight: 1 }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Enviar contrato social ou CCMEI</span>
                <span style={{ fontSize: 11.5, color: "var(--ink3)" }}>PDF, JPG ou PNG de até 10 MB</span>
              </button>
            )}
            {doc.status === "loading" && (
              <div style={{ display: "flex", alignItems: "center", gap: 14, border: "1px solid var(--line)", background: "var(--surface2)", borderRadius: 16, padding: "15px 18px" }}>
                <i className="fa-solid fa-spinner" style={{ fontSize: 20, lineHeight: 1, animation: "sk 1.1s ease-in-out infinite", color: "var(--ink3)" }} />
                <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: "var(--ink2)" }}>Enviando {doc.fileName}…</div>
              </div>
            )}
            {doc.status === "preview" && (
              <div style={{ display: "flex", alignItems: "center", gap: 14, border: "1px solid var(--line)", background: "var(--surface2)", borderRadius: 16, padding: "15px 18px" }}>
                <div style={{ width: 38, height: 38, borderRadius: 13, background: "var(--surface)", border: "1px solid var(--line)", color: "var(--ink2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <i className="fa-solid fa-file-pdf" style={{ fontSize: 19, lineHeight: 1 }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.fileName}</div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--ink3)" }}>{doc.sizeLabel} · enviado agora</div>
                </div>
                <i className="fa-solid fa-circle-check" style={{ fontSize: 18, lineHeight: 1, color: "var(--ok)" }} />
                <button type="button" className="icon-btn" title="Remover" aria-label="Remover documento" onClick={() => setDoc(emptyDoc)}>
                  <i className="fa-solid fa-xmark" style={{ fontSize: 15 }} />
                </button>
              </div>
            )}
            {doc.status === "error" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 12, color: "var(--alert)", fontWeight: 500 }}>{doc.error}</div>
                <button type="button" className="btn btn-outline" style={{ alignSelf: "flex-start" }} onClick={() => setDoc(emptyDoc)}>
                  Escolher outro
                </button>
              </div>
            )}
          </div>

          <label style={{ display: "flex", alignItems: "flex-start", gap: 11, fontSize: 12.5, color: "var(--ink2)", lineHeight: 1.6, cursor: "pointer" }}>
            <input type="checkbox" defaultChecked style={{ width: 18, height: 18, marginTop: 2, accentColor: "var(--brand)", cursor: "pointer" }} />
            <span>Confirmo que sou o responsável legal pelo CNPJ e autorizo a abertura da subconta de pagamento no nome da empresa.</span>
          </label>

          <div style={{ display: "flex", gap: 11, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-primary" disabled={!cnpj.trim() || !legalName.trim() || doc.status !== "preview"} onClick={onSubmitOnboarding}>
              <i className="fa-solid fa-paper-plane" style={{ fontSize: 17, lineHeight: 1 }} />
              Enviar para análise
            </button>
            <button type="button" className="btn btn-outline" onClick={goSupport}>
              Falar com o suporte
            </button>
          </div>
        </section>
      )}

      {status === "pending" && (
        <section className="card" style={{ padding: 24, maxWidth: 620, display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 52, height: 52, borderRadius: 18, background: "color-mix(in srgb, var(--warn) 16%, transparent)", color: "var(--warn)", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 52px" }}>
              <i className="fa-solid fa-clock" style={{ fontSize: 24, lineHeight: 1 }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-.015em" }}>Em análise</div>
              <div style={{ fontSize: 12.5, color: "var(--ink2)" }}>Enviado agora · resposta em até 1 dia útil</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {STEPS(status).map((s) => (
              <div key={s.label} style={{ display: "flex", alignItems: "flex-start", gap: 13, padding: "13px 0", borderBottom: "1px solid var(--line)" }}>
                <i className={`fa-solid ${s.icon}`} style={{ fontSize: 18, lineHeight: 1, color: s.fg, marginTop: 1 }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{s.label}</div>
                  <div style={{ fontSize: 11.5, color: "var(--ink3)" }}>{s.sub}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--ink2)", lineHeight: 1.6 }}>
            Enquanto isso o restaurante continua operando normalmente — só os pagamentos PIX ficam indisponíveis até a subconta ser liberada.
          </div>
        </section>
      )}

      {status === "approved" && (
        <section className="card" style={{ padding: 24, maxWidth: 660, display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div style={{ width: 52, height: 52, borderRadius: 18, background: "color-mix(in srgb, var(--ok) 16%, transparent)", color: "var(--ok)", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 52px" }}>
              <i className="fa-solid fa-circle-check" style={{ fontSize: 24, lineHeight: 1 }} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-.015em" }}>Subconta ativa</div>
              <div style={{ fontSize: 12.5, color: "var(--ink2)" }}>Aprovada · recebendo pagamentos desde então</div>
            </div>
            <span className="pill" style={{ background: "color-mix(in srgb, var(--ok) 16%, transparent)", color: "var(--ok)" }}>PIX habilitado</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "2px 26px" }}>
            {[
              ["CNPJ", cnpj || "—"],
              ["Razão social", legalName || "—"],
              ["Regime tributário", TAX_REGIME_LABEL[taxRegime]],
              ["Titular", legalName || "—"],
              ["Liquidação", "D+1 automático"],
              ["Taxa por transação", "2,9% + R$ 0,39"]
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", alignItems: "baseline", gap: 13, padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--ink3)" }}>{k}</span>
                <span style={{ fontSize: 12.5, fontWeight: 500, textAlign: "right" }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 11, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-primary" onClick={() => notify("Abrindo extrato da subconta")}>
              <i className="fa-solid fa-receipt" style={{ fontSize: 17, lineHeight: 1 }} />
              Ver extrato da subconta
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setStatus("form")}>
              Atualizar dados bancários
            </button>
          </div>
        </section>
      )}

      {status === "rejected" && (
        <section className="card" style={{ padding: 24, maxWidth: 620, display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 52, height: 52, borderRadius: 18, background: "color-mix(in srgb, var(--alert) 14%, transparent)", color: "var(--alert)", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 52px" }}>
              <i className="fa-solid fa-circle-exclamation" style={{ fontSize: 24, lineHeight: 1 }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-.015em" }}>Cadastro reprovado</div>
              <div style={{ fontSize: 12.5, color: "var(--ink2)" }}>Você pode reenviar sem perder os dados</div>
            </div>
          </div>
          <div style={{ border: "1px solid color-mix(in srgb, var(--alert) 35%, var(--line))", background: "color-mix(in srgb, var(--alert) 8%, transparent)", borderRadius: 16, padding: "17px 19px", display: "flex", flexDirection: "column", gap: 5 }}>
            <div className="field-label">Motivo informado</div>
            <div style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.6 }}>
              Documento ilegível: a página 2 do contrato social está cortada e o CNPJ não pôde ser conferido.
            </div>
          </div>
          <div style={{ display: "flex", gap: 11, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-primary" onClick={() => setStatus("form")}>
              <i className="fa-solid fa-rotate-right" style={{ fontSize: 17, lineHeight: 1 }} />
              Reenviar documento
            </button>
            <button type="button" className="btn btn-outline" onClick={goSupport}>
              Falar com o suporte
            </button>
          </div>
        </section>
      )}
      </>
      )}
    </div>
  );
}
