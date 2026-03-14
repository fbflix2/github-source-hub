import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWebsharePlan, useWebshareProxyList } from "@/hooks/useWebshare";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Globe, Server, Wifi, ChevronLeft, ChevronRight, Copy, CheckCircle2, TrendingUp, TrendingDown, DollarSign, ShoppingBag, Wallet } from "lucide-react";
import WebshareBandwidthCard from "./WebshareBandwidthCard";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Period = "7d" | "30d" | "90d" | "all";
const periodLabels: Record<Period, string> = { "7d": "7 dias", "30d": "30 dias", "90d": "90 dias", "all": "Todo período" };

function getPeriodDate(period: Period): string | null {
  if (period === "all") return null;
  const d = new Date();
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export default function WebshareProxyTab() {
  const [page, setPage] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("30d");
  const pageSize = 25;

  const { data: planData, isLoading: planLoading, refetch: refetchPlan } = useWebsharePlan();
  const { data: proxyData, isLoading: proxyLoading, refetch: refetchProxies } = useWebshareProxyList(page, pageSize);

  const isLoading = planLoading || proxyLoading;
  const subscription = planData?.subscription;
  const plan = planData?.plan;
  const proxies = proxyData?.results || [];
  const totalProxies = proxyData?.count || 0;
  const totalPages = Math.ceil(totalProxies / pageSize);

  // Fetch all webshare subscriptions (sold to clients)
  const { data: wsSubs } = useQuery({
    queryKey: ["webshare-revenue-subs"],
    queryFn: async () => {
      let all: any[] = [];
      let from = 0;
      const ps = 1000;
      while (true) {
        const { data } = await supabase
          .from("subscriptions")
          .select("name, status, end_date, raw_data, created_at, product_id")
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

  // Fetch products linked to webshare subscriptions by product_id
  const wsProductIds = useMemo(() => {
    if (!wsSubs) return [];
    const ids = new Set<string>();
    wsSubs.forEach(s => { if (s.product_id) ids.add(s.product_id); });
    return Array.from(ids);
  }, [wsSubs]);

  const { data: wsProducts } = useQuery({
    queryKey: ["webshare-revenue-products", wsProductIds],
    queryFn: async () => {
      if (wsProductIds.length === 0) return [];
      const { data } = await supabase
        .from("products")
        .select("id, name, price, tags")
        .in("id", wsProductIds);
      return data ?? [];
    },
    enabled: wsProductIds.length > 0,
    staleTime: 60_000,
  });

  // Fetch live USD→BRL exchange rate
  const { data: usdToBrl } = useQuery({
    queryKey: ["usd-brl-rate"],
    queryFn: async () => {
      try {
        const resp = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL");
        const data = await resp.json();
        return parseFloat(data?.USDBRL?.bid) || 5.5;
      } catch { return 5.5; }
    },
    staleTime: 600_000,
    refetchOnWindowFocus: false,
  });

  // Financial calculations
  const financials = useMemo(() => {
    if (!wsSubs || !wsProducts) return { totalRevenue: 0, totalCost: 0, totalProfit: 0, activeCount: 0, totalCount: 0, subsWithPrices: [] as any[] };

    const now = new Date();
    const activeSubs = wsSubs.filter(s => {
      if (s.status !== "active") return false;
      if (!s.end_date) return true;
      return new Date(s.end_date) >= now;
    });

    // Product price map
    const productPriceMap = new Map<string, number>();
    wsProducts.forEach(p => productPriceMap.set(p.id, p.price));

    // Monthly cost per proxy from webshare plan
    const monthlyPlanCost = plan?.monthly_price || 0;
    const totalPlanProxies = plan?.proxy_count || totalProxies || 1;
    const rate = usdToBrl || 5.5;
    const costPerProxyBRL = totalPlanProxies > 0 ? (monthlyPlanCost / totalPlanProxies) * rate : 0;

    let totalRevenue = 0;
    let totalCost = 0;

    const subsWithPrices = activeSubs.map(sub => {
      const salePrice = sub.product_id && productPriceMap.has(sub.product_id)
        ? productPriceMap.get(sub.product_id)!
        : 0;
      totalRevenue += salePrice;
      totalCost += costPerProxyBRL;
      return { ...sub, price: salePrice, unitCost: costPerProxyBRL };
    });

    return {
      totalRevenue,
      totalCost,
      totalProfit: totalRevenue - totalCost,
      activeCount: activeSubs.length,
      totalCount: wsSubs.length,
      subsWithPrices,
    };
  }, [wsSubs, wsProducts, plan, totalProxies, usdToBrl]);

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
      <div className="flex items-center justify-between">
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(periodLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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


      {/* Financial Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-green-500/10">
              <TrendingUp className="size-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Receita Webshare</p>
              <p className="text-xl font-bold text-foreground">{formatCurrency(financials.totalRevenue)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-red-500/10">
              <TrendingDown className="size-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Custo Real</p>
              <p className="text-xl font-bold text-foreground">{formatCurrency(financials.totalCost)}</p>
              {plan?.monthly_price != null && (
                <p className="text-[10px] text-muted-foreground">
                  Plano: ${plan.monthly_price.toFixed(2)}/mês (≈ {formatCurrency(plan.monthly_price * 5.5)})
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className={`border-border/40 bg-card/60 backdrop-blur-sm ${financials.totalProfit > 0 ? "border-green-500/30" : "border-destructive/30"}`}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`flex items-center justify-center size-10 rounded-lg ${financials.totalProfit > 0 ? "bg-green-500/10" : "bg-destructive/10"}`}>
              <DollarSign className={`size-5 ${financials.totalProfit > 0 ? "text-green-500" : "text-destructive"}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Lucro Líquido</p>
              <p className={`text-xl font-bold ${financials.totalProfit > 0 ? "text-green-500" : "text-destructive"}`}>
                {formatCurrency(financials.totalProfit)}
              </p>
              {financials.totalRevenue > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  Margem: {((financials.totalProfit / financials.totalRevenue) * 100).toFixed(1)}%
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-blue-500/10">
              <ShoppingBag className="size-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Proxies Vendidos</p>
              <p className="text-xl font-bold text-foreground">
                {financials.activeCount}
                <span className="text-sm text-muted-foreground font-normal ml-1">/ {plan?.proxy_count || totalProxies}</span>
              </p>
              <p className="text-[10px] text-muted-foreground">
                {plan?.proxy_count ? `${((financials.activeCount / (plan.proxy_count || 1)) * 100).toFixed(0)}% alocados` : ""}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales Chart */}
      {(() => {
        const since = getPeriodDate(period);
        const dailyMap = new Map<string, { receita: number; vendas: number }>();
        for (const sub of financials.subsWithPrices) {
          const createdAt = sub.created_at;
          if (!createdAt) continue;
          if (since && createdAt < since) continue;
          const day = createdAt.substring(0, 10);
          const existing = dailyMap.get(day) || { receita: 0, vendas: 0 };
          existing.receita += sub.price;
          existing.vendas += 1;
          dailyMap.set(day, existing);
        }
        const chartData = Array.from(dailyMap.entries())
          .map(([date, val]) => ({ date, receita: val.receita, vendas: val.vendas }))
          .sort((a, b) => a.date.localeCompare(b.date));

        return (
          <Card className="border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground">Evolução de Vendas Webshare</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {!chartData.length ? (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                  Sem dados de vendas no período
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="wsRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) => { const [, m, d] = v.split("-"); return `${d}/${m}`; }}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `R$${v}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                        color: "hsl(var(--foreground))",
                      }}
                      formatter={(value: number, name: string) => [
                        name === "receita" ? formatCurrency(value) : value,
                        name === "receita" ? "Receita" : "Vendas",
                      ]}
                      labelFormatter={(label) => { const [y, m, d] = label.split("-"); return `${d}/${m}/${y}`; }}
                    />
                    <Area
                      type="monotone"
                      dataKey="receita"
                      stroke="#22c55e"
                      strokeWidth={2}
                      fill="url(#wsRevenueGradient)"
                      dot={{ r: 3, fill: "#22c55e", strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: "#22c55e", strokeWidth: 2, stroke: "hsl(var(--background))" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* Per-Product Breakdown */}
      <Card className="border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground">Vendas por Produto Webshare</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/30">
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Qtd.</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="text-right">Lucro</TableHead>
                  <TableHead className="text-right">Margem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const productMap = new Map<string, { id: string; name: string; price: number }>();
                  (wsProducts || []).forEach(p => productMap.set(p.id, p));

                  const breakdown = new Map<string, { name: string; qty: number; revenue: number; cost: number }>();
                  for (const sub of financials.subsWithPrices) {
                    const product = sub.product_id ? productMap.get(sub.product_id) : null;
                    const productName = product?.name || "Proxy Webshare";
                    const existing = breakdown.get(productName) || { name: productName, qty: 0, revenue: 0, cost: 0 };
                    existing.qty += 1;
                    existing.revenue += sub.price;
                    existing.cost += sub.unitCost;
                    breakdown.set(productName, existing);
                  }
                  const items = Array.from(breakdown.values()).sort((a, b) => b.revenue - a.revenue);

                  if (!items.length) {
                    return (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma venda Webshare ativa</TableCell></TableRow>
                    );
                  }

                  return items.map((item, i) => {
                    const profit = item.revenue - item.cost;
                    const margin = item.revenue > 0 ? (profit / item.revenue) * 100 : 0;
                    return (
                      <TableRow key={i} className="border-border/20">
                        <TableCell className="font-medium text-foreground text-sm">{item.name}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{item.qty}</TableCell>
                        <TableCell className="text-right font-mono text-sm text-foreground">{formatCurrency(item.revenue)}</TableCell>
                        <TableCell className="text-right font-mono text-sm text-muted-foreground">{formatCurrency(item.cost)}</TableCell>
                        <TableCell className="text-right">
                          <span className={`font-mono text-sm font-medium ${profit > 0 ? "text-green-500" : "text-destructive"}`}>
                            {formatCurrency(profit)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={profit > 0 ? "default" : "destructive"} className="font-mono text-xs">
                            {margin.toFixed(0)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  });
                })()}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Bandwidth Usage */}
      <WebshareBandwidthCard bandwidthLimitGB={plan?.bandwidth_limit || null} />

      {/* Proxy Table */}
      <Card className="border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">Lista de Proxies</CardTitle>
        </CardHeader>
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