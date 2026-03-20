import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface WarmingTask {
  id: string;
  profile_id: string;
  day_number: number;
  title: string;
  description: string | null;
  completed: boolean;
  completed_at: string | null;
  duration_seconds: number | null;
}

interface WarmingProfile {
  id: string;
  profile_code: string;
  profile_name: string | null;
  track_type: string;
  track_days: number;
  start_date: string;
  current_day: number;
  status: string;
  trust_tier: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

function MIcon({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins}min ${secs > 0 ? secs + "s" : ""}`.trim();
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${remMins > 0 ? remMins + "min" : ""}`.trim();
}

interface Props {
  profile: WarmingProfile;
  tasks: WarmingTask[];
  trackLabel: string;
  finishSignal: number;
  startSignal: number;
  onTaskCompleted: () => void;
  onTrackCompleted?: (profile: WarmingProfile) => void;
  onTimerStateChange?: (isRunning: boolean, taskTitle: string | null, elapsed: number) => void;
  onStatusChange?: (profileId: string, newStatus: string) => void;
}

export default function WarmingSessionTimer({
  profile, tasks, trackLabel, finishSignal, startSignal,
  onTaskCompleted, onTrackCompleted, onTimerStateChange, onStatusChange
}: Props) {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [timerStart, setTimerStart] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [isDelaying, setIsDelaying] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState<{ status: string; label: string } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerStartRef = useRef(timerStart);
  const activeTaskIdRef = useRef(activeTaskId);
  const completingRef = useRef(false);

  useEffect(() => { timerStartRef.current = timerStart; }, [timerStart]);
  useEffect(() => { activeTaskIdRef.current = activeTaskId; }, [activeTaskId]);

  const sortedTasks = [...tasks].sort((a, b) => a.day_number - b.day_number);
  const firstPendingTask = sortedTasks.find(t => !t.completed);

  // Handle startSignal from parent (manual start)
  const prevStartSignal = useRef(startSignal);
  useEffect(() => {
    if (startSignal > prevStartSignal.current && firstPendingTask && !activeTaskId && !isDelaying) {
      startTask(firstPendingTask.id);
    }
    prevStartSignal.current = startSignal;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startSignal]);

  const startTask = (taskId: string) => {
    if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
    setActiveTaskId(taskId);
    setIsDelaying(true);
    setElapsed(0);
    delayTimerRef.current = setTimeout(() => {
      setTimerStart(Date.now());
      setIsDelaying(false);
    }, 2000);
  };

  // Tick the timer
  useEffect(() => {
    if (activeTaskId && timerStart) {
      intervalRef.current = setInterval(() => {
        const e = Math.floor((Date.now() - timerStartRef.current!) / 1000);
        setElapsed(e);
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (!isDelaying) setElapsed(0);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [activeTaskId, timerStart, isDelaying]);

  // Notify parent of timer state
  useEffect(() => {
    const task = sortedTasks.find(t => t.id === activeTaskId);
    onTimerStateChange?.(!!activeTaskId || isDelaying, task?.title || null, elapsed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTaskId, isDelaying, elapsed]);

  // Save partial on beforeunload
  const savePartial = useCallback(async () => {
    const taskId = activeTaskIdRef.current;
    const start = timerStartRef.current;
    if (!taskId || !start) return;
    const total = Math.floor((Date.now() - start) / 1000);
    try {
      await supabase.from("warming_tasks").update({ duration_seconds: Math.max(1, total) }).eq("id", taskId);
    } catch { }
  }, []);

  useEffect(() => {
    const handler = () => { savePartial(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [savePartial]);

  // Save partial when profile changes (switching profiles)
  const prevProfileId = useRef(profile.id);
  useEffect(() => {
    if (profile.id !== prevProfileId.current) {
      savePartial();
      setActiveTaskId(null);
      setTimerStart(null);
      setElapsed(0);
      setIsDelaying(false);
      if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
      prevProfileId.current = profile.id;
    }
  }, [profile.id, savePartial]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Handle finishSignal from parent
  const prevFinishSignal = useRef(finishSignal);
  useEffect(() => {
    if (finishSignal > prevFinishSignal.current && activeTaskId) {
      completeCurrentTask();
    }
    prevFinishSignal.current = finishSignal;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finishSignal]);

  const completeCurrentTask = async () => {
    if (!activeTaskId || completingRef.current) return;
    completingRef.current = true;
    const task = sortedTasks.find(t => t.id === activeTaskId);
    if (!task) { completingRef.current = false; return; }

    // Cancel delay if still waiting
    if (delayTimerRef.current) { clearTimeout(delayTimerRef.current); delayTimerRef.current = null; }

    let finalDuration: number;
    if (timerStart) {
      finalDuration = Math.floor((Date.now() - timerStart) / 1000);
    } else {
      finalDuration = 1; // was in delay phase
    }
    if (finalDuration < 1) finalDuration = 1;

    // Clear timer state
    setActiveTaskId(null);
    setTimerStart(null);
    setElapsed(0);
    setIsDelaying(false);

    await supabase.from("warming_tasks").update({
      completed: true,
      completed_at: new Date().toISOString(),
      duration_seconds: finalDuration,
    }).eq("id", task.id);

    // Check progress
    const completedCount = tasks.filter(t => t.completed || t.id === task.id).length;
    const allDone = completedCount >= profile.track_days;

    if (allDone) {
      const NEXT_TRACK: Record<string, string> = { "7_days": "15_days", "15_days": "30_days" };
      const hasNextTrack = !!NEXT_TRACK[profile.track_type];
      if (hasNextTrack && onTrackCompleted) {
        completingRef.current = false;
        onTrackCompleted(profile);
      } else {
        await supabase.from("warming_profiles").update({
          current_day: profile.track_days,
          status: "completed",
          updated_at: new Date().toISOString(),
        }).eq("id", profile.id);
        toast.success(`🏆 Perfil "${profile.profile_code}" concluiu todas as esteiras!`);
        completingRef.current = false;
        onTaskCompleted();
      }
    } else {
      const newDay = Math.min(completedCount + 1, profile.track_days);
      await supabase.from("warming_profiles").update({
        current_day: newDay,
        status: "active",
        updated_at: new Date().toISOString(),
      }).eq("id", profile.id);
      toast.success(`Tarefa "${task.title}" concluída em ${formatDuration(finalDuration)}`);
      completingRef.current = false;
      onTaskCompleted();
      // Next task auto-starts via useEffect
    }
  };

  const uncompleteTask = async (task: WarmingTask) => {
    await supabase.from("warming_tasks").update({
      completed: false,
      completed_at: null,
      duration_seconds: null,
    }).eq("id", task.id);
    onTaskCompleted();
  };

  const completedCount = tasks.filter(t => t.completed).length;
  const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;
  const totalTime = tasks.reduce((acc, t) => acc + (t.completed ? (t.duration_seconds || 0) : 0), 0);

  return (
    <div className="bg-white dark:bg-black rounded-xl shadow-sm border border-slate-200 dark:border-white/10 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-100 dark:border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <MIcon name="local_fire_department" className="text-orange-500 text-lg" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {profile.profile_code}
                {profile.profile_name && ` — ${profile.profile_name}`}
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-white/50 font-medium">
              {trackLabel} • {completedCount}/{tasks.length} tarefas
              {profile.trust_tier && <span className="ml-2 text-purple-600 font-bold">• {profile.trust_tier}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {totalTime > 0 && (
              <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                <MIcon name="schedule" className="text-sm" />
                Total: {formatDuration(totalTime)}
              </span>
            )}
            {/* Block / Checkpoint actions */}
            {profile.status !== "completed" && onStatusChange && (
              <Popover>
                <PopoverTrigger asChild>
                  <button className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors" title="Marcar status">
                    <MIcon name="flag" className="text-lg text-slate-400 hover:text-red-500" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2" align="end">
                  <div className="space-y-1">
                    <button
                      onClick={() => onStatusChange(profile.id, "blocked")}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <MIcon name="block" className="text-base" />
                      Bloqueado
                    </button>
                    <button
                      onClick={() => onStatusChange(profile.id, "checkpoint")}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-amber-600 hover:bg-amber-50 transition-colors"
                    >
                      <MIcon name="warning" className="text-base" />
                      Checkpoint
                    </button>
                    {(profile.status === "blocked" || profile.status === "checkpoint") && (
                      <button
                        onClick={() => onStatusChange(profile.id, "active")}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        <MIcon name="local_fire_department" className="text-base" />
                        Reativar
                      </button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            )}
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
              profile.status === "completed" ? "bg-green-50 text-green-600" :
              profile.status === "blocked" ? "bg-red-50 text-red-600" :
              profile.status === "checkpoint" ? "bg-amber-50 text-amber-600" :
              profile.status === "restricted" ? "bg-red-50 text-red-600" :
              "bg-blue-100 text-[#1876f2]"
            }`}>
              {profile.status === "active" ? "Ativo" :
               profile.status === "completed" ? "Concluído" :
               profile.status === "blocked" ? "Bloqueado" :
               profile.status === "checkpoint" ? "Checkpoint" :
               profile.status}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] font-bold text-slate-500 dark:text-white/50 uppercase tracking-wider">Progresso</span>
            <span className="text-sm font-black text-slate-800 dark:text-white">{progress}%</span>
          </div>
          <div className="h-2.5 w-full bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                background: progress === 100
                  ? "linear-gradient(90deg, #10b981, #059669)"
                  : "linear-gradient(90deg, #3b82f6, #1d4ed8)"
              }}
            />
          </div>
        </div>
      </div>

      {/* Current day task (show only the single pending task) */}
      <div className="p-4 space-y-2">
        {/* Current pending task (only one — the task of the day) */}
        {firstPendingTask && (() => {
          const task = firstPendingTask;
          const isActive = activeTaskId === task.id;
          const isDelayingTask = isActive && isDelaying;
          const isRunning = isActive && timerStart != null;

          return (
            <div
              className={`rounded-xl border transition-all ${
                isDelayingTask
                  ? "bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-500/30 ring-2 ring-amber-200/40 shadow-sm"
                  : isRunning
                  ? "bg-blue-50 dark:bg-blue-900/20 border-[#1876f2]/40 ring-2 ring-[#1876f2]/20 shadow-sm"
                  : "bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 shadow-sm"
              }`}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                  isDelayingTask ? "bg-amber-400 text-white animate-pulse" :
                  isRunning ? "bg-[#1876f2] text-white animate-pulse" :
                  "bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-white"
                }`}>
                  {isDelayingTask ? <MIcon name="hourglass_top" className="text-base animate-spin" /> :
                   `D${task.day_number}`}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{task.title}</p>
                  <p className="text-[11px] text-slate-500 dark:text-white/50">{task.description}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isDelayingTask && (
                    <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2.5 py-1 rounded-lg animate-pulse">
                      Abrindo perfil...
                    </span>
                  )}
                  {isRunning && (
                    <span className="font-mono text-sm font-bold px-2.5 py-1 rounded-lg bg-[#1876f2] text-white">
                      {formatTimer(elapsed)}
                    </span>
                  )}
                </div>
              </div>
              {isRunning && (
                <div className="px-4 pb-3">
                  <div className="h-1 w-full bg-blue-100 dark:bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-[#1876f2] rounded-full animate-pulse" style={{ width: "100%" }} />
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* All tasks done for this track */}
        {!firstPendingTask && sortedTasks.length > 0 && (
          <div className="text-center py-4">
            <MIcon name="check_circle" className="text-green-500 text-3xl" />
            <p className="text-sm font-bold text-green-600 mt-1">Todas as tarefas desta esteira foram concluídas!</p>
          </div>
        )}
      </div>

      {/* Active timer banner */}
      {(activeTaskId || isDelaying) && (
        <div className={`px-5 py-3 text-white flex items-center justify-between ${
          isDelaying ? "bg-amber-500" : "bg-[#1876f2]"
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
            <span className="text-sm font-bold">
              {isDelaying ? "Abrindo perfil..." : `Cronômetro ativo: ${sortedTasks.find(t => t.id === activeTaskId)?.title}`}
            </span>
          </div>
          <span className="font-mono text-lg font-black">
            {isDelaying ? "⏳" : formatTimer(elapsed)}
          </span>
        </div>
      )}
    </div>
  );
}
