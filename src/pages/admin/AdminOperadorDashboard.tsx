import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Flame,
  Calendar,
  Lightbulb,
  Trophy,
  Target,
  Clock,
  Snowflake,
  XCircle,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

interface ProfileRecord {
  id: string;
  profile_code: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface EarningRecord {
  id: string;
  profile_id: string;
  profile_code: string;
  amount: number;
  status: string;
  created_at: string;
  confirmed_at: string | null;
  frozen_at: string | null;
  cancelled_at: string | null;
}

interface DayStats {
  date: string;
  label: string;
  total: number;
  completed: number;
  checkpoints: number;
  cancelled: number;
}

export default function AdminOperadorDashboard() {
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<ProfileRecord[]>([]);
  const [earnings, setEarnings] = useState<EarningRecord[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [profilesRes, earningsRes] = await Promise.all([
        supabase
          .from("warming_profiles" as any)
          .select("id, profile_code, status, created_at, updated_at")
          .eq("created_by", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("operator_earnings")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      setProfiles((profilesRes.data || []) as any);
      setEarnings((earningsRes.data || []) as EarningRecord[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // KPIs
  const totalProfiles = profiles.length;
  const activeProfiles = profiles.filter(p => p.status === "active").length;
  const completedProfiles = profiles.filter(p => p.status === "completed").length;
  const checkpointProfiles = profiles.filter(p => p.status === "checkpoint").length;
  const blockedProfiles = profiles.filter(p => ["blocked", "restricted", "disabled"].includes(p.status)).length;

  const confirmedEarnings = earnings.filter(e => e.status === "confirmed").reduce((s, e) => s + Number(e.amount), 0);
  const pendingEarnings = earnings.filter(e => e.status === "pending").reduce((s, e) => s + Number(e.amount), 0);
  const frozenEarnings = earnings.filter(e => e.status === "frozen").reduce((s, e) => s + Number(e.amount), 0);

  // Success rate
  const finishedProfiles = completedProfiles + blockedProfiles;
  const successRate = finishedProfiles > 0 ? Math.round((completedProfiles / finishedProfiles) * 100) : 0;

  // Daily breakdown (last 30 days)
  const dailyStats = useMemo(() => {
    const days: DayStats[] = [];
    const now = new Date();

    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

      const dayProfiles = profiles.filter(p => p.created_at.slice(0, 10) === dateStr);
      const dayCompleted = profiles.filter(
        p => p.status === "completed" && p.updated_at?.slice(0, 10) === dateStr
      );
      const dayCheckpoints = profiles.filter(
        p => p.status === "checkpoint" && p.updated_at?.slice(0, 10) === dateStr
      );
      const dayCancelled = profiles.filter(
        p => ["blocked", "restricted", "disabled"].includes(p.status) && p.updated_at?.slice(0, 10) === dateStr
      );

      days.push({
        date: dateStr,
        label,
        total: dayProfiles.length,
        completed: dayCompleted.length,
        checkpoints: dayCheckpoints.length,
        cancelled: dayCancelled.length,
      });
    }
    return days;
  }, [profiles]);

  // Best and worst days
  const bestDay = useMemo(() => {
    const withActivity = dailyStats.filter(d => d.total > 0 || d.completed > 0);
    if (withActivity.length === 0) return null;
    return withActivity.reduce((best, d) => (d.completed > best.completed ? d : best), withActivity[0]);
  }, [dailyStats]);

  const worstCheckpointDay = useMemo(() => {
    const withCheckpoints = dailyStats.filter(d => d.checkpoints > 0);
    if (withCheckpoints.length === 0) return null;
    return withCheckpoints.reduce((worst, d) => (d.checkpoints > worst.checkpoints ? d : worst), withCheckpoints[0]);
  }, [dailyStats]);

  // Max value for chart scaling
  const maxDayValue = useMemo(() => {
    return Math.max(1, ...dailyStats.map(d => Math.max(d.total, d.completed, d.checkpoints)));
  }, [dailyStats]);

  // Last 7 days vs previous 7 days comparison
  const last7 = dailyStats.slice(-7);
  const prev7 = dailyStats.slice(-14, -7);
  const last7Total = last7.reduce((s, d) => s + d.total, 0);
  const prev7Total = prev7.reduce((s, d) => s + d.total, 0);
  const trend = last7Total - prev7Total;

  // Performance tips based on data
  const tips = useMemo(() => {
    const result: { icon: any; text: string; type: "success" | "warning" | "info" }[] = [];

    if (successRate >= 90) {
      result.push({ icon: Trophy, text: "Excelente taxa de aprovação! Continue mantendo a qualidade no aquecimento.", type: "success" });
    } else if (successRate >= 70) {
      result.push({ icon: Target, text: "Boa taxa de aprovação. Foque em completar todas as tarefas diárias para subir ainda mais.", type: "info" });
    } else if (successRate > 0) {
      result.push({ icon: AlertTriangle, text: "Sua taxa de aprovação está abaixo de 70%. Revise o processo de aquecimento e siga todas as etapas cuidadosamente.", type: "warning" });
    }

    if (checkpointProfiles > 3) {
      result.push({ icon: Snowflake, text: "Você tem vários perfis em checkpoint. Evite ações repetitivas e diversifique as interações durante o aquecimento.", type: "warning" });
    }

    if (trend > 0) {
      result.push({ icon: TrendingUp, text: `Seu volume cresceu ${trend} perfis comparado à semana anterior. Ótimo ritmo!`, type: "success" });
    } else if (trend < 0) {
      result.push({ icon: TrendingUp, text: "Seu volume caiu em relação à semana anterior. Tente manter um ritmo consistente para maximizar ganhos.", type: "info" });
    }

    if (blockedProfiles > 0 && totalProfiles > 0) {
      const blockRate = Math.round((blockedProfiles / totalProfiles) * 100);
      if (blockRate > 15) {
        result.push({ icon: XCircle, text: `${blockRate}% dos seus perfis foram bloqueados. Redobre a atenção nas etapas iniciais do aquecimento e evite ações em massa.`, type: "warning" });
      }
    }

    if (activeProfiles > 10) {
      result.push({ icon: Clock, text: "Você tem muitos perfis ativos simultâneos. Foque em completar os atuais antes de iniciar novos para melhorar a qualidade.", type: "info" });
    }

    if (result.length === 0) {
      result.push({ icon: Lightbulb, text: "Continue realizando o aquecimento com atenção aos detalhes. Cada perfil bem aquecido conta para seus ganhos!", type: "info" });
    }

    return result;
  }, [successRate, checkpointProfiles, trend, blockedProfiles, totalProfiles, activeProfiles]);

  const fmtBRL = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-10 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
        <BarChart3 className="text-primary size-7" />
        Meu Desempenho
      </h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={Flame} label="Total Perfis" value={totalProfiles} color="text-orange-400" />
        <KpiCard icon={CheckCircle} label="Aprovados" value={completedProfiles} color="text-green-400" />
        <KpiCard icon={Snowflake} label="Checkpoint" value={checkpointProfiles} color="text-yellow-400" />
        <KpiCard icon={Target} label="Taxa Aprovação" value={`${successRate}%`} color="text-blue-400" />
      </div>

      {/* Earnings Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Ganhos Confirmados</p>
          <p className="text-xl font-black text-green-400">{fmtBRL(confirmedEarnings)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Em Andamento</p>
          <p className="text-xl font-black text-blue-400">{fmtBRL(pendingEarnings)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Congelado</p>
          <p className="text-xl font-black text-yellow-400">{fmtBRL(frozenEarnings)}</p>
        </div>
      </div>

      {/* Weekly Trend */}
      <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-4">
        <div className={`rounded-full p-2 ${trend >= 0 ? "bg-green-500/10" : "bg-red-500/10"}`}>
          {trend >= 0 ? <ArrowUp className="size-5 text-green-400" /> : <ArrowDown className="size-5 text-red-400" />}
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">Tendência Semanal</p>
          <p className="text-xs text-muted-foreground">
            {trend >= 0 ? `+${trend}` : trend} perfis comparado à semana anterior · Últimos 7 dias: {last7Total} perfis
          </p>
        </div>
      </div>

      {/* Chart - Last 30 days */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-muted-foreground" />
          <h2 className="text-base font-bold text-foreground">Atividade nos Últimos 30 Dias</h2>
        </div>

        {/* Legend */}
        <div className="flex gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-primary" /> Cadastrados</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-500" /> Aprovados</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-yellow-500" /> Checkpoint</span>
        </div>

        {/* Bar Chart */}
        <div className="flex items-end gap-[3px] h-36 overflow-x-auto pb-1">
          {dailyStats.map((d) => {
            const totalH = (d.total / maxDayValue) * 100;
            const completedH = (d.completed / maxDayValue) * 100;
            const checkpointH = (d.checkpoints / maxDayValue) * 100;
            const hasActivity = d.total > 0 || d.completed > 0 || d.checkpoints > 0;

            return (
              <div key={d.date} className="flex flex-col items-center gap-1 min-w-[18px] group relative">
                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                  <div className="bg-popover border border-border rounded-lg px-3 py-2 text-[10px] shadow-lg whitespace-nowrap space-y-0.5">
                    <p className="font-bold text-foreground">{d.label}</p>
                    <p className="text-muted-foreground">Cadastrados: {d.total}</p>
                    <p className="text-green-400">Aprovados: {d.completed}</p>
                    <p className="text-yellow-400">Checkpoint: {d.checkpoints}</p>
                  </div>
                </div>

                <div className="flex items-end gap-px h-28">
                  <div
                    className="w-[5px] rounded-t bg-primary/80 transition-all"
                    style={{ height: `${Math.max(hasActivity ? 2 : 0, totalH)}%` }}
                  />
                  <div
                    className="w-[5px] rounded-t bg-green-500/80 transition-all"
                    style={{ height: `${Math.max(d.completed > 0 ? 2 : 0, completedH)}%` }}
                  />
                  <div
                    className="w-[5px] rounded-t bg-yellow-500/80 transition-all"
                    style={{ height: `${Math.max(d.checkpoints > 0 ? 2 : 0, checkpointH)}%` }}
                  />
                </div>
                <span className="text-[8px] text-muted-foreground/50 rotate-[-45deg] origin-top-left w-0 whitespace-nowrap">
                  {d.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Best & Worst Days */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {bestDay && bestDay.completed > 0 && (
          <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-5 flex items-center gap-4">
            <Trophy className="size-8 text-green-400 shrink-0" />
            <div>
              <p className="text-sm font-bold text-foreground">Melhor Dia</p>
              <p className="text-xs text-muted-foreground">
                <strong className="text-green-400">{bestDay.label}</strong> — {bestDay.completed} perfil(is) aprovado(s)
              </p>
            </div>
          </div>
        )}
        {worstCheckpointDay && (
          <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-5 flex items-center gap-4">
            <AlertTriangle className="size-8 text-yellow-400 shrink-0" />
            <div>
              <p className="text-sm font-bold text-foreground">Dia com Mais Checkpoints</p>
              <p className="text-xs text-muted-foreground">
                <strong className="text-yellow-400">{worstCheckpointDay.label}</strong> — {worstCheckpointDay.checkpoints} checkpoint(s)
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="size-5 text-primary" />
          <h2 className="text-base font-bold text-foreground">Dicas para Melhorar seu Desempenho</h2>
        </div>
        <div className="space-y-2">
          {tips.map((tip, i) => {
            const Icon = tip.icon;
            const borderColor = tip.type === "success" ? "border-green-500/20 bg-green-500/5" : tip.type === "warning" ? "border-yellow-500/20 bg-yellow-500/5" : "border-blue-500/20 bg-blue-500/5";
            const iconColor = tip.type === "success" ? "text-green-400" : tip.type === "warning" ? "text-yellow-400" : "text-blue-400";
            return (
              <div key={i} className={`flex items-start gap-3 rounded-lg border ${borderColor} p-4`}>
                <Icon className={`size-5 mt-0.5 shrink-0 ${iconColor}`} />
                <p className="text-sm text-foreground/80 leading-relaxed">{tip.text}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`size-4 ${color}`} />
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{label}</p>
      </div>
      <p className={`text-xl font-black ${color}`}>{value}</p>
    </div>
  );
}
