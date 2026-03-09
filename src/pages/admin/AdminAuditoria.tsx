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
  Building2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import PurchasesListModal from "@/components/admin/PurchasesListModal";


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
  
  const [projectedProfit, setProjectedProfit] = useState(0);
  const [projectedMargin, setProjectedMargin] = useState(0);
  const [totalMonthlyCosts, setTotalMonthlyCosts] = useState(0);
  const { totalRevenue: proxyRevenue, count: proxyCount } = useProxyRevenue();

  const fetchData = async () => {
    setLoading(true);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const since = thirtyDaysAgo.toISOString();

    const [ordersRes, purchasesRes, costCenterRes] = await Promise.all([
      supabase
        .from("orders")
        .select("total, updated_at")
        .in("status", ["completed", "delivered"])
        .gte("created_at", since),
      supabase
        .from("purchases")
        .select("total_value, quantity, unit_value, sale_price, tax_rate, updated_at")
        .gte("created_at", since),
      supabase
        .from("cost_center")
        .select("amount, active")
        .eq("active", true),
    ]);

    const orders = ordersRes.data ?? [];
    const purchases = purchasesRes.data ?? [];

    const revenue = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const cost = purchases.reduce((sum, p) => sum + Number(p.total_value || 0), 0);

    // Calcular projeção de lucro baseado em sale_price e tax_rate das compras
    const projectedRevenue = purchases.reduce((sum, p) => {
      const qty = Number(p.quantity || 0);
      const salePrice = Number(p.sale_price || 0);
      return sum + (qty * salePrice);
    }, 0);
    const totalCostWithTax = purchases.reduce((sum, p) => {
      const qty = Number(p.quantity || 0);
      const unitCost = Number(p.unit_value || 0);
      const tax = Number(p.tax_rate || 0);
      return sum + (qty * unitCost * (1 + tax / 100));
    }, 0);
    const projectedProfit = projectedRevenue - totalCostWithTax;

    const monthlyCosts = (costCenterRes.data ?? []).reduce((s: number, c: any) => s + Number(c.amount || 0), 0);
    setTotalMonthlyCosts(monthlyCosts);

    setTotalRevenue(revenue);
    setTotalCost(cost);
    setProjectedProfit(projectedProfit);
    setProjectedMargin(projectedRevenue > 0 ? Math.round((projectedProfit / projectedRevenue) * 100) : 0);

    const allDates = [
      ...orders.map(o => new Date(o.updated_at)),
      ...purchases.map(p => new Date(p.updated_at)),
    ].filter(d => !isNaN(d.getTime()));
    
    if (allDates.length > 0) {
      setLastUpdate(new Date(Math.max(...allDates.map(d => d.getTime()))));
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const combinedRevenue = totalRevenue + proxyRevenue;
  const profit = combinedRevenue - totalCost;
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
      label: "Projeção de Lucro",
      value: loading ? "..." : formatCurrency(projectedProfit),
      badge: projectedProfit >= 0 ? "Positivo" : "Negativo",
      badgeColor: projectedProfit >= 0 
        ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" 
        : "text-red-400 bg-red-400/10 border-red-400/20",
      icon: TrendingUp,
      iconBg: "bg-primary/20 border-primary/30",
      iconColor: "text-primary",
      subtitle: `Margem estimada: ${projectedMargin}%`,
      highlighted: true
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
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={() => navigate("/admin/auditoria/nova-compra")}
              className="group flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium text-white shadow-lg bg-white/5 backdrop-blur-lg border border-white/10 hover:bg-primary/15 hover:border-primary/40 hover:-translate-y-0.5 transition-all"
            >
              <ShoppingCart className="size-5 group-hover:text-primary transition-colors" />
              Nova Compra
            </button>
            <button 
              onClick={() => navigate("/admin/auditoria/nova-venda")}
              className="group flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium text-white shadow-lg bg-white/5 backdrop-blur-lg border border-white/10 hover:bg-primary/15 hover:border-primary/40 hover:-translate-y-0.5 transition-all"
            >
              <Tag className="size-5 group-hover:text-primary transition-colors" />
              Nova Venda
            </button>
            <button 
              onClick={() => navigate("/admin/auditoria/balanco")}
              className="group flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium text-white shadow-lg bg-white/5 backdrop-blur-lg border border-white/10 hover:bg-primary/15 hover:border-primary/40 hover:-translate-y-0.5 transition-all"
            >
              <BarChart3 className="size-5 group-hover:text-primary transition-colors" />
              Ver Detalhes do Balanço
            </button>
          </div>
        </header>

        {/* Metrics Dashboard */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <div 
              key={index}
              onClick={stat.onClick}
              className={`bg-white/[0.03] backdrop-blur-2xl border rounded-2xl p-5 relative overflow-hidden group transition-all duration-500 ${
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
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-xl border ${stat.iconBg}`}>
                    <stat.icon className={`size-6 ${stat.iconColor}`} />
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
                        ? "text-2xl lg:text-3xl font-black text-white drop-shadow-lg" 
                        : "text-2xl lg:text-3xl font-bold text-white"
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

        {/* Last Update */}
        <div className="w-full bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 opacity-80 hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
              {loading ? <Loader2 className="size-5 text-gray-400 animate-spin" /> : <History className="size-5 text-gray-400" />}
            </div>
            <div>
              <p className="text-sm text-white font-medium">Última atualização do sistema</p>
              <p className="text-xs text-gray-500">
                {lastUpdate ? `${timeAgo(lastUpdate)} • Sincronizado automaticamente` : "Sem dados recentes"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-50 pointer-events-none" />

      <PurchasesListModal
        open={showPurchases}
        onClose={() => setShowPurchases(false)}
        onUpdate={fetchData}
      />
    </div>
  );
}
