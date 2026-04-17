import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Plus, Trash2, Pencil, Upload, Package, Building2, Users, BarChart3,
  CheckCircle2, XCircle, AlertTriangle, Clock, Search, Eye, FileText,
  TrendingUp, Award, ShieldAlert
} from "lucide-react";

type Supplier = {
  id: string;
  name: string;
  notes: string | null;
  status: string;
  created_at: string;
};

type Batch = {
  id: string;
  supplier_id: string;
  name: string;
  notes: string | null;
  purchased_at: string;
  created_at: string;
};

type Account = {
  id: string;
  batch_id: string;
  supplier_id: string;
  profile_link: string | null;
  login: string | null;
  password: string | null;
  status: "aguardando" | "em_teste" | "aprovado" | "reprovado";
  logged_in: boolean;
  login_result: string | null;
  sold: boolean;
  client_name: string | null;
  sold_at: string | null;
  country: string | null;
  account_year: number | null;
  has_bm: boolean;
  notes: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  aguardando: "Aguardando",
  em_teste: "Em teste",
  aprovado: "Aprovado",
  reprovado: "Reprovado",
};

const LOGIN_RESULT_LABEL: Record<string, string> = {
  ok: "OK",
  checkpoint: "Checkpoint",
  bloqueado: "Bloqueado",
  documento: "Documento solicitado",
  suspenso_anuncios: "Suspenso para anúncios",
};

function statusColor(status: string) {
  switch (status) {
    case "aprovado": return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "em_teste": return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    case "aguardando": return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "reprovado": return "bg-red-500/15 text-red-400 border-red-500/30";
    default: return "bg-white/10 text-white/70 border-white/20";
  }
}

export default function AdminComprasFornecedor() {
  const [tab, setTab] = useState("dashboard");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterSupplier, setFilterSupplier] = useState<string>("all");
  const [filterBatch, setFilterBatch] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterLoginResult, setFilterLoginResult] = useState<string>("all");
  const [filterSold, setFilterSold] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [batchDateFrom, setBatchDateFrom] = useState("");
  const [batchDateTo, setBatchDateTo] = useState("");

  // Modals
  const [supplierModal, setSupplierModal] = useState<{ open: boolean; supplier?: Supplier }>({ open: false });
  const [batchModal, setBatchModal] = useState<{ open: boolean; batch?: Batch }>({ open: false });
  const [importModal, setImportModal] = useState<{ open: boolean; batch?: Batch }>({ open: false });
  const [accountModal, setAccountModal] = useState<{ open: boolean; account?: Account }>({ open: false });

  const loadAll = async () => {
    setLoading(true);
    try {
      const [s, b, a] = await Promise.all([
        supabase.from("suppliers").select("*").order("created_at", { ascending: false }),
        supabase.from("supplier_batches").select("*").order("purchased_at", { ascending: false }),
        supabase.from("supplier_accounts").select("*").order("created_at", { ascending: false }).limit(2000),
      ]);
      if (s.error) throw s.error;
      if (b.error) throw b.error;
      if (a.error) throw a.error;
      setSuppliers((s.data || []) as Supplier[]);
      setBatches((b.data || []) as Batch[]);
      setAccounts((a.data || []) as Account[]);
    } catch (err: any) {
      toast.error("Erro ao carregar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const supplierMap = useMemo(() => Object.fromEntries(suppliers.map(s => [s.id, s])), [suppliers]);
  const batchMap = useMemo(() => Object.fromEntries(batches.map(b => [b.id, b])), [batches]);

  const filteredAccounts = useMemo(() => {
    return accounts.filter(a => {
      if (filterSupplier !== "all" && a.supplier_id !== filterSupplier) return false;
      if (filterBatch !== "all" && a.batch_id !== filterBatch) return false;
      if (filterStatus !== "all" && a.status !== filterStatus) return false;
      if (filterLoginResult !== "all" && a.login_result !== filterLoginResult) return false;
      if (filterSold === "sold" && !a.sold) return false;
      if (filterSold === "not_sold" && a.sold) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !(a.login || "").toLowerCase().includes(q) &&
          !(a.profile_link || "").toLowerCase().includes(q) &&
          !(a.client_name || "").toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [accounts, filterSupplier, filterBatch, filterStatus, filterLoginResult, filterSold, search]);

  // ===== Metrics =====
  const stats = useMemo(() => {
    const total = accounts.length;
    const aprovado = accounts.filter(a => a.status === "aprovado").length;
    const reprovado = accounts.filter(a => a.status === "reprovado").length;
    const checkpoint = accounts.filter(a => a.login_result === "checkpoint").length;
    const bloqueado = accounts.filter(a => a.login_result === "bloqueado").length;
    const vendidas = accounts.filter(a => a.sold).length;
    const taxa = total > 0 ? (aprovado / total) * 100 : 0;
    return { total, aprovado, reprovado, checkpoint, bloqueado, vendidas, taxa };
  }, [accounts]);

  const supplierStats = useMemo(() => {
    return suppliers.map(s => {
      const sAccs = accounts.filter(a => a.supplier_id === s.id);
      const total = sAccs.length;
      const apr = sAccs.filter(a => a.status === "aprovado").length;
      const rep = sAccs.filter(a => a.status === "reprovado").length;
      const taxa = total > 0 ? (apr / total) * 100 : 0;
      return { ...s, total, aprovado: apr, reprovado: rep, taxa };
    }).sort((a, b) => b.taxa - a.taxa);
  }, [suppliers, accounts]);

  const batchStats = useMemo(() => {
    return batches.map(b => {
      const bAccs = accounts.filter(a => a.batch_id === b.id);
      const total = bAccs.length;
      const apr = bAccs.filter(a => a.status === "aprovado").length;
      const chk = bAccs.filter(a => a.login_result === "checkpoint").length;
      const blq = bAccs.filter(a => a.login_result === "bloqueado").length;
      const taxaApr = total > 0 ? (apr / total) * 100 : 0;
      const taxaProb = total > 0 ? ((chk + blq) / total) * 100 : 0;
      return { ...b, total, aprovado: apr, checkpoint: chk, bloqueado: blq, taxaApr, taxaProb };
    });
  }, [batches, accounts]);

  const worstBatch = useMemo(() => {
    return [...batchStats].filter(b => b.total > 0).sort((a, b) => b.taxaProb - a.taxaProb)[0];
  }, [batchStats]);

  // ===== Quick action =====
  const quickUpdate = async (id: string, patch: Partial<Account>) => {
    const { error } = await supabase.from("supplier_accounts").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, ...patch } as Account : a));
    toast.success("Atualizado");
  };

  // ===== Supplier CRUD =====
  const saveSupplier = async (form: { name: string; notes: string }) => {
    if (!form.name.trim()) { toast.error("Nome obrigatório"); return; }
    if (supplierModal.supplier) {
      const { error } = await supabase
        .from("suppliers")
        .update({ name: form.name.trim(), notes: form.notes || null })
        .eq("id", supplierModal.supplier.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("suppliers")
        .insert({ name: form.name.trim(), notes: form.notes || null, created_by: user?.id });
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Fornecedor salvo");
    setSupplierModal({ open: false });
    loadAll();
  };

  const deleteSupplier = async (id: string) => {
    if (!confirm("Excluir fornecedor e TODOS os lotes/contas vinculados?")) return;
    const { error } = await supabase.from("suppliers").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Excluído");
    loadAll();
  };

  // ===== Batch CRUD =====
  const saveBatch = async (form: { supplier_id: string; name: string; notes: string; purchased_at: string }) => {
    if (!form.supplier_id || !form.name.trim()) { toast.error("Fornecedor e nome obrigatórios"); return; }
    if (batchModal.batch) {
      const { error } = await supabase
        .from("supplier_batches")
        .update({ supplier_id: form.supplier_id, name: form.name.trim(), notes: form.notes || null, purchased_at: form.purchased_at })
        .eq("id", batchModal.batch.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("supplier_batches")
        .insert({ supplier_id: form.supplier_id, name: form.name.trim(), notes: form.notes || null, purchased_at: form.purchased_at, created_by: user?.id });
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Lote salvo");
    setBatchModal({ open: false });
    loadAll();
  };

  const deleteBatch = async (id: string) => {
    if (!confirm("Excluir lote e TODAS as contas dele?")) return;
    const { error } = await supabase.from("supplier_batches").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Excluído");
    loadAll();
  };

  // ===== Import .txt (auto-detect formats) =====
  const importAccounts = async (batch: Batch, content: string) => {
    const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const parsed: { login: string; password: string; profile_link?: string }[] = [];

    for (const line of lines) {
      // Try | separator first
      let parts = line.includes("|") ? line.split("|").map(p => p.trim()) : line.split(":").map(p => p.trim());

      if (parts.length < 2) continue;

      // Detect link in any part (starts with http)
      const linkIdx = parts.findIndex(p => /^https?:\/\//i.test(p));
      let login = "", password = "", profile_link: string | undefined;

      if (linkIdx >= 0) {
        profile_link = parts[linkIdx];
        const rest = parts.filter((_, i) => i !== linkIdx);
        login = rest[0] || "";
        password = rest.slice(1).join(":") || "";
      } else if (parts.length === 2) {
        [login, password] = parts;
      } else {
        // login:senha:link assumed when no http detected: take first 2
        login = parts[0];
        password = parts.slice(1).join(":");
      }

      if (!login || !password) continue;
      parsed.push({ login, password, profile_link });
    }

    if (parsed.length === 0) { toast.error("Nenhuma conta válida encontrada"); return; }

    const rows = parsed.map(p => ({
      batch_id: batch.id,
      supplier_id: batch.supplier_id,
      login: p.login,
      password: p.password,
      profile_link: p.profile_link || null,
    }));

    // Insert in chunks to avoid limits
    const chunkSize = 200;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error } = await supabase.from("supplier_accounts").insert(chunk);
      if (error) { toast.error("Erro: " + error.message); return; }
    }
    toast.success(`${parsed.length} contas importadas`);
    setImportModal({ open: false });
    loadAll();
  };

  // ===== Account update =====
  const saveAccount = async (a: Account) => {
    const { error } = await supabase.from("supplier_accounts").update({
      profile_link: a.profile_link, login: a.login, password: a.password,
      status: a.status, logged_in: a.logged_in, login_result: a.login_result,
      sold: a.sold, client_name: a.client_name,
      sold_at: a.sold ? (a.sold_at || new Date().toISOString()) : null,
      country: a.country, account_year: a.account_year,
      has_bm: a.has_bm, notes: a.notes,
    }).eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Conta atualizada");
    setAccountModal({ open: false });
    loadAll();
  };

  const deleteAccount = async (id: string) => {
    if (!confirm("Excluir esta conta?")) return;
    const { error } = await supabase.from("supplier_accounts").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Excluída");
    setAccounts(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div className="space-y-5 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Compras Fornecedor</h1>
          <p className="text-sm text-white/60">Gerencie contas compradas — fornecedores, lotes e qualidade</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="dashboard" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            <BarChart3 className="size-4 mr-1.5" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            <Building2 className="size-4 mr-1.5" /> Fornecedores
          </TabsTrigger>
          <TabsTrigger value="batches" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            <Package className="size-4 mr-1.5" /> Lotes
          </TabsTrigger>
          <TabsTrigger value="accounts" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            <Users className="size-4 mr-1.5" /> Contas
          </TabsTrigger>
        </TabsList>

        {/* DASHBOARD */}
        <TabsContent value="dashboard" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard icon={Users} label="Total contas" value={stats.total} color="text-white" />
            <StatCard icon={CheckCircle2} label="Aprovadas" value={`${stats.aprovado} (${stats.taxa.toFixed(1)}%)`} color="text-emerald-400" />
            <StatCard icon={AlertTriangle} label="Checkpoint" value={stats.checkpoint} color="text-amber-400" />
            <StatCard icon={XCircle} label="Bloqueadas" value={stats.bloqueado} color="text-red-400" />
            <StatCard icon={TrendingUp} label="Vendidas" value={stats.vendidas} color="text-blue-400" />
            <StatCard icon={ShieldAlert} label="Reprovadas" value={stats.reprovado} color="text-red-400" />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Award className="size-4 text-amber-400" /> Ranking de fornecedores
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {supplierStats.length === 0 && <p className="text-sm text-white/50">Nenhum fornecedor cadastrado ainda</p>}
                {supplierStats.map((s, i) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 p-2 rounded-md bg-white/5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-white/40 w-6">#{i + 1}</span>
                      <span className="text-sm font-medium truncate">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-white/50">{s.total} contas</span>
                      <span className={`font-bold ${s.taxa >= 70 ? "text-emerald-400" : s.taxa >= 40 ? "text-amber-400" : "text-red-400"}`}>
                        {s.taxa.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldAlert className="size-4 text-red-400" /> Lote com mais problemas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!worstBatch && <p className="text-sm text-white/50">Sem dados suficientes</p>}
                {worstBatch && (
                  <div className="space-y-2">
                    <div className="text-base font-bold">{worstBatch.name}</div>
                    <div className="text-xs text-white/60">Fornecedor: {supplierMap[worstBatch.supplier_id]?.name || "-"}</div>
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      <div className="bg-white/5 p-2 rounded text-center">
                        <div className="text-xs text-white/50">Total</div>
                        <div className="font-bold">{worstBatch.total}</div>
                      </div>
                      <div className="bg-amber-500/10 p-2 rounded text-center">
                        <div className="text-xs text-amber-400">Checkpoint</div>
                        <div className="font-bold text-amber-400">{worstBatch.checkpoint}</div>
                      </div>
                      <div className="bg-red-500/10 p-2 rounded text-center">
                        <div className="text-xs text-red-400">Bloqueado</div>
                        <div className="font-bold text-red-400">{worstBatch.bloqueado}</div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* SUPPLIERS */}
        <TabsContent value="suppliers" className="space-y-3 mt-4">
          <div className="flex justify-end">
            <Button onClick={() => setSupplierModal({ open: true })} size="sm">
              <Plus className="size-4 mr-1" /> Novo fornecedor
            </Button>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {suppliers.length === 0 && (
              <Card className="bg-white/5 border-white/10 col-span-full">
                <CardContent className="p-6 text-center text-sm text-white/50">
                  Nenhum fornecedor. Crie o primeiro acima.
                </CardContent>
              </Card>
            )}
            {supplierStats.map(s => (
              <Card key={s.id} className="bg-white/5 border-white/10 hover:border-primary/30 transition">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-base truncate">{s.name}</div>
                      {s.notes && <div className="text-xs text-white/50 mt-0.5 line-clamp-2">{s.notes}</div>}
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="size-7" onClick={() => setSupplierModal({ open: true, supplier: s })}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-7 text-red-400 hover:text-red-300" onClick={() => deleteSupplier(s.id)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-white/5 p-2 rounded">
                      <div className="text-xs text-white/50">Total</div>
                      <div className="font-bold text-sm">{s.total}</div>
                    </div>
                    <div className="bg-emerald-500/10 p-2 rounded">
                      <div className="text-xs text-emerald-400">Aprov.</div>
                      <div className="font-bold text-sm text-emerald-400">{s.aprovado}</div>
                    </div>
                    <div className="bg-red-500/10 p-2 rounded">
                      <div className="text-xs text-red-400">Reprov.</div>
                      <div className="font-bold text-sm text-red-400">{s.reprovado}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/50">Aproveitamento</span>
                    <span className={`font-bold ${s.taxa >= 70 ? "text-emerald-400" : s.taxa >= 40 ? "text-amber-400" : "text-red-400"}`}>
                      {s.taxa.toFixed(1)}%
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* BATCHES */}
        <TabsContent value="batches" className="space-y-3 mt-4">
          <div className="flex justify-end">
            <Button onClick={() => setBatchModal({ open: true })} size="sm" disabled={suppliers.length === 0}>
              <Plus className="size-4 mr-1" /> Novo lote
            </Button>
          </div>
          {suppliers.length === 0 && (
            <Card className="bg-amber-500/10 border-amber-500/30">
              <CardContent className="p-3 text-xs text-amber-300">Cadastre um fornecedor antes de criar lotes.</CardContent>
            </Card>
          )}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {batchStats.map(b => (
              <Card key={b.id} className="bg-white/5 border-white/10 hover:border-primary/30 transition">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-base truncate">{b.name}</div>
                      <div className="text-xs text-white/50 mt-0.5">{supplierMap[b.supplier_id]?.name || "-"}</div>
                      <div className="text-[10px] text-white/40 mt-0.5">{new Date(b.purchased_at).toLocaleDateString("pt-BR")}</div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button size="icon" variant="ghost" className="size-7" onClick={() => setImportModal({ open: true, batch: b })} title="Importar .txt">
                        <Upload className="size-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-7" onClick={() => setBatchModal({ open: true, batch: b })}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-7 text-red-400 hover:text-red-300" onClick={() => deleteBatch(b.id)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="bg-white/5 p-2 rounded">
                      <div className="text-xs text-white/50">Contas</div>
                      <div className="font-bold">{b.total}</div>
                    </div>
                    <div className="bg-emerald-500/10 p-2 rounded">
                      <div className="text-xs text-emerald-400">Aprov.</div>
                      <div className="font-bold text-emerald-400">{b.taxaApr.toFixed(0)}%</div>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="w-full" onClick={() => {
                    setFilterBatch(b.id);
                    setFilterSupplier("all");
                    setTab("accounts");
                  }}>
                    <Eye className="size-3.5 mr-1" /> Ver contas
                  </Button>
                </CardContent>
              </Card>
            ))}
            {batchStats.length === 0 && suppliers.length > 0 && (
              <Card className="bg-white/5 border-white/10 col-span-full">
                <CardContent className="p-6 text-center text-sm text-white/50">Nenhum lote criado ainda</CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ACCOUNTS */}
        <TabsContent value="accounts" className="space-y-3 mt-4">
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-3 flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-white/40" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar login, link ou cliente..." className="pl-8 h-9 bg-white/5 border-white/10" />
              </div>
              <Select value={filterSupplier} onValueChange={setFilterSupplier}>
                <SelectTrigger className="w-[160px] h-9 bg-white/5 border-white/10"><SelectValue placeholder="Fornecedor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos fornecedores</SelectItem>
                  {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterBatch} onValueChange={setFilterBatch}>
                <SelectTrigger className="w-[160px] h-9 bg-white/5 border-white/10"><SelectValue placeholder="Lote" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos lotes</SelectItem>
                  {batches.filter(b => filterSupplier === "all" || b.supplier_id === filterSupplier).map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px] h-9 bg-white/5 border-white/10"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterLoginResult} onValueChange={setFilterLoginResult}>
                <SelectTrigger className="w-[160px] h-9 bg-white/5 border-white/10"><SelectValue placeholder="Login" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos logins</SelectItem>
                  {Object.entries(LOGIN_RESULT_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterSold} onValueChange={setFilterSold}>
                <SelectTrigger className="w-[140px] h-9 bg-white/5 border-white/10"><SelectValue placeholder="Venda" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="sold">Vendidas</SelectItem>
                  <SelectItem value="not_sold">Não vendidas</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <div className="text-xs text-white/50">{filteredAccounts.length} de {accounts.length} contas</div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredAccounts.map(a => (
              <Card key={a.id} className="bg-white/5 border-white/10 hover:border-primary/30 transition">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{a.login || "—"}</div>
                      <div className="text-[10px] text-white/40 truncate">{batchMap[a.batch_id]?.name} · {supplierMap[a.supplier_id]?.name}</div>
                    </div>
                    <Badge className={`${statusColor(a.status)} border text-[10px] px-1.5 py-0`}>{STATUS_LABEL[a.status]}</Badge>
                  </div>

                  {a.profile_link && (
                    <a href={a.profile_link} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-400 hover:underline truncate block">
                      {a.profile_link}
                    </a>
                  )}

                  <div className="flex flex-wrap gap-1 text-[10px]">
                    {a.logged_in && <Badge className="bg-blue-500/15 text-blue-400 border border-blue-500/30 px-1.5 py-0">Logada</Badge>}
                    {a.login_result && <Badge className="bg-white/10 text-white/70 border border-white/20 px-1.5 py-0">{LOGIN_RESULT_LABEL[a.login_result]}</Badge>}
                    {a.sold && <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1.5 py-0">Vendida</Badge>}
                    {a.has_bm && <Badge className="bg-purple-500/15 text-purple-400 border border-purple-500/30 px-1.5 py-0">BM</Badge>}
                    {a.country && <Badge className="bg-white/10 text-white/70 border border-white/20 px-1.5 py-0">{a.country}</Badge>}
                  </div>

                  <div className="grid grid-cols-4 gap-1">
                    <Button size="sm" variant="outline" className="h-7 px-1 text-[10px]" onClick={() => quickUpdate(a.id, { logged_in: true, status: "em_teste" })} title="Loguei">
                      <Clock className="size-3" />
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 px-1 text-[10px] border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10" onClick={() => quickUpdate(a.id, { status: "aprovado", login_result: "ok", logged_in: true })} title="Aprovado">
                      <CheckCircle2 className="size-3" />
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 px-1 text-[10px] border-amber-500/30 text-amber-400 hover:bg-amber-500/10" onClick={() => quickUpdate(a.id, { status: "reprovado", login_result: "checkpoint", logged_in: true })} title="Checkpoint">
                      <AlertTriangle className="size-3" />
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 px-1 text-[10px] border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={() => quickUpdate(a.id, { status: "reprovado", login_result: "bloqueado", logged_in: true })} title="Bloqueado">
                      <XCircle className="size-3" />
                    </Button>
                  </div>

                  <div className="flex justify-between items-center pt-1">
                    <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => setAccountModal({ open: true, account: a })}>
                      <Pencil className="size-3 mr-1" /> Editar
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 text-red-400 hover:text-red-300" onClick={() => deleteAccount(a.id)}>
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredAccounts.length === 0 && (
              <Card className="bg-white/5 border-white/10 col-span-full">
                <CardContent className="p-6 text-center text-sm text-white/50">
                  {loading ? "Carregando..." : "Nenhuma conta encontrada"}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <SupplierModal modal={supplierModal} onClose={() => setSupplierModal({ open: false })} onSave={saveSupplier} />
      <BatchModal modal={batchModal} suppliers={suppliers} onClose={() => setBatchModal({ open: false })} onSave={saveBatch} />
      <ImportModal modal={importModal} onClose={() => setImportModal({ open: false })} onImport={importAccounts} />
      <AccountModal modal={accountModal} onClose={() => setAccountModal({ open: false })} onSave={saveAccount} />
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: any; color: string }) {
  return (
    <Card className="bg-white/5 border-white/10">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 text-xs text-white/50"><Icon className="size-3.5" /> {label}</div>
        <div className={`text-xl font-bold mt-1 ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function SupplierModal({ modal, onClose, onSave }: any) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  useEffect(() => {
    if (modal.open) {
      setName(modal.supplier?.name || "");
      setNotes(modal.supplier?.notes || "");
    }
  }, [modal]);
  return (
    <Dialog open={modal.open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[#120808] border-white/10 max-w-md">
        <DialogHeader><DialogTitle>{modal.supplier ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-white/5 border-white/10" />
          </div>
          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="bg-white/5 border-white/10" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave({ name, notes })}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BatchModal({ modal, suppliers, onClose, onSave }: any) {
  const [supplier_id, setSupplier] = useState("");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [purchased_at, setPurchased] = useState(new Date().toISOString().slice(0, 10));
  useEffect(() => {
    if (modal.open) {
      setSupplier(modal.batch?.supplier_id || (suppliers[0]?.id || ""));
      setName(modal.batch?.name || new Date().toLocaleDateString("pt-BR"));
      setNotes(modal.batch?.notes || "");
      setPurchased(modal.batch?.purchased_at || new Date().toISOString().slice(0, 10));
    }
  }, [modal, suppliers]);
  return (
    <Dialog open={modal.open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[#120808] border-white/10 max-w-md">
        <DialogHeader><DialogTitle>{modal.batch ? "Editar lote" : "Novo lote"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Fornecedor *</Label>
            <Select value={supplier_id} onValueChange={setSupplier}>
              <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
              <SelectContent>
                {suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Nome do lote *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-white/5 border-white/10" />
          </div>
          <div>
            <Label className="text-xs">Data da compra</Label>
            <Input type="date" value={purchased_at} onChange={(e) => setPurchased(e.target.value)} className="bg-white/5 border-white/10" />
          </div>
          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="bg-white/5 border-white/10" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave({ supplier_id, name, notes, purchased_at })}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportModal({ modal, onClose, onImport }: any) {
  const [content, setContent] = useState("");
  useEffect(() => { if (modal.open) setContent(""); }, [modal]);
  const onFile = async (e: any) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    setContent(text);
  };
  return (
    <Dialog open={modal.open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[#120808] border-white/10 max-w-lg">
        <DialogHeader><DialogTitle>Importar contas — {modal.batch?.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-white/60">
            Formatos aceitos por linha: <code className="text-primary">login:senha</code>, <code className="text-primary">login:senha:link</code> ou <code className="text-primary">email|senha|link</code>. O sistema detecta automaticamente.
          </p>
          <div>
            <Label className="text-xs">Arquivo .txt</Label>
            <Input type="file" accept=".txt,text/plain" onChange={onFile} className="bg-white/5 border-white/10" />
          </div>
          <div>
            <Label className="text-xs">Ou cole o conteúdo aqui</Label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8} placeholder="login1:senha1&#10;login2:senha2:https://facebook.com/profile" className="bg-white/5 border-white/10 font-mono text-xs" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onImport(modal.batch, content)} disabled={!content.trim()}>
            <Upload className="size-4 mr-1" /> Importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AccountModal({ modal, onClose, onSave }: any) {
  const [a, setA] = useState<Account | null>(null);
  useEffect(() => { if (modal.open) setA(modal.account || null); }, [modal]);
  if (!a) return null;
  const upd = (k: keyof Account, v: any) => setA({ ...a, [k]: v });
  return (
    <Dialog open={modal.open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[#120808] border-white/10 max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Editar conta</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label className="text-xs">Link do perfil</Label>
            <Input value={a.profile_link || ""} onChange={(e) => upd("profile_link", e.target.value)} className="bg-white/5 border-white/10" />
          </div>
          <div>
            <Label className="text-xs">Login</Label>
            <Input value={a.login || ""} onChange={(e) => upd("login", e.target.value)} className="bg-white/5 border-white/10" />
          </div>
          <div>
            <Label className="text-xs">Senha</Label>
            <Input value={a.password || ""} onChange={(e) => upd("password", e.target.value)} className="bg-white/5 border-white/10" />
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={a.status} onValueChange={(v) => upd("status", v)}>
              <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Resultado do login</Label>
            <Select value={a.login_result || "none"} onValueChange={(v) => upd("login_result", v === "none" ? null : v)}>
              <SelectTrigger className="bg-white/5 border-white/10"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {Object.entries(LOGIN_RESULT_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 pt-5">
            <Switch checked={a.logged_in} onCheckedChange={(v) => upd("logged_in", v)} />
            <Label className="text-xs">Já foi logada</Label>
          </div>
          <div className="flex items-center gap-2 pt-5">
            <Switch checked={a.has_bm} onCheckedChange={(v) => upd("has_bm", v)} />
            <Label className="text-xs">Possui BM</Label>
          </div>
          <div className="flex items-center gap-2 pt-5">
            <Switch checked={a.sold} onCheckedChange={(v) => upd("sold", v)} />
            <Label className="text-xs">Vendida</Label>
          </div>
          {a.sold && (
            <div className="col-span-2">
              <Label className="text-xs">Nome do cliente</Label>
              <Input value={a.client_name || ""} onChange={(e) => upd("client_name", e.target.value)} className="bg-white/5 border-white/10" />
            </div>
          )}
          <div>
            <Label className="text-xs">País</Label>
            <Input value={a.country || ""} onChange={(e) => upd("country", e.target.value)} placeholder="BR, US..." className="bg-white/5 border-white/10" />
          </div>
          <div>
            <Label className="text-xs">Ano da conta</Label>
            <Input type="number" value={a.account_year || ""} onChange={(e) => upd("account_year", e.target.value ? parseInt(e.target.value) : null)} className="bg-white/5 border-white/10" />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Observações</Label>
            <Textarea value={a.notes || ""} onChange={(e) => upd("notes", e.target.value)} rows={3} className="bg-white/5 border-white/10" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(a)}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
