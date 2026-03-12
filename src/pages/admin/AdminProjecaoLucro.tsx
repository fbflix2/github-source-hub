import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Building2,
  Package,
  Loader2,
  DollarSign,
  Percent,
  ShoppingBag,
  AlertTriangle,
} from "lucide-react";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Purchase {
  id: string;
  item_type: string;
  provider_name: string;
  description: string | null;
  quantity: number;
  unit_value: number;
  sale_price: number;
  tax_rate: number;
  total_value: number;
  purchase_date: string;
  created_at: string;
}

interface CostCenter {
  id: string;
  name: string;
  amount: number;
  type: string;
  recurrence: string | null;
  active: boolean;
}

export default function AdminProjecaoLucro() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [costCenter, setCostCenter] = useState<CostCenter[]>([]);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const since = thirtyDaysAgo.toISOString();

      const [pRes, cRes] = await Promise.all([
        supabase
          .from("purchases")
          .select("*")
          .gte("created_at", since)
          .order("created_at", { ascending: false }),
        supabase
          .from("cost_center")
          .select("*")
          .eq("active", true),
      ]);

      setPurchases(pRes.data ?? []);
      setCostCenter(cRes.data ?? []);
      setLoading(false);
    };
    fetch();
  }, []);

  const totals = useMemo(() => {
    let projectedRevenue = 0;
    let totalCOGS = 0;

    const items = purchases.map((p) => {
      const qty = Number(p.quantity || 0);
      const unit = Number(p.unit_value || 0);
      const tax = Number(p.tax_rate || 0);
      const sale = Number(p.sale_price || 0);

      const costWithTax = qty * unit * (1 + tax / 100);
      const revenue = qty * sale;
      const grossProfit = revenue - costWithTax;
      const margin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

      projectedRevenue += revenue;
      totalCOGS += costWithTax;

      return { ...p, costWithTax, revenue, grossProfit, margin };
    });

    const monthlyCosts = costCenter.reduce(
      (s, c) => s + Number(c.amount || 0),
      0
    );

    const grossProfit = projectedRevenue - totalCOGS;
    const realProfit = grossProfit - monthlyCosts;
    const grossMargin =
      projectedRevenue > 0 ? (grossProfit / projectedRevenue) * 100 : 0;
    const realMargin =
      projectedRevenue > 0 ? (realProfit / projectedRevenue) * 100 : 0;

    return {
      items,
      projectedRevenue,
      totalCOGS,
      grossProfit,
      monthlyCosts,
      realProfit,
      grossMargin,
      realMargin,
    };
  }, [purchases, costCenter]);

  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)] -mx-6 -mt-6 p-6 lg:p-12 gap-8 relative">
      {/* Background */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] mix-blend-screen opacity-40" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px] mix-blend-screen opacity-30" />
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto flex flex-col gap-8">
        {/* Header */}
        <header className="flex flex-col gap-4">
          <button
            onClick={() => navigate("/admin/auditoria")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-white transition-colors w-fit"
          >
            <ArrowLeft className="size-4" />
            Voltar para Auditoria
          </button>
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
              Projeção de{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-600">
                Lucro
              </span>
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Análise detalhada dos últimos 30 dias — Compras, custos e margens.
            </p>
          </div>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <SummaryCard
                icon={ShoppingBag}
                label="COGS Total"
                value={fmt(totals.totalCOGS)}
                subtitle="Custo dos produtos vendidos"
                color="text-red-400"
                bgColor="bg-red-400/10 border-red-400/20"
              />
              <SummaryCard
                icon={DollarSign}
                label="Receita Projetada"
                value={fmt(totals.projectedRevenue)}
                subtitle="Se tudo for vendido"
                color="text-emerald-400"
                bgColor="bg-emerald-400/10 border-emerald-400/20"
              />
              <SummaryCard
                icon={TrendingUp}
                label="Lucro Bruto"
                value={fmt(totals.grossProfit)}
                subtitle={`Margem: ${totals.grossMargin.toFixed(1)}%`}
                color={totals.grossProfit >= 0 ? "text-emerald-400" : "text-red-400"}
                bgColor={totals.grossProfit >= 0 ? "bg-emerald-400/10 border-emerald-400/20" : "bg-red-400/10 border-red-400/20"}
              />
              <SummaryCard
                icon={Building2}
                label="Lucro Real"
                value={fmt(totals.realProfit)}
                subtitle={`Após ${fmt(totals.monthlyCosts)} de custos fixos`}
                color={totals.realProfit >= 0 ? "text-emerald-400" : "text-red-400"}
                bgColor={totals.realProfit >= 0 ? "bg-emerald-400/10 border-emerald-400/20" : "bg-red-400/10 border-red-400/20"}
                highlighted
              />
            </section>

            {/* Cost Center Breakdown */}
            {costCenter.length > 0 && (
              <section className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-4">
                  <Building2 className="size-5 text-amber-400" />
                  <h2 className="text-white font-semibold">
                    Centro de Custos Descontados
                  </h2>
                  <span className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-md font-medium">
                    {fmt(totals.monthlyCosts)}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {costCenter.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between bg-white/[0.03] border border-white/5 rounded-xl px-4 py-3"
                    >
                      <div>
                        <p className="text-sm text-white font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {c.type} • {c.recurrence || "mensal"}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-amber-400">
                        {fmt(Number(c.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Purchases Table */}
            <section className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden">
              <div className="flex items-center gap-3 p-5 border-b border-white/5">
                <Package className="size-5 text-primary" />
                <h2 className="text-white font-semibold">
                  Itens Comprados ({totals.items.length})
                </h2>
              </div>

              {totals.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                  <AlertTriangle className="size-6" />
                  <p className="text-sm">Nenhuma compra nos últimos 30 dias</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5 text-xs text-muted-foreground uppercase tracking-wider">
                        <th className="text-left px-5 py-3 font-medium">Item</th>
                        <th className="text-left px-3 py-3 font-medium">Fornecedor</th>
                        <th className="text-center px-3 py-3 font-medium">Qtd</th>
                        <th className="text-right px-3 py-3 font-medium">Custo Unit.</th>
                        <th className="text-right px-3 py-3 font-medium">Taxa</th>
                        <th className="text-right px-3 py-3 font-medium">COGS Total</th>
                        <th className="text-right px-3 py-3 font-medium">Preço Venda</th>
                        <th className="text-right px-3 py-3 font-medium">Receita Proj.</th>
                        <th className="text-right px-3 py-3 font-medium">Lucro Bruto</th>
                        <th className="text-right px-5 py-3 font-medium">Margem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {totals.items.map((item) => (
                        <tr
                          key={item.id}
                          className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="px-5 py-3">
                            <p className="text-white font-medium">{item.item_type}</p>
                            {item.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {item.description}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-3 text-muted-foreground">
                            {item.provider_name}
                          </td>
                          <td className="px-3 py-3 text-center text-white">
                            {item.quantity}
                          </td>
                          <td className="px-3 py-3 text-right text-muted-foreground">
                            {fmt(Number(item.unit_value))}
                          </td>
                          <td className="px-3 py-3 text-right text-muted-foreground">
                            {Number(item.tax_rate) > 0
                              ? `${Number(item.tax_rate).toFixed(1)}%`
                              : "—"}
                          </td>
                          <td className="px-3 py-3 text-right text-red-400 font-medium">
                            {fmt(item.costWithTax)}
                          </td>
                          <td className="px-3 py-3 text-right text-white">
                            {fmt(Number(item.sale_price))}
                          </td>
                          <td className="px-3 py-3 text-right text-white">
                            {fmt(item.revenue)}
                          </td>
                          <td
                            className={`px-3 py-3 text-right font-semibold ${
                              item.grossProfit >= 0
                                ? "text-emerald-400"
                                : "text-red-400"
                            }`}
                          >
                            {fmt(item.grossProfit)}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <span
                              className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md border ${
                                item.margin >= 30
                                  ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
                                  : item.margin >= 10
                                  ? "text-amber-400 bg-amber-400/10 border-amber-400/20"
                                  : "text-red-400 bg-red-400/10 border-red-400/20"
                              }`}
                            >
                              {item.margin >= 0 ? (
                                <TrendingUp className="size-3" />
                              ) : (
                                <TrendingDown className="size-3" />
                              )}
                              {item.margin.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {/* Totals Footer */}
                    <tfoot>
                      <tr className="bg-white/[0.03] border-t border-white/10">
                        <td
                          colSpan={2}
                          className="px-5 py-4 text-white font-bold uppercase text-xs tracking-wider"
                        >
                          Totais
                        </td>
                        <td className="px-3 py-4 text-center text-white font-bold">
                          {purchases.reduce((s, p) => s + Number(p.quantity), 0)}
                        </td>
                        <td colSpan={2} />
                        <td className="px-3 py-4 text-right text-red-400 font-bold">
                          {fmt(totals.totalCOGS)}
                        </td>
                        <td />
                        <td className="px-3 py-4 text-right text-white font-bold">
                          {fmt(totals.projectedRevenue)}
                        </td>
                        <td
                          className={`px-3 py-4 text-right font-bold ${
                            totals.grossProfit >= 0
                              ? "text-emerald-400"
                              : "text-red-400"
                          }`}
                        >
                          {fmt(totals.grossProfit)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span
                            className={`text-xs font-bold ${
                              totals.grossMargin >= 0
                                ? "text-emerald-400"
                                : "text-red-400"
                            }`}
                          >
                            {totals.grossMargin.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>

            {/* Real Profit Summary */}
            <section className="bg-white/[0.03] backdrop-blur-2xl border border-primary/20 rounded-2xl p-6 shadow-[0_0_40px_-10px_rgba(249,6,6,0.1)]">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-primary/20 border border-primary/30">
                    <TrendingUp className="size-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                      Resultado Final — Lucro Real
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Lucro Bruto ({fmt(totals.grossProfit)}) − Centro de Custos ({fmt(totals.monthlyCosts)})
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className={`text-3xl font-black tracking-tight ${
                      totals.realProfit >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {fmt(totals.realProfit)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Margem real:{" "}
                    <span
                      className={`font-bold ${
                        totals.realMargin >= 0
                          ? "text-emerald-400"
                          : "text-red-400"
                      }`}
                    >
                      {totals.realMargin.toFixed(1)}%
                    </span>
                  </p>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  subtitle,
  color,
  bgColor,
  highlighted,
}: {
  icon: any;
  label: string;
  value: string;
  subtitle: string;
  color: string;
  bgColor: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`bg-white/[0.03] backdrop-blur-2xl border rounded-2xl p-5 relative overflow-hidden ${
        highlighted
          ? "border-primary/30 shadow-[0_0_40px_-10px_rgba(249,6,6,0.15)]"
          : "border-white/10"
      }`}
    >
      {highlighted && (
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-50" />
      )}
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-3">
          <div className={`p-2 rounded-lg border ${bgColor}`}>
            <Icon className={`size-4 ${color}`} />
          </div>
          <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
            {label}
          </span>
        </div>
        <p className={`text-2xl font-black tracking-tight text-white`}>
          {value}
        </p>
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      </div>
    </div>
  );
}
