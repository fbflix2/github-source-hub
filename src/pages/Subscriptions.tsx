import { useState, useEffect } from "react";
import { useProxyBRSubscriptions, useRenewSubscription } from "@/hooks/useProxyBR";
import { useWebshareSubscriptions, useMigrateProxyBRToWebshare } from "@/hooks/useWebshare";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { differenceInDays, parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import SubscriptionCard from "@/components/subscriptions/SubscriptionCard";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Shield } from "lucide-react";

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

export default function Subscriptions() {
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

  const filtered = enriched.filter((s) => {
    if (activeFilter === "all") return true;
    return s.mappedStatus === activeFilter;
  });

  const handleRenew = (sub: ProxySubscription & { mappedStatus: SubscriptionStatus }) => {
    // For expired/cancelled ProxyBR subs → migrate to Webshare silently
    const isProxyBR = !sub.provider || sub.provider === "proxybr";
    const isExpiredOrCancelled = sub.mappedStatus === "expired" || sub.mappedStatus === "cancelled";
    
    if (isProxyBR && isExpiredOrCancelled) {
      migrateMutation.mutate(sub.name);
    } else {
      renewMutation.mutate(sub.name);
    }
  };

  // Show CTA when user has no subscriptions
  if (!isLoading && !error && subscriptions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
          <span className="material-symbols-outlined text-primary text-[32px]">vpn_lock</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight text-center mb-3">
          Você ainda não possui assinaturas
        </h1>
        <p className="text-text-secondary text-base text-center max-w-md mb-8">
          Conheça nossos planos de proxy residencial e comece a navegar com segurança e velocidade.
        </p>
        <a
          href="/loja?filter=Proxy"
          className="bg-primary hover:bg-[#00c968] text-background h-12 px-8 rounded-xl text-base font-bold transition-all shadow-glow hover:shadow-glow-lg flex items-center gap-2"
        >
          <span className="material-symbols-outlined">shopping_cart</span>
          Ver Planos de Proxy
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight">Minhas Assinaturas</h1>
          <p className="text-text-secondary text-base">Gerencie seus planos de proxy e renovações automáticas.</p>
        </div>
        <a
          href="/loja"
          className="bg-primary hover:bg-[#00c968] text-background h-11 px-6 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-glow hover:shadow-glow-lg"
        >
          <span className="material-symbols-outlined">add_shopping_cart</span>
          Nova Assinatura
        </a>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel rounded-xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500">
            <span className="material-symbols-outlined">verified</span>
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
                activeFilter === f.key
                  ? "border-primary"
                  : f.isWarning
                  ? "border-transparent hover:border-danger/50"
                  : "border-transparent hover:border-glass-border"
              }`}
            >
              <span
                className={`text-sm font-medium transition-colors ${
                  activeFilter === f.key
                    ? "text-foreground font-bold"
                    : f.isWarning
                    ? "text-text-secondary group-hover:text-danger"
                    : "text-text-secondary group-hover:text-foreground"
                }`}
              >
                {f.label}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                  activeFilter === f.key
                    ? "bg-primary/20 text-primary"
                    : f.isWarning
                    ? "bg-danger/10 text-danger"
                    : "bg-muted text-text-secondary group-hover:text-foreground"
                }`}
              >
                {f.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-72 rounded-2xl" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-center py-12">
          <span className="material-symbols-outlined text-[48px] text-danger mb-4">error</span>
          <p className="text-danger font-bold">Erro ao carregar assinaturas</p>
          <p className="text-text-secondary text-sm mt-1">{(error as Error).message}</p>
        </div>
      )}

      {/* Subscription Cards Grid */}
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

      {/* Safe BM Section */}
      <SafeBmClientSection />

      {/* CTA Banner */}
      <div className="w-full mt-8 rounded-2xl glass-card border border-primary/20 p-8 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
        <div className="flex flex-col gap-3 z-10">
          <h2 className="text-2xl font-bold text-foreground">Precisa de mais performance?</h2>
          <p className="text-text-secondary max-w-xl">
            Nossos novos planos de Proxy Residencial Rotativo oferecem IPs limpos e alta velocidade para suas operações.
          </p>
        </div>
        <a
          href="/loja"
          className="z-10 whitespace-nowrap bg-primary hover:bg-[#00c968] text-background h-12 px-8 rounded-xl text-base font-bold transition-all shadow-lg hover:shadow-primary/20 flex items-center"
        >
          Conhecer Novos Planos
        </a>
      </div>

    </div>
  );
}

function SafeBmClientSection() {
  const [hasVaults, setHasVaults] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { count } = await supabase
        .from("safe_bm_vaults" as any)
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      setHasVaults((count || 0) > 0);
      setLoading(false);
    })();
  }, []);

  if (loading) return <Skeleton className="h-20 rounded-xl" />;
  if (!hasVaults) return null;

  return (
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
            <h3 className="text-base font-bold text-foreground">Safe BM — Cofre de Backup</h3>
            <p className="text-xs text-muted-foreground">Acesse o painel completo das suas BMs protegidas</p>
          </div>
        </div>
        <span className="text-primary group-hover:translate-x-1 transition-transform">→</span>
      </div>
    </a>
  );
}
