import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Server,
  Wrench,
  TrendingUp,
  DollarSign,
  Coins,
  Repeat,
  ShoppingCart,
  Activity,
  Save,
  Loader2,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  resellerId: string;
  model: "percentage" | "credit";
  proxyUnitCost: number;
  commissionRate: number;
}

interface ProxyProduct {
  id: string;
  name: string;
  price: number; // preço público / base
  icon_type: string | null;
  status: string;
  available: boolean;
  image_url: string | null;
  reseller_cost: number | null;
}

interface Override {
  id: string;
  product_id: string;
  custom_price: number;
  enabled: boolean;
}

interface CommissionRow {
  id: string;
  code: string | null;
  revenue: number;
  cost: number;
  profit: number;
  status: string;
  created_at: string;
  itemsLabel: string;
}

interface ResellerOrderRow {
  id: string;
  code: string | null;
  total: number | string | null;
  status: string;
  created_at: string;
}

interface OrderItemRow {
  id: string;
  order_id: string;
  name: string | null;
  quantity: number | null;
  price: number | string | null;
  products:
    | {
        name?: string | null;
        icon_type?: string | null;
        reseller_cost?: number | string | null;
      }
    | {
        name?: string | null;
        icon_type?: string | null;
        reseller_cost?: number | string | null;
      }[]
    | null;
}

const BRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ResellerCentralProxy({
  resellerId,
  model,
  proxyUnitCost,
  commissionRate,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [products, setProducts] = useState<ProxyProduct[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sales, setSales] = useState<CommissionRow[]>([]);
  const [exchangeCount, setExchangeCount] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: prods }, { data: ovs }, { data: orders }, { count: exCount }] =
        await Promise.all([
          supabase
            .from("products")
            .select("id, name, price, icon_type, status, available, image_url, reseller_cost")
            .eq("icon_type", "proxy")
            .order("name", { ascending: true }),
          supabase
            .from("reseller_price_overrides")
            .select("*")
            .eq("reseller_id", resellerId),
          supabase
            .from("orders")
            .select("id, code, total, status, created_at")
            .eq("reseller_id", resellerId)
            .eq("status", "completed")
            .order("created_at", { ascending: false })
            .limit(500),
          supabase
            .from("product_exchanges")
            .select("id", { count: "exact", head: true }),
        ]);

      setProducts((prods as ProxyProduct[]) || []);
      const oMap: Record<string, Override> = {};
      const dMap: Record<string, string> = {};
      ((ovs as Override[]) || []).forEach((o) => {
        oMap[o.product_id] = o;
        dMap[o.product_id] = Number(o.custom_price).toFixed(2);
      });
      setOverrides(oMap);
      setDrafts(dMap);

      const completedOrders = ((orders as ResellerOrderRow[]) || []).filter(
        (order) => order.id
      );
      const orderIds = completedOrders.map((order) => order.id);
      let orderItems: OrderItemRow[] = [];
      if (orderIds.length > 0) {
        const { data: items } = await supabase
          .from("order_items")
          .select("id, order_id, name, quantity, price, products(name, icon_type, reseller_cost)")
          .in("order_id", orderIds);
        orderItems = (items as OrderItemRow[]) || [];
      }

      const itemsByOrder = orderItems.reduce<Record<string, OrderItemRow[]>>(
        (acc, item) => {
          if (!acc[item.order_id]) acc[item.order_id] = [];
          acc[item.order_id].push(item);
          return acc;
        },
        {}
      );

      const proxySales = completedOrders.flatMap((order) => {
        const items = itemsByOrder[order.id] || [];
        const proxyItems = items.filter((item) => {
          const product = Array.isArray(item.products) ? item.products[0] : item.products;
          const marker = `${item.name || ""} ${product?.name || ""} ${product?.icon_type || ""}`.toLowerCase();
          return product?.icon_type === "proxy" || marker.includes("proxy");
        });

        if (proxyItems.length === 0) return [];

        const allItemsGross = items.reduce(
          (sum, item) =>
            sum + Number(item.price || 0) * Math.max(1, Number(item.quantity || 1)),
          0
        );
        const proxyGross = proxyItems.reduce(
          (sum, item) =>
            sum + Number(item.price || 0) * Math.max(1, Number(item.quantity || 1)),
          0
        );
        const proxyCost = proxyItems.reduce((sum, item) => {
          const product = Array.isArray(item.products) ? item.products[0] : item.products;
          const unitFallback =
            model === "credit"
              ? proxyUnitCost
              : Number(item.price || 0) * (1 - commissionRate / 100);
          const unitCost =
            Number(product?.reseller_cost || 0) > 0
              ? Number(product?.reseller_cost || 0)
              : unitFallback;
          return sum + unitCost * Math.max(1, Number(item.quantity || 1));
        }, 0);
        const ratio = allItemsGross > 0 ? proxyGross / allItemsGross : 1;
        const revenue = Number(order.total || 0) * ratio;

        return [
          {
            id: order.id,
            code: order.code,
            revenue,
            cost: proxyCost,
            profit: revenue - proxyCost,
            status: order.status,
            created_at: order.created_at,
            itemsLabel: proxyItems
              .map((item) => item.name || "Proxy")
              .filter(Boolean)
              .join(", "),
          },
        ];
      });

      setSales(proxySales);
      setExchangeCount(exCount || 0);
      setLoading(false);
    })();
  }, [resellerId]);

  const kpis = useMemo(() => {
    const now = Date.now();
    const in30d = sales.filter(
      (c) => now - new Date(c.created_at).getTime() <= 30 * 24 * 3600 * 1000
    );
    const revenue = sales.reduce((s, c) => s + Number(c.revenue || 0), 0);
    const cost = sales.reduce((s, c) => s + Number(c.cost || 0), 0);
    const profit = sales.reduce((s, c) => s + Number(c.profit || 0), 0);
    const mrr =
      in30d.reduce((s, c) => s + Number(c.revenue || 0), 0) /
      Math.max(1, Math.min(1, in30d.length ? 1 : 1));
    const mrrValue = in30d.reduce((s, c) => s + Number(c.revenue || 0), 0);
    return {
      revenue,
      cost,
      profit,
      profitMargin: revenue > 0 ? (profit / revenue) * 100 : 0,
      mrr: mrrValue,
      newSales: in30d.length,
      totalSales: sales.length,
      exchanges: exchangeCount,
      _mrrPeriod: mrr,
    };
  }, [sales, exchangeCount]);

  const savePrice = async (product: ProxyProduct) => {
    const raw = drafts[product.id];
    const value = Number(raw?.toString().replace(",", "."));
    if (!Number.isFinite(value) || value < 0) {
      toast.error("Preço inválido");
      return;
    }
    setSaving(product.id);
    const existing = overrides[product.id];
    let error;
    if (existing) {
      const r = await supabase
        .from("reseller_price_overrides")
        .update({ custom_price: value, enabled: true })
        .eq("id", existing.id);
      error = r.error;
    } else {
      const r = await supabase.from("reseller_price_overrides").insert({
        reseller_id: resellerId,
        product_id: product.id,
        custom_price: value,
        enabled: true,
      });
      error = r.error;
    }
    setSaving(null);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success("Preço atualizado");
    // refresh
    const { data: ovs } = await supabase
      .from("reseller_price_overrides")
      .select("*")
      .eq("reseller_id", resellerId);
    const oMap: Record<string, Override> = {};
    ((ovs as Override[]) || []).forEach((o) => (oMap[o.product_id] = o));
    setOverrides(oMap);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero KPI */}
      <div className="relative overflow-hidden rounded-3xl border border-border/40 bg-gradient-to-br from-primary/15 via-card/60 to-card/20 backdrop-blur-xl p-6 md:p-8">
        <div className="absolute -top-24 -right-16 w-72 h-72 bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-20 -left-10 w-64 h-64 bg-sky-500/10 blur-[100px] rounded-full pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-primary/80">
              <Sparkles className="size-3.5" /> Central Proxy · Painel financeiro
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight font-display">
              {BRL(kpis.mrr)}{" "}
              <span className="text-base font-medium text-muted-foreground">/ MRR (30 dias)</span>
            </h2>
            <p className="text-sm text-muted-foreground">
              Lucro líquido acumulado:{" "}
              <span
                className={cn(
                  "font-bold",
                  kpis.profit >= 0 ? "text-emerald-400" : "text-primary"
                )}
              >
                {BRL(kpis.profit)}
              </span>{" "}
              · Margem {kpis.profitMargin.toFixed(1)}%
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="bg-emerald-500/10 border-emerald-500/30 text-emerald-400 gap-1.5">
              <ArrowUpRight className="size-3.5" />
              {kpis.newSales} vendas / 30d
            </Badge>
            <Badge className="bg-card/60 border-border/40 text-foreground gap-1.5">
              <Repeat className="size-3.5" /> {kpis.exchanges} trocas
            </Badge>
          </div>
        </div>
      </div>

      {/* Bento KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <KpiTile
          label="Receita"
          value={BRL(kpis.revenue)}
          icon={<DollarSign className="size-4" />}
          tone="emerald"
          span="lg:col-span-2"
        />
        <KpiTile
          label="Custo real"
          value={BRL(kpis.cost)}
          icon={<Coins className="size-4" />}
          tone="amber"
        />
        <KpiTile
          label="Lucro líquido"
          value={BRL(kpis.profit)}
          icon={<TrendingUp className="size-4" />}
          tone={kpis.profit >= 0 ? "emerald" : "red"}
        />
        <KpiTile
          label="Novas vendas"
          value={String(kpis.newSales)}
          icon={<ShoppingCart className="size-4" />}
          tone="sky"
        />
        <KpiTile
          label="Trocas"
          value={String(kpis.exchanges)}
          icon={<Repeat className="size-4" />}
          tone="violet"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="precos" className="space-y-5">
        <TabsList className="bg-card/60 border border-border/40 backdrop-blur-xl">
          <TabsTrigger value="precos">
            <Percent className="size-4 mr-1.5" /> Preços & Margem
          </TabsTrigger>
          <TabsTrigger value="vendas">
            <ShoppingCart className="size-4 mr-1.5" /> Novas Vendas
          </TabsTrigger>
          <TabsTrigger value="trocas">
            <Repeat className="size-4 mr-1.5" /> Trocas Realizadas
          </TabsTrigger>
          <TabsTrigger value="manutencao">
            <Wrench className="size-4 mr-1.5" /> Manutenção
          </TabsTrigger>
        </TabsList>

        {/* Preços */}
        <TabsContent value="precos" className="space-y-3">
          <Card className="bg-card/60 border-border/40 overflow-hidden">
            <div className="p-5 border-b border-border/40 flex items-center justify-between">
              <div>
                <h3 className="font-bold flex items-center gap-2">
                  <Server className="size-4 text-primary" /> Precificação por proxy
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Defina o preço de venda de cada proxy. O custo mostrado é o valor que
                  você paga por unidade — o lucro é calculado automaticamente.
                </p>
              </div>
              <Badge variant="outline" className="border-border/40">
                {products.length} proxies
              </Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/20 text-muted-foreground text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-5 py-3">Proxy</th>
                    <th className="text-right px-4 py-3">Custo</th>
                    <th className="text-right px-4 py-3">Preço de venda</th>
                    <th className="text-right px-4 py-3">Lucro / Margem</th>
                    <th className="text-right px-5 py-3">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {products.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-muted-foreground">
                        Nenhum proxy disponível no catálogo.
                      </td>
                    </tr>
                  )}
                  {products.map((p) => {
                    // Prioriza custo definido por proxy (admin → Custo por proxy).
                    // Fallback: modelo crédito usa custo global; modelo % usa preço - comissão.
                    const perProductCost = Number(p.reseller_cost ?? 0);
                    const cost =
                      perProductCost > 0
                        ? perProductCost
                        : model === "credit"
                          ? proxyUnitCost
                          : p.price * (1 - commissionRate / 100);
                    const current =
                      overrides[p.id]?.custom_price ?? p.price;
                    const draft = Number(
                      (drafts[p.id] ?? current.toString()).replace(",", ".")
                    );
                    const price = Number.isFinite(draft) ? draft : current;
                    const profit = price - cost;
                    const margin = price > 0 ? (profit / price) * 100 : 0;
                    return (
                      <tr
                        key={p.id}
                        className="border-t border-border/30 hover:bg-muted/10 transition-colors"
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            {p.image_url ? (
                              <img
                                src={p.image_url}
                                alt=""
                                className="size-9 rounded-lg object-cover ring-1 ring-border/40"
                              />
                            ) : (
                              <div className="size-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                                <Server className="size-4 text-primary" />
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-foreground">{p.name}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {p.available ? "Ativo" : "Inativo"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="text-right px-4 py-3 font-mono text-muted-foreground">
                          {BRL(cost)}
                        </td>
                        <td className="text-right px-4 py-3">
                          <div className="flex justify-end">
                            <div className="relative w-32">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
                                R$
                              </span>
                              <Input
                                value={drafts[p.id] ?? current.toString()}
                                onChange={(e) =>
                                  setDrafts((d) => ({ ...d, [p.id]: e.target.value }))
                                }
                                className="h-9 pl-7 text-right font-mono bg-background/60"
                                inputMode="decimal"
                              />
                            </div>
                          </div>
                        </td>
                        <td className="text-right px-4 py-3">
                          <div className="flex flex-col items-end">
                            <span
                              className={cn(
                                "font-bold font-mono",
                                profit >= 0 ? "text-emerald-400" : "text-primary"
                              )}
                            >
                              {profit >= 0 ? (
                                <ArrowUpRight className="inline size-3 mr-0.5" />
                              ) : (
                                <ArrowDownRight className="inline size-3 mr-0.5" />
                              )}
                              {BRL(profit)}
                            </span>
                            <span
                              className={cn(
                                "text-[11px]",
                                margin >= 30
                                  ? "text-emerald-400/70"
                                  : margin >= 10
                                    ? "text-amber-400/70"
                                    : "text-primary"
                              )}
                            >
                              {margin.toFixed(1)}% margem
                            </span>
                          </div>
                        </td>
                        <td className="text-right px-5 py-3">
                          <Button
                            size="sm"
                            onClick={() => savePrice(p)}
                            disabled={saving === p.id}
                            className="gap-1.5"
                          >
                            {saving === p.id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Save className="size-3.5" />
                            )}
                            Salvar
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Vendas */}
        <TabsContent value="vendas">
          <Card className="bg-card/60 border-border/40 overflow-hidden">
            <div className="p-5 border-b border-border/40 flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2">
                <ShoppingCart className="size-4 text-primary" /> Novas vendas (últimas)
              </h3>
              <Badge variant="outline" className="border-border/40">
                {kpis.totalSales} total
              </Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/20 text-muted-foreground text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-5 py-3">Data</th>
                    <th className="text-right px-4 py-3">Valor</th>
                    <th className="text-right px-4 py-3">Sua margem</th>
                    <th className="text-center px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-12 text-muted-foreground">
                        Nenhuma venda registrada ainda.
                      </td>
                    </tr>
                  ) : (
                    sales.slice(0, 30).map((c) => (
                      <tr key={c.id} className="border-t border-border/30">
                        <td className="px-5 py-3">
                          <p>{new Date(c.created_at).toLocaleString("pt-BR")}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {c.code || "Pedido"} · {c.itemsLabel || "Proxy"}
                          </p>
                        </td>
                        <td className="text-right px-4 py-3 font-mono">
                          {BRL(Number(c.revenue))}
                        </td>
                        <td className="text-right px-4 py-3 font-mono font-bold text-emerald-400">
                          {BRL(Number(c.profit))}
                        </td>
                        <td className="text-center px-5 py-3">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] uppercase",
                              c.status === "credited" &&
                                "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
                              c.status === "pending" &&
                                "border-amber-500/40 bg-amber-500/10 text-amber-400",
                              (c.status === "cancelled" || c.status === "refunded") &&
                                "border-primary/40 bg-primary/10 text-primary"
                            )}
                          >
                            {c.status}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Trocas */}
        <TabsContent value="trocas">
          <Card className="p-8 bg-card/60 border-border/40 text-center">
            <Repeat className="size-8 text-primary/60 mx-auto mb-3" />
            <h3 className="font-bold text-lg">Trocas realizadas</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Todas as trocas de proxy solicitadas pelos seus clientes aparecem aqui. No
              momento você tem{" "}
              <span className="font-bold text-foreground">{kpis.exchanges}</span> troca(s)
              registrada(s).
            </p>
          </Card>
        </TabsContent>

        {/* Manutenção */}
        <TabsContent value="manutencao">
          <Card className="p-8 bg-card/60 border-border/40">
            <div className="flex items-start gap-4">
              <div className="size-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <Wrench className="size-5 text-primary" />
              </div>
              <div className="space-y-2 flex-1">
                <h3 className="font-bold text-lg">Central de manutenção</h3>
                <p className="text-sm text-muted-foreground">
                  Acompanhe o status operacional da rede FBFlix e envie relatos de proxies
                  com problemas. Nossa equipe processa manutenções em até 30 minutos em
                  horário comercial.
                </p>
                <div className="grid sm:grid-cols-3 gap-3 pt-3">
                  <MaintCard
                    icon={<Activity className="size-4 text-emerald-400" />}
                    label="Uptime da rede"
                    value="99.94%"
                    tone="emerald"
                  />
                  <MaintCard
                    icon={<ShieldCheck className="size-4 text-sky-400" />}
                    label="Proxies saudáveis"
                    value="Todos"
                    tone="sky"
                  />
                  <MaintCard
                    icon={<Wrench className="size-4 text-amber-400" />}
                    label="Chamados abertos"
                    value="0"
                    tone="amber"
                  />
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KpiTile({
  label,
  value,
  icon,
  tone,
  span,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: "emerald" | "sky" | "amber" | "violet" | "red";
  span?: string;
}) {
  const toneMap: Record<string, string> = {
    emerald: "from-emerald-500/10 text-emerald-400",
    sky: "from-sky-500/10 text-sky-400",
    amber: "from-amber-500/10 text-amber-400",
    violet: "from-violet-500/10 text-violet-400",
    red: "from-primary/10 text-primary",
  };
  return (
    <Card
      className={cn(
        "relative overflow-hidden p-4 bg-gradient-to-br to-transparent border-border/40 backdrop-blur-sm",
        toneMap[tone],
        span
      )}
    >
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        <span className={cn("opacity-80")}>{icon}</span>
        <span>{label}</span>
      </div>
      <p className="text-xl md:text-2xl font-bold mt-1.5 font-display tracking-tight text-foreground">
        {value}
      </p>
    </Card>
  );
}

function MaintCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3 bg-card/40",
        tone === "emerald" && "border-emerald-500/20",
        tone === "sky" && "border-sky-500/20",
        tone === "amber" && "border-amber-500/20"
      )}
    >
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground uppercase tracking-wider">
        {icon} {label}
      </div>
      <p className="text-lg font-bold mt-1 font-display">{value}</p>
    </div>
  );
}

export default ResellerCentralProxy;