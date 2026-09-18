import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { MenuCategory } from "@cardapio/shared";
import { api } from "../../lib/api";
import { useMobileScreen } from "../../components/mobile/MobileLayout";

interface Extra {
  name: string;
  price: string;
}

const SCHEDULES: { key: "Dia todo" | "Almoço" | "Jantar"; label: string; hint: string; text: string }[] = [
  { key: "Dia todo", label: "Dia todo", hint: "Visível durante todo o funcionamento", text: "Dia todo" },
  { key: "Almoço", label: "Almoço", hint: "Visível das 11h às 15h", text: "Almoço · 11:00 – 15:00" },
  { key: "Jantar", label: "Jantar", hint: "Visível das 18h às 23h30", text: "Jantar · 18:00 – 23:30" }
];

export default function MobileProductFormScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const editing = !!id;
  const { notify } = useMobileScreen({ title: editing ? "Editar produto" : "Novo produto", subtitle: "Cadastro no cardápio", hideTabs: true });

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [extras, setExtras] = useState<Extra[]>([]);
  const [schedule, setSchedule] = useState<"Dia todo" | "Almoço" | "Jantar">("Dia todo");

  useEffect(() => {
    Promise.all([api.listCategories(), editing ? api.listItems() : Promise.resolve([])]).then(([cats, items]) => {
      setCategories(cats);
      const found = editing ? items.find((i) => i.id === id) : null;
      if (found) {
        setName(found.name);
        setDesc(found.shortDescription);
        setPrice(found.price.toFixed(2).replace(".", ","));
        setCategoryId(found.categoryId);
        setExtras(found.optionGroups[0]?.options.map((o) => ({ name: o.label, price: o.priceDelta.toFixed(2).replace(".", ",") })) || []);
      } else {
        setCategoryId(cats[0]?.id || "");
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const save = async () => {
    const parsedPrice = Number(price.replace(/\./g, "").replace(",", ".")) || 0;
    const scheduleLabel = SCHEDULES.find((s) => s.key === schedule)!.text;
    const payload = {
      categoryId,
      name: name || "Novo item",
      shortDescription: desc,
      price: parsedPrice,
      scheduleLabel,
      extras: extras.map((x) => ({ name: x.name, priceDelta: Number(x.price.replace(",", ".")) || 0 }))
    };
    try {
      if (editing && id) await api.updateItem(id, payload);
      else await api.createItem(payload);
      notify(editing ? "Produto atualizado" : "Produto salvo no cardápio");
      navigate(-1);
    } catch {
      notify("Não foi possível salvar o produto");
    }
  };

  if (!loaded) {
    return (
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="skeleton" style={{ height: 130 }} />
        <div className="skeleton" style={{ height: 220 }} />
      </div>
    );
  }

  return (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
      <section style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: 13, display: "flex", flexDirection: "column", gap: 11 }}>
        <div style={{ height: 130, borderRadius: 12, background: "repeating-linear-gradient(135deg,var(--surface2),var(--surface2) 7px,var(--surface3) 7px,var(--surface3) 14px)", border: "1px dashed var(--line2)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 7, color: "var(--ink3)" }}>
          <i className="fa-solid fa-image" style={{ fontSize: 22 }} />
          <div className="mono" style={{ fontSize: 11 }}>
            foto do prato · 1200×900
          </div>
          <button type="button" style={{ minHeight: 38, background: "var(--surface)", border: "1px solid var(--line2)", color: "var(--ink)", borderRadius: 10, padding: "0 14px", cursor: "pointer", font: "inherit", fontSize: 12.5, fontWeight: 500 }}>
            Enviar foto
          </button>
        </div>
        <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span className="field-label">Nome do produto</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Moqueca de camarão" maxLength={80} className="field-mobile" />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span className="field-label">Preço</span>
          <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="R$ 128,00" className="field-mobile mono" />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span className="field-label">Descrição</span>
          <textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Camarões frescos, leite de coco, dendê e pirão" maxLength={200} className="field-mobile" />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span className="field-label">Categoria</span>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="field-mobile">
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: 13, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>Variações e adicionais</div>
          <button
            type="button"
            onClick={() => setExtras((prev) => [...prev, { name: "Nova variação", price: "0,00" }])}
            style={{ minHeight: 38, background: "var(--surface2)", border: "1px solid var(--line2)", color: "var(--ink)", borderRadius: 10, padding: "0 12px", cursor: "pointer", font: "inherit", fontSize: 12.5, fontWeight: 500, display: "flex", alignItems: "center", gap: 7 }}
          >
            <i className="fa-solid fa-plus" style={{ fontSize: 12 }} />
            Adicionar
          </button>
        </div>
        {extras.map((v, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              value={v.name}
              onChange={(e) => setExtras((prev) => prev.map((x, j) => (i === j ? { ...x, name: e.target.value } : x)))}
              style={{ flex: 1, minWidth: 0, minHeight: 44, border: "1px solid var(--line)", background: "var(--surface2)", borderRadius: 10, padding: "0 11px", font: "inherit", fontSize: 13, color: "var(--ink)", outline: "none" }}
            />
            <input
              value={v.price}
              onChange={(e) => setExtras((prev) => prev.map((x, j) => (i === j ? { ...x, price: e.target.value } : x)))}
              className="mono"
              style={{ width: 92, minHeight: 44, border: "1px solid var(--line)", background: "var(--surface2)", borderRadius: 10, padding: "0 11px", fontSize: 13, color: "var(--ink)", outline: "none" }}
            />
            <button type="button" onClick={() => setExtras((prev) => prev.filter((_, j) => j !== i))} style={{ width: 44, height: 44, borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--ink3)", cursor: "pointer" }}>
              <i className="fa-solid fa-trash" style={{ fontSize: 13 }} />
            </button>
          </div>
        ))}
      </section>

      <section style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: 13, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Disponibilidade agendada</div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {SCHEDULES.map((s) => {
            const active = schedule === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setSchedule(s.key)}
                style={{ minHeight: 40, borderRadius: 20, padding: "0 14px", cursor: "pointer", font: "inherit", fontSize: 12.5, fontWeight: 500, background: active ? "var(--brandSoft)" : "var(--surface2)", color: active ? "var(--brandText)" : "var(--ink2)", border: `1px solid ${active ? "var(--brand)" : "var(--line)"}` }}
              >
                {s.label}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--ink3)" }}>{SCHEDULES.find((s) => s.key === schedule)!.hint}</div>
      </section>

      <div style={{ display: "flex", gap: 9 }}>
        <button type="button" onClick={() => navigate(-1)} style={{ flex: "0 0 36%", minHeight: 50, background: "transparent", border: "1px solid var(--line2)", color: "var(--ink2)", borderRadius: 12, cursor: "pointer", font: "inherit", fontSize: 13.5, fontWeight: 600 }}>
          Cancelar
        </button>
        <button type="button" onClick={save} style={{ flex: 1, minHeight: 50, background: "var(--brand)", color: "var(--brandInk)", border: 0, borderRadius: 12, cursor: "pointer", font: "inherit", fontSize: 13.5, fontWeight: 600 }}>
          Salvar produto
        </button>
      </div>
    </div>
  );
}
