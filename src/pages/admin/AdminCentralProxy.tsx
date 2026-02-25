import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Globe, TrendingUp, Package, Warehouse, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface ApiVariant {
  id: number;
  price: number;
  stocks: number;
  location?: string;
  name?: string;
}

interface ApiProduct {
  id: number;
  name: string;
  type?: string;
  variant?: ApiVariant[];
  variants?: ApiVariant[];
}

interface LocalProduct {
  id: string;
  name: string;
  price: number;
  external_id: string | null;
}

interface MergedRow {
  productName: string;
  productType: string;
  variantName: string;
  costPrice: number;
  salePrice: number | null;
  margin: number | null;
  marginPercent: number | null;
  stock: number;
  apiProductId: number;
  localProductId: string | null;
}

async function callProxyBR(action: string, params: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("proxybr-api", {
    body: { action, ...params },
  });
  if (error) throw new Error(error.message);
  if (data?.error && !data?.data) throw new Error(data.error);
  return data;
}

export default function AdminCentralProxy() {
  const { data: apiData, isLoading: apiLoading, refetch: refetchApi } = useQuery({
    queryKey: ["proxybr-products-central"],
    queryFn: () => callProxyBR("get-products"),
    staleTime: 60_000,
  });

  const { data: localProducts, isLoading: localLoading, refetch: refetchLocal } = useQuery({
    queryKey: ["local-products-proxy"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, external_id")
        .not("external_id", "is", null);
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
    for (const lp of localProducts) {
      if (lp.external_id) {
        localMap.set(lp.external_id.trim().toLowerCase(), lp);
      }
    }

    for (const prod of products) {
      const variants = prod.variant || prod.variants || [];
      const localMatch = localMap.get(String(prod.id).trim().toLowerCase());

      for (const v of variants) {
        const cost = v.price;
        const sale = localMatch?.price ?? null;
        const margin = sale !== null ? sale - cost : null;
        const marginPercent = sale !== null && sale > 0 ? ((margin! / sale) * 100) : null;

        rows.push({
          productName: prod.name,
          productType: prod.type || "—",
          variantName: v.location || v.name || `Variante ${v.id}`,
          costPrice: cost,
          salePrice: sale,
          margin,
          marginPercent,
          stock: v.stocks ?? 0,
          apiProductId: prod.id,
          localProductId: localMatch?.id || null,
        });
      }
    }
  }

  const totalProducts = new Set(rows.map(r => r.apiProductId)).size;
  const totalStock = rows.reduce((s, r) => s + r.stock, 0);
  const rowsWithMargin = rows.filter(r => r.marginPercent !== null);
  const avgMargin = rowsWithMargin.length > 0
    ? rowsWithMargin.reduce((s, r) => s + r.marginPercent!, 0) / rowsWithMargin.length
    : 0;

  const handleRefresh = () => {
    refetchApi();
    refetchLocal();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-10 rounded-xl bg-gradient-to-br from-primary to-red-900 shadow-lg shadow-primary/20">
            <Globe className="text-primary-foreground size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Central Proxy</h1>
            <p className="text-xs text-muted-foreground">Gestão de custos, margens e estoque</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
          <RefreshCw className={`size-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-primary/10">
              <Package className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Produtos</p>
              {isLoading ? <Skeleton className="h-6 w-10" /> : (
                <p className="text-xl font-bold text-foreground">{totalProducts}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-green-500/10">
              <TrendingUp className="size-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Margem Média</p>
              {isLoading ? <Skeleton className="h-6 w-16" /> : (
                <p className="text-xl font-bold text-foreground">{avgMargin.toFixed(1)}%</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-blue-500/10">
              <Warehouse className="size-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Estoque Total</p>
              {isLoading ? <Skeleton className="h-6 w-14" /> : (
                <p className="text-xl font-bold text-foreground">{totalStock}</p>
              )}
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
                <TableHead className="text-right">Custo</TableHead>
                <TableHead className="text-right">Venda</TableHead>
                <TableHead className="text-right">Margem</TableHead>
                <TableHead className="text-right">Estoque</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-border/20">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhum produto encontrado
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row, i) => (
                  <TableRow key={i} className="border-border/20">
                    <TableCell>
                      <div>
                        <span className="font-medium text-foreground text-sm">{row.productName}</span>
                        <span className="text-xs text-muted-foreground ml-2">{row.productType}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.variantName}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-foreground">
                      R$ {row.costPrice.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {row.salePrice !== null ? (
                        <span className="text-foreground">R$ {row.salePrice.toFixed(2)}</span>
                      ) : (
                        <Badge variant="outline" className="text-xs">Não vinculado</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.margin !== null ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <span className={`font-mono text-sm font-medium ${row.margin > 0 ? "text-green-500" : "text-destructive"}`}>
                            R$ {row.margin.toFixed(2)}
                          </span>
                          <Badge variant={row.margin > 0 ? "default" : "destructive"} className="text-[10px] px-1.5 py-0">
                            {row.marginPercent!.toFixed(0)}%
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={row.stock > 0 ? "outline" : "destructive"} className="font-mono">
                        {row.stock}
                      </Badge>
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
