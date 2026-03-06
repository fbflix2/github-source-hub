import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, Plus, Pencil, Trash2, Search, Link2, DollarSign, Check, X, Eye, EyeOff } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Partner {
  id: string;
  user_id: string;
  slug: string;
  commission_rate: number;
  guarantee_days: number;
  balance: number;
  total_earned: number;
  total_referrals: number;
  status: string;
  created_at: string;
  profile_name?: string;
  profile_email?: string;
}

interface Referral {
  id: string;
  partner_id: string;
  referred_user_id: string;
  order_id: string | null;
  order_total: number;
  commission_amount: number;
  status: string;
  credited_at: string | null;
  created_at: string;
}

export default function AdminParceiros() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [showReferrals, setShowReferrals] = useState<string | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);

  // Form state
  const [formEmail, setFormEmail] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formRate, setFormRate] = useState("10");
  const [formDays, setFormDays] = useState("7");
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadPartners(); }, []);

  const loadPartners = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("partners")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) { toast.error("Erro ao carregar parceiros"); setLoading(false); return; }

    // Load profiles for names
    const userIds = (data || []).map((p: any) => p.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", userIds);

    // Load emails via edge function
    let emailMap: Record<string, string> = {};
    try {
      const { data: emailData } = await supabase.functions.invoke("list-user-emails", {
        body: { user_ids: userIds },
      });
      if (emailData?.emails) {
        emailData.emails.forEach((e: any) => { emailMap[e.id] = e.email; });
      }
    } catch {}

    const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p.full_name]));

    const enriched = (data || []).map((p: any) => ({
      ...p,
      profile_name: profileMap.get(p.user_id) || "—",
      profile_email: emailMap[p.user_id] || "—",
    }));

    setPartners(enriched);
    setLoading(false);
  };

  const openCreate = () => {
    setEditingPartner(null);
    setFormEmail("");
    setFormSlug("");
    setFormRate("10");
    setFormDays("7");
    setShowModal(true);
  };

  const openEdit = (p: Partner) => {
    setEditingPartner(p);
    setFormEmail(p.profile_email || "");
    setFormSlug(p.slug);
    setFormRate(String(p.commission_rate));
    setFormDays(String(p.guarantee_days));
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formSlug.trim()) { toast.error("Slug é obrigatório"); return; }
    const slug = formSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (!slug) { toast.error("Slug inválido"); return; }

    setSaving(true);

    if (editingPartner) {
      const { error } = await supabase.from("partners").update({
        slug,
        commission_rate: parseFloat(formRate) || 10,
        guarantee_days: parseInt(formDays) || 7,
      }).eq("id", editingPartner.id);

      if (error) {
        toast.error(error.message.includes("unique") ? "Slug já está em uso" : "Erro ao atualizar");
      } else {
        toast.success("Parceiro atualizado!");
        setShowModal(false);
        loadPartners();
      }
    } else {
      // Find user by email
      if (!formEmail.trim()) { toast.error("E-mail é obrigatório"); setSaving(false); return; }

      let userId: string | null = null;
      try {
        const { data: emailData } = await supabase.functions.invoke("list-user-emails", {
          body: {},
        });
        if (emailData?.emails) {
          const searchEmail = formEmail.trim().toLowerCase();
          // emailData.emails is a Record<string, string> { userId: email }
          const entries = Object.entries(emailData.emails as Record<string, string>);
          const found = entries.find(([, email]) => email.toLowerCase() === searchEmail);
          if (found) {
            userId = found[0];
          }
        }
      } catch {}

      if (!userId) {
        toast.error("Usuário não encontrado com este e-mail");
        setSaving(false);
        return;
      }

      // Check if already a partner
      const { data: existing } = await supabase.from("partners").select("id").eq("user_id", userId).maybeSingle();
      if (existing) {
        toast.error("Este usuário já é um parceiro");
        setSaving(false);
        return;
      }

      const { error } = await supabase.from("partners").insert({
        user_id: userId,
        slug,
        commission_rate: parseFloat(formRate) || 10,
        guarantee_days: parseInt(formDays) || 7,
      });

      if (error) {
        toast.error(error.message.includes("unique") ? "Slug já está em uso" : "Erro ao criar parceiro");
      } else {
        toast.success("Parceiro criado!");
        setShowModal(false);
        loadPartners();
      }
    }
    setSaving(false);
  };

  const toggleStatus = async (p: Partner) => {
    const newStatus = p.status === "active" ? "inactive" : "active";
    await supabase.from("partners").update({ status: newStatus }).eq("id", p.id);
    toast.success(newStatus === "active" ? "Parceiro ativado" : "Parceiro desativado");
    loadPartners();
  };

  const deletePartner = async (p: Partner) => {
    if (!confirm("Tem certeza que deseja excluir este parceiro?")) return;
    await supabase.from("partners").delete().eq("id", p.id);
    toast.success("Parceiro excluído");
    loadPartners();
  };

  const openReferrals = async (partnerId: string) => {
    setShowReferrals(partnerId);
    const { data } = await supabase
      .from("partner_referrals")
      .select("*")
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false });
    setReferrals((data || []) as Referral[]);
  };

  const creditReferral = async (ref: Referral) => {
    // Credit the commission to partner balance
    const partner = partners.find(p => p.id === ref.partner_id);
    if (!partner) return;

    const newBalance = partner.balance + ref.commission_amount;
    const newTotalEarned = partner.total_earned + ref.commission_amount;

    await supabase.from("partners").update({
      balance: newBalance,
      total_earned: newTotalEarned,
    }).eq("id", partner.id);

    // Also credit to user's wallet balance
    const { data: profile } = await supabase
      .from("profiles")
      .select("balance")
      .eq("user_id", partner.user_id)
      .single();

    if (profile) {
      const walletBalance = profile.balance + ref.commission_amount;
      await supabase.from("profiles").update({ balance: walletBalance }).eq("user_id", partner.user_id);
      await supabase.from("wallet_transactions").insert({
        user_id: partner.user_id,
        type: "credit",
        title: `Comissão de parceiro`,
        amount: ref.commission_amount,
        balance_after: walletBalance,
        reference_id: ref.id,
      });
    }

    await supabase.from("partner_referrals").update({
      status: "credited",
      credited_at: new Date().toISOString(),
    }).eq("id", ref.id);

    toast.success("Comissão creditada!");
    openReferrals(ref.partner_id);
    loadPartners();
  };

  const filtered = partners.filter(p =>
    (p.profile_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (p.profile_email || "").toLowerCase().includes(search.toLowerCase()) ||
    p.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Parceiros</h1>
          <p className="text-muted-foreground text-sm">Gerencie parceiros e comissões de indicação</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="size-4" /> Novo Parceiro
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, e-mail ou slug..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <div className="glass-panel rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Parceiro</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Comissão</TableHead>
              <TableHead>Garantia</TableHead>
              <TableHead>Saldo</TableHead>
              <TableHead>Indicações</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum parceiro encontrado</TableCell></TableRow>
            ) : filtered.map(p => (
              <TableRow key={p.id}>
                <TableCell>
                  <div>
                    <p className="font-medium text-foreground">{p.profile_name}</p>
                    <p className="text-xs text-muted-foreground">{p.profile_email}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-xs bg-secondary px-2 py-1 rounded text-primary">/{p.slug}</span>
                </TableCell>
                <TableCell>{p.commission_rate}%</TableCell>
                <TableCell>{p.guarantee_days} dias</TableCell>
                <TableCell className="font-semibold text-primary">R$ {p.balance.toFixed(2)}</TableCell>
                <TableCell>
                  <button onClick={() => openReferrals(p.id)} className="text-primary hover:underline text-sm">
                    {p.total_referrals} indicações
                  </button>
                </TableCell>
                <TableCell>
                  <button onClick={() => toggleStatus(p)} className={`text-xs px-2 py-1 rounded-full font-medium ${
                    p.status === "active"
                      ? "bg-green-500/10 text-green-400 border border-green-500/20"
                      : "bg-red-500/10 text-red-400 border border-red-500/20"
                  }`}>
                    {p.status === "active" ? "Ativo" : "Inativo"}
                  </button>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(p)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground">
                      <Pencil className="size-4" />
                    </button>
                    <button onClick={() => deletePartner(p)} className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPartner ? "Editar Parceiro" : "Novo Parceiro"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!editingPartner && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">E-mail do usuário</label>
                <Input value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="email@exemplo.com" />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Slug (link personalizado)</label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground whitespace-nowrap">fbflix.com.br/parceiro/</span>
                <Input value={formSlug} onChange={e => setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="nome-parceiro" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Comissão (%)</label>
                <Input type="number" value={formRate} onChange={e => setFormRate(e.target.value)} min="0" max="100" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Dias de garantia</label>
                <Input type="number" value={formDays} onChange={e => setFormDays(e.target.value)} min="0" />
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? "Salvando..." : editingPartner ? "Salvar Alterações" : "Criar Parceiro"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Referrals Modal */}
      <Dialog open={!!showReferrals} onOpenChange={() => setShowReferrals(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Indicações do Parceiro</DialogTitle>
          </DialogHeader>
          {referrals.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma indicação registrada</p>
          ) : (
            <div className="overflow-x-auto max-h-[400px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-2 text-muted-foreground font-medium">Data</th>
                    <th className="text-left py-2 px-2 text-muted-foreground font-medium">Valor Pedido</th>
                    <th className="text-left py-2 px-2 text-muted-foreground font-medium">Comissão</th>
                    <th className="text-left py-2 px-2 text-muted-foreground font-medium">Status</th>
                    <th className="text-left py-2 px-2 text-muted-foreground font-medium">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map(ref => (
                    <tr key={ref.id} className="border-b border-border/50">
                      <td className="py-2 px-2">{new Date(ref.created_at).toLocaleDateString("pt-BR")}</td>
                      <td className="py-2 px-2">R$ {ref.order_total.toFixed(2)}</td>
                      <td className="py-2 px-2 text-primary font-semibold">R$ {ref.commission_amount.toFixed(2)}</td>
                      <td className="py-2 px-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          ref.status === "credited" ? "bg-green-500/10 text-green-400" :
                          ref.status === "pending" ? "bg-yellow-500/10 text-yellow-400" :
                          "bg-red-500/10 text-red-400"
                        }`}>
                          {ref.status === "credited" ? "Creditado" : ref.status === "pending" ? "Pendente" : "Cancelado"}
                        </span>
                      </td>
                      <td className="py-2 px-2">
                        {ref.status === "pending" && (
                          <button
                            onClick={() => creditReferral(ref)}
                            className="text-xs bg-green-500/10 hover:bg-green-500/20 text-green-400 px-2 py-1 rounded flex items-center gap-1"
                          >
                            <Check className="size-3" /> Creditar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
