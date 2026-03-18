import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Search, Shield, ShieldCheck, ShieldOff, RefreshCw, Plus, Loader2,
  ExternalLink, Pencil, Trash2, DollarSign, Link2
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  created_at: string;
  updated_at: string;
}

export default function AdminSafeBM() {
  const [vaults, setVaults] = useState<SafeBmVault[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVault, setEditingVault] = useState<SafeBmVault | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
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

  useEffect(() => { fetchVaults(); }, []);

  const filtered = useMemo(() => {
    let items = vaults;
    if (statusFilter !== "all") items = items.filter(v => v.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(v =>
        (v.client_name || "").toLowerCase().includes(q) ||
        v.bm_name.toLowerCase().includes(q) ||
        (v.perfil_backup || "").toLowerCase().includes(q)
      );
    }
    return items;
  }, [vaults, statusFilter, search]);

  const activeCount = vaults.filter(v => v.status === "active").length;
  const inactiveCount = vaults.filter(v => v.status === "inactive").length;
  const monthlyRevenue = activeCount * 9.99;

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
      bm_name: formBmName,
      bm_link: formBmLink,
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
    setSaving(false);
    setModalOpen(false);
    resetForm();
    fetchVaults();
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

  const deleteVault = async (v: SafeBmVault) => {
    if (!confirm(`Remover "${v.bm_name}" do cofre?`)) return;
    const { error } = await supabase.from("safe_bm_vaults" as any).delete().eq("id", v.id);
    if (error) toast.error(error.message);
    else { toast.success("Removido do cofre"); fetchVaults(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="size-6 text-primary" /> Safe BM — Cofre de Backup
          </h1>
          <p className="text-white/50 text-sm mt-1">Gerencie as BMs protegidas dos clientes • R$ 9,99/ativo/mês</p>
        </div>
        <Button onClick={openAdd} className="gap-2"><Plus className="size-4" /> Adicionar ao Cofre</Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Shield className="size-5 text-primary" /></div>
            <div><p className="text-xs text-muted-foreground">Total Protegidas</p><p className="text-xl font-bold text-foreground">{vaults.length}</p></div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center"><ShieldCheck className="size-5 text-emerald-500" /></div>
            <div><p className="text-xs text-muted-foreground">Ativas</p><p className="text-xl font-bold text-foreground">{activeCount}</p></div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center"><ShieldOff className="size-5 text-red-500" /></div>
            <div><p className="text-xs text-muted-foreground">Inativas</p><p className="text-xl font-bold text-foreground">{inactiveCount}</p></div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center"><DollarSign className="size-5 text-yellow-500" /></div>
            <div><p className="text-xs text-muted-foreground">Receita Mensal</p><p className="text-xl font-bold text-foreground">R$ {monthlyRevenue.toFixed(2)}</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Buscar por cliente, BM ou perfil..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativas</SelectItem>
            <SelectItem value="inactive">Inativas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="size-6 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Nenhuma BM encontrada no cofre.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Nome BM</TableHead>
                    <TableHead>Perfil Backup</TableHead>
                    <TableHead>Data Compra</TableHead>
                    <TableHead>Início Proteção</TableHead>
                    <TableHead className="text-center">Regenerações</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(v => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">{v.client_name || "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="truncate max-w-[140px]">{v.bm_name}</span>
                          {v.bm_link && (
                            <a href={v.bm_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
                              <ExternalLink className="size-3.5" />
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{v.perfil_backup || "—"}</TableCell>
                      <TableCell>{v.purchase_date ? format(new Date(v.purchase_date), "dd/MM/yyyy", { locale: ptBR }) : "—"}</TableCell>
                      <TableCell>{format(new Date(v.protection_start), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="text-xs">{v.link_regenerations}x</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={v.status === "active" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}>
                          {v.status === "active" ? "Ativa" : "Inativa"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="size-8" title="Regenerar Link" onClick={() => regenerateLink(v)}>
                            <Link2 className="size-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-8" title={v.status === "active" ? "Desativar" : "Ativar"} onClick={() => toggleStatus(v)}>
                            {v.status === "active" ? <ShieldOff className="size-3.5 text-red-400" /> : <ShieldCheck className="size-3.5 text-emerald-400" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="size-8" title="Editar" onClick={() => openEdit(v)}>
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-8" title="Excluir" onClick={() => deleteVault(v)}>
                            <Trash2 className="size-3.5 text-red-400" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
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
