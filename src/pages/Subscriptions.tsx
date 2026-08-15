import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useProxyBRSubscriptions } from "@/hooks/useProxyBR";
import { Play, X, SlidersHorizontal, Search } from "lucide-react";
import { useProxyFbflixSubscriptions, useMigrateProxyBRToProxyFbflix } from "@/hooks/useProxyFbflix";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { differenceInDays, parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import SubscriptionCard from "@/components/subscriptions/SubscriptionCard";
import DownloadProxiesDialog from "@/components/subscriptions/DownloadProxiesDialog";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Shield, Globe, ShieldCheck, Layers, Zap, ArrowRight, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import CTCheckoutModal from "@/components/contingencia/CTCheckoutModal";
import { useResellerContext } from "@/hooks/useResellerContext";
import { useResellerBranding } from "@/hooks/useResellerBranding";

export type SubscriptionStatus = "active" | "expiring" | "cancelled" | "expired";

export interface ProxySubscription {
  code: string;
  name: string;
  product_name?: string;
  customer_price?: number | null;
  status: string;
  start_date: string;
  end_date: string;
  proxy?: {
    id?: number;
    ip: string;
    port: number;
    username?: string;
    password?: string;
    protocol?: string;
    socks5_port?: number;
  };
  type: string;
  profile_tag?: string | null;
  proxyIndex?: number;
  totalProxies?: number;
  proxyLabel?: string;
  is_rotating?: boolean;
  gb_purchased?: number;
  provider?: string;
  [key: string]: unknown;
}

function mapStatus(sub: ProxySubscription): SubscriptionStatus {
  if (!sub.end_date) return "active";
  const now = new Date();
  const endDate = parseISO(sub.end_date);
  const daysLeft = differenceInDays(endDate, now);
  if (sub.status === "cancelled") return "cancelled";
  if (daysLeft < 0) return "expired";
  if (daysLeft <= 3) return "expiring";
  return "active";
}

function getDaysInfo(sub: ProxySubscription) {
  const now = new Date();
  const endDateStr = sub.end_date || sub.start_date || new Date().toISOString();
  const startDateStr = sub.start_date || new Date().toISOString();
  const endDate = parseISO(endDateStr);
  const startDate = parseISO(startDateStr);
  const totalDays = differenceInDays(endDate, startDate);
  const daysLeft = differenceInDays(endDate, now);
  const elapsed = totalDays - daysLeft;
  const progressPercent = totalDays > 0 ? Math.min(100, Math.max(0, (elapsed / totalDays) * 100)) : 0;
  return {
    daysRemaining: Math.max(0, daysLeft),
    daysExpired: daysLeft < 0 ? Math.abs(daysLeft) : 0,
    progressPercent,
    formattedStart: format(startDate, "dd MMM yyyy", { locale: ptBR }),
    formattedEnd: format(endDate, "dd MMM yyyy", { locale: ptBR }),
  };
}

type SubscriptionCategory = "proxies" | "safebm" | "contingencia";

const allCategoryTabs: { key: SubscriptionCategory; label: string; icon: React.ReactNode }[] = [
  { key: "proxies", label: "Proxies", icon: <Globe className="size-4" /> },
  { key: "safebm", label: "Safe BM", icon: <Shield className="size-4" /> },
  { key: "contingencia", label: "Scale Pro", icon: <Layers className="size-4" /> },
];

export default function Subscriptions() {
  const [activeCategory, setActiveCategory] = useState<SubscriptionCategory>("proxies");
  const [hasSafeBm, setHasSafeBm] = useState<boolean | null>(null);
  const [hasContingencia, setHasContingencia] = useState<boolean | null>(null);
  const [hasActiveProxy, setHasActiveProxy] = useState<boolean | null>(null);
  const [hasPurchasedSafeBm, setHasPurchasedSafeBm] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const { resellerId } = useResellerContext();
  const { branding } = useResellerBranding();
  const hostIsCustomDomain = typeof window !== "undefined"
    && !/fbflix\.com\.br|fbflix1\.lovable\.app|lovable\.app|lovableproject\.com|localhost/.test(window.location.hostname);
  const isResellerClient = !!resellerId || !!branding || hostIsCustomDomain;
  const categoryTabs = isResellerClient
    ? allCategoryTabs.filter((t) => t.key === "proxies")
    : allCategoryTabs;

  useEffect(() => {
    if (isResellerClient && activeCategory !== "proxies") {
      setActiveCategory("proxies");
    }
  }, [isResellerClient, activeCategory]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setHasSafeBm(false); setHasContingencia(false); return; }

      const [safeBmRes, ctRes] = await Promise.all([
        supabase
          .from("safe_bm_vaults" as any)
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("status", "active"),
        supabase
          .from("ct_clients")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("status", "ativo"),
      ]);
      setHasSafeBm((safeBmRes.count ?? 0) > 0);
      setHasContingencia((ctRes.count ?? 0) > 0);
    })();
  }, []);

  const { data: subscriptionsRaw } = useProxyBRSubscriptions();
  const { data: proxyfbflixRaw } = useProxyFbflixSubscriptions();

  useEffect(() => {
    const allSubs = [
      ...(Array.isArray(subscriptionsRaw) ? subscriptionsRaw : []),
      ...(Array.isArray(proxyfbflixRaw) ? proxyfbflixRaw : []),
    ];
    const hasActive = allSubs.some((sub: any) => {
      if (!sub.end_date) return true;
      const daysLeft = differenceInDays(parseISO(sub.end_date), new Date());
      return daysLeft >= 0 && sub.status !== "cancelled";
    });
    setHasActiveProxy(hasActive);
  }, [subscriptionsRaw, proxyfbflixRaw]);

  const activeServices: Record<SubscriptionCategory, boolean> = {
    proxies: hasActiveProxy === true,
    safebm: hasSafeBm === true || hasPurchasedSafeBm === true,
    contingencia: hasContingencia === true,
  };

  const handleTabClick = (key: SubscriptionCategory) => {
    if (key === "safebm" && hasSafeBm) {
      navigate("/safe-bm");
      return;
    }
    if (key === "contingencia" && hasContingencia) {
      navigate("/contingencia");
      return;
    }
    setActiveCategory(key);
  };

  // Check if user has purchased BM Safe (for showing subscription panel vs promo)
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setHasPurchasedSafeBm(false); return; }
      const SAFEBM_PRODUCT_ID = "e5118c63-ed52-4f4e-8983-f44c1ba0d17b";
      const { count } = await supabase
        .from("order_items")
        .select("id", { count: "exact", head: true })
        .eq("product_id", SAFEBM_PRODUCT_ID)
        .in("order_id", 
          (await supabase.from("orders").select("id").eq("user_id", user.id).eq("status", "completed")).data?.map(o => o.id) || []
        );
      setHasPurchasedSafeBm((count ?? 0) > 0);
    })();
  }, []);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight">Minhas Assinaturas</h1>
        <p className="text-text-secondary text-base">Gerencie todos os seus planos e serviços ativos.</p>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {categoryTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabClick(tab.key)}
            className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap border ${
              activeCategory === tab.key
                ? "bg-primary/10 text-primary border-primary/30 shadow-sm"
                : "bg-card/50 text-text-secondary border-glass-border hover:bg-card hover:text-foreground"
            }`}
          >
            {tab.icon}
            {tab.label}
            {activeServices[tab.key] ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-green-500/15 border border-green-500/30 text-green-500 text-[9px] font-bold uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Ativo
              </span>
            ) : (tab.key === "safebm" || tab.key === "contingencia") && activeServices[tab.key] === false ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-primary/15 border border-primary/30 text-primary text-[9px] font-bold uppercase tracking-wider animate-pulse">
                Novidade
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Content based on active category */}
      {activeCategory === "proxies" && <ProxiesPanel />}
      {activeCategory === "safebm" && (hasPurchasedSafeBm ? <SafeBmPanel /> : <SafeBmPromoPanel />)}
      {activeCategory === "contingencia" && <ContingenciaPanel />}
    </div>
  );
}

/* ─── SAFE BM PROMO (for non-subscribers) ─── */
function SafeBmPromoPanel() {
  const navigate = useNavigate();
  const [playingVideo, setPlayingVideo] = useState(false);

  const SAFEBM_VIDEO_ID = "TI3xOr_02PY";
  const thumbnailUrl = `https://img.youtube.com/vi/${SAFEBM_VIDEO_ID}/maxresdefault.jpg`;

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-br from-primary/5 via-card to-card border-primary/20 overflow-hidden relative">
        <CardContent className="p-5 md:p-6">
          <div className="flex flex-col lg:flex-row gap-6 items-center">
            {/* Info lado esquerdo */}
            <div className="lg:w-[420px] xl:w-[460px] flex-shrink-0 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Shield className="size-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">Safe BM</h2>
                  <Badge className="bg-primary/20 text-primary border-primary/30 text-[9px] mt-0.5">Proteção Premium</Badge>
                </div>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                O <strong className="text-foreground">Safe BM</strong> protege suas Business Managers contra perdas, bloqueios e acessos indevidos com backup automático e monitoramento 24/7.
              </p>

              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { icon: ShieldCheck, text: "Backup em tempo real" },
                  { icon: Lock, text: "Proteção de acesso" },
                  { icon: Zap, text: "Regeneração de links" },
                  { icon: Shield, text: "Monitoramento 24/7" },
                ].map((f, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <f.icon className="size-2.5 text-primary" />
                    </div>
                    {f.text}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <p className="text-xl font-bold text-foreground">R$ 9,99</p>
                <span className="text-[11px] text-muted-foreground">/mês por BM</span>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs"
                  onClick={() => navigate("/saiba-mais-safebm")}
                >
                  <Zap className="size-3" />
                  Ativar Agora
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => navigate("/saiba-mais-safebm")}
                >
                  Saiba Mais
                  <ArrowRight className="size-3" />
                </Button>
              </div>
            </div>

            {/* Vídeo lado direito - thumbnail com play */}
            <div className="flex-1 min-w-0">
              <div
                className="relative w-full aspect-video rounded-xl overflow-hidden border border-border/40 bg-black cursor-pointer group"
                onClick={() => setPlayingVideo(true)}
              >
                <img
                  src={thumbnailUrl}
                  alt="Safe BM - Como Funciona"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center shadow-lg shadow-primary/30 transition-transform duration-300 group-hover:scale-110">
                    <Play className="size-7 text-primary-foreground fill-current ml-1" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Video Player Modal */}
      {playingVideo && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setPlayingVideo(false)}
        >
          <div
            className="relative w-full max-w-4xl aspect-video rounded-xl overflow-hidden shadow-2xl bg-black"
            onClick={(e) => e.stopPropagation()}
          >
            <iframe
              src={`https://www.youtube.com/embed/${SAFEBM_VIDEO_ID}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
            <button
              onClick={() => setPlayingVideo(false)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center transition-colors"
            >
              <X className="size-4 text-white" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── PROXIES PANEL ─── */
function ProxiesPanel() {
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "individual" | "rotating">("all");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const { data: subscriptionsRaw, isLoading: proxyLoading, error: proxyError } = useProxyBRSubscriptions();
  const { data: proxyfbflixRaw, isLoading: wsLoading, error: wsError } = useProxyFbflixSubscriptions();
  const migrateMutation = useMigrateProxyBRToProxyFbflix();
  const [renewingCode, setRenewingCode] = useState<string | null>(null);

  const isLoading = proxyLoading || wsLoading;
  const error = proxyError || wsError;

  const proxyBRSubs: ProxySubscription[] = Array.isArray(subscriptionsRaw) ? subscriptionsRaw : [];
  const proxyfbflixSubs: ProxySubscription[] = Array.isArray(proxyfbflixRaw) ? proxyfbflixRaw : [];
  const subscriptions = [...proxyBRSubs, ...proxyfbflixSubs];

  const enriched = subscriptions.map((sub) => ({
    ...sub,
    mappedStatus: mapStatus(sub),
    ...getDaysInfo(sub),
  }));

  const counts = {
    all: enriched.length,
    active: enriched.filter((s) => s.mappedStatus === "active").length,
    expiring: enriched.filter((s) => s.mappedStatus === "expiring").length,
    cancelled: enriched.filter((s) => s.mappedStatus === "cancelled").length,
    expired: enriched.filter((s) => s.mappedStatus === "expired").length,
  };

  const filters = [
    { key: "all", label: "Todas", count: counts.all },
    { key: "active", label: "Ativas", count: counts.active },
    { key: "expiring", label: "Vencendo", count: counts.expiring, isWarning: true },
    { key: "cancelled", label: "Canceladas", count: counts.cancelled },
    { key: "expired", label: "Expiradas", count: counts.expired },
  ];

  // Unique profile tags for filter
  const allTags = [...new Set(enriched.map(s => s.profile_tag).filter(Boolean))] as string[];

  // Detect country from proxy IP or product name
  const getCountry = (sub: typeof enriched[0]) => {
    const name = (sub.product_name || sub.name || "").toUpperCase();
    if (name.includes("BR") || name.includes("BRASIL")) return "BR";
    if (name.includes("US") || name.includes("EUA") || name.includes("AMERICANO")) return "US";
    const ip = sub.proxy?.ip || "";
    // Heuristic: can't determine from IP alone, fallback
    return "OTHER";
  };

  let filtered = enriched.filter((s) => {
    const matchesStatus = activeFilter === "all" || s.mappedStatus === activeFilter;
    const matchesType = typeFilter === "all" || 
      (typeFilter === "rotating" && s.is_rotating) || 
      (typeFilter === "individual" && !s.is_rotating);
    return matchesStatus && matchesType;
  });

  // Advanced filters
  if (advancedOpen) {
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(s =>
        (s.code || "").toLowerCase().includes(term) ||
        (s.name || "").toLowerCase().includes(term) ||
        (s.product_name || "").toLowerCase().includes(term) ||
        (s.proxy?.ip || "").includes(term) ||
        (s.profile_tag || "").toLowerCase().includes(term)
      );
    }
    if (countryFilter !== "all") {
      filtered = filtered.filter(s => getCountry(s) === countryFilter);
    }
    if (tagFilter !== "all") {
      filtered = filtered.filter(s => s.profile_tag === tagFilter);
    }
    filtered = [...filtered].sort((a, b) => {
      if (sortBy === "newest") return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
      if (sortBy === "oldest") return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
      if (sortBy === "expiring_soon") return a.daysRemaining - b.daysRemaining;
      return 0;
    });
  }

  const handleRenew = (sub: ProxySubscription & { mappedStatus: SubscriptionStatus }) => {
    const rawData = (sub.raw_data || {}) as Record<string, any>;
    const isAlreadyProxyFbflix = rawData.provider === "proxyfbflix" || rawData.migrated_from_proxybr === true;
    // For already-migrated ProxyFbflix subs, use full name (#1, #2); for ProxyBR multi-proxy, strip #N
    const subName = isAlreadyProxyFbflix
      ? (sub.name || sub.code)
      : (sub.name || sub.code).replace(/#\d+$/, "").replace(/__proxy_\d+$/, "");
    setRenewingCode(sub.code);
    migrateMutation.mutate(
      { subscriptionName: subName, proxyIndex: isAlreadyProxyFbflix ? undefined : sub.proxyIndex, totalProxies: isAlreadyProxyFbflix ? undefined : sub.totalProxies },
      { onSettled: () => setRenewingCode(null) },
    );
  };

  if (!isLoading && !error && subscriptions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
          <Globe className="text-primary size-6" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Nenhuma assinatura de proxy</h2>
        <p className="text-text-secondary text-sm text-center max-w-md mb-6">Conheça nossos planos de proxy residencial.</p>
        <a href="/loja?filter=Proxy" className="bg-primary hover:bg-[#00c968] text-background h-11 px-6 rounded-xl text-sm font-bold transition-all shadow-glow flex items-center gap-2">
          Ver Planos de Proxy
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel rounded-xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <p className="text-text-secondary text-xs uppercase font-semibold tracking-wider">Ativas</p>
            <p className="text-foreground text-2xl font-bold">
              {isLoading ? <Skeleton className="h-8 w-20" /> : `${counts.active} Assinatura${counts.active !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
        {counts.expiring > 0 && (
          <div className="glass-panel rounded-xl p-5 flex items-center gap-4 border-danger/30 bg-danger/5">
            <div className="w-10 h-10 rounded-lg bg-danger/10 flex items-center justify-center text-danger">
              <span className="material-symbols-outlined">priority_high</span>
            </div>
            <div>
              <p className="text-danger/80 text-xs uppercase font-semibold tracking-wider">Atenção</p>
              <p className="text-foreground text-2xl font-bold">{counts.expiring} Vencendo</p>
            </div>
          </div>
        )}
      </div>

      {/* Filters + Advanced Toggle */}
      <div className="flex items-center justify-between gap-4">
        <div className="border-b border-glass-border flex-1">
          <div className="flex gap-8 overflow-x-auto pb-px no-scrollbar">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={`group flex items-center gap-2 pb-4 border-b-2 transition-colors ${
                  activeFilter === f.key ? "border-primary" : f.isWarning ? "border-transparent hover:border-danger/50" : "border-transparent hover:border-glass-border"
                }`}
              >
                <span className={`text-sm font-medium transition-colors ${activeFilter === f.key ? "text-foreground font-bold" : f.isWarning ? "text-text-secondary group-hover:text-danger" : "text-text-secondary group-hover:text-foreground"}`}>
                  {f.label}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${activeFilter === f.key ? "bg-primary/20 text-primary" : f.isWarning ? "bg-danger/10 text-danger" : "bg-muted text-text-secondary group-hover:text-foreground"}`}>
                  {f.count}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DownloadProxiesDialog subscriptions={subscriptions} />
          <button
            onClick={() => setAdvancedOpen(prev => !prev)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
              advancedOpen
                ? "bg-primary/10 text-primary border-primary/30"
                : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-border/60"
            }`}
            title="Filtro Avançado"
          >
            <SlidersHorizontal className="size-3.5" />
            <span className="hidden sm:inline">Filtros</span>
          </button>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {advancedOpen && (
        <div className="glass-panel rounded-xl p-4 space-y-3 animate-fade-in border border-border/40">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar por IP, código, nome..."
                className="pl-9 h-9 text-sm bg-background border-border"
              />
            </div>

            {/* Country */}
            <select
              value={countryFilter}
              onChange={e => setCountryFilter(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background text-sm text-foreground px-3 appearance-none cursor-pointer"
            >
              <option value="all">🌍 Todos os países</option>
              <option value="BR">🇧🇷 Brasil</option>
              <option value="US">🇺🇸 Estados Unidos</option>
            </select>

            {/* Profile Tag */}
            {allTags.length > 0 && (
              <select
                value={tagFilter}
                onChange={e => setTagFilter(e.target.value)}
                className="h-9 rounded-lg border border-border bg-background text-sm text-foreground px-3 appearance-none cursor-pointer"
              >
                <option value="all">🏷️ Todas etiquetas</option>
                {allTags.map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            )}

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as any)}
              className="h-9 rounded-lg border border-border bg-background text-sm text-foreground px-3 appearance-none cursor-pointer"
            >
              <option value="all">⚡ Todos os tipos</option>
              <option value="individual">📌 IP Individual (Estático)</option>
              <option value="rotating">🔄 Proxy Rotativo</option>
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background text-sm text-foreground px-3 appearance-none cursor-pointer"
            >
              <option value="newest">📅 Mais recentes</option>
              <option value="oldest">📅 Mais antigos</option>
              <option value="expiring_soon">⏳ Vencendo antes</option>
            </select>
          </div>

          {/* Active filters summary */}
          {(searchTerm || countryFilter !== "all" || tagFilter !== "all") && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">Filtros:</span>
              {searchTerm && (
                <Badge variant="secondary" className="text-[10px] gap-1 cursor-pointer" onClick={() => setSearchTerm("")}>
                  "{searchTerm}" <X className="size-2.5" />
                </Badge>
              )}
              {countryFilter !== "all" && (
                <Badge variant="secondary" className="text-[10px] gap-1 cursor-pointer" onClick={() => setCountryFilter("all")}>
                  {countryFilter === "BR" ? "🇧🇷 Brasil" : "🇺🇸 EUA"} <X className="size-2.5" />
                </Badge>
              )}
              {tagFilter !== "all" && (
                <Badge variant="secondary" className="text-[10px] gap-1 cursor-pointer" onClick={() => setTagFilter("all")}>
                  {tagFilter} <X className="size-2.5" />
                </Badge>
              )}
            </div>
          )}
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}
        </div>
      )}

      {error && (
        <div className="text-center py-12">
          <span className="material-symbols-outlined text-[48px] text-danger mb-4">error</span>
          <p className="text-danger font-bold">Erro ao carregar assinaturas</p>
          <p className="text-text-secondary text-sm mt-1">{(error as Error).message}</p>
        </div>
      )}

      {!isLoading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtered.map((sub) => (
            <SubscriptionCard
              key={sub.code}
              subscription={sub}
              status={sub.mappedStatus}
              daysRemaining={sub.daysRemaining}
              daysExpired={sub.daysExpired}
              progressPercent={sub.progressPercent}
              formattedStart={sub.formattedStart}
              formattedEnd={sub.formattedEnd}
              onRenew={() => handleRenew(sub)}
              isRenewing={renewingCode === sub.code}
              profileTag={sub.profile_tag}
            />
          ))}
        </div>
      )}

      {!isLoading && !error && filtered.length === 0 && (
        <div className="text-center py-12">
          <span className="material-symbols-outlined text-[48px] text-text-secondary mb-4">inbox</span>
          <p className="text-text-secondary">Nenhuma assinatura encontrada com este filtro.</p>
        </div>
      )}

      {/* CTA */}
      <div className="w-full rounded-2xl glass-card border border-primary/20 p-8 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
        <div className="flex flex-col gap-3 z-10">
          <h2 className="text-2xl font-bold text-foreground">Precisa de mais performance?</h2>
          <p className="text-text-secondary max-w-xl">Nossos novos planos de Proxy Residencial Rotativo oferecem IPs limpos e alta velocidade.</p>
        </div>
        <a href="/loja" className="z-10 whitespace-nowrap bg-primary hover:bg-[#00c968] text-background h-12 px-8 rounded-xl text-base font-bold transition-all shadow-lg hover:shadow-primary/20 flex items-center">
          Conhecer Novos Planos
        </a>
      </div>
    </div>
  );
}

/* ─── SAFE BM PANEL (for users who purchased BM Safe) ─── */
function SafeBmPanel() {
  const navigate = useNavigate();
  const [vaults, setVaults] = useState<any[]>([]);
  const [bmTracking, setBmTracking] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const [vaultsRes, bmTrackingRes] = await Promise.all([
        supabase
          .from("safe_bm_vaults" as any)
          .select("*")
          .eq("user_id", user.id),
        supabase
          .from("bm_tracking")
          .select("id, product_name, bm_link, status")
          .eq("client_user_id", user.id)
          .in("status", ["active", "em_estoque"]),
      ]);
      setVaults(vaultsRes.data || []);
      setBmTracking(bmTrackingRes.data || []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="space-y-4">{[1, 2].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;

  // Case 1: User has active vaults → show vault summary + link to full dashboard
  if (vaults.length > 0) {
    return (
      <div className="space-y-6">
        <div className="glass-panel rounded-xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <p className="text-text-secondary text-xs uppercase font-semibold tracking-wider">Cofres Ativos</p>
            <p className="text-foreground text-2xl font-bold">{vaults.length} BM{vaults.length !== 1 ? "s" : ""} protegida{vaults.length !== 1 ? "s" : ""}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vaults.map((v: any) => (
            <div key={v.id} className="glass-card rounded-xl p-5 border border-glass-border hover:border-primary/30 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Shield className="size-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">
                    {v.bm_name || "BM Protegida"}
                    {(() => {
                      const digits = (v.bm_link || "").match(/\d{4,}/g) as string[] | null;
                      const longest = digits?.sort((a, b) => b.length - a.length)[0];
                      return longest ? <span className="text-muted-foreground font-mono"> ····{longest.slice(-4)}</span> : null;
                    })()}
                  </p>
                  <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-500 border-green-500/20">Protegido</Badge>
                </div>
              </div>
            </div>
          ))}
        </div>

        <a
          href="/safe-bm"
          className="block w-full rounded-xl glass-panel border border-primary/20 p-5 hover:border-primary/40 transition-all group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="size-5 text-primary" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Acessar Painel Safe BM</h3>
                <p className="text-xs text-muted-foreground">Painel completo das suas BMs protegidas</p>
              </div>
            </div>
            <span className="text-primary group-hover:translate-x-1 transition-transform">→</span>
          </div>
        </a>
      </div>
    );
  }

  // Case 2: No vaults, but user has BMs in bm_tracking → show "aguarde" state
  if (bmTracking.length > 0) {
    return (
      <div className="space-y-6">
        <Card className="bg-gradient-to-br from-primary/5 via-card to-card border-primary/20 overflow-hidden relative">
          <CardContent className="p-8 md:p-10">
            <div className="flex flex-col items-center text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse">
                <Shield className="size-8 text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-foreground">Aguarde, estamos protegendo suas BMs</h2>
                <p className="text-muted-foreground max-w-lg">
                  Identificamos <strong className="text-foreground">{bmTracking.length} BM{bmTracking.length !== 1 ? "s" : ""}</strong> vinculada{bmTracking.length !== 1 ? "s" : ""} à sua conta. 
                  Nossa equipe está configurando a blindagem de cada uma. Você será notificado assim que a proteção estiver ativa.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md">
                {bmTracking.slice(0, 4).map((bm: any) => (
                  <div key={bm.id} className="glass-card rounded-xl p-4 border border-glass-border text-left">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                        <Shield className="size-4 text-amber-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {bm.product_name}
                          {(() => {
                            const digits = (bm.bm_link || "").match(/\d{4,}/g) as string[] | null;
                            const longest = digits?.sort((a, b) => b.length - a.length)[0];
                            return longest ? <span className="text-muted-foreground font-mono"> ····{longest.slice(-4)}</span> : null;
                          })()}
                        </p>
                        <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-500 border-amber-500/20 mt-0.5">
                          Configurando
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {bmTracking.length > 4 && (
                <p className="text-xs text-muted-foreground">+ {bmTracking.length - 4} outra{bmTracking.length - 4 !== 1 ? "s" : ""} BM{bmTracking.length - 4 !== 1 ? "s" : ""}</p>
              )}

              <div className="rounded-xl bg-accent/10 border border-accent/20 p-4 max-w-md w-full">
                <div className="flex items-center gap-2 text-xs text-accent-foreground">
                  <Zap className="size-4 flex-shrink-0" />
                  <span>A configuração geralmente leva até <strong>24 horas</strong>. Fique tranquilo!</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Case 3: No vaults, no BMs in tracking → BM not bought with us, let user configure
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
        <Shield className="text-primary size-6" />
      </div>
      <h2 className="text-xl font-bold text-foreground mb-2">Configure seu cofre Safe BM</h2>
      <p className="text-text-secondary text-sm text-center max-w-md mb-6">
        Sua BM não foi identificada em nosso sistema. Configure seu cofre manualmente para ativar a proteção com backup automático.
      </p>
      <Button
        onClick={() => navigate("/safe-bm")}
        className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
      >
        <Shield className="size-4" />
        Configurar Cofre
      </Button>
    </div>
  );
}

/* ─── CONTINGÊNCIA TOTAL PANEL ─── */
function ContingenciaPanel() {
  const [client, setClient] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [availablePlans, setAvailablePlans] = useState<any[]>([]);
  const [checkoutPlan, setCheckoutPlan] = useState<any | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const [ctClientRes, plansRes] = await Promise.all([
        supabase
          .from("ct_clients")
          .select("*, ct_plans:plan_id(*)")
          .eq("user_id", user.id)
          .in("status", ["ativo", "suspenso", "pendente", "inadimplente"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("ct_plans")
          .select("*")
          .eq("active", true)
          .order("price", { ascending: true }),
      ]);

      if (ctClientRes.data) {
        setClient(ctClientRes.data);
        setPlan((ctClientRes.data as any).ct_plans);

        const { data: ctItems } = await supabase
          .from("ct_items")
          .select("*")
          .eq("ct_client_id", ctClientRes.data.id);
        setItems(ctItems || []);
      }

      setAvailablePlans(plansRes.data || []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;

  if (!client) {
    const isPopular = (p: any) => p.tier === "black";

    return (
      <div className="space-y-8 animate-fade-in">
        {/* Hero */}
        <Card className="bg-gradient-to-br from-primary/5 via-card to-card border-primary/20 overflow-hidden relative">
          <CardContent className="p-8 md:p-10">
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Layers className="size-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Scale Pro</h2>
                  <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] mt-1">Estrutura Completa</Badge>
                </div>
              </div>

              <p className="text-muted-foreground leading-relaxed max-w-2xl">
                Pare de comprar itens avulsos e perder dinheiro com blocks. Com a <strong className="text-foreground">Scale Pro</strong>, 
                você aluga uma estrutura completa com <strong className="text-foreground">reposição garantida</strong>. 
                Se algo cair, a gente repõe — sem custo extra dentro do seu plano.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { icon: ShieldCheck, text: "Reposição garantida inclusa no plano" },
                  { icon: Zap, text: "Estrutura pronta para operar imediatamente" },
                  { icon: Lock, text: "Sem risco: itens repostos sem custo adicional" },
                  { icon: Layers, text: "Perfis + Proxies + BMs + Contas integrados" },
                ].map((f, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <f.icon className="size-3.5 text-primary" />
                    </div>
                    {f.text}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Comparativo */}
        <div className="glass-card rounded-xl border border-glass-border p-6">
          <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">compare_arrows</span>
            Por que assinar ao invés de comprar avulso?
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 space-y-2">
              <p className="text-sm font-bold text-destructive flex items-center gap-2">
                <span className="material-symbols-outlined text-base">close</span>
                Compra Avulsa
              </p>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li>• Cada block = novo custo de reposição</li>
                <li>• Sem garantia de reposição rápida</li>
                <li>• Estrutura fragmentada e instável</li>
                <li>• Gasto imprevisível todo mês</li>
              </ul>
            </div>
            <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 space-y-2">
              <p className="text-sm font-bold text-green-500 flex items-center gap-2">
                <span className="material-symbols-outlined text-base">check</span>
                Scale Pro
              </p>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li>• Reposição inclusa sem custo extra</li>
                <li>• Estrutura sempre pronta e integrada</li>
                <li>• Suporte prioritário para assinantes</li>
                <li>• Valor fixo mensal, sem surpresas</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Plans from DB */}
        {availablePlans.length > 0 && (
          <div className={`grid grid-cols-1 ${availablePlans.length >= 2 ? "md:grid-cols-2" : ""} ${availablePlans.length >= 3 ? "lg:grid-cols-3" : ""} gap-5`}>
            {availablePlans.map((p) => {
              const popular = isPopular(p);
              const features = [
                `${p.profiles_qty} Perfis`,
                `${p.proxies_qty} Proxies dedicados`,
                `${p.bms_qty} BMs verificadas`,
                `${p.accounts_qty} Contas aquecidas`,
                `${p.replacements_qty} reposições/mês`,
              ];
              if (popular) features.push("Suporte prioritário");

              return (
                <div
                  key={p.id}
                  className={`relative glass-card rounded-2xl p-6 border transition-all hover:scale-[1.01] ${
                    popular ? "border-primary/40 shadow-lg shadow-primary/10" : "border-glass-border"
                  }`}
                >
                  {popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider rounded-full">
                      Mais Popular
                    </div>
                  )}
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${popular ? "bg-primary/15" : "bg-muted"}`}>
                      <Layers className={`size-5 ${popular ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground">{p.name}</h3>
                      <p className="text-xs text-muted-foreground capitalize">{p.tier}</p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <span className="text-3xl font-black text-foreground">
                      R$ {Number(p.price).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
                    </span>
                    <span className="text-sm text-muted-foreground">/mês</span>
                  </div>

                  <ul className="space-y-2 mb-6">
                    {features.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <ShieldCheck className="size-3.5 text-green-500 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>

                  <Button
                    className={`w-full gap-2 font-bold ${popular ? "bg-primary hover:bg-primary/90 text-primary-foreground" : ""}`}
                    variant={popular ? "default" : "outline"}
                    onClick={() => setCheckoutPlan(p)}
                  >
                    <Zap className="size-4" />
                    Assinar {p.name}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {/* CTA final */}
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground">
            Dúvidas? Fale com nosso time pelo{" "}
            <a href="https://wa.me/5511999999999" target="_blank" rel="noopener" className="text-primary hover:underline font-semibold">
              WhatsApp
            </a>{" "}
            ou abra um{" "}
            <a href="/suporte" className="text-primary hover:underline font-semibold">ticket de suporte</a>.
          </p>
        </div>

        <CTCheckoutModal
          plan={checkoutPlan}
          open={!!checkoutPlan}
          onClose={() => setCheckoutPlan(null)}
        />
      </div>
    );
  }

  const perfis = items.filter(i => i.type === "perfil");
  const proxies = items.filter(i => i.type === "proxy");
  const bms = items.filter(i => i.type === "bm");
  const contas = items.filter(i => i.type === "conta");
  const activeItems = items.filter(i => i.status === "ativo").length;
  const blockedItems = items.filter(i => i.status === "block").length;

  const itemGroups = [
    { label: "Perfis", count: perfis.length, active: perfis.filter(i => i.status === "ativo").length, icon: "👤" },
    { label: "Proxies", count: proxies.length, active: proxies.filter(i => i.status === "ativo").length, icon: "🌐" },
    { label: "BMs", count: bms.length, active: bms.filter(i => i.status === "ativo").length, icon: "🏢" },
    { label: "Contas", count: contas.length, active: contas.filter(i => i.status === "ativo").length, icon: "📊" },
  ];

  return (
    <div className="space-y-6">
      {client.status !== "ativo" && (
        <a
          href="/contingencia"
          className="block w-full rounded-xl border border-red-500/30 bg-red-500/5 p-5 hover:border-red-500/60 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-red-400 text-2xl">error</span>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-foreground">Mensalidade pendente</h2>
              <p className="text-xs text-muted-foreground mt-1">
                {plan?.name || "Scale Pro"} · R$ {Number(client.monthly_value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês
                {client.next_billing ? ` · Vencimento ${format(parseISO(client.next_billing), "dd/MM/yyyy")}` : ""}
              </p>
              <p className="text-xs text-red-400 mt-2 font-semibold">Pagar agora com saldo da carteira →</p>
            </div>
          </div>
        </a>
      )}
      {/* Compact summary + entry to the full panel (single source of truth) */}
      <a
        href="/contingencia"
        className={`block w-full rounded-xl glass-card border p-5 hover:border-primary/40 transition-all group ${
          blockedItems > 0 ? "border-yellow-500/30 bg-yellow-500/5" : "border-green-500/30 bg-green-500/5"
        }`}
      >
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              blockedItems > 0 ? "bg-yellow-500/10" : "bg-green-500/10"
            }`}
          >
            {blockedItems > 0 ? (
              <span className="material-symbols-outlined text-yellow-500 text-2xl">warning</span>
            ) : (
              <ShieldCheck className="size-6 text-green-500" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-foreground">
                {blockedItems > 0 ? `${blockedItems} item(ns) com block` : "Estrutura 100% ativa"}
              </h2>
              <Badge
                variant="outline"
                className={`text-[10px] ${
                  plan?.tier === "black"
                    ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                    : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                }`}
              >
                {plan?.name || "—"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {activeItems}/{items.length} itens operacionais · R$ {Number(client.monthly_value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês
              {client.next_billing ? ` · Próx. ${format(parseISO(client.next_billing), "dd/MM/yyyy")}` : ""}
            </p>
            <p className="text-xs text-primary mt-2 font-medium">
              Acessar Painel Completo <span className="group-hover:translate-x-1 inline-block transition-transform">→</span>
            </p>
          </div>
          <Layers className="size-5 text-primary shrink-0" />
        </div>
      </a>
    </div>
  );
}
