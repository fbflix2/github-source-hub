import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Save, Loader2, Package, DollarSign, Percent, Wrench, FileText, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  icon_type: string | null;
  stock: number;
  status: string;
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [prodRes, costRes] = await Promise.all([
      supabase.from("products").select("id, name, price, image_url, icon_type, stock, status").order("name"),
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

  const getCost = (id: string): CostData =>
    costs[id] || { unit_cost: 0, tax_percent: 0, labor_cost: 0, other_costs: 0, notes: "" };

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
    const baseCost = c.unit_cost + c.labor_cost + c.other_costs;
    return baseCost * (1 + c.tax_percent / 100);
  };

  const saveCost = async (productId: string) => {
    setSaving(s => ({ ...s, [productId]: true }));
    const c = getCost(productId);

    const payload = {
      product_id: productId,
      unit_cost: c.unit_cost,
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
    p.name.toLowerCase().includes(search.toLowerCase())
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
            Defina o custo unitário, impostos e mão de obra de cada produto para cálculos de lucro precisos.
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
          <p className="text-2xl font-bold text-emerald-400">{Object.keys(costs).length}</p>
        </div>
        <div className="bg-card/60 border border-border/40 rounded-xl p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Sem Custo</p>
          <p className="text-2xl font-bold text-amber-400">{products.length - Object.keys(costs).length}</p>
        </div>
        <div className="bg-card/60 border border-border/40 rounded-xl p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Margem Média</p>
          <p className="text-2xl font-bold text-foreground">
            {(() => {
              const withCost = products.filter(p => costs[p.id] && totalCost(p.id) > 0);
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
          const profit = product.price - tc;
          const margin = product.price > 0 ? ((profit / product.price) * 100) : 0;
          const isExpanded = expandedId === product.id;
          const hasCost = tc > 0;

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
                {/* Image/icon */}
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
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Venda: {fmt(product.price)} • Estoque: {product.stock}
                  </p>
                </div>

                {/* Cost info */}
                <div className="hidden sm:flex items-center gap-4 shrink-0">
                  {hasCost ? (
                    <>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Custo Total</p>
                        <p className="text-sm font-semibold text-foreground">{fmt(tc)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Lucro</p>
                        <p className={`text-sm font-semibold ${profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {fmt(profit)} ({margin.toFixed(1)}%)
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
                        placeholder="0.00"
                        className="bg-card/60"
                      />
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
                    <div className="flex items-center gap-6 text-sm">
                      <div>
                        <span className="text-muted-foreground">Base: </span>
                        <span className="font-medium text-foreground">{fmt(c.unit_cost + c.labor_cost + c.other_costs)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">+ Imposto ({c.tax_percent}%): </span>
                        <span className="font-medium text-foreground">{fmt(tc)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Lucro: </span>
                        <span className={`font-bold ${profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {fmt(profit)} ({margin.toFixed(1)}%)
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
