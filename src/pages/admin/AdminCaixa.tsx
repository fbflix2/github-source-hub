import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft,
  DoorOpen,
  DoorClosed,
  Loader2,
  Banknote,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Minus,
  FileText,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDate = (d: string) =>
  new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

interface CashRecord {
  id: string;
  opened_at: string;
  closed_at: string | null;
  status: string;
  opening_balance: number;
  system_revenue: number;
  system_expenses: number;
  system_balance: number;
  bank_balance: number | null;
  withdrawals: number;
  deposits: number;
  difference: number;
  notes: string | null;
}

export default function AdminCaixa() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openCash, setOpenCash] = useState<CashRecord | null>(null);
  const [history, setHistory] = useState<CashRecord[]>([]);

  // Open form state
  const [openingBalanceInput, setOpeningBalanceInput] = useState("");

  // Close form state
  const [bankBalance, setBankBalance] = useState("");
  const [withdrawals, setWithdrawals] = useState("");
  const [deposits, setDeposits] = useState("");
  const [notes, setNotes] = useState("");

  // System values for the open period
  const [systemRevenue, setSystemRevenue] = useState(0);
  const [systemExpenses, setSystemExpenses] = useState(0);

  // Mercado Pago balance
  const [mpBalance, setMpBalance] = useState<{ available_balance?: number; total_amount?: number; unavailable_balance?: number } | null>(null);
  const [mpLoading, setMpLoading] = useState(false);

  const fetchMpBalance = async () => {
    setMpLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("mercadopago-balance");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setMpBalance(data);
    } catch (err: any) {
      console.error("MP balance error:", err);
    } finally {
      setMpLoading(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);

    // Check for open cash register
    const { data: openData } = await supabase
      .from("cash_register")
      .select("*")
      .eq("status", "open")
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (openData) {
      setOpenCash(openData as CashRecord);
      // Fetch system values for the open period
      await fetchSystemValues(openData.opened_at);
    } else {
      setOpenCash(null);
    }

    // Fetch history (last 30 closed)
    const { data: histData } = await supabase
      .from("cash_register")
      .select("*")
      .eq("status", "closed")
      .order("closed_at", { ascending: false })
      .limit(30);

    setHistory((histData || []) as CashRecord[]);
    setLoading(false);
  };

  const fetchSystemValues = async (since: string) => {
    const [ordersRes, purchasesRes] = await Promise.all([
      supabase
        .from("orders")
        .select("total")
        .in("status", ["completed", "delivered"])
        .gte("created_at", since),
      supabase
        .from("purchases")
        .select("total_value")
        .gte("created_at", since),
    ]);

    const rev = (ordersRes.data ?? []).reduce((s, o) => s + Number(o.total || 0), 0);
    const exp = (purchasesRes.data ?? []).reduce((s, p) => s + Number(p.total_value || 0), 0);
    setSystemRevenue(rev);
    setSystemExpenses(exp);
  };

  useEffect(() => { fetchData(); }, []);

  const handleOpen = async () => {
    const obVal = parseFloat(openingBalanceInput);
    if (isNaN(obVal)) {
      toast.error("Informe o saldo atual do banco para abrir o caixa");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { error } = await supabase.from("cash_register").insert({
        opened_by: user.id,
        status: "open",
        opening_balance: obVal,
      });
      if (error) throw error;

      toast.success("Caixa aberto com sucesso!");
      setOpeningBalanceInput("");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao abrir caixa");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = async () => {
    if (!openCash) return;
    const bankVal = parseFloat(bankBalance);
    if (isNaN(bankVal)) {
      toast.error("Informe o saldo real do banco");
      return;
    }

    setSaving(true);
    try {
      const wdVal = parseFloat(withdrawals) || 0;
      const dpVal = parseFloat(deposits) || 0;
      const sysBalance = systemRevenue - systemExpenses;
      const openBal = openCash.opening_balance || 0;
      // Expected = opening balance + system balance - withdrawals + deposits
      const expectedBalance = openBal + sysBalance - wdVal + dpVal;
      const diff = bankVal - expectedBalance;

      const { error } = await supabase
        .from("cash_register")
        .update({
          closed_at: new Date().toISOString(),
          status: "closed",
          system_revenue: systemRevenue,
          system_expenses: systemExpenses,
          system_balance: sysBalance,
          bank_balance: bankVal,
          withdrawals: wdVal,
          deposits: dpVal,
          difference: diff,
          notes: notes.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", openCash.id);

      if (error) throw error;

      toast.success("Caixa fechado com sucesso!");
      setBankBalance("");
      setWithdrawals("");
      setDeposits("");
      setNotes("");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao fechar caixa");
    } finally {
      setSaving(false);
    }
  };

  const sysBalance = systemRevenue - systemExpenses;
  const openingBal = openCash?.opening_balance || 0;
  const bankVal = parseFloat(bankBalance) || 0;
  const wdVal = parseFloat(withdrawals) || 0;
  const dpVal = parseFloat(deposits) || 0;
  const expectedBalance = openingBal + sysBalance - wdVal + dpVal;
  const liveDiff = bankVal - expectedBalance;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)] -mx-6 -mt-6 p-6 lg:p-10 gap-8 relative">
      {/* Background */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-primary/15 rounded-full blur-[120px] mix-blend-screen opacity-30" />
      </div>

      <div className="relative z-10 w-full max-w-5xl mx-auto flex flex-col gap-8">
        {/* Header */}
        <header className="flex items-center gap-4">
          <button onClick={() => navigate("/admin/auditoria")} className="p-2 rounded-lg border border-white/10 hover:bg-white/5 transition-colors">
            <ArrowLeft className="size-5 text-white" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Controle de Caixa</h1>
            <p className="text-sm text-muted-foreground">Abertura e fechamento diário para conciliação bancária</p>
          </div>
        </header>

        {/* Current Status */}
        {!openCash ? (
          // No open cash - show open button
          <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-xl p-8 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <DoorOpen className="size-8 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Nenhum caixa aberto</h2>
              <p className="text-sm text-muted-foreground mt-1">Informe o saldo atual do banco e abra o caixa</p>
            </div>
            <div className="max-w-xs mx-auto space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                <Banknote className="size-3 inline mr-1" />
                Saldo Atual do Banco (R$)
              </Label>
              <Input
                type="number"
                step="0.01"
                value={openingBalanceInput}
                onChange={(e) => setOpeningBalanceInput(e.target.value)}
                placeholder="Quanto tem na conta agora"
              />
            </div>
            <Button onClick={handleOpen} disabled={saving || !openingBalanceInput} className="gap-2">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <DoorOpen className="size-4" />}
              Abrir Caixa
            </Button>
          </div>
        ) : (
          // Cash is open - show dashboard + close form
          <div className="space-y-6">
            {/* Open info */}
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <Clock className="size-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-emerald-400">Caixa Aberto</p>
                  <p className="text-xs text-muted-foreground">
                    Desde {formatDate(openCash.opened_at)} • Saldo abertura: {formatCurrency(openCash.opening_balance || 0)}
                  </p>
                </div>
              </div>
            </div>

            {/* System metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="size-4 text-emerald-400" />
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">Receita no Período</span>
                </div>
                <p className="text-xl font-bold text-white">{formatCurrency(systemRevenue)}</p>
              </div>
              <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="size-4 text-red-400" />
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">Despesas no Período</span>
                </div>
                <p className="text-xl font-bold text-white">{formatCurrency(systemExpenses)}</p>
              </div>
              <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Banknote className="size-4 text-blue-400" />
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">Saldo Sistema</span>
                </div>
                <p className="text-xl font-bold text-white">{formatCurrency(sysBalance)}</p>
              </div>
            </div>

            {/* Close form */}
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-xl p-6 space-y-5">
              <div className="flex items-center gap-3">
                <DoorClosed className="size-5 text-primary" />
                <h3 className="text-lg font-bold text-white">Fechar Caixa</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    <Banknote className="size-3 inline mr-1" />
                    Saldo Real do Banco (R$)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={bankBalance}
                    onChange={(e) => setBankBalance(e.target.value)}
                    placeholder="Quanto tem na conta"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    <Minus className="size-3 inline mr-1" />
                    Sangrias / Retiradas (R$)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={withdrawals}
                    onChange={(e) => setWithdrawals(e.target.value)}
                    placeholder="0,00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    <Plus className="size-3 inline mr-1" />
                    Reforços / Entradas (R$)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={deposits}
                    onChange={(e) => setDeposits(e.target.value)}
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  <FileText className="size-3 inline mr-1" />
                  Observações
                </Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Justificativas para divergências, anotações do dia..."
                  className="min-h-[60px] resize-none text-sm"
                />
              </div>

              {/* Live difference preview */}
              {bankBalance && (
                <div className={`rounded-lg p-4 border ${
                  Math.abs(liveDiff) < 0.01
                    ? "bg-emerald-500/5 border-emerald-500/20"
                    : "bg-amber-500/5 border-amber-500/20"
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {Math.abs(liveDiff) < 0.01 ? (
                        <CheckCircle2 className="size-5 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="size-5 text-amber-400" />
                      )}
                      <span className="text-sm font-medium text-white">
                        {Math.abs(liveDiff) < 0.01 ? "Caixa batendo!" : "Diferença encontrada"}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${
                        Math.abs(liveDiff) < 0.01 ? "text-emerald-400" : liveDiff > 0 ? "text-emerald-400" : "text-red-400"
                      }`}>
                        {liveDiff > 0 ? "+" : ""}{formatCurrency(liveDiff)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Esperado: {formatCurrency(expectedBalance)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <Button onClick={handleClose} disabled={saving || !bankBalance} className="w-full gap-2">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <DoorClosed className="size-4" />}
                Fechar Caixa
              </Button>
            </div>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white">Histórico de Fechamentos</h3>
            <div className="space-y-3">
              {history.map((record) => (
                <div key={record.id} className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        Math.abs(record.difference) < 0.01
                          ? "bg-emerald-500/10"
                          : "bg-amber-500/10"
                      }`}>
                        {Math.abs(record.difference) < 0.01 ? (
                          <CheckCircle2 className="size-4 text-emerald-400" />
                        ) : (
                          <AlertTriangle className="size-4 text-amber-400" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">
                          {formatDate(record.opened_at)} → {record.closed_at ? formatDate(record.closed_at) : "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Sistema: {formatCurrency(record.system_balance)} • Banco: {formatCurrency(record.bank_balance || 0)}
                          {record.withdrawals > 0 && ` • Sangria: ${formatCurrency(record.withdrawals)}`}
                          {record.deposits > 0 && ` • Reforço: ${formatCurrency(record.deposits)}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${
                        Math.abs(record.difference) < 0.01
                          ? "text-emerald-400"
                          : record.difference > 0 ? "text-emerald-400" : "text-red-400"
                      }`}>
                        {record.difference > 0 ? "+" : ""}{formatCurrency(record.difference)}
                      </p>
                      {record.notes && (
                        <p className="text-xs text-muted-foreground mt-1 max-w-xs truncate">{record.notes}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
