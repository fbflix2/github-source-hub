import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useProxyBRSubscriptions, useRenewSubscription } from "@/hooks/useProxyBR";
import { useWebshareSubscriptions, useMigrateProxyBRToWebshare } from "@/hooks/useWebshare";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { differenceInDays, parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import SubscriptionCard from "@/components/subscriptions/SubscriptionCard";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Shield, Globe, ShieldCheck, Layers } from "lucide-react";
import { Progress } from "@/components/ui/progress";

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

const categoryTabs: { key: SubscriptionCategory; label: string; icon: React.ReactNode }[] = [
  { key: "proxies", label: "Proxies", icon: <Globe className="size-4" /> },
  { key: "safebm", label: "Safe BM", icon: <Shield className="size-4" /> },
  { key: "contingencia", label: "Contingência Total", icon: <Layers className="size-4" /> },
];

export default function Subscriptions() {
  const [activeCategory, setActiveCategory] = useState<SubscriptionCategory>("proxies");

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
            onClick={() => setActiveCategory(tab.key)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap border ${
              activeCategory === tab.key
                ? "bg-primary/10 text-primary border-primary/30 shadow-sm"
                : "bg-card/50 text-text-secondary border-glass-border hover:bg-card hover:text-foreground"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content based on active category */}
      {activeCategory === "proxies" && <ProxiesPanel />}
      {activeCategory === "safebm" && <SafeBmPanel />}
      {activeCategory === "contingencia" && <ContingenciaPanel />}
    </div>
  );
}

/* ─── PROXIES PANEL ─── */
function ProxiesPanel() {
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const { data: subscriptionsRaw, isLoading: proxyLoading, error: proxyError } = useProxyBRSubscriptions();
  const { data: webshareRaw, isLoading: wsLoading, error: wsError } = useWebshareSubscriptions();
  const renewMutation = useRenewSubscription();
  const migrateMutation = useMigrateProxyBRToWebshare();

  const isLoading = proxyLoading || wsLoading;
  const error = proxyError || wsError;

  const proxyBRSubs: ProxySubscription[] = Array.isArray(subscriptionsRaw) ? subscriptionsRaw : [];
  const webshareSubs: ProxySubscription[] = Array.isArray(webshareRaw) ? webshareRaw : [];
  const subscriptions = [...proxyBRSubs, ...webshareSubs];

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

  const filtered = enriched.filter((s) => activeFilter === "all" || s.mappedStatus === activeFilter);

  const handleRenew = (sub: ProxySubscription & { mappedStatus: SubscriptionStatus }) => {
    const isProxyBR = !sub.provider || sub.provider === "proxybr";
    const isExpiredOrCancelled = sub.mappedStatus === "expired" || sub.mappedStatus === "cancelled";
    if (isProxyBR && isExpiredOrCancelled) {
      migrateMutation.mutate(sub.name);
    } else {
      renewMutation.mutate(sub.name);
    }
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

      {/* Filters */}
      <div className="border-b border-glass-border">
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
              isRenewing={renewMutation.isPending || migrateMutation.isPending}
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

/* ─── SAFE BM PANEL ─── */
function SafeBmPanel() {
  const [vaults, setVaults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from("safe_bm_vaults" as any)
        .select("*")
        .eq("user_id", user.id);
      setVaults(data || []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="space-y-4">{[1, 2].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;

  if (vaults.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
          <Shield className="text-primary size-6" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Configure seu cofre Safe BM</h2>
        <p className="text-text-secondary text-sm text-center max-w-md mb-6">Adicione suas BMs ao cofre para ativar a proteção com backup automático e acesso seguro.</p>
        <a href="/safe-bm" className="bg-primary hover:bg-[#00c968] text-background h-11 px-6 rounded-xl text-sm font-bold transition-all shadow-glow flex items-center gap-2">
          <Shield className="size-4" />
          Configurar Cofre
        </a>
      </div>
    );
  }

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
                <p className="text-sm font-bold text-foreground">{v.bm_name || "BM Protegida"}</p>
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

/* ─── CONTINGÊNCIA TOTAL PANEL ─── */
function ContingenciaPanel() {
  const [client, setClient] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: ctClient } = await supabase
        .from("ct_clients")
        .select("*, ct_plans:plan_id(*)")
        .eq("user_id", user.id)
        .eq("status", "ativo")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ctClient) {
        setClient(ctClient);
        setPlan((ctClient as any).ct_plans);

        const { data: ctItems } = await supabase
          .from("ct_items")
          .select("*")
          .eq("ct_client_id", ctClient.id);
        setItems(ctItems || []);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
          <Layers className="text-primary size-6" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Nenhuma assinatura de Contingência</h2>
        <p className="text-text-secondary text-sm text-center max-w-md mb-6">Locação de estrutura completa (Perfis, Proxies, BMs e Contas) para suas operações.</p>
        <a href="/contingencia" className="bg-primary hover:bg-[#00c968] text-background h-11 px-6 rounded-xl text-sm font-bold transition-all shadow-glow flex items-center gap-2">
          <Layers className="size-4" />
          Saiba Mais
        </a>
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
      {/* Status Hero */}
      <div className={`glass-card rounded-xl p-6 border ${blockedItems > 0 ? "border-yellow-500/30 bg-yellow-500/5" : "border-green-500/30 bg-green-500/5"}`}>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${blockedItems > 0 ? "bg-yellow-500/10" : "bg-green-500/10"}`}>
            {blockedItems > 0 ? (
              <span className="material-symbols-outlined text-yellow-500 text-2xl">warning</span>
            ) : (
              <ShieldCheck className="size-6 text-green-500" />
            )}
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">
              {blockedItems > 0 ? `${blockedItems} item(ns) com block` : "Estrutura 100% ativa"}
            </h2>
            <p className="text-sm text-text-secondary">{activeItems}/{items.length} itens operacionais</p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel rounded-xl p-4">
          <p className="text-text-secondary text-xs uppercase font-semibold tracking-wider mb-1">Plano</p>
          <p className="text-foreground text-sm font-bold">{plan?.name || "—"}</p>
          <Badge variant="outline" className={`mt-1 text-[10px] ${plan?.tier === "black" ? "bg-purple-500/10 text-purple-400 border-purple-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20"}`}>
            {plan?.tier?.toUpperCase() || "—"}
          </Badge>
        </div>
        <div className="glass-panel rounded-xl p-4">
          <p className="text-text-secondary text-xs uppercase font-semibold tracking-wider mb-1">Valor Mensal</p>
          <p className="text-foreground text-lg font-bold">R$ {Number(client.monthly_value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="glass-panel rounded-xl p-4">
          <p className="text-text-secondary text-xs uppercase font-semibold tracking-wider mb-1">Próx. Cobrança</p>
          <p className="text-foreground text-sm font-bold">{client.next_billing ? format(parseISO(client.next_billing), "dd/MM/yyyy") : "—"}</p>
        </div>
        <div className="glass-panel rounded-xl p-4">
          <p className="text-text-secondary text-xs uppercase font-semibold tracking-wider mb-1">Total Itens</p>
          <p className="text-foreground text-lg font-bold">{items.length}</p>
        </div>
      </div>

      {/* Item Groups */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {itemGroups.map((g) => (
          <div key={g.label} className="glass-card rounded-xl p-4 border border-glass-border">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{g.icon}</span>
              <p className="text-sm font-bold text-foreground">{g.label}</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{g.active}<span className="text-text-secondary text-sm font-normal">/{g.count}</span></p>
            <Progress value={g.count > 0 ? (g.active / g.count) * 100 : 0} className="h-1.5 mt-2" />
          </div>
        ))}
      </div>

      {/* Link to full panel */}
      <a
        href="/contingencia"
        className="block w-full rounded-xl glass-panel border border-primary/20 p-5 hover:border-primary/40 transition-all group"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Layers className="size-5 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Acessar Painel Completo</h3>
              <p className="text-xs text-muted-foreground">Reposições, tickets, estrutura detalhada e mais</p>
            </div>
          </div>
          <span className="text-primary group-hover:translate-x-1 transition-transform">→</span>
        </div>
      </a>
    </div>
  );
}
