import { useState, useEffect, useMemo } from "react";
import { Users, Receipt, Wallet, TrendingUp, Database, CheckCircle, Clock, AlertTriangle, RefreshCw, User, Briefcase, Globe, MoreVertical, Loader2, X, ExternalLink, Eye, EyeOff } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { AdminMobileDashboard } from "@/components/admin/mobile/AdminMobileDashboard";

interface PendingItem {
  id: string;
  type: "pix_pending" | "order_pending";
  amount: number;
  created_at: string;
  status: string;
  client_name: string | null;
  client_email: string | null;
  code: string;
  gateway?: string;
}

export default function AdminDashboard() {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [totalClients, setTotalClients] = useState(0);
  const [totalInBase, setTotalInBase] = useState(0);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [totalBalance, setTotalBalance] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);
  const [activeProducts, setActiveProducts] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [pendingOrders, setPendingOrders] = useState(0);
  const [replacementRate, setReplacementRate] = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [chartData, setChartData] = useState<{ name: string; value: number }[]>([]);
  const [categoryStats, setCategoryStats] = useState<{ name: string; sales: number; revenue: number }[]>([]);
  const [pendingModal, setPendingModal] = useState(false);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [revenueHidden, setRevenueHidden] = useState(false);
  const [revenuePeriod, setRevenuePeriod] = useState<"hoje" | "7dias" | "30dias">("hoje");
  const [showRevenuePeriodPicker, setShowRevenuePeriodPicker] = useState(false);
  const [allCompletedOrders, setAllCompletedOrders] = useState<{ total: number; created_at: string }[]>([]);

  const openPendingModal = async () => {
    setPendingModal(true);
    setLoadingPending(true);
    try {
      // Fetch pending payments (PIX not paid) and pending orders
      const [paymentsRes, ordersRes2] = await Promise.all([
        supabase.from("payments").select("id, amount, created_at, status, code, gateway, user_id").eq("status", "pending").order("created_at", { ascending: false }),
        supabase.from("orders").select("id, total, created_at, status, code, user_id").eq("status", "processing").order("created_at", { ascending: false }),
      ]);

      const allUserIds = [
        ...(paymentsRes.data ?? []).map(p => p.user_id),
        ...(ordersRes2.data ?? []).map(o => o.user_id),
      ].filter((v, i, a) => a.indexOf(v) === i);

      // Fetch profiles for names
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", allUserIds.length > 0 ? allUserIds : ["none"]);
      const profileMap: Record<string, string | null> = {};
      (profiles ?? []).forEach(p => { profileMap[p.user_id] = p.full_name; });

      // Fetch emails from auth (use user_id mapping)
      const items: PendingItem[] = [
        ...(paymentsRes.data ?? []).map(p => ({
          id: p.id,
          type: "pix_pending" as const,
          amount: p.amount,
          created_at: p.created_at,
          status: p.status,
          client_name: profileMap[p.user_id] || null,
          client_email: null,
          code: p.code,
          gateway: p.gateway,
        })),
        ...(ordersRes2.data ?? []).map(o => ({
          id: o.id,
          type: "order_pending" as const,
          amount: o.total,
          created_at: o.created_at,
          status: o.status,
          client_name: profileMap[o.user_id] || null,
          client_email: null,
          code: o.code,
        })),
      ];

      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setPendingItems(items);
    } catch (err) {
      console.error("Error fetching pending items:", err);
    } finally {
      setLoadingPending(false);
    }
  };

  useEffect(() => {
    async function fetchStats() {
      try {
      const [profilesRes, loggedInRes, transactionsRes, balanceRes, productsRes, ordersRes, orderItemsRes, categoriesRes, pendingPaymentsRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }).limit(0),
        supabase.from("profiles").select("id", { count: "exact", head: true }).not("first_login_at", "is", null).limit(0),
        supabase.from("wallet_transactions").select("id", { count: "exact", head: true }),
        supabase.rpc("get_total_wallet_balance"),
        supabase.from("products").select("id, available"),
        supabase.from("orders").select("id, status, total, created_at"),
        supabase.from("order_items").select("product_id, price, quantity, created_at, order_id, name"),
        supabase.from("product_categories").select("id, name, slug"),
        supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);

      setTotalClients(loggedInRes.count ?? 0);
      setTotalInBase(profilesRes.count ?? 0);
      setTotalTransactions(transactionsRes.count ?? 0);
      setTotalBalance(balanceRes.data ?? 0);

      const prods = productsRes.data ?? [];
      setTotalProducts(prods.length);
      setActiveProducts(prods.filter(p => p.available).length);

      const ords = ordersRes.data ?? [];
      setTotalOrders(ords.length);
      setPendingOrders(ords.filter(o => o.status === "processing").length + (pendingPaymentsRes.count ?? 0));

      const completedStatuses = ["completed", "delivered"];
      const completedOrds = ords.filter(o => completedStatuses.includes(o.status));

      // Calculate today's revenue
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayRev = completedOrds
        .filter(o => new Date(o.created_at) >= todayStart)
        .reduce((sum, o) => sum + (o.total || 0), 0);
      setTodayRevenue(todayRev);
      setAllCompletedOrders(completedOrds.map(o => ({ total: o.total || 0, created_at: o.created_at })));

      const completedOrderIds = new Set(completedOrds.map(o => o.id));

      const monthMap: Record<string, number> = {};
      const dateKeyMap: Record<string, string> = {}; // ISO date -> display key
      const toLocalISO = (dt: Date) => {
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, "0");
        const d2 = String(dt.getDate()).padStart(2, "0");
        return `${y}-${m}-${d2}`;
      };
      completedOrds.forEach(o => {
        const d = new Date(o.created_at);
        const isoKey = toLocalISO(d);
        const displayKey = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
        dateKeyMap[isoKey] = displayKey;
        monthMap[isoKey] = (monthMap[isoKey] || 0) + (o.total || 0);
      });
      const todayISO = toLocalISO(new Date());
      const todayChartKey = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
      if (!monthMap[todayISO]) monthMap[todayISO] = 0;
      dateKeyMap[todayISO] = todayChartKey;
      let proxyRevenueForChart = 0;

      const cats = categoriesRes.data ?? [];
      const prodsByCat = await supabase.from("products").select("id, category_id, name, price, external_id");
      const prodCatMap: Record<string, string> = {};
      (prodsByCat.data ?? []).forEach(p => {
        if (p.category_id) prodCatMap[p.id] = p.category_id;
      });

      const orderTotalMap: Record<string, number> = {};
      completedOrds.forEach(o => { orderTotalMap[o.id] = o.total || 0; });

      const orderItemCounts: Record<string, number> = {};
      (orderItemsRes.data ?? []).forEach(item => {
        if (!completedOrderIds.has(item.order_id)) return;
        orderItemCounts[item.order_id] = (orderItemCounts[item.order_id] || 0) + 1;
      });

      // Build a name-to-category map for fallback matching (items without product_id)
      const catNameMap: Record<string, string> = {};
      cats.forEach(c => {
        catNameMap[c.name.toLowerCase().trim()] = c.id;
        catNameMap[c.slug.toLowerCase().trim()] = c.id;
      });

      const guessCategoryByName = (itemName: string): string | null => {
        const lower = itemName.toLowerCase().trim();
        for (const [key, catId] of Object.entries(catNameMap)) {
          if (lower.includes(key)) return catId;
        }
        // Check common patterns
        if (lower.includes("perfil")) return cats.find(c => c.slug === "perfil" || c.name.toLowerCase().includes("perfil"))?.id || null;
        if (lower.includes("página") || lower.includes("pagina")) return cats.find(c => c.slug === "pagina" || c.name.toLowerCase().includes("página"))?.id || null;
        return null;
      };

      const catStats: Record<string, { sales: number; revenue: number }> = {};
      (orderItemsRes.data ?? []).forEach(item => {
        if (!completedOrderIds.has(item.order_id)) return;
        let catId = item.product_id ? prodCatMap[item.product_id] : null;
        // Fallback: match by item name if no product_id
        if (!catId && (item as any).name) {
          catId = guessCategoryByName((item as any).name);
        }
        if (catId) {
          if (!catStats[catId]) catStats[catId] = { sales: 0, revenue: 0 };
          catStats[catId].sales += item.quantity;
          const itemCount = orderItemCounts[item.order_id] || 1;
          catStats[catId].revenue += (orderTotalMap[item.order_id] || 0) / itemCount;
        }
      });

      const zeroedCategories: string[] = [];
      const proxyCat = cats.find(c => c.slug === "proxy") || cats.find(c => c.name.toLowerCase().includes("proxy"));
      
      if (proxyCat) {
        let allSubs: any[] = [];
        let from = 0;
        const pageSize = 1000;
        while (true) {
          const { data: subs } = await supabase
            .from("subscriptions")
            .select("name, status, end_date, raw_data")
            .eq("status", "active")
            .range(from, from + pageSize - 1);
          if (!subs?.length) break;
          allSubs = [...allSubs, ...subs];
          if (subs.length < pageSize) break;
          from += pageSize;
        }

        const now = new Date();
        const activeSubs = allSubs.filter(s => {
          if (!s.end_date) return true;
          return new Date(s.end_date) >= now;
        });

        const proxyProducts = (prodsByCat.data ?? []).filter(p => p.external_id);
        const extIdPriceMap = new Map<string, number>();
        const namePriceMap = new Map<string, number>();
        proxyProducts.forEach(p => {
          if (p.external_id) extIdPriceMap.set(String(p.external_id), p.price);
          namePriceMap.set(p.name.toLowerCase().trim(), p.price);
        });

        let proxyRevenue = 0;
        let proxySales = 0;
        activeSubs.forEach(sub => {
          const raw = sub.raw_data || {};
          const productId = raw.product?.id;
          const productName = raw.product?.name || sub.name || "";
          const proxies = raw.proxies?.data;
          const proxyCount = (Array.isArray(proxies) && proxies.length > 1) ? proxies.length : 1;
          
          let price = 0;
          if (productId && extIdPriceMap.has(String(productId))) {
            price = extIdPriceMap.get(String(productId))!;
          } else if (namePriceMap.has(productName.toLowerCase().trim())) {
            price = namePriceMap.get(productName.toLowerCase().trim())!;
          }
          proxyRevenue += price * proxyCount;
          proxySales += proxyCount;
        });

        catStats[proxyCat.id] = { sales: proxySales, revenue: proxyRevenue };
        proxyRevenueForChart = proxyRevenue;
      }

      // Chart shows only actual order revenue per day (no proxy recurring total)
      // Sort by ISO date to ensure chronological order, then display with formatted labels
      const sortedEntries = Object.entries(monthMap).sort(([a], [b]) => a.localeCompare(b)).slice(-7);
      setChartData(sortedEntries.map(([isoKey, value]) => ({ name: dateKeyMap[isoKey] || isoKey, value })));

      setCategoryStats(cats.map(c => {
        const shouldZero = zeroedCategories.includes(c.name.toLowerCase().trim());
        return {
          name: c.name,
          sales: shouldZero ? 0 : (catStats[c.id]?.sales ?? 0),
          revenue: shouldZero ? 0 : (catStats[c.id]?.revenue ?? 0),
        };
      }));

      // Calculate replacement rate for current month (non-proxy products)
      const replNow = new Date();
      const monthStart = new Date(replNow.getFullYear(), replNow.getMonth(), 1).toISOString();
      const monthEnd = new Date(replNow.getFullYear(), replNow.getMonth() + 1, 0, 23, 59, 59).toISOString();
      const [replacementsRes] = await Promise.all([
        supabase.from("replacements").select("id", { count: "exact", head: true })
          .gte("created_at", monthStart).lte("created_at", monthEnd),
      ]);
      const proxyProductIds = new Set(
        (prodsByCat.data ?? []).filter(p => p.external_id).map(p => p.id)
      );
      const completedOrderIdsForRepl = new Set(
        ords.filter(o => ["completed", "delivered"].includes(o.status) && o.created_at >= monthStart && o.created_at <= monthEnd).map(o => o.id)
      );
      const nonProxyOrderItems = (orderItemsRes.data ?? []).filter(item => 
        completedOrderIdsForRepl.has(item.order_id) && (!item.product_id || !proxyProductIds.has(item.product_id))
      );
      const totalNonProxyItems = nonProxyOrderItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
      const totalReplacements = replacementsRes.count ?? 0;
      setReplacementRate(totalNonProxyItems > 0 ? (totalReplacements / totalNonProxyItems) * 100 : 0);
      } catch (err) {
        console.error("Dashboard fetchStats error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();

    // Realtime: update dashboard when orders change
    const channel = supabase
      .channel("dashboard-orders-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => { fetchStats(); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payments" },
        () => { fetchStats(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const formatCurrency = (v: number) => {
    if (v >= 1000) return `R$ ${(v / 1000).toFixed(1)}k`;
    return `R$ ${v.toFixed(2).replace(".", ",")}`;
  };

  const catColors = ["bg-blue-500", "bg-purple-500", "bg-primary", "bg-cyan-500"];
  const catIcons = [User, Briefcase, Database, Globe];

  const periodLabels: Record<string, string> = { hoje: "Hoje", "7dias": "7 Dias", "30dias": "30 Dias" };

  const periodRevenue = useMemo(() => {
    const now = new Date();
    let since: Date;
    switch (revenuePeriod) {
      case "hoje": since = new Date(now); since.setHours(0, 0, 0, 0); break;
      case "7dias": since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
      case "30dias": since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
    }
    return allCompletedOrders
      .filter(o => new Date(o.created_at) >= since)
      .reduce((s, o) => s + o.total, 0);
  }, [allCompletedOrders, revenuePeriod]);

  // Mobile: render dedicated mobile dashboard
  if (isMobile) {
    return <AdminMobileDashboard />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { key: "clientes", title: "Total de Clientes", value: totalClients.toLocaleString("pt-BR"), icon: Users, iconBg: "bg-blue-500/20", iconColor: "text-blue-400", sub: `${totalInBase.toLocaleString("pt-BR")} na base` },
          { key: "transacoes", title: "Total de Transações", value: totalTransactions.toLocaleString("pt-BR"), icon: Receipt, iconBg: "bg-purple-500/20", iconColor: "text-purple-400" },
          { key: "saldo", title: "Saldo em Carteiras", value: formatCurrency(totalBalance), icon: Wallet, iconBg: "bg-primary/20", iconColor: "text-primary" },
          { key: "faturado", title: `Faturado ${periodLabels[revenuePeriod]}`, value: revenueHidden ? "••••••" : formatCurrency(periodRevenue), icon: TrendingUp, iconBg: "bg-green-500/20", iconColor: "text-green-400" },
        ].map((card) => (
          <div
            key={card.key}
            className={`glass-panel rounded-xl p-4 relative group ${card.key === "faturado" ? "cursor-pointer" : "overflow-hidden"}`}
            onClick={card.key === "faturado" ? () => setShowRevenuePeriodPicker(!showRevenuePeriodPicker) : undefined}
          >
            <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <card.icon className="size-14 text-white" />
            </div>
            <div className="flex flex-col gap-2 relative z-10">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 ${card.iconBg} rounded-lg ${card.iconColor}`}>
                  <card.icon className="size-4" />
                </div>
                <p className="text-white/60 text-xs font-medium">{card.title}</p>
                {card.key === "faturado" && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setRevenueHidden(!revenueHidden); }}
                    className="ml-auto text-white/40 hover:text-white/80 transition-colors p-0.5 relative z-20"
                  >
                    {revenueHidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                )}
              </div>
              <h3 className="text-2xl font-bold text-white tracking-tight">{card.value}</h3>
              {(card as any).sub && <p className="text-white/40 text-[10px]">{(card as any).sub}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Revenue Period Picker Dialog */}
      <Dialog open={showRevenuePeriodPicker} onOpenChange={setShowRevenuePeriodPicker}>
        <DialogContent className="sm:max-w-xs bg-zinc-900 border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white text-sm">Selecionar Período de Faturamento</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1">
            {(["hoje", "7dias", "30dias"] as const).map(p => (
              <button
                key={p}
                onClick={() => { setRevenuePeriod(p); setShowRevenuePeriodPicker(false); }}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  revenuePeriod === p ? "text-primary bg-primary/10" : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                {periodLabels[p]}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <div className="glass-panel rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Database className="size-4 text-white/60" />
          <h3 className="text-sm font-semibold text-white">Métricas de Produtos</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Total Produtos", value: totalProducts.toString(), icon: Database, color: "text-white", clickable: false },
            { label: "Disponíveis", value: activeProducts.toString(), icon: CheckCircle, color: "text-green-500", clickable: false },
            { label: "Pedidos Pendentes", value: pendingOrders.toString(), icon: Clock, color: "text-yellow-500", clickable: true },
            { label: "Total Pedidos", value: totalOrders.toString(), icon: AlertTriangle, color: "text-blue-400", clickable: false },
            { label: "Taxa Reposição", value: `${replacementRate.toFixed(1)}%`, icon: RefreshCw, color: "text-orange-400", clickable: false },
          ].map((metric) => (
            <div
              key={metric.label}
              onClick={metric.clickable ? openPendingModal : undefined}
              className={`bg-white/5 rounded-lg p-3 flex items-center gap-3 transition-colors ${metric.clickable ? "cursor-pointer hover:bg-white/10 hover:ring-1 hover:ring-yellow-500/30" : ""}`}
            >
              <div className={`p-2 rounded-lg bg-white/10 ${metric.color}`}>
                <metric.icon className="size-4" />
              </div>
              <div>
                <p className="text-white/40 text-[10px] font-medium uppercase tracking-wider">{metric.label}</p>
                <p className={`text-lg font-bold ${metric.color}`}>{metric.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Payment Movement Chart */}
      <div className="glass-panel rounded-xl p-4">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-white">Movimentação de Pagamentos</h3>
          <p className="text-white/40 text-xs">Análise financeira por período.</p>
        </div>
        <div className="h-56">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: 'rgba(10,5,5,0.95)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', fontSize: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', padding: '10px 14px' }}
                  formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Valor']}
                  labelStyle={{ color: 'rgba(255,255,255,0.7)', marginBottom: '4px', fontWeight: 600 }}
                  itemStyle={{ color: 'white' }}
                  cursor={{ stroke: '#22c55e', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#22c55e"
                  strokeWidth={2.5}
                  fill="url(#colorValue)"
                  dot={{ r: 4, fill: '#22c55e', stroke: '#0a0505', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: '#22c55e', stroke: 'white', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-white/40 text-sm">Nenhum dado de pagamento ainda.</div>
          )}
        </div>
      </div>

      {/* Sales Volume by Category */}
      <div className="glass-panel rounded-xl p-4">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-white">Volume de Vendas por Categoria</h3>
          <p className="text-white/40 text-xs">Desempenho comparativo por categoria de produto.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {categoryStats.length > 0 ? categoryStats.map((cat, i) => {
            const Icon = catIcons[i % catIcons.length];
            return (
              <div key={cat.name} className="bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-1.5 ${catColors[i % catColors.length]} rounded-lg`}>
                    <Icon className="size-3.5 text-white" />
                  </div>
                  <span className="text-white font-medium text-sm">{cat.name}</span>
                </div>
                <p className="text-white/60 text-xs">{cat.sales.toLocaleString("pt-BR")} vendas</p>
                <p className="text-white font-semibold text-lg">{formatCurrency(cat.revenue)}</p>
              </div>
            );
          }) : (
            <div className="col-span-full text-center text-white/40 text-sm py-4">Nenhuma categoria cadastrada ainda.</div>
          )}
        </div>
      </div>

      {/* Pending Orders Modal */}
      <Dialog open={pendingModal} onOpenChange={setPendingModal}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Clock className="size-5 text-yellow-500" />
              Pedidos Pendentes
            </DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 -mx-6 px-6">
            {loadingPending ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-6 animate-spin text-primary" />
              </div>
            ) : pendingItems.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="size-10 text-primary mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">Nenhum pedido pendente no momento.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingItems.map((item) => (
                  <div key={item.id} className="rounded-xl border border-border bg-muted/50 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${item.type === "pix_pending" ? "bg-yellow-500/10 text-yellow-500" : "bg-blue-500/10 text-blue-400"}`}>
                          {item.type === "pix_pending" ? <Wallet className="size-4" /> : <Receipt className="size-4" />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground">
                            {item.type === "pix_pending" ? "PIX Aguardando Pagamento" : "Pedido em Processamento"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Código: {item.code}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-yellow-500">
                        R$ {item.amount.toFixed(2).replace(".", ",")}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <User className="size-3" />
                          {item.client_name || "Sem nome"}
                        </span>
                        {item.gateway && (
                          <span className="px-2 py-0.5 bg-muted rounded text-[10px] uppercase font-medium">
                            {item.gateway}
                          </span>
                        )}
                      </div>
                      <span>
                        {new Date(item.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
