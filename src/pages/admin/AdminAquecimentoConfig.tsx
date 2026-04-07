import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function MIcon({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

const DEFAULT_COVERS = [
  "https://images.unsplash.com/photo-1557683316-973673baf926?w=800&q=80",
  "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&q=80",
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80",
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&q=80",
  "https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=800&q=80",
];

export default function AdminAquecimentoConfig() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [profileRes, nameRes, coverRes] = await Promise.all([
      supabase.from("profiles").select("full_name, avatar_url").eq("user_id", user.id).maybeSingle(),
      supabase.from("site_settings" as any).select("value").eq("key", `operator_display_name_${user.id}`).maybeSingle(),
      supabase.from("site_settings" as any).select("value").eq("key", `operator_cover_${user.id}`).maybeSingle(),
    ]);

    if (profileRes.data) {
      setUserName(profileRes.data.full_name || "");
      setAvatarUrl(profileRes.data.avatar_url || null);
    }
    if (nameRes.data) setDisplayName((nameRes.data as any).value || "");
    if (coverRes.data) setCoverUrl((coverRes.data as any).value || null);
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const nameKey = `operator_display_name_${user.id}`;
      const coverKey = `operator_cover_${user.id}`;

      const { data: existingName } = await (supabase.from("site_settings" as any) as any).select("id").eq("key", nameKey).maybeSingle();
      if (existingName) {
        await (supabase.from("site_settings" as any) as any).update({ value: displayName }).eq("key", nameKey);
      } else {
        await (supabase.from("site_settings" as any) as any).insert({ key: nameKey, value: displayName });
      }

      const { data: existingCover } = await (supabase.from("site_settings" as any) as any).select("id").eq("key", coverKey).maybeSingle();
      if (existingCover) {
        await (supabase.from("site_settings" as any) as any).update({ value: coverUrl || "" }).eq("key", coverKey);
      } else {
        await (supabase.from("site_settings" as any) as any).insert({ key: coverKey, value: coverUrl || "" });
      }

      toast.success("Configurações salvas!");
    } catch {
      toast.error("Erro ao salvar configurações");
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen p-6 md:p-10 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/aquecimento")} className="shrink-0">
          <ArrowLeft className="size-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <MIcon name="settings" className="text-primary text-2xl" />
            Configurações do Operador
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Personalize seu perfil de operador.</p>
        </div>
      </div>

      {/* Cover Preview */}
      <div className="relative rounded-xl overflow-hidden border border-border shadow-sm">
        <div
          className="h-40 bg-muted"
          style={coverUrl ? { backgroundImage: `url(${coverUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : { background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 40%, #3a3a3a 70%, #1a1a1a 100%)" }}
        />
        <div className="absolute bottom-3 left-5 flex items-center gap-3">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-16 h-16 rounded-full border-3 border-white shadow-lg object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center border-3 border-white shadow-lg">
              <MIcon name="person" className="text-white text-3xl" />
            </div>
          )}
          <div>
            <p className="text-white font-bold text-lg drop-shadow-lg">{displayName || userName || "Operador"}</p>
            <p className="text-white/70 text-xs drop-shadow">Operador de Aquecimento</p>
          </div>
        </div>
      </div>

      {/* Edit Name */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <MIcon name="badge" className="text-primary text-lg" />
          Nome de Exibição
        </h3>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Seu nome de operador"
          className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
        />
        <p className="text-[11px] text-muted-foreground">Este nome será exibido no painel e nos relatórios.</p>
      </div>

      {/* Cover Photo Selection */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <MIcon name="wallpaper" className="text-primary text-lg" />
          Foto de Capa
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => setCoverUrl(null)}
            className={`relative rounded-lg overflow-hidden h-20 border-2 transition-all ${!coverUrl ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-muted-foreground"}`}
          >
            <div className="w-full h-full" style={{ background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 40%, #3a3a3a 70%, #1a1a1a 100%)" }} />
            {!coverUrl && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <MIcon name="check_circle" className="text-white text-xl" />
              </div>
            )}
            <span className="absolute bottom-1 left-1 text-[9px] text-white font-bold bg-black/40 px-1.5 py-0.5 rounded">Padrão</span>
          </button>
          {DEFAULT_COVERS.map((cover, i) => {
            const isSelected = coverUrl === cover;
            return (
              <button
                key={cover}
                onClick={() => setCoverUrl(cover)}
                className={`relative rounded-lg overflow-hidden h-20 border-2 transition-all ${isSelected ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-muted-foreground"}`}
              >
                <img src={cover} alt={`Capa ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                {isSelected && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <MIcon name="check_circle" className="text-white text-xl" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={saveConfig}
        disabled={saving}
        className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-bold py-3 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 text-sm"
      >
        <MIcon name={saving ? "hourglass_empty" : "save"} className="text-lg" />
        {saving ? "Salvando..." : "Salvar Configurações"}
      </button>
    </div>
  );
}
