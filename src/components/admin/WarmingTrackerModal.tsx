import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

interface WarmingTrackerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileCode: string;
  userId: string;
}

interface WarmingProfile {
  id: string;
  profile_code: string;
  profile_name: string | null;
  track_type: string;
  track_days: number;
  current_day: number;
  start_date: string;
  status: string;
  notes: string | null;
  updated_at: string;
}

interface WarmingTask {
  id: string;
  day_number: number;
  title: string;
  description: string | null;
  completed: boolean;
  completed_at: string | null;
}

type EngagementStatus = "applied" | "partial" | "not_used";

export default function WarmingTrackerModal({ open, onOpenChange, profileCode, userId }: WarmingTrackerModalProps) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<WarmingProfile | null>(null);
  const [tasks, setTasks] = useState<WarmingTask[]>([]);

  useEffect(() => {
    if (!open || !profileCode || !userId) return;
    loadData();
  }, [open, profileCode, userId]);

  async function loadData() {
    setLoading(true);
    // Find warming profile by code + user
    const { data: profiles } = await supabase
      .from("client_warming_profiles")
      .select("*")
      .eq("user_id", userId)
      .eq("profile_code", profileCode)
      .order("created_at", { ascending: false })
      .limit(1);

    const p = profiles?.[0] || null;
    setProfile(p);

    if (p) {
      const { data: taskData } = await supabase
        .from("client_warming_tasks")
        .select("*")
        .eq("profile_id", p.id)
        .order("day_number", { ascending: true });
      setTasks(taskData || []);
    } else {
      setTasks([]);
    }
    setLoading(false);
  }

  function getEngagementStatus(): EngagementStatus {
    if (!profile || tasks.length === 0) return "not_used";
    const completed = tasks.filter(t => t.completed).length;
    if (completed === 0) return "not_used";
    if (completed === tasks.length) return "applied";
    return "partial";
  }

  function getLastActiveDate(): string | null {
    const completedTasks = tasks.filter(t => t.completed_at);
    if (completedTasks.length === 0) return null;
    completedTasks.sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime());
    return completedTasks[0].completed_at!;
  }

  function getTasksByDay(): Record<number, WarmingTask[]> {
    const byDay: Record<number, WarmingTask[]> = {};
    for (const t of tasks) {
      if (!byDay[t.day_number]) byDay[t.day_number] = [];
      byDay[t.day_number].push(t);
    }
    return byDay;
  }

  const statusConfig: Record<EngagementStatus, { label: string; color: string; icon: string; bg: string }> = {
    applied: { label: "Aplicou a Esteira", color: "text-emerald-400", icon: "check_circle", bg: "bg-emerald-500/10 border-emerald-500/20" },
    partial: { label: "Parcialmente", color: "text-yellow-400", icon: "pending", bg: "bg-yellow-500/10 border-yellow-500/20" },
    not_used: { label: "Não Usou", color: "text-red-400", icon: "cancel", bg: "bg-red-500/10 border-red-500/20" },
  };

  const engagement = getEngagementStatus();
  const lastActive = getLastActiveDate();
  const tasksByDay = getTasksByDay();
  const totalCompleted = tasks.filter(t => t.completed).length;
  const totalTasks = tasks.length;
  const overallPercent = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;
  const days = Object.keys(tasksByDay).map(Number).sort((a, b) => a - b);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">local_fire_department</span>
            Lastro da Esteira — {profileCode}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : !profile ? (
          <div className="text-center py-8 space-y-2">
            <span className="material-symbols-outlined text-muted-foreground text-[40px]">search_off</span>
            <p className="text-sm text-muted-foreground">Nenhuma esteira encontrada para este perfil.</p>
            <p className="text-xs text-muted-foreground/70">O cliente não iniciou a esteira de aquecimento.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Status Badge */}
            <div className={`flex items-center justify-between p-3 rounded-lg border ${statusConfig[engagement].bg}`}>
              <div className="flex items-center gap-2">
                <span className={`material-symbols-outlined text-[20px] ${statusConfig[engagement].color}`}>
                  {statusConfig[engagement].icon}
                </span>
                <div>
                  <p className={`text-sm font-bold ${statusConfig[engagement].color}`}>{statusConfig[engagement].label}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {profile.status === "concluido" ? "Esteira concluída" : `Dia ${profile.current_day}/${profile.track_days}`}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-mono font-bold text-foreground">{overallPercent}%</p>
                <p className="text-[10px] text-muted-foreground">{totalCompleted}/{totalTasks} tarefas</p>
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2 rounded-lg bg-muted/30 border border-border text-center">
                <p className="text-xs text-muted-foreground">Início</p>
                <p className="text-sm font-bold text-foreground">
                  {new Date(profile.start_date).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-muted/30 border border-border text-center">
                <p className="text-xs text-muted-foreground">Último Ativo</p>
                <p className="text-sm font-bold text-foreground">
                  {lastActive ? new Date(lastActive).toLocaleDateString("pt-BR") : "—"}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-muted/30 border border-border text-center">
                <p className="text-xs text-muted-foreground">Modelo</p>
                <p className="text-sm font-bold text-foreground">{profile.track_days} dias</p>
              </div>
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Progresso geral</span>
                <span className="text-xs font-mono text-foreground">{overallPercent}%</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    overallPercent >= 80 ? "bg-emerald-500" : overallPercent >= 40 ? "bg-yellow-500" : "bg-red-500"
                  }`}
                  style={{ width: `${overallPercent}%` }}
                />
              </div>
            </div>

            {/* Timeline dia a dia */}
            <div>
              <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-[16px]">timeline</span>
                Timeline por Dia
              </h3>
              <div className="space-y-2">
                {days.map(day => {
                  const dayTasks = tasksByDay[day];
                  const dayCompleted = dayTasks.filter(t => t.completed).length;
                  const dayTotal = dayTasks.length;
                  const dayPercent = Math.round((dayCompleted / dayTotal) * 100);
                  const isComplete = dayCompleted === dayTotal;
                  const isPartial = dayCompleted > 0 && !isComplete;
                  const isUntouched = dayCompleted === 0;

                  return (
                    <details key={day} className="group">
                      <summary className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer hover:bg-muted/30 transition-colors ${
                        isComplete ? "border-emerald-500/20 bg-emerald-500/5" : isPartial ? "border-yellow-500/20 bg-yellow-500/5" : "border-border bg-muted/10"
                      }`}>
                        <div className="flex items-center gap-2">
                          <span className={`material-symbols-outlined text-[16px] ${
                            isComplete ? "text-emerald-400" : isPartial ? "text-yellow-400" : "text-muted-foreground"
                          }`}>
                            {isComplete ? "check_circle" : isPartial ? "pending" : "radio_button_unchecked"}
                          </span>
                          <span className="text-xs font-bold text-foreground">Dia {day}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-mono ${
                            isComplete ? "text-emerald-400" : isPartial ? "text-yellow-400" : "text-muted-foreground"
                          }`}>
                            {dayCompleted}/{dayTotal} ({dayPercent}%)
                          </span>
                          <span className="material-symbols-outlined text-[14px] text-muted-foreground group-open:rotate-180 transition-transform">
                            expand_more
                          </span>
                        </div>
                      </summary>
                      <div className="mt-1 ml-6 space-y-1">
                        {dayTasks.map(task => (
                          <div key={task.id} className="flex items-start gap-2 py-1">
                            <span className={`material-symbols-outlined text-[14px] mt-0.5 shrink-0 ${
                              task.completed ? "text-emerald-400" : "text-muted-foreground/50"
                            }`}>
                              {task.completed ? "task_alt" : "radio_button_unchecked"}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className={`text-[11px] ${task.completed ? "text-foreground" : "text-muted-foreground"}`}>
                                {task.title}
                              </p>
                              {task.completed_at && (
                                <p className="text-[9px] text-muted-foreground/60">
                                  Feito em {new Date(task.completed_at).toLocaleString("pt-BR")}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  );
                })}
              </div>
            </div>

            {/* Notes */}
            {profile.notes && (
              <div className="p-2 rounded-lg bg-muted/20 border border-border">
                <p className="text-[10px] text-muted-foreground mb-0.5">Notas do perfil</p>
                <p className="text-xs text-foreground whitespace-pre-line">{profile.notes}</p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
