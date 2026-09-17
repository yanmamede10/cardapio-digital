import { useRef, useState } from "react";
import { initialsOf } from "../lib/format";
import { useDashboardState } from "../state/DashboardStateContext";

type TemplateId = "classico" | "moderno" | "minimalista" | "vibrante" | "editorial" | "galeria";

const TEMPLATES: { id: TemplateId; name: string; desc: string }[] = [
  { id: "classico", name: "Clássico", desc: "Banner no topo, cardápio em duas colunas." },
  { id: "moderno", name: "Moderno", desc: "Hero grande com foto e cards de destaque." },
  { id: "minimalista", name: "Minimalista", desc: "Tipografia grande, sem imagem de fundo." },
  { id: "vibrante", name: "Vibrante", desc: "Fundo na cor da marca e chips de categoria." },
  { id: "editorial", name: "Editorial", desc: "Foto lateral fixa e cardápio em lista." },
  { id: "galeria", name: "Galeria", desc: "Grid de fotos grandes, quase sem texto." }
];

const SWATCHES: { hex: string; label: string }[] = [
  { hex: "#732009", label: "Marca" },
  { hex: "#CD8C52", label: "Terracota" },
  { hex: "#938172", label: "Areia" },
  { hex: "#626266", label: "Grafite" },
  { hex: "#020304", label: "Carvão" }
];

interface Row {
  flex: string;
  cells: { flex: number; r: string; bg: string }[];
}

/** Abstract bars, not a real menu render — just enough to tell the 6 templates apart at a glance. */
function templateLayout(id: TemplateId, brand: string): { canvas: string; rows: Row[] } {
  const n1 = "var(--surface3)", n2 = "var(--surface2)";
  const soft = (pct: number) => `color-mix(in srgb, ${brand} ${pct}%, transparent)`;
  switch (id) {
    case "classico":
      return {
        canvas: "var(--surface)",
        rows: [
          { flex: "0 0 26%", cells: [{ flex: 1, r: "7px", bg: brand }] },
          { flex: "0 0 9%", cells: [{ flex: 2, r: "999px", bg: n1 }, { flex: 1, r: "999px", bg: n2 }, { flex: 1, r: "999px", bg: n2 }] },
          { flex: "1 1 auto", cells: [{ flex: 1, r: "6px", bg: n2 }, { flex: 1, r: "6px", bg: n2 }] },
          { flex: "0 0 12%", cells: [{ flex: 1, r: "999px", bg: n1 }] }
        ]
      };
    case "moderno":
      return {
        canvas: "var(--surface)",
        rows: [
          { flex: "0 0 44%", cells: [{ flex: 1, r: "9px", bg: `linear-gradient(135deg,${brand},${n1})` }] },
          { flex: "1 1 auto", cells: [{ flex: 1, r: "7px", bg: n2 }, { flex: 1, r: "7px", bg: n2 }, { flex: 1, r: "7px", bg: n2 }] },
          { flex: "0 0 13%", cells: [{ flex: 3, r: "999px", bg: n1 }, { flex: 1, r: "999px", bg: brand }] }
        ]
      };
    case "minimalista":
      return {
        canvas: "var(--surface)",
        rows: [
          { flex: "0 0 8%", cells: [{ flex: 1, r: "999px", bg: n2 }, { flex: 3, r: "999px", bg: "transparent" }] },
          { flex: "0 0 20%", cells: [{ flex: 3, r: "5px", bg: "var(--ink3)" }, { flex: 2, r: "5px", bg: "transparent" }] },
          { flex: "0 0 7%", cells: [{ flex: 2, r: "999px", bg: n2 }, { flex: 3, r: "999px", bg: "transparent" }] },
          { flex: "1 1 auto", cells: [{ flex: 1, r: "6px", bg: n2 }] },
          { flex: "0 0 10%", cells: [{ flex: 1, r: "999px", bg: brand }, { flex: 3, r: "999px", bg: "transparent" }] }
        ]
      };
    case "vibrante":
      return {
        canvas: brand,
        rows: [
          { flex: "0 0 30%", cells: [{ flex: 1, r: "8px", bg: "rgba(255,255,255,.9)" }] },
          { flex: "0 0 10%", cells: [{ flex: 1, r: "999px", bg: "rgba(255,255,255,.55)" }, { flex: 1, r: "999px", bg: "rgba(255,255,255,.25)" }, { flex: 1, r: "999px", bg: "rgba(255,255,255,.25)" }] },
          { flex: "1 1 auto", cells: [{ flex: 1, r: "7px", bg: "rgba(255,255,255,.75)" }, { flex: 1, r: "7px", bg: "rgba(255,255,255,.75)" }] }
        ]
      };
    case "editorial":
      return {
        canvas: "var(--surface)",
        rows: [
          { flex: "1 1 auto", cells: [{ flex: 2, r: "8px", bg: `linear-gradient(160deg,${n1},${soft(45)})` }, { flex: 3, r: "6px", bg: n2 }] },
          { flex: "0 0 12%", cells: [{ flex: 2, r: "999px", bg: "transparent" }, { flex: 1, r: "999px", bg: brand }] }
        ]
      };
    case "galeria":
      return {
        canvas: "var(--surface)",
        rows: [
          { flex: "0 0 11%", cells: [{ flex: 1, r: "999px", bg: n2 }, { flex: 1, r: "999px", bg: brand }] },
          { flex: "0 0 40%", cells: [{ flex: 1, r: "8px", bg: `linear-gradient(140deg,${n1},${soft(40)})` }, { flex: 1, r: "8px", bg: n1 }] },
          { flex: "1 1 auto", cells: [{ flex: 1, r: "8px", bg: n1 }, { flex: 1, r: "8px", bg: `linear-gradient(140deg,${soft(32)},${n1})` }] }
        ]
      };
  }
}

/** WCAG relative luminance — picks readable text/icon color over the brand color. */
function onColorFor(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "#FCF7D3";
  const f = (c: string) => {
    const v = parseInt(c, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const lum = 0.2126 * f(h.slice(0, 2)) + 0.7152 * f(h.slice(2, 4)) + 0.0722 * f(h.slice(4, 6));
  return lum > 0.38 ? "#1B1915" : "#FCF7D3";
}

interface FileState {
  status: "empty" | "loading" | "preview" | "error";
  url?: string;
  fileName?: string;
  error?: string;
}

interface CoverPhoto extends FileState {
  id: number;
}

const emptyFile: FileState = { status: "empty" };

export default function AppearanceTab({ restaurantName }: { restaurantName: string }) {
  const { notify } = useDashboardState();
  const [tpl, setTpl] = useState<TemplateId>("moderno");
  const [brandColor, setBrandColor] = useState("#732009");
  const [logo, setLogo] = useState<FileState>(emptyFile);
  const [covers, setCovers] = useState<CoverPhoto[]>([]);
  const [published, setPublished] = useState(false);
  const [lastPublishedAt, setLastPublishedAt] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const logoInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  const dirty = () => setPublished(false);
  const onColor = onColorFor(brandColor);
  const soft = (pct: number) => `color-mix(in srgb, ${brandColor} ${pct}%, transparent)`;
  const layout = templateLayout(tpl, brandColor);
  const isCustomColor = !SWATCHES.some((s) => s.hex.toLowerCase() === brandColor.toLowerCase());

  const onLogoFile = (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      setLogo({ status: "error", error: `Arquivo de ${(file.size / 1024 / 1024).toFixed(1)} MB — o limite é 2 MB.` });
      return;
    }
    const url = URL.createObjectURL(file);
    setLogo({ status: "loading", url, fileName: file.name });
    dirty();
    setTimeout(() => setLogo((l) => (l.status === "loading" ? { ...l, status: "preview" } : l)), 900);
  };
  const removeLogo = () => {
    if (logo.url) URL.revokeObjectURL(logo.url);
    setLogo(emptyFile);
    dirty();
  };

  const onCoverFiles = (files: FileList) => {
    Array.from(files)
      .slice(0, Math.max(0, 6 - covers.length))
      .forEach((file) => {
        const id = Date.now() + Math.random();
        if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
          setCovers((c) => [...c, { id, status: "error", error: `${file.name} não é suportado — envie JPG, PNG ou WebP.` }]);
          return;
        }
        if (file.size > 8 * 1024 * 1024) {
          setCovers((c) => [...c, { id, status: "error", error: `Arquivo de até 8 MB.` }]);
          return;
        }
        const url = URL.createObjectURL(file);
        setCovers((c) => [...c, { id, status: "loading", url, fileName: file.name }]);
        setTimeout(() => setCovers((c) => c.map((x) => (x.id === id ? { ...x, status: "preview" } : x))), 900);
      });
    dirty();
  };
  const removeCover = (id: number) => {
    setCovers((c) => {
      const found = c.find((x) => x.id === id);
      if (found?.url) URL.revokeObjectURL(found.url);
      return c.filter((x) => x.id !== id);
    });
    dirty();
  };

  const onPublish = () => {
    setPublished(true);
    setLastPublishedAt(new Date().toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }));
    setPreviewOpen(false);
    notify("Página pública publicada");
  };

  const coverPreview = covers.find((c) => c.status === "preview");

  const PagePreview = ({ big }: { big: boolean }) => (
    <div style={{ borderRadius: big ? 22 : 18, overflow: "hidden", background: "#FFFDF1", color: "#1B1915", boxShadow: "var(--shadow1)" }}>
      {big && (
        <div style={{ position: "relative", height: 150, background: coverPreview?.url ? `url(${coverPreview.url}) center/cover` : "repeating-linear-gradient(135deg,#F2EEDD,#F2EEDD 6px,#E9E4CF 6px,#E9E4CF 12px)", display: "flex", alignItems: "center", justifyContent: "center", color: "#87837A" }}>
          {!coverPreview && <i className="fa-solid fa-image" style={{ fontSize: 24, lineHeight: 1 }} />}
        </div>
      )}
      <div style={{ padding: big ? "0 22px 22px" : "15px 18px", marginTop: big ? -34 : 0, position: "relative", display: "flex", flexDirection: "column", gap: big ? 16 : 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, ...(big ? {} : { background: brandColor, color: onColor, margin: "-15px -18px 0", padding: "15px 18px" }) }}>
          {big ? (
            <div style={{ width: 68, height: 68, borderRadius: 22, background: brandColor, color: onColor, border: "3px solid #FFFDF1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, fontWeight: 600, overflow: "hidden" }}>
              {logo.status === "preview" && logo.url ? <img src={logo.url} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initialsOf(restaurantName)}
            </div>
          ) : (
            <>
              <div style={{ width: 28, height: 28, borderRadius: 999, background: "rgba(255,255,255,.22)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, overflow: "hidden" }}>
                {logo.status === "preview" && logo.url ? <img src={logo.url} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initialsOf(restaurantName)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-.01em" }}>{restaurantName}</div>
                <div style={{ fontSize: 11, opacity: 0.82 }}>Aberto até 23h</div>
              </div>
              <i className="fa-solid fa-bag-shopping" style={{ fontSize: 16, lineHeight: 1 }} />
            </>
          )}
        </div>
        {big && (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ fontSize: 23, fontWeight: 600, letterSpacing: "-.02em" }}>{restaurantName}</div>
            <div style={{ fontSize: 13, color: "#55524A" }}>Cozinha do dia a dia · Centro Histórico</div>
          </div>
        )}
        <div style={{ display: "flex", gap: big ? 8 : 7, flexWrap: "wrap" }}>
          <span style={{ fontSize: big ? 12 : 11, fontWeight: 600, borderRadius: 999, padding: big ? "7px 15px" : "5px 12px", background: brandColor, color: onColor }}>Destaques</span>
          <span style={{ fontSize: big ? 12 : 11, fontWeight: 500, borderRadius: 999, padding: big ? "7px 15px" : "5px 12px", background: "#F2EEDD", color: "#55524A" }}>Entradas</span>
          {big && <span style={{ fontSize: 12, fontWeight: 500, borderRadius: 999, padding: "7px 15px", background: "#F2EEDD", color: "#55524A" }}>Principais</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: big ? 14 : 12, border: "1px solid #E0D9BF", borderRadius: big ? 18 : 14, padding: big ? 14 : 12, background: "#FFFDF1" }}>
          <div style={{ width: big ? 56 : 44, height: big ? 56 : 44, borderRadius: big ? 15 : 12, background: soft(16), color: brandColor, display: "flex", alignItems: "center", justifyContent: "center", flex: `0 0 ${big ? 56 : 44}px` }}>
            <i className="fa-solid fa-fish" style={{ fontSize: big ? 21 : 18, lineHeight: 1 }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: big ? 13.5 : 12.5, fontWeight: 600 }}>Prato em destaque</div>
            <div style={{ fontSize: 12, color: "#87837A" }}>Descrição curta do item</div>
          </div>
          <span className="mono" style={{ fontSize: 12.5, fontWeight: 600 }}>R$ 48,00</span>
        </div>
        <button type="button" style={{ width: "100%", border: 0, borderRadius: big ? 16 : 13, padding: big ? 15 : 13, cursor: "default", font: "inherit", fontSize: big ? 13.5 : 12.5, fontWeight: 600, background: brandColor, color: onColor }}>
          {big ? "Abrir cardápio completo" : "Adicionar ao pedido"}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <section className="card" style={{ padding: 22, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260, display: "flex", flexDirection: "column", gap: 7 }}>
          <span className="pill" style={{ alignSelf: "flex-start", background: published ? "color-mix(in srgb, var(--ok) 16%, transparent)" : "color-mix(in srgb, var(--warn) 18%, transparent)", color: published ? "var(--ok)" : "var(--warn)" }}>
            <i className={`fa-solid ${published ? "fa-circle-check" : "fa-pen-ruler"}`} style={{ fontSize: 13, lineHeight: 1 }} />
            {published ? "Publicado" : "Rascunho"}
          </span>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Página pública do restaurante</div>
          <div style={{ fontSize: 12.5, color: "var(--ink2)" }}>
            {published ? `Página pública atualizada em ${lastPublishedAt}.` : "Template, cor e imagens alterados — os clientes ainda veem a versão anterior."}
          </div>
        </div>
        <div style={{ display: "flex", gap: 11, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-outline" onClick={() => setPreviewOpen(true)}>
            <i className="fa-solid fa-eye" style={{ fontSize: 17, lineHeight: 1 }} />
            Pré-visualizar
          </button>
          <button type="button" className="btn btn-primary" onClick={onPublish}>
            <i className="fa-solid fa-cloud-arrow-up" style={{ fontSize: 17, lineHeight: 1 }} />
            {published ? "Publicar novamente" : "Publicar alterações"}
          </button>
        </div>
      </section>

      <section className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Template da página</div>
          <div style={{ fontSize: 12.5, color: "var(--ink2)" }}>Seis layouts prontos. O conteúdo do cardápio é o mesmo em todos — muda só a apresentação.</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
          {TEMPLATES.map((t) => {
            const sel = t.id === tpl;
            const l = templateLayout(t.id, brandColor);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTpl(t.id);
                  dirty();
                }}
                className="tap"
                style={{
                  textAlign: "left",
                  cursor: "pointer",
                  font: "inherit",
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 11,
                  background: "var(--surface)",
                  borderRadius: 18,
                  border: `${sel ? "1.5px" : "1px"} solid ${sel ? "var(--brand)" : "var(--line)"}`,
                  boxShadow: sel ? "0 0 0 4px var(--brandSoft), var(--shadow1)" : "var(--shadow1)"
                }}
              >
                <div style={{ aspectRatio: "4/3", borderRadius: 13, overflow: "hidden", background: l.canvas, border: "1px solid var(--line)", padding: 8, display: "flex", flexDirection: "column", gap: 5 }}>
                  {l.rows.map((r, i) => (
                    <div key={i} style={{ display: "flex", gap: 5, minHeight: 0, flex: r.flex }}>
                      {r.cells.map((c, j) => (
                        <div key={j} style={{ minWidth: 0, flex: c.flex, borderRadius: c.r, background: c.bg }} />
                      ))}
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: sel ? "var(--brandText)" : "var(--ink)" }}>{t.name}</span>
                    {sel && <i className="fa-solid fa-circle-check" style={{ fontSize: 14, lineHeight: 1, color: "var(--brandText)" }} />}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink3)" }}>{t.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="card" style={{ padding: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Cor de marca</div>
            <div style={{ fontSize: 12.5, color: "var(--ink2)" }}>Usada em botões, destaques e cabeçalho da página do cliente.</div>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {SWATCHES.map((s) => {
              const sel = s.hex.toLowerCase() === brandColor.toLowerCase();
              return (
                <button
                  key={s.hex}
                  type="button"
                  title={s.label}
                  onClick={() => {
                    setBrandColor(s.hex);
                    dirty();
                  }}
                  className="tap"
                  style={{ width: 38, height: 38, borderRadius: 999, cursor: "pointer", border: "1px solid var(--line2)", background: s.hex, boxShadow: sel ? "0 0 0 3px var(--surface), 0 0 0 5px var(--ink)" : "none" }}
                />
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="field-label">Hex personalizado</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--line)", background: "var(--surface2)", borderRadius: 13, padding: "9px 13px" }}>
                <input
                  type="color"
                  value={brandColor}
                  onChange={(e) => {
                    setBrandColor(e.target.value);
                    dirty();
                  }}
                  style={{ width: 30, height: 30, padding: 0, border: "1px solid var(--line2)", borderRadius: 10, background: "transparent", cursor: "pointer" }}
                />
                <span className="mono" style={{ fontSize: 13.5, fontWeight: 500 }}>{brandColor.toUpperCase()}</span>
              </div>
            </label>
            {isCustomColor && (
              <span className="pill" style={{ background: "var(--surface2)", border: "1px solid var(--line)", color: "var(--sec)" }}>Cor fora da paleta</span>
            )}
          </div>
        </div>

        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 9 }}>
          <div className="field-label">Preview ao vivo · {TEMPLATES.find((t) => t.id === tpl)?.name}</div>
          <PagePreview big={false} />
        </div>
      </section>

      <section className="card" style={{ padding: 24, display: "grid", gridTemplateColumns: "minmax(0,210px) minmax(0,1fr)", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 13, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Logo</div>
          <input ref={logoInput} type="file" accept="image/png,image/svg+xml,image/jpeg" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && onLogoFile(e.target.files[0])} />
          {logo.status === "empty" && (
            <button type="button" onClick={() => logoInput.current?.click()} className="tap" style={{ width: 124, height: 124, borderRadius: 26, border: "1.5px dashed var(--line2)", background: "var(--surface2)", color: "var(--ink3)", cursor: "pointer", font: "inherit", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <i className="fa-solid fa-arrow-up-from-bracket" style={{ fontSize: 21, lineHeight: 1 }} />
              <span style={{ fontSize: 12, fontWeight: 500 }}>Enviar logo</span>
            </button>
          )}
          {logo.status === "loading" && (
            <div style={{ width: 124, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ width: 124, height: 124, borderRadius: 26, border: "1px solid var(--line)", background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink3)" }}>
                <i className="fa-solid fa-spinner" style={{ fontSize: 23, lineHeight: 1, animation: "sk 1.1s ease-in-out infinite" }} />
              </div>
              <div style={{ fontSize: 11.5, color: "var(--ink3)" }}>Enviando {logo.fileName}…</div>
            </div>
          )}
          {logo.status === "preview" && (
            <div style={{ width: 124, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ position: "relative", width: 124, height: 124, borderRadius: 26, border: "1px solid var(--line2)", overflow: "hidden" }}>
                <img src={logo.url} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <button type="button" onClick={removeLogo} title="Remover" className="icon-btn" style={{ position: "absolute", top: -7, right: -7, width: 26, height: 26, background: "var(--surface)", boxShadow: "var(--shadow1)" }}>
                  <i className="fa-solid fa-xmark" style={{ fontSize: 14 }} />
                </button>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--ink2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{logo.fileName}</div>
            </div>
          )}
          {logo.status === "error" && (
            <div style={{ width: 124, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ width: 124, height: 124, borderRadius: 26, border: "1.5px solid var(--alert)", background: "color-mix(in srgb, var(--alert) 10%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--alert)" }}>
                <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: 22, lineHeight: 1 }} />
              </div>
              <div style={{ fontSize: 11.5, color: "var(--alert)", fontWeight: 500 }}>{logo.error}</div>
              <button type="button" className="btn btn-outline" style={{ alignSelf: "flex-start", padding: "8px 14px", fontSize: 11.5 }} onClick={() => setLogo(emptyFile)}>
                Escolher outro
              </button>
            </div>
          )}
          <div style={{ fontSize: 11.5, color: "var(--ink3)" }}>PNG ou SVG quadrado, até 2 MB. Fundo transparente fica melhor.</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 13, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Fotos de capa</div>
          <input ref={coverInput} type="file" accept="image/jpeg,image/png,image/webp" multiple style={{ display: "none" }} onChange={(e) => e.target.files && onCoverFiles(e.target.files)} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))", gap: 14 }}>
            {covers.map((c, i) => (
              <div key={c.id} style={{ display: "flex", flexDirection: "column", gap: 7, minWidth: 0 }}>
                {c.status === "preview" && (
                  <div style={{ position: "relative", aspectRatio: "16/10", borderRadius: 16, border: "1px solid var(--line2)", overflow: "hidden" }}>
                    <img src={c.url} alt={c.fileName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    {i === 0 && <span style={{ position: "absolute", left: 8, top: 8, fontSize: 10, fontWeight: 600, borderRadius: 999, padding: "3px 9px", background: "var(--brand)", color: "var(--brandInk)" }}>Capa principal</span>}
                    <button type="button" onClick={() => removeCover(c.id)} title="Remover" className="icon-btn" style={{ position: "absolute", top: -7, right: -7, width: 24, height: 24, background: "var(--surface)", boxShadow: "var(--shadow1)" }}>
                      <i className="fa-solid fa-xmark" style={{ fontSize: 13 }} />
                    </button>
                  </div>
                )}
                {c.status === "loading" && (
                  <div style={{ aspectRatio: "16/10", borderRadius: 16, border: "1px solid var(--line)", background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink3)" }}>
                    <i className="fa-solid fa-spinner" style={{ fontSize: 18, lineHeight: 1, animation: "sk 1.1s ease-in-out infinite" }} />
                  </div>
                )}
                {c.status === "error" && (
                  <div style={{ aspectRatio: "16/10", borderRadius: 16, border: "1.5px solid var(--alert)", background: "color-mix(in srgb, var(--alert) 10%, transparent)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, padding: 8, color: "var(--alert)" }}>
                    <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: 17, lineHeight: 1 }} />
                    <span style={{ fontSize: 10, textAlign: "center", lineHeight: 1.3 }}>{c.error}</span>
                  </div>
                )}
                {c.status === "preview" && <div className="mono" style={{ fontSize: 10.5, color: "var(--ink3)" }}>{c.fileName}</div>}
              </div>
            ))}
            {covers.length < 6 && (
              <button type="button" onClick={() => coverInput.current?.click()} className="tap" style={{ aspectRatio: "16/10", borderRadius: 16, border: "1.5px dashed var(--line2)", background: "transparent", color: "var(--ink3)", cursor: "pointer", font: "inherit", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 7 }}>
                <i className="fa-solid fa-plus" style={{ fontSize: 19, lineHeight: 1 }} />
                <span style={{ fontSize: 11.5, fontWeight: 500 }}>Adicionar</span>
              </button>
            )}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--ink3)" }}>
            {covers.length === 0 ? "Nenhuma foto adicionada ainda." : `${covers.length} de 6 fotos. A primeira é a capa principal.`}
          </div>
        </div>
      </section>

      {previewOpen && (
        <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && setPreviewOpen(false)}>
          <div className="modal-panel" style={{ maxWidth: 560 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 22px", background: "var(--glassBg)", backdropFilter: "var(--blur)", WebkitBackdropFilter: "var(--blur)", borderBottom: "1px solid var(--glassBd)" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-.015em" }}>Como o cliente vai ver</div>
                <div style={{ fontSize: 11.5, color: "var(--ink3)" }}>Template {TEMPLATES.find((t) => t.id === tpl)?.name} · cor {brandColor.toUpperCase()}</div>
              </div>
              <span className="pill" style={{ background: published ? "color-mix(in srgb, var(--ok) 16%, transparent)" : "color-mix(in srgb, var(--warn) 18%, transparent)", color: published ? "var(--ok)" : "var(--warn)" }}>
                <i className={`fa-solid ${published ? "fa-circle-check" : "fa-pen-ruler"}`} style={{ fontSize: 13, lineHeight: 1 }} />
                {published ? "Publicado" : "Rascunho"}
              </span>
              <button type="button" className="icon-btn" onClick={() => setPreviewOpen(false)} title="Fechar">
                <i className="fa-solid fa-xmark" style={{ fontSize: 18 }} />
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 22, background: "var(--surface2)" }}>
              <PagePreview big />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 22px", background: "var(--glassBg)", backdropFilter: "var(--blur)", WebkitBackdropFilter: "var(--blur)", borderTop: "1px solid var(--glassBd)", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 160, fontSize: 12, color: "var(--ink2)" }}>
                {published ? "Já publicado — clientes veem esta versão." : "Rascunho visível só para a sua equipe."}
              </div>
              <button type="button" className="btn btn-outline" onClick={() => setPreviewOpen(false)}>Continuar editando</button>
              <button type="button" className="btn btn-primary" onClick={onPublish}>
                <i className="fa-solid fa-cloud-arrow-up" style={{ fontSize: 17, lineHeight: 1 }} />
                {published ? "Publicar novamente" : "Publicar alterações"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
