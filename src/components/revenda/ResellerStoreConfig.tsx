import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Copy, Check, ExternalLink, Loader2, Store, Percent, DollarSign } from "lucide-react";

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
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Store className="size-6 text-primary" /> Minha Loja Pública
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure a vitrine que seus clientes finais irão acessar. Aqui você define o preço de venda dos proxies, sua marca e o link público.
        </p>
      </div>

      {/* Link público */}
      <Card className="p-5 glass-card">
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">Link da sua loja</Label>
        <div className="flex items-center gap-2 mt-2">
          <Input value={storeUrl} readOnly className="font-mono text-sm" />
          <Button onClick={copyUrl} variant="outline" size="icon">
            {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
          </Button>
          <Button onClick={() => window.open(storeUrl, "_blank")} variant="outline" size="icon">
            <ExternalLink className="size-4" />
          </Button>
        </div>
      </Card>

      {/* Precificação */}
      <Card className="p-5 glass-card space-y-4">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
          <DollarSign className="size-5 text-primary" /> Preço de venda dos proxies
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setCfg({ ...cfg, proxy_price_mode: "multiplier" })}
            className={`p-4 rounded-lg border-2 text-left transition ${
              cfg.proxy_price_mode === "multiplier"
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/50"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Percent className="size-4 text-primary" />
              <span className="font-bold text-sm">Multiplicador</span>
            </div>
            <p className="text-xs text-muted-foreground">Preço base × multiplicador</p>
          </button>
          <button
            onClick={() => setCfg({ ...cfg, proxy_price_mode: "fixed" })}
            className={`p-4 rounded-lg border-2 text-left transition ${
              cfg.proxy_price_mode === "fixed"
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/50"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="size-4 text-primary" />
              <span className="font-bold text-sm">Preço Fixo</span>
            </div>
            <p className="text-xs text-muted-foreground">Todos os proxies pelo mesmo preço</p>
          </button>
        </div>

        {cfg.proxy_price_mode === "multiplier" ? (
          <div>
            <Label>Multiplicador (ex: 1.5 = 50% de markup)</Label>
            <Input
              type="number"
              step="0.1"
              min="1"
              value={cfg.proxy_price_multiplier}
              onChange={(e) => setCfg({ ...cfg, proxy_price_multiplier: Number(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Exemplo: proxy base R$ 21,00 × {cfg.proxy_price_multiplier} = R$ {(21 * cfg.proxy_price_multiplier).toFixed(2)}
            </p>
          </div>
        ) : (
          <div>
            <Label>Preço fixo por proxy (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={cfg.proxy_fixed_price ?? ""}
              onChange={(e) => setCfg({ ...cfg, proxy_fixed_price: e.target.value ? Number(e.target.value) : null })}
            />
          </div>
        )}
      </Card>

      {/* Marca e textos */}
      <Card className="p-5 glass-card space-y-4">
        <h3 className="text-lg font-bold text-foreground">Marca e apresentação</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Nome da marca</Label>
            <Input value={cfg.brand_name} onChange={(e) => setCfg({ ...cfg, brand_name: e.target.value })} placeholder="Ex: Proxys Silva" />
          </div>
          <div>
            <Label>Cor principal</Label>
            <div className="flex items-center gap-2">
              <Input type="color" value={cfg.primary_color} onChange={(e) => setCfg({ ...cfg, primary_color: e.target.value })} className="w-16 h-10 p-1" />
              <Input value={cfg.primary_color} onChange={(e) => setCfg({ ...cfg, primary_color: e.target.value })} className="flex-1 font-mono" />
            </div>
          </div>
          <div className="md:col-span-2">
            <Label>URL do logo (opcional)</Label>
            <Input value={cfg.logo_url} onChange={(e) => setCfg({ ...cfg, logo_url: e.target.value })} placeholder="https://..." />
          </div>
          <div>
            <Label>WhatsApp de suporte</Label>
            <Input value={cfg.support_whatsapp} onChange={(e) => setCfg({ ...cfg, support_whatsapp: e.target.value })} placeholder="55119..." />
          </div>
        </div>
        <div>
          <Label>Título do Hero</Label>
          <Input value={cfg.hero_title} onChange={(e) => setCfg({ ...cfg, hero_title: e.target.value })} placeholder="Ex: Proxies residenciais premium" />
        </div>
        <div>
          <Label>Subtítulo do Hero</Label>
          <Input value={cfg.hero_subtitle} onChange={(e) => setCfg({ ...cfg, hero_subtitle: e.target.value })} placeholder="Ex: A melhor infraestrutura para seu negócio" />
        </div>
        <div>
          <Label>Sobre a loja</Label>
          <Textarea value={cfg.about_text} onChange={(e) => setCfg({ ...cfg, about_text: e.target.value })} rows={4} placeholder="Fale um pouco sobre você e seu serviço..." />
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} size="lg" className="gap-2">
          {saving && <Loader2 className="size-4 animate-spin" />}
          Salvar Configuração
        </Button>
      </div>
    </div>
  );
}