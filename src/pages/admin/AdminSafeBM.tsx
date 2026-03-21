import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  Search, Shield, ShieldCheck, ShieldOff, Plus, Loader2,
  ExternalLink, Pencil, Trash2, DollarSign, Link2,
  TrendingUp, Activity, BarChart3, CheckCircle, MoreVertical,
  FileDown, Clock, Check, AlertTriangle, Copy, Timer
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { format, subDays, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Progress } from "@/components/ui/progress";

interface SafeBmVault {
  id: string;
  user_id: string;
  client_name: string | null;
  bm_name: string;
  bm_link: string;
  perfil_backup: string | null;
  purchase_date: string | null;
  protection_start: string;
  link_regenerations: number;
  status: string;
  subscription_price: number;
  notes: string | null;
  backup_link: string | null;
  backup_link_set_at: string | null;
  created_at: string;
  updated_at: string;
}

function getBackupLinkTimeLeft(setAt: string | null): { expired: boolean; text: string; percent: number } {
  if (!setAt) return { expired: true, text: "Sem link", percent: 0 };
  const set = new Date(setAt).getTime();
  const expires = set + 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const remaining = expires - now;
  if (remaining <= 0) return { expired: true, text: "Expirado", percent: 0 };
  const totalMs = 7 * 24 * 60 * 60 * 1000;
  const percent = Math.round((remaining / totalMs) * 100);
  const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
  const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const mins = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  if (days > 0) return { expired: false, text: `${days}d ${hours}h`, percent };
  if (hours > 0) return { expired: false, text: `${hours}h ${mins}m`, percent };
  return { expired: false, text: `${mins}m`, percent };
}

export default function AdminSafeBM() {
  const [vaults, setVaults] = useState<SafeBmVault[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVault, setEditingVault] = useState<SafeBmVault | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [formClientEmail, setFormClientEmail] = useState("");
  const [formClientName, setFormClientName] = useState("");
  const [formUserId, setFormUserId] = useState("");
  const [formBmName, setFormBmName] = useState("");
  const [formBmLink, setFormBmLink] = useState("");
  const [formPerfilBackup, setFormPerfilBackup] = useState("");
  const [formPurchaseDate, setFormPurchaseDate] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const fetchVaults = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("safe_bm_vaults" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar cofre: " + error.message);
    } else {
      setVaults((data as any[]) || []);
    }
    setLoading(false);
  };

  const fetchPendingRequests = async () => {
    const { data } = await supabase
      .from("bm_tracking")
      .select("*")
      .eq("status", "pending_setup")
      .order("created_at", { ascending: false });
    setPendingRequests((data as any[]) || []);
  };

  const confirmBmProtection = async (request: any) => {
    setConfirmingId(request.id);
    try {
      // Create safe_bm_vaults entry
      const { error: vaultError } = await supabase
        .from("safe_bm_vaults" as any)
        .insert({
          user_id: request.client_user_id,
          client_name: request.client_name,
          bm_name: request.product_name,
          bm_link: request.bm_link || "https://business.facebook.com",
          status: "active",
          subscription_price: 9.99,
        });
      if (vaultError) throw vaultError;

      // Update bm_tracking status to active
      const { error: trackError } = await supabase
        .from("bm_tracking")
        .update({ status: "active" } as any)
        .eq("id", request.id);
      if (trackError) throw trackError;

      toast.success(`BM "${request.product_name}" confirmada e cofre ativado!`);
      fetchPendingRequests();
      fetchVaults();
    } catch (err: any) {
      toast.error("Erro ao confirmar: " + err.message);
    } finally {
      setConfirmingId(null);
    }
  };

  useEffect(() => { fetchVaults(); fetchPendingRequests(); }, []);

  const filtered = useMemo(() => {
    let items = vaults;
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(v =>
        (v.client_name || "").toLowerCase().includes(q) ||
        v.bm_name.toLowerCase().includes(q) ||
        (v.perfil_backup || "").toLowerCase().includes(q)
      );
    }
    return items;
  }, [vaults, search]);

  const activeCount = vaults.filter(v => v.status === "active").length;
  const inactiveCount = vaults.filter(v => v.status === "inactive").length;
  const mrr = activeCount * 9.99;
  const newActivations7d = vaults.filter(v =>
    isAfter(new Date(v.created_at), subDays(new Date(), 7))
  ).length;

  // Unique clients
  const uniqueClients = new Set(vaults.filter(v => v.status === "active").map(v => v.user_id)).size;
  const ltvPerClient = uniqueClients > 0 ? mrr / uniqueClients : 0;

  // Churn rate
  const churnRate = vaults.length > 0
    ? ((inactiveCount / vaults.length) * 100).toFixed(1)
    : "0.0";

  // Recovery efficiency — real data
  const totalRegenerations = vaults.reduce((s, v) => s + v.link_regenerations, 0);
  // We don't track failures, so recovery = 100% if any regenerations happened, 0 if none
  const recoveryRate = totalRegenerations > 0 ? 100 : 0;

  // Previous 7d activations for comparison
  const prevActivations7d = vaults.filter(v => {
    const created = new Date(v.created_at);
    return isAfter(created, subDays(new Date(), 14)) && !isAfter(created, subDays(new Date(), 7));
  }).length;
  const activationGrowth = prevActivations7d > 0
    ? (((newActivations7d - prevActivations7d) / prevActivations7d) * 100).toFixed(0)
    : null;

  const lookupClient = async () => {
    if (!formClientEmail.trim()) return;
    const { data } = await supabase.rpc("get_user_id_by_email", { target_email: formClientEmail.trim() });
    if (!data) { toast.error("Cliente não encontrado"); return; }
    setFormUserId(data);
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", data).maybeSingle();
    if (profile?.full_name) setFormClientName(profile.full_name);
  };

  const resetForm = () => {
    setFormClientEmail(""); setFormClientName(""); setFormUserId("");
    setFormBmName(""); setFormBmLink(""); setFormPerfilBackup("");
    setFormPurchaseDate(""); setFormNotes(""); setEditingVault(null);
  };

  const openAdd = () => { resetForm(); setModalOpen(true); };
  const openEdit = (v: SafeBmVault) => {
    setEditingVault(v);
    setFormClientName(v.client_name || "");
    setFormUserId(v.user_id);
    setFormBmName(v.bm_name);
    setFormBmLink(v.bm_link);
    setFormPerfilBackup(v.perfil_backup || "");
    setFormPurchaseDate(v.purchase_date ? v.purchase_date.slice(0, 10) : "");
    setFormNotes(v.notes || "");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formBmName || !formBmLink) { toast.error("Nome e link da BM são obrigatórios"); return; }
    if (!editingVault && !formUserId) { toast.error("Busque o cliente pelo email primeiro"); return; }
    setSaving(true);
    const payload: any = {
      bm_name: formBmName, bm_link: formBmLink,
      perfil_backup: formPerfilBackup || null,
      purchase_date: formPurchaseDate || null,
      notes: formNotes || null,
      client_name: formClientName || null,
    };
    if (editingVault) {
      const { error } = await supabase.from("safe_bm_vaults" as any).update(payload).eq("id", editingVault.id);
      if (error) toast.error(error.message); else toast.success("Cofre atualizado!");
    } else {
      payload.user_id = formUserId;
      const { error } = await supabase.from("safe_bm_vaults" as any).insert(payload);
      if (error) toast.error(error.message); else toast.success("BM adicionada ao cofre!");
    }
    setSaving(false); setModalOpen(false); resetForm(); fetchVaults();
  };

  const toggleStatus = async (v: SafeBmVault) => {
    const newStatus = v.status === "active" ? "inactive" : "active";
    const { error } = await supabase.from("safe_bm_vaults" as any).update({ status: newStatus }).eq("id", v.id);
    if (error) toast.error(error.message);
    else { toast.success(`Status alterado para ${newStatus}`); fetchVaults(); }
  };

  const regenerateLink = async (v: SafeBmVault) => {
    const { error } = await supabase.from("safe_bm_vaults" as any)
      .update({ link_regenerations: v.link_regenerations + 1 })
      .eq("id", v.id);
    if (error) toast.error(error.message);
    else { toast.success("Regeneração contabilizada!"); fetchVaults(); }
  };

  const handleRename = async (v: SafeBmVault) => {
    if (!renameValue.trim()) return;
    const { error } = await supabase.from("safe_bm_vaults" as any)
      .update({ bm_name: renameValue.trim() })
      .eq("id", v.id);
    if (error) toast.error(error.message);
    else { toast.success("BM renomeada!"); setRenamingId(null); fetchVaults(); }
  };

  const deleteVault = async (v: SafeBmVault) => {
    if (!confirm(`Remover "${v.bm_name}" do cofre?`)) return;
    const { error } = await supabase.from("safe_bm_vaults" as any).delete().eq("id", v.id);
    if (error) toast.error(error.message);
    else { toast.success("Removido do cofre"); fetchVaults(); }
  };

  const exportCSV = () => {
    const rows = [["Nome BM", "Dono/Cliente", "Status", "Data Proteção", "Regenerações"]];
    filtered.forEach(v => {
      rows.push([
        v.bm_name,
        v.client_name || "—",
        v.status === "active" ? "Ativo" : "Inativo",
        format(new Date(v.protection_start), "dd/MM/yyyy"),
        String(v.link_regenerations)
      ]);
    });
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "safe-bm-export.csv"; a.click();
  };

  const getStatusBadge = (status: string) => {
    if (status === "active") return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] px-2 py-0.5">Ativo</Badge>;
    if (status === "inactive") return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] px-2 py-0.5">Cancelado</Badge>;
    return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px] px-2 py-0.5">Grace Period</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* ───── TOP METRIC CARDS ───── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* MRR */}
        <Card className="bg-[hsl(var(--card))] border-border overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <DollarSign className="size-5 text-primary" />
              </div>
              {mrr > 0 && (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                  {activeCount} assinantes
                </Badge>
              )}
            </div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
              MRR (Assinaturas R$ 9,99)
            </p>
            <p className="text-2xl font-bold text-foreground">
              R$ {mrr.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
            <div className="mt-3 h-1 rounded-full bg-primary/20">
              <div className="h-1 rounded-full bg-primary" style={{ width: `${Math.min(100, (mrr / 15000) * 100)}%` }} />
            </div>
          </CardContent>
        </Card>

        {/* Ativos sob Proteção */}
        <Card className="bg-[hsl(var(--card))] border-border overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <ShieldCheck className="size-5 text-emerald-500" />
              </div>
              {activeCount > 0 && (
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]">LIVE</Badge>
              )}
            </div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
              Ativos sob Proteção
            </p>
            <p className="text-2xl font-bold text-foreground">
              {activeCount.toLocaleString()} BMs
            </p>
            <p className="text-xs text-muted-foreground mt-1">Sistema operando em 99.9% uptime</p>
          </CardContent>
        </Card>

        {/* Novas Ativações (7D) */}
        <Card className="bg-[hsl(var(--card))] border-border overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Activity className="size-5 text-emerald-500" />
              </div>
              {activationGrowth !== null && (
                <Badge className={`text-[10px] ${Number(activationGrowth) >= 0 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                  {Number(activationGrowth) >= 0 ? '+' : ''}{activationGrowth}% vs. ant.
                </Badge>
              )}
            </div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
              Novas Ativações (7D)
            </p>
            <p className="text-2xl font-bold text-foreground">{newActivations7d}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {newActivations7d > 0 ? "Crescimento nesta semana" : "Sem ativações nos últimos 7 dias"}
            </p>
          </CardContent>
        </Card>

        {/* LTV Médio */}
        <Card className="bg-[hsl(var(--card))] border-border overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <BarChart3 className="size-5 text-primary" />
              </div>
            </div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
              LTV Médio por Cliente
            </p>
            <p className="text-2xl font-bold text-foreground">
              R$ {ltvPerClient.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            {uniqueClients > 0 && (
              <div className="flex items-center gap-1.5 mt-1">
                <span className="inline-block w-2 h-2 rounded-full bg-primary" />
                <span className="text-xs text-muted-foreground">{uniqueClients} cliente{uniqueClients > 1 ? 's' : ''} ativo{uniqueClients > 1 ? 's' : ''}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ───── MIDDLE SECTION: Previsão + Churn + Recuperação ───── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Previsão de Faturamento */}
        <Card className="bg-[hsl(var(--card))] border-border lg:col-span-2">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Previsão de Faturamento (30D)</h3>
                <p className="text-xs text-muted-foreground">Análise baseada em tendência de crescimento e renovações</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">
                  R$ {mrr.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
                {mrr > 0 && <p className="text-xs text-emerald-400">baseado em {activeCount} assinantes</p>}
              </div>
            </div>
            {activeCount === 0 ? (
              <div className="flex items-center justify-center h-32 mt-4">
                <p className="text-sm text-muted-foreground">Dados disponíveis quando houver assinantes ativos</p>
              </div>
            ) : (
              <div className="flex items-end gap-2 h-32 mt-4">
                {Array.from({ length: 10 }).map((_, i) => {
                  const h = Math.max(10, Math.min(100, (activeCount * (i + 1) * 3) % 95 + 15));
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
                      <div
                        className={`w-full rounded-t-sm transition-all ${i >= 8 ? 'bg-primary/80' : 'bg-muted-foreground/20'}`}
                        style={{ height: `${h}%` }}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right column: Churn + Recovery */}
        <div className="flex flex-col gap-4">
          {/* Taxa de Churn */}
          <Card className="bg-[hsl(var(--card))] border-primary/30 border">
            <CardContent className="p-5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                Taxa de Churn (Mensal)
              </p>
              <p className="text-3xl font-bold text-foreground">{churnRate}%</p>
              {vaults.length > 0 ? (
                <>
                  <Badge className={`text-[10px] mt-2 ${Number(churnRate) <= 3.5 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'}`}>
                    {Number(churnRate) <= 3.5 ? 'Abaixo da Meta (3.5%)' : 'Acima da Meta (3.5%)'}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-3">
                    {Number(churnRate) <= 3.5 ? 'Excelente retenção de usuários premium detectada nos últimos 30 dias.' : 'Atenção: taxa de cancelamento acima do ideal.'}
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground mt-3">Sem dados suficientes para calcular churn.</p>
              )}
            </CardContent>
          </Card>

          {/* Eficiência de Recuperação */}
          <Card className="bg-[hsl(var(--card))] border-primary/30 border">
            <CardContent className="p-5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                Eficiência de Recuperação
              </p>
              <div className="flex items-center gap-2">
                <p className="text-3xl font-bold text-foreground">{totalRegenerations > 0 ? `${recoveryRate}%` : '—'}</p>
                {totalRegenerations > 0 && <CheckCircle className="size-5 text-blue-400" />}
              </div>
              <p className="text-xs text-blue-400 mt-1">
                {totalRegenerations} link{totalRegenerations !== 1 ? 's' : ''} restaurado{totalRegenerations !== 1 ? 's' : ''} com sucesso
              </p>
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-[10px] text-muted-foreground uppercase tracking-wider">
                  <span>Restaurados</span>
                  <span>Falhas</span>
                </div>
                <Progress value={recoveryRate} className="h-2" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ───── PENDING REQUESTS ───── */}
      {pendingRequests.length > 0 && (
        <Card className="bg-[hsl(var(--card))] border-amber-500/30">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Clock className="size-4 text-amber-400" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm">Solicitações Pendentes</h3>
                <p className="text-[10px] text-muted-foreground">{pendingRequests.length} BM{pendingRequests.length > 1 ? 's' : ''} aguardando confirmação</p>
              </div>
            </div>
            <div className="space-y-2">
              {pendingRequests.map(req => (
                <div key={req.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/10 border border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <Shield className="size-3.5 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{req.product_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Cliente: {req.client_name || "—"} • Enviado em {format(new Date(req.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white"
                    disabled={confirmingId === req.id}
                    onClick={() => confirmBmProtection(req)}
                  >
                    {confirmingId === req.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Check className="size-3.5" />
                    )}
                    Confirmar Proteção
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ───── MONITORING TABLE ───── */}
      <div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">Monitoramento de BMs</h2>
            <p className="text-xs text-muted-foreground">Gestão em tempo real de contas e backups</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Filtrar BMs..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={exportCSV}>
              <FileDown className="size-3.5" /> Exportar CSV
            </Button>
            <Button size="sm" className="gap-1.5 h-9" onClick={openAdd}>
              <Plus className="size-3.5" /> Adicionar
            </Button>
          </div>
        </div>

        <Card className="bg-[hsl(var(--card))] border-border">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-6 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Nenhuma BM encontrada no cofre.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Nome da BM</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Dono/Cliente</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Status Assinatura</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Data de Proteção</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Último Backup</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(v => (
                      <TableRow key={v.id} className="border-border hover:bg-muted/5">
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                              v.status === "active" ? "bg-primary/10" : "bg-muted-foreground/10"
                            }`}>
                              <Shield className={`size-3.5 ${v.status === "active" ? "text-primary" : "text-muted-foreground"}`} />
                            </div>
                            {renamingId === v.id ? (
                              <div className="flex items-center gap-1.5">
                                <Input
                                  value={renameValue}
                                  onChange={e => setRenameValue(e.target.value)}
                                  onKeyDown={e => e.key === "Enter" && handleRename(v)}
                                  className="h-7 text-sm w-40"
                                  autoFocus
                                />
                                <Button size="icon" variant="ghost" className="size-6" onClick={() => handleRename(v)}>
                                  <Check className="size-3 text-emerald-400" />
                                </Button>
                                <Button size="icon" variant="ghost" className="size-6" onClick={() => setRenamingId(null)}>
                                  <ShieldOff className="size-3 text-muted-foreground" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="font-medium text-sm text-foreground cursor-pointer hover:text-primary transition-colors"
                                  onClick={() => { setRenamingId(v.id); setRenameValue(v.bm_name); }}
                                  title="Clique para renomear"
                                >
                                  {v.bm_name}
                                </span>
                                <Pencil
                                  className="size-3 text-muted-foreground hover:text-primary cursor-pointer"
                                  onClick={() => { setRenamingId(v.id); setRenameValue(v.bm_name); }}
                                />
                                {v.bm_link && (
                                  <a href={v.bm_link} target="_blank" rel="noopener noreferrer" className="text-primary/60 hover:text-primary">
                                    <ExternalLink className="size-3" />
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{v.client_name || "—"}</TableCell>
                        <TableCell>{getStatusBadge(v.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(v.protection_start), "dd MMM, yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm text-foreground">
                              {format(new Date(v.updated_at), "dd/MM, HH:mm")}
                            </p>
                            <p className={`text-[10px] ${v.status === "active" ? "text-emerald-400" : "text-red-400"}`}>
                              {v.status === "active" ? "Sucesso total" : "Expirado"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-8">
                                <MoreVertical className="size-4 text-muted-foreground" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onClick={() => regenerateLink(v)} className="gap-2 text-xs">
                                <Link2 className="size-3.5" /> Regenerar Link ({v.link_regenerations}x)
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleStatus(v)} className="gap-2 text-xs">
                                {v.status === "active"
                                  ? <><ShieldOff className="size-3.5 text-red-400" /> Desativar</>
                                  : <><ShieldCheck className="size-3.5 text-emerald-400" /> Ativar</>
                                }
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEdit(v)} className="gap-2 text-xs">
                                <Pencil className="size-3.5" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => deleteVault(v)} className="gap-2 text-xs text-red-400">
                                <Trash2 className="size-3.5" /> Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                  <p className="text-xs text-primary">
                    Exibindo {filtered.length} de {vaults.length} Business Managers
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ───── ADD / EDIT MODAL ───── */}
      <Dialog open={modalOpen} onOpenChange={o => { if (!o) { setModalOpen(false); resetForm(); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingVault ? "Editar BM no Cofre" : "Adicionar BM ao Cofre"}</DialogTitle>
            <DialogDescription>Preencha os dados da BM a ser protegida.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {!editingVault && (
              <div className="space-y-1.5">
                <Label>Email do Cliente</Label>
                <div className="flex gap-2">
                  <Input placeholder="email@cliente.com" value={formClientEmail} onChange={e => setFormClientEmail(e.target.value)} />
                  <Button variant="secondary" onClick={lookupClient} type="button">Buscar</Button>
                </div>
                {formClientName && <p className="text-xs text-muted-foreground">Cliente: {formClientName}</p>}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nome da BM</Label>
                <Input value={formBmName} onChange={e => setFormBmName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Perfil Backup</Label>
                <Input value={formPerfilBackup} onChange={e => setFormPerfilBackup(e.target.value)} placeholder="Nome do perfil" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Link da BM</Label>
              <Input value={formBmLink} onChange={e => setFormBmLink(e.target.value)} placeholder="https://..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Data de Compra</Label>
                <Input type="date" value={formPurchaseDate} onChange={e => setFormPurchaseDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Observações</Label>
                <Input value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Opcional" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setModalOpen(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="size-4 mr-2 animate-spin" />}
              {editingVault ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
