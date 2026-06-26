import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Users, Plus, Pencil, Trash2, Search, Link2, 
  DollarSign, Check, X, Eye, EyeOff, TrendingUp, 
  Wallet, ShoppingCart, Calendar, ArrowRight, Info, Copy
} from "lucide-react";
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
  referred_user_name?: string;
}

export default function AdminAfiliados() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [showReferrals, setShowReferrals] = useState<string | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loadingReferrals, setLoadingReferrals] = useState(false);
  const [tab, setTab] = useState<"partners" | "withdrawals">("partners");
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loadingWd, setLoadingWd] = useState(false);

  // Form state
  const [formEmail, setFormEmail] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formRate, setFormRate] = useState("10");
  const [formDays, setFormDays] = useState("7");
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadPartners(); }, []);
  useEffect(() => { if (tab === "withdrawals") loadWithdrawals(); }, [tab]);

  const loadWithdrawals = async () => {
    setLoadingWd(true);
    const { data } = await supabase
      .from("partner_withdrawals")
      .select("*")
      .order("created_at", { ascending: false });
    // enrich names
    const ids = (data || []).map((w: any) => w.user_id);
    const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
    const pm = new Map((profs || []).map((p: any) => [p.user_id, p.full_name]));
    setWithdrawals((data || []).map((w: any) => ({ ...w, holder_name_resolved: w.holder_name || pm.get(w.user_id) || "—" })));
    setLoadingWd(false);
  };

  const updateWithdrawal = async (id: string, status: string) => {
    const patch: any = { status, updated_at: new Date().toISOString() };
    if (status === "paid") patch.paid_at = new Date().toISOString();
    if (status === "rejected") patch.rejected_at = new Date().toISOString();
    const { error } = await supabase.from("partner_withdrawals").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(status === "paid" ? "Saque marcado como pago" : status === "rejected" ? "Saque recusado (saldo estornado)" : "Atualizado");
    loadWithdrawals();
    loadPartners();
  };

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
    } catch (e) {
      console.error("Error loading emails:", e);
    }

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
          const entries = Object.entries(emailData.emails as Record<string, string>);
          const found = entries.find(([, email]) => email.toLowerCase() === searchEmail);
          if (found) {
            userId = found[0];
          }
        }
      } catch (e) {
        console.error("Error finding user:", e);
      }

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
    setLoadingReferrals(true);
    const { data } = await supabase
      .from("partner_referrals")
      .select("*")
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false });
    
    // Enrich with referred user names
    if (data && data.length > 0) {
      const userIds = data.map(r => r.referred_user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
      const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]));
      const enriched = data.map(r => ({
        ...r,
        referred_user_name: profileMap.get(r.referred_user_id) || "Desconhecido"
      }));
      setReferrals(enriched as Referral[]);
    } else {
      setReferrals([]);
    }
    setLoadingReferrals(false);
  };

  const creditReferral = async (ref: Referral) => {
    const partner = partners.find(p => p.id === ref.partner_id);
    if (!partner) return;
    const ageMs = Date.now() - new Date(ref.created_at).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays < (partner.guarantee_days || 0)) {
      const remaining = Math.ceil((partner.guarantee_days || 0) - ageDays);
      const ok = confirm(
        `⚠️ Esta indicação ainda está dentro do prazo de garantia (${partner.guarantee_days} dias).\n\n` +
        `Faltam ${remaining} dia(s) para liberação automática.\n\n` +
        `Se o pedido for cancelado/reembolsado durante a garantia, a comissão será estornada do parceiro.\n\n` +
        `Deseja creditar mesmo assim?`
      );
      if (!ok) return;
    }
    try {
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
    } catch (e) {
      console.error("Error crediting referral:", e);
      toast.error("Erro ao creditar comissão");
    }
  };

  const filtered = partners.filter(p =>
    (p.profile_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (p.profile_email || "").toLowerCase().includes(search.toLowerCase()) ||
    p.slug.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    totalPartners: partners.length,
    activePartners: partners.filter(p => p.status === 'active').length,
    totalEarned: partners.reduce((sum, p) => sum + p.total_earned, 0),
    totalBalance: partners.reduce((sum, p) => sum + p.balance, 0),
  };

  return (
    <div className="flex flex-col gap-6 py-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white mb-1">
            Controle de Afiliados
          </h1>
          <p className="text-neutral-400 text-sm italic">Gerencie parceiros, comissões e links de indicação</p>
        </div>
        <Button onClick={openCreate} className="h-10 px-5 bg-primary hover:bg-primary/80 text-white shadow-[0_0_15px_rgba(249,6,6,0.4)] hover:shadow-[0_0_25px_rgba(249,6,6,0.6)] transition-all text-sm font-bold gap-2">
          <Plus className="size-4" /> Cadastrar Novo
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/[0.05]">
        <button
          onClick={() => setTab("partners")}
          className={`px-4 py-2 text-sm font-bold uppercase tracking-wider transition-all border-b-2 ${
            tab === "partners" ? "text-primary border-primary" : "text-neutral-500 border-transparent hover:text-white"
          }`}
        >Parceiros</button>
        <button
          onClick={() => setTab("withdrawals")}
          className={`px-4 py-2 text-sm font-bold uppercase tracking-wider transition-all border-b-2 ${
            tab === "withdrawals" ? "text-primary border-primary" : "text-neutral-500 border-transparent hover:text-white"
          }`}
        >Saques solicitados</button>
      </div>

      {tab === "withdrawals" ? (
        <div className="bg-[rgba(20,20,20,0.6)] backdrop-blur-xl border border-white/[0.08] rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-neutral-800 bg-neutral-900/40">
                <TableHead className="text-neutral-400 font-bold uppercase text-[10px] tracking-wider">Data</TableHead>
                <TableHead className="text-neutral-400 font-bold uppercase text-[10px] tracking-wider">Parceiro</TableHead>
                <TableHead className="text-neutral-400 font-bold uppercase text-[10px] tracking-wider">Chave PIX</TableHead>
                <TableHead className="text-neutral-400 font-bold uppercase text-[10px] tracking-wider">Valor</TableHead>
                <TableHead className="text-neutral-400 font-bold uppercase text-[10px] tracking-wider text-center">Status</TableHead>
                <TableHead className="text-neutral-400 font-bold uppercase text-[10px] tracking-wider text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingWd ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-neutral-500 italic">Carregando…</TableCell></TableRow>
              ) : withdrawals.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-neutral-500 italic">Nenhum saque solicitado ainda.</TableCell></TableRow>
              ) : withdrawals.map(w => (
                <TableRow key={w.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <TableCell className="text-neutral-400 text-xs">{new Date(w.created_at).toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-white font-medium">{w.holder_name_resolved}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-neutral-300">{w.pix_key}</span>
                      <button onClick={() => { navigator.clipboard.writeText(w.pix_key); toast.success("Chave copiada"); }} className="text-neutral-500 hover:text-primary"><Copy className="size-3" /></button>
                      <span className="text-[9px] text-neutral-500 uppercase">({w.pix_key_type})</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-black text-white">R$ {Number(w.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-black tracking-widest ${
                      w.status === "paid" ? "bg-emerald-500/10 text-emerald-500" :
                      w.status === "rejected" ? "bg-red-500/10 text-red-400" :
                      "bg-amber-500/10 text-amber-500"
                    }`}>{w.status === "paid" ? "PAGO" : w.status === "rejected" ? "RECUSADO" : "PENDENTE"}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    {w.status === "pending" && (
                      <div className="flex justify-end gap-2">
                        <button onClick={() => updateWithdrawal(w.id, "paid")} className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase px-3 py-1.5 rounded">Marcar pago</button>
                        <button onClick={() => { if (confirm("Recusar e estornar saldo ao parceiro?")) updateWithdrawal(w.id, "rejected"); }} className="bg-red-500/20 hover:bg-red-500/30 text-red-400 text-[10px] font-black uppercase px-3 py-1.5 rounded border border-red-500/30">Recusar</button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
      <>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[rgba(20,20,20,0.6)] backdrop-blur-xl border border-white/[0.08] rounded-xl p-5 relative overflow-hidden">
          <div className="absolute top-1/2 -translate-y-1/2 right-2 opacity-15 text-neutral-500">
            <Users className="w-16 h-16" />
          </div>
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">Total Afiliados</p>
          <p className="text-3xl font-bold text-white">{stats.totalPartners}</p>
          <p className="text-xs text-emerald-400 mt-1">{stats.activePartners} ativos agora</p>
        </div>

        <div className="bg-[rgba(20,20,20,0.6)] backdrop-blur-xl border border-white/[0.08] rounded-xl p-5 relative overflow-hidden">
          <div className="absolute top-1/2 -translate-y-1/2 right-2 opacity-15 text-neutral-500">
            <TrendingUp className="w-16 h-16" />
          </div>
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">Total em Comissões</p>
          <p className="text-3xl font-bold text-white">R$ {stats.totalEarned.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
          <p className="text-xs text-neutral-500 mt-1">Acumulado lifetime</p>
        </div>

        <div className="bg-[rgba(20,20,20,0.6)] backdrop-blur-xl border border-white/[0.08] rounded-xl p-5 relative overflow-hidden">
          <div className="absolute top-1/2 -translate-y-1/2 right-2 opacity-15 text-neutral-500">
            <Wallet className="w-16 h-16" />
          </div>
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">Saldo a Pagar</p>
          <p className="text-3xl font-bold text-primary">R$ {stats.totalBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
          <p className="text-xs text-amber-500 mt-1">Aguardando solicitação</p>
        </div>

        <div className="bg-[rgba(20,20,20,0.6)] backdrop-blur-xl border border-white/[0.08] rounded-xl p-5 relative overflow-hidden">
          <div className="absolute top-1/2 -translate-y-1/2 right-2 opacity-15 text-neutral-500">
            <ShoppingCart className="w-16 h-16" />
          </div>
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">Indicações</p>
          <p className="text-3xl font-bold text-white">{partners.reduce((s, p) => s + p.total_referrals, 0)}</p>
          <p className="text-xs text-neutral-500 mt-1">Vendas geradas por parceiros</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-[rgba(20,20,20,0.6)] backdrop-blur-xl border border-white/[0.08] rounded-xl p-4 flex flex-col md:flex-row justify-between items-center gap-4 sticky top-4 z-20 shadow-2xl shadow-black/50">
        <div className="relative w-full md:w-96 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500 group-focus-within:text-white transition-colors" />
          <Input
            className="w-full rounded-lg border border-neutral-800 bg-neutral-900/50 py-2.5 pl-10 pr-4 text-sm text-white placeholder-neutral-500 focus:border-primary focus:ring-1 focus:ring-primary transition-all h-11"
            placeholder="Buscar por nome, email ou slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
           <p className="text-xs text-neutral-500 italic max-w-xs text-right">
             Dica: Ative o status para que o usuário veja o botão "Painel Parceiro" no menu.
           </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[rgba(20,20,20,0.6)] backdrop-blur-xl border border-white/[0.08] rounded-xl overflow-hidden shadow-2xl">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-neutral-800 bg-neutral-900/40">
              <TableHead className="text-neutral-400 font-bold uppercase text-[10px] tracking-wider">Parceiro</TableHead>
              <TableHead className="text-neutral-400 font-bold uppercase text-[10px] tracking-wider">Link / Slug</TableHead>
              <TableHead className="text-neutral-400 font-bold uppercase text-[10px] tracking-wider">Comissão</TableHead>
              <TableHead className="text-neutral-400 font-bold uppercase text-[10px] tracking-wider">Saldo Atual</TableHead>
              <TableHead className="text-neutral-400 font-bold uppercase text-[10px] tracking-wider text-center">Indicações</TableHead>
              <TableHead className="text-neutral-400 font-bold uppercase text-[10px] tracking-wider text-center">Status</TableHead>
              <TableHead className="text-neutral-400 font-bold uppercase text-[10px] tracking-wider text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-neutral-500 italic">Carregando dados dos parceiros...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-neutral-500 italic">Nenhum parceiro encontrado com os filtros atuais.</TableCell></TableRow>
            ) : filtered.map(p => (
              <TableRow key={p.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group">
                <TableCell>
                  <div className="flex flex-col">
                    <p className="font-bold text-white group-hover:text-primary transition-colors">{p.profile_name}</p>
                    <p className="text-xs text-neutral-500">{p.profile_email}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] bg-neutral-900 text-primary px-2 py-0.5 rounded border border-white/[0.05]">
                      /{p.slug}
                    </span>
                    <button 
                      onClick={() => {
                        const url = `${window.location.origin}/parceiro/${p.slug}`;
                        navigator.clipboard.writeText(url);
                        toast.success("Link copiado!");
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-primary"
                      title="Copiar link completo"
                    >
                      <Link2 className="size-3.5" />
                    </button>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col leading-tight">
                    <span className="text-white font-semibold">{p.commission_rate}%</span>
                    <span className="text-[10px] text-neutral-500">{p.guarantee_days}d garantia</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-black text-white">R$ {p.balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </TableCell>
                <TableCell className="text-center">
                  <button 
                    onClick={() => openReferrals(p.id)} 
                    className="inline-flex items-center gap-1.5 text-primary hover:underline font-bold text-sm bg-primary/5 px-3 py-1 rounded-full border border-primary/10 transition-all hover:bg-primary/10"
                  >
                    {p.total_referrals} <ArrowRight className="size-3" />
                  </button>
                </TableCell>
                <TableCell className="text-center">
                  <button 
                    onClick={() => toggleStatus(p)} 
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest uppercase border transition-all ${
                      p.status === "active"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                        : "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20"
                    }`}
                  >
                    <span className={`size-1.5 rounded-full ${p.status === "active" ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
                    {p.status === "active" ? "Ativo" : "Inativo"}
                  </button>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => toggleStatus(p)}
                      title={p.status === "active" ? "Ocultar painel do parceiro" : "Mostrar painel do parceiro"}
                      className={`p-2 rounded-lg hover:bg-white/5 transition-all ${
                        p.status === "active" ? "text-primary" : "text-neutral-500"
                      }`}
                    >
                      {p.status === "active" ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                    </button>
                    <button 
                      onClick={() => openEdit(p)} 
                      className="p-2 rounded-lg hover:bg-white/5 text-neutral-400 hover:text-white transition-all"
                      title="Editar configurações"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button 
                      onClick={() => deletePartner(p)} 
                      className="p-2 rounded-lg hover:bg-red-500/10 text-neutral-500 hover:text-red-400 transition-all"
                      title="Excluir parceiro"
                    >
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
        <DialogContent className="bg-[#0f0f0f] border-white/[0.08] text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black italic">{editingPartner ? "EDITAR PARCEIRO" : "NOVO PARCEIRO"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-4">
            {!editingPartner && (
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 pl-1">E-mail do usuário</label>
                <Input 
                  value={formEmail} 
                  onChange={e => setFormEmail(e.target.value)} 
                  placeholder="usuario@fbflix.com.br" 
                  className="bg-neutral-900/50 border-white/[0.08] focus:border-primary"
                />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 pl-1">Slug (link personalizado)</label>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-neutral-600 font-mono whitespace-nowrap">fbflix.com.br/parceiro/</span>
                <Input 
                  value={formSlug} 
                  onChange={e => setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} 
                  placeholder="nome-exclusivo" 
                  className="bg-neutral-900/50 border-white/[0.08] focus:border-primary font-mono text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 pl-1">Comissão (%)</label>
                <div className="relative">
                   <Input 
                    type="number" 
                    value={formRate} 
                    onChange={e => setFormRate(e.target.value)} 
                    min="0" max="100" 
                    className="bg-neutral-900/50 border-white/[0.08] focus:border-primary pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 font-bold text-sm">%</span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 pl-1">Dias de garantia</label>
                <Input 
                  type="number" 
                  value={formDays} 
                  onChange={e => setFormDays(e.target.value)} 
                  min="0" 
                  className="bg-neutral-900/50 border-white/[0.08] focus:border-primary"
                />
              </div>
            </div>
            <Button 
              onClick={handleSave} 
              disabled={saving} 
              className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-black italic tracking-widest shadow-[0_0_20px_rgba(249,6,6,0.3)] transition-all"
            >
              {saving ? "PROCESSANDO..." : editingPartner ? "SALVAR ALTERAÇÕES" : "CRIAR PARCEIRO"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Referrals Modal */}
      <Dialog open={!!showReferrals} onOpenChange={() => setShowReferrals(null)}>
        <DialogContent className="max-w-3xl bg-[#0f0f0f] border-white/[0.08] text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-black italic">HISTÓRICO DE INDICAÇÕES</DialogTitle>
          </DialogHeader>
          <div className="pt-4">
            {loadingReferrals ? (
              <div className="py-12 text-center text-neutral-500 italic">Buscando histórico...</div>
            ) : referrals.length === 0 ? (
              <div className="py-12 text-center text-neutral-500 italic bg-white/[0.02] rounded-xl border border-dashed border-white/[0.05]">
                <Users className="size-10 mx-auto mb-3 opacity-20" />
                Nenhuma indicação registrada para este parceiro.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[500px] rounded-lg border border-white/[0.05]">
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 bg-[#161616] z-10">
                    <tr className="border-b border-white/[0.08]">
                      <th className="text-left py-3 px-4 text-neutral-400 font-bold uppercase text-[9px] tracking-widest">Data</th>
                      <th className="text-left py-3 px-4 text-neutral-400 font-bold uppercase text-[9px] tracking-widest">Cliente</th>
                      <th className="text-left py-3 px-4 text-neutral-400 font-bold uppercase text-[9px] tracking-widest">Valor Pedido</th>
                      <th className="text-left py-3 px-4 text-neutral-400 font-bold uppercase text-[9px] tracking-widest">Comissão</th>
                      <th className="text-center py-3 px-4 text-neutral-400 font-bold uppercase text-[9px] tracking-widest">Status</th>
                      <th className="text-right py-3 px-4 text-neutral-400 font-bold uppercase text-[9px] tracking-widest">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    {referrals.map(ref => (
                      <tr key={ref.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4 text-neutral-400">{new Date(ref.created_at).toLocaleDateString("pt-BR")}</td>
                        <td className="py-3 px-4 font-medium">{ref.referred_user_name}</td>
                        <td className="py-3 px-4 text-neutral-300">R$ {ref.order_total.toFixed(2)}</td>
                        <td className="py-3 px-4 text-primary font-black">R$ {ref.commission_amount.toFixed(2)}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-black tracking-widest ${
                            ref.status === "credited" ? "bg-emerald-500/10 text-emerald-500" :
                            ref.status === "pending" ? "bg-amber-500/10 text-amber-500" :
                            "bg-red-500/10 text-red-500"
                          }`}>
                            {ref.status === "credited" ? "CREDITADO" : ref.status === "pending" ? "PENDENTE" : "CANCELADO"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {ref.status === "pending" && (
                            <button
                              onClick={() => creditReferral(ref)}
                              className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black tracking-widest uppercase px-3 py-1.5 rounded shadow-lg transition-all transform active:scale-95"
                            >
                              CREDITAR
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-6 p-4 bg-primary/5 rounded-xl border border-primary/10">
              <div className="flex gap-3">
                <Info className="size-5 text-primary shrink-0" />
                <div className="text-xs text-neutral-400 leading-relaxed">
                  <p className="font-bold text-primary mb-1 uppercase tracking-wider">Como funciona o crédito?</p>
                  Ao clicar em <span className="text-white font-bold">CREDITAR</span>, a comissão será transferida do status Pendente para o Saldo do Parceiro. 
                  O valor também será adicionado automaticamente à carteira do usuário para uso na loja ou saque.
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}