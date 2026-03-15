import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useProxyRevenue } from "@/hooks/useProxyRevenue";
import { 
  ShoppingBag, 
  Wallet, 
  TrendingUp, 
  ShoppingCart, 
  Tag, 
  BarChart3,
  History,
  Loader2,
  Building2,
  Package,
  Landmark
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import PurchasesListModal from "@/components/admin/PurchasesListModal";
import MonthlyGoalModal from "@/components/admin/MonthlyGoalModal";
import { Target } from "lucide-react";
import MotivationalQuote from "@/components/admin/MotivationalQuote";


const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const timeAgo = (date: Date) => {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "Agora mesmo";
  if (mins < 60) return `Há ${mins} minutos`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Há ${hours}h`;
  return `Há ${Math.floor(hours / 24)}d`;
};

export default function AdminAuditoria() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [totalCost, setTotalCost] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [showPurchases, setShowPurchases] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [monthlyGoal, setMonthlyGoal] = useState<{ revenue: number; profit: number; sales: number } | null>(null);

  const [projectedProfit, setProjectedProfit] = useState(0);
  const [projectedMargin, setProjectedMargin] = useState(0);
  const [totalMonthlyCosts, setTotalMonthlyCosts] = useState(0);
  const [stockValue, setStockValue] = useState(0);
  const [stockItemCount, setStockItemCount] = useState(0);
  const { totalRevenue: proxyRevenue, count: proxyCount } = useProxyRevenue();

  const fetchData = async () => {
    setLoading(true);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const since = thirtyDaysAgo.toISOString();

    const [ordersRes, orderItemsRes, productsRes, productCostsRes, purchasesRes, costCenterRes, webShareRes, stockItemsRes] = await Promise.all([
      supabase
        .from("orders")
        .select("id, total, updated_at")
        .in("status", ["completed", "delivered"])
        .gte("created_at", since),
      supabase
        .from("order_items")
        .select("order_id, product_id, name, price, quantity"),
      supabase
        .from("products")
        .select("id, name, icon_type, external_id"),
      supabase
        .from("product_costs")
        .select("product_id, unit_cost, labor_cost, other_costs, tax_percent"),
      supabase
        .from("purchases")
        .select("total_value, quantity, unit_value, sale_price, tax_rate, updated_at")
        .gte("created_at", since),
      supabase
        .from("cost_center")
        .select("amount, active")
        .eq("active", true),
      supabase.functions.invoke("webshare-api", { body: { action: "get-plan" } }).catch(() => ({ data: null })),
      supabase
        .from("stock_items")
        .select("product_id")
        .eq("status", "revisado")
        .is("order_item_id", null)
        .is("deleted_at", null),
    ]);

    const orders = ordersRes.data ?? [];
    const orderItems = orderItemsRes.data ?? [];
    const products = productsRes.data ?? [];
    const productCosts = productCostsRes.data ?? [];
    const purchases = purchasesRes.data ?? [];

    // Build product cost map (same logic as AdminBalanco)
    const productCostMap: Record<string, any> = {};
    productCosts.forEach((c: any) => { productCostMap[c.product_id] = c; });

    // Webshare auto-cost
    const autoCostMap: Record<string, number> = {};
    let usdToBrl = 5.5;
    try {
      const rateResp = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL");
      const rateData = await rateResp.json();
      usdToBrl = parseFloat(rateData?.USDBRL?.bid) || 5.5;
    } catch {}

    if (webShareRes.data) {
      const plan = webShareRes.data?.plan;
      const monthlyPrice = plan?.monthly_price || 0;
      let totalPlanProxies = plan?.proxy_count || 1;
      const costPerProxy = (monthlyPrice / totalPlanProxies) * usdToBrl;
      if (costPerProxy > 0) {
        products.forEach((p: any) => {
          if (p.icon_type === 'proxy' && !p.external_id) autoCostMap[p.id] = costPerProxy;
        });
      }
    }

    const getProductTotalCost = (productId: string): number => {
      const c = productCostMap[productId];
      const unitCost = (c && c.unit_cost > 0) ? c.unit_cost : (autoCostMap[productId] || 0);
      if (unitCost <= 0 && (!c || (c.labor_cost <= 0 && c.other_costs <= 0))) return 0;
      const laborCost = c?.labor_cost || 0;
      const otherCosts = c?.other_costs || 0;
      const taxPercent = c?.tax_percent || 0;
      return (unitCost + laborCost + otherCosts) * (1 + taxPercent / 100);
    };

    const completedOrderIds = new Set(orders.map(o => o.id));
    const revenue = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);

    // COGS based on sold items (same as Balanço)
    const productByName: Record<string, any> = {};
    products.forEach(p => { productByName[p.name.toLowerCase().trim()] = p; });
    let cogs = 0;
    orderItems.filter(i => completedOrderIds.has(i.order_id)).forEach(item => {
      let productId = item.product_id;
      if (!productId && item.name) {
        const match = productByName[item.name.toLowerCase().trim()];
        if (match) productId = match.id;
      }
      if (productId) {
        cogs += getProductTotalCost(productId) * (item.quantity || 1);
      }
    });

    // Projeção de lucro (baseado em purchases)
    const projectedRevenue = purchases.reduce((sum, p) => sum + (Number(p.quantity || 0) * Number(p.sale_price || 0)), 0);
    const totalCostWithTax = purchases.reduce((sum, p) => {
      const qty = Number(p.quantity || 0);
      const unitCost = Number(p.unit_value || 0);
      const tax = Number(p.tax_rate || 0);
      return sum + (qty * unitCost * (1 + tax / 100));
    }, 0);

    const monthlyCosts = (costCenterRes.data ?? []).reduce((s: number, c: any) => s + Number(c.amount || 0), 0);
    setTotalMonthlyCosts(monthlyCosts);

    // Stock value: sum cost of all "revisado" items in stock (exclude proxies)
    const proxyProductIds = new Set(products.filter((p: any) => p.icon_type === 'proxy').map((p: any) => p.id));
    const stockItems = (stockItemsRes.data ?? []).filter((si: any) => si.product_id && !proxyProductIds.has(si.product_id));
    let totalStockVal = 0;
    let totalStockCount = 0;
    stockItems.forEach((si: any) => {
      totalStockVal += getProductTotalCost(si.product_id);
      totalStockCount++;
    });
    setStockValue(totalStockVal);
    setStockItemCount(totalStockCount);

    setTotalRevenue(revenue);
    setTotalCost(cogs);
    setProjectedProfit(projectedRevenue - totalCostWithTax);
    setProjectedMargin(projectedRevenue > 0 ? Math.round(((projectedRevenue - totalCostWithTax) / projectedRevenue) * 100) : 0);

    const allDates = [
      ...orders.map(o => new Date(o.updated_at)),
      ...purchases.map(p => new Date(p.updated_at)),
    ].filter(d => !isNaN(d.getTime()));
    
    if (allDates.length > 0) {
      setLastUpdate(new Date(Math.max(...allDates.map(d => d.getTime()))));
    }

    setLoading(false);
  };

  const fetchGoals = async () => {
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "monthly_goals")
      .maybeSingle();
    if (data?.value) {
      try { setMonthlyGoal(JSON.parse(data.value)); } catch { /* */ }
    }
  };

  useEffect(() => {
    fetchData();
    fetchGoals();
  }, []);

  const combinedRevenue = totalRevenue + proxyRevenue;
  const profit = combinedRevenue - totalCost - totalMonthlyCosts;
  const margin = combinedRevenue > 0 ? Math.round((profit / combinedRevenue) * 100) : 0;

  const stats = [
    {
      label: "Centro de Custos",
      value: loading ? "..." : formatCurrency(totalMonthlyCosts),
      badge: "Operacional",
      badgeColor: "text-amber-400 bg-amber-400/10 border-amber-400/20",
      icon: Building2,
      iconBg: "bg-white/5 border-white/10",
      iconColor: "text-amber-400",
      subtitle: "Custos fixos + variáveis",
      highlighted: false,
      onClick: () => navigate("/admin/auditoria/centro-custos"),
    },
    {
      label: "Central de Investimentos",
      value: loading ? "..." : formatCurrency(totalCost),
      badge: "Saída",
      badgeColor: "text-red-400 bg-red-400/10 border-red-400/20",
      icon: ShoppingBag,
      iconBg: "bg-white/5 border-white/10",
      iconColor: "text-gray-300",
      subtitle: "Últimos 30 dias",
      highlighted: false,
      onClick: () => navigate("/admin/auditoria/investimentos"),
    },
    {
      label: "Estoque Atual",
      value: loading ? "..." : formatCurrency(stockValue),
      badge: "Investido",
      badgeColor: "text-blue-400 bg-blue-400/10 border-blue-400/20",
      icon: Package,
      iconBg: "bg-blue-500/10 border-blue-500/20",
      iconColor: "text-blue-400",
      subtitle: `${stockItemCount} itens em estoque`,
      highlighted: false,
      onClick: () => navigate("/admin/estoque"),
    },
    {
      label: "Receita Total de Vendas",
      value: loading ? "..." : formatCurrency(combinedRevenue),
      badge: "Entrada",
      badgeColor: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
      icon: Wallet,
      iconBg: "bg-white/5 border-white/10",
      iconColor: "text-gray-300",
      subtitle: `Pedidos + ${proxyCount} proxies ativos`,
      highlighted: false
    },
    {
      label: "Lucro Líquido",
      value: loading ? "..." : formatCurrency(profit),
      badge: profit >= 0 ? "Positivo" : "Negativo",
      badgeColor: profit >= 0 
        ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" 
        : "text-red-400 bg-red-400/10 border-red-400/20",
      icon: TrendingUp,
      iconBg: "bg-primary/20 border-primary/30",
      iconColor: "text-primary",
      subtitle: `Receita − Custos de compra − Custos fixos`,
      highlighted: true,
    }
  ];

  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)] -mx-6 -mt-6 p-6 lg:p-12 gap-10 relative">
      {/* Background Effects */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] mix-blend-screen opacity-40" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px] mix-blend-screen opacity-30" />
        <div className="absolute top-[40%] left-[50%] -translate-x-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[150px] mix-blend-screen opacity-20" />
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto flex flex-col gap-10">
        {/* Header Section */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white leading-tight">
              Visão Geral da <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500">Auditoria</span>
            </h1>
            <p className="text-gray-400 text-lg font-light max-w-lg">
              Resumo financeiro de Perfis, BMs e Páginas.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => navigate("/admin/auditoria/nova-compra")}
              className="group flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium text-white shadow-lg bg-white/5 backdrop-blur-lg border border-white/10 hover:bg-primary/15 hover:border-primary/40 hover:-translate-y-0.5 transition-all"
            >
              <ShoppingCart className="size-4 group-hover:text-primary transition-colors" />
              Nova Compra
            </button>
            <button 
              onClick={() => navigate("/admin/auditoria/nova-venda")}
              className="group flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium text-white shadow-lg bg-white/5 backdrop-blur-lg border border-white/10 hover:bg-primary/15 hover:border-primary/40 hover:-translate-y-0.5 transition-all"
            >
              <Tag className="size-4 group-hover:text-primary transition-colors" />
              Nova Venda
            </button>
            <button 
              onClick={() => navigate("/admin/auditoria/balanco")}
              className="group flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium text-white shadow-lg bg-white/5 backdrop-blur-lg border border-white/10 hover:bg-primary/15 hover:border-primary/40 hover:-translate-y-0.5 transition-all"
            >
              <BarChart3 className="size-4 group-hover:text-primary transition-colors" />
              Balanço
            </button>
            <button 
              onClick={() => navigate("/admin/auditoria/caixa")}
              className="group flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium text-white shadow-lg bg-white/5 backdrop-blur-lg border border-white/10 hover:bg-primary/15 hover:border-primary/40 hover:-translate-y-0.5 transition-all"
            >
              <Landmark className="size-4 group-hover:text-primary transition-colors" />
              Caixa
            </button>
          </div>
        </header>

        {/* Metrics Dashboard */}
        <section className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {stats.map((stat, index) => (
            <div 
              key={index}
              onClick={stat.onClick}
              className={`bg-white/[0.03] backdrop-blur-2xl border rounded-xl p-4 relative overflow-hidden group transition-all duration-500 ${
                stat.highlighted 
                  ? "border-primary/30 shadow-[0_0_40px_-10px_rgba(249,6,6,0.15)]" 
                  : "border-white/10"
              } ${stat.onClick ? "cursor-pointer hover:border-white/30" : ""}`}
            >
              {stat.highlighted && (
                <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-50" />
              )}
              
              <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl transition-all duration-500 ${
                stat.highlighted 
                  ? "bg-primary/20 group-hover:bg-primary/30" 
                  : "bg-primary/10 group-hover:bg-primary/20"
              }`} />

              <div className="relative z-10">
                <div className="flex justify-between items-start mb-3">
                  <div className={`p-2 rounded-lg border ${stat.iconBg}`}>
                    <stat.icon className={`size-5 ${stat.iconColor}`} />
                  </div>
                  <span className={`flex items-center text-xs font-semibold px-2 py-1 rounded-md border ${stat.badgeColor}`}>
                    {stat.badge}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <h3 className={`text-sm font-medium uppercase tracking-wider ${stat.highlighted ? "text-gray-300 font-bold" : "text-gray-400"}`}>
                    {stat.label}
                  </h3>
                  <div className="flex items-baseline gap-2">
                    <span className={`tracking-tight ${
                      stat.highlighted 
                        ? "text-xl lg:text-2xl font-black text-white drop-shadow-lg" 
                        : "text-xl lg:text-2xl font-bold text-white"
                    }`}>
                      {stat.value}
                    </span>
                  </div>
                  <p className={`text-xs mt-2 ${stat.highlighted ? "text-gray-400 font-medium" : "text-gray-500 font-mono opacity-60"}`}>
                    {stat.subtitle}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Monthly Goal + Last Update */}
        <div 
          onClick={() => setShowGoalModal(true)}
          className="w-full bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-xl p-6 cursor-pointer hover:border-white/20 transition-all group"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 group-hover:bg-primary/20 transition-colors">
                <Target className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-white font-medium">Meta do Mês</p>
                <p className="text-xs text-muted-foreground">
                  {monthlyGoal?.revenue 
                    ? `Meta: ${formatCurrency(monthlyGoal.revenue)} • Clique para editar`
                    : "Clique para definir suas metas mensais"
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {loading ? <Loader2 className="size-3 animate-spin" /> : <History className="size-3" />}
                {lastUpdate ? timeAgo(lastUpdate) : "—"}
              </div>
              {monthlyGoal?.revenue ? (
                <span className={`text-sm font-bold ${
                  Math.round((combinedRevenue / monthlyGoal.revenue) * 100) >= 100 
                    ? "text-green-400" 
                    : "text-white"
                }`}>
                  {Math.min(100, Math.round((combinedRevenue / monthlyGoal.revenue) * 100))}%
                </span>
              ) : null}
            </div>
          </div>

          {/* Progress Bar */}
          {monthlyGoal?.revenue ? (() => {
            const pct = Math.min(100, Math.round((combinedRevenue / monthlyGoal.revenue) * 100));
            const remaining = Math.max(0, monthlyGoal.revenue - combinedRevenue);
            return (
              <div className="space-y-2">
                <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000 ease-out"
                    style={{
                      width: `${pct}%`,
                      background: pct >= 100
                        ? "linear-gradient(90deg, hsl(var(--primary)), #22c55e)"
                        : pct >= 70
                        ? "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))"
                        : "hsl(var(--primary) / 0.8)",
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatCurrency(combinedRevenue)}</span>
                  <span>
                    {pct >= 100 
                      ? "🎯 Meta batida!" 
                      : `Faltam ${formatCurrency(remaining)}`
                    }
                  </span>
                </div>
              </div>
            );
          })() : (
            <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full w-0 rounded-full" />
            </div>
          )}
        </div>

        {/* Motivational Quote */}
        <MotivationalQuote />
      </div>

      <div className="fixed bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-50 pointer-events-none" />

      <PurchasesListModal
        open={showPurchases}
        onClose={() => setShowPurchases(false)}
        onUpdate={fetchData}
      />

      <MonthlyGoalModal
        open={showGoalModal}
        onClose={() => setShowGoalModal(false)}
        currentRevenue={combinedRevenue}
        onSaved={fetchGoals}
      />
    </div>
  );
}
