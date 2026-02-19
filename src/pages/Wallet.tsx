import { useState } from "react";
import { Link } from "react-router-dom";

type TransactionType = "deposit" | "purchase" | "bonus";

interface Transaction {
  id: number;
  type: TransactionType;
  title: string;
  date: string;
  amount: number;
  icon: string;
}

const transactions: Transaction[] = [
  { id: 1, type: "deposit", title: "Recarga Pix", date: "Hoje, 14:30", amount: 100.0, icon: "add" },
  { id: 2, type: "purchase", title: "Compra de Serviços", date: "Ontem, 09:15", amount: -29.9, icon: "shopping_cart" },
  { id: 3, type: "purchase", title: "Assinatura Premium", date: "22 Out, 18:20", amount: -49.9, icon: "shopping_cart" },
  { id: 4, type: "bonus", title: "Bônus Promocional", date: "20 Out, 11:00", amount: 10.0, icon: "card_giftcard" },
  { id: 5, type: "deposit", title: "Recarga Pix", date: "15 Out, 16:45", amount: 500.0, icon: "add" },
];

const quickAmounts = [20, 50, 100, 200];

export default function Wallet() {
  const [rechargeValue, setRechargeValue] = useState<string>("");
  const balance = 1450.0;
  const monthlyExpense = 245.9;
  const cashback = 12.5;

  return (
    <div className="space-y-10 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 text-text-secondary text-sm hover:text-primary transition-colors w-fit"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            <span>Voltar para Dashboard</span>
          </Link>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-foreground">Minha Carteira</h1>
          <p className="text-text-secondary text-lg font-medium">
            Gerencie seu saldo e adicione créditos instantaneamente.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="px-5 py-2.5 rounded-lg bg-muted border border-border text-sm font-semibold text-text-secondary hover:text-foreground hover:bg-secondary transition-all flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">help</span>
            Ajuda
          </button>
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
                  <span className="text-lg font-medium text-text-secondary">Saldo Disponível</span>
                </div>
                <span className="px-4 py-1.5 bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider rounded-full border border-primary/20 shadow-[0_0_10px_rgba(0,230,118,0.1)]">
                  Ativo
                </span>
              </div>
              <div>
                <h2 className="text-6xl font-black text-foreground tracking-tighter">
                  R$ {balance.toFixed(2).replace(".", ",")}
                </h2>
                <div className="flex items-center gap-2 mt-4 text-primary font-medium bg-primary/5 w-fit px-3 py-1.5 rounded-lg border border-primary/10">
                  <span className="material-symbols-outlined text-[20px]">trending_up</span>
                  <span>+R$ 100,00 recebidos hoje</span>
                </div>
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
                <p className="text-text-secondary text-sm">Crédito imediato após o pagamento</p>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <label className="flex flex-col gap-3 group">
                <span className="text-text-secondary text-sm font-semibold ml-1">Valor da Recarga</span>
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-text-secondary font-semibold text-xl group-focus-within:text-foreground transition-colors">
                    R$
                  </span>
                  <input
                    className="w-full bg-card border border-glass-border rounded-2xl px-16 py-5 text-foreground text-3xl font-bold placeholder:text-muted-foreground/30 focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none"
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
                    className="py-3 rounded-xl border border-glass-border bg-muted hover:bg-primary hover:border-primary hover:text-background hover:font-bold text-text-secondary text-sm font-medium transition-all"
                  >
                    + R$ {amount}
                  </button>
                ))}
              </div>

              <div className="pt-6 border-t border-glass-border mt-2">
                <button className="w-full bg-primary hover:bg-[#00c968] text-background h-14 rounded-xl text-base font-bold tracking-wide shadow-glow hover:shadow-glow-lg transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-3">
                  <span className="material-symbols-outlined font-semibold">photo_camera</span>
                  Gerar Pix para Pagamento
                </button>
                <p className="text-center text-text-secondary text-xs mt-5 flex items-center justify-center gap-1.5 opacity-70">
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
              <span className="text-xs text-text-secondary font-bold uppercase tracking-wider">Gasto Mensal</span>
              <span className="text-2xl font-black text-foreground">R$ {monthlyExpense.toFixed(2).replace(".", ",")}</span>
            </div>
            <div className="rounded-2xl glass-panel p-5 flex flex-col gap-2 relative overflow-hidden group border-primary/20 bg-primary/5">
              <div className="absolute top-0 right-0 p-3 opacity-20 text-primary">
                <span className="material-symbols-outlined text-4xl">savings</span>
              </div>
              <span className="text-xs text-primary font-bold uppercase tracking-wider">Cashback</span>
              <span className="text-2xl font-black text-primary">R$ {cashback.toFixed(2).replace(".", ",")}</span>
            </div>
          </div>

          {/* Transactions */}
          <div className="rounded-3xl glass-panel flex flex-col flex-1 min-h-[400px]">
            <div className="p-6 border-b border-glass-border flex justify-between items-center bg-muted/50">
              <h3 className="text-lg font-bold text-foreground">Últimas Movimentações</h3>
              <a className="text-xs text-primary font-bold hover:text-foreground transition-colors uppercase tracking-wide cursor-pointer">
                Extrato Completo
              </a>
            </div>

            <div className="p-4 flex flex-col gap-2 overflow-y-auto max-h-[500px]">
              {transactions.map((transaction) => {
                const isPositive = transaction.amount > 0;
                return (
                  <div
                    key={transaction.id}
                    className="group flex items-center justify-between p-4 hover:bg-muted rounded-xl transition-all cursor-default border border-transparent hover:border-glass-border"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                          isPositive
                            ? "bg-primary/10 border border-primary/20 text-primary group-hover:bg-primary group-hover:text-background"
                            : "bg-danger/10 border border-danger/20 text-danger group-hover:bg-danger group-hover:text-danger-foreground"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[20px]">{transaction.icon}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-bold text-foreground">{transaction.title}</span>
                        <span className="text-xs text-text-secondary">{transaction.date}</span>
                      </div>
                    </div>
                    <span className={`text-sm font-bold ${isPositive ? "text-primary" : "text-foreground"}`}>
                      {isPositive ? "+" : "-"} R$ {Math.abs(transaction.amount).toFixed(2).replace(".", ",")}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-auto p-4 border-t border-glass-border">
              <button className="w-full py-3 text-sm text-text-secondary hover:text-foreground transition-colors flex items-center justify-center gap-2 rounded-lg hover:bg-muted font-medium">
                <span>Carregar mais</span>
                <span className="material-symbols-outlined text-[18px]">expand_more</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
