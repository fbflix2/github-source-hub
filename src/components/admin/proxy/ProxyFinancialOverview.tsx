import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProxyRevenue } from "@/hooks/useProxyRevenue";
import { Wallet, TrendingUp, ShoppingBag, BarChart3, RefreshCw, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

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

export default function ProxyFinancialOverview() {
  const [period, setPeriod] = useState<Period>("30d");
  const proxyRevenue = useProxyRevenue();

  // ProxyBR account balance
  const { data: meData, isLoading: meLoading, refetch: refetchMe } = useQuery({
    queryKey: ["proxybr-me"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("proxybr-api", { body: { action: "get-me" } });
      if (error) throw new Error(error.message);
      return data;
    },
    staleTime: 120_000,
  });

  // Proxy sales from orders (completed/delivered orders that contain proxy items)
  const { data: salesData, isLoading: salesLoading } = useQuery({
    queryKey: ["proxy-sales-analytics", period],
    queryFn: async () => {
      const since = getPeriodDate(period);

      // Get completed/delivered orders with proxy-related order_items
      let ordersQuery = supabase
        .from("orders")
        .select("id, total, created_at, code")
        .in("status", ["completed", "delivered"]);
      if (since) ordersQuery = ordersQuery.gte("created_at", since);
      const { data: orders, error: ordersErr } = await ordersQuery;
      if (ordersErr) throw ordersErr;

      if (!orders || orders.length === 0) return { totalRevenue: 0, totalOrders: 0, productBreakdown: [], dailyData: [] };

      // Get order items for these orders that have delivery_data with proxy_contract
      const orderIds = orders.map(o => o.id);
      // Fetch in batches of 50 to avoid URL length limits
      const allItems: any[] = [];
      for (let i = 0; i < orderIds.length; i += 50) {
        const batch = orderIds.slice(i, i + 50);
        const { data: items } = await supabase
          .from("order_items")
          .select("order_id, name, price, quantity")
          .in("order_id", batch);
        if (items) allItems.push(...items);
      }

      // Filter only proxy items (name contains "proxy" or product linked to external_id)
      const proxyItems = allItems.filter(item =>
        item.name?.toLowerCase().includes("proxy") ||
        item.name?.toLowerCase().includes("socks") ||
        item.name?.toLowerCase().includes("http")
      );

      const proxyOrderIds = new Set(proxyItems.map(i => i.order_id));
      const proxyOrders = orders.filter(o => proxyOrderIds.has(o.id));
      const totalRevenue = proxyItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);

      // Build daily time-series from proxy orders
      const orderItemMap = new Map<string, { revenue: number; qty: number }>();
      for (const item of proxyItems) {
        const order = orders.find(o => o.id === item.order_id);
        if (!order) continue;
        const day = order.created_at.substring(0, 10); // YYYY-MM-DD
        const existing = orderItemMap.get(day) || { revenue: 0, qty: 0 };
        existing.revenue += Number(item.price || 0) * Number(item.quantity || 1);
        existing.qty += Number(item.quantity || 1);
        orderItemMap.set(day, existing);
      }
      const dailyData = Array.from(orderItemMap.entries())
        .map(([date, val]) => ({ date, receita: val.revenue, vendas: val.qty }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Product breakdown
      const breakdown = new Map<string, { name: string; qty: number; revenue: number }>();
      for (const item of proxyItems) {
        const key = item.name || "Proxy";
        const existing = breakdown.get(key) || { name: key, qty: 0, revenue: 0 };
        existing.qty += Number(item.quantity || 1);
        existing.revenue += Number(item.price || 0) * Number(item.quantity || 1);
        breakdown.set(key, existing);
      }

      return {
        totalRevenue,
        totalOrders: proxyOrders.length,
        productBreakdown: Array.from(breakdown.values()).sort((a, b) => b.revenue - a.revenue),
        dailyData,
      };
    },
    staleTime: 60_000,
  });

  // Get reseller discounts for cost calculation
  const { data: discountSetting } = useQuery({
    queryKey: ["proxybr-reseller-discounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_settings").select("value").eq("key", "proxybr_reseller_discounts").maybeSingle();
      if (error) throw error;
      return data?.value || "{}";
    },
    staleTime: 60_000,
  });

  // Active subscriptions count (exploded: count individual proxies in multi-proxy subs)
  const { data: subsCount } = useQuery({
    queryKey: ["proxy-active-subs-count-exploded"],
    queryFn: async () => {
      let all: any[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data } = await supabase
          .from("subscriptions")
          .select("raw_data")
          .eq("type", "proxybr")
          .eq("status", "active")
          .range(from, from + pageSize - 1);
        if (!data?.length) break;
        all = [...all, ...data];
        if (data.length < pageSize) break;
        from += pageSize;
      }
      // Count individual proxies: if raw_data.proxies.data is array with >1, count each
      let total = 0;
      for (const sub of all) {
        const proxies = sub.raw_data?.proxies?.data;
        if (Array.isArray(proxies) && proxies.length > 1) {
          total += proxies.length;
        } else {
          total += 1;
        }
      }
      return total;
    },
    staleTime: 60_000,
  });

  const balance = meData?.current_balance ?? meData?.data?.current_balance ?? null;
  const isLoading = meLoading || salesLoading;

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
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
        </div>
        <Button variant="outline" size="sm" onClick={() => refetchMe()} disabled={meLoading}>
          <RefreshCw className={`size-4 mr-2 ${meLoading ? "animate-spin" : ""}`} />Atualizar
        </Button>
      </div>

      {/* Top Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* ProxyBR Balance */}
        <Card className="border-primary/30 bg-card/60 backdrop-blur-sm shadow-lg shadow-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-10 rounded-lg bg-primary/10">
                <Wallet className="size-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Saldo ProxyBR</p>
                {meLoading ? <Skeleton className="h-6 w-20" /> : (
                  <p className="text-xl font-bold text-foreground">
                    {balance !== null ? formatCurrency(balance) : "—"}
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-3 text-xs"
              onClick={() => window.open("https://painel.proxybr.com.br", "_blank")}
            >
              <ExternalLink className="size-3.5 mr-1.5" />
              Recarregar na ProxyBR
            </Button>
          </CardContent>
        </Card>

        {/* Revenue - from all active subscriptions (exploded) */}
        <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-green-500/10">
              <TrendingUp className="size-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Receita Proxies</p>
              <p className="text-xl font-bold text-foreground">{formatCurrency(proxyRevenue.totalRevenue)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Proxies sold (exploded count) */}
        <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-blue-500/10">
              <ShoppingBag className="size-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Vendas no Período</p>
              <p className="text-xl font-bold text-foreground">{proxyRevenue.count}</p>
            </div>
          </CardContent>
        </Card>

        {/* Active Subs */}
        <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-orange-500/10">
              <BarChart3 className="size-5 text-orange-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Assinaturas Ativas</p>
              <p className="text-xl font-bold text-foreground">{subsCount ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales Evolution Chart */}
      <Card className="border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">Evolução de Vendas</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {salesLoading ? (
            <Skeleton className="h-[250px] w-full" />
          ) : !salesData?.dailyData?.length ? (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
              Sem dados de vendas no período
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={salesData.dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="proxyRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
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
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#proxyRevenueGradient)"
                  dot={{ r: 3, fill: "hsl(var(--primary))", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "hsl(var(--primary))", strokeWidth: 2, stroke: "hsl(var(--background))" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Product Breakdown */}
      <Card className="border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground">Vendas por Produto</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/30">
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Qtd. Vendida</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">% do Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salesLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i} className="border-border/20">
                      {Array.from({ length: 4 }).map((_, j) => (<TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>))}
                    </TableRow>
                  ))
                ) : !salesData?.productBreakdown?.length ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhuma venda de proxy no período</TableCell></TableRow>
                ) : (
                  salesData.productBreakdown.map((item, i) => {
                    const pct = salesData.totalRevenue > 0 ? (item.revenue / salesData.totalRevenue) * 100 : 0;
                    return (
                      <TableRow key={i} className="border-border/20">
                        <TableCell className="font-medium text-foreground text-sm">{item.name}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{item.qty}</TableCell>
                        <TableCell className="text-right font-mono text-sm text-foreground">{formatCurrency(item.revenue)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className="font-mono text-xs">{pct.toFixed(0)}%</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
