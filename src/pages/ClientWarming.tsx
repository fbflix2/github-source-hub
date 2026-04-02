import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Plus, Trash2, CheckCircle, Circle, Flame, Calendar,
  Lightbulb, ShieldCheck, Clock, Users, MessageSquare, ChevronDown, ChevronUp
} from "lucide-react";

interface ClientWarmingProfile {
  id: string;
  user_id: string;
  profile_code: string;
  profile_name: string | null;
  track_type: string;
  track_days: number;
  start_date: string;
  current_day: number;
  status: string;
  notes: string | null;
  created_at: string;
}

interface ClientWarmingTask {
  id: string;
  profile_id: string;
  day_number: number;
  title: string;
  description: string | null;
  completed: boolean;
  completed_at: string | null;
}

const FARMING_TIPS = [
  { icon: Users, title: "Simule um usuário real", tip: "Navegue pelo feed, curta posts, comente em grupos. Evite ações em massa ou automação nos primeiros dias." },
  { icon: Clock, title: "Respeite os horários", tip: "Use o perfil em horários variados, como um usuário real faria. Evite ficar online 24h." },
  { icon: ShieldCheck, title: "2FA é essencial", tip: "Ative autenticação de dois fatores o mais cedo possível. Isso aumenta a confiança do perfil." },
  { icon: MessageSquare, title: "Engaje organicamente", tip: "Interaja em grupos do seu nicho com comentários relevantes. Não faça spam." },
  { icon: Lightbulb, title: "Aqueça antes de anunciar", tip: "Complete toda a esteira antes de criar campanhas. Perfis aquecidos têm melhor desempenho e maior trust." },
];

function TipsCarousel() {
  const [currentTip, setCurrentTip] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTip(prev => (prev + 1) % FARMING_TIPS.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const tip = FARMING_TIPS[currentTip];
  const TipIcon = tip.icon;

  return (
    <div className="pt-4">
      <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3 flex items-center justify-center gap-1.5">
        <Lightbulb className="size-3.5 text-yellow-400" /> Dicas e boas práticas
      </h3>
      <div className="relative overflow-hidden">
        <div
          key={currentTip}
          className="p-3 rounded-lg bg-card border border-border animate-fade-in"
        >
          <div className="flex items-start gap-2">
            <TipIcon className="size-4 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-semibold text-foreground leading-tight">{tip.title}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{tip.tip}</p>
            </div>
          </div>
        </div>
        <div className="flex justify-center gap-1 mt-2">
          {FARMING_TIPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentTip(i)}
              className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentTip ? "bg-primary w-3" : "bg-muted-foreground/30"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ClientWarming() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<ClientWarmingProfile[]>([]);
  const [tasks, setTasks] = useState<Record<string, ClientWarmingTask[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [showAddProfile, setShowAddProfile] = useState(false);
  const [newProfileCode, setNewProfileCode] = useState("");
  const [newProfileName, setNewProfileName] = useState("");
  const [creating, setCreating] = useState(false);
  const [trackConfig, setTrackConfig] = useState<Record<string, { title: string; description: string }[]> | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profs } = await supabase
      .from("client_warming_profiles")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    setProfiles(profs || []);

    if (profs && profs.length > 0) {
      const ids = profs.map(p => p.id);
      const { data: taskData } = await supabase
        .from("client_warming_tasks")
        .select("*")
        .in("profile_id", ids)
        .order("day_number", { ascending: true });

      const grouped: Record<string, ClientWarmingTask[]> = {};
      (taskData || []).forEach(t => {
        if (!grouped[t.profile_id]) grouped[t.profile_id] = [];
        grouped[t.profile_id].push(t);
      });
      setTasks(grouped);

      if (!selectedProfileId && profs.length > 0) {
        setSelectedProfileId(profs[0].id);
      }
    }
    setLoading(false);
  }, [selectedProfileId]);

  const loadTrackConfig = useCallback(async () => {
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "client_warming_track_config")
      .maybeSingle();
    if (data?.value) {
      try { setTrackConfig(JSON.parse(data.value)); } catch { }
    }
  }, []);

  useEffect(() => {
    fetchData();
    loadTrackConfig();
  }, [fetchData, loadTrackConfig]);

  const DEFAULT_TASKS: { title: string; description: string }[] = [
    { title: "Completar perfil", description: "Preencha foto, capa e bio do perfil." },
    { title: "Navegar organicamente", description: "Role o feed por 5-10 minutos, curta 3-5 posts." },
    { title: "Adicionar 5-10 amigos", description: "Envie solicitações de amizade para pessoas do seu nicho." },
    { title: "Engajar em grupos", description: "Comente em 2-3 grupos relacionados ao seu nicho." },
    { title: "Criar página", description: "Crie uma página comercial e publique 1-2 posts." },
    { title: "Ativar 2FA", description: "Configure autenticação de dois fatores para segurança." },
    { title: "Verificar restrições", description: "Verifique se a conta está sem restrições e pronta para uso." },
  ];

  const handleCreateProfile = async () => {
    if (!newProfileCode.trim()) { toast.error("Informe o código do perfil"); return; }
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tasksToUse = trackConfig?.["7_days"] || DEFAULT_TASKS;
      const { data: profile, error } = await supabase
        .from("client_warming_profiles")
        .insert({ user_id: user.id, profile_code: newProfileCode.trim(), profile_name: newProfileName.trim() || null, track_type: "7_days", track_days: 7 })
        .select().single();
      if (error) throw error;
      const taskInserts = tasksToUse.map((t, idx) => ({ profile_id: profile.id, day_number: idx + 1, title: t.title, description: t.description }));
      await supabase.from("client_warming_tasks").insert(taskInserts);
      toast.success("Perfil adicionado à esteira!");
      setNewProfileCode(""); setNewProfileName(""); setShowAddProfile(false); setSelectedProfileId(profile.id);
      fetchData();
    } catch (err: any) { toast.error(err.message || "Erro ao criar perfil"); }
    finally { setCreating(false); }
  };

  const handleToggleTask = async (task: ClientWarmingTask) => {
    const newCompleted = !task.completed;
    await supabase.from("client_warming_tasks").update({ completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null }).eq("id", task.id);
    if (newCompleted && selectedProfileId) {
      const profile = profiles.find(p => p.id === selectedProfileId);
      if (profile && task.day_number >= profile.current_day) {
        const profileTasks = tasks[selectedProfileId] || [];
        const dayTasks = profileTasks.filter(t => t.day_number === task.day_number);
        const allDayComplete = dayTasks.every(t => t.id === task.id ? true : t.completed);
        if (allDayComplete && task.day_number < profile.track_days) {
          await supabase.from("client_warming_profiles").update({ current_day: task.day_number + 1 }).eq("id", selectedProfileId);
        }
        const allComplete = profileTasks.every(t => t.id === task.id ? true : t.completed);
        if (allComplete) {
          await supabase.from("client_warming_profiles").update({ status: "concluido" }).eq("id", selectedProfileId);
        }
      }
    }
    fetchData();
  };

  const handleDeleteProfile = async (profileId: string) => {
    if (!confirm("Remover este perfil da esteira?")) return;
    await supabase.from("client_warming_profiles").delete().eq("id", profileId);
    if (selectedProfileId === profileId) setSelectedProfileId(null);
    toast.success("Perfil removido");
    fetchData();
  };

  const selectedProfile = profiles.find(p => p.id === selectedProfileId);
  const selectedTasks = selectedProfileId ? (tasks[selectedProfileId] || []) : [];
  const completedCount = selectedTasks.filter(t => t.completed).length;
  const totalTasks = selectedTasks.length;
  const progressPct = totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0;

  const getDaysSinceStart = (startDate: string) => {
    const start = new Date(startDate).getTime();
    const diff = Date.now() - start;
    return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)) + 1);
  };

  const currentDay = selectedProfile ? getDaysSinceStart(selectedProfile.start_date) : 1;
  const todayTasks = selectedTasks.filter(t => t.day_number === currentDay);
  const pastDays = selectedProfile
    ? Array.from({ length: Math.min(currentDay - 1, selectedProfile.track_days) }, (_, i) => i + 1)
    : [];
  const pastTasksByDay = pastDays.map(day => ({
    day,
    tasks: selectedTasks.filter(t => t.day_number === day),
  }));

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden pt-4 pb-6 px-4 sm:px-6 lg:px-12">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full -z-10 pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-500/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full" />
      </div>

      <main className="max-w-5xl mx-auto">
        <header className="mb-6">
          <button onClick={() => navigate("/ferramentas")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
            <ArrowLeft className="size-4" /> Voltar para Ferramentas
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Flame className="text-white size-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground tracking-tight">Esteira de Aquecimento</h1>
              <p className="text-sm text-muted-foreground">Aqueça seus perfis comprados seguindo as tarefas diárias</p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:max-h-[calc(100vh-200px)]">
          {/* Sidebar - Profile List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Meus Perfis</h2>
              <Button size="sm" variant="outline" onClick={() => setShowAddProfile(!showAddProfile)} className="gap-1">
                <Plus className="size-3.5" /> Novo
              </Button>
            </div>

            {showAddProfile && (
              <div className="p-4 rounded-xl bg-card border border-border space-y-3">
                <Input placeholder="Código do perfil (ex: 1234)" value={newProfileCode} onChange={e => setNewProfileCode(e.target.value)} />
                <Input placeholder="Nome (opcional)" value={newProfileName} onChange={e => setNewProfileName(e.target.value)} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleCreateProfile} disabled={creating} className="flex-1">{creating ? "Criando..." : "Adicionar"}</Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowAddProfile(false)}>Cancelar</Button>
                </div>
              </div>
            )}

            {profiles.length === 0 && !showAddProfile && (
              <div className="text-center py-10 text-muted-foreground text-sm">
                <Flame className="size-8 mx-auto mb-2 opacity-30" />
                <p>Nenhum perfil na esteira</p>
                <p className="text-xs mt-1">Clique em "Novo" para começar</p>
              </div>
            )}

            {profiles.map(profile => {
              const pTasks = tasks[profile.id] || [];
              const pCompleted = pTasks.filter(t => t.completed).length;
              const pTotal = pTasks.length;
              const pPct = pTotal > 0 ? (pCompleted / pTotal) * 100 : 0;
              const isSelected = selectedProfileId === profile.id;
              return (
                <div key={profile.id} onClick={() => { setSelectedProfileId(profile.id); setShowHistory(false); }}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${isSelected ? "bg-primary/10 border-primary/40 shadow-sm" : "bg-card border-border hover:border-primary/20"}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <Flame className={`size-4 ${profile.status === "concluido" ? "text-emerald-400" : "text-orange-400"}`} />
                      <span className="font-bold text-sm text-foreground">{profile.profile_code}</span>
                      {profile.profile_name && <span className="text-xs text-muted-foreground truncate max-w-[80px]">{profile.profile_name}</span>}
                    </div>
                    <Badge variant={profile.status === "concluido" ? "default" : "secondary"} className="text-[10px]">
                      {profile.status === "concluido" ? "Concluído" : `Dia ${getDaysSinceStart(profile.start_date)}/${profile.track_days}`}
                    </Badge>
                  </div>
                  <Progress value={pPct} className="h-1.5 [&>div]:bg-orange-500" />
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-muted-foreground">{pCompleted}/{pTotal} tarefas</span>
                    <span className="text-[10px] text-muted-foreground">{Math.round(pPct)}%</span>
                  </div>
                </div>
              );
            })}

          </div>

          {/* Main Content */}
          <div className="lg:col-span-2">
            {!selectedProfile ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                Selecione um perfil para ver as tarefas
              </div>
            ) : (
              <div className="space-y-4">
                {/* Profile Header */}
                <div className="p-4 rounded-xl bg-card border border-border">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <Flame className="size-5 text-orange-400" />
                        Perfil {selectedProfile.profile_code}
                        {selectedProfile.profile_name && <span className="text-sm font-normal text-muted-foreground">— {selectedProfile.profile_name}</span>}
                      </h3>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Calendar className="size-3" /> Início: {new Date(selectedProfile.start_date).toLocaleDateString("pt-BR")}</span>
                        <span>Trilha: 7 dias</span>
                        <span>Dia atual: {Math.min(currentDay, selectedProfile.track_days)}/{selectedProfile.track_days}</span>
                      </div>
                    </div>
                    <button onClick={() => handleDeleteProfile(selectedProfile.id)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress value={progressPct} className="flex-1 h-2 [&>div]:bg-gradient-to-r [&>div]:from-orange-500 [&>div]:to-red-500" />
                    <span className="text-sm font-bold text-foreground">{Math.round(progressPct)}%</span>
                  </div>
                </div>

                {/* Today's Task - Prominent */}
                {selectedProfile.status !== "concluido" && currentDay <= selectedProfile.track_days && (
                  <div className="p-5 rounded-xl bg-orange-500/5 border-2 border-orange-500/30">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center text-xs font-bold text-orange-400">
                        D{currentDay}
                      </div>
                      <span className="text-base font-bold text-orange-400">Dia {currentDay}</span>
                      <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-[9px]">HOJE</Badge>
                    </div>
                    {todayTasks.length > 0 ? todayTasks.map(task => (
                      <div key={task.id} onClick={() => handleToggleTask(task)}
                        className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all hover:bg-orange-500/10 ${task.completed ? "opacity-60" : ""}`}>
                        {task.completed
                          ? <CheckCircle className="size-5 text-emerald-400 shrink-0 mt-0.5" />
                          : <Circle className="size-5 text-orange-400 shrink-0 mt-0.5" />}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold ${task.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>{task.title}</p>
                          {task.description && <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>}
                        </div>
                      </div>
                    )) : (
                      <p className="text-xs text-muted-foreground">Nenhuma tarefa configurada para hoje</p>
                    )}
                  </div>
                )}

                {/* Completed banner */}
                {selectedProfile.status === "concluido" && (
                  <div className="p-5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center">
                    <CheckCircle className="size-8 text-emerald-400 mx-auto mb-2" />
                    <p className="text-base font-bold text-emerald-400">Esteira concluída!</p>
                    <p className="text-xs text-muted-foreground mt-1">Seu perfil está aquecido e pronto para uso.</p>
                  </div>
                )}

                {/* Activity History - Collapsible */}
                {pastTasksByDay.length > 0 && (
                  <div className="rounded-xl bg-card border border-border overflow-hidden">
                    <button onClick={() => setShowHistory(!showHistory)}
                      className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Clock className="size-3.5" /> Registro de Atividades ({pastTasksByDay.length} {pastTasksByDay.length === 1 ? "dia" : "dias"})
                      </span>
                      {showHistory ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                    </button>

                    {showHistory && (
                      <div className="px-3 pb-3 space-y-2">
                        {pastTasksByDay.map(({ day, tasks: dayTasks }) => {
                          const allDone = dayTasks.length > 0 && dayTasks.every(t => t.completed);
                          const doneCount = dayTasks.filter(t => t.completed).length;
                          return (
                            <div key={day} className={`p-2.5 rounded-lg border ${allDone ? "bg-emerald-500/5 border-emerald-500/15" : "bg-muted/20 border-border"}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${allDone ? "bg-emerald-500/20 text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                                    D{day}
                                  </div>
                                  <span className="text-xs font-semibold text-foreground">Dia {day}</span>
                                  <span className="text-[10px] text-muted-foreground">— {dayTasks.map(t => t.title).join(", ")}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-muted-foreground">{doneCount}/{dayTasks.length}</span>
                                  {allDone && <CheckCircle className="size-3.5 text-emerald-400" />}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Future days indicator */}
                {selectedProfile.status !== "concluido" && currentDay < selectedProfile.track_days && (
                  <div className="p-3 rounded-xl bg-muted/20 border border-border text-center">
                    <p className="text-xs text-muted-foreground">
                      Ainda {selectedProfile.track_days - currentDay} {selectedProfile.track_days - currentDay === 1 ? "dia restante" : "dias restantes"} na esteira
                    </p>
                  </div>
                )}

                <TipsCarousel />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
