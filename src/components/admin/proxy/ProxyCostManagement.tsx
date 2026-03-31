import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Package, Warehouse, RefreshCw, Save } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { invokeProxyBR } from "@/lib/proxybr-client";

interface ApiVariant { id: number; price: number; stocks: number; location?: string; name?: string; }
interface ApiProduct { id: number; name: string; type?: string; variant?: ApiVariant[]; variants?: ApiVariant[]; }
interface LocalProduct { id: string; name: string; price: number; external_id: string | null; }
interface MergedRow { productName: string; productType: string; variantName: string; apiPrice: number; salePrice: number | null; stock: number; apiProductId: number; localProductId: string | null; }

async function callProxyBR(action: string, params: Record<string, unknown> = {}) {
  return invokeProxyBR(action, params);
}

export default function ProxyCostManagement() {
  const queryClient = useQueryClient();
  const [discountMap, setDiscountMap] = useState<Record<string, string>>({});
  const [discountLoaded, setDiscountLoaded] = useState(false);
  const [salePriceOverrides, setSalePriceOverrides] = useState<Record<string, string>>({});

  const { data: discountSetting } = useQuery({
    queryKey: ["proxybr-reseller-discounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_settings").select("value").eq("key", "proxybr_reseller_discounts").maybeSingle();
      if (error) throw error;
      return data?.value || "{}";
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (discountSetting && !discountLoaded) {
      try { setDiscountMap(JSON.parse(discountSetting)); } catch { setDiscountMap({}); }
      setDiscountLoaded(true);
    }
  }, [discountSetting, discountLoaded]);

  const getDiscount = (apiProductId: number): number => {
    const val = parseFloat(discountMap[String(apiProductId)] || "0");
    return isNaN(val) ? 0 : val;
  };

  const saveDiscounts = useMutation({
    mutationFn: async (map: Record<string, string>) => {
      const { error } = await supabase.from("site_settings").upsert({ key: "proxybr_reseller_discounts", value: JSON.stringify(map) } as any, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["proxybr-reseller-discounts"] }); },
    onError: () => { toast({ title: "Erro ao salvar descontos", variant: "destructive" }); },
  });

  const saveSalePrices = useMutation({
    mutationFn: async (overrides: Record<string, string>) => {
      const updates = Object.entries(overrides)
        .filter(([, val]) => val !== "" && !isNaN(parseFloat(val)))
        .map(([productId, val]) => ({ id: productId, price: parseFloat(val) }));
      for (const u of updates) {
        const { error } = await supabase.from("products").update({ price: u.price }).eq("id", u.id);
        if (error) throw error;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["local-products-proxy"] }); },
    onError: () => { toast({ title: "Erro ao salvar preços", variant: "destructive" }); },
  });

  const handleSaveAll = async () => {
    try {
      await saveDiscounts.mutateAsync(discountMap);
      if (Object.keys(salePriceOverrides).length > 0) {
        await saveSalePrices.mutateAsync(salePriceOverrides);
        setSalePriceOverrides({});
      }
      toast({ title: "Alterações salvas com sucesso!" });
    } catch {
      // errors handled individually
    }
  };

  const { data: apiData, isLoading: apiLoading, refetch: refetchApi } = useQuery({
    queryKey: ["proxybr-products-central"],
    queryFn: () => callProxyBR("get-products"),
    staleTime: 60_000,
  });

  const { data: localProducts, isLoading: localLoading, refetch: refetchLocal } = useQuery({
    queryKey: ["local-products-proxy"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name, price, external_id").not("external_id", "is", null);
      if (error) throw error;
      return data as LocalProduct[];
    },
    staleTime: 60_000,
  });

  const isLoading = apiLoading || localLoading;

  const rows: MergedRow[] = [];
  if (apiData && localProducts) {
    const products: ApiProduct[] = Array.isArray(apiData) ? apiData : apiData?.data || [];
    const localMap = new Map<string, LocalProduct>();
    for (const lp of localProducts) { if (lp.external_id) localMap.set(lp.external_id.trim().toLowerCase(), lp); }
    for (const prod of products) {
      const variants = prod.variant || prod.variants || [];
      const localMatch = localMap.get(String(prod.id).trim().toLowerCase());
      for (const v of variants) {
        rows.push({ productName: prod.name, productType: prod.type || "—", variantName: v.location || v.name || `Variante ${v.id}`, apiPrice: v.price, salePrice: localMatch?.price ?? null, stock: v.stocks ?? 0, apiProductId: prod.id, localProductId: localMatch?.id || null });
      }
    }
  }

  const computedRows = rows.map(row => {
    const disc = getDiscount(row.apiProductId);
    const realCost = row.apiPrice * (1 - disc / 100);
    const margin = row.salePrice !== null ? row.salePrice - realCost : null;
    const marginPercent = row.salePrice !== null && row.salePrice > 0 ? ((margin! / row.salePrice) * 100) : null;
    return { ...row, realCost, margin, marginPercent, discount: disc };
  });

  const totalProducts = new Set(computedRows.map(r => r.apiProductId)).size;
  const totalStock = computedRows.reduce((s, r) => s + r.stock, 0);
  const rowsWithMargin = computedRows.filter(r => r.marginPercent !== null);
  const avgMargin = rowsWithMargin.length > 0 ? rowsWithMargin.reduce((s, r) => s + r.marginPercent!, 0) / rowsWithMargin.length : 0;

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="default" size="sm" onClick={handleSaveAll} disabled={saveDiscounts.isPending || saveSalePrices.isPending}>
          <Save className="size-4 mr-2" />Salvar Alterações
        </Button>
        <Button variant="outline" size="sm" onClick={() => { refetchApi(); refetchLocal(); }} disabled={isLoading}>
          <RefreshCw className={`size-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />Atualizar
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-primary/10"><Package className="size-5 text-primary" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Produtos</p>
              {isLoading ? <Skeleton className="h-6 w-10" /> : <p className="text-xl font-bold text-foreground">{totalProducts}</p>}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-green-500/10"><TrendingUp className="size-5 text-green-500" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Margem Média</p>
              {isLoading ? <Skeleton className="h-6 w-16" /> : <p className="text-xl font-bold text-foreground">{avgMargin.toFixed(1)}%</p>}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-blue-500/10"><Warehouse className="size-5 text-blue-500" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Estoque Total</p>
              {isLoading ? <Skeleton className="h-6 w-14" /> : <p className="text-xl font-bold text-foreground">{totalStock}</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/30">
                <TableHead>Produto</TableHead>
                <TableHead>Variante</TableHead>
                <TableHead className="text-right">Preço API</TableHead>
                <TableHead className="text-center">Desconto %</TableHead>
                <TableHead className="text-right">Custo Real</TableHead>
                <TableHead className="text-right">Venda</TableHead>
                <TableHead className="text-right">Margem</TableHead>
                <TableHead className="text-right">Estoque</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-border/20">
                    {Array.from({ length: 8 }).map((_, j) => (<TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>))}
                  </TableRow>
                ))
              ) : computedRows.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum produto encontrado</TableCell></TableRow>
              ) : (
                computedRows.map((row, i) => (
                  <TableRow key={i} className="border-border/20">
                    <TableCell>
                      <div>
                        <span className="font-medium text-foreground text-sm">{row.productName}</span>
                        <span className="text-xs text-muted-foreground ml-2">{row.productType}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.variantName}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">R$ {row.apiPrice.toFixed(2)}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center">
                        <Input type="number" min={0} max={100} value={discountMap[String(row.apiProductId)] || ""} onChange={e => setDiscountMap(prev => ({ ...prev, [String(row.apiProductId)]: e.target.value }))} placeholder="0" className="w-16 h-7 text-xs text-center px-1" />
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-medium text-foreground">R$ {row.realCost.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {row.salePrice !== null ? <span className="text-foreground">R$ {row.salePrice.toFixed(2)}</span> : <Badge variant="outline" className="text-xs">Não vinculado</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.margin !== null ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <span className={`font-mono text-sm font-medium ${row.margin > 0 ? "text-green-500" : "text-destructive"}`}>R$ {row.margin.toFixed(2)}</span>
                          <Badge variant={row.margin > 0 ? "default" : "destructive"} className="text-[10px] px-1.5 py-0">{row.marginPercent!.toFixed(0)}%</Badge>
                        </div>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={row.stock > 0 ? "outline" : "destructive"} className="font-mono">{row.stock}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
