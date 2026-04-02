import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Shield, ArrowLeft, Upload, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const PLATFORMS = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
];

const NICHES = ["Marketing", "Lifestyle", "Fitness", "Tecnologia", "Moda", "Gastronomia", "Educação", "Entretenimento", "Games", "Música", "Viagem", "Outro"];

export default function SocialSafeCreateListing() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    platform: "instagram",
    title: "",
    description: "",
    price: "",
    followers: "",
    engagement_rate: "",
    niche: "",
    is_verified: false,
    is_monetized: false,
    has_original_email: false,
    account_age_months: "",
  });

  const set = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Faça login para criar anúncio."); return; }

    if (!form.title.trim()) { toast.error("Título é obrigatório."); return; }
    if (!form.price || parseFloat(form.price) <= 0) { toast.error("Preço deve ser maior que zero."); return; }
    if (!form.followers || parseInt(form.followers) <= 0) { toast.error("Informe o número de seguidores."); return; }

    setSaving(true);
    const { error } = await supabase.from("ss_listings").insert({
      seller_id: user.id,
      platform: form.platform,
      title: form.title.trim(),
      description: form.description.trim() || null,
      price: parseFloat(form.price),
      followers: parseInt(form.followers),
      engagement_rate: form.engagement_rate ? parseFloat(form.engagement_rate) : 0,
      niche: form.niche || null,
      is_verified: form.is_verified,
      is_monetized: form.is_monetized,
      has_original_email: form.has_original_email,
      account_age_months: form.account_age_months ? parseInt(form.account_age_months) : 0,
      status: "published",
    });
    setSaving(false);

    if (error) {
      toast.error("Erro ao criar anúncio.");
      console.error(error);
    } else {
      toast.success("Anúncio publicado com sucesso!");
      navigate("/socialsafe");
    }
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--ss-bg))]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[hsl(var(--ss-header))] border-b border-[hsl(var(--ss-border))] backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate("/socialsafe")} className="flex items-center gap-2 text-[hsl(var(--ss-muted-fg))] hover:text-[hsl(var(--ss-foreground))] transition">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Voltar</span>
          </button>
          <div className="flex items-center gap-2 ml-auto">
            <div className="w-7 h-7 rounded-lg bg-[hsl(var(--ss-primary))] flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-[hsl(var(--ss-foreground))]">
              Social<span className="text-[hsl(var(--ss-primary))]">Safe</span>
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-[hsl(var(--ss-foreground))] mb-2">Vender uma Conta</h1>
        <p className="text-sm text-[hsl(var(--ss-muted-fg))] mb-8">Preencha os dados abaixo para publicar seu anúncio no marketplace.</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Platform */}
          <div className="bg-[hsl(var(--ss-card))] rounded-2xl border border-[hsl(var(--ss-border))] p-6 space-y-4">
            <h2 className="text-sm font-bold text-[hsl(var(--ss-foreground))]">📱 Plataforma e Informações Básicas</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-[hsl(var(--ss-muted-fg))]">Plataforma</Label>
                <Select value={form.platform} onValueChange={v => set("platform", v)}>
                  <SelectTrigger className="bg-[hsl(var(--ss-input))] border-[hsl(var(--ss-border))] text-[hsl(var(--ss-foreground))]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-[hsl(var(--ss-muted-fg))]">Nicho</Label>
                <Select value={form.niche} onValueChange={v => set("niche", v)}>
                  <SelectTrigger className="bg-[hsl(var(--ss-input))] border-[hsl(var(--ss-border))] text-[hsl(var(--ss-foreground))]">
                    <SelectValue placeholder="Selecione o nicho" />
                  </SelectTrigger>
                  <SelectContent>
                    {NICHES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-[hsl(var(--ss-muted-fg))]">Título do Anúncio *</Label>
              <Input
                value={form.title}
                onChange={e => set("title", e.target.value)}
                placeholder="Ex: Conta Instagram 50k - Nicho Fitness"
                className="bg-[hsl(var(--ss-input))] border-[hsl(var(--ss-border))] text-[hsl(var(--ss-foreground))]"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-[hsl(var(--ss-muted-fg))]">Descrição</Label>
              <Textarea
                value={form.description}
                onChange={e => set("description", e.target.value)}
                placeholder="Descreva a conta, engajamento, público, diferenciais..."
                rows={4}
                className="bg-[hsl(var(--ss-input))] border-[hsl(var(--ss-border))] text-[hsl(var(--ss-foreground))] resize-none"
              />
            </div>
          </div>

          {/* Metrics */}
          <div className="bg-[hsl(var(--ss-card))] rounded-2xl border border-[hsl(var(--ss-border))] p-6 space-y-4">
            <h2 className="text-sm font-bold text-[hsl(var(--ss-foreground))]">📊 Métricas e Dados</h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-[hsl(var(--ss-muted-fg))]">Preço (R$) *</Label>
                <Input
                  type="number"
                  min="1"
                  step="0.01"
                  value={form.price}
                  onChange={e => set("price", e.target.value)}
                  placeholder="0,00"
                  className="bg-[hsl(var(--ss-input))] border-[hsl(var(--ss-border))] text-[hsl(var(--ss-foreground))]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-[hsl(var(--ss-muted-fg))]">Seguidores *</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.followers}
                  onChange={e => set("followers", e.target.value)}
                  placeholder="50000"
                  className="bg-[hsl(var(--ss-input))] border-[hsl(var(--ss-border))] text-[hsl(var(--ss-foreground))]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-[hsl(var(--ss-muted-fg))]">Engajamento (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={form.engagement_rate}
                  onChange={e => set("engagement_rate", e.target.value)}
                  placeholder="3.5"
                  className="bg-[hsl(var(--ss-input))] border-[hsl(var(--ss-border))] text-[hsl(var(--ss-foreground))]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-[hsl(var(--ss-muted-fg))]">Idade da Conta (meses)</Label>
              <Input
                type="number"
                min="0"
                value={form.account_age_months}
                onChange={e => set("account_age_months", e.target.value)}
                placeholder="24"
                className="bg-[hsl(var(--ss-input))] border-[hsl(var(--ss-border))] text-[hsl(var(--ss-foreground))]"
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="bg-[hsl(var(--ss-card))] rounded-2xl border border-[hsl(var(--ss-border))] p-6 space-y-4">
            <h2 className="text-sm font-bold text-[hsl(var(--ss-foreground))]">🏷️ Características</h2>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[hsl(var(--ss-foreground))]">Conta Verificada</p>
                  <p className="text-[10px] text-[hsl(var(--ss-muted-fg))]">A conta possui selo de verificação</p>
                </div>
                <Switch checked={form.is_verified} onCheckedChange={v => set("is_verified", v)} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[hsl(var(--ss-foreground))]">Monetizada</p>
                  <p className="text-[10px] text-[hsl(var(--ss-muted-fg))]">A conta está monetizada pela plataforma</p>
                </div>
                <Switch checked={form.is_monetized} onCheckedChange={v => set("is_monetized", v)} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[hsl(var(--ss-foreground))]">Email Original</p>
                  <p className="text-[10px] text-[hsl(var(--ss-muted-fg))]">O email original da conta será incluído</p>
                </div>
                <Switch checked={form.has_original_email} onCheckedChange={v => set("has_original_email", v)} />
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-[hsl(var(--ss-primary))]/5 border border-[hsl(var(--ss-primary))]/10">
            <Info className="w-5 h-5 text-[hsl(var(--ss-primary))] shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-[hsl(var(--ss-primary))]">Após a publicação</p>
              <p className="text-[11px] text-[hsl(var(--ss-muted-fg))] mt-0.5">
                Seu anúncio ficará visível no marketplace. Quando um comprador iniciar a compra, você receberá uma notificação para enviar os dados da conta. O pagamento ficará retido até a validação da nossa equipe.
              </p>
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => navigate("/socialsafe")} className="flex-1 border-[hsl(var(--ss-border))] rounded-xl h-12">
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="flex-1 bg-[hsl(var(--ss-primary))] hover:bg-[hsl(var(--ss-primary))]/90 text-white font-bold rounded-xl h-12"
            >
              {saving ? "Publicando..." : "Publicar Anúncio"}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
