import { useState, useEffect, useRef } from "react";
import { Globe, Save, Loader2, Plus, Trash2, Image, Type, Sliders, Users, Star, MessageSquare, LayoutGrid, ChevronDown, ChevronUp, Upload, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

/* ─── Default config (mirrors Index.tsx hardcoded data) ─── */
const DEFAULT_CONFIG = {
  hero: {
    title: "CONTINGÊNCIA QUE",
    titleHighlight: "ESCALA",
    subtitle: "Perfis Premium • Proxies Residenciais • BM • Escala real sem banimento",
    ctaText: "COMPRAR AGORA",
    ctaSecondary: "VER PACOTES",
    liveCounter: "+4.872 contas rodando agora",
    backgroundImage: "https://lh3.googleusercontent.com/aida-public/AB6AXuA6mgEPPp3A8WfZQmpvovGnq8PM9WQg_VkbqFOpX5utcy7JW7eYKsAV9pckAiLW4HXkTuCnkbHEzSZ3XgxxuKvKwpUukxRYguy3lK19izWDcioO08gGeV0zOD1FeiHJuxT3A2T4eviHN7giUTucvUtz0X1X_fv8_p0lyBhXQVoaXqw_kB8a3XkhmnWhIp7aJXlzHp8a8L3FttZWD1Bx6gMZA2n-sMXVQZ-CsESvtzVWY7V9EgAY2K_iL9-Ydu2XDyUc2mCIhqxA_Pc3",
    whatsappUrl: "https://wa.me/55000000000",
    whatsappLabel: "Fale com um Especialista",
  },
  partners: ["Natália Torres", "Conta Simples", "Utmify", "Lauth", "Alan Benites"],
  steps: [
    { icon: "shopping_cart", title: "Escolha o produto", desc: "Selecione entre Perfis, Proxies ou BM de acordo com sua estratégia de tráfego." },
    { icon: "bolt", title: "Receba instantaneamente", desc: "Entrega automatizada via e-mail e painel em menos de 60 segundos após o PIX." },
    { icon: "rocket_launch", title: "Escala sem banimento", desc: "Aqueça, suba suas campanhas e escale seu ROI com a segurança de IPs residenciais." },
  ],
  stepsTitle: "Sua contingência em",
  stepsTitleHighlight: "3 passos",
  stepsSubtitle: "Engenharia de alta precisão para afiliados e gestores que buscam o topo.",
  products: [
    {
      title: "Perfis Premium", sub: "Instagram + TikTok",
      img: "https://lh3.googleusercontent.com/aida-public/AB6AXuAe_KntvbU6rPvrronnRaNIEbxUcs-Cqtn_k_YUtg0ShQP1F9xKhw4BFxwRf1SLq070qar43LIP4nMrRD9wVXI4oBANGXhzCUxMI_sTgvR1I9IL8l7CsZTSjp26FnkK6QjptSZ-1PnAAKhCIPFs9RbwHFRc1a1SceBcQUwQIdostfeDpOSIYuvSlBG025IsoFowEKrAI9SvmTC6oS9MUxLGnUEnigAqj19030Q7e2PHwUOA7k84A15dkY65Py4mdLeV2tq7poVAi1ow",
      features: ["Aquecidos 15+ dias", "Foto e Bio reais", "Cookies inclusos"],
      price: "47", unit: "/unid", featured: false,
    },
    {
      title: "Proxies Residencial", sub: "4G / 5G Mobile",
      img: "https://lh3.googleusercontent.com/aida-public/AB6AXuD5ZhArplK1PvXPuC1gMxXEKC7jFymbwp-YmIOYu3WvhhVoIDT4fG8sfpe7bx8kynpzQuBckd3DBWaEayUg4cKCCgwLfOfVf-mQN-35VXRB9z--uH9xfmrlffr7LP3EODJAVFTesuTOg_ur1kYusUW3-1wGQzEDwyBhLicfkMzJsc8TRynBjlQSnufDpsLaHQKzbDt6rrhlgWzTNH5xSkNxY4qJCxJQ23ONSnLY8ISY0KprLLjWz2mnXGBcB6pRnAk8WIQL-FXWgDCs",
      features: ["IPs de operadoras reais", "Rotação automática", "Zero blacklist"],
      price: "129", unit: "/mês", featured: false,
    },
    {
      title: "Bulk Messaging", sub: "WhatsApp / BM",
      img: "https://lh3.googleusercontent.com/aida-public/AB6AXuDuOpsfJ57lH1sDAzKnHxnS1tmHsCcYVtAMnp3Q6dM5YKrP713ZmmmRMPrIniVJG2OyFiUqsXW4OEE-pKwSpBIi0kTCoQ7y3BWgDhvOtDKEAYGWAPs-ZzMMILSgZMB41E_23Thwtn6juVyQjxpQRoFh1hmG5mG3tg_oAHtAdnIMjmH4GYjyZXlUMKGp8HZRmOSdB45pdcpiLPPgfnbglucGgrlDKjrXkppUlmepJt_jHBNsTbOwSc9LazMZZvxK3yJKcjopvAbikrhs",
      features: ["API de alta performance", "Delay anti-ban", "Suporte a variáveis"],
      price: "197", unit: "/camp", featured: false,
    },
    {
      title: "Pacote Completo", sub: "Estratégia Full",
      img: "https://lh3.googleusercontent.com/aida-public/AB6AXuDBHtsx0N9hlnapvr_eARhpwUGeQHuJenA6V139WpurnDdc5yh9kvaBUSB1NdXvPKr3Zau62tmkJh3vlBc1KYODu46oD9VhPpbVTb0QfLMMYNdnF6KILOHesHzC5d51amprFa-JVV7Ohlf0_XoPfF5rJRwzgfEn2sFtg1Hh66Sy2JsNdTuUusO2fdZgANaKzwgEEM6Y09DLFQd4c5cxlJ7uT4gtfV8-m5HIEO8KR0VQsoI3X4pg02bYGwy0x5LL8lwpSGItXGlLGFfx",
      features: ["10 Perfis Premium", "Proxy 5G Ilimitado", "Consultoria de Setup"],
      price: "497", unit: "/setup", featured: true,
    },
  ],
  productsTitle: "Escolha sua arma de",
  productsTitleHighlight: "contingência",
  benefits: [
    { icon: "location_on", title: "IP Residencial Real", desc: "Conexões autênticas que o Facebook confia." },
    { icon: "timer", title: "Entrega < 60s", desc: "Processamento automático instantâneo." },
    { icon: "support_agent", title: "Suporte 24h", desc: "Especialistas prontos para te ajudar a escalar." },
    { icon: "verified_user", title: "Garantia Total", desc: "Reposição imediata em caso de falha técnica." },
  ],
  benefitsTitle: "Por que milhares de usuários escolhem a",
  benefitsTitleHighlight: "FBFLIX",
  testimonials: [
    {
      name: "Ricardo Mendes", role: "Afiliado Black",
      img: "https://lh3.googleusercontent.com/aida-public/AB6AXuCUsS26R4V-9ieauNjiLBM58xWx7-XK2lqjxaxaObILCHd1PajMPL_Cq7wPRVsIJJJ1qIXjqiOV0Vr7bluMSj_Pfk2W7gZCR2X0QqnAIzmvMk3WQuPw7oBw1NR8ypQZW153UeiAGmw7zlR2WZeiM8zEzPv2x1V7LvrTT0U8BYyTQpc3JilicYnzTuWuCafui8WXpJ4JEZoUDfSbYZI-FDJSD8GWv3M2U7xbiE3HXra8HIvyF-p9lo4NSthSn-5EJBDCZ3TEDH2gqQ7X",
      text: "Depois que migrei para os proxies da FBFLIX, parei de tomar checkpoint em cascata. Escala garantida.",
    },
    {
      name: "Amanda Souza", role: "Gestora de Tráfego",
      img: "https://lh3.googleusercontent.com/aida-public/AB6AXuA5QWtGBu4iTXnpf_eDSnru2VV8RlEWYG7CAspTvbPqafRUit1JuHkR4yIVG7sOVenAa06Mj9etc-mh2uoamzDEOVdpHZlbaNn4u9e2aDbGGxcFedGYJXLyTIo-sf4Gp8HbkJmXf5pk1KxzTSpGLzcTkge1OC4e_bXE5D1zlJSXQc7f_OoQ-fbijzEUC4lagZ2rjkT48sRgyHC-F5NCrn145azBcrtMdjaga0c76Ps5w19LUA_VGL9TSr7H1kTKv9qZmARHwF3P-JBs",
      text: "A entrega é surreal de rápida. Em 1 minuto já estava com os perfis logados e subindo campanha.",
    },
  ],
  simulator: {
    title: "Monte seu pacote e veja o preço na hora",
    items: [
      { label: "Quantidade de Perfis", key: "profiles", price: 47, min: 1, max: 50, default: 10 },
      { label: "Proxies Residenciais", key: "proxies", price: 129, min: 0, max: 10, default: 2 },
      { label: "Quantidade de Páginas", key: "pages", price: 15, min: 1, max: 20, default: 5 },
      { label: "Campanhas Bulk BM", key: "bm", price: 197, min: 0, max: 10, default: 1 },
    ],
  },
  footer: {
    cnpj: "40.122.096/0001-85",
    description: "© 2026 FBFLIX. Todos os direitos reservados. Engenharia de precisão para contingência e escala profissional no mercado de tráfego pago.",
  },
};

type SiteConfig = typeof DEFAULT_CONFIG;

const SETTINGS_KEY = "landing_page_config";

function useSiteConfig() {
  return useQuery({
    queryKey: ["site-config"],
    queryFn: async (): Promise<SiteConfig> => {
      const { data } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", SETTINGS_KEY)
        .maybeSingle();
      if (data?.value) {
        try {
          return { ...DEFAULT_CONFIG, ...JSON.parse(data.value) };
        } catch { /* fallback */ }
      }
      return DEFAULT_CONFIG;
    },
  });
}

export default function AdminSiteEditor() {
  const queryClient = useQueryClient();
  const { data: config, isLoading } = useSiteConfig();
  const [draft, setDraft] = useState<SiteConfig>(DEFAULT_CONFIG);
  const [activeTab, setActiveTab] = useState("hero");
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (config) {
      setDraft(config);
      setHasChanges(false);
    }
  }, [config]);

  const update = (path: string, value: any) => {
    setDraft((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split(".");
      let obj = next;
      for (let i = 0; i < keys.length - 1; i++) {
        const k = isNaN(Number(keys[i])) ? keys[i] : Number(keys[i]);
        obj = obj[k];
      }
      const lastKey = isNaN(Number(keys[keys.length - 1])) ? keys[keys.length - 1] : Number(keys[keys.length - 1]);
      obj[lastKey] = value;
      return next;
    });
    setHasChanges(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("site_settings").upsert(
        { key: SETTINGS_KEY, value: JSON.stringify(draft) },
        { onConflict: "key" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configurações salvas com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["site-config"] });
      setHasChanges(false);
    },
    onError: (err: any) => toast.error("Erro ao salvar: " + err.message),
  });

  const resetToDefault = () => {
    setDraft(DEFAULT_CONFIG);
    setHasChanges(true);
    toast.info("Resetado para configuração padrão. Clique em Salvar para aplicar.");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-3 text-gray-400">Carregando configurações...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 py-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <Globe className="w-4 h-4" />
            <span>Configurações</span>
            <span className="text-gray-600">/</span>
            <span>Editor do Site</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
            Editor do Site
          </h1>
          <p className="text-gray-400 text-base max-w-2xl">
            Personalize 100% da landing page: hero, produtos, simulador, depoimentos e mais.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={resetToDefault} className="border-white/10 text-gray-300 hover:bg-white/5">
            Resetar Padrão
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !hasChanges}
            className="bg-primary hover:bg-red-700 text-white font-bold px-6 shadow-lg shadow-primary/20"
          >
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar Alterações
          </Button>
        </div>
      </header>

      {hasChanges && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-amber-400 text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-base">warning</span>
          Você tem alterações não salvas.
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-black/30 border border-white/10 flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="hero" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            <Type className="w-4 h-4 mr-1" /> Hero
          </TabsTrigger>
          <TabsTrigger value="products" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            <LayoutGrid className="w-4 h-4 mr-1" /> Produtos
          </TabsTrigger>
          <TabsTrigger value="simulator" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            <Sliders className="w-4 h-4 mr-1" /> Simulador
          </TabsTrigger>
          <TabsTrigger value="steps" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            <Star className="w-4 h-4 mr-1" /> Como Funciona
          </TabsTrigger>
          <TabsTrigger value="social" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            <MessageSquare className="w-4 h-4 mr-1" /> Social Proof
          </TabsTrigger>
          <TabsTrigger value="footer" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            <Globe className="w-4 h-4 mr-1" /> Rodapé
          </TabsTrigger>
        </TabsList>

        {/* ═══ HERO ═══ */}
        <TabsContent value="hero">
          <Section title="Seção Hero" desc="Configure o título, subtítulo e botões da primeira tela">
            <Field label="Título Principal" value={draft.hero.title} onChange={(v) => update("hero.title", v)} />
            <Field label="Palavra Destaque (italic vermelha)" value={draft.hero.titleHighlight} onChange={(v) => update("hero.titleHighlight", v)} />
            <Field label="Subtítulo" value={draft.hero.subtitle} onChange={(v) => update("hero.subtitle", v)} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Texto do Botão Principal" value={draft.hero.ctaText} onChange={(v) => update("hero.ctaText", v)} />
              <Field label="Texto do Botão Secundário" value={draft.hero.ctaSecondary} onChange={(v) => update("hero.ctaSecondary", v)} />
            </div>
            <Field label="Texto do Contador Ao Vivo" value={draft.hero.liveCounter} onChange={(v) => update("hero.liveCounter", v)} />
            <Field label="URL da Imagem de Fundo" value={draft.hero.backgroundImage} onChange={(v) => update("hero.backgroundImage", v)} />
            {draft.hero.backgroundImage && (
              <div className="rounded-xl overflow-hidden border border-white/10 max-w-md">
                <img src={draft.hero.backgroundImage} alt="Preview" className="w-full h-32 object-cover opacity-40" />
              </div>
            )}
            <Field label="URL do WhatsApp" value={draft.hero.whatsappUrl} onChange={(v) => update("hero.whatsappUrl", v)} />
            <Field label="Label do WhatsApp" value={draft.hero.whatsappLabel} onChange={(v) => update("hero.whatsappLabel", v)} />

            <div className="mt-6">
              <h3 className="text-white font-bold text-sm mb-3">Parceiros / Clientes</h3>
              {draft.partners.map((p, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <Input
                    value={p}
                    onChange={(e) => {
                      const next = [...draft.partners];
                      next[i] = e.target.value;
                      update("partners", next);
                    }}
                    className="bg-black/30 border-white/10 text-white"
                  />
                  <Button variant="ghost" size="icon" onClick={() => update("partners", draft.partners.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-300 hover:bg-red-500/10 shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => update("partners", [...draft.partners, "Novo Parceiro"])} className="border-white/10 text-gray-300 mt-1">
                <Plus className="w-4 h-4 mr-1" /> Adicionar Parceiro
              </Button>
            </div>
          </Section>
        </TabsContent>

        {/* ═══ PRODUCTS ═══ */}
        <TabsContent value="products">
          <Section title="Cards de Produtos" desc="Edite os produtos exibidos na landing page">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <Field label="Título da Seção" value={draft.productsTitle} onChange={(v) => update("productsTitle", v)} />
              <Field label="Palavra Destaque" value={draft.productsTitleHighlight} onChange={(v) => update("productsTitleHighlight", v)} />
            </div>

            {draft.products.map((product, i) => (
              <div key={i} className="bg-white/[0.03] border border-white/10 rounded-xl p-5 mb-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-white font-bold flex items-center gap-2">
                    {product.featured && <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded font-bold uppercase">Destaque</span>}
                    Produto {i + 1}: {product.title}
                  </h3>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-gray-400">
                      <Switch checked={product.featured} onCheckedChange={(v) => update(`products.${i}.featured`, v)} />
                      Destaque
                    </label>
                    {draft.products.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => update("products", draft.products.filter((_, idx) => idx !== i))} className="text-red-400 hover:bg-red-500/10">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Título" value={product.title} onChange={(v) => update(`products.${i}.title`, v)} />
                  <Field label="Subtítulo" value={product.sub} onChange={(v) => update(`products.${i}.sub`, v)} />
                  <Field label="Preço" value={product.price} onChange={(v) => update(`products.${i}.price`, v)} />
                  <Field label="Unidade (ex: /unid, /mês)" value={product.unit} onChange={(v) => update(`products.${i}.unit`, v)} />
                </div>
                <Field label="URL da Imagem" value={product.img} onChange={(v) => update(`products.${i}.img`, v)} />
                {product.img && (
                  <div className="rounded-lg overflow-hidden border border-white/10 max-w-xs mt-2 mb-3">
                    <img src={product.img} alt={product.title} className="w-full h-24 object-cover" />
                  </div>
                )}
                <div className="mt-3">
                  <p className="text-xs text-gray-400 font-medium mb-2">Features (uma por linha)</p>
                  {product.features.map((f, fi) => (
                    <div key={fi} className="flex gap-2 mb-1.5">
                      <Input
                        value={f}
                        onChange={(e) => {
                          const next = [...product.features];
                          next[fi] = e.target.value;
                          update(`products.${i}.features`, next);
                        }}
                        className="bg-black/30 border-white/10 text-white text-sm"
                      />
                      <Button variant="ghost" size="icon" onClick={() => update(`products.${i}.features`, product.features.filter((_, idx) => idx !== fi))} className="text-red-400 hover:bg-red-500/10 shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => update(`products.${i}.features`, [...product.features, "Nova feature"])} className="border-white/10 text-gray-300 mt-1 text-xs">
                    <Plus className="w-3 h-3 mr-1" /> Feature
                  </Button>
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              onClick={() => update("products", [...draft.products, { title: "Novo Produto", sub: "Subtítulo", img: "", features: ["Feature 1"], price: "0", unit: "/unid", featured: false }])}
              className="border-dashed border-white/20 text-gray-300 w-full py-6"
            >
              <Plus className="w-5 h-5 mr-2" /> Adicionar Produto
            </Button>
          </Section>
        </TabsContent>

        {/* ═══ SIMULATOR ═══ */}
        <TabsContent value="simulator">
          <Section title="Simulador de Preço" desc="Configure os itens do simulador interativo">
            <Field label="Título do Simulador" value={draft.simulator.title} onChange={(v) => update("simulator.title", v)} />

            {draft.simulator.items.map((item, i) => (
              <div key={i} className="bg-white/[0.03] border border-white/10 rounded-xl p-5 mb-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-white font-bold text-sm">{item.label}</h3>
                  {draft.simulator.items.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => update("simulator.items", draft.simulator.items.filter((_, idx) => idx !== i))} className="text-red-400 hover:bg-red-500/10">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Field label="Label" value={item.label} onChange={(v) => update(`simulator.items.${i}.label`, v)} />
                  <div>
                    <label className="text-xs text-gray-400 font-medium mb-1.5 block">Preço Unitário (R$)</label>
                    <Input type="number" value={item.price} onChange={(e) => update(`simulator.items.${i}.price`, Number(e.target.value))} className="bg-black/30 border-white/10 text-white" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 font-medium mb-1.5 block">Mínimo</label>
                    <Input type="number" value={item.min} onChange={(e) => update(`simulator.items.${i}.min`, Number(e.target.value))} className="bg-black/30 border-white/10 text-white" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 font-medium mb-1.5 block">Máximo</label>
                    <Input type="number" value={item.max} onChange={(e) => update(`simulator.items.${i}.max`, Number(e.target.value))} className="bg-black/30 border-white/10 text-white" />
                  </div>
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              onClick={() => update("simulator.items", [...draft.simulator.items, { label: "Novo Item", key: `item_${Date.now()}`, price: 0, min: 0, max: 10, default: 1 }])}
              className="border-dashed border-white/20 text-gray-300 w-full py-6"
            >
              <Plus className="w-5 h-5 mr-2" /> Adicionar Item ao Simulador
            </Button>
          </Section>
        </TabsContent>

        {/* ═══ STEPS ═══ */}
        <TabsContent value="steps">
          <Section title="Como Funciona" desc="Edite os 3 passos explicativos">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <Field label="Título da Seção" value={draft.stepsTitle} onChange={(v) => update("stepsTitle", v)} />
              <Field label="Palavra Destaque" value={draft.stepsTitleHighlight} onChange={(v) => update("stepsTitleHighlight", v)} />
            </div>
            <Field label="Subtítulo" value={draft.stepsSubtitle} onChange={(v) => update("stepsSubtitle", v)} />

            {draft.steps.map((step, i) => (
              <div key={i} className="bg-white/[0.03] border border-white/10 rounded-xl p-5 mb-4">
                <h3 className="text-white font-bold text-sm mb-3">Passo {i + 1}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Ícone (Material Symbols)" value={step.icon} onChange={(v) => update(`steps.${i}.icon`, v)} />
                  <Field label="Título" value={step.title} onChange={(v) => update(`steps.${i}.title`, v)} />
                </div>
                <div className="mt-3">
                  <label className="text-xs text-gray-400 font-medium mb-1.5 block">Descrição</label>
                  <Textarea value={step.desc} onChange={(e) => update(`steps.${i}.desc`, e.target.value)} className="bg-black/30 border-white/10 text-white text-sm" rows={2} />
                </div>
              </div>
            ))}
          </Section>
        </TabsContent>

        {/* ═══ SOCIAL PROOF ═══ */}
        <TabsContent value="social">
          <Section title="Prova Social" desc="Edite benefícios e depoimentos">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <Field label="Título Benefícios" value={draft.benefitsTitle} onChange={(v) => update("benefitsTitle", v)} />
              <Field label="Palavra Destaque" value={draft.benefitsTitleHighlight} onChange={(v) => update("benefitsTitleHighlight", v)} />
            </div>

            <h3 className="text-white font-bold text-sm mb-3">Benefícios</h3>
            {draft.benefits.map((b, i) => (
              <div key={i} className="bg-white/[0.03] border border-white/10 rounded-xl p-4 mb-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Field label="Ícone" value={b.icon} onChange={(v) => update(`benefits.${i}.icon`, v)} />
                  <Field label="Título" value={b.title} onChange={(v) => update(`benefits.${i}.title`, v)} />
                  <Field label="Descrição" value={b.desc} onChange={(v) => update(`benefits.${i}.desc`, v)} />
                </div>
              </div>
            ))}

            <h3 className="text-white font-bold text-sm mt-8 mb-3">Depoimentos</h3>
            {draft.testimonials.map((t, i) => (
              <div key={i} className="bg-white/[0.03] border border-white/10 rounded-xl p-5 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Nome" value={t.name} onChange={(v) => update(`testimonials.${i}.name`, v)} />
                  <Field label="Cargo / Função" value={t.role} onChange={(v) => update(`testimonials.${i}.role`, v)} />
                </div>
                <Field label="URL da Foto" value={t.img} onChange={(v) => update(`testimonials.${i}.img`, v)} />
                <div className="mt-3">
                  <label className="text-xs text-gray-400 font-medium mb-1.5 block">Texto do Depoimento</label>
                  <Textarea value={t.text} onChange={(e) => update(`testimonials.${i}.text`, e.target.value)} className="bg-black/30 border-white/10 text-white text-sm" rows={2} />
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              onClick={() => update("testimonials", [...draft.testimonials, { name: "Novo Cliente", role: "Cargo", img: "", text: "Depoimento aqui..." }])}
              className="border-dashed border-white/20 text-gray-300 w-full py-4"
            >
              <Plus className="w-5 h-5 mr-2" /> Adicionar Depoimento
            </Button>
          </Section>
        </TabsContent>

        {/* ═══ FOOTER ═══ */}
        <TabsContent value="footer">
          <Section title="Rodapé" desc="Configure informações do rodapé">
            <Field label="CNPJ" value={draft.footer.cnpj} onChange={(v) => update("footer.cnpj", v)} />
            <div className="mt-3">
              <label className="text-xs text-gray-400 font-medium mb-1.5 block">Texto de Copyright</label>
              <Textarea value={draft.footer.description} onChange={(e) => update("footer.description", e.target.value)} className="bg-black/30 border-white/10 text-white text-sm" rows={3} />
            </div>
          </Section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ─── Helpers ─── */
function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="bg-[rgba(20,20,20,0.6)] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 md:p-8 mt-4">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white">{title}</h2>
        <p className="text-gray-400 text-sm">{desc}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-gray-400 font-medium mb-1.5 block">{label}</label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-black/30 border-white/10 text-white"
      />
    </div>
  );
}
