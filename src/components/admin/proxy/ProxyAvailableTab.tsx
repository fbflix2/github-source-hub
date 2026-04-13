import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { callWebshare } from "@/hooks/useWebshare";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy, Check, Search, ChevronLeft, ChevronRight, Server, RefreshCw, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const PAGE_SIZE = 25;
const ACTIVE_STATUSES = ["active", "expiring"] as const;

type ProxyRecord = {
  id: string | number;
  proxy_address?: string;
  port?: string | number;
  username?: string;
  password?: string;
  country_code?: string;
  valid?: boolean;
};

type WebshareSubscription = {
  id: string;
  status: string;
  end_date: string | null;
  raw_data: Record<string, any> | null;
};

type SubscriptionRow = {
  id: string;
  status: string;
  end_date: string | null;
  raw_data: unknown;
};

const normalizeProxyId = (value: unknown) => String(value ?? "").trim();

const isStillOccupying = (subscription: WebshareSubscription) => {
  const proxyId = normalizeProxyId(subscription.raw_data?.webshare_proxy_id);
  if (!proxyId) return false;
  if (!subscription.end_date) return true;
  return new Date(subscription.end_date).getTime() >= Date.now();
};

export default function ProxyAvailableTab() {
  const { isAdmin, loading: authLoading } = useAdminAuth();
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [brPage, setBrPage] = useState(1);
  const [usPage, setUsPage] = useState(1);
  const canLoad = isAdmin === true && !authLoading;

  // Fetch all proxies from Webshare API
  const {
    data: allProxies = [],
    isLoading: proxyLoading,
    error: proxyError,
    refetch: refetchProxies,
  } = useQuery<ProxyRecord[]>({
    queryKey: ["webshare-available-all-proxies", "direct"],
    enabled: canLoad,
    queryFn: async () => {
      const response = await callWebshare("get-all-proxies", { mode: "direct" });
      if (!response) {
        throw new Error("Sessão administrativa ainda não foi carregada.");
      }

      const proxies = response?.data || response?.results || (Array.isArray(response) ? response : []);
      return (Array.isArray(proxies) ? proxies : []).filter((proxy): proxy is ProxyRecord => {
        return Boolean(proxy?.proxy_address) && proxy.valid !== false;
      });
    },
    staleTime: 300_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // Fetch ACTIVE sold proxy IDs only (active/expiring status)
  const {
    data: wsSubs = [],
    isLoading: subsLoading,
    error: subsError,
    refetch: refetchSubs,
  } = useQuery<WebshareSubscription[]>({
    queryKey: ["webshare-active-subs-for-available-v2"],
    enabled: canLoad,
    queryFn: async () => {
      let all: WebshareSubscription[] = [];
      let from = 0;
      const ps = 1000;

      while (true) {
        const { data, error } = await supabase
          .from("subscriptions")
          .select("id, status, end_date, raw_data")
          .eq("type", "webshare")
          .in("status", [...ACTIVE_STATUSES])
          .range(from, from + ps - 1);

        if (error) throw new Error(error.message);
        if (!data?.length) break;
        const normalizedRows = (data as SubscriptionRow[]).map((row) => ({
          id: row.id,
          status: row.status,
          end_date: row.end_date,
          raw_data: row.raw_data && typeof row.raw_data === "object" && !Array.isArray(row.raw_data)
            ? row.raw_data as Record<string, any>
            : null,
        }));

        all = [...all, ...normalizedRows];
        if (data.length < ps) break;
        from += ps;
      }

      return all.filter(isStillOccupying);
    },
    staleTime: 60_000,
    retry: 1,
  });

  const soldProxyIds = useMemo(() => {
    const ids = new Set<string>();
    wsSubs.forEach(s => {
      const proxyId = normalizeProxyId(s.raw_data?.webshare_proxy_id);
      if (proxyId) ids.add(proxyId);
    });
    return ids;
  }, [wsSubs]);

  const availableProxies = useMemo(() => {
    return allProxies.filter(proxy => !soldProxyIds.has(normalizeProxyId(proxy.id)));
  }, [allProxies, soldProxyIds]);

  const { br, us } = useMemo(() => {
    const term = search.toLowerCase();
    const filtered = !term
      ? availableProxies
      : availableProxies.filter(p =>
          (p.proxy_address || "").toLowerCase().includes(term) ||
          String(p.port || "").includes(term) ||
          (p.country_code || "").toLowerCase().includes(term)
        );
    return {
      br: filtered.filter(p => (p.country_code || "").toUpperCase() === "BR"),
      us: filtered.filter(p => (p.country_code || "").toUpperCase() === "US"),
    };
  }, [availableProxies, search]);

  useEffect(() => {
    const maxBrPages = Math.max(1, Math.ceil(br.length / PAGE_SIZE));
    const maxUsPages = Math.max(1, Math.ceil(us.length / PAGE_SIZE));

    if (brPage > maxBrPages) setBrPage(maxBrPages);
    if (usPage > maxUsPages) setUsPage(maxUsPages);
  }, [br.length, us.length, brPage, usPage]);

  const isLoading = authLoading || proxyLoading || subsLoading;
  const loadError = proxyError instanceof Error
    ? proxyError.message
    : subsError instanceof Error
      ? subsError.message
      : null;

  const copyProxy = (proxy: ProxyRecord) => {
    const str = `${proxy.proxy_address}:${proxy.port}:${proxy.username}:${proxy.password}`;
    navigator.clipboard.writeText(str);
    setCopiedId(String(proxy.id));
    toast.success("Proxy copiado!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const renderSection = (
    label: string,
    flag: string,
    proxies: ProxyRecord[],
    page: number,
    setPage: (p: number | ((prev: number) => number)) => void,
  ) => {
    const totalPages = Math.max(1, Math.ceil(proxies.length / PAGE_SIZE));
    const paginated = proxies.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{flag}</span>
          <h3 className="text-sm font-bold text-foreground">{label}</h3>
          <span className="text-xs text-muted-foreground">({proxies.length} disponíveis)</span>
        </div>

        {proxies.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">Nenhum proxy disponível</p>
        ) : (
          <>
            <div className="rounded-xl border border-border overflow-hidden bg-card/50">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs bg-muted/30">
                    <th className="text-left p-3">#</th>
                    <th className="text-left p-3">IP</th>
                    <th className="text-left p-3">Porta</th>
                    <th className="text-left p-3">Usuário</th>
                    <th className="text-left p-3 w-20">Copiar</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="border-b border-border/50">
                          {Array.from({ length: 5 }).map((_, j) => (
                            <td key={j} className="p-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                          ))}
                        </tr>
                      ))
                    : paginated.map((proxy, idx) => (
                        <tr key={proxy.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="p-3 text-xs text-muted-foreground">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                          <td className="p-3 font-mono text-xs text-foreground">{proxy.proxy_address}</td>
                          <td className="p-3 font-mono text-xs text-muted-foreground">{proxy.port}</td>
                          <td className="p-3 font-mono text-xs text-muted-foreground truncate max-w-[150px]">{proxy.username}</td>
                          <td className="p-3">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => copyProxy(proxy)}
                            >
                              {copiedId === String(proxy.id)
                                ? <Check className="w-3.5 h-3.5 text-primary" />
                                : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                            </Button>
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{proxies.length} proxies</p>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground">{page}/{totalPages}</span>
                  <Button size="sm" variant="ghost" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Refresh */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            refetchProxies();
            refetchSubs();
          }}
          disabled={authLoading}
        >
          <RefreshCw className={`size-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />Atualizar
        </Button>
      </div>

      {!canLoad && !authLoading && (
        <Card className="border-border/40 bg-card/60">
          <CardContent className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
            <AlertCircle className="size-4 text-destructive" />
            Sessão administrativa não encontrada para carregar os proxies da Webshare.
          </CardContent>
        </Card>
      )}

      {loadError && (
        <Card className="border-border/40 bg-card/60">
          <CardContent className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
            <AlertCircle className="size-4 text-destructive" />
            {loadError}
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/40 bg-card/60">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-primary/10">
              <Server className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Disponíveis</p>
              {isLoading ? <Skeleton className="h-6 w-10" /> : (
                <p className="text-xl font-bold text-foreground">{availableProxies.length}</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/60">
          <CardContent className="p-4 flex items-center gap-3">
            <span className="text-2xl">🇧🇷</span>
            <div>
              <p className="text-xs text-muted-foreground">Brasil Disponíveis</p>
              {isLoading ? <Skeleton className="h-6 w-10" /> : (
                <p className="text-xl font-bold text-foreground">{br.length}</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/60">
          <CardContent className="p-4 flex items-center gap-3">
            <span className="text-2xl">🇺🇸</span>
            <div>
              <p className="text-xs text-muted-foreground">EUA Disponíveis</p>
              {isLoading ? <Skeleton className="h-6 w-10" /> : (
                <p className="text-xl font-bold text-foreground">{us.length}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => { setSearch(e.target.value); setBrPage(1); setUsPage(1); }}
          placeholder="Buscar IP, porta..."
          className="pl-9 h-9 text-sm bg-card border-border"
        />
      </div>

      {/* BR Section */}
      {renderSection("Proxies Brasileiros", "🇧🇷", br, brPage, setBrPage)}

      {/* US Section */}
      {renderSection("Proxies Americanos", "🇺🇸", us, usPage, setUsPage)}
    </div>
  );
}
