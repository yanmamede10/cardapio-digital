import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { MenuCategory, MenuItem, Product } from "@cardapio/shared";
import { api } from "../lib/api";
import { brl } from "../lib/format";
import { useDashboardState } from "../state/DashboardStateContext";
import { Modal } from "./Modal";

/** "Adicionar prato ao cardápio": links an existing catalog Produto into a category — the Cardápio never creates products. */
export function LinkDishModal({ categories, items, onClose, onLinked }: { categories: MenuCategory[]; items: MenuItem[]; onClose: () => void; onLinked: () => void }) {
  const { notify } = useDashboardState();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [products, setProducts] = useState<Product[] | null>(null);

  useEffect(() => {
    api
      .listProducts()
      .then(setProducts)
      .catch(() => notify("Não foi possível carregar o Catálogo"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const link = async (p: Product) => {
    try {
      await api.createItem({ productId: p.id, categoryId, name: p.name, price: p.price, shortDescription: "" });
      notify(`${p.name} adicionado em ${categories.find((c) => c.id === categoryId)?.name ?? "cardápio"}`);
      onLinked();
    } catch {
      notify("Não foi possível adicionar o prato");
    }
  };

  const query = q.trim().toLowerCase();
  const rows = (products ?? []).filter((p) => p.type === "produto" && (!query || p.name.toLowerCase().includes(query)));

  return (
    // Each Adicionar saves at once: nothing is left unsaved, so it always closes without asking.
    <Modal label="Adicionar prato ao cardápio" onClose={onClose} style={{ maxWidth: 520 }}>
      {(close) => (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "20px 24px 4px" }}>
          <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-.015em", flex: 1 }}>Adicionar prato ao cardápio</div>
          <button type="button" className="icon-btn" title="Fechar" aria-label="Fechar" onClick={close}>
            <i className="fa-solid fa-xmark" style={{ fontSize: 16 }} />
          </button>
        </div>
        <div style={{ padding: "2px 24px 0", fontSize: 12.5, color: "var(--ink3)" }}>Escolha pratos já cadastrados no Catálogo. Nome, preço e tributação vêm de lá.</div>
        <div style={{ padding: "18px 24px", display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }} className="field">
            <i className="fa-solid fa-magnifying-glass" style={{ fontSize: 14, color: "var(--ink3)" }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar prato no Catálogo" aria-label="Buscar prato no Catálogo" style={{ border: 0, background: "transparent", outline: "none", font: "inherit", color: "var(--ink)", width: "100%", minWidth: 0 }} />
          </div>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="field-label">Adicionar na categoria</span>
            <select className="field" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div style={{ display: "flex", flexDirection: "column", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden" }}>
            {!products ? (
              <div className="skeleton" style={{ height: 120, border: 0, borderRadius: 0 }} />
            ) : rows.length === 0 ? (
              <div style={{ padding: "28px 16px", textAlign: "center", fontSize: 13, color: "var(--ink3)" }}>{query ? "Nenhum prato do Catálogo com esse nome." : "Nenhum prato cadastrado no Catálogo ainda."}</div>
            ) : (
              rows.map((p) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderBottom: "1px solid var(--line)" }}>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                  <div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>
                    {brl(p.price)}
                  </div>
                  {items.some((m) => m.productId === p.id) ? (
                    <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--ok)", padding: "6px 12px" }}>
                      <i className="fa-solid fa-check" style={{ fontSize: 11 }} />
                      No cardápio
                    </span>
                  ) : (
                    <button type="button" className="btn btn-primary" style={{ padding: "6px 12px", fontSize: 12.5, minHeight: 36 }} disabled={!categoryId} onClick={() => link(p)}>
                      <i className="fa-solid fa-plus" style={{ fontSize: 11 }} />
                      Adicionar
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "16px 24px 20px", borderTop: "1px solid var(--line)", flexWrap: "wrap" }}>
          <button type="button" onClick={() => navigate("/produtos")} style={{ border: 0, background: "transparent", padding: "4px 0", cursor: "pointer", fontSize: 12.5, fontWeight: 500, color: "var(--brandText)", flex: 1, textAlign: "left" }}>
            Não encontrou? Cadastre em Produtos → Catálogo
          </button>
          <button type="button" className="btn btn-primary" onClick={close}>
            Concluir
          </button>
        </div>
      </>
      )}
    </Modal>
  );
}
