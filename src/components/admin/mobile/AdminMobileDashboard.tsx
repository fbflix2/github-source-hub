import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface MobileDashboardData {
  totalClients: number;
  totalTransactions: number;
  totalBalance: number;
  todayRevenue: number;
  totalProducts: number;
  activeProducts: number;
  pendingOrders: number;
  totalOrders: number;
  replacementRate: number;
  chartData: { name: string; value: number }[];
  categoryStats: { name: string; sales: number; icon: string }[];
}

const categoryIconMap: Record<string, string> = {
  perfil: "person",
  perfis: "person",
  bm: "business_center",
  página: "description",
  pagina: "description",
  proxy: "lan",
  instagram: "camera",
  "e-mail": "mail",
  email: "mail",
  tiktok: "movie",
};

function getCatIcon(name: string): string {
  const lower = name.toLowerCase().trim();
  for (const [key, icon] of Object.entries(categoryIconMap)) {
    if (lower.includes(key)) return icon;
  }
  return "category";
}

export function AdminMobileDashboard() {
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("Admin");
  const [data, setData] = useState<MobileDashboardData>({
    totalClients: 0,
    totalTransactions: 0,
    totalBalance: 0,
    todayRevenue: 0,
    totalProducts: 0,
    activeProducts: 0,
    pendingOrders: 0,
    totalOrders: 0,
    replacementRate: 0,
    chartData: [],
    categoryStats: [],
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", user.id)
          .maybeSingle();
        if (profile?.full_name) setUserName(profile.full_name.split(" ")[0]);
      }

      const [profilesRes, loggedInRes, transactionsRes, balanceRes, productsRes, ordersRes, orderItemsRes, categoriesRes, replacementsRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }).not("first_login_at", "is", null),
        supabase.from("wallet_transactions").select("id", { count: "exact", head: true }),
        supabase.rpc("get_total_wallet_balance"),
        supabase.from("products").select("id, available"),
        supabase.from("orders").select("id, status, total, created_at"),
        supabase.from("order_items").select("product_id, price, quantity, order_id, name"),
        supabase.from("product_categories").select("id, name, slug"),
        supabase.from("replacements").select("id", { count: "exact", head: true }),
      ]);

      const prods = productsRes.data ?? [];
      const ords = ordersRes.data ?? [];
      const completedStatuses = ["completed", "delivered"];
      const completedOrds = ords.filter(o => completedStatuses.includes(o.status));
      const completedOrderIds = new Set(completedOrds.map(o => o.id));

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayRev = completedOrds
        .filter(o => new Date(o.created_at) >= todayStart)
        .reduce((sum, o) => sum + (o.total || 0), 0);

      const hourMap: Record<string, number> = {};
      const todayOrds = completedOrds.filter(o => new Date(o.created_at) >= todayStart);
      todayOrds.forEach(o => {
        const d = new Date(o.created_at);
        const h = d.getHours();
        const key = `${String(h).padStart(2, "0")}:00`;
        hourMap[key] = (hourMap[key] || 0) + (o.total || 0);
      });
      const chartEntries = Object.entries(hourMap).sort(([a], [b]) => a.localeCompare(b)).slice(-5);
      if (chartEntries.length === 0) {
        chartEntries.push(["08:00", 0], ["12:00", 0], ["16:00", 0], ["20:00", 0]);
      }

      const cats = categoriesRes.data ?? [];
      const prodsByCat = await supabase.from("products").select("id, category_id");
      const prodCatMap: Record<string, string> = {};
      (prodsByCat.data ?? []).forEach(p => {
        if (p.category_id) prodCatMap[p.id] = p.category_id;
      });

      const catStats: Record<string, number> = {};
      (orderItemsRes.data ?? []).forEach(item => {
        if (!completedOrderIds.has(item.order_id)) return;
        const catId = item.product_id ? prodCatMap[item.product_id] : null;
        if (catId) {
          catStats[catId] = (catStats[catId] || 0) + (item.quantity || 1);
        }
      });

      const totalNonProxyItems = (orderItemsRes.data ?? []).filter(item => completedOrderIds.has(item.order_id)).reduce((sum, item) => sum + (item.quantity || 1), 0);
      const totalReplacements = replacementsRes.count ?? 0;
      const replRate = totalNonProxyItems > 0 ? (totalReplacements / totalNonProxyItems) * 100 : 0;

      setData({
        totalClients: loggedInRes.count ?? 0,
        totalTransactions: transactionsRes.count ?? 0,
        totalBalance: balanceRes.data ?? 0,
        todayRevenue: todayRev,
        totalProducts: prods.length,
        activeProducts: prods.filter(p => p.available).length,
        pendingOrders: ords.filter(o => o.status === "processing").length,
        totalOrders: ords.length,
        replacementRate: replRate,
        chartData: chartEntries.map(([name, value]) => ({ name, value })),
        categoryStats: cats.map(c => ({
          name: c.name,
          sales: catStats[c.id] ?? 0,
          icon: getCatIcon(c.name),
        })),
      });
    } catch (err) {
      console.error("Mobile dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (v: number) => {
    if (v >= 1000) return `R$ ${(v / 1000).toFixed(1)}k`;
    return `R$ ${v.toFixed(2).replace(".", ",")}`;
  };

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  };

  const chartTotal = data.chartData.reduce((s, d) => s + d.value, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 animate-spin" style={{ color: '#E50914' }} />
      </div>
    );
  }

  // SVG chart
  const maxVal = Math.max(...data.chartData.map(d => d.value), 1);
  const points = data.chartData.map((d, i) => ({
    x: (i / Math.max(data.chartData.length - 1, 1)) * 400,
    y: 160 - (d.value / maxVal) * 140 - 10,
  }));

  let pathD = "";
  let areaD = "";
  if (points.length > 1) {
    pathD = `M${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const cp1x = points[i - 1].x + (points[i].x - points[i - 1].x) * 0.4;
      const cp1y = points[i - 1].y;
      const cp2x = points[i].x - (points[i].x - points[i - 1].x) * 0.4;
      const cp2y = points[i].y;
      pathD += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${points[i].x},${points[i].y}`;
    }
    areaD = pathD + ` L400,160 L0,160 Z`;
  }

  const replWidth = `${Math.min(data.replacementRate, 100)}%`;

  return (
    <div className="space-y-8">
      {/* Personalized Greeting - exact match */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight text-white">
          {getGreeting()}, <span style={{ color: '#E50914' }}>{userName}</span>
        </h2>
        <p className="text-zinc-500 text-xs mt-1 font-medium">
          Bem-vindo ao seu painel de controle de hoje.
        </p>
      </div>

      {/* VISÃO GERAL */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Visão Geral</h2>
          <span className="text-[10px] text-zinc-500 font-medium">Últimos 30 dias</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="admin-mobile-glass p-4">
            <p className="text-zinc-500 text-[10px] font-semibold uppercase mb-1">Total de Clientes</p>
            <div className="flex items-baseline gap-2">
              <p className="text-xl font-bold">{data.totalClients.toLocaleString("pt-BR")}</p>
            </div>
          </div>
          <div className="admin-mobile-glass p-4">
            <p className="text-zinc-500 text-[10px] font-semibold uppercase mb-1">Transações</p>
            <div className="flex items-baseline gap-2">
              <p className="text-xl font-bold">{data.totalTransactions.toLocaleString("pt-BR")}</p>
            </div>
          </div>
          <div className="admin-mobile-glass p-4">
            <p className="text-zinc-500 text-[10px] font-semibold uppercase mb-1">Saldo em Carteiras</p>
            <p className="text-xl font-bold">{formatCurrency(data.totalBalance)}</p>
          </div>
          <div className="admin-mobile-glass p-4">
            <p className="text-zinc-500 text-[10px] font-semibold uppercase mb-1">Faturado Hoje</p>
            <div className="flex items-baseline gap-2">
              <p className="text-xl font-bold">{formatCurrency(data.todayRevenue)}</p>
              {data.todayRevenue > 0 && <span className="text-[9px] font-bold" style={{ color: '#FF0000' }}>ALTO</span>}
            </div>
          </div>
        </div>
      </section>

      {/* MÉTRICAS DE PRODUTOS */}
      <section>
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">Métricas de Produtos</h2>
        <div className="admin-mobile-glass overflow-hidden">
          <div className="divide-y divide-white/5">
            <div className="p-4 flex items-center justify-between">
              <span className="text-zinc-400 text-sm">Total de Produtos</span>
              <span className="font-bold text-base">{data.totalProducts}</span>
            </div>
            <div className="p-4 flex items-center justify-between">
              <span className="text-zinc-400 text-sm">Disponíveis</span>
              <span className="font-bold text-base text-emerald-400">{data.activeProducts}</span>
            </div>
            <div className="p-4 flex items-center justify-between">
              <span className="text-zinc-400 text-sm">Pedidos Pendentes</span>
              <span className="font-bold text-base text-amber-400">{data.pendingOrders}</span>
            </div>
            <div className="p-4 flex items-center justify-between">
              <span className="text-zinc-400 text-sm">Total Pedidos</span>
              <span className="font-bold text-base">{data.totalOrders.toLocaleString("pt-BR")}</span>
            </div>
            <div className="p-4 flex items-center justify-between">
              <span className="text-zinc-400 text-sm">Taxa de Reposição</span>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: replWidth, backgroundColor: '#E50914' }} />
                </div>
                <span className="font-bold text-sm">{data.replacementRate.toFixed(0)}%</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MOVIMENTAÇÃO DE PAGAMENTOS */}
      <section className="admin-mobile-glass p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1">Movimentação de Pagamentos</h2>
            <p className="text-zinc-500 text-[10px]">Fluxo financeiro (24h)</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold">{formatCurrency(chartTotal || data.todayRevenue)}</p>
            {chartTotal > 0 && (
              <span className="text-emerald-500 text-[9px] font-black uppercase tracking-tighter">Crescimento de 15%</span>
            )}
          </div>
        </div>

        <div className="admin-mobile-chart-container">
          <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 400 160">
            <defs>
              <linearGradient id="gradient-red" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E50914" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#E50914" stopOpacity={0} />
              </linearGradient>
            </defs>
            {/* Horizontal Grid */}
            <line stroke="rgba(255,255,255,0.03)" strokeWidth="1" x1="0" x2="400" y1="40" y2="40" />
            <line stroke="rgba(255,255,255,0.03)" strokeWidth="1" x1="0" x2="400" y1="80" y2="80" />
            <line stroke="rgba(255,255,255,0.03)" strokeWidth="1" x1="0" x2="400" y1="120" y2="120" />
            {/* Area */}
            {areaD && <path className="admin-mobile-chart-area" d={areaD} />}
            {/* Line */}
            {pathD && <path className="admin-mobile-chart-line" d={pathD} />}
            {/* Points */}
            {points.map((p, i) => (
              <circle key={i} className="admin-mobile-chart-point" cx={p.x} cy={p.y} r={i === Math.floor(points.length / 2) ? 4 : 3} />
            ))}
          </svg>
        </div>

        <div className="flex justify-between mt-4 text-[9px] font-bold text-zinc-500 uppercase">
          {data.chartData.map((d, i) => (
            <span key={i}>{d.name}</span>
          ))}
          <span>Agora</span>
        </div>
      </section>

      {/* VOLUME DE VENDAS POR CATEGORIA */}
      <section>
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">Volume de Vendas por Categoria</h2>
        <div className="grid grid-cols-2 gap-3">
          {data.categoryStats.map((cat, i) => {
            const isLast = i === data.categoryStats.length - 1 && data.categoryStats.length % 2 !== 0;
            return (
              <div
                key={cat.name}
                className={`admin-mobile-glass p-4 flex items-center gap-3 ${isLast ? "col-span-2" : ""}`}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(39, 39, 42, 0.5)', color: '#E50914' }}>
                  <span className="material-symbols-outlined text-sm">{cat.icon}</span>
                </div>
                <div className={isLast ? "flex-1 flex justify-between items-center" : ""}>
                  <div>
                    <p className="text-zinc-500 text-[10px] font-bold uppercase">{cat.name}</p>
                    <p className="text-sm font-bold">
                      {cat.sales >= 1000 ? `${(cat.sales / 1000).toFixed(1)}k` : cat.sales} vds
                    </p>
                  </div>
                  {isLast && cat.sales > 0 && (
                    <span className="text-[9px] font-bold text-zinc-600">EM ALTA</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
