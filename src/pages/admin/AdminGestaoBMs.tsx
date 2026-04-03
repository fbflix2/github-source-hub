import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { 
  Search, ExternalLink, Bell, CheckCircle, Clock, AlertTriangle, 
  ShieldAlert, Plus, Loader2, RefreshCw, Shield, Filter, X
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface BmTracking {
  id: string;
  order_id: string | null;
  order_item_id: string | null;
  stock_item_id: string | null;
  client_user_id: string;
  client_name: string | null;
  client_email: string | null;
  product_name: string;
  bm_link: string;
  sale_price: number;
  sold_at: string;
  expires_at: string;
  status: string;
  notified_at: string | null;
  removed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  perfil_matriz?: string | null;
}

function useCountdown(expiresAt: string) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const diff = new Date(expiresAt).getTime() - now;
  if (diff <= 0) return { expired: true, text: "Expirado", days: 0, hours: 0 };
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  return { expired: false, text: `${days}d ${hours}h`, days, hours };
}

function CountdownBadge({ expiresAt, status }: { expiresAt: string; status: string }) {
  const { expired, text, days } = useCountdown(expiresAt);

  if (status === "em_estoque") return null;
  if (status === "removed" || status === "expired") return null;

  if (expired || days === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-400 animate-pulse">
        <AlertTriangle className="size-3" />
        {expired ? "Expirado" : text}
      </span>
    );
  }
  if (days <= 1) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-400">
        <Clock className="size-3" />{text}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
      <Clock className="size-3" />{text}
    </span>
  );
}

const statusConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  em_estoque: { label: "Na Loja", color: "text-purple-400", bg: "bg-purple-500/15", border: "border-purple-500/30" },
  active: { label: "Vendido", color: "text-green-400", bg: "bg-green-500/15", border: "border-green-500/30" },
  notified: { label: "Notificado", color: "text-yellow-400", bg: "bg-yellow-500/15", border: "border-yellow-500/30" },
  removed: { label: "Removido", color: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/30" },
  expired: { label: "Expirado", color: "text-red-400", bg: "bg-red-500/15", border: "border-red-500/30" },
};

function StatusBadge({ status }: { status: string }) {
  const s = statusConfig[status] || statusConfig.active;
  return <Badge className={`${s.bg} ${s.color} ${s.border} text-[11px] font-semibold`}>{s.label}</Badge>;
}

function extractBmName(bmLink: string) {
  return bmLink.match(/^(.*?)https?:\/\//)?.[1]?.replace(/[\s|:\-]+$/, '').trim() || "";
}

function extractBmUrl(bmLink: string) {
  return bmLink.match(/https?:\/\/\S+/)?.[0] || bmLink;
}

const formatPrice = (v: number) => {
  if (!v || v === 0) return null;
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
};

export default function AdminGestaoBMs() {
  const { isAdmin, loading: authLoading } = useAdminAuth();
  const [items, setItems] = useState<BmTracking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    client_name: "", client_email: "", product_name: "", bm_link: "", sale_price: "", notes: ""
  });
  const [adding, setAdding] = useState(false);
  const [protectOpen, setProtectOpen] = useState(false);
  const [protectItem, setProtectItem] = useState<BmTracking | null>(null);
  const [protectForm, setProtectForm] = useState({ bmName: "", bmLink: "" });
  const [protecting, setProtecting] = useState(false);
  const [safeBmClients, setSafeBmClients] = useState<Set<string>>(new Set());
  const [protectedBmTrackingIds, setProtectedBmTrackingIds] = useState<Set<string>>(new Set());

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("bm_tracking")
      .select("*, stock_items:stock_item_id(data)")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar BMs: " + error.message);
    } else {
      const mapped = (data || []).map((item: any) => ({
        ...item,
        perfil_matriz: item.stock_items?.data?.perfilBackup || null,
        stock_items: undefined,
      }));
      setItems(mapped as BmTracking[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin !== null) {
      fetchItems();
      const safeBmSet = new Set<string>();
      
      supabase.from("safe_bm_vaults").select("user_id, bm_tracking_id").then(({ data }) => {
        const protectedIds = new Set<string>();
        if (data) {
          data.forEach((v: any) => {
            safeBmSet.add(v.user_id);
            if (v.bm_tracking_id) protectedIds.add(v.bm_tracking_id);
          });
        }
        setProtectedBmTrackingIds(protectedIds);
      });

      const SAFE_BM_PRODUCT_ID = "e5118c63-ed52-4f4e-8983-f44c1ba0d17b";
      supabase
        .from("order_items")
        .select("orders!inner(user_id, status)")
        .eq("product_id", SAFE_BM_PRODUCT_ID)
        .eq("orders.status", "completed")
        .then(({ data }) => {
          if (data) {
            data.forEach((oi: any) => {
              const uid = oi.orders?.user_id;
              if (uid) safeBmSet.add(uid);
            });
          }
          setSafeBmClients(new Set(safeBmSet));
        });
    }
  }, [isAdmin]);

  useEffect(() => {
    const expireOld = async () => {
      const now = new Date();
      const toExpire = items.filter(i => 
        (i.status === "active" || i.status === "notified") && 
        new Date(i.expires_at).getTime() < now.getTime() - 86400000
      );
      if (toExpire.length === 0) return;
      for (const item of toExpire) {
        await supabase.from("bm_tracking").update({ status: "expired" } as any).eq("id", item.id);
      }
      if (toExpire.length > 0) fetchItems();
    };
    if (items.length > 0) expireOld();
  }, [items.length]);

  // Unique client names for filter
  const uniqueClients = useMemo(() => {
    const names = new Set<string>();
    items.forEach(i => {
      if (i.client_name && i.client_name.trim()) names.add(i.client_name.trim());
    });
    return Array.from(names).sort();
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter(item => {
      if (statusFilter !== "all") {
        if (statusFilter === "vendidos") {
          // "Vendidos" includes active + notified (both are sold BMs)
          if (item.status !== "active" && item.status !== "notified") return false;
        } else {
          if (item.status !== statusFilter) return false;
        }
      }
      if (clientFilter && (item.client_name || "").trim() !== clientFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          (item.client_name || "").toLowerCase().includes(q) ||
          (item.client_email || "").toLowerCase().includes(q) ||
          item.bm_link.toLowerCase().includes(q) ||
          item.product_name.toLowerCase().includes(q) ||
          extractBmName(item.bm_link).toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [items, search, statusFilter, clientFilter]);

  const stats = useMemo(() => {
    const now = Date.now();
    return {
      total: items.length,
      emEstoque: items.filter(i => i.status === "em_estoque").length,
      vendidos: items.filter(i => i.status === "active" || i.status === "notified").length,
      expiringToday: items.filter(i => {
        const diff = new Date(i.expires_at).getTime() - now;
        return (i.status === "active" || i.status === "notified") && diff > 0 && diff < 86400000;
      }).length,
      expired: items.filter(i => i.status === "expired").length,
      removed: items.filter(i => i.status === "removed").length,
    };
  }, [items]);

  const handleOpenProtect = (item: BmTracking) => {
    const bmNameFromLink = extractBmName(item.bm_link);
    setProtectItem(item);
    setProtectForm({ bmName: bmNameFromLink, bmLink: "" });
    setProtectOpen(true);
  };

  const handleProtect = async () => {
    if (!protectItem) return;
    if (!protectForm.bmName.trim()) return toast.error("Digite o nome da BM");
    if (!protectForm.bmLink.trim()) return toast.error("Cole o link de convite da BM");

    setProtecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-fix-duplicate", {
        body: {
          action: "admin_protect_bm",
          client_user_id: protectItem.client_user_id,
          bm_name: protectForm.bmName.trim(),
          bm_link: protectForm.bmLink.trim(),
          bm_tracking_id: protectItem.id,
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Erro ao proteger");
      }

      toast.success(
        data.mode === "configured_existing"
          ? "Cofre existente configurado com sucesso!"
          : "Novo cofre Safe BM criado com sucesso!"
      );
      setProtectOpen(false);
      if (protectItem) {
        setProtectedBmTrackingIds(prev => new Set([...prev, protectItem.id]));
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao proteger BM");
    } finally {
      setProtecting(false);
    }
  };

  const handleNotify = async (item: BmTracking) => {
    const { error: notifErr } = await supabase.from("notifications").insert({
      user_id: item.client_user_id,
      title: "Remoção de Perfil Backup - BM",
      message: `Seus 7 dias de backup na BM "${item.product_name}" expiraram. Por favor, remova nosso perfil de administrador. Após o 8º dia, não somos mais responsáveis pela BM.`,
      type: "info",
    });
    if (notifErr) {
      toast.error("Erro ao notificar: " + notifErr.message);
      return;
    }
    const { error } = await supabase
      .from("bm_tracking")
      .update({ status: "notified", notified_at: new Date().toISOString() } as any)
      .eq("id", item.id);
    if (error) {
      toast.error("Erro ao atualizar status: " + error.message);
    } else {
      toast.success("Cliente notificado com sucesso!");
      fetchItems();
    }
  };

  const handleMarkRemoved = async (item: BmTracking) => {
    const { error } = await supabase
      .from("bm_tracking")
      .update({ status: "removed", removed_at: new Date().toISOString() } as any)
      .eq("id", item.id);
    if (error) {
      toast.error("Erro: " + error.message);
    } else {
      toast.success("Marcado como removido!");
      fetchItems();
    }
  };

  const handleAdd = async () => {
    if (!addForm.bm_link || !addForm.product_name) {
      toast.error("Link da BM e nome do produto são obrigatórios");
      return;
    }
    setAdding(true);
    let clientUserId = "00000000-0000-0000-0000-000000000000";
    if (addForm.client_email) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id")
        .ilike("full_name", `%${addForm.client_name}%`)
        .limit(1)
        .maybeSingle();
      if (profile) clientUserId = profile.user_id;
    }

    const { error } = await supabase.from("bm_tracking").insert({
      client_user_id: clientUserId,
      client_name: addForm.client_name || null,
      client_email: addForm.client_email || null,
      product_name: addForm.product_name,
      bm_link: addForm.bm_link,
      sale_price: parseFloat(addForm.sale_price) || 0,
      notes: addForm.notes || null,
    } as any);

    if (error) {
      toast.error("Erro ao adicionar: " + error.message);
    } else {
      toast.success("BM adicionada com sucesso!");
      setAddOpen(false);
      setAddForm({ client_name: "", client_email: "", product_name: "", bm_link: "", sale_price: "", notes: "" });
      fetchItems();
    }
    setAdding(false);
  };

  const hasActiveFilters = statusFilter !== "all" || clientFilter !== "" || search !== "";

  const clearFilters = () => {
    setStatusFilter("all");
    setClientFilter("");
    setSearch("");
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
          <h1 className="text-2xl font-bold text-foreground">Gestão de BMs</h1>
          <p className="text-sm text-muted-foreground">Controle de backup e remoção de perfil admin</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchItems}>
            <RefreshCw className="size-4 mr-1" /> Atualizar
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="size-4 mr-1" /> Adicionar BM
          </Button>
        </div>
      </div>

      {/* Stats - compact */}
      <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
        {[
          { label: "Na Loja", count: stats.emEstoque, color: "purple", onClick: () => setStatusFilter(statusFilter === "em_estoque" ? "all" : "em_estoque") },
          { label: "Vendidos", count: stats.active, color: "green", onClick: () => setStatusFilter(statusFilter === "active" ? "all" : "active") },
          { label: "Expirando", count: stats.expiringToday, color: "yellow", onClick: undefined },
          { label: "Expirados", count: stats.expired, color: "red", onClick: () => setStatusFilter(statusFilter === "expired" ? "all" : "expired") },
          { label: "Removidos", count: stats.removed, color: "emerald", onClick: () => setStatusFilter(statusFilter === "removed" ? "all" : "removed") },
        ].map(s => (
          <button
            key={s.label}
            onClick={s.onClick}
            className={`p-3 rounded-lg border transition-all text-left ${
              s.color === "purple" ? "border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/10" :
              s.color === "green" ? "border-green-500/20 bg-green-500/5 hover:bg-green-500/10" :
              s.color === "yellow" ? "border-yellow-500/20 bg-yellow-500/5 hover:bg-yellow-500/10" :
              s.color === "red" ? "border-red-500/20 bg-red-500/5 hover:bg-red-500/10" :
              "border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10"
            }`}
          >
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
              <Input
                placeholder="Buscar por cliente, BM, produto..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <Filter className="size-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="em_estoque">Na Loja</SelectItem>
                <SelectItem value="active">Vendidos</SelectItem>
                <SelectItem value="notified">Notificados</SelectItem>
                <SelectItem value="expired">Expirados</SelectItem>
                <SelectItem value="removed">Removidos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={clientFilter || "all"} onValueChange={v => setClientFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filtrar por Cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Clientes</SelectItem>
                {uniqueClients.map(name => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10 px-3 text-muted-foreground">
                <X className="size-4 mr-1" /> Limpar
              </Button>
            )}
          </div>
          {hasActiveFilters && (
            <p className="text-xs text-muted-foreground mt-2">
              Mostrando {filtered.length} de {items.length} registros
            </p>
          )}
        </CardContent>
      </Card>

      {/* BM Cards / List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma BM encontrada
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {/* Table header - desktop only */}
          <div className="hidden lg:grid lg:grid-cols-[1fr_120px_1fr_100px_80px_100px_120px] gap-4 px-4 py-2 text-xs text-muted-foreground uppercase tracking-wider font-medium">
            <span>Cliente / BM</span>
            <span>Produto</span>
            <span>Nome BM</span>
            <span>Preço</span>
            <span>Prazo</span>
            <span>Status</span>
            <span className="text-right">Ações</span>
          </div>

          {filtered.map(item => {
            const bmName = extractBmName(item.bm_link);
            const bmUrl = extractBmUrl(item.bm_link);
            const price = formatPrice(Number(item.sale_price));
            const dateStr = item.status === "em_estoque"
              ? new Date(item.created_at).toLocaleDateString("pt-BR")
              : new Date(item.sold_at).toLocaleDateString("pt-BR");
            const isProtected = protectedBmTrackingIds.has(item.id);
            const canProtect = (item.status === "active" || item.status === "notified") &&
              item.client_user_id !== "00000000-0000-0000-0000-000000000000" &&
              safeBmClients.has(item.client_user_id) && !isProtected;

            return (
              <Card key={item.id} className={`transition-all ${
                item.status === "expired" ? "border-red-500/20 bg-red-500/5" :
                item.status === "removed" ? "opacity-60" : ""
              }`}>
                <CardContent className="p-4">
                  {/* Desktop layout */}
                  <div className="hidden lg:grid lg:grid-cols-[1fr_120px_1fr_100px_80px_100px_120px] gap-4 items-center">
                    {/* Client */}
                    <div className="min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">{item.client_name || "—"}</p>
                      {item.client_email && (
                        <p className="text-xs text-muted-foreground truncate">{item.client_email}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">{dateStr}</p>
                    </div>

                    {/* Product */}
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground truncate">{item.product_name}</p>
                      {item.perfil_matriz && (
                        <p className="text-[10px] text-purple-400 truncate">{item.perfil_matriz}</p>
                      )}
                    </div>

                    {/* BM Name + Link */}
                    <div className="min-w-0 flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{bmName || "—"}</p>
                      </div>
                      <a
                        href={bmUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80 transition-colors shrink-0"
                        title="Abrir BM"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    </div>

                    {/* Price */}
                    <p className={`text-sm font-semibold ${price ? "text-foreground" : "text-muted-foreground/40"}`}>
                      {price || "—"}
                    </p>

                    {/* Countdown */}
                    <div>
                      <CountdownBadge expiresAt={item.expires_at} status={item.status} />
                    </div>

                    {/* Status */}
                    <StatusBadge status={item.status} />

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-1 flex-wrap">
                      {isProtected && (
                        <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[10px] px-2 py-0.5">
                          <Shield className="size-3 mr-0.5" /> Protegido
                        </Badge>
                      )}
                      {canProtect && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-purple-400 border-purple-500/30 hover:bg-purple-500/10 h-6 text-[10px] px-2"
                          onClick={() => handleOpenProtect(item)}
                        >
                          <Shield className="size-3 mr-0.5" /> Proteger
                        </Button>
                      )}
                      {item.status === "active" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/10 h-6 text-[10px] px-2"
                          onClick={() => handleNotify(item)}
                        >
                          <Bell className="size-3 mr-0.5" /> Notificar
                        </Button>
                      )}
                      {(item.status === "active" || item.status === "notified") && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 h-6 text-[10px] px-2"
                          onClick={() => handleMarkRemoved(item)}
                        >
                          <CheckCircle className="size-3 mr-0.5" /> Removido
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Mobile layout */}
                  <div className="lg:hidden space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-foreground text-sm truncate">{item.client_name || "Sem cliente"}</p>
                          <StatusBadge status={item.status} />
                        </div>
                        {item.client_email && (
                          <p className="text-xs text-muted-foreground truncate">{item.client_email}</p>
                        )}
                      </div>
                      <a
                        href={bmUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80 p-1"
                      >
                        <ExternalLink className="size-4" />
                      </a>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      <span className="text-muted-foreground">
                        <span className="font-medium text-foreground">{item.product_name}</span>
                      </span>
                      {bmName && (
                        <span className="text-muted-foreground">
                          BM: <span className="font-medium text-foreground">{bmName}</span>
                        </span>
                      )}
                      {price && (
                        <span className="font-semibold text-foreground">{price}</span>
                      )}
                      <span className="text-muted-foreground">{dateStr}</span>
                      <CountdownBadge expiresAt={item.expires_at} status={item.status} />
                    </div>

                    <div className="flex items-center gap-1 flex-wrap">
                      {isProtected && (
                        <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[10px] px-2 py-0.5">
                          <Shield className="size-3 mr-0.5" /> Protegido
                        </Badge>
                      )}
                      {canProtect && (
                        <Button size="sm" variant="outline" className="text-purple-400 border-purple-500/30 hover:bg-purple-500/10 h-7 text-xs" onClick={() => handleOpenProtect(item)}>
                          <Shield className="size-3 mr-1" /> Proteger
                        </Button>
                      )}
                      {item.status === "active" && (
                        <Button size="sm" variant="outline" className="text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/10 h-7 text-xs" onClick={() => handleNotify(item)}>
                          <Bell className="size-3 mr-1" /> Notificar
                        </Button>
                      )}
                      {(item.status === "active" || item.status === "notified") && (
                        <Button size="sm" variant="outline" className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 h-7 text-xs" onClick={() => handleMarkRemoved(item)}>
                          <CheckCircle className="size-3 mr-1" /> Removido
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add BM Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar BM Manualmente</DialogTitle>
            <DialogDescription>Registre uma BM vendida para acompanhar o período de 7 dias</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do Cliente</Label>
                <Input value={addForm.client_name} onChange={e => setAddForm(f => ({ ...f, client_name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Email do Cliente</Label>
                <Input value={addForm.client_email} onChange={e => setAddForm(f => ({ ...f, client_email: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nome do Produto *</Label>
              <Input value={addForm.product_name} onChange={e => setAddForm(f => ({ ...f, product_name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Link da BM *</Label>
              <Input value={addForm.bm_link} onChange={e => setAddForm(f => ({ ...f, bm_link: e.target.value }))} placeholder="https://business.facebook.com/..." />
            </div>
            <div className="space-y-2">
              <Label>Preço de Venda (R$)</Label>
              <Input type="number" value={addForm.sale_price} onChange={e => setAddForm(f => ({ ...f, sale_price: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={adding}>
              {adding && <Loader2 className="size-4 mr-1 animate-spin" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Protect BM Dialog */}
      <Dialog open={protectOpen} onOpenChange={setProtectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="size-5 text-purple-400" />
              Proteger BM via Safe BM
            </DialogTitle>
            <DialogDescription>
              Configure o cofre Safe BM para a BM vendida ao cliente <strong>{protectItem?.client_name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da BM</Label>
              <Input
                value={protectForm.bmName}
                onChange={e => setProtectForm(f => ({ ...f, bmName: e.target.value }))}
                placeholder="Ex: BM Principal"
              />
            </div>
            <div className="space-y-2">
              <Label>Link de Convite da BM</Label>
              <Input
                value={protectForm.bmLink}
                onChange={e => setProtectForm(f => ({ ...f, bmLink: e.target.value }))}
                placeholder="https://business.facebook.com/settings/..."
              />
              <p className="text-xs text-muted-foreground">
                Cole o link de convite de admin da BM para configurar o cofre seguro.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProtectOpen(false)}>Cancelar</Button>
            <Button onClick={handleProtect} disabled={protecting} className="bg-purple-600 hover:bg-purple-500">
              {protecting ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Shield className="size-4 mr-1" />}
              Proteger BM
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
