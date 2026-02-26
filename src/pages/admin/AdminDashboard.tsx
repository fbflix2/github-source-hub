import { useState, useEffect } from "react";
import { Users, Receipt, Wallet, TrendingUp, Database, CheckCircle, Clock, AlertTriangle, Ban, User, Briefcase, Globe, MoreVertical, Loader2, X, ExternalLink } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const [loading, setLoading] = useState(true);
  const [totalClients, setTotalClients] = useState(0);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [totalBalance, setTotalBalance] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);
  const [activeProducts, setActiveProducts] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [pendingOrders, setPendingOrders] = useState(0);
  const [cancelledOrders, setCancelledOrders] = useState(0);
  const [chartData, setChartData] = useState<{ name: string; value: number }[]>([]);
  const [categoryStats, setCategoryStats] = useState<{ name: string; sales: number; revenue: number }[]>([]);
  const [pendingModal, setPendingModal] = useState(false);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);

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
      const [profilesRes, transactionsRes, balanceRes, productsRes, ordersRes, orderItemsRes, categoriesRes, pendingPaymentsRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }).limit(0),
        supabase.from("wallet_transactions").select("id", { count: "exact", head: true }),
        supabase.rpc("get_total_wallet_balance"),
        supabase.from("products").select("id, available"),
        supabase.from("orders").select("id, status, total, created_at"),
        supabase.from("order_items").select("product_id, price, quantity, created_at, order_id"),
        supabase.from("product_categories").select("id, name"),
        supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);

      setTotalClients(profilesRes.count ?? 0);
      setTotalTransactions(transactionsRes.count ?? 0);

      setTotalBalance(balanceRes.data ?? 0);

      const prods = productsRes.data ?? [];
      setTotalProducts(prods.length);
      setActiveProducts(prods.filter(p => p.available).length);

      const ords = ordersRes.data ?? [];
      setTotalOrders(ords.length);
      setPendingOrders(ords.filter(o => o.status === "processing").length + (pendingPaymentsRes.count ?? 0));
      setCancelledOrders(ords.filter(o => o.status === "cancelled").length);

      // Only count completed/delivered orders as received revenue
      const completedStatuses = ["completed", "delivered"];
      const completedOrds = ords.filter(o => completedStatuses.includes(o.status));
      const completedOrderIds = new Set(completedOrds.map(o => o.id));

      // Chart: group completed orders by month
      const monthMap: Record<string, number> = {};
      completedOrds.forEach(o => {
        const d = new Date(o.created_at);
        const key = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
        monthMap[key] = (monthMap[key] || 0) + (o.total || 0);
      });
      setChartData(Object.entries(monthMap).slice(-7).map(([name, value]) => ({ name, value })));

      // Category stats from order items (only completed orders)
      const cats = categoriesRes.data ?? [];
      const prodsByCat = await supabase.from("products").select("id, category_id");
      const prodCatMap: Record<string, string> = {};
      (prodsByCat.data ?? []).forEach(p => {
        if (p.category_id) prodCatMap[p.id] = p.category_id;
      });

      const catStats: Record<string, { sales: number; revenue: number }> = {};
      (orderItemsRes.data ?? []).forEach(item => {
        if (!completedOrderIds.has(item.order_id)) return;
        const catId = item.product_id ? prodCatMap[item.product_id] : null;
        if (catId) {
          if (!catStats[catId]) catStats[catId] = { sales: 0, revenue: 0 };
          catStats[catId].sales += item.quantity;
          catStats[catId].revenue += item.price * item.quantity;
        }
      });

      setCategoryStats(cats.map(c => ({
        name: c.name,
        sales: catStats[c.id]?.sales ?? 0,
        revenue: catStats[c.id]?.revenue ?? 0,
      })));

      setLoading(false);
    }
    fetchStats();
  }, []);

  const formatCurrency = (v: number) => {
    if (v >= 1000) return `R$ ${(v / 1000).toFixed(1)}k`;
    return `R$ ${v.toFixed(2).replace(".", ",")}`;
  };

  const catColors = ["bg-blue-500", "bg-purple-500", "bg-primary", "bg-cyan-500"];
  const catIcons = [User, Briefcase, Database, Globe];

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { title: "Total de Clientes", value: totalClients.toLocaleString("pt-BR"), icon: Users, iconBg: "bg-blue-500/20", iconColor: "text-blue-400" },
          { title: "Total de Transações", value: totalTransactions.toLocaleString("pt-BR"), icon: Receipt, iconBg: "bg-purple-500/20", iconColor: "text-purple-400" },
          { title: "Saldo em Carteiras", value: formatCurrency(totalBalance), icon: Wallet, iconBg: "bg-primary/20", iconColor: "text-primary" },
        ].map((card) => (
          <div key={card.title} className="glass-panel rounded-xl p-4 relative overflow-hidden group">
            <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <card.icon className="size-14 text-white" />
            </div>
            <div className="flex flex-col gap-2 relative z-10">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 ${card.iconBg} rounded-lg ${card.iconColor}`}>
                  <card.icon className="size-4" />
                </div>
                <p className="text-white/60 text-xs font-medium">{card.title}</p>
              </div>
              <h3 className="text-2xl font-bold text-white tracking-tight">{card.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* Product Metrics */}
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
            { label: "Cancelados", value: cancelledOrders.toString(), icon: Ban, color: "text-red-500", clickable: false },
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
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
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
                  cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  fill="url(#colorValue)"
                  dot={{ r: 4, fill: 'hsl(var(--primary))', stroke: '#0a0505', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: 'hsl(var(--primary))', stroke: 'white', strokeWidth: 2 }}
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
