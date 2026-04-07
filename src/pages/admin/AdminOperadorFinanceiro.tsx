import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Wallet, AlertTriangle, Clock, CheckCircle, Ban, Snowflake, TrendingUp, XCircle } from "lucide-react";

const PIX_KEY_TYPES = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
  { value: "random", label: "Chave Aleatória" },
];

interface Earning {
  id: string;
  profile_code: string;
  amount: number;
  status: string;
  frozen_at: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
}

export default function AdminOperadorFinanceiro() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState("cpf");
  const [pixBank, setPixBank] = useState("");
  const [pixHolderName, setPixHolderName] = useState("");
  const [hasRecord, setHasRecord] = useState(false);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [earnings, setEarnings] = useState<Earning[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load financials, earnings, withdrawals, and warming profiles in parallel
      const [finRes, earningsRes, wdRes, profilesRes, configRes] = await Promise.all([
        supabase.from("operator_financials").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("operator_earnings").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("operator_withdrawals").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
        supabase.from("warming_profiles").select("id, profile_code, status, created_at").eq("created_by", user.id),
        supabase.from("warming_config").select("value").eq("key", "commission_rate").maybeSingle(),
      ]);

      if (finRes.data) {
        setPixKey(finRes.data.pix_key || "");
        setPixKeyType(finRes.data.pix_key_type || "cpf");
        setPixBank(finRes.data.pix_bank || "");
        setPixHolderName(finRes.data.pix_holder_name || "");
        setHasRecord(true);
      }

      const rate = configRes.data?.value ? parseFloat(configRes.data.value) : 0.25;
      const existingEarnings = (earningsRes.data || []) as Earning[];
      const trackedProfileIds = new Set(existingEarnings.map(e => e.profile_id));

      // Build earnings from warming_profiles that don't have earnings records yet
      const profiles = profilesRes.data || [];
      const syntheticEarnings: Earning[] = profiles
        .filter((p: any) => !trackedProfileIds.has(p.id))
        .map((p: any) => {
          const statusMap: Record<string, string> = {
            active: "pending",
            checkpoint: "frozen",
            completed: "confirmed",
            blocked: "cancelled",
            restricted: "cancelled",
            disabled: "cancelled",
          };
          return {
            id: p.id,
            profile_id: p.id,
            profile_code: p.profile_code,
            amount: rate,
            status: statusMap[p.status] || "pending",
            frozen_at: p.status === "checkpoint" ? p.created_at : null,
            confirmed_at: p.status === "completed" ? p.created_at : null,
            cancelled_at: ["blocked", "restricted", "disabled"].includes(p.status) ? p.created_at : null,
            created_at: p.created_at,
          } as Earning;
        });

      setEarnings([...existingEarnings, ...syntheticEarnings].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      if (wdRes.data) setWithdrawals(wdRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate balances
  const confirmedTotal = earnings.filter(e => e.status === "confirmed").reduce((s, e) => s + Number(e.amount), 0);
  const frozenTotal = earnings.filter(e => e.status === "frozen").reduce((s, e) => s + Number(e.amount), 0);
  const pendingTotal = earnings.filter(e => e.status === "pending").reduce((s, e) => s + Number(e.amount), 0);
  const cancelledTotal = earnings.filter(e => e.status === "cancelled").reduce((s, e) => s + Number(e.amount), 0);
  const paidWithdrawals = withdrawals.filter(w => w.status === "paid").reduce((s, w) => s + Number(w.amount), 0);
  const availableBalance = confirmedTotal - paidWithdrawals;

  const savePix = async () => {
    if (!pixKey.trim() || !pixBank.trim() || !pixHolderName.trim()) {
      toast.error("Preencha todos os campos da chave PIX");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const payload = {
        pix_key: pixKey.trim(),
        pix_key_type: pixKeyType,
        pix_bank: pixBank.trim(),
        pix_holder_name: pixHolderName.trim(),
      };

      if (hasRecord) {
        await supabase.from("operator_financials").update(payload).eq("user_id", user.id);
      } else {
        await supabase.from("operator_financials").insert({ user_id: user.id, ...payload });
        setHasRecord(true);
      }
      toast.success("Dados PIX salvos com sucesso!");
    } catch (err) {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const requestWithdrawal = async () => {
    if (availableBalance <= 0) {
      toast.error("Saldo insuficiente para saque");
      return;
    }
    if (!pixKey.trim()) {
      toast.error("Cadastre sua chave PIX antes de solicitar um saque");
      return;
    }
    const pending = withdrawals.find(w => w.status === "pending" || w.status === "approved");
    if (pending) {
      toast.error("Você já possui uma solicitação de saque em andamento");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from("operator_withdrawals").insert({
        user_id: user.id,
        amount: availableBalance,
      });
      toast.success("Solicitação de saque enviada!");
      loadData();
    } catch (err) {
      toast.error("Erro ao solicitar saque");
    }
  };

  const fmtBRL = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const withdrawalStatusMap: Record<string, { label: string; color: string; icon: any }> = {
    pending: { label: "Pendente", color: "text-yellow-400", icon: Clock },
    approved: { label: "Aprovado", color: "text-blue-400", icon: CheckCircle },
    paid: { label: "Pago", color: "text-green-400", icon: CheckCircle },
    rejected: { label: "Rejeitado", color: "text-destructive", icon: Ban },
  };

  const earningStatusConfig: Record<string, { label: string; color: string; icon: any }> = {
    pending: { label: "Em andamento", color: "text-blue-400", icon: Clock },
    frozen: { label: "Congelado", color: "text-yellow-400", icon: Snowflake },
    confirmed: { label: "Confirmado", color: "text-green-400", icon: CheckCircle },
    cancelled: { label: "Cancelado", color: "text-destructive", icon: XCircle },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-10 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
        <Wallet className="text-primary size-7" />
        Financeiro
      </h1>

      {/* Disclaimer */}
      <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-5 flex gap-3">
        <AlertTriangle className="text-yellow-400 size-5 mt-0.5 shrink-0" />
        <div className="space-y-2 text-sm text-muted-foreground">
          <p className="font-semibold text-yellow-400">Como funciona o pagamento</p>
          <ul className="space-y-1.5 list-disc list-inside text-xs leading-relaxed">
            <li>O saque ocorre sempre após a <strong className="text-foreground">validação do processo aplicado na esteira de aquecimento</strong>.</li>
            <li>Perfis marcados como <strong className="text-foreground">Checkpoint</strong> entram em fila de análise do suporte interno — o saldo referente fica <strong className="text-yellow-400">congelado temporariamente</strong>.</li>
            <li>Se o perfil voltar para a esteira, o saldo é liberado normalmente.</li>
            <li>Caso o perfil seja classificado como <strong className="text-destructive">bloqueado/desabilitado</strong>, o operador <strong className="text-destructive">não recebe</strong> por aquele perfil — a FBFLIX também não terá lucro com ele.</li>
            <li>Os saques são liberados de forma <strong className="text-foreground">automática pelo sistema em até 24h</strong> após a solicitação e aprovação.</li>
            <li>Certifique-se de que sua chave PIX está correta e atualizada.</li>
          </ul>
        </div>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="size-4 text-green-400" />
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Disponível</p>
          </div>
          <p className="text-xl font-black text-green-400">{fmtBRL(Math.max(0, availableBalance))}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Snowflake className="size-4 text-yellow-400" />
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Congelado</p>
          </div>
          <p className="text-xl font-black text-yellow-400">{fmtBRL(frozenTotal)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="size-4 text-blue-400" />
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Em andamento</p>
          </div>
          <p className="text-xl font-black text-blue-400">{fmtBRL(pendingTotal)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="size-4 text-destructive" />
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Perdas</p>
          </div>
          <p className="text-xl font-black text-destructive">{fmtBRL(cancelledTotal)}</p>
        </div>
      </div>

      {/* Withdraw Button */}
      <div className="rounded-xl border border-border bg-card p-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-foreground">Saldo para saque</p>
          <p className="text-2xl font-black text-foreground">{fmtBRL(Math.max(0, availableBalance))}</p>
        </div>
        <button
          onClick={requestWithdrawal}
          disabled={availableBalance <= 0}
          className="bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-primary-foreground font-bold py-2.5 px-6 rounded-lg text-sm transition-all"
        >
          Solicitar Saque
        </button>
      </div>

      {/* PIX Key Form */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="text-base font-bold text-foreground">Dados da Chave PIX</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo de Chave</label>
            <select
              value={pixKeyType}
              onChange={(e) => setPixKeyType(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
            >
              {PIX_KEY_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Chave PIX</label>
            <input
              type="text"
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              placeholder="Informe sua chave PIX"
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Banco</label>
            <input
              type="text"
              value={pixBank}
              onChange={(e) => setPixBank(e.target.value)}
              placeholder="Ex: Nubank, Inter, Itaú..."
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome do Titular</label>
            <input
              type="text"
              value={pixHolderName}
              onChange={(e) => setPixHolderName(e.target.value)}
              placeholder="Nome completo do titular"
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
        <button
          onClick={savePix}
          disabled={saving}
          className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-bold py-2.5 px-6 rounded-lg text-sm transition-all"
        >
          {saving ? "Salvando..." : "Salvar Dados PIX"}
        </button>
      </div>

      {/* Earnings per Profile */}
      {earnings.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-3">
          <h2 className="text-base font-bold text-foreground">Ganhos por Perfil</h2>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {earnings.map(e => {
              const st = earningStatusConfig[e.status] || earningStatusConfig.pending;
              const Icon = st.icon;
              return (
                <div key={e.id} className="flex items-center justify-between border border-border rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Icon className={`size-4 ${st.color}`} />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{e.profile_code}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {fmtBRL(Number(e.amount))} · {new Date(e.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs font-bold ${st.color}`}>{st.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Withdrawal History */}
      {withdrawals.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-3">
          <h2 className="text-base font-bold text-foreground">Histórico de Saques</h2>
          <div className="space-y-2">
            {withdrawals.map(w => {
              const st = withdrawalStatusMap[w.status] || withdrawalStatusMap.pending;
              const Icon = st.icon;
              return (
                <div key={w.id} className="flex items-center justify-between border border-border rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Icon className={`size-4 ${st.color}`} />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{fmtBRL(Number(w.amount))}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(w.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs font-bold ${st.color}`}>{st.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
