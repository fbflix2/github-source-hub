import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Wallet, TrendingUp, ShoppingBag, BarChart3, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

      if (!orders || orders.length === 0) return { totalRevenue: 0, totalOrders: 0, productBreakdown: [] };

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

  // Active subscriptions count
  const { data: subsCount } = useQuery({
    queryKey: ["proxy-active-subs-count"],
    queryFn: async () => {
      const { count, error } = await supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("type", "proxybr").eq("status", "active");
      if (error) throw error;
      return count || 0;
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
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-primary/10">
              <Wallet className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Saldo ProxyBR</p>
              {meLoading ? <Skeleton className="h-6 w-20" /> : (
                <p className="text-xl font-bold text-foreground">
                  {balance !== null ? formatCurrency(balance) : "—"}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Revenue */}
        <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-green-500/10">
              <TrendingUp className="size-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Receita Proxies</p>
              {salesLoading ? <Skeleton className="h-6 w-20" /> : (
                <p className="text-xl font-bold text-foreground">{formatCurrency(salesData?.totalRevenue || 0)}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Orders */}
        <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-blue-500/10">
              <ShoppingBag className="size-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Vendas no Período</p>
              {salesLoading ? <Skeleton className="h-6 w-10" /> : (
                <p className="text-xl font-bold text-foreground">{salesData?.totalOrders || 0}</p>
              )}
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
