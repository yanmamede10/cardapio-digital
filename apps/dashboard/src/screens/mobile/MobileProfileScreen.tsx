import { useEffect, useState } from "react";
import type { RestaurantProfile } from "@cardapio/shared";
import { api } from "../../lib/api";
import { useMobileScreen } from "../../components/mobile/MobileLayout";

const fieldLabel = { fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: ".09em", textTransform: "uppercase" as const, color: "var(--ink3)" };
const fieldInput = { minHeight: 46, border: "1px solid var(--line)", background: "var(--surface2)", borderRadius: 11, padding: "0 12px", font: "inherit", fontSize: 13.5, color: "var(--ink)", outline: "none" };

export default function MobileProfileScreen() {
  const { notify } = useMobileScreen({ title: "Perfil do restaurante", subtitle: "Identidade pública" });
  const [profile, setProfile] = useState<RestaurantProfile | null>(null);

  useEffect(() => {
    api.getProfile().then(setProfile);
  }, []);

  const save = async () => {
    if (!profile) return;
    try {
      await api.updateProfile(profile);
      notify("Perfil do restaurante atualizado");
    } catch {
      notify("Não foi possível salvar o perfil");
    }
  };

  if (!profile) {
    return (
      <div style={{ padding: 12 }}>
        <div className="skeleton" style={{ height: 320 }} />
      </div>
    );
  }

  return (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
      <section style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: 13, display: "flex", flexDirection: "column", gap: 11 }}>
        <div style={{ display: "flex", gap: 11, alignItems: "center" }}>
          <div style={{ width: 64, height: 64, flex: "0 0 64px", borderRadius: 16, background: "var(--brand)", color: "var(--brandInk)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Mono', monospace", fontSize: 20, fontWeight: 600 }}>MP</div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
            <button type="button" style={{ minHeight: 40, background: "var(--surface2)", border: "1px solid var(--line2)", color: "var(--ink)", borderRadius: 10, cursor: "pointer", font: "inherit", fontSize: 12.5, fontWeight: 500 }}>
              Trocar logo
            </button>
            <button type="button" style={{ minHeight: 40, background: "var(--surface2)", border: "1px solid var(--line2)", color: "var(--ink)", borderRadius: 10, cursor: "pointer", font: "inherit", fontSize: 12.5, fontWeight: 500 }}>
              Fotos de capa
            </button>
          </div>
        </div>
        <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span style={fieldLabel}>Nome público</span>
          <input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} style={fieldInput} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span style={fieldLabel}>Categoria de culinária</span>
          <input value={profile.cuisineCategory} onChange={(e) => setProfile({ ...profile, cuisineCategory: e.target.value })} style={fieldInput} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span style={fieldLabel}>Descrição</span>
          <textarea rows={3} value={profile.description} onChange={(e) => setProfile({ ...profile, description: e.target.value })} style={{ border: "1px solid var(--line)", background: "var(--surface2)", borderRadius: 11, padding: "11px 12px", font: "inherit", fontSize: 13.5, color: "var(--ink)", outline: "none", resize: "vertical" }} />
        </label>
      </section>
      <button type="button" onClick={save} style={{ minHeight: 50, background: "var(--brand)", color: "var(--brandInk)", border: 0, borderRadius: 12, cursor: "pointer", font: "inherit", fontSize: 13.5, fontWeight: 600 }}>
        Salvar alterações
      </button>
    </div>
  );
}
