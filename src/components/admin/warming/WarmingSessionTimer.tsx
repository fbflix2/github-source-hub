import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  onTaskCompleted: () => void;
  onTrackCompleted?: (profile: WarmingProfile) => void;
  trackLabel: string;
}

export default function WarmingSessionTimer({ profile, tasks, onTaskCompleted, trackLabel }: Props) {
  // Which task's timer is running (task id)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  // Accumulated seconds per task (before current run)
  const [accumulated, setAccumulated] = useState<Record<string, number>>({});
  // When the current timer started
  const [timerStart, setTimerStart] = useState<number | null>(null);
  // Live elapsed for display
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeTaskIdRef = useRef(activeTaskId);
  const accumulatedRef = useRef(accumulated);
  const timerStartRef = useRef(timerStart);

  // Keep refs in sync
  useEffect(() => { activeTaskIdRef.current = activeTaskId; }, [activeTaskId]);
  useEffect(() => { accumulatedRef.current = accumulated; }, [accumulated]);
  useEffect(() => { timerStartRef.current = timerStart; }, [timerStart]);

  // Tick the timer
  useEffect(() => {
    if (activeTaskId && timerStart) {
      intervalRef.current = setInterval(() => {
        const now = Math.floor(Date.now() / 1000);
        const base = accumulatedRef.current[activeTaskIdRef.current!] || 0;
        setElapsed(base + (now - Math.floor(timerStartRef.current! / 1000)));
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setElapsed(0);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [activeTaskId, timerStart]);

  // Save partial time on beforeunload
  const savePartial = useCallback(async () => {
    const taskId = activeTaskIdRef.current;
    const start = timerStartRef.current;
    if (!taskId || !start) return;
    const runSeconds = Math.floor((Date.now() - start) / 1000);
    const total = (accumulatedRef.current[taskId] || 0) + runSeconds;
    try {
      await supabase.from("warming_tasks").update({ duration_seconds: total }).eq("id", taskId);
    } catch { }
  }, []);

  useEffect(() => {
    const handler = () => { savePartial(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [savePartial]);

  // Initialize accumulated from DB
  useEffect(() => {
    const acc: Record<string, number> = {};
    tasks.forEach(t => {
      if (t.duration_seconds && !t.completed) acc[t.id] = t.duration_seconds;
    });
    setAccumulated(acc);
  }, [tasks]);

  const [delayTaskId, setDelayTaskId] = useState<string | null>(null);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startTimer = (taskId: string) => {
    // If another timer is running, pause it first
    if (activeTaskId && activeTaskId !== taskId && timerStart) {
      const runSeconds = Math.floor((Date.now() - timerStart) / 1000);
      const prev = accumulated[activeTaskId] || 0;
      const total = prev + runSeconds;
      setAccumulated(a => ({ ...a, [activeTaskId]: total }));
      supabase.from("warming_tasks").update({ duration_seconds: total }).eq("id", activeTaskId);
    }
    // Cancel any existing delay
    if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
    
    setDelayTaskId(taskId);
    setActiveTaskId(taskId);
    const base = accumulated[taskId] || 0;
    setElapsed(base);

    // 2s delay for Multilogin to open the profile
    delayTimerRef.current = setTimeout(() => {
      setTimerStart(Date.now());
      setDelayTaskId(null);
    }, 2000);
  };

  // Cleanup delay timer on unmount
  useEffect(() => {
    return () => { if (delayTimerRef.current) clearTimeout(delayTimerRef.current); };
  }, []);

  const pauseTimer = () => {
    // Cancel delay if still waiting
    if (delayTimerRef.current) { clearTimeout(delayTimerRef.current); delayTimerRef.current = null; }
    setDelayTaskId(null);

    if (!activeTaskId) return;
    if (timerStart) {
      const runSeconds = Math.floor((Date.now() - timerStart) / 1000);
      const prev = accumulated[activeTaskId] || 0;
      const total = prev + runSeconds;
      setAccumulated(a => ({ ...a, [activeTaskId]: total }));
      supabase.from("warming_tasks").update({ duration_seconds: total }).eq("id", activeTaskId);
    }
    setActiveTaskId(null);
    setTimerStart(null);
    setElapsed(0);
  };

  const completeTask = async (task: WarmingTask) => {
    let finalDuration: number;
    if (activeTaskId === task.id && timerStart) {
      const runSeconds = Math.floor((Date.now() - timerStart) / 1000);
      finalDuration = (accumulated[task.id] || 0) + runSeconds;
      setActiveTaskId(null);
      setTimerStart(null);
      setElapsed(0);
    } else {
      finalDuration = accumulated[task.id] || 0;
    }

    // Minimum 1 second
    if (finalDuration < 1) finalDuration = 1;

    await supabase.from("warming_tasks").update({
      completed: true,
      completed_at: new Date().toISOString(),
      duration_seconds: finalDuration,
    }).eq("id", task.id);

    // Update profile progress
    const completedCount = tasks.filter(t => t.completed || t.id === task.id).length;
    const newDay = Math.min(completedCount + 1, profile.track_days);
    const newStatus = completedCount >= profile.track_days ? "completed" : "active";
    await supabase.from("warming_profiles").update({
      current_day: newDay,
      status: newStatus,
      updated_at: new Date().toISOString(),
    }).eq("id", profile.id);

    toast.success(`Tarefa "${task.title}" concluída em ${formatDuration(finalDuration)}`);
    onTaskCompleted();
  };

  const uncompleteTask = async (task: WarmingTask) => {
    await supabase.from("warming_tasks").update({
      completed: false,
      completed_at: null,
      duration_seconds: null,
    }).eq("id", task.id);
    setAccumulated(a => { const n = { ...a }; delete n[task.id]; return n; });
    onTaskCompleted();
  };

  const completedCount = tasks.filter(t => t.completed).length;
  const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;
  const totalTime = tasks.reduce((acc, t) => acc + (t.completed ? (t.duration_seconds || 0) : 0), 0);

  const sortedTasks = [...tasks].sort((a, b) => a.day_number - b.day_number);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <MIcon name="local_fire_department" className="text-orange-500 text-lg" />
              <h2 className="text-base font-bold text-slate-900">
                {profile.profile_code}
                {profile.profile_name && ` — ${profile.profile_name}`}
              </h2>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              {trackLabel} • {completedCount}/{tasks.length} tarefas
              {profile.trust_tier && <span className="ml-2 text-purple-600 font-bold">• {profile.trust_tier}</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {totalTime > 0 && (
              <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                <MIcon name="schedule" className="text-sm" />
                Total: {formatDuration(totalTime)}
              </span>
            )}
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
              profile.status === "completed" ? "bg-green-50 text-green-600" :
              profile.status === "restricted" ? "bg-red-50 text-red-600" :
              "bg-blue-100 text-[#1876f2]"
            }`}>
              {profile.status === "active" ? "Ativo" : profile.status === "completed" ? "Concluído" : profile.status}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Progresso</span>
            <span className="text-sm font-black text-slate-800">{progress}%</span>
          </div>
          <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
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

      {/* Task list */}
      <div className="p-4 space-y-2 max-h-[420px] overflow-y-auto">
        {sortedTasks.map((task) => {
          const isActive = activeTaskId === task.id;
          const isDelaying = delayTaskId === task.id && timerStart == null;
          const isRunning = isActive && timerStart != null;
          const taskAccum = accumulated[task.id] || 0;
          const displayTime = isRunning ? elapsed : taskAccum;
          const isNextPending = !task.completed && sortedTasks.filter(t => !t.completed)[0]?.id === task.id;

          return (
            <div
              key={task.id}
              className={`rounded-xl border transition-all ${
                task.completed
                  ? "bg-slate-50/80 border-slate-100"
                  : isDelaying
                  ? "bg-amber-50 border-amber-300 ring-2 ring-amber-200/40 shadow-sm"
                  : isRunning
                  ? "bg-blue-50 border-[#1876f2]/40 ring-2 ring-[#1876f2]/20 shadow-sm"
                  : isNextPending
                  ? "bg-white border-slate-200 shadow-sm"
                  : "bg-slate-50/50 border-slate-100 opacity-60"
              }`}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Day indicator */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                  task.completed ? "bg-green-100 text-green-600" :
                  isDelaying ? "bg-amber-400 text-white animate-pulse" :
                  isRunning ? "bg-[#1876f2] text-white animate-pulse" :
                  isNextPending ? "bg-slate-200 text-slate-700" :
                  "bg-slate-100 text-slate-400"
                }`}>
                  {task.completed ? <MIcon name="check" className="text-base" /> : 
                   isDelaying ? <MIcon name="hourglass_top" className="text-base animate-spin" /> :
                   `D${task.day_number}`}
                </div>

                {/* Task info */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold ${task.completed ? "text-slate-400 line-through" : "text-slate-900"}`}>
                    {task.title}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">{task.description}</p>
                </div>

                {/* Timer display */}
                <div className="flex items-center gap-2 shrink-0">
                  {task.completed ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-lg flex items-center gap-1">
                        <MIcon name="timer" className="text-sm" />
                        {formatDuration(task.duration_seconds)}
                      </span>
                      <button
                        onClick={() => uncompleteTask(task)}
                        className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                        title="Desfazer conclusão"
                      >
                        <MIcon name="undo" className="text-base" />
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Delay indicator */}
                      {isDelaying && (
                        <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2.5 py-1 rounded-lg animate-pulse">
                          Abrindo perfil...
                        </span>
                      )}

                      {/* Timer value */}
                      {!isDelaying && (isRunning || taskAccum > 0) && (
                        <span className={`font-mono text-sm font-bold px-2.5 py-1 rounded-lg ${
                          isRunning ? "bg-[#1876f2] text-white" : "bg-slate-100 text-slate-600"
                        }`}>
                          {formatTimer(displayTime)}
                        </span>
                      )}

                      {/* Play/Pause button */}
                      {!task.completed && (isNextPending || isRunning || taskAccum > 0) && (
                        <button
                          onClick={() => isRunning ? pauseTimer() : startTimer(task.id)}
                          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                            isRunning
                              ? "bg-amber-500 hover:bg-amber-600 text-white shadow-md"
                              : "bg-[#1876f2] hover:bg-[#1565c0] text-white shadow-md"
                          }`}
                          title={isRunning ? "Pausar" : "Iniciar cronômetro"}
                        >
                          <MIcon name={isRunning ? "pause" : "play_arrow"} className="text-lg" />
                        </button>
                      )}

                      {/* Complete button */}
                      {!task.completed && (taskAccum > 0 || isRunning) && (
                        <button
                          onClick={() => completeTask(task)}
                          className="w-9 h-9 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center transition-all shadow-md"
                          title="Concluir tarefa"
                        >
                          <MIcon name="check" className="text-lg" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Running indicator */}
              {isRunning && (
                <div className="px-4 pb-3">
                  <div className="h-1 w-full bg-blue-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#1876f2] rounded-full animate-pulse" style={{ width: "100%" }} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Active timer banner */}
      {activeTaskId && (timerStart || delayTaskId) && (
        <div className={`px-5 py-3 text-white flex items-center justify-between ${
          delayTaskId ? "bg-amber-500" : "bg-[#1876f2]"
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
            <span className="text-sm font-bold">
              {delayTaskId ? "Abrindo perfil..." : `Cronômetro ativo: ${sortedTasks.find(t => t.id === activeTaskId)?.title}`}
            </span>
          </div>
          <span className="font-mono text-lg font-black">
            {delayTaskId ? "⏳" : formatTimer(elapsed)}
          </span>
        </div>
      )}
    </div>
  );
}
