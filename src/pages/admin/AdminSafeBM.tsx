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
  FileDown, Clock, Check, AlertTriangle, Copy, Timer, HeartPulse, Wifi, WifiOff
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { format, subDays, isAfter, addDays, addMonths, isBefore } from "date-fns";
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
  link_health: string;
  link_health_checked_at: string | null;
  created_at: string;
  updated_at: string;
  bm_tracking_id: string | null;
  next_billing_at: string | null;
  last_billing_at: string | null;
  bm_tracking?: {

    product_name: string;
    sale_price: number;
    sold_at: string;
    status: string;
    stock_item_id: string | null;
    bm_link: string | null;
  } | null;
}

const GENERIC_BM_LINK = "https://business.facebook.com";

const SAFE_EMAILS = [
  "safe1@rercoverfbflix.com.br",
  "safe2@recoverfbflix.com.br",
  "safe3@recoverfbflix.com.br",
  "safe4@recoverfbflix.com.br",
  "safe5@recoverfbflix.com.br",
  "safe6@recoverfbflix.com.br",
  "safe7@recoverfbflix.com.br",
  "safe8@recoverfbflix.com.br",
  "safe9@recoverfbflix.com.br",
  "safe10@recoverfbflix.com.br",
  "safe11@recoverfbflix.com.br",
  "safe12@recoverfbflix.com.br",
  "safe13@recoverfbflix.com.br",
  "safe14@recoverfbflix.com.br",
  "safe15@recoverfbflix.com.br",
  "safe16@recoverfbflix.com.br",
];

function pickEmailForVault(vaultId: string, index: number, usedIndices: Set<number>): string {
  let hash = 0;
  for (let i = 0; i < vaultId.length; i++) {
    hash = ((hash << 5) - hash + vaultId.charCodeAt(i)) | 0;
  }
  let idx = Math.abs(hash) % SAFE_EMAILS.length;
  let attempts = 0;
  while (usedIndices.has(idx) && attempts < SAFE_EMAILS.length) {
    idx = (idx + 1) % SAFE_EMAILS.length;
    attempts++;
  }
  usedIndices.add(idx);
  return SAFE_EMAILS[idx];
}

function getBackupLinkTimeLeft(setAt: string | null, linkHealth?: string | null): { expired: boolean; text: string; percent: number } {
  if (!setAt) return { expired: true, text: "Sem link", percent: 0 };
  const set = new Date(setAt).getTime();
  const expires = set + 15 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const remaining = expires - now;
  if (remaining <= 0) {
    return { expired: true, text: "Expirado", percent: 0 };
  }
  const totalMs = 15 * 24 * 60 * 60 * 1000;
  const percent = Math.round((remaining / totalMs) * 100);
  const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
  const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const mins = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  if (days > 0) return { expired: false, text: `${days}d ${hours}h`, percent };
  if (hours > 0) return { expired: false, text: `${hours}h ${mins}m`, percent };
  return { expired: false, text: `${mins}m`, percent };
}

const DAY_MS = 24 * 60 * 60 * 1000;

function getVaultProtectionWindow(v: Pick<SafeBmVault, "protection_start" | "last_billing_at" | "next_billing_at">) {
  const anchor = new Date(v.last_billing_at || v.protection_start);
  const monthlyExpiry = addMonths(anchor, 1);
  const storedExpiry = v.next_billing_at ? new Date(v.next_billing_at) : null;
  const expiry = storedExpiry && storedExpiry.getTime() > monthlyExpiry.getTime() ? storedExpiry : monthlyExpiry;
  const start = addMonths(expiry, -1);
  const remainingMs = expiry.getTime() - Date.now();
  const expired = remainingMs <= 0;
  const daysRemaining = expired ? 0 : Math.max(1, Math.ceil(remainingMs / DAY_MS));
  const totalMs = Math.max(1, expiry.getTime() - start.getTime());
  const percent = Math.min(100, Math.max(0, ((Date.now() - start.getTime()) / totalMs) * 100));
  const text = expired ? "Expirada" : `Faltam ${daysRemaining} ${daysRemaining === 1 ? "dia" : "dias"}`;

  return { start, expiry, expired, daysRemaining, percent, text };
}

type TabType = "pendentes" | "monitoramento" | "expirando" | "renovacoes";

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
  const [activeTab, setActiveTab] = useState<TabType>("monitoramento");
  const [pendingSearch, setPendingSearch] = useState("");
  const [renewals, setRenewals] = useState<any[]>([]);
  const [renewalLinkInputs, setRenewalLinkInputs] = useState<Record<string, string>>({});
  const [settingRenewalId, setSettingRenewalId] = useState<string | null>(null);


  const [formClientEmail, setFormClientEmail] = useState("");
  const [formClientName, setFormClientName] = useState("");
  const [formUserId, setFormUserId] = useState("");
  const [formBmName, setFormBmName] = useState("");
  const [formBmLink, setFormBmLink] = useState("");
  const [formPerfilBackup, setFormPerfilBackup] = useState("");
  const [formPurchaseDate, setFormPurchaseDate] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const [tickCount, setTickCount] = useState(0);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const iv = setInterval(() => setTickCount(c => c + 1), 60000);
    return () => clearInterval(iv);
  }, []);

  const fetchVaults = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("safe_bm_vaults" as any)
      .select("*, bm_tracking:bm_tracking_id(product_name, sale_price, sold_at, status, stock_item_id, bm_link)")
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar cofre: " + error.message);
    else setVaults((data as any[]) || []);
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

  const fetchRenewals = async () => {
    const { data, error } = await supabase
      .from("safe_bm_renewals")
      .select("*, vault:vault_id(bm_name, bm_link, backup_link)")
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar renovações: " + error.message);
    else {
      // Dedupe: para cofres com múltiplas renovações pendentes, mantém só a mais recente.
      // Renovações já pagas/verificadas são preservadas para histórico.
      const seenPendingVaults = new Set<string>();
      const deduped = (data || []).filter((r: any) => {
        if (r.status !== 'pending') return true;
        if (seenPendingVaults.has(r.vault_id)) return false;
        seenPendingVaults.add(r.vault_id);
        return true;
      });
      setRenewals(deduped);
    }
  };


  const checkAllLinksHealth = async (vaultIds?: string[]) => {
    setCheckingHealth(true);
    if (vaultIds) setCheckingIds(new Set(vaultIds));
    else setCheckingIds(new Set(vaults.filter(v => v.status === "active").map(v => v.id)));
    try {
      const { data, error } = await supabase.functions.invoke("check-bm-link", {
        body: { vault_ids: vaultIds || null },
      });
      if (error) throw error;
      const results = data?.results || [];
      const errors = results.filter((r: any) => r.health === "error").length;
      const healthy = results.filter((r: any) => r.health === "healthy").length;
      toast.success(`Verificação concluída: ${healthy} saudáveis, ${errors} com problema`);
      fetchVaults();
    } catch (err: any) {
      toast.error("Erro ao verificar links: " + err.message);
    } finally {
      setCheckingHealth(false);
      setCheckingIds(new Set());
    }
  };

  const confirmBmProtection = async (request: any) => {
    setConfirmingId(request.id);
    try {
      const { error: vaultError } = await supabase
        .from("safe_bm_vaults" as any)
        .insert({
          user_id: request.client_user_id,
          client_name: request.client_name,
          bm_name: request.product_name,
          bm_link: request.bm_link || GENERIC_BM_LINK,
          status: "active",
          subscription_price: request.sale_price || 9.99,
          bm_tracking_id: request.id,
        });
      if (vaultError) throw vaultError;

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

  // Confirm protection for unconfigured vaults (client already sent invite)
  const confirmVaultProtection = async (vault: SafeBmVault) => {
    setConfirmingId(vault.id);
    try {
      const { error } = await supabase
        .from("safe_bm_vaults" as any)
        .update({
          status: "active",
          protection_start: new Date().toISOString(),
        })
        .eq("id", vault.id);
      if (error) throw error;
      toast.success(`Proteção confirmada para "${vault.bm_name}"!`);
      fetchVaults();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setConfirmingId(null);
    }
  };

  useEffect(() => { fetchVaults(); fetchPendingRequests(); fetchRenewals(); }, []);

  // ─── Derived data ───
  const activeVaults = vaults.filter(v => v.status === "active" && v.bm_link !== GENERIC_BM_LINK);
  const activeCount = activeVaults.length;
  const inactiveCount = vaults.filter(v => v.status === "inactive").length;
  const mrr = activeVaults.reduce((sum, v) => sum + (v.subscription_price || 9.99), 0);
  const newActivations7d = vaults.filter(v => isAfter(new Date(v.created_at), subDays(new Date(), 7))).length;
  const uniqueClients = new Set(activeVaults.map(v => v.user_id)).size;
  const ltvPerClient = uniqueClients > 0 ? mrr / uniqueClients : 0;
  const churnRate = vaults.length > 0 ? ((inactiveCount / vaults.length) * 100).toFixed(1) : "0.0";
  const totalRegenerations = vaults.reduce((s, v) => s + v.link_regenerations, 0);
  const recoveryRate = totalRegenerations > 0 ? 100 : 0;
  const prevActivations7d = vaults.filter(v => {
    const created = new Date(v.created_at);
    return isAfter(created, subDays(new Date(), 14)) && !isAfter(created, subDays(new Date(), 7));
  }).length;
  const activationGrowth = prevActivations7d > 0
    ? (((newActivations7d - prevActivations7d) / prevActivations7d) * 100).toFixed(0) : null;

  // ─── Pending tab: unconfigured vaults (client submitted bm_name but still generic link) + pending bm_tracking ───
  const unconfiguredVaults = useMemo(() => {
    return vaults.filter(v => v.bm_link === GENERIC_BM_LINK && v.bm_name && v.bm_name.trim() !== "");
  }, [vaults]);

  const pendingEmails = useMemo(() => {
    const map = new Map<string, string>();
    const usedIndices = new Set<number>();
    unconfiguredVaults.forEach((v, i) => {
      map.set(v.id, pickEmailForVault(v.id, i, usedIndices));
    });
    return map;
  }, [unconfiguredVaults]);

  const pendingTotalCount = unconfiguredVaults.length + pendingRequests.length;

  const filteredUnconfiguredVaults = useMemo(() => {
    const q = pendingSearch.trim().toLowerCase();
    if (!q) return unconfiguredVaults;
    return unconfiguredVaults.filter(v => {
      const email = (pendingEmails.get(v.id) || "").toLowerCase();
      return (
        v.bm_name.toLowerCase().includes(q) ||
        (v.client_name || "").toLowerCase().includes(q) ||
        email.includes(q)
      );
    });
  }, [unconfiguredVaults, pendingSearch, pendingEmails]);

  // ─── Expiring tab: subscriptions expiring within 3 days ───
  const expiringVaults = useMemo(() => {
    const now = new Date();
    const cutoff = addDays(now, 3);
    return vaults.filter(v => {
      if (v.status !== "active") return false;
      const expiry = addDays(new Date(v.protection_start), 30);
      return isBefore(expiry, cutoff);
    });
  }, [vaults]);

  // ─── Monitoring filtered ───
   const filtered = useMemo(() => {
     let items = vaults;
     
     // If not searching, hide BMs that haven't been configured yet (generic link)
     if (!search.trim()) {
       items = items.filter(v => v.bm_link !== GENERIC_BM_LINK);
     } else {
       const q = search.toLowerCase();
       items = items.filter(v =>
         (v.client_name || "").toLowerCase().includes(q) ||
         v.bm_name.toLowerCase().includes(q) ||
         (v.perfil_backup || "").toLowerCase().includes(q) ||
         (v.notes || "").toLowerCase().includes(q)
       );
     }
     return items;
   }, [vaults, search]);

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
    setFormPurchaseDate(""); setFormNotes("");
    setEditingVault(null);
  };

  const openAdd = () => { resetForm(); setModalOpen(true); };
  const openEdit = (v: SafeBmVault) => {
    const resolvedLink = v.backup_link
      || ((v.bm_link && v.bm_link !== GENERIC_BM_LINK) ? v.bm_link : null)
      || v.bm_tracking?.bm_link || "";
    setEditingVault(v);
    setFormClientName(v.client_name || "");
    setFormUserId(v.user_id);
    setFormBmName(v.bm_name);
    setFormBmLink(resolvedLink);
    setFormPerfilBackup(v.perfil_backup || "");
    setFormPurchaseDate(v.purchase_date ? v.purchase_date.slice(0, 10) : v.created_at.slice(0, 10));
    setFormNotes(v.notes || "");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formBmName || !formBmLink) { toast.error("Nome e link da BM são obrigatórios"); return; }
    if (!editingVault && !formUserId) { toast.error("Busque o cliente pelo email primeiro"); return; }
    setSaving(true);
    const payload: any = {
      bm_name: formBmName, bm_link: formBmLink, backup_link: formBmLink,
      perfil_backup: formPerfilBackup || null, purchase_date: formPurchaseDate || null,
      notes: formNotes || null, client_name: formClientName || null,
    };
    if (editingVault) {
      const oldLink = editingVault.backup_link
        || ((editingVault.bm_link && editingVault.bm_link !== GENERIC_BM_LINK) ? editingVault.bm_link : null)
        || editingVault.bm_tracking?.bm_link || "";
      if (formBmLink && formBmLink !== oldLink) payload.backup_link_set_at = new Date().toISOString();
      const wasUnconfigured = editingVault.bm_link === GENERIC_BM_LINK && !editingVault.backup_link && !editingVault.bm_tracking_id;
      if (wasUnconfigured && formBmLink && formBmLink !== GENERIC_BM_LINK) payload.protection_start = new Date().toISOString();
    } else {
      payload.backup_link_set_at = new Date().toISOString();
    }
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
      .update({ link_regenerations: v.link_regenerations + 1 }).eq("id", v.id);
    if (error) toast.error(error.message);
    else { toast.success("Regeneração contabilizada!"); fetchVaults(); }
  };

  const handleRename = async (v: SafeBmVault) => {
    if (!renameValue.trim()) return;
    const { error } = await supabase.from("safe_bm_vaults" as any)
      .update({ bm_name: renameValue.trim() }).eq("id", v.id);
    if (error) toast.error(error.message);
    else { toast.success("BM renomeada!"); setRenamingId(null); fetchVaults(); }
  };

  const deleteVault = async (v: SafeBmVault) => {
    if (!confirm(`Remover "${v.bm_name}" do cofre?`)) return;
    const { error } = await supabase.from("safe_bm_vaults" as any).delete().eq("id", v.id);
    if (error) toast.error(error.message);
    else { toast.success("Removido do cofre"); fetchVaults(); }
  };

  const verifyRenewal = async (renewal: any) => {
    try {
      const newLink = (renewalLinkInputs[renewal.id] || renewal.new_bm_link || "").trim();
      if (!newLink) {
        toast.error("Informe o novo link de acesso antes de setar.");
        return;
      }
      setSettingRenewalId(renewal.id);
      const { error: renewalError } = await supabase
        .from("safe_bm_renewals")
        .update({ status: 'verified', new_bm_link: newLink, verified_at: new Date().toISOString() })
        .eq("id", renewal.id);
      if (renewalError) throw renewalError;

      const vault = vaults.find(v => v.id === renewal.vault_id);
      const currentExpiry = vault?.next_billing_at ? new Date(vault.next_billing_at) : new Date(vault?.protection_start || Date.now());
      // Base = vencimento anterior (se ainda futuro) OU data do pagamento da renovação
      // Nunca usar a data de verificação do admin, pois o cliente já pagou antes.
      const renewalPaidAt = renewal.paid_at ? new Date(renewal.paid_at) : new Date(renewal.created_at);
      const baseDate = isBefore(currentExpiry, renewalPaidAt) ? renewalPaidAt : currentExpiry;
      const newExpiry = addDays(baseDate, 30);

      const { error: vaultError } = await supabase
        .from("safe_bm_vaults" as any)
        .update({ 
          next_billing_at: newExpiry.toISOString(),
          last_billing_at: new Date().toISOString(),
          status: 'active',
          billing_status: 'paid',
          bm_link: newLink,
          backup_link: newLink,
          backup_link_set_at: new Date().toISOString(),
        })
        .eq("id", renewal.vault_id);
      if (vaultError) throw vaultError;

      toast.success("Novo acesso setado! Cofre renovado e protegido.");
      fetchRenewals();
      fetchVaults();
    } catch (err: any) {
      toast.error("Erro ao verificar renovação: " + err.message);
    } finally {
      setSettingRenewalId(null);
    }
  };


  const exportCSV = () => {
    const rows = [["Nome BM", "Dono/Cliente", "Status", "Data Proteção", "Regenerações"]];
    filtered.forEach(v => {
      rows.push([v.bm_name, v.client_name || "—", v.status === "active" ? "Ativo" : "Inativo",
        format(new Date(v.protection_start), "dd/MM/yyyy"), String(v.link_regenerations)]);
    });
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "safe-bm-export.csv"; a.click();
  };

  const getStatusBadge = (status: string) => {
    if (status === "active") return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] px-2 py-0.5">Ativo</Badge>;
    if (status === "inactive") return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] px-2 py-0.5">Cancelado</Badge>;
    return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px] px-2 py-0.5">Grace Period</Badge>;
  };

  const TABS: { key: TabType; label: string; count?: number; color?: string }[] = [
    { key: "pendentes", label: "Configurar Proteção", count: pendingTotalCount, color: "text-amber-400" },
    { key: "monitoramento", label: "Monitoramento" },
    { key: "expirando", label: "Expirando", count: expiringVaults.length, color: "text-red-400" },
    { key: "renovacoes", label: "Renovações", count: renewals.filter(r => r.status === 'paid' || r.status === 'pending').length, color: "text-emerald-400" },
  ];

  return (
    <div className="space-y-6">
      {/* ───── TOP METRIC CARDS ───── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-[hsl(var(--card))] border-border overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <DollarSign className="size-5 text-primary" />
              </div>
              {mrr > 0 && (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                  {uniqueClients} assinantes
                </Badge>
              )}
            </div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">MRR (Assinaturas R$ 9,99)</p>
            <p className="text-2xl font-bold text-foreground">R$ {mrr.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            <div className="mt-3 h-1 rounded-full bg-primary/20">
              <div className="h-1 rounded-full bg-primary" style={{ width: `${Math.min(100, (mrr / 15000) * 100)}%` }} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[hsl(var(--card))] border-border overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <ShieldCheck className="size-5 text-emerald-500" />
              </div>
              {activeCount > 0 && <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]">LIVE</Badge>}
            </div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Ativos sob Proteção</p>
            <p className="text-2xl font-bold text-foreground">{activeCount.toLocaleString()} BMs</p>
            <p className="text-xs text-muted-foreground mt-1">Sistema operando em 99.9% uptime</p>
          </CardContent>
        </Card>

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
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Novas Ativações (7D)</p>
            <p className="text-2xl font-bold text-foreground">{newActivations7d}</p>
            <p className="text-xs text-muted-foreground mt-1">{newActivations7d > 0 ? "Crescimento nesta semana" : "Sem ativações nos últimos 7 dias"}</p>
          </CardContent>
        </Card>

        <Card className="bg-[hsl(var(--card))] border-border overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <BarChart3 className="size-5 text-primary" />
              </div>
            </div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">LTV Médio por Cliente</p>
            <p className="text-2xl font-bold text-foreground">R$ {ltvPerClient.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            {uniqueClients > 0 && (
              <div className="flex items-center gap-1.5 mt-1">
                <span className="inline-block w-2 h-2 rounded-full bg-primary" />
                <span className="text-xs text-muted-foreground">{uniqueClients} cliente{uniqueClients > 1 ? 's' : ''} ativo{uniqueClients > 1 ? 's' : ''}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ───── TABS ───── */}
      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px flex items-center gap-2 ${
              activeTab === tab.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                activeTab === tab.key
                  ? "bg-primary/20 text-primary"
                  : tab.color ? `bg-${tab.color.replace('text-', '')}/10 ${tab.color}` : "bg-muted text-muted-foreground"
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ═══════ TAB: CONFIGURAR PROTEÇÃO (Pendentes) ═══════ */}
      {activeTab === "pendentes" && (
        <div className="space-y-4">
          {pendingTotalCount === 0 ? (
            <Card className="bg-[hsl(var(--card))] border-border">
              <CardContent className="py-12 text-center">
                <ShieldCheck className="size-10 mx-auto mb-3 text-emerald-500/40" />
                <p className="text-muted-foreground text-sm">Nenhuma BM aguardando configuração de proteção.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Unconfigured vaults — client already submitted bm_name */}
              {unconfiguredVaults.length > 0 && (
                <Card className="bg-[hsl(var(--card))] border-amber-500/20">
                  <CardContent className="p-0">
                    <div className="px-5 py-3 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Shield className="size-4 text-amber-400" />
                        <h3 className="font-semibold text-foreground text-sm">BMs Aguardando Configuração</h3>
                        <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]">
                          {pendingSearch ? `${filteredUnconfiguredVaults.length}/${unconfiguredVaults.length}` : unconfiguredVaults.length}
                        </Badge>
                      </div>
                      <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input
                          placeholder="Filtrar por BM, cliente ou email (ex: safe14)"
                          value={pendingSearch}
                          onChange={e => setPendingSearch(e.target.value)}
                          className="pl-9 h-8 text-xs"
                        />
                      </div>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border">
                          <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Nome da BM</TableHead>
                          <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Cliente</TableHead>
                          <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Email do Convite</TableHead>
                          <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Data da Assinatura</TableHead>
                          <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUnconfiguredVaults.length === 0 ? (
                          <TableRow className="border-border">
                            <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-6">
                              Nenhuma BM encontrada para "{pendingSearch}".
                            </TableCell>
                          </TableRow>
                        ) : filteredUnconfiguredVaults.map(v => {
                          const email = pendingEmails.get(v.id) || "—";
                          return (
                            <TableRow key={v.id} className="border-border hover:bg-muted/5">
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                                    <Shield className="size-3.5 text-amber-400" />
                                  </div>
                                  <span className="font-medium text-sm text-foreground">{v.bm_name}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{v.client_name || "—"}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-mono text-foreground">{email}</span>
                                  <button onClick={() => { navigator.clipboard.writeText(email); toast.success("Email copiado!"); }}
                                    className="p-0.5 rounded hover:bg-muted transition-colors">
                                    <Copy className="size-3 text-muted-foreground" />
                                  </button>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {format(new Date(v.created_at), "dd MMM, yyyy", { locale: ptBR })}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={() => openEdit(v)}>
                                    <Pencil className="size-3" /> Editar
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="gap-1.5 h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
                                    disabled={confirmingId === v.id}
                                    onClick={() => confirmVaultProtection(v)}
                                  >
                                    {confirmingId === v.id ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                                    Confirmar Proteção
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Pending bm_tracking requests */}
              {pendingRequests.length > 0 && (
                <Card className="bg-[hsl(var(--card))] border-border">
                  <CardContent className="p-0">
                    <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                      <Clock className="size-4 text-amber-400" />
                      <h3 className="font-semibold text-foreground text-sm">Solicitações via Gestão BMs</h3>
                      <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]">{pendingRequests.length}</Badge>
                    </div>
                    <div className="divide-y divide-border">
                      {pendingRequests.map(req => (
                        <div key={req.id} className="flex items-center justify-between p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                              <Shield className="size-4 text-amber-400" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">{req.product_name}</p>
                              <p className="text-[10px] text-muted-foreground">
                                Cliente: {req.client_name || "—"} • {format(new Date(req.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                              </p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white"
                            disabled={confirmingId === req.id}
                            onClick={() => confirmBmProtection(req)}
                          >
                            {confirmingId === req.id ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                            Confirmar Proteção
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══════ TAB: MONITORAMENTO ═══════ */}
      {activeTab === "monitoramento" && (
        <div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-xl font-bold text-foreground">Monitoramento de BMs</h2>
              <p className="text-xs text-muted-foreground">Gestão em tempo real de contas e backups</p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input placeholder="Filtrar BMs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
              </div>
              <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={() => checkAllLinksHealth()} disabled={checkingHealth}>
                {checkingHealth ? <Loader2 className="size-3.5 animate-spin" /> : <HeartPulse className="size-3.5" />}
                Verificar Saúde
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={exportCSV}>
                <FileDown className="size-3.5" /> CSV
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
                        <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Origem</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Status</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Saúde do Link</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Link Backup</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Data de Proteção</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map(v => {
                        const linkStatus = getBackupLinkTimeLeft(v.backup_link_set_at, v.link_health);
                        return (
                          <TableRow key={v.id} className="border-border hover:bg-muted/5">
                            <TableCell>
                              <div className="flex items-center gap-2.5">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${v.status === "active" ? "bg-primary/10" : "bg-muted-foreground/10"}`}>
                                  <Shield className={`size-3.5 ${v.status === "active" ? "text-primary" : "text-muted-foreground"}`} />
                                </div>
                                {renamingId === v.id ? (
                                  <div className="flex items-center gap-1.5">
                                    <Input value={renameValue} onChange={e => setRenameValue(e.target.value)} onKeyDown={e => e.key === "Enter" && handleRename(v)} className="h-7 text-sm w-40" autoFocus />
                                    <Button size="icon" variant="ghost" className="size-6" onClick={() => handleRename(v)}><Check className="size-3 text-emerald-400" /></Button>
                                    <Button size="icon" variant="ghost" className="size-6" onClick={() => setRenamingId(null)}><ShieldOff className="size-3 text-muted-foreground" /></Button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    {(() => {
                                      const displayLink = (v.bm_link && v.bm_link !== GENERIC_BM_LINK) ? v.bm_link : v.bm_tracking?.bm_link || v.bm_link;
                                      return (
                                        <>
                                          <span className="font-medium text-sm text-foreground cursor-pointer hover:text-primary transition-colors"
                                            onClick={() => { setRenamingId(v.id); setRenameValue(v.bm_name); }} title="Clique para renomear">
                                            {v.bm_name}
                                          </span>
                                          {v.bm_link === GENERIC_BM_LINK && (
                                            <Badge variant="outline" className="text-[9px] h-4 px-1 bg-amber-500/10 text-amber-500 border-amber-500/20">Link Pendente</Badge>
                                          )}
                                          <Pencil className="size-3 text-muted-foreground hover:text-primary cursor-pointer"
                                            onClick={() => { setRenamingId(v.id); setRenameValue(v.bm_name); }} />
                                          {displayLink && (
                                            <a href={displayLink} target="_blank" rel="noopener noreferrer" className="text-primary/60 hover:text-primary">
                                              <ExternalLink className="size-3" />
                                            </a>
                                          )}
                                        </>
                                      );
                                    })()}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{v.client_name || "—"}</TableCell>
                            <TableCell>
                              {v.bm_tracking ? (
                                <div className="space-y-0.5">
                                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[9px] px-1.5 py-0">Gestão BMs</Badge>
                                  <p className="text-[10px] text-muted-foreground">{v.bm_tracking.product_name} — R$ {Number(v.bm_tracking.sale_price).toFixed(2)}</p>
                                  <p className="text-[9px] text-muted-foreground/60">Vendido {format(new Date(v.bm_tracking.sold_at), "dd/MM/yyyy")}</p>
                                </div>
                              ) : (
                                <span className="text-[10px] text-muted-foreground/50 italic">Manual</span>
                              )}
                            </TableCell>
                            <TableCell>{getStatusBadge(v.status)}</TableCell>
                            <TableCell>
                              {checkingIds.has(v.id) ? (
                                <div className="flex items-center gap-1.5">
                                  <Loader2 className="size-3 animate-spin text-primary" />
                                  <span className="text-[10px] text-muted-foreground">Verificando...</span>
                                </div>
                              ) : (
                                <div className="flex flex-col gap-0.5">
                                  {v.link_health === "healthy" && (
                                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] px-2 py-0.5 gap-1 w-fit">
                                      <Wifi className="size-2.5" /> Saudável
                                    </Badge>
                                  )}
                                  {v.link_health === "expired" && (
                                    <div className="space-y-0.5">
                                      <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] px-2 py-0.5 gap-1 w-fit">
                                        <AlertTriangle className="size-2.5" /> Convite Expirado
                                      </Badge>
                                      <p className="text-[9px] text-red-400">Gere um novo link de acesso</p>
                                    </div>
                                  )}
                                  {v.link_health === "error" && (
                                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] px-2 py-0.5 gap-1 w-fit">
                                      <WifiOff className="size-2.5" /> Indisponível
                                    </Badge>
                                  )}
                                  {v.link_health === "login_required" && (
                                    <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px] px-2 py-0.5 gap-1 w-fit">
                                      <AlertTriangle className="size-2.5" /> Requer Login
                                    </Badge>
                                  )}
                                  {v.link_health === "timeout" && (
                                    <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-[10px] px-2 py-0.5 gap-1 w-fit">
                                      <Clock className="size-2.5" /> Timeout
                                    </Badge>
                                  )}
                                  {v.link_health === "unknown" && (
                                    <span className="text-[10px] text-muted-foreground/50 italic">Não verificado</span>
                                  )}
                                  {v.link_health_checked_at && (
                                    <span className="text-[9px] text-muted-foreground/40">
                                      {format(new Date(v.link_health_checked_at), "dd/MM HH:mm")}
                                    </span>
                                  )}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              {v.backup_link ? (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <Timer className={`size-3 ${linkStatus.expired ? "text-red-400" : "text-emerald-400"}`} />
                                    <span className={`text-xs font-medium ${linkStatus.expired ? "text-red-400" : "text-emerald-400"}`}>{linkStatus.text}</span>
                                    {linkStatus.expired && (
                                      <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[9px] px-1.5 py-0">
                                        <AlertTriangle className="size-2.5 mr-0.5" /> Renovar
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="w-20 h-1 rounded-full bg-muted-foreground/20">
                                    <div className={`h-1 rounded-full transition-all ${linkStatus.expired ? "bg-red-500" : linkStatus.percent < 30 ? "bg-yellow-500" : "bg-emerald-500"}`}
                                      style={{ width: `${linkStatus.percent}%` }} />
                                  </div>
                                  <button onClick={() => { navigator.clipboard.writeText(v.backup_link!); toast.success("Link copiado!"); }}
                                    className="flex items-center gap-1 text-[10px] text-primary/60 hover:text-primary">
                                    <Copy className="size-2.5" /> Copiar link
                                  </button>
                                </div>
                              ) : v.bm_tracking?.bm_link ? (
                                <div className="space-y-1">
                                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[9px] px-1.5 py-0 w-fit">Link da Gestão BMs</Badge>
                                  <button onClick={() => { navigator.clipboard.writeText(v.bm_tracking!.bm_link!); toast.success("Link da BM copiado!"); }}
                                    className="flex items-center gap-1 text-[10px] text-primary/60 hover:text-primary">
                                    <Copy className="size-2.5" /> Copiar link da BM
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground/50 italic">Não configurado</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {format(new Date(v.protection_start), "dd MMM, yyyy", { locale: ptBR })}
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="size-8"><MoreVertical className="size-4 text-muted-foreground" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44">
                                  <DropdownMenuItem onClick={() => openEdit(v)} className="gap-2 text-xs">
                                    <Pencil className="size-3.5" /> Editar / Link Backup
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => checkAllLinksHealth([v.id])} className="gap-2 text-xs" disabled={checkingHealth}>
                                    <HeartPulse className="size-3.5 text-blue-400" /> Verificar Saúde
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => regenerateLink(v)} className="gap-2 text-xs">
                                    <Link2 className="size-3.5" /> Regenerar Link ({v.link_regenerations}x)
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => toggleStatus(v)} className="gap-2 text-xs">
                                    {v.status === "active"
                                      ? <><ShieldOff className="size-3.5 text-red-400" /> Desativar</>
                                      : <><ShieldCheck className="size-3.5 text-emerald-400" /> Ativar</>}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => deleteVault(v)} className="gap-2 text-xs text-red-400">
                                    <Trash2 className="size-3.5" /> Excluir
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                    <p className="text-xs text-primary">Exibindo {filtered.length} de {vaults.length} Business Managers</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══════ TAB: EXPIRANDO ═══════ */}
      {activeTab === "expirando" && (
        <div>
          <div className="mb-4">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <AlertTriangle className="size-5 text-red-400" />
              Assinaturas Expirando
            </h2>
            <p className="text-xs text-muted-foreground">BMs com proteção expirando nos próximos 3 dias</p>
          </div>

          {expiringVaults.length === 0 ? (
            <Card className="bg-[hsl(var(--card))] border-border">
              <CardContent className="py-12 text-center">
                <ShieldCheck className="size-10 mx-auto mb-3 text-emerald-500/40" />
                <p className="text-muted-foreground text-sm">Nenhuma assinatura expirando nos próximos 3 dias.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-[hsl(var(--card))] border-red-500/20">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Nome da BM</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Cliente</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Início da Proteção</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Expira em</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Status</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expiringVaults.map(v => {
                      const expiry = addDays(new Date(v.protection_start), 30);
                      const now = new Date();
                      const diffMs = expiry.getTime() - now.getTime();
                      const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
                      const diffHours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
                      const isExpired = diffMs <= 0;
                      const timeText = isExpired ? "Expirado" : diffDays > 0 ? `${diffDays}d ${diffHours}h` : `${diffHours}h`;

                      return (
                        <TableRow key={v.id} className="border-border hover:bg-muted/5">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center">
                                <Shield className="size-3.5 text-red-400" />
                              </div>
                              <span className="font-medium text-sm text-foreground">{v.bm_name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{v.client_name || "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(v.protection_start), "dd MMM, yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <Badge className={`text-[10px] px-2 py-0.5 ${isExpired
                              ? "bg-red-500/20 text-red-400 border-red-500/30"
                              : diffDays <= 1
                                ? "bg-red-500/20 text-red-400 border-red-500/30"
                                : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                            }`}>
                              <Clock className="size-2.5 mr-1" />
                              {timeText}
                            </Badge>
                          </TableCell>
                          <TableCell>{getStatusBadge(v.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={() => openEdit(v)}>
                                <Pencil className="size-3" /> Editar
                              </Button>
                              <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs text-red-400 border-red-500/30 hover:bg-red-500/10"
                                onClick={() => toggleStatus(v)}>
                                <ShieldOff className="size-3" /> Desativar
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ═══════ TAB: RENOVAÇÕES ═══════ */}
      {activeTab === "renovacoes" && (
        <div className="space-y-4">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Timer className="size-5 text-emerald-400" />
              Pedidos de Renovação
            </h2>
            <p className="text-xs text-muted-foreground">Clientes que solicitaram renovação de seus cofres</p>
          </div>

          {renewals.length === 0 ? (
            <Card className="bg-[hsl(var(--card))] border-border">
              <CardContent className="py-12 text-center">
                <Clock className="size-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-muted-foreground text-sm">Nenhum pedido de renovação encontrado.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-[hsl(var(--card))] border-border">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">BM / Cofre</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Valor</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Data Pedido</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Data Pagto</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Novo Link de Acesso</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Status</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {renewals.map(r => (
                      <TableRow key={r.id} className="border-border hover:bg-muted/5">
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm text-foreground">{r.vault?.bm_name || 'BM Removida'}</span>
                            <span className="text-[10px] text-muted-foreground">ID: {r.vault_id.slice(0, 8)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-bold text-emerald-400">R$ {Number(r.amount).toFixed(2)}</span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(r.created_at), "dd/MM/yyyy HH:mm")}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {r.paid_at ? format(new Date(r.paid_at), "dd/MM/yyyy HH:mm") : <span className="text-muted-foreground/40">—</span>}
                        </TableCell>
                        <TableCell>
                          {r.status === 'verified' ? (
                            <a href={r.new_bm_link} target="_blank" rel="noreferrer" className="text-xs text-emerald-400 underline truncate max-w-[200px] inline-block">
                              {r.new_bm_link || '—'}
                            </a>
                          ) : (
                            <Input
                              placeholder="https://business.facebook.com/..."
                              className="h-8 text-xs w-[240px]"
                              value={renewalLinkInputs[r.id] ?? r.new_bm_link ?? ""}
                              onChange={(e) => setRenewalLinkInputs(prev => ({ ...prev, [r.id]: e.target.value }))}
                              disabled={r.status === 'pending'}
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-[9px] px-2 py-0.5 ${
                            r.status === 'verified' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                            r.status === 'paid' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                            r.status === 'rejected' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                            'bg-amber-500/20 text-amber-400 border-amber-500/30'
                          }`}>
                            {r.status === 'verified' ? 'Verificado' : 
                             r.status === 'paid' ? 'Pago' : 
                             r.status === 'rejected' ? 'Rejeitado' : 'Pendente'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {r.status === 'paid' && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="gap-1.5 h-8 text-xs border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-400"
                              onClick={() => verifyRenewal(r)}
                              disabled={settingRenewalId === r.id}
                            >
                              <Check className="size-3" /> {settingRenewalId === r.id ? "Setando..." : "Setar Novo Acesso"}
                            </Button>
                          )}
                          {r.status === 'pending' && (
                            <span className="text-[10px] text-muted-foreground">Aguardando pagamento</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

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

            <div className="space-y-1.5 p-3 rounded-lg border border-primary/20 bg-primary/5">
              <div className="flex items-center gap-2 mb-1">
                <Link2 className="size-4 text-primary" />
                <Label className="text-primary font-semibold text-sm">Link de Acesso</Label>
              </div>
              <p className="text-[10px] text-muted-foreground mb-2">
                Link de convite da BM que o cliente usará para acessar. Validade: 15 dias a partir do cadastro.
              </p>
              <Input value={formBmLink} onChange={e => setFormBmLink(e.target.value)}
                placeholder="https://business.facebook.com/invitation/?token=..." className="font-mono text-xs" />
              {editingVault?.backup_link_set_at && (
                <div className="flex items-center gap-2 mt-1.5">
                  <Timer className="size-3 text-muted-foreground" />
                  {(() => {
                    const ls = getBackupLinkTimeLeft(editingVault.backup_link_set_at);
                    return (
                      <span className={`text-xs ${ls.expired ? "text-red-400 font-medium" : "text-muted-foreground"}`}>
                        {ls.expired ? "⚠️ Link expirado — cole um novo link para renovar" : `Tempo restante: ${ls.text}`}
                      </span>
                    );
                  })()}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Data de Compra</Label>
                <Input type="date" value={formPurchaseDate} onChange={e => setFormPurchaseDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Observações</Label>
                <Textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Opcional" className="h-20 resize-none" />
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