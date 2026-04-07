import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Wallet, AlertTriangle, Clock, CheckCircle, Ban } from "lucide-react";

const PIX_KEY_TYPES = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
  { value: "random", label: "Chave Aleatória" },
];

export default function AdminOperadorFinanceiro() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState("cpf");
  const [pixBank, setPixBank] = useState("");
  const [pixHolderName, setPixHolderName] = useState("");
  const [balance, setBalance] = useState(0);
  const [hasRecord, setHasRecord] = useState(false);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: fin } = await supabase
        .from("operator_financials")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (fin) {
        setPixKey(fin.pix_key || "");
        setPixKeyType(fin.pix_key_type || "cpf");
        setPixBank(fin.pix_bank || "");
        setPixHolderName(fin.pix_holder_name || "");
        setBalance(Number(fin.balance) || 0);
        setHasRecord(true);
      }

      const { data: wds } = await supabase
        .from("operator_withdrawals")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (wds) setWithdrawals(wds);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const savePix = async () => {
    if (!pixKey.trim() || !pixBank.trim() || !pixHolderName.trim()) {
      toast.error("Preencha todos os campos da chave PIX");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (hasRecord) {
        await supabase
          .from("operator_financials")
          .update({
            pix_key: pixKey.trim(),
            pix_key_type: pixKeyType,
            pix_bank: pixBank.trim(),
            pix_holder_name: pixHolderName.trim(),
          })
          .eq("user_id", user.id);
      } else {
        await supabase
          .from("operator_financials")
          .insert({
            user_id: user.id,
            pix_key: pixKey.trim(),
            pix_key_type: pixKeyType,
            pix_bank: pixBank.trim(),
            pix_holder_name: pixHolderName.trim(),
          });
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
    if (balance <= 0) {
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
        amount: balance,
      });
      toast.success("Solicitação de saque enviada!");
      loadData();
    } catch (err) {
      toast.error("Erro ao solicitar saque");
    }
  };

  const statusMap: Record<string, { label: string; color: string; icon: any }> = {
    pending: { label: "Pendente", color: "text-yellow-400", icon: Clock },
    approved: { label: "Aprovado", color: "text-blue-400", icon: CheckCircle },
    paid: { label: "Pago", color: "text-green-400", icon: CheckCircle },
    rejected: { label: "Rejeitado", color: "text-red-400", icon: Ban },
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
          <p className="font-semibold text-yellow-400">Informações sobre saques</p>
          <ul className="space-y-1.5 list-disc list-inside text-xs leading-relaxed">
            <li>O saque ocorre sempre após a <strong className="text-foreground">validação do processo aplicado na esteira de aquecimento</strong>.</li>
            <li>Após a validação, o saldo disponível para saque será exibido abaixo.</li>
            <li>Os saques são liberados de forma <strong className="text-foreground">automática pelo sistema em até 24h</strong> após a solicitação e aprovação.</li>
            <li>Certifique-se de que sua chave PIX está correta e atualizada para evitar problemas no recebimento.</li>
          </ul>
        </div>
      </div>

      {/* Balance Card */}
      <div className="rounded-xl border border-border bg-card p-6">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Saldo Disponível</p>
        <p className="text-3xl font-black text-foreground">
          R$ {balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        </p>
        <button
          onClick={requestWithdrawal}
          disabled={balance <= 0}
          className="mt-4 bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-primary-foreground font-bold py-2.5 px-6 rounded-lg text-sm transition-all"
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

      {/* Withdrawal History */}
      {withdrawals.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-3">
          <h2 className="text-base font-bold text-foreground">Histórico de Saques</h2>
          <div className="space-y-2">
            {withdrawals.map(w => {
              const st = statusMap[w.status] || statusMap.pending;
              const Icon = st.icon;
              return (
                <div key={w.id} className="flex items-center justify-between border border-border rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Icon className={`size-4 ${st.color}`} />
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        R$ {Number(w.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
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
