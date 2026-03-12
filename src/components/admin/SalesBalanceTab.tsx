import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProxyRevenue } from "@/hooks/useProxyRevenue";
import {
  Wallet, TrendingUp, ShoppingCart, Package, Loader2, Filter,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type DateFilter = "hoje" | "ontem" | "7dias" | "30dias" | "ano" | "custom";
const dateFilters: { value: DateFilter; label: string }[] = [
  { value: "hoje", label: "Hoje" },
  { value: "ontem", label: "Ontem" },
  { value: "7dias", label: "7 Dias" },
  { value: "30dias", label: "30 Dias" },
  { value: "ano", label: "Ano Atual" },
];

interface SaleRow {
  category: string;
  product: string;
  qty: number;
  revenue: number;
  date: string;
}

export default function SalesBalanceTab() {
  const [dateFilter, setDateFilter] = useState<DateFilter>("30dias");
  const [categoryFilter, setCategoryFilter] = useState("todos");
  const [loading, setLoading] = useState(true);
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>({});
  const [rangePickerOpen, setRangePickerOpen] = useState(false);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; slug: string }[]>([]);
  const { totalRevenue: proxyRevenue, count: proxyCount, subsWithPrices } = useProxyRevenue();

  const getSince = () => {
    const now = new Date();
    switch (dateFilter) {
      case "hoje": now.setHours(0, 0, 0, 0); break;
      case "7dias": now.setDate(now.getDate() - 7); break;
      case "30dias": now.setDate(now.getDate() - 30); break;
      case "ano": now.setMonth(0, 1); now.setHours(0, 0, 0, 0); break;
    }
    return now.toISOString();
  };

  useEffect(() => { fetchSales(); }, [dateFilter]);

  const fetchSales = async () => {
    setLoading(true);
    const since = getSince();

    const [ordersRes, itemsRes, productsRes, catsRes] = await Promise.all([
      supabase.from("orders").select("id, total, subtotal, discount, status, created_at")
        .in("status", ["completed", "delivered"]).gte("created_at", since),
      supabase.from("order_items").select("order_id, product_id, name, price, quantity, created_at")
        .gte("created_at", since),
      supabase.from("products").select("id, name, category_id"),
      supabase.from("product_categories").select("id, name, slug"),
    ]);

    const orders = ordersRes.data ?? [];
    const items = itemsRes.data ?? [];
    const products = productsRes.data ?? [];
    const cats = catsRes.data ?? [];
    setCategories(cats);

    const completedOrders = new Map(orders.map(o => [o.id, o]));
    const prodCatMap = new Map(products.map(p => [p.id, p.category_id]));
    const catNameMap = new Map(cats.map(c => [c.id, c.name]));

    // Group items by order to calculate discount ratio
    const itemsByOrder = new Map<string, typeof items>();
    items.forEach(i => {
      if (!completedOrders.has(i.order_id)) return;
      const list = itemsByOrder.get(i.order_id) || [];
      list.push(i);
      itemsByOrder.set(i.order_id, list);
    });

    const rows: SaleRow[] = [];
    itemsByOrder.forEach((orderItems, orderId) => {
      const order = completedOrders.get(orderId)!;
      // Calculate ratio of actual paid vs subtotal to distribute discount
      const subtotal = order.subtotal || orderItems.reduce((s, i) => s + i.price * i.quantity, 0);
      const discountRatio = subtotal > 0 ? (order.total / subtotal) : 1;

      orderItems.forEach(i => {
        const catId = i.product_id ? prodCatMap.get(i.product_id) : null;
        rows.push({
          category: catId ? (catNameMap.get(catId) || "Outros") : "Outros",
          product: i.name,
          qty: i.quantity,
          revenue: i.price * i.quantity * discountRatio,
          date: new Date(i.created_at).toLocaleDateString("pt-BR"),
        });
      });
    });

    setSales(rows);
    setLoading(false);
  };

  // Proxy sales rows (from subscriptions)
  const proxySales = useMemo(() => {
    if (!subsWithPrices?.length) return [];
    const since = new Date(getSince());
    return subsWithPrices
      .filter(s => new Date(s.created_at) >= since)
      .map(s => ({
        category: "Proxy",
        product: s.name || "Proxy",
        qty: s.proxyCount,
        revenue: s.price * s.proxyCount,
        date: new Date(s.created_at).toLocaleDateString("pt-BR"),
      }));
  }, [subsWithPrices, dateFilter]);

  const allSales = useMemo(() => [...sales, ...proxySales], [sales, proxySales]);

  const filtered = useMemo(() =>
    categoryFilter === "todos"
      ? allSales
      : allSales.filter(s => s.category === categoryFilter),
    [allSales, categoryFilter]
  );

  const totalRev = useMemo(() => filtered.reduce((s, r) => s + r.revenue, 0), [filtered]);
  const totalQty = useMemo(() => filtered.reduce((s, r) => s + r.qty, 0), [filtered]);

  // Group by product
  const byProduct = useMemo(() => {
    const map = new Map<string, { qty: number; revenue: number; category: string }>();
    filtered.forEach(r => {
      const existing = map.get(r.product) || { qty: 0, revenue: 0, category: r.category };
      existing.qty += r.qty;
      existing.revenue += r.revenue;
      map.set(r.product, existing);
    });
    return [...map.entries()]
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filtered]);

  // Chart: group by date
  const chartData = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach(r => {
      map.set(r.date, (map.get(r.date) || 0) + r.revenue);
    });
    return [...map.entries()]
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => {
        const [da, ma, ya] = a.date.split("/");
        const [db, mb, yb] = b.date.split("/");
        return `${ya}${ma}${da}`.localeCompare(`${yb}${mb}${db}`);
      })
      .slice(-15);
  }, [filtered]);

  // All unique categories from sales
  const availableCategories = useMemo(() => {
    const set = new Set(allSales.map(s => s.category));
    return [...set].sort();
  }, [allSales]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="glass-panel flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 rounded-2xl p-4">
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Filtros:</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex bg-muted/50 p-1 rounded-lg border border-border">
            {dateFilters.map(f => (
              <button
                key={f.value}
                onClick={() => setDateFilter(f.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  dateFilter === f.value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-9 w-[180px] rounded-lg border-border bg-background text-sm">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas Categorias</SelectItem>
              {availableCategories.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Receita Total", value: formatCurrency(totalRev), icon: Wallet, color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20" },
          { label: "Itens Vendidos", value: totalQty.toString(), icon: Package, color: "text-primary", bg: "bg-primary/10 border-primary/20" },
          { label: "Ticket Médio", value: formatCurrency(totalQty > 0 ? totalRev / totalQty : 0), icon: TrendingUp, color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/20" },
        ].map((stat, i) => (
          <div key={i} className="glass-panel rounded-xl p-5 border border-border">
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-lg border ${stat.bg}`}>
                <stat.icon className={`size-4 ${stat.color}`} />
              </div>
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{stat.label}</span>
            </div>
            <p className="text-2xl font-black text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="glass-panel rounded-2xl border border-border p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Receita por Dia</h3>
        <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barCategoryGap="25%">
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickFormatter={v => v >= 1000 ? `R$${(v / 1000).toFixed(1)}k` : `R$${v.toFixed(0)}`} width={70} />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted) / 0.3)', radius: 4 }}
                  contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '10px', fontSize: '12px', color: 'hsl(var(--foreground))', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}
                  formatter={(value: number) => [formatCurrency(value), "Receita"]}
                />
                <Bar dataKey="revenue" radius={[6, 6, 0, 0]} fill="url(#barGradient)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Product breakdown table */}
      <div className="glass-panel rounded-2xl border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-muted/30">
          <h3 className="text-sm font-semibold text-foreground">Detalhamento por Produto</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase font-semibold text-muted-foreground">
              <tr>
                <th className="px-6 py-3 text-left">Produto</th>
                <th className="px-6 py-3 text-left">Categoria</th>
                <th className="px-6 py-3 text-center">Qtd</th>
                <th className="px-6 py-3 text-right">Receita</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {byProduct.length > 0 ? byProduct.map((row, i) => (
                <tr key={i} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-3 font-medium text-foreground">{row.name}</td>
                  <td className="px-6 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                      {row.category}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-center text-muted-foreground">{row.qty}</td>
                  <td className="px-6 py-3 text-right font-bold text-emerald-400">{formatCurrency(row.revenue)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-muted-foreground">
                    Nenhuma venda encontrada no período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 border-t border-border bg-muted/30 flex justify-between text-xs text-muted-foreground">
          <span>{byProduct.length} produtos</span>
          <span className="font-bold text-foreground">Total: {formatCurrency(totalRev)}</span>
        </div>
      </div>
    </div>
  );
}
