import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, ShoppingCart, Wallet, TrendingUp, Percent, Tag, Timer, Download,
  ChevronDown, ChevronLeft, ChevronRight, BarChart3, Search, ArrowUp, ArrowDown, Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";

const timeFilters = ["7 Dias", "30 Dias", "Ano Atual"];
const chartFilters = ["Lucro", "Custos", "Receitas"];

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Transaction {
  type: "VENDA" | "COMPRA";
  item: string;
  partner: string;
  date: string;
  value: number;
  qty: number;
}

export default function AdminBalanco() {
  const navigate = useNavigate();
  const [activeTimeFilter, setActiveTimeFilter] = useState("30 Dias");
  const [activeChartFilter, setActiveChartFilter] = useState("Lucro");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Real data states
  const [totalCost, setTotalCost] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [avgCostPerItem, setAvgCostPerItem] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [chartData, setChartData] = useState<{ name: string; revenue: number; cost: number; profit: number }[]>([]);
  const [categoryData, setCategoryData] = useState<{ name: string; cost: number; revenue: number }[]>([]);

  const getSinceDate = () => {
    const now = new Date();
    switch (activeTimeFilter) {
      case "7 Dias": now.setDate(now.getDate() - 7); break;
      case "30 Dias": now.setDate(now.getDate() - 30); break;
      case "Ano Atual": now.setMonth(0, 1); break;
    }
    return now.toISOString();
  };

  useEffect(() => {
    fetchData();
  }, [activeTimeFilter]);

  const fetchData = async () => {
    setLoading(true);
    const since = getSinceDate();

    const [ordersRes, purchasesRes, orderItemsRes, categoriesRes, productsRes] = await Promise.all([
      supabase.from("orders").select("id, total, status, created_at, code").in("status", ["completed", "delivered"]).gte("created_at", since).order("created_at", { ascending: false }),
      supabase.from("purchases").select("*").gte("created_at", since).order("created_at", { ascending: false }),
      supabase.from("order_items").select("product_id, price, quantity, order_id, name, created_at").gte("created_at", since),
      supabase.from("product_categories").select("id, name"),
      supabase.from("products").select("id, category_id, name"),
    ]);

    const orders = ordersRes.data ?? [];
    const purchases = purchasesRes.data ?? [];
    const orderItems = orderItemsRes.data ?? [];
    const categories = categoriesRes.data ?? [];
    const products = productsRes.data ?? [];

    // Completed order IDs for filtering
    const completedOrderIds = new Set(orders.map(o => o.id));

    // Revenue = sum of completed orders
    const revenue = orders.reduce((s, o) => s + Number(o.total || 0), 0);
    // Cost = sum of purchases
    const cost = purchases.reduce((s, p) => s + Number(p.total_value || 0), 0);

    setTotalRevenue(revenue);
    setTotalCost(cost);
    setAvgCostPerItem(purchases.length > 0 ? cost / purchases.reduce((s, p) => s + (p.quantity || 1), 0) : 0);

    // Build transactions list (mixed sales + purchases)
    const txList: Transaction[] = [
      ...orders.map(o => ({
        type: "VENDA" as const,
        item: `Pedido ${o.code}`,
        partner: "-",
        date: new Date(o.created_at).toLocaleDateString("pt-BR"),
        value: Number(o.total),
        qty: 1,
      })),
      ...purchases.map(p => ({
        type: "COMPRA" as const,
        item: p.item_type,
        partner: p.provider_name,
        date: new Date(p.purchase_date).toLocaleDateString("pt-BR"),
        value: Number(p.total_value),
        qty: p.quantity,
      })),
    ];
    txList.sort((a, b) => {
      const da = a.date.split("/").reverse().join("");
      const db = b.date.split("/").reverse().join("");
      return db.localeCompare(da);
    });
    setTransactions(txList);

    // Chart data: group by day/week
    const chartMap: Record<string, { revenue: number; cost: number }> = {};
    orders.forEach(o => {
      const key = new Date(o.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
      if (!chartMap[key]) chartMap[key] = { revenue: 0, cost: 0 };
      chartMap[key].revenue += Number(o.total);
    });
    purchases.forEach(p => {
      const key = new Date(p.purchase_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
      if (!chartMap[key]) chartMap[key] = { revenue: 0, cost: 0 };
      chartMap[key].cost += Number(p.total_value);
    });
    setChartData(
      Object.entries(chartMap).slice(-10).map(([name, d]) => ({
        name,
        revenue: d.revenue,
        cost: d.cost,
        profit: d.revenue - d.cost,
      }))
    );

    // Category breakdown
    const prodCatMap: Record<string, string> = {};
    products.forEach(p => { if (p.category_id) prodCatMap[p.id] = p.category_id; });
    const catMap: Record<string, { cost: number; revenue: number }> = {};
    orderItems.filter(i => completedOrderIds.has(i.order_id)).forEach(item => {
      const catId = item.product_id ? prodCatMap[item.product_id] : null;
      if (catId) {
        if (!catMap[catId]) catMap[catId] = { cost: 0, revenue: 0 };
        catMap[catId].revenue += item.price * item.quantity;
      }
    });
    setCategoryData(categories.map(c => ({
      name: c.name,
      cost: catMap[c.id]?.cost ?? 0,
      revenue: catMap[c.id]?.revenue ?? 0,
    })).filter(c => c.revenue > 0));

    setLoading(false);
  };

  const profit = totalRevenue - totalCost;
  const margin = totalRevenue > 0 ? ((profit / totalRevenue) * 100).toFixed(1) : "0";

  const filteredTx = transactions.filter(tx =>
    tx.item.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tx.partner.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const chartKey = activeChartFilter === "Lucro" ? "profit" : activeChartFilter === "Custos" ? "cost" : "revenue";
  const chartColor = activeChartFilter === "Custos" ? "#f90606" : activeChartFilter === "Receitas" ? "#22c55e" : "#ffffff";

  const stats = [
    { label: "Custo Total Compras", value: formatCurrency(totalCost), icon: ShoppingCart, iconBg: "bg-primary/10 border-primary/20", iconColor: "text-primary" },
    { label: "Receita Total Vendas", value: formatCurrency(totalRevenue), icon: Wallet, iconBg: "bg-emerald-500/10 border-emerald-500/20", iconColor: "text-emerald-500" },
    { label: "Lucro Líquido", value: formatCurrency(profit), icon: TrendingUp, iconBg: "bg-white/10 border-white/20", iconColor: "text-white", highlighted: true },
    { label: "Margem Média", value: `${margin}%`, icon: Percent, iconBg: "bg-white/5 border-white/10", iconColor: "text-gray-300" },
    { label: "Custo Médio / Item", value: formatCurrency(avgCostPerItem), icon: Tag, iconBg: "bg-white/5 border-white/10", iconColor: "text-gray-300" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)] -mx-6 -mt-6 p-4 lg:p-6 gap-6 relative">
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] mix-blend-screen opacity-40" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px] mix-blend-screen opacity-30" />
      </div>

      <div className="relative z-10 w-full max-w-[1600px] mx-auto flex flex-col gap-6">
        {/* Header */}
        <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 pb-2 border-b border-white/5">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate("/admin/auditoria")}
              className="p-2.5 rounded-full bg-white/5 backdrop-blur-lg border border-white/10 text-gray-400 hover:text-white hover:bg-primary/15 hover:border-primary/40 transition-all group"
            >
              <ArrowLeft className="size-5 group-hover:-translate-x-0.5 transition-transform" />
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
                Balanço Financeiro <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-white">Consolidado</span>
              </h1>
              <p className="text-gray-400 text-xs font-light mt-1">Dados reais de vendas e compras.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
            <div className="flex bg-black/40 p-1 rounded-lg border border-white/5 overflow-hidden">
              {timeFilters.map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveTimeFilter(filter)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    activeTimeFilter === filter
                      ? "bg-white/10 text-white shadow-sm"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Stats Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {stats.map((stat, index) => (
            <div 
              key={index}
              className={`bg-white/[0.03] backdrop-blur-2xl border rounded-xl p-4 relative overflow-hidden group hover:border-white/20 transition-colors ${
                stat.highlighted ? "border-primary/30 bg-primary/5" : "border-white/10"
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className={`p-1.5 rounded-md border ${stat.iconBg}`}>
                  <stat.icon className={`size-4 ${stat.iconColor}`} />
                </div>
              </div>
              <h3 className="text-gray-400 text-[10px] font-medium uppercase tracking-wider">{stat.label}</h3>
              <div className={`text-xl mt-0.5 ${stat.highlighted ? "font-black" : "font-bold"} text-white`}>
                {stat.value}
              </div>
            </div>
          ))}
        </section>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Chart */}
          <div className="xl:col-span-3">
            <section className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl p-6">
              <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <BarChart3 className="size-5 text-primary" />
                  Evolução Financeira
                </h2>
                <div className="flex gap-2 bg-black/30 p-1 rounded-lg">
                  {chartFilters.map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setActiveChartFilter(filter)}
                      className={`px-3 py-1 rounded-md text-xs transition-all ${
                        activeChartFilter === filter
                          ? "bg-white/10 border border-white/20 text-white"
                          : "text-gray-400 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-52">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} barCategoryGap="20%">
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        contentStyle={{ background: 'rgba(0,0,0,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                        formatter={(value: number) => [formatCurrency(value), activeChartFilter]}
                        labelStyle={{ color: 'white' }}
                      />
                      <Bar dataKey={chartKey} radius={[4, 4, 0, 0]} fill={chartColor} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-white/40 text-sm">Nenhum dado no período selecionado.</div>
                )}
              </div>
            </section>
          </div>

          {/* Category Sidebar */}
          <div className="xl:col-span-1 flex flex-col gap-6">
            <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-white mb-4">Receita por Categoria</h3>
              {categoryData.length > 0 ? (
                <div className="space-y-3">
                  {categoryData.map((cat, i) => {
                    const maxRev = Math.max(...categoryData.map(c => c.revenue));
                    const pct = maxRev > 0 ? (cat.revenue / maxRev) * 100 : 0;
                    return (
                      <div key={cat.name}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-300">{cat.name}</span>
                          <span className="text-white font-bold">{formatCurrency(cat.revenue)}</span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-500 text-center py-4">Nenhum dado de categoria.</p>
              )}
            </div>

            {/* Recent Transactions sidebar */}
            <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden flex-grow flex flex-col">
              <div className="p-4 border-b border-white/5 bg-white/5">
                <h3 className="text-sm font-semibold text-white">Lançamentos Recentes</h3>
              </div>
              <div className="flex-grow overflow-y-auto max-h-[300px]">
                <ul className="divide-y divide-white/5">
                  {transactions.slice(0, 8).map((tx, idx) => (
                    <li key={idx} className="p-3 hover:bg-white/5 transition-colors flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-white">{tx.item}</span>
                        <span className="text-[10px] text-gray-500">{tx.date} • {tx.partner}</span>
                      </div>
                      <span className={`text-xs font-bold ${tx.type === "VENDA" ? "text-emerald-400" : "text-red-400"}`}>
                        {tx.type === "VENDA" ? "+" : "-"}{formatCurrency(tx.value)}
                      </span>
                    </li>
                  ))}
                  {transactions.length === 0 && (
                    <li className="p-4 text-center text-gray-500 text-xs">Nenhum lançamento.</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <section className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
            <h2 className="text-lg font-semibold text-white">Detalhes de Transações</h2>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 size-4" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar item, fornecedor..."
                className="w-full pl-10 pr-4 py-2 text-sm rounded-lg bg-black/30 border border-white/10 text-white placeholder-gray-600 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-400">
              <thead className="bg-white/5 text-xs uppercase font-semibold text-white">
                <tr>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4">Item</th>
                  <th className="px-6 py-4">Fornecedor/Cliente</th>
                  <th className="px-6 py-4">Data</th>
                  <th className="px-6 py-4 text-right">Valor</th>
                  <th className="px-6 py-4 text-center">Qtd</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredTx.length > 0 ? filteredTx.slice(0, 20).map((row, idx) => (
                  <tr key={idx} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-medium uppercase tracking-wide ${
                        row.type === "VENDA"
                          ? "bg-white/10 text-white border border-white/20"
                          : "bg-primary/10 text-red-400 border border-red-500/20"
                      }`}>
                        {row.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-white group-hover:text-primary transition-colors">{row.item}</td>
                    <td className="px-6 py-4">{row.partner}</td>
                    <td className="px-6 py-4">{row.date}</td>
                    <td className={`px-6 py-4 text-right font-bold ${row.type === "VENDA" ? "text-emerald-400" : "text-red-400"}`}>
                      {row.type === "VENDA" ? "+" : "-"}{formatCurrency(row.value)}
                    </td>
                    <td className="px-6 py-4 text-center">{row.qty}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">Nenhuma transação encontrada.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between p-4 border-t border-white/5">
            <span className="text-xs text-gray-500">
              Mostrando {Math.min(filteredTx.length, 20)} de {filteredTx.length} transações
            </span>
          </div>
        </section>
      </div>

      <div className="fixed bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-50 pointer-events-none" />
    </div>
  );
}
