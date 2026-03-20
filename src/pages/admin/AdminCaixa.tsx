import { useState, useEffect, useCallback } from "react";
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
  Clock,
  Plus,
  Minus,
  FileText,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ArrowUpCircle,
  ArrowDownCircle,
  Zap,
  PenLine,
  Settings2,
  Percent,
  ChevronDown,
  ChevronUp,
  Eye,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

// ── Helpers ──
const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDate = (d: string) =>
  new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

const formatTime = (d: string) =>
  new Date(d).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const parseBRL = (value: string): number => {
  if (!value || value === "") return 0;
  let str = String(value).trim().replace(/[R$\s]/g, "");
  const lastComma = str.lastIndexOf(",");
  const lastDot = str.lastIndexOf(".");
  if (lastComma > lastDot) {
    str = str.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    str = str.replace(/,/g, "");
  }
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
};

const isBankPaymentMethod = (paymentMethod: string | null | undefined) =>
  paymentMethod === "pix";

// ── Types ──
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

interface CashMovement {
  id: string;
  cash_register_id: string;
  type: string; // 'entry' | 'exit'
  source: string; // 'manual' | 'automatic'
  amount: number;
  description: string | null;
  reference_id: string | null;
  created_at: string;
}

export default function AdminCaixa() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openCash, setOpenCash] = useState<CashRecord | null>(null);
  const [history, setHistory] = useState<CashRecord[]>([]);
  const [reopening, setReopening] = useState(false);

  // Expanded history detail
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [historyMovements, setHistoryMovements] = useState<CashMovement[]>([]);
  const [histRetroType, setHistRetroType] = useState<"entry" | "exit">("entry");
  const [histRetroAmount, setHistRetroAmount] = useState("");
  const [histRetroDesc, setHistRetroDesc] = useState("");
  const [addingHistRetro, setAddingHistRetro] = useState(false);

  // Open form
  const [openingBalanceInput, setOpeningBalanceInput] = useState("");

  // Close form
  const [closeNotes, setCloseNotes] = useState("");

  // Movements
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [newMovementType, setNewMovementType] = useState<"entry" | "exit">("entry");
  const [newMovementAmount, setNewMovementAmount] = useState("");
  const [newMovementDesc, setNewMovementDesc] = useState("");
  const [addingMovement, setAddingMovement] = useState(false);

  // Fee config
  const [mpFeeRate, setMpFeeRate] = useState(0.99); // 0.99% default
  const [showFeeConfig, setShowFeeConfig] = useState(false);

  // System values
  const [systemRevenue, setSystemRevenue] = useState(0);
  const [systemExpenses, setSystemExpenses] = useState(0);

  // ── Fetch ──
  const fetchData = useCallback(async () => {
    setLoading(true);

    const { data: openData } = await supabase
      .from("cash_register")
      .select("*")
      .eq("status", "open")
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (openData) {
      setOpenCash(openData as CashRecord);
      await Promise.all([
        fetchSystemValues(openData.opened_at),
        fetchMovements(openData.id),
      ]);
    } else {
      setOpenCash(null);
      setMovements([]);
    }

    const { data: histData } = await supabase
      .from("cash_register")
      .select("*")
      .order("opened_at", { ascending: false })
      .limit(30);

    // Exclude the currently active (today's) cash from history
    const activeId = openData?.id;
    setHistory((histData || []).filter((r: any) => r.id !== activeId) as CashRecord[]);
    setLoading(false);
  }, []);

  const fetchSystemValues = async (since: string) => {
    const [ordersRes, purchasesRes] = await Promise.all([
      supabase
        .from("orders")
        .select("total, payment_method")
        .in("status", ["completed", "delivered"])
        .gte("created_at", since),
      supabase
        .from("purchases")
        .select("total_value")
        .gte("created_at", since),
    ]);

    const bankOrders = (ordersRes.data ?? []).filter((order) =>
      isBankPaymentMethod(order.payment_method)
    );

    setSystemRevenue(bankOrders.reduce((s, o) => s + Number(o.total || 0), 0));
    setSystemExpenses((purchasesRes.data ?? []).reduce((s, p) => s + Number(p.total_value || 0), 0));
  };

  const fetchMovements = async (cashId: string) => {
    const { data } = await supabase
      .from("cash_movements")
      .select("*")
      .eq("cash_register_id", cashId)
      .order("created_at", { ascending: false });
    setMovements((data || []) as CashMovement[]);
  };

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Realtime: listen for new orders → auto-create entry movements ──
  useEffect(() => {
    if (!openCash) return;
    const cashId = openCash.id;
    const openedAt = openCash.opened_at;

    // Subscribe to new orders
    const orderChannel = supabase
      .channel("cash-orders-realtime")
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "orders",
      }, async (payload) => {
        const order = payload.new as any;
        if (
          (order.status === "completed" || order.status === "delivered") &&
          isBankPaymentMethod(order.payment_method) &&
          new Date(order.created_at) >= new Date(openedAt)
        ) {
          // Check if we already have this order as a movement
          const { data: existing } = await supabase
            .from("cash_movements")
            .select("id")
            .eq("cash_register_id", cashId)
            .eq("reference_id", order.code)
            .maybeSingle();

          if (!existing) {
            const total = Number(order.total || 0);
            const fee = Math.round(total * mpFeeRate) / 100;
            const movs: any[] = [
              {
                cash_register_id: cashId,
                type: "entry",
                source: "automatic",
                amount: total,
                description: `Venda #${order.code}`,
                reference_id: order.code,
              },
            ];
            if (fee > 0) {
              movs.push({
                cash_register_id: cashId,
                type: "exit",
                source: "automatic",
                amount: fee,
                description: `Taxa MP ${mpFeeRate.toFixed(2).replace(".", ",")}% - Venda #${order.code}`,
                reference_id: `fee-${order.code}`,
              });
            }
            await supabase.from("cash_movements").insert(movs);
          }
          // Refresh
          fetchMovements(cashId);
          fetchSystemValues(openedAt);
        }
      })
      .subscribe();

    // Subscribe to movements changes
    const movChannel = supabase
      .channel("cash-movements-realtime")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "cash_movements",
        filter: `cash_register_id=eq.${cashId}`,
      }, () => {
        fetchMovements(cashId);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(orderChannel);
      supabase.removeChannel(movChannel);
    };
  }, [openCash?.id, openCash?.opened_at, mpFeeRate]);

  // ── Sync existing completed orders as automatic movements on open ──
  useEffect(() => {
    if (!openCash) return;
    const syncAutoMovements = async () => {
      const { data: completedOrders } = await supabase
        .from("orders")
        .select("code, total, payment_method")
        .in("status", ["completed", "delivered"])
        .gte("created_at", openCash.opened_at);

      if (!completedOrders?.length) return;

      const { data: existingMovs } = await supabase
        .from("cash_movements")
        .select("reference_id")
        .eq("cash_register_id", openCash.id)
        .eq("source", "automatic");

      const existingRefs = new Set((existingMovs || []).map(m => m.reference_id));

      const toInsert: any[] = [];
      completedOrders
        .filter((o) => isBankPaymentMethod(o.payment_method))
        .forEach((o) => {
          const total = Number(o.total || 0);
          const fee = Math.round(total * mpFeeRate) / 100;

          // Insert entry if missing
          if (!existingRefs.has(o.code)) {
            toInsert.push({
              cash_register_id: openCash.id,
              type: "entry",
              source: "automatic",
              amount: total,
              description: `Venda #${o.code}`,
              reference_id: o.code,
            });
          }
          // Insert fee if missing
          if (fee > 0 && !existingRefs.has(`fee-${o.code}`)) {
            toInsert.push({
              cash_register_id: openCash.id,
              type: "exit",
              source: "automatic",
              amount: fee,
              description: `Taxa MP ${mpFeeRate.toFixed(2).replace(".", ",")}% - Venda #${o.code}`,
              reference_id: `fee-${o.code}`,
            });
          }
        });

      if (toInsert.length > 0) {
        await supabase.from("cash_movements").insert(toInsert);
        fetchMovements(openCash.id);
      }
    };
    syncAutoMovements();
  }, [openCash?.id, openCash?.opened_at, mpFeeRate]);

  // ── Actions ──
  const handleOpen = async () => {
    const obVal = parseBRL(openingBalanceInput);
    if (!obVal && obVal !== 0) {
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

  const handleAddMovement = async () => {
    if (!openCash) return;
    const amount = parseBRL(newMovementAmount);
    if (!amount || amount <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    if (!newMovementDesc.trim()) {
      toast.error("Informe uma descrição");
      return;
    }
    setAddingMovement(true);
    try {
      const { error } = await supabase.from("cash_movements").insert({
        cash_register_id: openCash.id,
        type: newMovementType,
        source: "manual",
        amount,
        description: newMovementDesc.trim(),
      });
      if (error) throw error;
      toast.success(newMovementType === "entry" ? "Entrada registrada!" : "Saída registrada!");
      setNewMovementAmount("");
      setNewMovementDesc("");
      fetchMovements(openCash.id);
    } catch (err: any) {
      toast.error(err.message || "Erro ao registrar movimento");
    } finally {
      setAddingMovement(false);
    }
  };

  const handleClose = async () => {
    if (!openCash) return;
    setSaving(true);
    try {
      // For closing, use only movements BEFORE today (previous day's balance)
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const previousMovements = movements.filter(m => new Date(m.created_at) < todayStart);
      const prevEntries = previousMovements.filter(m => m.type === "entry").reduce((s, m) => s + m.amount, 0);
      const prevExits = previousMovements.filter(m => m.type === "exit").reduce((s, m) => s + m.amount, 0);
      const closingBalance = openCash.opening_balance + prevEntries - prevExits;

      const { error } = await supabase
        .from("cash_register")
        .update({
          closed_at: new Date().toISOString(),
          status: "closed",
          system_revenue: systemRevenue,
          system_expenses: systemExpenses,
          system_balance: systemRevenue - systemExpenses,
          bank_balance: closingBalance,
          withdrawals: prevExits,
          deposits: prevEntries,
          difference: prevEntries - prevExits,
          notes: closeNotes.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", openCash.id);
      if (error) throw error;
      toast.success("Caixa fechado com sucesso!");
      setCloseNotes("");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao fechar caixa");
    } finally {
      setSaving(false);
    }
  };

  const handleReopen = async (record: CashRecord) => {
    setReopening(true);
    try {
      const { error } = await supabase
        .from("cash_register")
        .update({ status: "open", closed_at: null, updated_at: new Date().toISOString() })
        .eq("id", record.id);
      if (error) throw error;
      toast.success("Caixa reaberto para ajustes!");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao reabrir caixa");
    } finally {
      setReopening(false);
    }
  };

  const handleCloseHistoryRecord = async (record: CashRecord) => {
    setSaving(true);
    try {
      const { data: movs } = await supabase
        .from("cash_movements")
        .select("*")
        .eq("cash_register_id", record.id);
      const allMovs = (movs || []) as CashMovement[];
      const tEntries = allMovs.filter(m => m.type === "entry").reduce((s, m) => s + m.amount, 0);
      const tExits = allMovs.filter(m => m.type === "exit").reduce((s, m) => s + m.amount, 0);
      const closingBalance = record.opening_balance + tEntries - tExits;

      const { error } = await supabase
        .from("cash_register")
        .update({
          closed_at: new Date().toISOString(),
          status: "closed",
          bank_balance: closingBalance,
          withdrawals: tExits,
          deposits: tEntries,
          difference: tEntries - tExits,
          updated_at: new Date().toISOString(),
        })
        .eq("id", record.id);
      if (error) throw error;
      toast.success("Caixa fechado novamente!");
      setExpandedHistoryId(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao fechar caixa");
    } finally {
      setSaving(false);
    }
  };

  const toggleHistoryExpand = async (recordId: string) => {
    if (expandedHistoryId === recordId) {
      setExpandedHistoryId(null);
      setHistoryMovements([]);
      return;
    }
    setExpandedHistoryId(recordId);
    const { data } = await supabase
      .from("cash_movements")
      .select("*")
      .eq("cash_register_id", recordId)
      .order("created_at", { ascending: false });
    setHistoryMovements((data || []) as CashMovement[]);
    setHistRetroAmount("");
    setHistRetroDesc("");
  };

  const handleAddHistRetro = async () => {
    if (!expandedHistoryId) return;
    const amount = parseBRL(histRetroAmount);
    if (!amount || amount <= 0) { toast.error("Informe um valor válido"); return; }
    if (!histRetroDesc.trim()) { toast.error("Informe uma descrição"); return; }
    setAddingHistRetro(true);
    try {
      const { error } = await supabase.from("cash_movements").insert({
        cash_register_id: expandedHistoryId,
        type: histRetroType,
        source: "manual",
        amount,
        description: `[Retroativo] ${histRetroDesc.trim()}`,
      });
      if (error) throw error;
      toast.success("Lançamento retroativo registrado!");
      setHistRetroAmount("");
      setHistRetroDesc("");
      // Refresh movements for this record
      const { data } = await supabase.from("cash_movements").select("*")
        .eq("cash_register_id", expandedHistoryId).order("created_at", { ascending: false });
      setHistoryMovements((data || []) as CashMovement[]);
      // Update record totals
      const record = history.find(h => h.id === expandedHistoryId);
      if (record && record.status === "closed") {
        const allMovs = (data || []) as CashMovement[];
        const tEntries = allMovs.filter(m => m.type === "entry").reduce((s, m) => s + m.amount, 0);
        const tExits = allMovs.filter(m => m.type === "exit").reduce((s, m) => s + m.amount, 0);
        await supabase.from("cash_register").update({
          deposits: tEntries,
          withdrawals: tExits,
          difference: tEntries - tExits,
          bank_balance: record.opening_balance + tEntries - tExits,
          updated_at: new Date().toISOString(),
        }).eq("id", expandedHistoryId);
        fetchData();
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao registrar");
    } finally {
      setAddingHistRetro(false);
    }
  };

  // ── Computed ──
  const totalEntries = movements.filter(m => m.type === "entry").reduce((s, m) => s + m.amount, 0);
  const totalExits = movements.filter(m => m.type === "exit").reduce((s, m) => s + m.amount, 0);
  const currentBalance = (openCash?.opening_balance || 0) + totalEntries - totalExits;
  const netChange = totalEntries - totalExits;

  // Closing balance = only previous days (excludes today's movements)
  const todayStartComputed = new Date();
  todayStartComputed.setHours(0, 0, 0, 0);
  const prevDayEntries = movements.filter(m => m.type === "entry" && new Date(m.created_at) < todayStartComputed).reduce((s, m) => s + m.amount, 0);
  const prevDayExits = movements.filter(m => m.type === "exit" && new Date(m.created_at) < todayStartComputed).reduce((s, m) => s + m.amount, 0);
  const closingBalanceDisplay = (openCash?.opening_balance || 0) + prevDayEntries - prevDayExits;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)] -mx-6 -mt-6 p-6 lg:p-10 gap-8 relative">
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-primary/15 rounded-full blur-[120px] mix-blend-screen opacity-30" />
      </div>

      <div className="relative z-10 w-full max-w-5xl mx-auto flex flex-col gap-6">
        {/* Header */}
        <header className="flex items-center gap-4">
          <button onClick={() => navigate("/admin/auditoria")} className="p-2 rounded-lg border border-white/10 hover:bg-white/5 transition-colors">
            <ArrowLeft className="size-5 text-white" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Controle de Caixa</h1>
            <p className="text-sm text-muted-foreground">Abertura, movimentações e fechamento diário</p>
          </div>
        </header>

        {!openCash ? (
          /* ── Open Cash ── */
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
                type="text"
                inputMode="decimal"
                value={openingBalanceInput}
                onChange={(e) => setOpeningBalanceInput(e.target.value)}
                placeholder="Ex: 11.522,06"
              />
            </div>
            <Button onClick={handleOpen} disabled={saving || !openingBalanceInput} className="gap-2">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <DoorOpen className="size-4" />}
              Abrir Caixa
            </Button>
          </div>
        ) : (
          /* ── Cash Open Dashboard ── */
          <div className="space-y-5">
            {/* Status bar */}
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <Clock className="size-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-emerald-400">Caixa Aberto</p>
                  <p className="text-xs text-muted-foreground">
                    Desde {formatDate(openCash.opened_at)} • Abertura: {formatCurrency(openCash.opening_balance || 0)}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs border-white/10 hover:bg-white/5"
                onClick={() => setShowFeeConfig(!showFeeConfig)}
              >
                <Percent className="size-3" />
                Taxa MP: {mpFeeRate.toFixed(2).replace(".", ",")}%
              </Button>
            </div>

            {/* Fee config */}
            {showFeeConfig && (
              <div className="bg-white/[0.03] border border-white/10 rounded-lg p-4 flex items-center gap-4">
                <Settings2 className="size-4 text-muted-foreground shrink-0" />
                <div className="flex items-center gap-2 flex-1">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">Taxa Mercado Pago (%)</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={mpFeeRate.toFixed(2).replace(".", ",")}
                    onChange={(e) => {
                      const val = parseBRL(e.target.value);
                      if (val >= 0 && val <= 10) setMpFeeRate(val);
                    }}
                    className="w-24"
                    placeholder="0,99"
                  />
                  <span className="text-xs text-muted-foreground">Aplicada automaticamente a cada venda</span>
                </div>
              </div>
            )}

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Banknote className="size-4 text-blue-400" />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Saldo Abertura</span>
                </div>
                <p className="text-lg font-bold text-white">{formatCurrency(openCash.opening_balance || 0)}</p>
              </div>
              <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowUpCircle className="size-4 text-emerald-400" />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Entradas</span>
                </div>
                <p className="text-lg font-bold text-emerald-400">+{formatCurrency(totalEntries)}</p>
              </div>
              <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowDownCircle className="size-4 text-red-400" />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Saídas</span>
                </div>
                <p className="text-lg font-bold text-red-400">-{formatCurrency(totalExits)}</p>
              </div>
              <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="size-4 text-primary" />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Saldo Atual</span>
                </div>
                <p className={`text-lg font-bold ${currentBalance >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {formatCurrency(currentBalance)}
                </p>
              </div>
            </div>

            {/* Add movement */}
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <PenLine className="size-4" />
                Registrar Movimento Manual
              </h3>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={newMovementType === "entry" ? "default" : "outline"}
                  onClick={() => setNewMovementType("entry")}
                  className={`gap-1.5 text-xs ${newMovementType === "entry" ? "bg-emerald-600 hover:bg-emerald-700" : "border-white/10 hover:bg-white/5"}`}
                >
                  <Plus className="size-3" /> Entrada
                </Button>
                <Button
                  size="sm"
                  variant={newMovementType === "exit" ? "default" : "outline"}
                  onClick={() => setNewMovementType("exit")}
                  className={`gap-1.5 text-xs ${newMovementType === "exit" ? "bg-red-600 hover:bg-red-700" : "border-white/10 hover:bg-white/5"}`}
                >
                  <Minus className="size-3" /> Saída
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-3 items-end">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={newMovementAmount}
                    onChange={(e) => setNewMovementAmount(e.target.value)}
                    placeholder="Ex: 150,00"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Descrição</Label>
                  <Input
                    type="text"
                    value={newMovementDesc}
                    onChange={(e) => setNewMovementDesc(e.target.value)}
                    placeholder="Ex: Compra de BM verificada, Retirada pessoal..."
                  />
                </div>
                <Button
                  onClick={handleAddMovement}
                  disabled={addingMovement || !newMovementAmount || !newMovementDesc.trim()}
                  className={`gap-1.5 ${newMovementType === "entry" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}
                >
                  {addingMovement ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  Registrar
                </Button>
              </div>
            </div>

            {/* Movements list */}
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="size-4" />
                Movimentações do Período
                <span className="text-xs font-normal text-muted-foreground ml-auto">
                  {movements.length} registro{movements.length !== 1 ? "s" : ""}
                </span>
              </h3>

              {movements.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nenhuma movimentação registrada ainda
                </p>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {movements.map((mov) => (
                    <div
                      key={mov.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border ${
                        mov.type === "entry"
                          ? "bg-emerald-500/5 border-emerald-500/15"
                          : "bg-red-500/5 border-red-500/15"
                      }`}
                    >
                      <div className={`p-1.5 rounded-md ${mov.type === "entry" ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                        {mov.type === "entry" ? (
                          <ArrowUpCircle className="size-4 text-emerald-400" />
                        ) : (
                          <ArrowDownCircle className="size-4 text-red-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{mov.description || "—"}</p>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span>{formatTime(mov.created_at)}</span>
                          {mov.source === "automatic" && (
                            <span className="flex items-center gap-0.5 text-blue-400">
                              <Zap className="size-3" /> Auto
                            </span>
                          )}
                          {mov.source === "manual" && (
                            <span className="flex items-center gap-0.5 text-amber-400">
                              <PenLine className="size-3" /> Manual
                            </span>
                          )}
                        </div>
                      </div>
                      <p className={`text-sm font-bold whitespace-nowrap ${
                        mov.type === "entry" ? "text-emerald-400" : "text-red-400"
                      }`}>
                        {mov.type === "entry" ? "+" : "-"}{formatCurrency(mov.amount)}
                      </p>
                      {mov.source === "manual" && (
                        <button
                          onClick={async () => {
                            if (!confirm("Excluir esta movimentação?")) return;
                            const { error } = await supabase.from("cash_movements").delete().eq("id", mov.id);
                            if (error) { toast.error("Erro ao excluir"); return; }
                            toast.success("Movimentação excluída!");
                            if (openCash) fetchMovements(openCash.id);
                          }}
                          className="p-1 hover:text-red-400 text-muted-foreground transition-colors"
                          title="Excluir movimentação"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Net result preview */}
            <div className={`rounded-xl p-4 border ${
              netChange >= 0 ? "bg-emerald-500/5 border-emerald-500/20" : "bg-red-500/5 border-red-500/20"
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {netChange >= 0 ? (
                    <TrendingUp className="size-5 text-emerald-400" />
                  ) : (
                    <TrendingDown className="size-5 text-red-400" />
                  )}
                  <span className="text-sm font-medium text-white">
                    {Math.abs(netChange) < 0.01
                      ? "Sem variação no período"
                      : netChange > 0
                        ? "Resultado positivo no período"
                        : "Resultado negativo no período"}
                  </span>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${netChange >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {netChange > 0 ? "+" : ""}{formatCurrency(netChange)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(openCash.opening_balance || 0)} → {formatCurrency(currentBalance)}
                  </p>
                </div>
              </div>
            </div>

            {/* Close section */}
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <DoorClosed className="size-4" />
                Fechar Caixa
              </h3>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  <FileText className="size-3 inline mr-1" />
                  Observações de fechamento (opcional)
                </Label>
                <Textarea
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder="Anotações do dia, justificativas..."
                  className="min-h-[50px] resize-none text-sm"
                />
              </div>
              <Button onClick={handleClose} disabled={saving} className="w-full gap-2 bg-red-600 hover:bg-red-700">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <DoorClosed className="size-4" />}
                Fechar Caixa • Saldo Final: {formatCurrency(closingBalanceDisplay)}
              </Button>
            </div>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white">Histórico de Caixas</h3>
            <div className="space-y-3">
              {history.map((record) => {
                const isExpanded = expandedHistoryId === record.id;
                const isOpen = record.status === "open";
                return (
                  <div key={record.id} className={`border rounded-xl overflow-hidden ${
                    isOpen ? "bg-amber-500/5 border-amber-500/20" : "bg-white/[0.03] border-white/10"
                  }`}>
                    <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => toggleHistoryExpand(record.id)}>
                        <div className={`p-2 rounded-lg shrink-0 ${
                          isOpen ? "bg-amber-500/10" : record.difference >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"
                        }`}>
                          {isOpen ? (
                            <DoorOpen className="size-4 text-amber-400" />
                          ) : record.difference >= 0 ? (
                            <CheckCircle2 className="size-4 text-emerald-400" />
                          ) : (
                            <AlertTriangle className="size-4 text-red-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-white">
                              {formatDate(record.opened_at)} → {record.closed_at ? formatDate(record.closed_at) : "—"}
                            </p>
                            {isOpen && (
                              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                Reaberto
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Abertura: {formatCurrency(record.opening_balance)} • Entradas: {formatCurrency(record.deposits)} • Saídas: {formatCurrency(record.withdrawals)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className={`text-sm font-bold ${
                            record.difference >= 0 ? "text-emerald-400" : "text-red-400"
                          }`}>
                            {record.difference > 0 ? "+" : ""}{formatCurrency(record.difference)}
                          </p>
                          {record.notes && (
                            <p className="text-xs text-muted-foreground mt-0.5 max-w-xs truncate">{record.notes}</p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-xs border-white/10 hover:bg-white/5"
                          onClick={() => toggleHistoryExpand(record.id)}
                        >
                          {isExpanded ? <ChevronUp className="size-3" /> : <Eye className="size-3" />}
                          {isExpanded ? "Fechar" : "Detalhes"}
                        </Button>
                        {!isOpen && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-xs border-white/10 hover:bg-white/5"
                            disabled={reopening}
                            onClick={() => handleReopen(record)}
                          >
                            {reopening ? <Loader2 className="size-3 animate-spin" /> : <RotateCcw className="size-3" />}
                            Reabrir
                          </Button>
                        )}
                        {isOpen && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                            disabled={saving}
                            onClick={() => handleCloseHistoryRecord(record)}
                          >
                            {saving ? <Loader2 className="size-3 animate-spin" /> : <DoorClosed className="size-3" />}
                            Fechar
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="border-t border-white/10 p-4 space-y-4">
                        {/* Add retroactive movement */}
                        <div className="bg-white/[0.03] border border-white/10 rounded-lg p-4 space-y-3">
                          <h4 className="text-xs font-bold text-white flex items-center gap-2">
                            <PenLine className="size-3" />
                            Lançamento Retroativo
                          </h4>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant={histRetroType === "entry" ? "default" : "outline"}
                              onClick={() => setHistRetroType("entry")}
                              className={`gap-1 text-xs ${histRetroType === "entry" ? "bg-emerald-600 hover:bg-emerald-700" : "border-white/10 hover:bg-white/5"}`}
                            >
                              <Plus className="size-3" /> Entrada
                            </Button>
                            <Button
                              size="sm"
                              variant={histRetroType === "exit" ? "default" : "outline"}
                              onClick={() => setHistRetroType("exit")}
                              className={`gap-1 text-xs ${histRetroType === "exit" ? "bg-red-600 hover:bg-red-700" : "border-white/10 hover:bg-white/5"}`}
                            >
                              <Minus className="size-3" /> Saída
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-2 items-end">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
                              <Input type="text" inputMode="decimal" value={histRetroAmount}
                                onChange={(e) => setHistRetroAmount(e.target.value)} placeholder="Ex: 150,00" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Descrição</Label>
                              <Input type="text" value={histRetroDesc}
                                onChange={(e) => setHistRetroDesc(e.target.value)} placeholder="Ex: Ajuste de valor..." />
                            </div>
                            <Button onClick={handleAddHistRetro}
                              disabled={addingHistRetro || !histRetroAmount || !histRetroDesc.trim()}
                              className={`gap-1 ${histRetroType === "entry" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}
                            >
                              {addingHistRetro ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                              Registrar
                            </Button>
                          </div>
                        </div>

                        {/* Movements list */}
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                          {historyMovements.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              Nenhuma movimentação registrada
                            </p>
                          ) : (
                            historyMovements.map((mov) => (
                              <div
                                key={mov.id}
                                className={`flex items-center gap-3 p-3 rounded-lg border ${
                                  mov.type === "entry"
                                    ? "bg-emerald-500/5 border-emerald-500/15"
                                    : "bg-red-500/5 border-red-500/15"
                                }`}
                              >
                                <div className={`p-1.5 rounded-md ${mov.type === "entry" ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                                  {mov.type === "entry" ? (
                                    <ArrowUpCircle className="size-4 text-emerald-400" />
                                  ) : (
                                    <ArrowDownCircle className="size-4 text-red-400" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-white truncate">{mov.description || "—"}</p>
                                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                    <span>{formatTime(mov.created_at)}</span>
                                    {mov.source === "automatic" && (
                                      <span className="flex items-center gap-0.5 text-blue-400">
                                        <Zap className="size-3" /> Auto
                                      </span>
                                    )}
                                    {mov.source === "manual" && (
                                      <span className="flex items-center gap-0.5 text-amber-400">
                                        <PenLine className="size-3" /> Manual
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <p className={`text-sm font-bold whitespace-nowrap ${
                                  mov.type === "entry" ? "text-emerald-400" : "text-red-400"
                                }`}>
                                  {mov.type === "entry" ? "+" : "-"}{formatCurrency(mov.amount)}
                                </p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
