import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  Search, RefreshCw, Loader2, CircleUser, Building2, Shield,
  ShoppingCart, Store, Package, Filter, X, ExternalLink, Copy
} from "lucide-react";

interface ProfileItem {
  id: string;
  name: string;
  identification: string | null;
  identification_link: string | null;
  status: string;
  product_id: string | null;
  data: any;
  folder: string | null;
  created_at: string;
  order_item_id: string | null;
  // resolved
  clientName?: string;
  clientEmail?: string;
  orderCode?: string;
  orderId?: string;
  soldAt?: string;
  price?: number;
}

const statusMap: Record<string, { label: string; color: string }> = {
  revisado: { label: "Na Loja", color: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  vendido: { label: "Vendido", color: "bg-green-500/15 text-green-400 border-green-500/30" },
  reservado: { label: "Reservado", color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  usado: { label: "Usado", color: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" },
};

function getProfileLast4(identification: string | null): string {
  if (!identification) return "—";
  return identification.length > 4 ? `...${identification.slice(-4)}` : identification;
}

export default function AdminGestaoPerfis() {
  const { isAdmin, loading: authLoading } = useAdminAuth();
  const [items, setItems] = useState<ProfileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [bmFilter, setBmFilter] = useState("all"); // all | com_bm | sem_bm

  const fetchItems = async () => {
    setLoading(true);
    try {
      // Fetch perfil stock items that went through blocagem (have bmNames or perfilMatriz in data)
      const { data: stockItems, error } = await supabase
        .from("stock_items")
        .select("id, name, identification, identification_link, status, product_id, data, folder, created_at, order_item_id")
        .eq("type", "perfil")
        .is("deleted_at", null)
        .in("status", ["revisado", "vendido", "usado"])
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Only show items that passed through blocagem (have bmNames or perfilMatriz filled)
      const rows = (stockItems || []).filter(r => {
        const d = r.data as any;
        const hasBm = Array.isArray(d?.bmNames) && d.bmNames.some((b: string) => b.trim());
        const hasMatriz = !!d?.perfilMatriz;
        if (!hasBm && !hasMatriz) return false;
        if (r.status === "vendido" || r.status === "usado") return true;
        if (r.status === "revisado" && r.product_id && !r.order_item_id) return true;
        return false;
      });

      // Get order_item_ids to resolve orders (direct link)
      const orderItemIds = rows.filter(r => r.order_item_id).map(r => r.order_item_id!);

      let orderItemMap: Record<string, { orderId: string; orderCode: string; userId: string; soldAt: string; price: number }> = {};

      if (orderItemIds.length > 0) {
        for (let i = 0; i < orderItemIds.length; i += 75) {
          const chunk = orderItemIds.slice(i, i + 75);
          const { data: orderItems } = await supabase
            .from("order_items")
            .select("id, price, order_id, orders!inner(id, code, user_id, created_at)")
            .in("id", chunk);

          if (orderItems) {
            orderItems.forEach((oi: any) => {
              orderItemMap[oi.id] = {
                orderId: oi.orders?.id,
                orderCode: oi.orders?.code || "",
                userId: oi.orders?.user_id || "",
                soldAt: oi.orders?.created_at || "",
                price: oi.price || 0,
              };
            });
          }
        }
      }

      // Fallback: items vendidos sem order_item_id (ex: foram substituídos via reposição).
      // Buscar via delivery_data._replacement_old_stock_item_id no order_items.
      const orphanItems = rows.filter(r =>
        !r.order_item_id && (r.status === "vendido" || r.status === "usado")
      );

      let orphanMap: Record<string, { orderId: string; orderCode: string; userId: string; soldAt: string; price: number }> = {};

      for (const orphan of orphanItems) {
        const { data: matched } = await supabase
          .from("order_items")
          .select("id, price, order_id, delivery_data, orders!inner(id, code, user_id, created_at)")
          .or(`delivery_data->>_replacement_old_stock_item_id.eq.${orphan.id},delivery_data->>_original_stock_item_id.eq.${orphan.id}`)
          .limit(1)
          .maybeSingle();

        if (matched) {
          const m = matched as any;
          orphanMap[orphan.id] = {
            orderId: m.orders?.id,
            orderCode: m.orders?.code || "",
            userId: m.orders?.user_id || "",
            soldAt: m.orders?.created_at || "",
            price: m.price || 0,
          };
        }
      }

      // Resolve client names from BOTH maps
      const userIds = [
        ...new Set([
          ...Object.values(orderItemMap).map(o => o.userId),
          ...Object.values(orphanMap).map(o => o.userId),
        ].filter(Boolean)),
      ];
      let profileMap: Record<string, { name: string; email: string }> = {};

      if (userIds.length > 0) {
        for (let i = 0; i < userIds.length; i += 75) {
          const chunk = userIds.slice(i, i + 75);
          const { data: profiles, error: profilesError } = await supabase
            .from("profiles")
            .select("user_id, full_name, phone")
            .in("user_id", chunk);

          if (profilesError) throw profilesError;

          if (profiles) {
            profiles.forEach((p: any) => {
              profileMap[p.user_id] = { name: p.full_name || "", email: p.phone || "" };
            });
          }
        }
      }

      const mapped: ProfileItem[] = rows.map(item => {
        const orderInfo = item.order_item_id
          ? orderItemMap[item.order_item_id]
          : orphanMap[item.id];
        const clientInfo = orderInfo?.userId ? profileMap[orderInfo.userId] : null;
        const dataPrice = (item.data as any)?.preco;
        return {
          ...item,
          clientName: clientInfo?.name || undefined,
          clientEmail: clientInfo?.email || undefined,
          orderCode: orderInfo?.orderCode || undefined,
          orderId: orderInfo?.orderId || undefined,
          soldAt: orderInfo?.soldAt || undefined,
          price: orderInfo?.price || dataPrice || undefined,
        };
      });

      setItems(mapped);
    } catch (err: any) {
      toast.error("Erro ao carregar perfis: " + err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin !== null) fetchItems();
  }, [isAdmin]);

  const filtered = useMemo(() => {
    return items.filter(item => {
      const isSold = item.status === "vendido" || item.status === "usado";
      const isInStore = item.status === "revisado" && !!item.product_id && !item.order_item_id;

      if (statusFilter === "vendido" && !isSold) return false;
      if (statusFilter === "na_loja" && !isInStore) return false;

      const bmNames: string[] = item.data?.bmNames || [];
      if (bmFilter === "com_bm" && bmNames.length === 0) return false;
      if (bmFilter === "sem_bm" && bmNames.length > 0) return false;

      if (search) {
        const q = search.toLowerCase();
        const bmStr = bmNames.join(" ").toLowerCase();
        return (
          (item.name || "").toLowerCase().includes(q) ||
          (item.identification || "").toLowerCase().includes(q) ||
          (item.clientName || "").toLowerCase().includes(q) ||
          (item.orderCode || "").toLowerCase().includes(q) ||
          (item.data?.nomeProduto || "").toLowerCase().includes(q) ||
          (item.data?.perfilMatriz || "").toLowerCase().includes(q) ||
          bmStr.includes(q)
        );
      }
      return true;
    });
  }, [items, search, statusFilter, bmFilter]);

  const stats = useMemo(() => {
    const bmItems = items.filter(i => (i.data?.bmNames || []).length > 0);
    return {
      total: items.length,
      naLoja: items.filter(i => i.status === "revisado" && !!i.product_id && !i.order_item_id).length,
      vendidos: items.filter(i => i.status === "vendido" || i.status === "usado").length,
      comBm: bmItems.length,
      semBm: items.length - bmItems.length,
    };
  }, [items]);

  const hasActiveFilters = statusFilter !== "all" || bmFilter !== "all" || search !== "";
  const clearFilters = () => { setStatusFilter("all"); setBmFilter("all"); setSearch(""); };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestão de Perfis</h1>
          <p className="text-sm text-muted-foreground">Rastreamento de perfis, BMs internas e perfis matriz</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchItems} disabled={loading}>
          <RefreshCw className={`size-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total", count: stats.total, icon: CircleUser, onClick: () => { setStatusFilter("all"); setBmFilter("all"); } },
          { label: "Na Loja", count: stats.naLoja, icon: Store, onClick: () => setStatusFilter(statusFilter === "na_loja" ? "all" : "na_loja") },
          { label: "Vendidos", count: stats.vendidos, icon: ShoppingCart, onClick: () => setStatusFilter(statusFilter === "vendido" ? "all" : "vendido") },
          { label: "Com BM", count: stats.comBm, icon: Building2, onClick: () => setBmFilter(bmFilter === "com_bm" ? "all" : "com_bm") },
          { label: "Sem BM", count: stats.semBm, icon: Package, onClick: () => setBmFilter(bmFilter === "sem_bm" ? "all" : "sem_bm") },
        ].map(s => (
          <button
            key={s.label}
            onClick={s.onClick}
            className="p-3 rounded-lg border border-border/50 bg-card hover:bg-muted/50 transition-all text-left"
          >
            <div className="flex items-center justify-between mb-1">
              <s.icon className="size-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold text-foreground">{s.count}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="Buscar por cliente, perfil, BM, pedido..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="vendido">Vendidos</SelectItem>
                <SelectItem value="na_loja">Na Loja</SelectItem>
              </SelectContent>
            </Select>
            <Select value={bmFilter} onValueChange={setBmFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="BMs" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="com_bm">Com BM</SelectItem>
                <SelectItem value="sem_bm">Sem BM</SelectItem>
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground">
                <X className="size-4" /> Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <CircleUser className="size-10 mb-3 opacity-40" />
              <p className="text-sm">Nenhum perfil encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Cliente</TableHead>
                    <TableHead className="text-xs">Perfil</TableHead>
                    <TableHead className="text-xs">Produto</TableHead>
                    <TableHead className="text-xs">BMs</TableHead>
                    <TableHead className="text-xs">Perfil Matriz</TableHead>
                    <TableHead className="text-xs">Preço</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Pedido</TableHead>
                    <TableHead className="text-xs">Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(item => {
                    const bmNames: string[] = item.data?.bmNames || [];
                    const perfilMatriz = item.data?.perfilMatriz || "";
                    const st = statusMap[item.status] || statusMap.aguardando;
                    const isSold = item.status === "vendido" || item.status === "usado";
                    const displayDate = isSold && item.soldAt ? item.soldAt : item.created_at;

                    return (
                      <TableRow key={item.id} className="group">
                        <TableCell className="text-xs">
                          {item.clientName ? (
                            <div>
                              <p className="font-medium text-foreground">{item.clientName}</p>
                              {item.clientEmail && <p className="text-muted-foreground text-[10px]">{item.clientEmail}</p>}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs text-foreground">{getProfileLast4(item.identification)}</span>
                            {item.identification && (
                              <button onClick={() => copyToClipboard(item.identification!)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <Copy className="size-3 text-muted-foreground hover:text-foreground" />
                              </button>
                            )}
                          </div>
                          {item.name && <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">{item.name}</p>}
                        </TableCell>
                        <TableCell className="text-xs text-foreground">
                          {item.data?.nomeProduto || "—"}
                        </TableCell>
                        <TableCell>
                          {bmNames.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {bmNames.map((bm, i) => (
                                <Badge key={i} variant="outline" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/20">
                                  <Building2 className="size-2.5 mr-1" />{bm}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {perfilMatriz ? (
                            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                              <Shield className="size-2.5 mr-1" />{perfilMatriz}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs font-medium text-foreground">
                          {item.price ? `R$ ${Number(item.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge className={`${st.color} text-[10px] font-semibold`}>{st.label}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {item.orderCode ? (
                            <span className="font-mono text-primary">{item.orderCode}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(displayDate).toLocaleDateString("pt-BR")}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Exibindo {filtered.length} de {items.length} perfis
      </p>
    </div>
  );
}
