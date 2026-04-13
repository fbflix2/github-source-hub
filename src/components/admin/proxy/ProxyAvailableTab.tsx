import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { callWebshare } from "@/hooks/useWebshare";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy, Check, Search, ChevronLeft, ChevronRight, Server, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const PAGE_SIZE = 25;

export default function ProxyAvailableTab() {
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [brPage, setBrPage] = useState(1);
  const [usPage, setUsPage] = useState(1);

  // Fetch all proxies from Webshare API
  const { data: allProxiesData, isLoading: proxyLoading, refetch: refetchProxies } = useQuery({
    queryKey: ["webshare-all-proxies", "direct"],
    queryFn: () => callWebshare("get-all-proxies", { mode: "direct" }),
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  });
  const allProxies: any[] = allProxiesData?.data || allProxiesData?.results || (Array.isArray(allProxiesData) ? allProxiesData : []);

  // Fetch sold proxy IDs - reuse same query key/shape as Dashboard for cache sharing
  const { data: wsSubs, isLoading: subsLoading } = useQuery({
    queryKey: ["webshare-revenue-subs"],
    queryFn: async () => {
      let all: any[] = [];
      let from = 0;
      const ps = 1000;
      while (true) {
        const { data } = await supabase
          .from("subscriptions")
          .select("id, name, status, end_date, start_date, raw_data, created_at, product_id, user_id")
          .eq("type", "webshare")
          .range(from, from + ps - 1);
        if (!data?.length) break;
        all = [...all, ...data];
        if (data.length < ps) break;
        from += ps;
      }
      return all;
    },
    staleTime: 60_000,
  });

  const soldProxyIds = useMemo(() => {
    if (!wsSubs) return new Set<number>();
    const ids = new Set<number>();
    wsSubs.forEach(s => {
      const raw = s.raw_data as any;
      if (raw?.webshare_proxy_id) ids.add(Number(raw.webshare_proxy_id));
    });
    return ids;
  }, [wsSubs]);

  const availableProxies = useMemo(() => {
    return allProxies.filter(p => !soldProxyIds.has(Number(p.id)));
  }, [allProxies, soldProxyIds]);

  const { br, us } = useMemo(() => {
    const term = search.toLowerCase();
    const filtered = !term
      ? availableProxies
      : availableProxies.filter(p =>
          (p.proxy_address || "").includes(term) ||
          String(p.port || "").includes(term) ||
          (p.country_code || "").toLowerCase().includes(term)
        );
    return {
      br: filtered.filter(p => (p.country_code || "").toUpperCase() === "BR"),
      us: filtered.filter(p => (p.country_code || "").toUpperCase() === "US"),
    };
  }, [availableProxies, search]);

  const isLoading = proxyLoading || subsLoading;

  const copyProxy = (proxy: any) => {
    const str = `${proxy.proxy_address}:${proxy.port}:${proxy.username}:${proxy.password}`;
    navigator.clipboard.writeText(str);
    setCopiedId(proxy.id);
    toast.success("Proxy copiado!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const renderSection = (
    label: string,
    flag: string,
    proxies: any[],
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
                              {copiedId === proxy.id
                                ? <Check className="w-3.5 h-3.5 text-green-400" />
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
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/40 bg-card/60">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-green-500/10">
              <Server className="size-5 text-green-500" />
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
