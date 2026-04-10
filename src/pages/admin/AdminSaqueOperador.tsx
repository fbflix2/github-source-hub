import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Wallet, CheckCircle, XCircle, Clock, User, Flame, Search } from "lucide-react";

interface Withdrawal {
  id: string;
  user_id: string;
  amount: number;
  status: string | null;
  requested_at: string | null;
  approved_at: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string | null;
}

interface OperatorSummary {
  user_id: string;
  name: string;
  total_confirmed: number;
  total_frozen: number;
  total_cancelled: number;
  profile_count: number;
  balance: number;
  pix_key: string | null;
  pix_key_type: string | null;
  pix_bank: string | null;
  pix_holder_name: string | null;
}

export default function AdminSaqueOperador() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [operators, setOperators] = useState<OperatorSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"withdrawals" | "operators">("withdrawals");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load all withdrawals
      const { data: wds } = await supabase
        .from("operator_withdrawals")
        .select("*")
        .order("created_at", { ascending: false });

      // Load all operator financials
      const { data: fins } = await supabase
        .from("operator_financials")
        .select("*");

      // Load all earnings
      const { data: earns } = await supabase
        .from("operator_earnings")
        .select("*");

      // Load operator names
      const userIds = new Set<string>();
      fins?.forEach(f => userIds.add(f.user_id));
      earns?.forEach(e => userIds.add(e.user_id));
      wds?.forEach(w => userIds.add(w.user_id));

      const ids = Array.from(userIds);
      let nameMap: Record<string, string> = {};
      if (ids.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", ids);
        profiles?.forEach(p => { nameMap[p.user_id] = p.full_name || "Sem nome"; });
      }

      // Build operator summaries
      const opMap: Record<string, OperatorSummary> = {};
      fins?.forEach(f => {
        opMap[f.user_id] = {
          user_id: f.user_id,
          name: nameMap[f.user_id] || "Sem nome",
          total_confirmed: 0,
          total_frozen: 0,
          total_cancelled: 0,
          profile_count: 0,
          balance: f.balance || 0,
          pix_key: f.pix_key,
          pix_key_type: f.pix_key_type,
          pix_bank: f.pix_bank,
          pix_holder_name: f.pix_holder_name,
        };
      });

      earns?.forEach(e => {
        if (!opMap[e.user_id]) {
          opMap[e.user_id] = {
            user_id: e.user_id, name: nameMap[e.user_id] || "Sem nome",
            total_confirmed: 0, total_frozen: 0, total_cancelled: 0,
            profile_count: 0, balance: 0, pix_key: null, pix_key_type: null, pix_bank: null, pix_holder_name: null,
          };
        }
        opMap[e.user_id].profile_count++;
        if (e.status === "confirmed") opMap[e.user_id].total_confirmed += e.amount;
        else if (e.status === "frozen") opMap[e.user_id].total_frozen += e.amount;
        else if (e.status === "cancelled") opMap[e.user_id].total_cancelled += e.amount;
      });

      setWithdrawals(wds || []);
      setOperators(Object.values(opMap));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawal = async (id: string, action: "approved" | "rejected") => {
    setProcessing(id);
    try {
      const now = new Date().toISOString();
      const update: any = { status: action };
      if (action === "approved") {
        update.approved_at = now;
      }

      await supabase.from("operator_withdrawals").update(update).eq("id", id);

      // If approved, deduct balance
      if (action === "approved") {
        const wd = withdrawals.find(w => w.id === id);
        if (wd) {
          const { data: fin } = await supabase
            .from("operator_financials")
            .select("balance")
            .eq("user_id", wd.user_id)
            .maybeSingle();
          if (fin) {
            await supabase
              .from("operator_financials")
              .update({ balance: Math.max(0, (fin.balance || 0) - wd.amount) })
              .eq("user_id", wd.user_id);
          }
        }
      }

      toast.success(action === "approved" ? "Saque aprovado!" : "Saque rejeitado");
      loadData();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao processar saque");
    } finally {
      setProcessing(null);
    }
  };

  const getOperatorName = (userId: string) => {
    return operators.find(o => o.user_id === userId)?.name || "Operador";
  };

  const pendingCount = withdrawals.filter(w => w.status === "pending").length;
  const approvedTotal = withdrawals.filter(w => w.status === "approved").reduce((s, w) => s + w.amount, 0);

  const filteredWithdrawals = withdrawals.filter(w => {
    if (!search.trim()) return true;
    const name = getOperatorName(w.user_id).toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const filteredOperators = operators.filter(o => {
    if (!search.trim()) return true;
    return o.name.toLowerCase().includes(search.toLowerCase());
  });

  if (loading) {
    return (
      <main className="flex-1 px-6 md:px-12 lg:px-40 py-10 max-w-[1200px] mx-auto w-full">
        <div className="flex items-center gap-3 mb-6">
          <Wallet className="text-primary size-6" />
          <h2 className="text-xl font-bold">Saque Operador</h2>
        </div>
        <div className="text-center py-20 text-muted-foreground text-sm">Carregando...</div>
      </main>
    );
  }

  return (
    <main className="flex-1 px-6 md:px-12 lg:px-40 py-10 max-w-[1200px] mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Wallet className="text-primary size-6" />
        <div>
          <h2 className="text-xl font-bold">Saque Operador</h2>
          <p className="text-sm text-muted-foreground">Gerencie solicitações de saque dos operadores de aquecimento</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 p-4">
          <p className="text-[11px] text-muted-foreground uppercase tracking-widest mb-1">Operadores</p>
          <p className="text-2xl font-black">{operators.length}</p>
        </div>
        <div className="bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 p-4">
          <p className="text-[11px] text-muted-foreground uppercase tracking-widest mb-1">Saques Pendentes</p>
          <p className="text-2xl font-black text-amber-500">{pendingCount}</p>
        </div>
        <div className="bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 p-4">
          <p className="text-[11px] text-muted-foreground uppercase tracking-widest mb-1">Total Aprovado</p>
          <p className="text-2xl font-black text-emerald-500">R$ {approvedTotal.toFixed(2)}</p>
        </div>
        <div className="bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 p-4">
          <p className="text-[11px] text-muted-foreground uppercase tracking-widest mb-1">Perfis Validados</p>
          <p className="text-2xl font-black text-blue-500">{operators.reduce((s, o) => s + o.profile_count, 0)}</p>
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => setTab("withdrawals")}
            className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all ${
              tab === "withdrawals"
                ? "bg-primary/20 border-primary/40 text-primary"
                : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
            }`}
          >
            Solicitações de Saque
            {pendingCount > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px]">{pendingCount}</span>
            )}
          </button>
          <button
            onClick={() => setTab("operators")}
            className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all ${
              tab === "operators"
                ? "bg-primary/20 border-primary/40 text-primary"
                : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
            }`}
          >
            Resumo Operadores
          </button>
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar operador..."
            className="w-full bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Withdrawals Tab */}
      {tab === "withdrawals" && (
        <div className="space-y-2">
          {filteredWithdrawals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Wallet className="size-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma solicitação de saque encontrada</p>
            </div>
          ) : (
            filteredWithdrawals.map((wd) => (
              <div
                key={wd.id}
                className="bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 p-4 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    wd.status === "pending" ? "bg-amber-500/10" :
                    wd.status === "approved" ? "bg-emerald-500/10" :
                    "bg-red-500/10"
                  }`}>
                    {wd.status === "pending" ? <Clock className="text-amber-500 size-5" /> :
                     wd.status === "approved" ? <CheckCircle className="text-emerald-500 size-5" /> :
                     <XCircle className="text-red-500 size-5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{getOperatorName(wd.user_id)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {wd.requested_at ? new Date(wd.requested_at).toLocaleDateString("pt-BR") : 
                       wd.created_at ? new Date(wd.created_at).toLocaleDateString("pt-BR") : "—"}
                      {wd.notes && ` · ${wd.notes}`}
                    </p>
                  </div>
                </div>

                <p className="text-lg font-black text-emerald-500 shrink-0">R$ {wd.amount.toFixed(2)}</p>

                {wd.status === "pending" ? (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleWithdrawal(wd.id, "approved")}
                      disabled={processing === wd.id}
                      className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-xs font-bold transition-all"
                    >
                      <CheckCircle className="size-3.5" /> Aprovar
                    </button>
                    <button
                      onClick={() => handleWithdrawal(wd.id, "rejected")}
                      disabled={processing === wd.id}
                      className="flex items-center gap-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-xs font-bold transition-all"
                    >
                      <XCircle className="size-3.5" /> Rejeitar
                    </button>
                  </div>
                ) : (
                  <span className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 ${
                    wd.status === "approved" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                  }`}>
                    {wd.status === "approved" ? "Aprovado" : "Rejeitado"}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Operators Tab */}
      {tab === "operators" && (
        <div className="space-y-2">
          {filteredOperators.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <User className="size-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum operador encontrado</p>
            </div>
          ) : (
            filteredOperators.map((op) => (
              <div
                key={op.user_id}
                className="bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 p-4"
              >
                <div className="flex items-center justify-between gap-4 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="text-primary size-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{op.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {op.profile_count} perfis · Saldo: R$ {op.balance.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  {op.pix_key && (
                    <div className="text-right text-[11px] text-muted-foreground shrink-0">
                      <p className="font-bold text-foreground">{op.pix_holder_name || "—"}</p>
                      <p>PIX: {op.pix_key} ({op.pix_key_type})</p>
                      {op.pix_bank && <p>{op.pix_bank}</p>}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-emerald-500/5 rounded-lg p-2 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase">Confirmado</p>
                    <p className="text-sm font-black text-emerald-500">R$ {op.total_confirmed.toFixed(2)}</p>
                  </div>
                  <div className="bg-blue-500/5 rounded-lg p-2 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase">Congelado</p>
                    <p className="text-sm font-black text-blue-400">R$ {op.total_frozen.toFixed(2)}</p>
                  </div>
                  <div className="bg-red-500/5 rounded-lg p-2 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase">Cancelado</p>
                    <p className="text-sm font-black text-red-400">R$ {op.total_cancelled.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </main>
  );
}
