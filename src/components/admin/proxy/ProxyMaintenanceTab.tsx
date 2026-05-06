import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { callProxyFbflix } from "@/hooks/useProxyFbflix";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Search, Wrench, RefreshCw, ArrowRightLeft, Plus, Minus,
  ChevronLeft, ChevronRight, User, Globe, Shield
} from "lucide-react";

const PAGE_SIZE = 20;

type StatusFilter = "all" | "active" | "expired" | "cancelled";

export default function ProxyMaintenanceTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [typeFilter, setTypeFilter] = useState<"all" | "individual" | "rotating">("all");
  const [page, setPage] = useState(1);
  const [quotaModal, setQuotaModal] = useState<{ sub: any; type: "add" | "remove" } | null>(null);
  const [quotaAmount, setQuotaAmount] = useState(1);
  const [exchangeConfirm, setExchangeConfirm] = useState<any | null>(null);
  const [targetCity, setTargetCity] = useState("");

  // Fetch all proxyfbflix subscriptions
  const { data: allSubs, isLoading } = useQuery({
    queryKey: ["maint-proxyfbflix-subs"],
    queryFn: async () => {
      let all: any[] = [];
      let from = 0;
      const ps = 1000;
      while (true) {
        const { data } = await supabase
          .from("subscriptions")
          .select("id, name, status, end_date, start_date, raw_data, created_at, product_id, user_id, type")
          .in("type", ["proxyfbflix", "proxyfbflix_rotating", "proxybr", "webshare"])
          .order("created_at", { ascending: false })
          .range(from, from + ps - 1);
        if (!data?.length) break;
        all = [...all, ...data];
        if (data.length < ps) break;
        from += ps;
      }
      return all;
    },
    staleTime: 30_000,
  });

  // Fetch user profiles
  const userIds = useMemo(() => {
    if (!allSubs) return [];
    return [...new Set(allSubs.map((s: any) => s.user_id))];
  }, [allSubs]);

  const { data: profiles } = useQuery({
    queryKey: ["maint-profiles", userIds],
    queryFn: async () => {
      if (!userIds.length) return [];
      const chunks: any[] = [];
      for (let i = 0; i < userIds.length; i += 50) {
        const batch = userIds.slice(i, i + 50);
        const { data } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", batch);
        if (data) chunks.push(...data);
      }
      return chunks;
    },
    enabled: userIds.length > 0,
    staleTime: 60_000,
  });

  const profileMap = useMemo(() => {
    const map = new Map<string, string>();
    (profiles || []).forEach((p: any) => map.set(p.user_id, p.full_name || "Sem nome"));
    return map;
  }, [profiles]);

  // Fetch products
  const productIds = useMemo(() => {
    if (!allSubs) return [];
    return [...new Set(allSubs.filter((s: any) => s.product_id).map((s: any) => s.product_id))];
  }, [allSubs]);

  const { data: products } = useQuery({
    queryKey: ["maint-products", productIds],
    queryFn: async () => {
      if (!productIds.length) return [];
      const { data } = await supabase.from("products").select("id, name, price").in("id", productIds);
      return data ?? [];
    },
    enabled: productIds.length > 0,
    staleTime: 60_000,
  });

  const productMap = useMemo(() => {
    const map = new Map<string, any>();
    (products || []).forEach((p: any) => map.set(p.id, p));
    return map;
  }, [products]);

  // Filter & paginate
  const filtered = useMemo(() => {
    if (!allSubs) return [];
    const now = new Date();
    return allSubs.filter((s: any) => {
      // Status filter
      if (statusFilter === "active") {
        if (s.status !== "active") return false;
        if (s.end_date && new Date(s.end_date) < now) return false;
      } else if (statusFilter === "expired") {
        if (s.status === "cancelled") return false;
        if (s.status === "active" && s.end_date && new Date(s.end_date) >= now) return false;
        if (s.status !== "active" && s.status !== "expired" && s.status !== "expiring") return false;
      } else if (statusFilter === "cancelled") {
        if (s.status !== "cancelled") return false;
      }

      // Type filter
      const isRotating = s.type === "proxyfbflix_rotating" || (s.type === "proxyfbflix" && s.raw_data?.proxy_host);
      if (typeFilter === "rotating" && !isRotating) return false;
      if (typeFilter === "individual" && isRotating) return false;

      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const clientName = (profileMap.get(s.user_id) || "").toLowerCase();
        const code = (s.name || "").toLowerCase();
        const raw = (s.raw_data || {}) as Record<string, any>;
        const ip = (raw.proxy_address || "").toLowerCase();
        if (!clientName.includes(q) && !code.includes(q) && !ip.includes(q)) return false;
      }

      return true;
    });
  }, [allSubs, statusFilter, typeFilter, search, profileMap]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Admin maintenance exchange mutation
  const exchangeMutation = useMutation({
    mutationFn: async ({ subscriptionId, city }: { subscriptionId: string; city?: string }) => {
      return callProxyFbflix("admin-maintenance-exchange", { 
        subscription_id: subscriptionId,
        target_city: city 
      });
    },
    onSuccess: (result: any) => {
      toast.success(`Proxy trocado com sucesso! Novo: ${result?.new_proxy || "—"}`);
      queryClient.invalidateQueries({ queryKey: ["maint-proxyfbflix-subs"] });
      setExchangeConfirm(null);
    },
    onError: (err: Error) => {
      toast.error(`Erro: ${err.message}`);
    },
  });

  const [quotaType, setQuotaType] = useState<"free" | "pay">("free");

  // Quota adjustment mutation
  const quotaMutation = useMutation({
    mutationFn: async ({ subId, delta }: { subId: string; delta: number }) => {
      const sub = allSubs?.find((s: any) => s.id === subId);
      if (!sub) throw new Error("Assinatura não encontrada");
      const raw = (sub.raw_data || {}) as Record<string, any>;
      const key = quotaType === "pay" ? "exchange_quota_pay" : "exchange_quota_free";
      const currentVal = raw[key] ?? 0;
      const newVal = Math.max(0, currentVal + delta);
      const updatedRaw = { ...raw, [key]: newVal };

      const functionName = (sub.type === "proxybr") ? "proxybr-api" : "proxyfbflix-api";
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { action: "admin-update-subscription", subscription_id: subId, raw_data: updatedRaw }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Cota atualizada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["maint-proxyfbflix-subs"] });
      setQuotaModal(null);
      setQuotaAmount(1);
    },
    onError: (err: Error) => {
      toast.error(`Erro: ${err.message}`);
    },
  });

  const getStatusInfo = (sub: any) => {
    const now = new Date();
    if (sub.status === "cancelled") return { label: "Cancelado", color: "bg-destructive/20 text-destructive" };
    if (sub.status === "active" && sub.end_date && new Date(sub.end_date) >= now) return { label: "Ativo", color: "bg-green-600/20 text-green-400" };
    return { label: "Expirado", color: "bg-amber-500/20 text-amber-400" };
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
        <CardContent className="p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente, código ou IP..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-10 bg-background/50 border-border/40"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as StatusFilter); setPage(1); }}>
            <SelectTrigger className="w-[120px] h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="expired">Expirados</SelectItem>
              <SelectItem value="cancelled">Cancelados</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v as any); setPage(1); }}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Tipos</SelectItem>
              <SelectItem value="individual">📌 IP Individual</SelectItem>
              <SelectItem value="rotating">🔄 Rotativo</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["maint-proxyfbflix-subs"] })} disabled={isLoading}>
            <RefreshCw className={`size-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />Atualizar
          </Button>
          <Badge variant="outline" className="text-xs">
            {filtered.length} assinatura{filtered.length !== 1 ? "s" : ""}
          </Badge>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Wrench className="size-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold text-foreground">Manutenção de Proxies</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/30">
                  <TableHead>Cliente</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Proxy</TableHead>
                  <TableHead>Localização</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Cotas (Grátis/Paga)</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="border-border/20">
                      {Array.from({ length: 8 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : !paginated.length ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                      Nenhuma assinatura encontrada
                    </TableCell>
                  </TableRow>
                ) : paginated.map((sub: any) => {
                  const raw = (sub.raw_data || {}) as Record<string, any>;
                  const clientName = profileMap.get(sub.user_id) || "—";
                  const isProxyBR = sub.type === "proxybr";
                  const isRotating = sub.type === "proxyfbflix_rotating";
                  // ProxyBR stores proxy data differently
                  const proxyIp = raw.proxy_address || raw.ip || "—";
                  const proxyPort = raw.port || "—";
                  const product = sub.product_id ? productMap.get(sub.product_id) : null;
                  const statusInfo = getStatusInfo(sub);
                  const freeQuota = raw.exchange_quota_free ?? 0;
                  const payQuota = raw.exchange_quota_pay ?? 0;
                  const maintCount = raw.maintenance_exchange_count || 0;
                  const providerLabel = isProxyBR ? "ProxyBR" : "ProxyFbflix";

                  return (
                    <TableRow key={sub.id} className="border-border/20 hover:bg-muted/20">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="size-7 rounded-full bg-muted/50 flex items-center justify-center">
                            <User className="size-3.5 text-muted-foreground" />
                          </div>
                          <span className="font-medium text-foreground text-sm">{clientName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{sub.name}</TableCell>
                      <TableCell className="font-mono text-sm text-foreground">
                        <div className="flex flex-col gap-0.5">
                          {isRotating ? (
                            <span className="text-xs text-amber-400 font-bold uppercase tracking-wider">Rotativo</span>
                          ) : (
                            <span className="text-sm">{proxyIp}:{proxyPort}</span>
                          )}
                          <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[120px]">
                            {raw.username || "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Globe className="size-3.5 text-muted-foreground" />
                          <span className="text-sm text-foreground">
                            {raw.city_name || raw.country_code || "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${isProxyBR ? "border-blue-500/30 text-blue-400" : "border-purple-500/30 text-purple-400"}`}>
                            {providerLabel}
                          </Badge>
                          <span className="truncate">{product?.name || raw.product_name || "Proxy"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs border-0 ${statusInfo.color}`}>{statusInfo.label}</Badge>
                        {maintCount > 0 && (
                          <Badge variant="outline" className="text-[10px] ml-1 border-amber-500/30 text-amber-400">
                            {maintCount}× maint.
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center">
                          <span className={`font-mono text-sm font-bold ${freeQuota > 0 ? "text-green-400" : "text-muted-foreground"}`}>
                            {freeQuota}
                          </span>
                          {payQuota > 0 && (
                            <span className="font-mono text-[10px] font-bold text-primary">
                              +{payQuota} pagas
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {sub.end_date ? new Date(sub.end_date).toLocaleDateString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!isRotating && statusInfo.label === "Ativo" && (
                            <Button
                              variant="ghost" size="sm"
                              className="h-7 px-2 text-xs text-primary hover:text-primary"
                              onClick={() => setExchangeConfirm(sub)}
                              title="Trocar proxy (manutenção)"
                            >
                              <ArrowRightLeft className="size-3.5 mr-1" />Trocar
                            </Button>
                          )}
                          <Button
                            variant="ghost" size="sm"
                            className="h-7 px-2 text-xs text-green-400 hover:text-green-300"
                            onClick={() => { setQuotaModal({ sub, type: "add" }); setQuotaAmount(1); }}
                            title="Adicionar cotas"
                          >
                            <Plus className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                            onClick={() => { setQuotaModal({ sub, type: "remove" }); setQuotaAmount(1); }}
                            title="Remover cotas"
                          >
                            <Minus className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/20">
              <span className="text-xs text-muted-foreground">
                Página {page} de {totalPages}
              </span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" className="h-7" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                  <ChevronLeft className="size-4" />
                </Button>
                <Button variant="outline" size="sm" className="h-7" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Exchange Confirmation Dialog */}
      <Dialog open={!!exchangeConfirm} onOpenChange={(v) => {
        if (!v) {
          setExchangeConfirm(null);
          setTargetCity("");
        }
      }}>
        <DialogContent className="border-border/40 bg-card max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Shield className="size-5 text-primary" />
              Troca de Manutenção
            </DialogTitle>
          </DialogHeader>
          {exchangeConfirm && (() => {
            const raw = (exchangeConfirm.raw_data || {}) as Record<string, any>;
            const clientName = profileMap.get(exchangeConfirm.user_id) || "—";
            return (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Esta troca <strong className="text-foreground">não desconta</strong> da cota do cliente. Use apenas para corrigir proxies com defeito.
                </p>
                <div className="p-3 rounded-lg bg-muted/30 border border-border/30 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cliente</span>
                    <span className="text-foreground font-medium">{clientName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Código</span>
                    <span className="text-foreground font-mono">{exchangeConfirm.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Proxy Atual</span>
                    <span className="text-foreground font-mono">{raw.proxy_address}:{raw.port}</span>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <label className="text-sm font-medium text-foreground">Nova Localização (Opcional)</label>
                  <Select value={targetCity} onValueChange={setTargetCity}>
                    <SelectTrigger className="w-full bg-background/50 border-border/40">
                      <SelectValue placeholder="Manter mesma ou aleatória" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Manter mesma / Aleatória</SelectItem>
                      <SelectItem value="São Paulo">São Paulo, BR</SelectItem>
                      <SelectItem value="Rio de Janeiro">Rio de Janeiro, BR</SelectItem>
                      <SelectItem value="Fortaleza">Fortaleza, BR (Ceará)</SelectItem>
                      <SelectItem value="Curitiba">Curitiba, BR</SelectItem>
                      <SelectItem value="Belo Horizonte">Belo Horizonte, BR</SelectItem>
                      <SelectItem value="Porto Alegre">Porto Alegre, BR</SelectItem>
                      <SelectItem value="Salvador">Salvador, BR</SelectItem>
                      <SelectItem value="Brasília">Brasília, BR</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    Se selecionar uma cidade e não houver estoque, o sistema tentará uma localização próxima.
                  </p>
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setExchangeConfirm(null)}>Cancelar</Button>
            <Button
              onClick={() => exchangeMutation.mutate({ 
                subscriptionId: exchangeConfirm.id, 
                city: targetCity === "none" ? undefined : targetCity 
              })}
              disabled={exchangeMutation.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              {exchangeMutation.isPending ? (
                <><RefreshCw className="size-4 mr-2 animate-spin" />Trocando...</>
              ) : (
                <><ArrowRightLeft className="size-4 mr-2" />Confirmar Troca</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quota Adjustment Dialog */}
      <Dialog open={!!quotaModal} onOpenChange={(v) => !v && setQuotaModal(null)}>
        <DialogContent className="border-border/40 bg-card max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {quotaModal?.type === "add" ? "Adicionar Cotas" : "Remover Cotas"}
            </DialogTitle>
          </DialogHeader>
          {quotaModal && (() => {
            const raw = (quotaModal.sub.raw_data || {}) as Record<string, any>;
            const currentFree = raw.exchange_quota_free ?? 0;
            const currentPay = raw.exchange_quota_pay ?? 0;
            const currentTotal = quotaType === "pay" ? currentPay : currentFree;
            const clientName = profileMap.get(quotaModal.sub.user_id) || "—";
            return (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-muted/30 border border-border/30 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cliente</span>
                    <span className="text-foreground font-medium">{clientName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cotas Atuais</span>
                  <span className="text-foreground font-bold">
                    {quotaType === "free" ? `${currentFree} grátis` : `${currentPay} pagas`}
                  </span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground block">Tipo de Cota</label>
                  <Select value={quotaType} onValueChange={(v: any) => setQuotaType(v)}>
                    <SelectTrigger className="w-full bg-background/50 border-border/40 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Grátis (Normal)</SelectItem>
                      <SelectItem value="pay">Paga (Adicional)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Quantidade</label>
                  <Input
                    type="number" min={1} max={quotaModal.type === "remove" ? currentTotal : 50}
                    value={quotaAmount}
                    onChange={(e) => setQuotaAmount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="bg-background/50 border-border/40"
                  />
                </div>
                <div className="p-2 rounded bg-muted/20 text-sm text-center">
                  <span className="text-muted-foreground">Resultado: </span>
                  <span className="font-bold text-foreground">
                    {quotaModal.type === "add" ? currentTotal + quotaAmount : Math.max(0, currentTotal - quotaAmount)} cotas
                  </span>
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuotaModal(null)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!quotaModal) return;
                const delta = quotaModal.type === "add" ? quotaAmount : -quotaAmount;
                quotaMutation.mutate({ subId: quotaModal.sub.id, delta, type: quotaType });
              }}
              disabled={quotaMutation.isPending}
              className={quotaModal?.type === "add" ? "bg-green-600 hover:bg-green-700" : "bg-destructive hover:bg-destructive/90"}
            >
              {quotaMutation.isPending ? "Salvando..." : quotaModal?.type === "add" ? "Adicionar" : "Remover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
