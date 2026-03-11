import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Save, Loader2, Package, DollarSign, Percent, Wrench, FileText, Search, Zap, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  icon_type: string | null;
  stock: number;
  status: string;
  external_id: string | null;
  tags: string[] | null;
  category_id: string | null;
}

interface CostData {
  unit_cost: number;
  tax_percent: number;
  labor_cost: number;
  other_costs: number;
  notes: string;
}


export default function AdminCentralInvestimentos() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [costs, setCosts] = useState<Record<string, CostData>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Fetch products + existing costs
  const fetchData = useCallback(async () => {
    setLoading(true);
    const [prodRes, costRes] = await Promise.all([
      supabase.from("products").select("id, name, price, image_url, icon_type, stock, status, external_id, tags, category_id").order("name"),
      supabase.from("product_costs" as any).select("*"),
    ]);

    setProducts(prodRes.data ?? []);

    const costMap: Record<string, CostData> = {};
    ((costRes.data as any[]) ?? []).forEach((c: any) => {
      costMap[c.product_id] = {
        unit_cost: Number(c.unit_cost),
        tax_percent: Number(c.tax_percent),
        labor_cost: Number(c.labor_cost),
        other_costs: Number(c.other_costs),
        notes: c.notes || "",
      };
    });
    setCosts(costMap);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ProxyBR costs are ignored here — variable cost paid by client
  // Focus only on Webshare (fixed monthly plan)

  // Fetch Webshare plan for cost per proxy
  const { data: webSharePlan } = useQuery({
    queryKey: ["webshare-plan-invest"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("webshare-api", { body: { action: "get-plan" } });
      if (error) return null;
      return data;
    },
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  });

  // Fetch total proxy count from Webshare (reliable count)
  const { data: webshareProxyCount } = useQuery({
    queryKey: ["webshare-proxy-count-invest"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("webshare-api", { body: { action: "get-proxy-list", mode: "direct", page: 1, page_size: 1 } });
      if (error) return null;
      return data?.count || null;
    },
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  });

  // Fetch proxy category to identify webshare products
  const { data: proxyCategory } = useQuery({
    queryKey: ["proxy-category-id"],
    queryFn: async () => {
      const { data } = await supabase.from("product_categories").select("id").eq("slug", "proxy").maybeSingle();
      return data?.id || null;
    },
    staleTime: 600_000,
  });

  // Fetch fixed costs + allocation for dilution display
  const { data: fixedCostData } = useQuery({
    queryKey: ["fixed-costs-invest"],
    queryFn: async () => {
      const [costCenterRes, allocationRes, categoriesRes] = await Promise.all([
        supabase.from("cost_center").select("amount, active").eq("active", true),
        supabase.from("site_settings").select("value").eq("key", "fixed_cost_allocation").maybeSingle(),
        supabase.from("product_categories").select("id, name, slug"),
      ]);
      const totalFixed = (costCenterRes.data ?? []).reduce((s: number, c: any) => s + Number(c.amount || 0), 0);
      let alloc: Record<string, number> = {};
      try { alloc = JSON.parse(allocationRes.data?.value || "{}"); } catch {}
      const cats = categoriesRes.data ?? [];
      return { totalFixed, allocation: alloc, categories: cats };
    },
    staleTime: 120_000,
  });

  // Fetch live USD→BRL exchange rate
  const { data: usdToBrl } = useQuery({
    queryKey: ["usd-brl-rate"],
    queryFn: async () => {
      try {
        const resp = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL");
        const data = await resp.json();
        return parseFloat(data?.USDBRL?.bid) || 5.5;
      } catch { return 5.5; }
    },
    staleTime: 600_000,
    refetchOnWindowFocus: false,
  });

  // Build auto-cost maps (only Webshare — ProxyBR is variable/client-paid)
  const proxyCosts = useMemo(() => {
    const map: Record<string, { cost: number; source: string }> = {};

    if (webSharePlan && usdToBrl) {
      const plan = webSharePlan?.plan;
      const monthlyPlanCost = plan?.monthly_price || 0;
      const totalPlanProxies = plan?.proxy_count || webshareProxyCount || 1;
      const costPerProxyBRL = (monthlyPlanCost / totalPlanProxies) * usdToBrl;
      console.log("[invest] Webshare plan cost:", monthlyPlanCost, "proxies:", totalPlanProxies, "rate:", usdToBrl, "=> per proxy BRL:", costPerProxyBRL);

      if (costPerProxyBRL > 0) {
        products.forEach(p => {
          const tags = p.tags || [];
          const isWebshare = tags.includes("webshare") || tags.includes("proxy") ||
            (p.category_id === proxyCategory && !p.external_id && (p.name.toLowerCase().includes("webshare") || p.name.toLowerCase().includes("proxy")));
          if (isWebshare) {
            map[p.id] = { cost: costPerProxyBRL, source: "Webshare" };
          }
        });
      }
    }

    return map;
  }, [products, webSharePlan, proxyCategory, usdToBrl, webshareProxyCount]);

  // Calculate per-product fixed cost dilution by category
  const getFixedCostPerProduct = useMemo(() => {
    if (!fixedCostData) return (_id: string) => 0;
    const { totalFixed, allocation, categories } = fixedCostData;
    if (totalFixed <= 0) return (_id: string) => 0;

    // Build slug-to-id map
    const slugToId: Record<string, string> = {};
    categories.forEach((c: any) => { slugToId[c.slug] = c.id; });

    // Count active products per category
    const activeProducts = products.filter(p => p.status === "active");
    const catProductCount: Record<string, number> = {};
    activeProducts.forEach(p => {
      if (p.category_id) {
        catProductCount[p.category_id] = (catProductCount[p.category_id] || 0) + 1;
      }
    });

    // Build product -> fixed cost map
    const productFixedMap: Record<string, number> = {};
    activeProducts.forEach(p => {
      if (!p.category_id) return;
      const cat = categories.find((c: any) => c.id === p.category_id);
      if (!cat) return;
      const allocPct = allocation[cat.slug] || 0;
      const catFixed = totalFixed * (allocPct / 100);
      const productsInCat = catProductCount[p.category_id] || 1;
      productFixedMap[p.id] = catFixed / productsInCat;
    });

    return (id: string) => productFixedMap[id] || 0;
  }, [products, fixedCostData]);

  const getCost = (id: string): CostData =>
    costs[id] || { unit_cost: 0, tax_percent: 0, labor_cost: 0, other_costs: 0, notes: "" };

  const getEffectiveUnitCost = (id: string): number => {
    const c = getCost(id);
    if (c.unit_cost > 0) return c.unit_cost;
    return proxyCosts[id]?.cost || 0;
  };

  const updateField = (id: string, field: keyof CostData, value: string) => {
    const prev = getCost(id);
    setCosts(old => ({
      ...old,
      [id]: {
        ...prev,
        [field]: field === "notes" ? value : parseFloat(value) || 0,
      },
    }));
  };

  const totalCost = (id: string): number => {
    const c = getCost(id);
    const unitCost = getEffectiveUnitCost(id);
    const baseCost = unitCost + c.labor_cost + c.other_costs;
    return baseCost * (1 + c.tax_percent / 100);
  };

  const totalCostWithFixed = (id: string): number => {
    return totalCost(id) + getFixedCostPerProduct(id);
  };

  const applyAutoCost = (productId: string) => {
    const auto = proxyCosts[productId];
    if (!auto) return;
    const prev = getCost(productId);
    setCosts(old => ({
      ...old,
      [productId]: { ...prev, unit_cost: Math.round(auto.cost * 100) / 100 },
    }));
    toast.success(`Custo ${auto.source} aplicado: ${fmt(auto.cost)}`);
  };

  const saveCost = async (productId: string) => {
    setSaving(s => ({ ...s, [productId]: true }));
    const c = getCost(productId);
    const unitCost = c.unit_cost > 0 ? c.unit_cost : (proxyCosts[productId]?.cost || 0);

    const payload = {
      product_id: productId,
      unit_cost: unitCost,
      tax_percent: c.tax_percent,
      labor_cost: c.labor_cost,
      other_costs: c.other_costs,
      notes: c.notes || null,
    };

    const { error } = await (supabase.from("product_costs" as any) as any).upsert(payload, { onConflict: "product_id" });
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success("Custos salvos!");
    }
    setSaving(s => ({ ...s, [productId]: false }));
  };

  const filtered = products.filter(p =>
    p.status === "active" && p.name.toLowerCase().includes(search.toLowerCase())
  );

  const iconTypeLabel = (t: string | null) => {
    switch (t) {
      case "bm": return "BM";
      case "perfil": return "Perfil";
      case "pagina": return "Página";
      case "combo": return "Combo";
      default: return t || "Outro";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/admin/auditoria")}
          className="p-2 rounded-lg bg-card/60 border border-border/40 hover:bg-card transition-colors"
        >
          <ArrowLeft className="size-5 text-muted-foreground" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Central de Investimentos</h1>
          <p className="text-sm text-muted-foreground">
            Custos de proxies são preenchidos automaticamente via ProxyBR e Webshare. Demais produtos requerem lançamento manual.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Buscar produto..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10 bg-card/60 border-border/40"
        />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card/60 border border-border/40 rounded-xl p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Produtos</p>
          <p className="text-2xl font-bold text-foreground">{products.length}</p>
        </div>
        <div className="bg-card/60 border border-border/40 rounded-xl p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Com Custo Definido</p>
          <p className="text-2xl font-bold text-emerald-400">
            {products.filter(p => getCost(p.id).unit_cost > 0 || proxyCosts[p.id]).length}
          </p>
        </div>
        <div className="bg-card/60 border border-border/40 rounded-xl p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Sem Custo</p>
          <p className="text-2xl font-bold text-amber-400">
            {products.filter(p => getCost(p.id).unit_cost <= 0 && !proxyCosts[p.id]).length}
          </p>
        </div>
        <div className="bg-card/60 border border-border/40 rounded-xl p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Margem Média</p>
          <p className="text-2xl font-bold text-foreground">
            {(() => {
              const withCost = products.filter(p => totalCost(p.id) > 0);
              if (!withCost.length) return "—";
              const avgMargin = withCost.reduce((s, p) => {
                const tc = totalCost(p.id);
                return s + ((p.price - tc) / p.price) * 100;
              }, 0) / withCost.length;
              return `${avgMargin.toFixed(1)}%`;
            })()}
          </p>
        </div>
      </div>

      {/* Products List */}
      <div className="space-y-3">
        {filtered.map(product => {
          const c = getCost(product.id);
          const tc = totalCost(product.id);
          const fixedPerProduct = getFixedCostPerProduct(product.id);
          const tcWithFixed = tc + fixedPerProduct;
          const profit = product.price - tc;
          const realProfit = product.price - tcWithFixed;
          const margin = product.price > 0 ? ((profit / product.price) * 100) : 0;
          const realMargin = product.price > 0 ? ((realProfit / product.price) * 100) : 0;
          const isExpanded = expandedId === product.id;
          const hasCost = tc > 0;
          const autoCost = proxyCosts[product.id];

          return (
            <div
              key={product.id}
              className="bg-card/60 border border-border/40 rounded-xl overflow-hidden transition-all"
            >
              {/* Row header */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : product.id)}
                className="w-full flex items-center gap-4 p-4 text-left hover:bg-card/80 transition-colors"
              >
                <div className="size-12 rounded-lg bg-muted/50 border border-border/30 flex items-center justify-center shrink-0 overflow-hidden">
                  {product.image_url ? (
                    <img src={product.image_url} alt="" className="size-full object-cover" />
                  ) : (
                    <Package className="size-5 text-muted-foreground" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground truncate">{product.name}</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground border border-border/30 shrink-0">
                      {iconTypeLabel(product.icon_type)}
                    </span>
                    {autoCost && (
                      <Badge variant="outline" className="text-[10px] border-primary/40 text-primary shrink-0">
                        <Zap className="size-2.5 mr-0.5" />{autoCost.source}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Venda: {fmt(product.price)} • Estoque: {product.stock}
                  </p>
                </div>

                <div className="hidden sm:flex items-center gap-4 shrink-0">
                  {hasCost ? (
                    <>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Custo + Fixo</p>
                        <p className="text-sm font-semibold text-foreground">{fmt(tcWithFixed)}</p>
                        {fixedPerProduct > 0 && (
                          <p className="text-[9px] text-amber-400">+{fmt(fixedPerProduct)} fixo</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Lucro Real</p>
                        <p className={`text-sm font-semibold ${realProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {fmt(realProfit)} ({realMargin.toFixed(1)}%)
                        </p>
                      </div>
                    </>
                  ) : (
                    <span className="text-xs text-amber-400 bg-amber-400/10 px-2 py-1 rounded border border-amber-400/20">
                      Sem custo definido
                    </span>
                  )}
                </div>
              </button>

              {/* Expanded edit form */}
              {isExpanded && (
                <div className="border-t border-border/30 p-4 bg-background/50">
                  {/* Auto-cost banner */}
                  {autoCost && c.unit_cost <= 0 && (
                    <div className="mb-4 flex items-center justify-between gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <div className="flex items-center gap-2 text-sm">
                        <Zap className="size-4 text-primary" />
                        <span className="text-foreground">
                          Custo automático via <strong>{autoCost.source}</strong>: {fmt(autoCost.cost)}
                        </span>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => applyAutoCost(product.id)}>
                        Aplicar no campo
                      </Button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
                        <DollarSign className="size-3.5" /> Custo Unitário (R$)
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        value={c.unit_cost || ""}
                        onChange={e => updateField(product.id, "unit_cost", e.target.value)}
                        placeholder={autoCost ? `Auto: ${autoCost.cost.toFixed(2)}` : "0.00"}
                        className="bg-card/60"
                      />
                      {autoCost && c.unit_cost <= 0 && (
                        <p className="text-[10px] text-primary mt-1">Usando custo {autoCost.source}: {fmt(autoCost.cost)}</p>
                      )}
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
                        <Percent className="size-3.5" /> Imposto (%)
                      </label>
                      <Input
                        type="number"
                        step="0.1"
                        value={c.tax_percent || ""}
                        onChange={e => updateField(product.id, "tax_percent", e.target.value)}
                        placeholder="0"
                        className="bg-card/60"
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
                        <Wrench className="size-3.5" /> Mão de Obra (R$)
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        value={c.labor_cost || ""}
                        onChange={e => updateField(product.id, "labor_cost", e.target.value)}
                        placeholder="0.00"
                        className="bg-card/60"
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
                        <FileText className="size-3.5" /> Outros Custos (R$)
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        value={c.other_costs || ""}
                        onChange={e => updateField(product.id, "other_costs", e.target.value)}
                        placeholder="0.00"
                        className="bg-card/60"
                      />
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Observações</label>
                    <Textarea
                      value={c.notes}
                      onChange={e => updateField(product.id, "notes", e.target.value)}
                      placeholder="Fornecedor, detalhes do custo..."
                      rows={2}
                      className="bg-card/60"
                    />
                  </div>

                  {/* Summary + Save */}
                  <div className="mt-4 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-4 flex-wrap text-sm">
                      <div>
                        <span className="text-muted-foreground">Base: </span>
                        <span className="font-medium text-foreground">{fmt(getEffectiveUnitCost(product.id) + c.labor_cost + c.other_costs)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">+ Imposto ({c.tax_percent}%): </span>
                        <span className="font-medium text-foreground">{fmt(tc)}</span>
                      </div>
                      {fixedPerProduct > 0 && (
                        <div>
                          <span className="text-amber-400 flex items-center gap-1">
                            <Building2 className="size-3" /> Fixo rateado: {fmt(fixedPerProduct)}
                          </span>
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">Custo Total: </span>
                        <span className="font-bold text-foreground">{fmt(tcWithFixed)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Lucro Real: </span>
                        <span className={`font-bold ${realProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {fmt(realProfit)} ({realMargin.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                    <Button
                      onClick={() => saveCost(product.id)}
                      disabled={saving[product.id]}
                      size="sm"
                    >
                      {saving[product.id] ? <Loader2 className="size-4 animate-spin mr-1" /> : <Save className="size-4 mr-1" />}
                      Salvar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            Nenhum produto encontrado.
          </div>
        )}
      </div>
    </div>
  );
}
