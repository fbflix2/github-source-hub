import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Copy, Check, ExternalLink, Loader2, Store, Percent, DollarSign, Palette, Image as ImageIcon, MessageCircle, Sparkles } from "lucide-react";

interface Props {
  resellerId: string;
  slug: string;
}

interface StoreConfig {
  proxy_price_mode: "multiplier" | "fixed";
  proxy_price_multiplier: number;
  proxy_fixed_price: number | null;
  hero_title: string;
  hero_subtitle: string;
  about_text: string;
  support_whatsapp: string;
  brand_name: string;
  logo_url: string;
  primary_color: string;
}

export default function ResellerStoreConfig({ resellerId, slug }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [cfg, setCfg] = useState<StoreConfig>({
    proxy_price_mode: "multiplier",
    proxy_price_multiplier: 1.5,
    proxy_fixed_price: null,
    hero_title: "",
    hero_subtitle: "",
    about_text: "",
    support_whatsapp: "",
    brand_name: "",
    logo_url: "",
    primary_color: "#22c55e",
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("resellers")
        .select("proxy_price_mode, proxy_price_multiplier, proxy_fixed_price, hero_title, hero_subtitle, about_text, support_whatsapp, brand_name, logo_url, primary_color")
        .eq("id", resellerId)
        .maybeSingle();
      if (data) {
        setCfg({
          proxy_price_mode: (data.proxy_price_mode as any) || "multiplier",
          proxy_price_multiplier: Number(data.proxy_price_multiplier ?? 1.5),
          proxy_fixed_price: data.proxy_fixed_price !== null ? Number(data.proxy_fixed_price) : null,
          hero_title: data.hero_title || "",
          hero_subtitle: data.hero_subtitle || "",
          about_text: data.about_text || "",
          support_whatsapp: data.support_whatsapp || "",
          brand_name: data.brand_name || "",
          logo_url: data.logo_url || "",
          primary_color: data.primary_color || "#22c55e",
        });
      }
      setLoading(false);
    })();
  }, [resellerId]);

  const storeUrl = `${window.location.origin}/r/${slug}`;

  const copyUrl = async () => {
    await navigator.clipboard.writeText(storeUrl);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("resellers")
      .update({
        proxy_price_mode: cfg.proxy_price_mode,
        proxy_price_multiplier: cfg.proxy_price_multiplier,
        proxy_fixed_price: cfg.proxy_price_mode === "fixed" ? cfg.proxy_fixed_price : null,
        hero_title: cfg.hero_title || null,
        hero_subtitle: cfg.hero_subtitle || null,
        about_text: cfg.about_text || null,
        support_whatsapp: cfg.support_whatsapp || null,
        brand_name: cfg.brand_name || null,
        logo_url: cfg.logo_url || null,
        primary_color: cfg.primary_color,
      })
      .eq("id", resellerId);
    setSaving(false);
    if (error) toast.error("Erro ao salvar: " + error.message);
    else toast.success("Configuração salva!");
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="size-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="animate-fade-in max-w-3xl mx-auto space-y-8 py-4">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3 text-primary">
          <Store className="size-7" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Minha Loja Pública</h1>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
          Configure a vitrine que seus clientes finais irão acessar. Aqui você define o preço de venda dos proxies, sua marca e o link público.
        </p>
      </div>

      {/* Link da loja */}
      <section className="bg-card/60 border border-border/60 rounded-xl p-6 shadow-sm">
        <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-4">
          Link da sua loja
        </Label>
        <div className="flex gap-2">
          <Input
            value={storeUrl}
            readOnly
            className="flex-1 bg-background/60 border-border/60 font-mono text-sm focus-visible:border-primary"
          />
          <Button
            onClick={copyUrl}
            variant="outline"
            size="icon"
            className="bg-background/60 border-border/60 hover:bg-accent/50 shrink-0"
            aria-label="Copiar link"
          >
            {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
          </Button>
          <Button
            onClick={() => window.open(storeUrl, "_blank")}
            variant="outline"
            size="icon"
            className="bg-background/60 border-border/60 hover:bg-accent/50 shrink-0"
            aria-label="Abrir loja"
          >
            <ExternalLink className="size-4" />
          </Button>
        </div>
      </section>

      {/* Preço de venda */}
      <section className="bg-card/60 border border-border/60 rounded-xl p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-2">
          <DollarSign className="size-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Preço de venda dos proxies</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { mode: "multiplier" as const, icon: Percent, title: "Multiplicador", desc: "Preço base × multiplicador" },
            { mode: "fixed" as const, icon: DollarSign, title: "Preço Fixo", desc: "Todos os proxies pelo mesmo preço" },
          ].map(({ mode, icon: Icon, title, desc }) => {
            const active = cfg.proxy_price_mode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setCfg({ ...cfg, proxy_price_mode: mode })}
                className={`relative flex items-center p-4 rounded-lg text-left transition-all ${
                  active
                    ? "border-2 border-primary bg-primary/5"
                    : "border border-border/60 bg-background/40 hover:border-border"
                }`}
              >
                <div className="space-y-1">
                  <div className={`flex items-center gap-2 text-sm font-bold ${active ? "text-foreground" : "text-muted-foreground"}`}>
                    <Icon className={`size-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
                    {title}
                  </div>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                <div className="ml-auto shrink-0">
                  <div
                    className={`w-4 h-4 rounded-full ${
                      active ? "border-4 border-primary bg-background" : "border border-border"
                    }`}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {cfg.proxy_price_mode === "multiplier" ? (
          <div className="space-y-2 pt-2">
            <Label className="text-sm font-medium">Multiplicador (ex: 1.5 = 50% de markup)</Label>
            <Input
              type="number"
              step="0.1"
              min="1"
              value={cfg.proxy_price_multiplier}
              onChange={(e) => setCfg({ ...cfg, proxy_price_multiplier: Number(e.target.value) })}
              className="bg-background/60 border-border/60 focus-visible:border-primary"
            />
            <p className="text-xs text-muted-foreground italic">
              Exemplo: proxy base R$ 21,00 × {cfg.proxy_price_multiplier} = R$ {(21 * cfg.proxy_price_multiplier).toFixed(2)}
            </p>
          </div>
        ) : (
          <div className="space-y-2 pt-2">
            <Label className="text-sm font-medium">Preço fixo por proxy (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={cfg.proxy_fixed_price ?? ""}
              onChange={(e) => setCfg({ ...cfg, proxy_fixed_price: e.target.value ? Number(e.target.value) : null })}
              className="bg-background/60 border-border/60 focus-visible:border-primary"
            />
          </div>
        )}
      </section>

      {/* Marca e apresentação */}
      <section className="bg-card/60 border border-border/60 rounded-xl p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-2">
          <Palette className="size-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Marca e apresentação</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Nome da marca</Label>
            <Input
              value={cfg.brand_name}
              onChange={(e) => setCfg({ ...cfg, brand_name: e.target.value })}
              placeholder="Ex: Proxys Silva"
              className="bg-background/60 border-border/60 focus-visible:border-primary"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Cor principal</Label>
            <div className="flex gap-2">
              <div className="relative shrink-0">
                <div
                  className="w-10 h-10 rounded-lg border border-border/60"
                  style={{ background: cfg.primary_color }}
                />
                <input
                  type="color"
                  value={cfg.primary_color}
                  onChange={(e) => setCfg({ ...cfg, primary_color: e.target.value })}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  aria-label="Escolher cor"
                />
              </div>
              <Input
                value={cfg.primary_color}
                onChange={(e) => setCfg({ ...cfg, primary_color: e.target.value })}
                className="flex-1 font-mono bg-background/60 border-border/60 focus-visible:border-primary"
              />
            </div>
          </div>

          <div className="md:col-span-2 space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <ImageIcon className="size-3.5 text-muted-foreground" />
              URL do logo (opcional)
            </Label>
            <Input
              value={cfg.logo_url}
              onChange={(e) => setCfg({ ...cfg, logo_url: e.target.value })}
              placeholder="https://..."
              className="bg-background/60 border-border/60 focus-visible:border-primary"
            />
          </div>

          <div className="md:col-span-2 space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <MessageCircle className="size-3.5 text-muted-foreground" />
              WhatsApp de suporte
            </Label>
            <Input
              value={cfg.support_whatsapp}
              onChange={(e) => setCfg({ ...cfg, support_whatsapp: e.target.value })}
              placeholder="55119..."
              className="bg-background/60 border-border/60 focus-visible:border-primary"
            />
          </div>

          <div className="md:col-span-2 space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-muted-foreground" />
              Título do Hero
            </Label>
            <Input
              value={cfg.hero_title}
              onChange={(e) => setCfg({ ...cfg, hero_title: e.target.value })}
              placeholder="Ex: Proxies residenciais premium"
              className="bg-background/60 border-border/60 focus-visible:border-primary"
            />
          </div>

          <div className="md:col-span-2 space-y-2">
            <Label className="text-sm font-medium">Subtítulo do Hero</Label>
            <Input
              value={cfg.hero_subtitle}
              onChange={(e) => setCfg({ ...cfg, hero_subtitle: e.target.value })}
              placeholder="Ex: A melhor infraestrutura para seu negócio"
              className="bg-background/60 border-border/60 focus-visible:border-primary"
            />
          </div>

          <div className="md:col-span-2 space-y-2">
            <Label className="text-sm font-medium">Sobre a loja</Label>
            <Textarea
              value={cfg.about_text}
              onChange={(e) => setCfg({ ...cfg, about_text: e.target.value })}
              rows={4}
              placeholder="Fale um pouco sobre você e seu serviço..."
              className="bg-background/60 border-border/60 focus-visible:border-primary resize-none"
            />
          </div>
        </div>
      </section>

      {/* Actions */}
      <div className="flex justify-end pt-2">
        <Button
          onClick={save}
          disabled={saving}
          size="lg"
          className="gap-2 px-8 font-bold shadow-lg shadow-primary/20"
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          Salvar alterações
        </Button>
      </div>
    </div>
  );
}