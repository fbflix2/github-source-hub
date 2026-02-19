import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Link
            to="/loja"
            className="flex items-center gap-2 text-muted-foreground text-sm hover:text-primary transition-colors w-fit"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            <span>Voltar para Loja</span>
          </Link>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-foreground">Minha Carteira</h1>
          <p className="text-muted-foreground text-lg font-medium">
            Gerencie seu saldo e adicione créditos instantaneamente.
          </p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column */}
        <div className="lg:col-span-7 flex flex-col gap-8">
          {/* Balance Card */}
          <div className="relative overflow-hidden rounded-3xl glass-panel p-8 group transition-all hover:border-primary/20">
            <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-primary/10 rounded-full blur-[80px]"></div>
            <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-48 h-48 bg-primary/5 rounded-full blur-[60px]"></div>
            <div className="relative z-10 flex flex-col gap-8">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-muted border border-border rounded-xl">
                    <span className="material-symbols-outlined text-foreground text-[24px]">wallet</span>
                  </div>
                  <span className="text-lg font-medium text-muted-foreground">Saldo Disponível</span>
                </div>
                <span className="px-4 py-1.5 bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider rounded-full border border-primary/20 shadow-[0_0_10px_rgba(0,230,118,0.1)]">
                  Ativo
                </span>
              </div>
              <div>
                <h2 className="text-6xl font-black text-foreground tracking-tighter">
                  R$ {balance.toFixed(2).replace(".", ",")}
                </h2>
                {todayDeposits > 0 && (
                  <div className="flex items-center gap-2 mt-4 text-primary font-medium bg-primary/5 w-fit px-3 py-1.5 rounded-lg border border-primary/10">
                    <span className="material-symbols-outlined text-[20px]">trending_up</span>
                    <span>+R$ {todayDeposits.toFixed(2).replace(".", ",")} recebidos hoje</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Add Balance Card */}
          <div className="rounded-3xl glass-panel p-8">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[28px]">qr_code_2</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">Adicionar Saldo via Pix</h3>
                <p className="text-muted-foreground text-sm">Crédito imediato após o pagamento</p>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <label className="flex flex-col gap-3 group">
                <span className="text-muted-foreground text-sm font-semibold ml-1">Valor da Recarga</span>
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold text-xl group-focus-within:text-foreground transition-colors">
                    R$
                  </span>
                  <input
                    className="w-full bg-card border border-border rounded-2xl px-16 py-5 text-foreground text-3xl font-bold placeholder:text-muted-foreground/30 focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none"
                    placeholder="0,00"
                    type="text"
                    value={rechargeValue}
                    onChange={(e) => setRechargeValue(e.target.value)}
                  />
                </div>
              </label>

              <div className="grid grid-cols-4 gap-3">
                {quickAmounts.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setRechargeValue(amount.toString())}
                    className="py-3 rounded-xl border border-border bg-muted hover:bg-primary hover:border-primary hover:text-primary-foreground hover:font-bold text-muted-foreground text-sm font-medium transition-all"
                  >
                    + R$ {amount}
                  </button>
                ))}
              </div>

              <div className="pt-6 border-t border-border mt-2">
                <button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-14 rounded-xl text-base font-bold tracking-wide shadow-glow hover:shadow-glow-lg transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-3">
                  <span className="material-symbols-outlined font-semibold">photo_camera</span>
                  Gerar Pix para Pagamento
                </button>
                <p className="text-center text-muted-foreground text-xs mt-5 flex items-center justify-center gap-1.5 opacity-70">
                  <span className="material-symbols-outlined text-[16px] text-primary">lock</span>
                  Pagamento processado instantaneamente em ambiente seguro.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-5 flex flex-col gap-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl glass-panel p-5 flex flex-col gap-2 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                <span className="material-symbols-outlined text-4xl">payments</span>
              </div>
              <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Gasto Mensal</span>
              <span className="text-2xl font-black text-foreground">R$ {monthlyExpense.toFixed(2).replace(".", ",")}</span>
            </div>
            <div className="rounded-2xl glass-panel p-5 flex flex-col gap-2 relative overflow-hidden group border-primary/20 bg-primary/5">
              <div className="absolute top-0 right-0 p-3 opacity-20 text-primary">
                <span className="material-symbols-outlined text-4xl">savings</span>
              </div>
              <span className="text-xs text-primary font-bold uppercase tracking-wider">Saldo</span>
              <span className="text-2xl font-black text-primary">R$ {balance.toFixed(2).replace(".", ",")}</span>
            </div>
          </div>

          {/* Transactions */}
          <div className="rounded-3xl glass-panel flex flex-col flex-1 min-h-[400px]">
            <div className="p-6 border-b border-border flex justify-between items-center bg-muted/50">
              <h3 className="text-lg font-bold text-foreground">Últimas Movimentações</h3>
            </div>

            <div className="p-4 flex flex-col gap-2 overflow-y-auto max-h-[500px]">
              {transactions.length === 0 ? (
                <div className="text-center py-8">
                  <span className="material-symbols-outlined text-[32px] text-muted-foreground mb-2">receipt_long</span>
                  <p className="text-muted-foreground text-sm">Nenhuma movimentação ainda.</p>
                </div>
              ) : (
                transactions.map((transaction) => {
                  const isPositive = transaction.amount > 0;
                  return (
                    <div
                      key={transaction.id}
                      className="group flex items-center justify-between p-4 hover:bg-muted rounded-xl transition-all cursor-default border border-transparent hover:border-border"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                            isPositive
                              ? "bg-primary/10 border border-primary/20 text-primary group-hover:bg-primary group-hover:text-primary-foreground"
                              : "bg-destructive/10 border border-destructive/20 text-destructive group-hover:bg-destructive group-hover:text-destructive-foreground"
                          }`}
                        >
                          <span className="material-symbols-outlined text-[20px]">{getIcon(transaction.type)}</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-bold text-foreground">{transaction.title}</span>
                          <span className="text-xs text-muted-foreground">{formatDate(transaction.created_at)}</span>
                        </div>
                      </div>
                      <span className={`text-sm font-bold ${isPositive ? "text-primary" : "text-foreground"}`}>
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
    </div>
  );
}
