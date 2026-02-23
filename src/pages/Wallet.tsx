import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Transaction {
  id: string;
  type: string;
  title: string;
  amount: number;
  created_at: string;
}

const quickAmounts = [20, 50, 100, 200];

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (isToday) return `Hoje, ${time}`;
  if (isYesterday) return `Ontem, ${time}`;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) + `, ${time}`;
};

const getIcon = (type: string) => {
  switch (type) {
    case "deposit": return "add";
    case "purchase": return "shopping_cart";
    case "bonus": return "card_giftcard";
    default: return "swap_horiz";
  }
};

export default function Wallet() {
  const [rechargeValue, setRechargeValue] = useState<string>("");
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [pixModal, setPixModal] = useState(false);
  const [pixData, setPixData] = useState<{
    qr_code: string | null;
    qr_code_base64: string | null;
    amount: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [paymentId, setPaymentId] = useState<string | null>(null);

  // Poll for payment confirmation
  useEffect(() => {
    if (!pixModal || !paymentId) return;

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("payments")
        .select("status")
        .eq("id", paymentId)
        .single();

      if (data?.status === "completed") {
        clearInterval(interval);
        setPaymentConfirmed(true);

        // Refresh balance and transactions
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const [profileRes, transactionsRes] = await Promise.all([
            supabase.from("profiles").select("balance").eq("user_id", user.id).maybeSingle(),
            supabase.from("wallet_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
          ]);
          if (profileRes.data) setBalance(profileRes.data.balance);
          if (transactionsRes.data) setTransactions(transactionsRes.data);
        }

        // Auto-close after 5 seconds
        setTimeout(() => {
          setPixModal(false);
          setPaymentConfirmed(false);
          setPixData(null);
          setPaymentId(null);
          setRechargeValue("");
        }, 5000);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [pixModal, paymentId]);

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const [profileRes, transactionsRes] = await Promise.all([
        supabase.from("profiles").select("balance").eq("user_id", user.id).maybeSingle(),
        supabase.from("wallet_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
      ]);

      if (profileRes.data) setBalance(profileRes.data.balance);
      if (transactionsRes.data) setTransactions(transactionsRes.data);
      setLoading(false);
    }
    fetchData();
  }, []);

  const monthlyExpense = transactions
    .filter((t) => t.amount < 0 && new Date(t.created_at).getMonth() === new Date().getMonth())
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const todayDeposits = transactions
    .filter((t) => t.amount > 0 && new Date(t.created_at).toDateString() === new Date().toDateString())
    .reduce((sum, t) => sum + t.amount, 0);

  const handleGeneratePix = async () => {
    const amount = parseFloat(rechargeValue.replace(",", "."));
    if (!amount || amount < 1) {
      toast.error("Valor mínimo: R$ 1,00");
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-pix-payment", {
        body: { amount },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setPixData({
        qr_code: data.qr_code,
        qr_code_base64: data.qr_code_base64,
        amount,
      });
      setPaymentId(data.payment_id || null);
      setPaymentConfirmed(false);
      setPixModal(true);
    } catch (err: any) {
      console.error("PIX error:", err);
      toast.error(err.message || "Erro ao gerar PIX");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyPix = async () => {
    if (!pixData?.qr_code) return;
    await navigator.clipboard.writeText(pixData.qr_code);
    setCopied(true);
    toast.success("Código PIX copiado!");
    setTimeout(() => setCopied(false), 3000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <Link
          to="/loja"
          className="flex items-center gap-1.5 text-muted-foreground text-xs hover:text-primary transition-colors w-fit"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Voltar para Loja</span>
        </Link>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">Minha Carteira</h1>
        <p className="text-muted-foreground text-sm font-medium">
          Gerencie seu saldo e adicione créditos instantaneamente.
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Balance Card */}
          <div className="relative overflow-hidden rounded-2xl glass-panel p-5 group transition-all hover:border-primary/20">
            <div className="absolute top-0 right-0 -mt-16 -mr-16 w-48 h-48 bg-primary/10 rounded-full blur-[80px]"></div>
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted border border-border rounded-lg">
                  <span className="material-symbols-outlined text-foreground text-[20px]">wallet</span>
                </div>
                <span className="text-sm font-medium text-muted-foreground">Saldo Disponível</span>
              </div>
              <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider rounded-full border border-primary/20">
                Ativo
              </span>
            </div>
            <div className="relative z-10 mt-2">
              <h2 className={`text-4xl font-black tracking-tighter ${balance > 0 ? "text-emerald-400" : "text-destructive"}`}>
                R$ {balance.toFixed(2).replace(".", ",")}
              </h2>
              {todayDeposits > 0 && (
                <div className="flex items-center gap-1.5 mt-2 text-primary font-medium bg-primary/5 w-fit px-2 py-1 rounded-md border border-primary/10 text-xs">
                  <span className="material-symbols-outlined text-[16px]">trending_up</span>
                  <span>+R$ {todayDeposits.toFixed(2).replace(".", ",")} recebidos hoje</span>
                </div>
              )}
            </div>
          </div>

          {/* Add Balance Card */}
          <div className="rounded-2xl glass-panel p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[22px]">qr_code_2</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Adicionar Saldo via Pix</h3>
                <p className="text-muted-foreground text-xs">Crédito imediato após o pagamento</p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5 group">
                <span className="text-muted-foreground text-xs font-semibold ml-1">Valor da Recarga</span>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold text-base group-focus-within:text-foreground transition-colors">
                    R$
                  </span>
                  <input
                    className="w-full bg-card border border-border rounded-xl px-12 py-3 text-foreground text-xl font-bold placeholder:text-muted-foreground/30 focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none"
                    placeholder="0,00"
                    type="text"
                    value={rechargeValue}
                    onChange={(e) => setRechargeValue(e.target.value)}
                  />
                </div>
              </label>

              <div className="grid grid-cols-4 gap-2">
                {quickAmounts.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setRechargeValue(amount.toString())}
                    className="py-2 rounded-lg border border-border bg-muted hover:bg-primary hover:border-primary hover:text-primary-foreground hover:font-bold text-muted-foreground text-xs font-medium transition-all"
                  >
                    + R$ {amount}
                  </button>
                ))}
              </div>

              <div className="pt-3 border-t border-border">
                <button
                  onClick={handleGeneratePix}
                  disabled={generating}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-11 rounded-xl text-sm font-bold tracking-wide shadow-glow hover:shadow-glow-lg transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {generating ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Gerando PIX...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[20px] font-semibold">qr_code_2</span>
                      Gerar Pix para Pagamento
                    </>
                  )}
                </button>
                <p className="text-center text-muted-foreground text-[10px] mt-2 flex items-center justify-center gap-1 opacity-70">
                  <span className="material-symbols-outlined text-[14px] text-primary">lock</span>
                  Pagamento processado instantaneamente em ambiente seguro.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl glass-panel p-3.5 flex flex-col gap-1 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                <span className="material-symbols-outlined text-2xl">payments</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Gasto Mensal</span>
              <span className="text-lg font-black text-foreground">R$ {monthlyExpense.toFixed(2).replace(".", ",")}</span>
            </div>
            <div className={`rounded-xl glass-panel p-3.5 flex flex-col gap-1 relative overflow-hidden group ${balance > 0 ? "border-emerald-500/20 bg-emerald-500/5" : "border-destructive/20 bg-destructive/5"}`}>
              <div className={`absolute top-0 right-0 p-2 opacity-20 ${balance > 0 ? "text-emerald-400" : "text-destructive"}`}>
                <span className="material-symbols-outlined text-2xl">savings</span>
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${balance > 0 ? "text-emerald-400" : "text-destructive"}`}>Saldo</span>
              <span className={`text-lg font-black ${balance > 0 ? "text-emerald-400" : "text-destructive"}`}>R$ {balance.toFixed(2).replace(".", ",")}</span>
            </div>
          </div>

          {/* Transactions */}
          <div className="rounded-2xl glass-panel flex flex-col flex-1">
            <div className="px-4 py-3 border-b border-border flex justify-between items-center bg-muted/50">
              <h3 className="text-sm font-bold text-foreground">Últimas Movimentações</h3>
            </div>

            <div className="p-3 flex flex-col gap-1 overflow-y-auto max-h-[280px]">
              {transactions.length === 0 ? (
                <div className="text-center py-6">
                  <span className="material-symbols-outlined text-[28px] text-muted-foreground mb-1">receipt_long</span>
                  <p className="text-muted-foreground text-xs">Nenhuma movimentação ainda.</p>
                </div>
              ) : (
                transactions.map((transaction) => {
                  const isPositive = transaction.amount > 0;
                  return (
                    <div
                      key={transaction.id}
                      className="group flex items-center justify-between p-3 hover:bg-muted rounded-lg transition-all cursor-default border border-transparent hover:border-border"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                            isPositive
                              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                              : "bg-destructive/10 border border-destructive/20 text-destructive"
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]">{getIcon(transaction.type)}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-foreground">{transaction.title}</span>
                          <span className="text-[10px] text-muted-foreground">{formatDate(transaction.created_at)}</span>
                        </div>
                      </div>
                      <span className={`text-xs font-bold ${isPositive ? "text-emerald-400" : "text-foreground"}`}>
                        {isPositive ? "+" : "-"} R$ {Math.abs(transaction.amount).toFixed(2).replace(".", ",")}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* PIX QR Code Modal */}
      <Dialog open={pixModal} onOpenChange={(open) => {
        if (!open) {
          setPixModal(false);
          setPaymentConfirmed(false);
          setPixData(null);
          setPaymentId(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          {paymentConfirmed ? (
            <div className="flex flex-col items-center gap-6 py-8">
              <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center animate-fade-in">
                <Check className="size-10 text-primary" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-black text-foreground">Pagamento Confirmado!</h3>
                <p className="text-muted-foreground">
                  Obrigado! Seu saldo de{" "}
                  <span className="text-primary font-bold">
                    R$ {pixData?.amount.toFixed(2).replace(".", ",")}
                  </span>{" "}
                  já está disponível na plataforma.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                <span>Fechando automaticamente...</span>
              </div>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-center text-xl font-bold">Pague com PIX</DialogTitle>
              </DialogHeader>

              {pixData && (
                <div className="flex flex-col items-center gap-6 py-4">
                  <p className="text-muted-foreground text-sm text-center">
                    Escaneie o QR Code ou copie o código para pagar
                  </p>

                  <div className="bg-primary/10 border border-primary/20 rounded-2xl px-6 py-3">
                    <span className="text-2xl font-black text-primary">
                      R$ {pixData.amount.toFixed(2).replace(".", ",")}
                    </span>
                  </div>

                  {pixData.qr_code_base64 && (
                    <div className="bg-white rounded-2xl p-4">
                      <img
                        src={`data:image/png;base64,${pixData.qr_code_base64}`}
                        alt="QR Code PIX"
                        className="w-56 h-56"
                      />
                    </div>
                  )}

                  {pixData.qr_code && (
                    <button
                      onClick={handleCopyPix}
                      className="w-full flex items-center justify-center gap-2 bg-muted border border-border rounded-xl px-4 py-3 hover:bg-accent transition-colors"
                    >
                      {copied ? (
                        <Check className="size-4 text-primary" />
                      ) : (
                        <Copy className="size-4 text-muted-foreground" />
                      )}
                      <span className="text-sm font-medium text-foreground">
                        {copied ? "Copiado!" : "Copiar código Pix Copia e Cola"}
                      </span>
                    </button>
                  )}

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" />
                    <span>Aguardando pagamento...</span>
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
