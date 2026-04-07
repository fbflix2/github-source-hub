import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  WarmingProfile, WarmingTask, OperatorStats, OperatorGoal,
  formatDuration, MIcon, TRACKS
} from "./WarmingTypes";

interface Props {
  profiles: WarmingProfile[];
  tasks: Record<string, WarmingTask[]>;
  creatorNames: Record<string, string>;
  onRefresh: () => void;
}

export default function WarmingOperatorDashboard({ profiles, tasks, creatorNames, onRefresh }: Props) {
  const [selectedOperator, setSelectedOperator] = useState<string>("all");
  const [goals, setGoals] = useState<OperatorGoal[]>([]);
  const [editingGoal, setEditingGoal] = useState<{ operatorId: string; type: string; value: number } | null>(null);
  const [savingGoal, setSavingGoal] = useState(false);
  const [timePeriod, setTimePeriod] = useState<"7d" | "30d" | "all">("30d");

  const [teamOperators, setTeamOperators] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetchGoals();
    fetchTeamOperators();
  }, []);

  const fetchTeamOperators = async () => {
    // Fetch all moderators from user_roles so they appear even without warming profiles
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "moderator");
    if (!roles || roles.length === 0) return;
    const userIds = roles.map(r => r.user_id);
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", userIds);
    if (profs) {
      setTeamOperators(profs.map(p => ({ id: p.user_id, name: p.full_name || "Sem nome" })));
    }
  };

  const fetchGoals = async () => {
    const { data } = await supabase
      .from("warming_operator_goals")
      .select("*")
      .eq("active", true);
    if (data) setGoals(data as OperatorGoal[]);
  };

  const saveGoal = async (operatorId: string, goalType: string, target: number) => {
    setSavingGoal(true);
    const existing = goals.find(g => g.operator_id === operatorId && g.goal_type === goalType);
    if (existing) {
      await supabase.from("warming_operator_goals").update({ target_profiles: target }).eq("id", existing.id);
    } else {
      await supabase.from("warming_operator_goals").insert({
        operator_id: operatorId,
        goal_type: goalType,
        target_profiles: target,
      });
    }
    toast.success("Meta salva!");
    fetchGoals();
    setEditingGoal(null);
    setSavingGoal(false);
  };

  // Get unique operators - merge team moderators with profile creators
  const operators = useMemo(() => {
    const profileCreatorIds = [...new Set(profiles.map(p => p.created_by).filter(Boolean))] as string[];
    const profileCreators = profileCreatorIds.map(id => ({ id, name: creatorNames[id] || "Sem nome" }));
    
    // Merge: team operators + any profile creators not already in team
    const mergedMap = new Map<string, { id: string; name: string }>();
    teamOperators.forEach(op => mergedMap.set(op.id, op));
    profileCreators.forEach(op => { if (!mergedMap.has(op.id)) mergedMap.set(op.id, op); });
    
    return Array.from(mergedMap.values());
  }, [profiles, creatorNames, teamOperators]);

  // Filter profiles by time period
  const filteredProfiles = useMemo(() => {
    const now = Date.now();
    const cutoff = timePeriod === "7d" ? now - 7 * 86400000
      : timePeriod === "30d" ? now - 30 * 86400000
      : 0;
    return profiles.filter(p => new Date(p.created_at).getTime() >= cutoff);
  }, [profiles, timePeriod]);

  // Calculate operator stats
  const operatorStats: OperatorStats[] = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = todayStart - (now.getDay() * 86400000);

    return operators.map(op => {
      const opProfiles = filteredProfiles.filter(p => p.created_by === op.id);
      const allOpProfiles = profiles.filter(p => p.created_by === op.id);
      
      let totalTaskTime = 0;
      let totalTasks = 0;
      const profilesWithTime = new Set<string>();
      opProfiles.forEach(p => {
        const profileTasks = tasks[p.id] || [];
        profileTasks.forEach(t => {
          if (t.duration_seconds) {
            totalTaskTime += t.duration_seconds;
            totalTasks++;
            profilesWithTime.add(p.id);
          }
        });
      });

      const dailyGoalObj = goals.find(g => g.operator_id === op.id && g.goal_type === "daily");
      const weeklyGoalObj = goals.find(g => g.operator_id === op.id && g.goal_type === "weekly");

      // Count unique profiles that had tasks completed today/this week
      const profilesWorkedToday = new Set<string>();
      const profilesWorkedThisWeek = new Set<string>();
      allOpProfiles.forEach(p => {
        const profileTasks = tasks[p.id] || [];
        profileTasks.forEach(t => {
          if (t.completed && t.completed_at) {
            const completedTime = new Date(t.completed_at).getTime();
            if (completedTime >= todayStart) profilesWorkedToday.add(p.id);
            if (completedTime >= weekStart) profilesWorkedThisWeek.add(p.id);
          }
        });
      });

      return {
        operatorId: op.id,
        operatorName: op.name,
        totalProfiles: opProfiles.length,
        activeProfiles: opProfiles.filter(p => p.status === "active").length,
        completedProfiles: opProfiles.filter(p => p.status === "completed").length,
        restrictedProfiles: opProfiles.filter(p => p.status === "restricted").length,
        checkpointProfiles: opProfiles.filter(p => p.status === "checkpoint").length,
        totalTaskTime,
        avgTimePerProfile: profilesWithTime.size > 0 ? Math.round(totalTaskTime / profilesWithTime.size) : 0,
        avgTimePerTask: totalTasks > 0 ? Math.round(totalTaskTime / totalTasks) : 0,
        profilesToday: profilesWorkedToday.size,
        profilesThisWeek: profilesWorkedThisWeek.size,
        dailyGoal: dailyGoalObj?.target_profiles ?? null,
        weeklyGoal: weeklyGoalObj?.target_profiles ?? null,
      };
    });
  }, [operators, filteredProfiles, profiles, tasks, goals]);

  // Selected operator stats or aggregate
  const displayStats = useMemo(() => {
    if (selectedOperator === "all") {
      const agg: OperatorStats = {
        operatorId: "all",
        operatorName: "Todos os Operadores",
        totalProfiles: filteredProfiles.length,
        activeProfiles: filteredProfiles.filter(p => p.status === "active").length,
        completedProfiles: filteredProfiles.filter(p => p.status === "completed").length,
        restrictedProfiles: filteredProfiles.filter(p => p.status === "restricted").length,
        checkpointProfiles: filteredProfiles.filter(p => p.status === "checkpoint").length,
        totalTaskTime: operatorStats.reduce((a, s) => a + s.totalTaskTime, 0),
        avgTimePerProfile: 0,
        avgTimePerTask: 0,
        profilesToday: operatorStats.reduce((a, s) => a + s.profilesToday, 0),
        profilesThisWeek: operatorStats.reduce((a, s) => a + s.profilesThisWeek, 0),
        dailyGoal: null,
        weeklyGoal: null,
      };
      const allTasksWithTime = Object.values(tasks).flat().filter(t => t.duration_seconds);
      const totalTasks = allTasksWithTime.length;
      const profilesWithTimeAgg = new Set<string>();
      Object.entries(tasks).forEach(([profileId, profileTasks]) => {
        if (profileTasks.some(t => t.duration_seconds)) profilesWithTimeAgg.add(profileId);
      });
      agg.avgTimePerProfile = profilesWithTimeAgg.size > 0 ? Math.round(agg.totalTaskTime / profilesWithTimeAgg.size) : 0;
      agg.avgTimePerTask = totalTasks > 0 ? Math.round(agg.totalTaskTime / totalTasks) : 0;
      return agg;
    }
    return operatorStats.find(s => s.operatorId === selectedOperator) || null;
  }, [selectedOperator, filteredProfiles, operatorStats, tasks]);

  // Track time analysis
  const trackAnalysis = useMemo(() => {
    const targetProfiles = selectedOperator === "all" 
      ? filteredProfiles 
      : filteredProfiles.filter(p => p.created_by === selectedOperator);

    return Object.entries(TRACKS).map(([key, track]) => {
      const trackProfiles = targetProfiles.filter(p => p.track_type === key);
      let totalTime = 0;
      let taskCount = 0;
      const profilesWorked = new Set<string>();
      trackProfiles.forEach(p => {
        (tasks[p.id] || []).forEach(t => {
          if (t.duration_seconds) { totalTime += t.duration_seconds; taskCount++; profilesWorked.add(p.id); }
        });
      });
      return {
        key,
        label: track.label,
        profileCount: trackProfiles.length,
        completedCount: trackProfiles.filter(p => p.status === "completed").length,
        avgTime: profilesWorked.size > 0 ? Math.round(totalTime / profilesWorked.size) : 0,
        avgTaskTime: taskCount > 0 ? Math.round(totalTime / taskCount) : 0,
        totalTime,
      };
    });
  }, [filteredProfiles, selectedOperator, tasks]);

  // Per-task time breakdown for selected operator
  const taskTimeBreakdown = useMemo(() => {
    const targetProfiles = selectedOperator === "all"
      ? filteredProfiles
      : filteredProfiles.filter(p => p.created_by === selectedOperator);

    const taskMap: Record<number, { totalTime: number; count: number; title: string }> = {};
    targetProfiles.forEach(p => {
      (tasks[p.id] || []).forEach(t => {
        if (t.duration_seconds && t.duration_seconds > 0) {
          if (!taskMap[t.day_number]) taskMap[t.day_number] = { totalTime: 0, count: 0, title: t.title };
          taskMap[t.day_number].totalTime += t.duration_seconds;
          taskMap[t.day_number].count++;
        }
      });
    });

    return Object.entries(taskMap)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([day, data]) => ({
        day: Number(day),
        title: data.title,
        avgTime: Math.round(data.totalTime / data.count),
        totalTime: data.totalTime,
        executions: data.count,
      }));
  }, [filteredProfiles, selectedOperator, tasks]);

  const maxTaskTime = Math.max(...taskTimeBreakdown.map(t => t.avgTime), 1);

  return (
    <main className="flex-1 px-6 md:px-12 lg:px-40 py-10 max-w-[1200px] mx-auto w-full space-y-8">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <MIcon name="person_search" className="text-slate-400" />
          <select
            className="bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg px-4 py-2 text-sm font-medium dark:text-white focus:ring-2 focus:ring-slate-400/20"
            value={selectedOperator}
            onChange={e => setSelectedOperator(e.target.value)}
          >
            <option value="all">Todos os Operadores</option>
            {operators.map(op => (
              <option key={op.id} value={op.id}>{op.name}</option>
            ))}
          </select>
        </div>
        <div className="flex bg-slate-100 dark:bg-white/10 p-1 rounded-lg">
          {([["7d", "7 dias"], ["30d", "30 dias"], ["all", "Todo período"]] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setTimePeriod(val)}
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
                timePeriod === val ? "bg-white dark:bg-white/20 shadow-sm" : "text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button onClick={onRefresh} className="ml-auto flex items-center gap-1 text-sm font-bold text-slate-500 dark:text-white/50 hover:text-slate-700 dark:hover:text-white/70">
          <MIcon name="refresh" className="text-base" /> Atualizar
        </button>
      </div>

      {/* KPI Cards */}
      {displayStats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
          {[
            { label: "Total Perfis", value: displayStats.totalProfiles, icon: "group", color: "text-[#1876f2]" },
            { label: "Em Aquecimento", value: displayStats.activeProfiles, icon: "local_fire_department", color: "text-amber-500" },
            { label: "Concluídos", value: displayStats.completedProfiles, icon: "check_circle", color: "text-emerald-500" },
            { label: "Checkpoint", value: displayStats.checkpointProfiles, icon: "pause_circle", color: "text-yellow-500" },
            { label: "Restrições", value: displayStats.restrictedProfiles, icon: "block", color: "text-rose-500" },
            { label: "Perfis Hoje", value: displayStats.profilesToday, icon: "today", color: "text-purple-500" },
            { label: "Perfis Semana", value: displayStats.profilesThisWeek, icon: "date_range", color: "text-indigo-500" },
          ].map(kpi => (
            <div key={kpi.label} className="bg-white dark:bg-white/5 p-4 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <p className="text-slate-500 dark:text-white/50 text-[11px] font-medium">{kpi.label}</p>
                <MIcon name={kpi.icon} className={`text-base ${kpi.color}`} />
              </div>
              <p className="text-2xl font-black dark:text-white">{kpi.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Time Metrics */}
      {displayStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-white/5 p-5 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <MIcon name="timer" className="text-[#1876f2]" />
              <p className="text-sm font-bold text-slate-700 dark:text-white/70">Tempo Total Operador</p>
            </div>
            <p className="text-3xl font-black dark:text-white">{formatDuration(displayStats.totalTaskTime)}</p>
            <p className="text-xs text-slate-400 dark:text-white/40 mt-1">Soma de todas as tarefas executadas</p>
          </div>
          <div className="bg-white dark:bg-white/5 p-5 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <MIcon name="speed" className="text-amber-500" />
              <p className="text-sm font-bold text-slate-700 dark:text-white/70">Tempo Médio / Perfil</p>
            </div>
            <p className="text-3xl font-black dark:text-white">{formatDuration(displayStats.avgTimePerProfile)}</p>
            <p className="text-xs text-slate-400 dark:text-white/40 mt-1">Média de tempo gasto por perfil</p>
          </div>
          <div className="bg-white dark:bg-white/5 p-5 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <MIcon name="avg_pace" className="text-emerald-500" />
              <p className="text-sm font-bold text-slate-700 dark:text-white/70">Tempo Médio / Tarefa</p>
            </div>
            <p className="text-3xl font-black dark:text-white">{formatDuration(displayStats.avgTimePerTask)}</p>
            <p className="text-xs text-slate-400 dark:text-white/40 mt-1">Média de execução por tarefa</p>
          </div>
        </div>
      )}

      {/* Operator Ranking & Goals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Operator Ranking */}
        <div className="bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-white/10">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <MIcon name="leaderboard" className="text-[#1876f2]" />
              Ranking de Operadores
            </h3>
            <p className="text-xs text-slate-500 dark:text-white/50 mt-0.5">Performance por volume e velocidade</p>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-white/10">
            {operatorStats
              .sort((a, b) => b.totalProfiles - a.totalProfiles)
              .map((op, i) => {
                const successRate = op.totalProfiles > 0
                  ? Math.round((op.completedProfiles / op.totalProfiles) * 100) : 0;
                return (
                  <div key={op.operatorId} className="p-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        i === 0 ? "bg-amber-100 text-amber-700" :
                        i === 1 ? "bg-slate-200 text-slate-600" :
                        i === 2 ? "bg-orange-100 text-orange-700" :
                        "bg-slate-100 text-slate-500"
                      }`}>
                        {i + 1}º
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold dark:text-white truncate">{op.operatorName}</p>
                        <p className="text-[11px] text-slate-500">
                          {op.totalProfiles} perfis • {successRate}% sucesso • Avg {formatDuration(op.avgTimePerProfile)}/perfil
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold dark:text-white">{op.profilesToday} hoje</p>
                        <p className="text-[10px] text-slate-400 dark:text-white/40">{op.profilesThisWeek} semana</p>
                      </div>
                    </div>
                    {/* Goal progress */}
                    {op.dailyGoal && (
                      <div className="mt-2 ml-11">
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-slate-500">Meta diária: {op.profilesToday}/{op.dailyGoal}</span>
                          <span className="font-bold text-slate-700">{Math.min(100, Math.round((op.profilesToday / op.dailyGoal) * 100))}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              op.profilesToday >= op.dailyGoal ? "bg-emerald-500" : "bg-[#1876f2]"
                            }`}
                            style={{ width: `${Math.min(100, (op.profilesToday / op.dailyGoal) * 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            {operatorStats.length === 0 && (
              <div className="p-6 text-center text-slate-400 dark:text-white/40 text-sm">Nenhum operador encontrado</div>
            )}
          </div>
        </div>

        {/* Goals Management */}
        <div className="bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-white/10">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <MIcon name="flag" className="text-emerald-500" />
              Metas dos Operadores
            </h3>
            <p className="text-xs text-slate-500 dark:text-white/50 mt-0.5">Defina metas diárias e semanais por operador</p>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-white/10">
            {operators.map(op => {
              const dailyGoal = goals.find(g => g.operator_id === op.id && g.goal_type === "daily");
              const weeklyGoal = goals.find(g => g.operator_id === op.id && g.goal_type === "weekly");
              const stats = operatorStats.find(s => s.operatorId === op.id);

              return (
                <div key={op.id} className="p-4">
                  <p className="text-sm font-bold dark:text-white mb-3">{op.name}</p>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Daily goal */}
                    <div className="bg-slate-50 dark:bg-white/5 rounded-lg p-3">
                      <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Meta Diária</p>
                      {editingGoal?.operatorId === op.id && editingGoal.type === "daily" ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            className="w-16 bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded px-2 py-1 text-sm text-slate-900"
                            value={editingGoal.value}
                            onChange={e => setEditingGoal({ ...editingGoal, value: Number(e.target.value) })}
                          />
                          <button
                            onClick={() => saveGoal(op.id, "daily", editingGoal.value)}
                            disabled={savingGoal}
                            className="text-emerald-600 hover:text-emerald-700"
                          >
                            <MIcon name="check" className="text-base" />
                          </button>
                          <button onClick={() => setEditingGoal(null)} className="text-slate-400">
                            <MIcon name="close" className="text-base" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-black dark:text-white">
                            {dailyGoal ? `${stats?.profilesToday || 0}/${dailyGoal.target_profiles}` : "—"}
                          </span>
                          <button
                            onClick={() => setEditingGoal({ operatorId: op.id, type: "daily", value: dailyGoal?.target_profiles || 10 })}
                            className="text-slate-400 dark:text-white/40 hover:text-[#1876f2]"
                          >
                            <MIcon name="edit" className="text-sm" />
                          </button>
                        </div>
                      )}
                    </div>
                    {/* Weekly goal */}
                    <div className="bg-slate-50 dark:bg-white/5 rounded-lg p-3">
                      <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Meta Semanal</p>
                      {editingGoal?.operatorId === op.id && editingGoal.type === "weekly" ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            className="w-16 bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded px-2 py-1 text-sm text-slate-900"
                            value={editingGoal.value}
                            onChange={e => setEditingGoal({ ...editingGoal, value: Number(e.target.value) })}
                          />
                          <button
                            onClick={() => saveGoal(op.id, "weekly", editingGoal.value)}
                            disabled={savingGoal}
                            className="text-emerald-600 hover:text-emerald-700"
                          >
                            <MIcon name="check" className="text-base" />
                          </button>
                          <button onClick={() => setEditingGoal(null)} className="text-slate-400">
                            <MIcon name="close" className="text-base" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-black dark:text-white">
                            {weeklyGoal ? `${stats?.profilesThisWeek || 0}/${weeklyGoal.target_profiles}` : "—"}
                          </span>
                          <button
                            onClick={() => setEditingGoal({ operatorId: op.id, type: "weekly", value: weeklyGoal?.target_profiles || 50 })}
                            className="text-slate-400 dark:text-white/40 hover:text-[#1876f2]"
                          >
                            <MIcon name="edit" className="text-sm" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {operators.length === 0 && (
              <div className="p-6 text-center text-slate-400 dark:text-white/40 text-sm">Nenhum operador registrado</div>
            )}
          </div>
        </div>
      </div>

      {/* Track Time Analysis */}
      <div className="bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-white/10">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <MIcon name="layers" className="text-[#1876f2]" />
            Análise por Esteira
          </h3>
          <p className="text-xs text-slate-500 dark:text-white/50 mt-0.5">Tempo médio e performance por tipo de esteira</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-white/10">
          {trackAnalysis.map(track => (
            <div key={track.key} className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold dark:text-white">{track.label}</h4>
                <span className="text-xs bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white/60 px-2 py-0.5 rounded-full font-medium">
                  {track.profileCount} perfis
                </span>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] text-slate-500 dark:text-white/50 font-medium uppercase">Tempo Médio / Perfil</p>
                  <p className="text-xl font-black dark:text-white">{formatDuration(track.avgTime)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 dark:text-white/50 font-medium uppercase">Tempo Médio / Tarefa</p>
                  <p className="text-lg font-bold text-slate-700 dark:text-white/70">{formatDuration(track.avgTaskTime)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 dark:text-white/50 font-medium uppercase">Taxa de Conclusão</p>
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${track.profileCount > 0 ? Math.round((track.completedCount / track.profileCount) * 100) : 0}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-slate-700">
                      {track.profileCount > 0 ? Math.round((track.completedCount / track.profileCount) * 100) : 0}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Task Time Breakdown */}
      <div className="bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-white/10">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <MIcon name="bar_chart" className="text-amber-500" />
            Tempo de Execução por Tarefa
          </h3>
          <p className="text-xs text-slate-500 dark:text-white/50 mt-0.5">Tempo médio gasto em cada dia da esteira</p>
        </div>
        <div className="p-5">
          {taskTimeBreakdown.length > 0 ? (
            <div className="space-y-2.5 max-h-[400px] overflow-y-auto">
              {taskTimeBreakdown.map(task => (
                <div key={task.day} className="flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-blue-50 dark:bg-blue-500/20 text-[#1876f2] font-bold text-xs rounded-full">
                    D{task.day}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium text-slate-700 dark:text-white/70 truncate">{task.title}</p>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-[10px] text-slate-400 dark:text-white/40">{task.executions}x</span>
                        <span className="text-xs font-bold dark:text-white w-16 text-right">{formatDuration(task.avgTime)}</span>
                      </div>
                    </div>
                    <div className="h-2 w-full bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#1876f2] to-[#1876f2]/60 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (task.avgTime / maxTaskTime) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400 dark:text-white/40 text-sm">
              <MIcon name="hourglass_empty" className="text-3xl mb-2" />
              <p>Nenhuma tarefa com dados de tempo registrados</p>
            </div>
          )}
        </div>
      </div>

      {/* Per-Profile Time Breakdown */}
      {(() => {
        const targetProfiles = (selectedOperator === "all"
          ? filteredProfiles
          : filteredProfiles.filter(p => p.created_by === selectedOperator)
        )
          .map(p => {
            const profileTasks = tasks[p.id] || [];
            const completedTasks = profileTasks.filter(t => t.completed && t.duration_seconds);
            const totalTime = completedTasks.reduce((a, t) => a + (t.duration_seconds || 0), 0);
            const tasksDone = completedTasks.length;
            const totalTasks = profileTasks.length;
            return { ...p, totalTime, tasksDone, totalTasks };
          })
          .filter(p => p.totalTime > 0)
          .sort((a, b) => b.totalTime - a.totalTime);

        const maxTime = Math.max(...targetProfiles.map(p => p.totalTime), 1);

        return (
          <div className="bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-white/10">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <MIcon name="person" className="text-purple-500" />
                Tempo por Perfil
              </h3>
              <p className="text-xs text-slate-500 dark:text-white/50 mt-0.5">Tempo total que o operador gastou executando tarefas em cada perfil</p>
            </div>
            <div className="p-5">
              {targetProfiles.length > 0 ? (
                <div className="space-y-2.5 max-h-[400px] overflow-y-auto">
                  {targetProfiles.map(p => {
                    const pct = Math.min(100, (p.totalTime / maxTime) * 100);
                    const operatorName = p.created_by ? (creatorNames[p.created_by] || "—") : "—";
                    return (
                      <div key={p.id} className="flex items-center gap-3">
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                          p.status === "completed" ? "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" :
                          p.status === "restricted" ? "bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400" :
                          "bg-blue-50 dark:bg-blue-500/20 text-[#1876f2]"
                        }`}>
                          <MIcon name={p.status === "completed" ? "check" : p.status === "restricted" ? "warning" : "local_fire_department"} className="text-base" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <p className="text-xs font-bold dark:text-white truncate">{p.profile_code}</p>
                              {selectedOperator === "all" && (
                                <span className="text-[10px] text-slate-400 dark:text-white/40 truncate">• {operatorName}</span>
                              )}
                              <span className="text-[10px] text-slate-400 dark:text-white/40">{p.tasksDone}/{p.totalTasks} tarefas</span>
                            </div>
                            <span className="text-xs font-bold dark:text-white w-20 text-right flex-shrink-0">{formatDuration(p.totalTime)}</span>
                          </div>
                          <div className="h-2 w-full bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                p.status === "completed" ? "bg-emerald-400" :
                                p.status === "restricted" ? "bg-rose-400" :
                                "bg-gradient-to-r from-purple-500 to-purple-300"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400 dark:text-white/40 text-sm">
                  <MIcon name="hourglass_empty" className="text-3xl mb-2" />
                  <p>Nenhum perfil com dados de tempo registrados</p>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </main>
  );
}
