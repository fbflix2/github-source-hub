import { useState, useEffect } from "react";
import { Eye, EyeOff, Loader2, Save, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const clientNavLinks = [
  { key: "loja", title: "Loja", url: "/loja" },
  { key: "subscriptions", title: "Assinaturas", url: "/subscriptions" },
  { key: "orders", title: "Pedidos", url: "/orders" },
  { key: "tutorials", title: "Tutoriais", url: "/tutorials" },
  { key: "advertise", title: "Anuncie Aqui", url: "/advertise" },
  { key: "ganhe-aqui", title: "Ganhe Aqui", url: "/ganhe-aqui" },
  { key: "mercado", title: "Mercado", url: "/mercado" },
];

export default function NavMenuVisibilityManager() {
  const [hiddenLinks, setHiddenLinks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "hidden_nav_links")
        .maybeSingle();

      if (data?.value) {
        try {
          setHiddenLinks(JSON.parse(data.value));
        } catch {
          setHiddenLinks([]);
        }
      }
    } catch (err) {
      console.error("Error fetching nav settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (key: string) => {
    setHiddenLinks(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("site_settings")
        .select("id")
        .eq("key", "hidden_nav_links")
        .maybeSingle();

      if (existing) {
        await supabase
          .from("site_settings")
          .update({ value: JSON.stringify(hiddenLinks) })
          .eq("key", "hidden_nav_links");
      } else {
        await supabase
          .from("site_settings")
          .insert({ key: "hidden_nav_links", value: JSON.stringify(hiddenLinks) });
      }

      toast.success("Visibilidade do menu atualizada!");
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Menu className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-white">Menu do Cliente</h3>
            <p className="text-xs text-gray-400">
              Oculte itens do menu enquanto estiverem em manutenção ou desenvolvimento.
            </p>
          </div>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-primary hover:bg-red-700 text-white font-bold rounded-xl flex items-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar
        </Button>
      </div>

      <div className="rounded-xl border border-white/5 overflow-hidden">
        {clientNavLinks.map((link, i) => {
          const isHidden = hiddenLinks.includes(link.key);
          return (
            <div
              key={link.key}
              className={`flex items-center justify-between px-4 py-3 ${
                i !== clientNavLinks.length - 1 ? "border-b border-white/5" : ""
              } ${isHidden ? "bg-red-500/5" : "bg-white/[0.02]"} hover:bg-white/5 transition-colors`}
            >
              <div className="flex items-center gap-3">
                {isHidden ? (
                  <EyeOff className="w-4 h-4 text-red-400" />
                ) : (
                  <Eye className="w-4 h-4 text-emerald-400" />
                )}
                <div>
                  <span className={`text-sm font-medium ${isHidden ? "text-gray-500 line-through" : "text-white"}`}>
                    {link.title}
                  </span>
                  <span className="text-xs text-gray-600 ml-2">{link.url}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  isHidden 
                    ? "bg-red-500/10 text-red-400 border border-red-500/20" 
                    : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                }`}>
                  {isHidden ? "Oculto" : "Visível"}
                </span>
                <Switch
                  checked={!isHidden}
                  onCheckedChange={() => handleToggle(link.key)}
                />
              </div>
            </div>
          );
        })}
      </div>

      {hiddenLinks.length > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <EyeOff className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
          <p className="text-xs text-yellow-300">
            <strong>{hiddenLinks.length}</strong> {hiddenLinks.length === 1 ? "item está oculto" : "itens estão ocultos"} no menu do cliente. 
            Os clientes não verão {hiddenLinks.length === 1 ? "esse item" : "esses itens"} até que {hiddenLinks.length === 1 ? "seja reativado" : "sejam reativados"}.
          </p>
        </div>
      )}
    </div>
  );
}
