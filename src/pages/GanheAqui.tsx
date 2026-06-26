import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Copy, Check, Users, DollarSign, TrendingUp, Percent,
  Share2, ShoppingCart, Wallet, Handshake, ChevronLeft, ChevronRight,
  Bell, X,
} from "lucide-react";

interface Partner {
  id: string;
  slug: string;
  commission_rate: number;
  guarantee_days: number;
  balance: number;
  total_earned: number;
  total_referrals: number;
  status: string;
  pix_key_type?: string | null;
  pix_key?: string | null;
  pix_holder_name?: string | null;
  pix_holder_document?: string | null;
  pix_bank?: string | null;
}

interface Referral {
  id: string;
  order_total: number;
  commission_amount: number;
  status: string;
  created_at: string;
}

const ITEMS_PER_PAGE = 4;

export default function GanheAqui() {
  const [partner, setPartner] = useState<Partner | null>(null);
  const [userName, setUserName] = useState("");
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [userCpf, setUserCpf] = useState<string>("");

  useEffect(() => {
    loadPartnerData();
  }, []);

  const loadPartnerData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, avatar_url, cpf")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profile?.full_name) setUserName(profile.full_name);
    if (profile?.avatar_url) setAvatarUrl(profile.avatar_url);
    if (profile?.cpf) setUserCpf(profile.cpf);

    const { data: partnerData } = await supabase
      .from("partners")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (partnerData) {
      setPartner(partnerData as Partner);
      const { data: refs } = await supabase
        .from("partner_referrals")
        .select("*")
        .eq("partner_id", partnerData.id)
        .order("created_at", { ascending: false })
        .limit(500);
      setReferrals((refs || []) as Referral[]);
      const { data: wd } = await supabase
        .from("partner_withdrawals")
        .select("*")
        .eq("partner_id", partnerData.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setWithdrawals(wd || []);
    }
    setLoading(false);
  };

  const copyLink = async () => {
    if (!partner) return;
    const url = `${window.location.origin}/parceiro/${partner.slug}`;
    
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      const textArea = document.createElement("textarea");
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        toast.success("Link copiado!");
        setTimeout(() => setCopied(false), 2000);
      } catch (e) {
        toast.error("Erro ao copiar link");
      }
      document.body.removeChild(textArea);
    }
  };

  const filteredReferrals = useMemo(() => {
    if (statusFilter === "all") return referrals;
    return referrals.filter(r => r.status === statusFilter);
  }, [referrals, statusFilter]);

  const totalPages = Math.ceil(filteredReferrals.length / ITEMS_PER_PAGE);
  const paginatedReferrals = filteredReferrals.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

  useEffect(() => { setPage(0); }, [statusFilter]);

  const savePixData = async (data: Partial<Partner>) => {
    if (!partner) return;
    const { error } = await supabase
      .from("partners")
      .update(data)
      .eq("id", partner.id);
    if (error) { toast.error("Erro ao salvar dados PIX"); return; }
    setPartner({ ...partner, ...data });
    toast.success("Dados PIX salvos");
  };

  const initials = userName
    ? userName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
    : "P";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // Non-partner view
  if (!partner) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <div className="rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] p-10 text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Handshake className="size-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-white">Programa de Parceiros</h2>
          <p className="text-slate-400 max-w-md mx-auto">
            Indique clientes e ganhe comissão em cada venda. Entre em contato com o suporte para se tornar um parceiro.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6">
            {howItWorksSteps.map((step, i) => (
              <div key={i} className="rounded-xl border border-[#2A2A2A]/50 bg-[#1A1A1A]/50 p-4 text-center space-y-2">
                <div className="mx-auto w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <step.icon className="size-5 text-primary" />
                </div>
                <p className="text-xs font-semibold text-white">{step.title}</p>
                <p className="text-[11px] text-slate-500">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const partnerLink = `fbflix.com.br/parceiro/${partner.slug}`;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header Section */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b border-[#2A2A2A] pb-8">
        <div className="flex items-center gap-4">
          <div className="size-14 rounded-full bg-gradient-to-br from-primary to-primary/40 flex items-center justify-center border-2 border-[#2A2A2A] overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt={userName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-bold text-white">{initials}</span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-white">{userName || "Parceiro"}</h1>
              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${
                partner.status === "active"
                  ? "bg-emerald-500/10 text-emerald-500"
                  : "bg-red-500/10 text-red-400"
              }`}>
                <span className={`size-1.5 rounded-full ${partner.status === "active" ? "bg-emerald-500" : "bg-red-400"}`} />
                {partner.status === "active" ? "Ativo" : "Inativo"}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 group">
              <span className="text-slate-400 text-sm">{partnerLink}</span>
              <button
                onClick={copyLink}
                className="hover:text-primary transition-colors flex items-center gap-1 text-slate-400"
                title="Copiar Link"
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                <span className="text-xs font-medium uppercase tracking-wider">
                  {copied ? "Copiado" : "Copiar"}
                </span>
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <FaturamentoMeter earned={partner.total_earned} />
          <div className="size-10 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg flex items-center justify-center shrink-0">
            <Bell className="size-5 text-slate-400" />
          </div>
        </div>
      </header>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Saldo Disponível */}
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Saldo Disponível</p>
            <h2 className="text-2xl font-bold text-white">R$ {partner.balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</h2>
          </div>
          <button
            onClick={() => {
              if (!partner) return;
              if (Number(partner.balance) <= 0) {
                toast.error("Você não tem saldo disponível para saque.");
                return;
              }
              setShowWithdraw(true);
            }}
            className="mt-4 w-full bg-primary hover:bg-primary/90 text-white py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2"
          >
            <Wallet className="size-4" />
            Solicitar Saque
          </button>
        </div>

        {/* Ganho Total */}
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-5">
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Ganho Total</p>
          <h2 className="text-2xl font-bold text-white">R$ {partner.total_earned.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</h2>
          <div className="mt-2 flex items-center gap-1 text-emerald-500">
            <TrendingUp className="size-3" />
            <span className="text-xs font-medium">Lifetime</span>
          </div>
        </div>

        {/* Indicações */}
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-5">
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Indicações</p>
          <h2 className="text-2xl font-bold text-white">{partner.total_referrals}</h2>
          <div className="mt-2 flex items-center gap-1 text-slate-400">
            <Users className="size-3" />
            <span className="text-xs font-medium">{referrals.filter(r => {
              const d = new Date(r.created_at);
              const now = new Date();
              return d >= new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
            }).length} novas esta semana</span>
          </div>
        </div>

        {/* Comissão Atual */}
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-5">
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Comissão Atual</p>
          <h2 className="text-2xl font-bold text-white">{partner.commission_rate}%</h2>
          <div className="mt-2 bg-primary/10 rounded-full h-1.5 w-full overflow-hidden">
            <div className="bg-primary h-full" style={{ width: `${Math.min((partner.commission_rate / 20) * 100, 100)}%` }} />
          </div>
          <p className="mt-1 text-[10px] text-slate-500 text-right uppercase">
            {Math.min(Math.round((partner.commission_rate / 20) * 100), 100)}% para 20%
          </p>
        </div>
      </div>

      {/* Como Funciona */}
      <section className="mb-8">
        <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500 mb-4">Como Funciona</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {howItWorksSteps.map((step, i) => (
            <div key={i} className="flex items-center gap-4 bg-[#1A1A1A]/50 border border-[#2A2A2A]/50 p-4 rounded-xl">
              <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <step.icon className="size-5" />
              </div>
              <div>
                <p className="font-bold text-sm text-white">{step.title}</p>
                <p className="text-xs text-slate-500">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Dados PIX para recebimento */}
      <PixDataSection partner={partner} onSave={savePixData} />

      {/* Transactions Table */}
      <section className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl overflow-hidden">
        <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2A2A2A]">
          <h3 className="font-bold text-lg text-white">Minhas Indicações</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase">Filtrar:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#0F0F0F] border border-[#2A2A2A] text-xs text-slate-300 rounded-lg px-3 py-1.5 focus:ring-primary focus:border-primary outline-none"
            >
              <option value="all">Todos Status</option>
              <option value="credited">Creditado</option>
              <option value="pending">Pendente</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>
        </div>

        {filteredReferrals.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Users className="size-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500">
              {statusFilter === "all"
                ? "Nenhuma indicação registrada ainda."
                : "Nenhuma indicação com este status."}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#2A2A2A]/30">
                  <tr>
                    <th className="px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Data</th>
                    <th className="px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Valor do Pedido</th>
                    <th className="px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Comissão Gerada</th>
                    <th className="px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A2A2A]">
                  {paginatedReferrals.map((ref) => (
                    <tr key={ref.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-300">
                        {new Date(ref.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-white">
                        R$ {ref.order_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-primary">
                        R$ {ref.commission_amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <ReferralStatusBadge status={ref.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 border-t border-[#2A2A2A] flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Mostrando {paginatedReferrals.length} de {filteredReferrals.length} indicações
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="size-8 rounded border border-[#2A2A2A] flex items-center justify-center hover:bg-[#2A2A2A] transition-colors disabled:opacity-30"
                >
                  <ChevronLeft className="size-4 text-slate-400" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="size-8 rounded border border-[#2A2A2A] flex items-center justify-center hover:bg-[#2A2A2A] transition-colors disabled:opacity-30"
                >
                  <ChevronRight className="size-4 text-slate-400" />
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Footer */}
      <footer className="mt-8 text-center">
        <p className="text-slate-600 text-[10px] uppercase tracking-widest">© 2024 FBX Token / FbFlix. Todos os direitos reservados.</p>
      </footer>

      {showWithdraw && partner && userId && (
        <WithdrawModal
          partner={partner}
          userId={userId}
          defaultCpf={partner.pix_key || userCpf}
          defaultHolder={partner.pix_holder_name || userName}
          defaultKeyType={partner.pix_key_type || "cpf"}
          previous={withdrawals}
          onClose={() => setShowWithdraw(false)}
          onSuccess={() => { setShowWithdraw(false); loadPartnerData(); }}
        />
      )}
    </div>
  );
}

// --- Data ---

const howItWorksSteps = [
  { icon: Share2, title: "Compartilhe", desc: "Envie seu link exclusivo" },
  { icon: ShoppingCart, title: "Cliente compra", desc: "Adesão confirmada na rede" },
  { icon: Wallet, title: "Você ganha", desc: "Comissão direto no saldo" },
];

// --- Sub-components ---

function ReferralStatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    credited: { bg: "bg-emerald-500/10", text: "text-emerald-500", label: "CREDITADO" },
    pending: { bg: "bg-yellow-500/10", text: "text-yellow-500", label: "PENDENTE" },
    cancelled: { bg: "bg-red-500/10", text: "text-red-400", label: "CANCELADO" },
  };
  const c = config[status] || config.pending;
  return (
    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

function FaturamentoMeter({ earned }: { earned: number }) {
  const milestones = [5000, 10000, 50000, 100000];
  // Find current target: smallest milestone greater than earned, else the largest
  const target = milestones.find(m => earned < m) ?? milestones[milestones.length - 1];
  const prev = (() => {
    const idx = milestones.indexOf(target);
    return idx > 0 ? milestones[idx - 1] : 0;
  })();
  const isMaxed = earned >= milestones[milestones.length - 1];
  const pct = isMaxed
    ? 100
    : Math.max(0, Math.min(100, ((earned - prev) / (target - prev)) * 100));
  const fmt = (v: number) =>
    v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k` : `${v}`;
  return (
    <div className="flex-1 md:w-56 md:flex-none">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Faturamento</p>
        <p className="text-xs font-bold text-primary">
          R$ {earned.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        </p>
      </div>
      <div className="h-2 w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary/70 to-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">
          R$ {fmt(prev)}
        </span>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          {isMaxed ? "Meta máxima atingida" : `Meta: R$ ${fmt(target)}`}
        </span>
      </div>
    </div>
  );
}

function WithdrawModal({
  partner, userId, defaultCpf, defaultHolder, defaultKeyType, previous, onClose, onSuccess,
}: {
  partner: Partner;
  userId: string;
  defaultCpf: string;
  defaultHolder: string;
  defaultKeyType?: string;
  previous: any[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState<string>(String(partner.balance.toFixed(2)));
  const [keyType, setKeyType] = useState<string>(defaultKeyType || "cpf");
  const [pixKey, setPixKey] = useState<string>(defaultCpf || "");
  const [holder, setHolder] = useState<string>(defaultHolder || "");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const value = parseFloat(amount.replace(",", "."));
    if (!value || value <= 0) { toast.error("Informe um valor válido"); return; }
    if (value > Number(partner.balance)) { toast.error("Valor maior que o saldo disponível"); return; }
    if (!pixKey.trim()) { toast.error("Informe a chave PIX"); return; }
    setSaving(true);
    const { error } = await supabase.from("partner_withdrawals").insert({
      partner_id: partner.id,
      user_id: userId,
      amount: value,
      pix_key: pixKey.trim(),
      pix_key_type: keyType,
      holder_name: holder.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message || "Erro ao solicitar saque"); return; }
    toast.success("Saque solicitado! O pagamento é processado em até 48h úteis.");
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl w-full max-w-md p-6 space-y-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">Solicitar Saque</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="size-5" /></button>
        </div>

        <div className="bg-primary/5 border border-primary/10 rounded-lg p-3 text-xs text-slate-300">
          Saldo disponível: <span className="font-bold text-primary">R$ {Number(partner.balance).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
          <p className="text-[11px] text-slate-500 mt-1">Pagamentos via PIX em até 48h úteis após a aprovação.</p>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Valor (R$)</label>
          <input
            type="number" step="0.01" min="0" value={amount}
            onChange={e => setAmount(e.target.value)}
            className="w-full bg-[#1A1A1A] border border-[#2A2A2A] text-white rounded-lg px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Tipo</label>
            <select
              value={keyType} onChange={e => setKeyType(e.target.value)}
              className="w-full bg-[#1A1A1A] border border-[#2A2A2A] text-white rounded-lg px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
            >
              <option value="cpf">CPF</option>
              <option value="cnpj">CNPJ</option>
              <option value="email">E-mail</option>
              <option value="telefone">Telefone</option>
              <option value="aleatoria">Aleatória</option>
            </select>
          </div>
          <div className="space-y-2 col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Chave PIX</label>
            <input
              value={pixKey} onChange={e => setPixKey(e.target.value)}
              className="w-full bg-[#1A1A1A] border border-[#2A2A2A] text-white rounded-lg px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Titular (opcional)</label>
          <input
            value={holder} onChange={e => setHolder(e.target.value)}
            className="w-full bg-[#1A1A1A] border border-[#2A2A2A] text-white rounded-lg px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
          />
        </div>

        <button
          onClick={submit} disabled={saving}
          className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg transition-all disabled:opacity-50"
        >
          {saving ? "Enviando..." : "Confirmar Solicitação"}
        </button>

        {previous.length > 0 && (
          <div className="pt-3 border-t border-white/[0.05]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Últimos saques</p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {previous.slice(0, 5).map(w => (
                <div key={w.id} className="flex items-center justify-between text-xs bg-[#1A1A1A] rounded px-3 py-2">
                  <span className="text-slate-400">{new Date(w.created_at).toLocaleDateString("pt-BR")}</span>
                  <span className="text-white font-bold">R$ {Number(w.amount).toFixed(2)}</span>
                  <span className={`text-[9px] font-bold uppercase ${
                    w.status === "paid" ? "text-emerald-500" : w.status === "rejected" ? "text-red-400" : "text-yellow-500"
                  }`}>{w.status === "paid" ? "Pago" : w.status === "rejected" ? "Recusado" : "Pendente"}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
