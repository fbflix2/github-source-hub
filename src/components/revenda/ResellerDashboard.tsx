import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import ResellerTipsBanner from "@/components/revenda/ResellerTipsBanner";
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Users,
  Wallet,
  Clock,
  CheckCircle2,
  Loader2,
  ArrowUpRight,
  Package,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

interface Props {
  resellerId: string;
  primaryColor?: string | null;
  totalGmv: number;
  totalCommissionsEarned: number;
  totalReferrals: number;
  balanceCredits: number;
  pendingCommissions: number;
  creditedCommissions: number;
  brandName: string;
  onNavigate?: (section: string) => void;
}

interface OrderRow {
  id: string;
  total: number;
  status: string;
  created_at: string;
  user_id: string | null;
}

export default function ResellerDashboard({
  resellerId,
  primaryColor,
  totalGmv,
  totalCommissionsEarned,
  totalReferrals,
  balanceCredits,
  pendingCommissions,
  creditedCommissions,
  brandName,
  onNavigate,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [clientNames, setClientNames] = useState<Record<string, string>>({});
  const [range, setRange] = useState<7 | 30 | 90>(30);
  const [linkedClients, setLinkedClients] = useState<number>(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const since = new Date();
      since.setDate(since.getDate() - 90);
      const { data } = await supabase
        .from("orders")
        .select("id,total,status,created_at,user_id")
        .eq("reseller_id", resellerId)
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(500);
      const rows = (data as OrderRow[]) || [];
      setOrders(rows);
      const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean) as string[])].slice(0, 20);
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id,full_name")
          .in("user_id", userIds);
        const map: Record<string, string> = {};
        (profs || []).forEach((p: any) => (map[p.user_id] = p.full_name || "Cliente"));
        setClientNames(map);
      }
      const { count: clientsCount } = await supabase
        .from("profiles")
        .select("user_id", { count: "exact", head: true })
        .eq("reseller_id", resellerId);
      setLinkedClients(clientsCount || 0);
      setLoading(false);
    })();
  }, [resellerId]);

  const rangeOrders = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - range);
    return orders.filter((o) => new Date(o.created_at) >= cutoff);
  }, [orders, range]);

  const validOrders = useMemo(
    () => rangeOrders.filter((o) => !["abandoned", "cancelled", "refunded"].includes(o.status)),
    [rangeOrders]
  );

  const completed = useMemo(
    () => rangeOrders.filter((o) => o.status === "completed"),
    [rangeOrders]
  );

  const rangeRevenue = useMemo(
    () => completed.reduce((s, o) => s + Number(o.total || 0), 0),
    [completed]
  );

  const rangeTicket = completed.length > 0 ? rangeRevenue / completed.length : 0;

  const chartData = useMemo(() => {
    const days: { date: string; label: string; revenue: number; orders: number }[] = [];
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const key = d.toISOString().slice(0, 10);
      days.push({
        date: key,
        label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        revenue: 0,
        orders: 0,
      });
    }
    completed.forEach((o) => {
      const key = new Date(o.created_at).toISOString().slice(0, 10);
      const bucket = days.find((d) => d.date === key);
      if (bucket) {
        bucket.revenue += Number(o.total || 0);
        bucket.orders += 1;
      }
    });
    return days;
  }, [completed, range]);

  const statusBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    rangeOrders.forEach((o) => {
      map[o.status] = (map[o.status] || 0) + 1;
    });
    return Object.entries(map).map(([status, count]) => ({ status, count }));
  }, [rangeOrders]);

  const recent = rangeOrders.slice(0, 8);

  const color = primaryColor || "#22c55e";
  const fmt = (n: number) =>
    n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      completed: "Concluído",
      pending: "Pendente",
      processing: "Processando",
      cancelled: "Cancelado",
      refunded: "Reembolsado",
      abandoned: "Abandonado",
    };
    return map[s] || s;
  };
  const statusColor = (s: string) => {
    if (s === "completed") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    if (s === "cancelled" || s === "refunded") return "bg-primary/10 text-primary border-primary/20";
    if (s === "pending" || s === "processing") return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    return "bg-muted/40 text-muted-foreground border-border/40";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-6 text-primary animate-spin" />
      </div>
    );
  }

  const kpis = [
    {
      label: "Faturamento",
      sub: `Últimos ${range} dias`,
      value: `R$ ${fmt(rangeRevenue)}`,
      icon: DollarSign,
      accent: color,
    },
    {
      label: "Pedidos",
      sub: `${completed.length} concluídos`,
      value: String(validOrders.length),
      icon: ShoppingBag,
      accent: "#0ea5e9",
    },
    {
      label: "Ticket médio",
      sub: "Por pedido concluído",
      value: `R$ ${fmt(rangeTicket)}`,
      icon: TrendingUp,
      accent: "#a855f7",
    },
    {
      label: "Clientes únicos",
      sub: "Compraram no período",
      value: String(new Set(rangeOrders.map((o) => o.user_id).filter(Boolean)).size),
      icon: Users,
      accent: "#f59e0b",
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Banner de dicas */}
      <ResellerTipsBanner />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
            Olá,{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: `linear-gradient(90deg, ${color}, ${color}90)` }}
            >
              {brandName}
            </span>
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Visão geral do seu desempenho como revendedor
          </p>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-full bg-card/60 border border-border/40 backdrop-blur">
          {([7, 30, 90] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                range === r
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r} dias
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card
              key={k.label}
              className="relative p-4 bg-card/60 border-border/40 backdrop-blur overflow-hidden group hover:border-primary/40 transition-colors"
            >
              <div
                className="absolute -top-8 -right-8 w-28 h-28 rounded-full blur-2xl opacity-20 group-hover:opacity-30 transition-opacity"
                style={{ background: k.accent }}
              />
              <div className="relative flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    {k.label}
                  </p>
                  <p className="text-xl md:text-2xl font-bold text-foreground mt-1.5 leading-none">
                    {k.value}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1.5">{k.sub}</p>
                </div>
                <div
                  className="p-2 rounded-lg"
                  style={{ background: `${k.accent}20`, color: k.accent }}
                >
                  <Icon className="size-4" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Totais acumulados */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-4 bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="size-4 text-emerald-400" />
            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
              Saldo de créditos
            </p>
          </div>
          <p className="text-2xl font-bold text-foreground">R$ {fmt(balanceCredits)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Disponível para operar sua revenda
          </p>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="size-4 text-primary" />
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest">
              Faturamento total
            </p>
          </div>
          <p className="text-2xl font-bold text-foreground">R$ {fmt(totalGmv)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Volume acumulado da sua revenda</p>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-amber-500/10 to-transparent border-amber-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Users className="size-4 text-amber-400" />
            <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">
              Clientes cadastrados
            </p>
          </div>
          <p className="text-2xl font-bold text-foreground">{linkedClients.toLocaleString("pt-BR")}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Total vinculado ao seu painel</p>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5 bg-card/60 border-border/40 backdrop-blur">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-foreground">Faturamento por dia</h3>
              <p className="text-[11px] text-muted-foreground">Últimos {range} dias — pedidos concluídos</p>
            </div>
            <TrendingUp className="size-4 text-primary" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.6} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `R$${v}`}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: any) => [`R$ ${fmt(Number(v))}`, "Faturamento"]}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke={color}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5, fill: color }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 bg-card/60 border-border/40 backdrop-blur">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-foreground">Pedidos por status</h3>
              <p className="text-[11px] text-muted-foreground">Últimos {range} dias</p>
            </div>
            <Package className="size-4 text-primary" />
          </div>
          {statusBreakdown.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-muted-foreground">
              Sem pedidos no período
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusBreakdown} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" opacity={0.3} />
                  <XAxis
                    dataKey="status"
                    tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={statusLabel}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: any) => [v, "Pedidos"]}
                    labelFormatter={(l) => statusLabel(String(l))}
                  />
                  <Bar dataKey="count" fill={color} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* Recent orders */}
      <Card className="bg-card/60 border-border/40 backdrop-blur overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <div>
            <h3 className="text-sm font-bold text-foreground">Últimos pedidos</h3>
            <p className="text-[11px] text-muted-foreground">Vendas mais recentes na sua revenda</p>
          </div>
          {onNavigate && (
            <button
              onClick={() => onNavigate("vendas")}
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
            >
              Ver todas <ArrowUpRight className="size-3" />
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/20 text-muted-foreground text-[10px] uppercase tracking-widest">
              <tr>
                <th className="text-left px-5 py-2.5 font-bold">Data</th>
                <th className="text-left px-5 py-2.5 font-bold">Cliente</th>
                <th className="text-center px-5 py-2.5 font-bold">Status</th>
                <th className="text-right px-5 py-2.5 font-bold">Valor</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-muted-foreground text-xs">
                    Nenhum pedido no período selecionado.
                  </td>
                </tr>
              ) : (
                recent.map((o) => (
                  <tr key={o.id} className="border-t border-border/30 hover:bg-muted/10 transition-colors">
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {new Date(o.created_at).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-5 py-3 text-xs font-medium text-foreground">
                      {o.user_id ? clientNames[o.user_id] || "Cliente" : "—"}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusColor(
                          o.status
                        )}`}
                      >
                        {statusLabel(o.status)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-xs font-bold text-foreground">
                      R$ {fmt(Number(o.total || 0))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* GMV Total acumulado */}
      <Card className="p-5 bg-card/60 border-border/40 backdrop-blur">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              GMV Total (histórico)
            </p>
            <p className="text-2xl font-bold text-foreground mt-1">R$ {fmt(totalGmv)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Total de vendas (histórico)
            </p>
            <p className="text-2xl font-bold text-foreground mt-1">{totalReferrals}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Comissões acumuladas
            </p>
            <p className="text-2xl font-bold text-foreground mt-1">
              R$ {fmt(totalCommissionsEarned)}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
