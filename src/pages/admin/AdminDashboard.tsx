import { useState, useEffect } from "react";
import { Users, Receipt, Wallet, TrendingUp, Database, CheckCircle, Clock, AlertTriangle, Ban, User, Briefcase, Globe, MoreVertical, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { supabase } from "@/integrations/supabase/client";

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

  useEffect(() => {
    async function fetchStats() {
      const [profilesRes, transactionsRes, balanceRes, productsRes, ordersRes, orderItemsRes, categoriesRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("wallet_transactions").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("balance"),
        supabase.from("products").select("id, available"),
        supabase.from("orders").select("id, status, total, created_at"),
        supabase.from("order_items").select("product_id, price, quantity, created_at, order_id"),
        supabase.from("product_categories").select("id, name"),
      ]);

      setTotalClients(profilesRes.count ?? 0);
      setTotalTransactions(transactionsRes.count ?? 0);

      const sumBalance = (balanceRes.data ?? []).reduce((s, p) => s + (p.balance || 0), 0);
      setTotalBalance(sumBalance);

      const prods = productsRes.data ?? [];
      setTotalProducts(prods.length);
      setActiveProducts(prods.filter(p => p.available).length);

      const ords = ordersRes.data ?? [];
      setTotalOrders(ords.length);
      setPendingOrders(ords.filter(o => o.status === "processing").length);
      setCancelledOrders(ords.filter(o => o.status === "cancelled").length);

      // Chart: group orders by month
      const monthMap: Record<string, number> = {};
      ords.forEach(o => {
        const d = new Date(o.created_at);
        const key = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
        monthMap[key] = (monthMap[key] || 0) + (o.total || 0);
      });
      setChartData(Object.entries(monthMap).slice(-7).map(([name, value]) => ({ name, value })));

      // Category stats from order items
      const cats = categoriesRes.data ?? [];
      const prodsByCat = await supabase.from("products").select("id, category_id");
      const prodCatMap: Record<string, string> = {};
      (prodsByCat.data ?? []).forEach(p => {
        if (p.category_id) prodCatMap[p.id] = p.category_id;
      });

      const catStats: Record<string, { sales: number; revenue: number }> = {};
      (orderItemsRes.data ?? []).forEach(item => {
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
            { label: "Total Produtos", value: totalProducts.toString(), icon: Database, color: "text-white" },
            { label: "Disponíveis", value: activeProducts.toString(), icon: CheckCircle, color: "text-green-500" },
            { label: "Pedidos Pendentes", value: pendingOrders.toString(), icon: Clock, color: "text-yellow-500" },
            { label: "Total Pedidos", value: totalOrders.toString(), icon: AlertTriangle, color: "text-blue-400" },
            { label: "Cancelados", value: cancelledOrders.toString(), icon: Ban, color: "text-red-500" },
          ].map((metric) => (
            <div key={metric.label} className="bg-white/5 rounded-lg p-3 flex items-center gap-3">
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
        <div className="h-48">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barCategoryGap="20%">
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} tickFormatter={(value) => `R$ ${value / 1000}k`} />
                <Tooltip
                  contentStyle={{ background: 'rgba(0,0,0,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(value: number) => [`R$ ${(value / 1000).toFixed(1)}k`, 'Valor']}
                  labelStyle={{ color: 'white' }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={`hsl(var(--primary) / ${0.4 + (entry.value / (Math.max(...chartData.map(d => d.value)) || 1)) * 0.6})`} />
                  ))}
                </Bar>
              </BarChart>
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
    </div>
  );
}
