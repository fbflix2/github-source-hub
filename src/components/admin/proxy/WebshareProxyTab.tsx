import { useState } from "react";
import { useWebsharePlan, useWebshareProxyList } from "@/hooks/useWebshare";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Globe, Server, Wifi, ChevronLeft, ChevronRight, Copy, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function WebshareProxyTab() {
  const [page, setPage] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const pageSize = 25;

  const { data: planData, isLoading: planLoading, refetch: refetchPlan } = useWebsharePlan();
  const { data: proxyData, isLoading: proxyLoading, refetch: refetchProxies } = useWebshareProxyList(page, pageSize);

  const isLoading = planLoading || proxyLoading;
  const subscription = planData?.subscription;
  const plan = planData?.plan;
  const proxies = proxyData?.results || [];
  const totalProxies = proxyData?.count || 0;
  const totalPages = Math.ceil(totalProxies / pageSize);

  const copyProxy = (proxy: any) => {
    const str = `${proxy.proxy_address}:${proxy.port}:${proxy.username}:${proxy.password}`;
    navigator.clipboard.writeText(str);
    setCopiedId(proxy.id);
    toast.success("Proxy copiado!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => { refetchPlan(); refetchProxies(); }} disabled={isLoading}>
          <RefreshCw className={`size-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />Atualizar
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-blue-500/10">
              <Server className="size-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Proxies</p>
              {planLoading ? <Skeleton className="h-6 w-10" /> : (
                <p className="text-xl font-bold text-foreground">{plan?.proxy_count || totalProxies}</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-green-500/10">
              <Wifi className="size-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tipo</p>
              {planLoading ? <Skeleton className="h-6 w-16" /> : (
                <p className="text-xl font-bold text-foreground capitalize">{plan?.proxy_type || "—"}</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-purple-500/10">
              <Globe className="size-5 text-purple-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Plano</p>
              {planLoading ? <Skeleton className="h-6 w-20" /> : (
                <div>
                  <p className="text-sm font-bold text-foreground capitalize">{plan?.proxy_subtype || "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {subscription?.term === "yearly" ? "Anual" : "Mensal"} • ${plan?.monthly_price?.toFixed(2) || "0"}/mês
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subscription Info */}
      {subscription && (
        <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-4 flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Renovação: </span>
              <Badge variant={subscription.renewals_enabled ? "default" : "secondary"}>
                {subscription.renewals_enabled ? "Ativa" : "Desativada"}
              </Badge>
            </div>
            <div>
              <span className="text-muted-foreground">Início: </span>
              <span className="text-foreground">{new Date(subscription.start_date).toLocaleDateString("pt-BR")}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Vencimento: </span>
              <span className="text-foreground">{new Date(subscription.end_date).toLocaleDateString("pt-BR")}</span>
            </div>
            {subscription.paused && (
              <Badge variant="destructive">Pausada</Badge>
            )}
            <div>
              <span className="text-muted-foreground">Bandwidth: </span>
              <span className="text-foreground">{plan?.bandwidth_limit ? `${plan.bandwidth_limit} GB` : "Ilimitado"}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Proxy Table */}
      <Card className="border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/30">
                <TableHead>#</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Porta</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>País</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proxyLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-border/20">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-16" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : proxies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum proxy encontrado na conta Webshare
                  </TableCell>
                </TableRow>
              ) : (
                proxies.map((proxy: any, i: number) => (
                  <TableRow key={proxy.id} className="border-border/20">
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {(page - 1) * pageSize + i + 1}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-foreground">
                      {proxy.proxy_address || "backbone"}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">{proxy.port}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{proxy.username}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {proxy.country_code || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={proxy.valid ? "default" : "destructive"} className="text-xs">
                        {proxy.valid ? "Online" : "Offline"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => copyProxy(proxy)}
                      >
                        {copiedId === proxy.id ? (
                          <CheckCircle2 className="size-3.5 text-green-500" />
                        ) : (
                          <Copy className="size-3.5" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border/30">
            <p className="text-xs text-muted-foreground">
              Página {page} de {totalPages} • {totalProxies} proxies
            </p>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="size-7" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" className="size-7" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
