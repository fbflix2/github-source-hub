import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { 
  Search, ExternalLink, Bell, CheckCircle, Clock, AlertTriangle, 
  ShieldAlert, Plus, Loader2, RefreshCw, Shield
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

  if (status === "em_estoque") {
    return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Na Loja</Badge>;
  }
  if (status === "removed") {
    return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Removido</Badge>;
  }
  if (status === "expired") {
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Expirado</Badge>;
  }
  if (expired || days === 0) {
    return (
      <Badge className="bg-red-500/20 text-red-400 border-red-500/30 animate-pulse">
        <AlertTriangle className="size-3 mr-1" />
        {expired ? "Expirado" : text}
      </Badge>
    );
  }
  if (days <= 1) {
    return (
      <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
        <Clock className="size-3 mr-1" />{text}
      </Badge>
    );
  }
  return (
    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
      <Clock className="size-3 mr-1" />{text}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    em_estoque: { label: "Na Loja", className: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
    active: { label: "Ativo", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
    notified: { label: "Notificado", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    removed: { label: "Removido", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    expired: { label: "Expirado", className: "bg-red-500/20 text-red-400 border-red-500/30" },
  };
  const s = map[status] || map.active;
  return <Badge className={s.className}>{s.label}</Badge>;
}

export default function AdminGestaoBMs() {
  const { isAdmin, loading: authLoading } = useAdminAuth();
  const [items, setItems] = useState<BmTracking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<"all" | "hoje">("all");
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
      // Fetch clients who have Safe BM subscriptions
      supabase.from("safe_bm_vaults").select("user_id").then(({ data }) => {
        if (data) setSafeBmClients(new Set(data.map(v => v.user_id)));
      });
    }
  }, [isAdmin]);

  // Auto-expire items past 8 days that are still active/notified
  useEffect(() => {
    const expireOld = async () => {
      const now = new Date();
      const toExpire = items.filter(i => 
        (i.status === "active" || i.status === "notified") && 
        new Date(i.expires_at).getTime() < now.getTime() - 86400000 // 1 day past expiry = day 8
      );
      if (toExpire.length === 0) return;
      for (const item of toExpire) {
        await supabase.from("bm_tracking").update({ status: "expired" } as any).eq("id", item.id);
      }
      if (toExpire.length > 0) fetchItems();
    };
    if (items.length > 0) expireOld();
  }, [items.length]);

  const filtered = useMemo(() => {
    const todayStr = new Date().toLocaleDateString("pt-BR");
    return items.filter(item => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (dateFilter === "hoje") {
        const itemDate = new Date(item.created_at).toLocaleDateString("pt-BR");
        if (itemDate !== todayStr) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        return (
          (item.client_name || "").toLowerCase().includes(q) ||
          (item.client_email || "").toLowerCase().includes(q) ||
          item.bm_link.toLowerCase().includes(q) ||
          item.product_name.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [items, search, statusFilter, dateFilter]);

  const stats = useMemo(() => {
    const now = Date.now();
    return {
      emEstoque: items.filter(i => i.status === "em_estoque").length,
      active: items.filter(i => i.status === "active").length,
      expiringToday: items.filter(i => {
        const diff = new Date(i.expires_at).getTime() - now;
        return (i.status === "active" || i.status === "notified") && diff > 0 && diff < 86400000;
      }).length,
      expired: items.filter(i => i.status === "expired").length,
      removed: items.filter(i => i.status === "removed").length,
    };
  }, [items]);

  const handleOpenProtect = (item: BmTracking) => {
    // Extract BM name from bm_link field
    const bmNameFromLink = item.bm_link.match(/^(.*?)https?:\/\//)?.[1]?.replace(/[\s|:\-]+$/, '').trim() || "";
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
    } catch (err: any) {
      toast.error(err.message || "Erro ao proteger BM");
    } finally {
      setProtecting(false);
    }
  };

  const handleNotify = async (item: BmTracking) => {
    // Insert notification for client
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
    // Update status
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
    // We need a client_user_id - for manual adds, we'll search by email
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

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestão de BMs</h1>
          <p className="text-sm text-muted-foreground">Controle de backup e remoção de perfil admin nas BMs vendidas</p>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-purple-500/20 bg-purple-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <ShieldAlert className="size-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.emEstoque}</p>
              <p className="text-xs text-muted-foreground">Na Loja</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Clock className="size-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.active}</p>
              <p className="text-xs text-muted-foreground">Ativos</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/20 bg-yellow-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/20">
              <AlertTriangle className="size-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.expiringToday}</p>
              <p className="text-xs text-muted-foreground">Expirando Hoje</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/20">
              <ShieldAlert className="size-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.expired}</p>
              <p className="text-xs text-muted-foreground">Expirados (8d+)</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <CheckCircle className="size-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.removed}</p>
              <p className="text-xs text-muted-foreground">Removidos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, link ou produto..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={dateFilter === "hoje" ? "default" : "outline"}
            size="sm"
            onClick={() => setDateFilter(d => d === "hoje" ? "all" : "hoje")}
            className="h-10"
          >
            Hoje
          </Button>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="em_estoque">Na Loja</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="notified">Notificados</SelectItem>
              <SelectItem value="expired">Expirados</SelectItem>
              <SelectItem value="removed">Removidos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma BM encontrada
            </div>
          ) : (
            <Table>
              <TableHeader>
               <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Nome BM</TableHead>
                  <TableHead>Perfil Matriz</TableHead>
                  <TableHead>Link BM</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Contagem</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(item => (
                  <TableRow key={item.id} className={
                    item.status === "expired" ? "bg-red-500/5" :
                    item.status === "removed" ? "bg-emerald-500/5 opacity-60" : ""
                  }>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground text-sm">{item.client_name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{item.client_email || ""}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{item.product_name}</TableCell>
                    <TableCell className="text-sm font-medium">
                      {item.bm_link.match(/^(.*?)https?:\/\//)?.[1]?.replace(/[\s|:\-]+$/, '').trim() || "—"}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium text-purple-400">{item.perfil_matriz || "—"}</span>
                    </TableCell>
                    <TableCell>
                      <a
                        href={item.bm_link.match(/https?:\/\/\S+/)?.[0] || item.bm_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline text-sm flex items-center gap-1"
                      >
                        <ExternalLink className="size-3" />
                        Abrir BM
                      </a>
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      R$ {Number(item.sale_price).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {item.status === "em_estoque" ? (
                        <span>Enviado {new Date(item.created_at).toLocaleDateString("pt-BR")}</span>
                      ) : (
                        <span>Vendido {new Date(item.sold_at).toLocaleDateString("pt-BR")}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <CountdownBadge expiresAt={item.expires_at} status={item.status} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={item.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {(item.status === "active") && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/10 h-7 text-xs"
                            onClick={() => handleNotify(item)}
                          >
                            <Bell className="size-3 mr-1" /> Notificar
                          </Button>
                        )}
                        {(item.status === "active" || item.status === "notified") && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 h-7 text-xs"
                            onClick={() => handleMarkRemoved(item)}
                          >
                            <CheckCircle className="size-3 mr-1" /> Removido
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
    </div>
  );
}
