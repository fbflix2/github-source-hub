import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import WarmingOperatorDashboard from "@/components/admin/warming/WarmingOperatorDashboard";
import WarmingSessionTimer from "@/components/admin/warming/WarmingSessionTimer";
import { toast } from "sonner";

// ── Track definitions ──────────────────────────────────────────
interface TrackDay {
  day: number;
  title: string;
  description: string;
}

const TRACKS: Record<string, { label: string; days: number; tasks: TrackDay[] }> = {
  "7_days": {
    label: "7 Dias - Básica",
    days: 7,
    tasks: [
      { day: 1, title: "Orgânico puro", description: "Login consistente, completar perfil, ativar 2FA." },
      { day: 2, title: "Curtir 5 posts", description: "Engajamento básico no feed principal." },
      { day: 3, title: "Comentar em 2 grupos", description: "Interação focada em nichos específicos." },
      { day: 4, title: "Criar BM/Page", description: "Criar Business Manager e Página." },
      { day: 5, title: "Ads Engagement R$5", description: "Campanha de Engagement com R$5/dia, creatives neutros." },
      { day: 6, title: "Ads Traffic R$8", description: "Campanha de Traffic com R$8/dia." },
      { day: 7, title: "Ads Traffic R$10", description: "Escalar para R$10/dia, checar restrições." },
    ],
  },
  "15_days": {
    label: "15 Dias - Média",
    days: 15,
    tasks: [
      { day: 1, title: "Orgânico puro", description: "Navegação em sites de notícias e portais." },
      { day: 2, title: "Curtir 5 posts", description: "Engajamento básico no feed principal." },
      { day: 3, title: "Comentar em 2 grupos", description: "Interação focada em nichos específicos." },
      { day: 4, title: "1-2 posts na Page", description: "Criar conteúdo orgânico na Página." },
      { day: 5, title: "Criar BM e Ad Account", description: "Configurar Business Manager e conta de anúncios." },
      { day: 6, title: "Ads Engagement R$5", description: "Primeira campanha de Engagement." },
      { day: 7, title: "Ads Traffic R$8", description: "Campanha de tráfego com orçamento mínimo." },
      { day: 8, title: "Escalar R$10/dia", description: "Aumentar orçamento gradualmente." },
      { day: 9, title: "Ads Conversions R$12", description: "Testar objetivo de conversões." },
      { day: 10, title: "Posts + Ads R$15", description: "Mais posts na Page + escalar anúncios." },
      { day: 11, title: "Diversificar objetivos", description: "Misturar Engagement e Conversions." },
      { day: 12, title: "Ads R$18/dia", description: "Escalar com creatives variados." },
      { day: 13, title: "Estabilização R$20", description: "Manter orçamento estável." },
      { day: 14, title: "Checar Nível de Confiança", description: "Verificar nível de confiança da conta." },
      { day: 15, title: "Verificar BM parcial", description: "Checar status do Business Manager." },
    ],
  },
  "30_days": {
    label: "30 Dias - Premium",
    days: 30,
    tasks: [
      { day: 1, title: "Orgânico puro", description: "Login, completar perfil, ativar 2FA." },
      { day: 2, title: "Curtir 5 posts", description: "Engajamento básico." },
      { day: 3, title: "Comentar em 2 grupos", description: "Interação em nichos." },
      { day: 4, title: "1-2 posts na Page", description: "Conteúdo orgânico." },
      { day: 5, title: "Criar BM/Ad Account", description: "Setup completo." },
      { day: 6, title: "Ads Engagement R$5", description: "Primeira campanha." },
      { day: 7, title: "Ads Traffic R$8", description: "Tráfego inicial." },
      { day: 8, title: "Escalar R$10", description: "Aumento gradual." },
      { day: 9, title: "Conversions R$12", description: "Testar conversões." },
      { day: 10, title: "Posts + Ads R$15", description: "Orgânico + pago." },
      { day: 11, title: "Diversificar R$15", description: "Misturar objetivos." },
      { day: 12, title: "Ads R$18", description: "Creatives variados." },
      { day: 13, title: "Estabilização R$20", description: "Manter estável." },
      { day: 14, title: "Checar Nível", description: "Verificar nível de confiança." },
      { day: 15, title: "Verificação parcial BM", description: "Checar status do BM." },
      { day: 16, title: "Volume R$30", description: "Construir volume de gastos." },
      { day: 17, title: "Multi-objetivos R$30", description: "Engagement + Conversions + Traffic." },
      { day: 18, title: "Eventos reais R$35", description: "Gerar eventos de conversão reais." },
      { day: 19, title: "Escalar R$35", description: "Manter escala consistente." },
      { day: 20, title: "BM fully check", description: "Verificar BM completo." },
      { day: 21, title: "Ads R$40", description: "Escalar para R$40/dia." },
      { day: 22, title: "Lookalike audiences", description: "Criar públicos semelhantes." },
      { day: 23, title: "Retargeting R$40", description: "Campanhas de retargeting." },
      { day: 24, title: "Volume R$45", description: "Aumentar volume." },
      { day: 25, title: "Spike test R$50", description: "Testar picos de orçamento." },
      { day: 26, title: "Manutenção R$40", description: "Manter orçamento estável." },
      { day: 27, title: "Multi-creatives R$50", description: "Variar creatives extensivamente." },
      { day: 28, title: "Ads R$60", description: "Escalar agressivamente." },
      { day: 29, title: "Tier 3+ check", description: "Mirar tier 3 ou superior." },
      { day: 30, title: "Finalização R$80", description: "Teste final com orçamento máximo." },
    ],
  },
};

// ── Types ──────────────────────────────────────────
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

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return "";
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins}min ${secs > 0 ? secs + "s" : ""}`.trim();
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${remMins > 0 ? remMins + "min" : ""}`.trim();
}

function MIcon({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

export default function AdminAquecimento() {
  const [profiles, setProfiles] = useState<WarmingProfile[]>([]);
  const [tasks, setTasks] = useState<Record<string, WarmingTask[]>>({});
  const [loading, setLoading] = useState(true);
  const [creatorNames, setCreatorNames] = useState<Record<string, string>>({});
  const [creatorAvatars, setCreatorAvatars] = useState<Record<string, string | null>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
  const [operatorGoals, setOperatorGoals] = useState<{ daily: number | null; weekly: number | null }>({ daily: null, weekly: null });
  const [profileCode, setProfileCode] = useState("");
  const [selectedTrack, setSelectedTrack] = useState("7_days");
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [activeTaskTitle, setActiveTaskTitle] = useState<string | null>(null);
  const [currentElapsed, setCurrentElapsed] = useState(0);
  const [finishSignal, setFinishSignal] = useState(0);
  const [startSignal, setStartSignal] = useState(0);
  const [activeTab, setActiveTab] = useState<"dashboard" | "esteiras" | "gestao" | "relatorios" | "configuracoes">("dashboard");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetting, setResetting] = useState(false);
  const [reportFilter, setReportFilter] = useState("");
  const [configTrack, setConfigTrack] = useState<"7_days" | "15_days" | "30_days">("7_days");
  const defaultConfigTasks: Record<string, { title: string; description: string }[]> = {
    "7_days": TRACKS["7_days"].tasks.map(t => ({ title: t.title, description: t.description })),
    "15_days": TRACKS["15_days"].tasks.map(t => ({ title: t.title, description: t.description })),
    "30_days": TRACKS["30_days"].tasks.map(t => ({ title: t.title, description: t.description })),
  };
  const [configTasks, setConfigTasks] = useState<Record<string, { title: string; description: string }[]>>(defaultConfigTasks);
  const [configLoaded, setConfigLoaded] = useState(false);
  const configSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [trustTiers, setTrustTiers] = useState([
    { label: "Nível 1 (Confiança Baixa)", color: "bg-red-100 text-red-700", range: "0 - 30", criteria: "Contas novas, sem histórico de interação ou fotos reais." },
    { label: "Nível 2 (Confiança Média)", color: "bg-amber-100 text-amber-700", range: "31 - 75", criteria: "Histórico de 7+ dias, interações diárias, autenticação 2FA ativa." },
    { label: "Nível 3 (Confiança Alta)", color: "bg-green-100 text-green-700", range: "76 - 100", criteria: "Esteira completa, verificação de identidade, 30+ dias de atividade." },
  ]);

  useEffect(() => {
    if (!document.querySelector('link[href*="Material+Symbols+Outlined"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap";
      document.head.appendChild(link);
    }
    fetchProfiles();
    loadConfigFromDB();
    // Fetch current user
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUserId(user.id);
        supabase.from("profiles").select("full_name, avatar_url").eq("user_id", user.id).maybeSingle().then(({ data }) => {
          if (data) {
            setCurrentUserName(data.full_name);
            setCurrentUserAvatar(data.avatar_url);
          }
        });
        // Fetch goals for this user
        supabase.from("warming_operator_goals").select("*").eq("operator_id", user.id).eq("active", true).then(({ data }) => {
          if (data) {
            const daily = data.find((g: any) => g.goal_type === "daily");
            const weekly = data.find((g: any) => g.goal_type === "weekly");
            setOperatorGoals({ daily: daily?.target_profiles ?? null, weekly: weekly?.target_profiles ?? null });
          }
        });
      }
    });
  }, []);

  // Load track config from DB (site_settings)
  const loadConfigFromDB = async () => {
    try {
      const { data } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "warming_track_config")
        .maybeSingle();
      if (data?.value) {
        try {
          const parsed = JSON.parse(data.value);
          if (parsed && typeof parsed === "object") {
            setConfigTasks(prev => ({ ...prev, ...parsed }));
          }
        } catch {}
      }
    } catch {}
    setConfigLoaded(true);
  };

  // Save track config to DB with debounce
  const saveConfigToDB = (updatedConfig: Record<string, { title: string; description: string }[]>) => {
    if (configSaveTimer.current) clearTimeout(configSaveTimer.current);
    configSaveTimer.current = setTimeout(async () => {
      try {
        const jsonValue = JSON.stringify(updatedConfig);
        const { data: existing } = await supabase
          .from("site_settings")
          .select("id")
          .eq("key", "warming_track_config")
          .maybeSingle();
        if (existing) {
          await supabase.from("site_settings").update({ value: jsonValue }).eq("key", "warming_track_config");
        } else {
          await supabase.from("site_settings").insert({ key: "warming_track_config", value: jsonValue });
        }
      } catch (err) {
        console.error("Erro ao salvar config da esteira:", err);
      }
    }, 800);
  };

  // Wrapper to update configTasks and auto-save
  const updateConfigTasks = (updater: (prev: Record<string, { title: string; description: string }[]>) => Record<string, { title: string; description: string }[]>) => {
    setConfigTasks(prev => {
      const next = updater(prev);
      saveConfigToDB(next);
      return next;
    });
  };

  const fetchProfiles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("warming_profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar perfis");
    } else {
      setProfiles(data || []);
      // Fetch tasks for ALL profiles (needed for avg time calculation)
      if (data && data.length > 0) {
        const { data: allTasks } = await supabase
          .from("warming_tasks")
          .select("*")
          .in("profile_id", data.map((p: any) => p.id))
          .order("day_number", { ascending: true });
        if (allTasks) {
          const grouped: Record<string, WarmingTask[]> = {};
          allTasks.forEach((t: any) => {
            if (!grouped[t.profile_id]) grouped[t.profile_id] = [];
            grouped[t.profile_id].push(t);
          });
          setTasks(grouped);
        }
        const first = data.find((p: any) => p.status === "active");
        if (first) setSelectedProfileId(first.id);
      }
      // Fetch creator names
      const creatorIds = [...new Set((data || []).map(p => p.created_by).filter(Boolean))] as string[];
      if (creatorIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url")
          .in("user_id", creatorIds);
        if (profilesData) {
          const nameMap: Record<string, string> = {};
          const avatarMap: Record<string, string | null> = {};
          profilesData.forEach(p => {
            nameMap[p.user_id] = p.full_name || "Sem nome";
            avatarMap[p.user_id] = p.avatar_url || null;
          });
          setCreatorNames(nameMap);
          setCreatorAvatars(avatarMap);
        }
      }
    }
    setLoading(false);
  };

  const fetchTasks = async (profileId: string) => {
    const { data } = await supabase
      .from("warming_tasks")
      .select("*")
      .eq("profile_id", profileId)
      .order("day_number", { ascending: true });
    if (data) setTasks((prev) => ({ ...prev, [profileId]: data }));
  };

  const handleCreate = async () => {
    if (!profileCode.trim()) { toast.error("Digite o código do perfil"); return; }
    // Reset timer state so the right panel switches cleanly
    setIsTimerActive(false);
    setActiveTaskTitle(null);
    setCurrentElapsed(0);
    // Check for duplicate profile code
    const { data: existing } = await supabase
      .from("warming_profiles")
      .select("id, status")
      .eq("profile_code", profileCode.trim())
      .maybeSingle();
    if (existing) {
      // If profile exists and is active, check if it has pending tasks
      if (existing.status === "active") {
        // Fetch tasks to check if there's a pending one
        const { data: existingTasks } = await supabase
          .from("warming_tasks")
          .select("*")
          .eq("profile_id", existing.id)
          .order("day_number", { ascending: true });
        const hasPending = existingTasks?.some(t => !t.completed);
        if (!hasPending) {
          toast.info(`Perfil "${profileCode.trim()}" já concluiu a tarefa de hoje. Informe outro perfil.`);
          setProfileCode("");
          return;
        }
        setSelectedProfileId(existing.id);
        if (existingTasks) setTasks(prev => ({ ...prev, [existing.id]: existingTasks }));
        setProfileCode("");
        toast.info(`Perfil "${profileCode.trim()}" já existe. Selecionado automaticamente.`);
        return;
      }
      toast.error(`O perfil "${profileCode.trim()}" já está cadastrado.`);
      return;
    }
    setCreating(true);
    const track = TRACKS[selectedTrack];
    const customTasks = configTasks[selectedTrack] || [];
    const tasksToUse = customTasks.length > 0 ? customTasks : track.tasks;
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile, error } = await supabase
      .from("warming_profiles")
      .insert({ profile_code: profileCode.trim(), track_type: selectedTrack, track_days: tasksToUse.length, created_by: user?.id || null })
      .select()
      .single();
    if (error || !profile) { toast.error("Erro ao criar perfil"); setCreating(false); return; }
    const taskRows = tasksToUse.map((t, i) => ({ profile_id: profile.id, day_number: i + 1, title: t.title, description: t.description }));
    await supabase.from("warming_tasks").insert(taskRows);
    toast.success(`Perfil ${profileCode} criado e selecionado automaticamente`);
    setProfileCode("");
    setSelectedProfileId(profile.id);
    await fetchProfiles();
    await fetchTasks(profile.id);
    setCreating(false);
    // Auto-start timer for the first task of the new profile
    setTimeout(() => setStartSignal(s => s + 1), 400);
  };

  const toggleTask = async (task: WarmingTask) => {
    const newCompleted = !task.completed;
    let durationSeconds: number | null = null;

    if (newCompleted) {
      // Calculate duration: time since profile creation (+3s) or since previous task completion
      const profile = profiles.find((p) => p.id === task.profile_id);
      const profileTasks = (tasks[task.profile_id] || []).sort((a, b) => a.day_number - b.day_number);
      
      // Find the previous completed task (by day_number, before this one)
      const previousCompleted = profileTasks
        .filter(t => t.completed && t.completed_at && t.day_number < task.day_number)
        .sort((a, b) => b.day_number - a.day_number)[0];

      let startTime: number;
      if (previousCompleted?.completed_at) {
        startTime = new Date(previousCompleted.completed_at).getTime();
      } else if (profile) {
        // First task: starts from profile creation + 3 seconds
        startTime = new Date(profile.created_at).getTime() + 3000;
      } else {
        startTime = Date.now();
      }

      durationSeconds = Math.max(0, Math.round((Date.now() - startTime) / 1000));
    }

    await supabase.from("warming_tasks").update({ 
      completed: newCompleted, 
      completed_at: newCompleted ? new Date().toISOString() : null,
      duration_seconds: newCompleted ? durationSeconds : null
    }).eq("id", task.id);

    if (newCompleted) {
      const profileTasks = tasks[task.profile_id] || [];
      const completedCount = profileTasks.filter((t) => t.completed || t.id === task.id).length;
      const profile = profiles.find((p) => p.id === task.profile_id);
      if (profile) {
        const newDay = Math.min(completedCount + 1, profile.track_days);
        const newStatus = completedCount >= profile.track_days ? "completed" : "active";
        await supabase.from("warming_profiles").update({ current_day: newDay, status: newStatus, updated_at: new Date().toISOString() }).eq("id", task.profile_id);
      }
    }
    fetchTasks(task.profile_id);
    fetchProfiles();
  };

  const handleResetAll = async () => {
    if (!resetPassword) return;
    setResetting(true);
    setResetError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) { setResetError("Usuário não autenticado"); setResetting(false); return; }
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: resetPassword });
      if (signInError) { setResetError("Senha incorreta. Tente novamente."); setResetting(false); return; }
      const profileIds = profiles.map(p => p.id);
      if (profileIds.length > 0) {
        await supabase.from("warming_tasks").delete().in("profile_id", profileIds);
        await supabase.from("warming_profiles").delete().in("id", profileIds);
      }
      toast.success("Todas as esteiras e perfis foram zerados com sucesso!");
      setShowResetConfirm(false);
      setResetPassword("");
      setProfiles([]);
      setTasks({});
      setSelectedProfileId(null);
      fetchProfiles();
    } catch (err) {
      setResetError("Erro inesperado ao zerar.");
    }
    setResetting(false);
  };

  const updateTrustTier = async (profileId: string) => {
    const tier = prompt("Digite o Nível de Confiança atual (ex: Nível 1, Nível 2, Nível 3):");
    if (!tier) return;
    await supabase.from("warming_profiles").update({ trust_tier: tier, updated_at: new Date().toISOString() }).eq("id", profileId);
    fetchProfiles();
    toast.success("Nível de Confiança atualizado");
  };

  const getProgress = (profile: WarmingProfile) => {
    const profileTaskList = tasks[profile.id];
    if (!profileTaskList) return Math.min(100, Math.round(((profile.current_day - 1) / profile.track_days) * 100));
    const completed = profileTaskList.filter((t) => t.completed).length;
    return Math.min(100, Math.round((completed / profileTaskList.length) * 100));
  };

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId);
  const selectedTasks = selectedProfileId ? tasks[selectedProfileId] || [] : [];
  const selectedTrackDef = selectedProfile ? TRACKS[selectedProfile.track_type] : null;
  const selectedProgress = selectedProfile ? getProgress(selectedProfile) : 0;

  const tabs = [
    { key: "dashboard", label: "Painel", icon: "dashboard" },
    { key: "esteiras", label: "Esteiras", icon: "layers" },
    { key: "gestao", label: "Gestão", icon: "supervisor_account" },
    { key: "relatorios", label: "Relatórios", icon: "analytics" },
    { key: "configuracoes", label: "Configurações", icon: "settings" },
  ] as const;

  // Dashboard stats from DB
  const totalProfiles = profiles.length;
  const activeProfiles = profiles.filter(p => p.status === "active").length;
  const completedProfiles = profiles.filter(p => p.status === "completed").length;
  const restrictedProfiles = profiles.filter(p => p.status === "restricted").length;
  const totalPct = totalProfiles > 0 ? Math.round((activeProfiles / totalProfiles) * 100) : 0;

  const newProfiles = profiles.filter(p => p.current_day <= 7).length;
  const midProfiles = profiles.filter(p => p.current_day > 7 && p.current_day <= 15).length;
  const matureProfiles = profiles.filter(p => p.current_day > 15).length;

  const t3 = profiles.filter(p => p.trust_tier?.includes("3")).length;
  const t2 = profiles.filter(p => p.trust_tier?.includes("2")).length;
  const t1 = profiles.filter(p => p.trust_tier && !p.trust_tier.includes("2") && !p.trust_tier.includes("3")).length;
  const tierTotal = t3 + t2 + t1 || 1;
  const t3Pct = Math.round((t3 / tierTotal) * 100);
  const t2Pct = Math.round((t2 / tierTotal) * 100);
  const t1Pct = 100 - t3Pct - t2Pct;
  const predominantTier = t3 >= t2 && t3 >= t1 ? "Tier 3" : t2 >= t1 ? "Tier 2" : "Tier 1";

  const filteredReportProfiles = profiles.filter(p =>
    !reportFilter || p.profile_code.toLowerCase().includes(reportFilter.toLowerCase())
  );

  return (
    <div className="flex flex-col min-h-full bg-[#f5f7f8] text-slate-900" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* ── Hero Section ── */}
      <section className="relative overflow-hidden text-white pt-10 pb-16 px-6 md:px-12 lg:px-40" style={{ background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 40%, #3a3a3a 70%, #1a1a1a 100%)" }}>
        <div className="absolute top-0 right-0 w-1/3 h-full opacity-10 pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <path d="M44.7,-76.4C58.1,-69.2,69.5,-57.4,77.4,-43.8C85.3,-30.2,89.7,-15.1,89.1,-0.3C88.5,14.4,82.9,28.8,74.1,41.2C65.3,53.6,53.2,64.1,39.6,71.7C26,79.2,13,83.9,-0.8,85.2C-14.5,86.5,-29,84.5,-42.1,77.5C-55.2,70.5,-66.8,58.6,-74.6,44.9C-82.4,31.2,-86.3,15.6,-86.1,0.1C-85.9,-15.4,-81.5,-30.8,-73.2,-44C-64.9,-57.2,-52.7,-68.1,-38.8,-75C-24.9,-81.8,-9.2,-84.6,3.4,-90.4C16,-96.2,27.1,-83.5,44.7,-76.4Z" fill="currentColor" transform="translate(100 100)" />
          </svg>
        </div>
        <div className="max-w-[1200px] mx-auto relative z-10">
          {/* Personalized greeting */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
            <div className="flex items-center gap-4">
              {currentUserAvatar ? (
                <img src={currentUserAvatar} alt="" className="w-14 h-14 rounded-full border-2 border-white/30 object-cover" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border-2 border-white/30">
                  <MIcon name="person" className="text-white text-2xl" />
                </div>
              )}
              <div>
                <p className="text-white/60 text-sm font-medium">
                  {(() => {
                    const h = new Date().getHours();
                    return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
                  })()},
                </p>
                <h1 className="text-2xl md:text-3xl font-black tracking-tight">
                  {currentUserName ? currentUserName.split(" ")[0] : "Operador"} 👋
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                <MIcon name="fluid" className="text-white text-2xl" />
              </div>
              <span className="text-xl font-bold tracking-tight">FBFlix</span>
            </div>
          </div>

          {/* Personal stats row */}
          {(() => {
            const myProfiles = currentUserId ? profiles.filter(p => p.created_by === currentUserId) : profiles;
            const todayStart = new Date(); todayStart.setHours(0,0,0,0);
            const myToday = myProfiles.filter(p => new Date(p.created_at) >= todayStart).length;
            const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
            const myWeek = myProfiles.filter(p => new Date(p.created_at) >= weekStart).length;
            const myActive = myProfiles.filter(p => p.status === "active").length;
            const myCompleted = myProfiles.filter(p => p.status === "completed").length;
            let myTotalTime = 0;
            let myTaskCount = 0;
            myProfiles.forEach(p => {
              (tasks[p.id] || []).forEach(t => {
                if (t.duration_seconds) { myTotalTime += t.duration_seconds; myTaskCount++; }
              });
            });
            const avgPerProfile = myProfiles.length > 0 ? Math.round(myTotalTime / myProfiles.length) : 0;

            return (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-xl border border-white/15">
                  <p className="text-[10px] font-medium text-white/50 uppercase tracking-wider">Perfis Hoje</p>
                  <div className="flex items-end gap-2 mt-1">
                    <p className="text-2xl font-black">{myToday}</p>
                    {operatorGoals.daily && (
                      <p className="text-xs text-white/40 mb-0.5">/ {operatorGoals.daily}</p>
                    )}
                  </div>
                  {operatorGoals.daily && (
                    <div className="mt-2 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${myToday >= operatorGoals.daily ? "bg-emerald-400" : "bg-[#1876f2]"}`} style={{ width: `${Math.min(100, (myToday / operatorGoals.daily) * 100)}%` }} />
                    </div>
                  )}
                </div>
                <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-xl border border-white/15">
                  <p className="text-[10px] font-medium text-white/50 uppercase tracking-wider">Perfis Semana</p>
                  <div className="flex items-end gap-2 mt-1">
                    <p className="text-2xl font-black">{myWeek}</p>
                    {operatorGoals.weekly && (
                      <p className="text-xs text-white/40 mb-0.5">/ {operatorGoals.weekly}</p>
                    )}
                  </div>
                  {operatorGoals.weekly && (
                    <div className="mt-2 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${myWeek >= operatorGoals.weekly ? "bg-emerald-400" : "bg-[#1876f2]"}`} style={{ width: `${Math.min(100, (myWeek / operatorGoals.weekly) * 100)}%` }} />
                    </div>
                  )}
                </div>
                <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-xl border border-white/15">
                  <p className="text-[10px] font-medium text-white/50 uppercase tracking-wider">Em Aquecimento</p>
                  <p className="text-2xl font-black mt-1">{myActive}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-xl border border-white/15">
                  <p className="text-[10px] font-medium text-white/50 uppercase tracking-wider">Concluídos</p>
                  <p className="text-2xl font-black mt-1">{myCompleted}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-xl border border-white/15">
                  <p className="text-[10px] font-medium text-white/50 uppercase tracking-wider">Tempo Médio / Perfil</p>
                  <p className="text-2xl font-black mt-1">{formatDuration(avgPerProfile) || "—"}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-xl border border-white/15">
                  <p className="text-[10px] font-medium text-white/50 uppercase tracking-wider">Total Meus Perfis</p>
                  <p className="text-2xl font-black mt-1">{myProfiles.length}</p>
                </div>
              </div>
            );
          })()}
        </div>
      </section>

      {/* ── Tab Navigation ── */}
      <nav className="sticky top-0 z-50 bg-white border-b border-slate-200 px-6 md:px-12 lg:px-40">
        <div className="max-w-[1200px] mx-auto flex gap-8">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 border-b-[3px] pb-4 pt-5 font-bold text-sm tracking-wide transition-colors ${
                activeTab === tab.key
                  ? "border-[#1876f2] text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Dashboard Tab ── */}
      {activeTab === "dashboard" && (
        <main className="flex-1 px-6 md:px-12 lg:px-40 py-10 max-w-[1200px] mx-auto w-full">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-slate-500 font-medium text-sm">Total Perfis</p>
                <MIcon name="group" className="text-[#1876f2]" />
              </div>
              <p className="text-3xl font-black text-slate-900">{totalProfiles.toLocaleString()}</p>
              <div className="flex items-center gap-1 text-slate-400 font-medium text-sm">
                <span>Sem dados anteriores</span>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-slate-500 font-medium text-sm">Em Aquecimento</p>
                <MIcon name="local_fire_department" className="text-amber-500" />
              </div>
              <p className="text-3xl font-black text-slate-900">{activeProfiles.toLocaleString()}</p>
              <div className="flex items-center gap-1 text-slate-400 font-medium text-sm">
                <span>{totalPct}% do total</span>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-slate-500 font-medium text-sm">Prontos p/ Uso</p>
                <MIcon name="check_circle" className="text-emerald-500" />
              </div>
              <p className="text-3xl font-black text-slate-900">{completedProfiles.toLocaleString()}</p>
              <div className="flex items-center gap-1 text-emerald-500 font-bold text-sm">
                <MIcon name="verified" className="text-sm" />
                <span>Alta maturidade</span>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-slate-500 font-medium text-sm">Perdas (24h)</p>
                <MIcon name="block" className="text-rose-500" />
              </div>
              <p className="text-3xl font-black text-slate-900">{restrictedProfiles}</p>
              <div className="flex items-center gap-1 text-slate-400 font-medium text-sm">
                <span>Sem dados anteriores</span>
              </div>
            </div>
          </div>

          {/* Progress by Stage + Trust Tier */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-lg font-bold">Progresso por Estágio</h3>
                  <p className="text-sm text-slate-500">Maturidade dos perfis na esteira</p>
                </div>
                <select className="bg-slate-50 border-none rounded-lg text-sm font-medium focus:ring-slate-400">
                  <option>Últimos 30 dias</option>
                  <option>Últimos 7 dias</option>
                </select>
              </div>
              <div className="space-y-8">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-bold">
                    <span>Novos (0-7 dias)</span>
                    <span>{newProfiles} perfis</span>
                  </div>
                  <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#1876f2]/40 rounded-full" style={{ width: `${totalProfiles ? Math.round((newProfiles / totalProfiles) * 100) : 35}%` }} />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-bold">
                    <span>Intermediários (15 dias)</span>
                    <span>{midProfiles} perfis</span>
                  </div>
                  <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#1876f2]/70 rounded-full" style={{ width: `${totalProfiles ? Math.round((midProfiles / totalProfiles) * 100) : 55}%` }} />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-bold">
                    <span>Maturidade Máxima (30+ dias)</span>
                    <span>{matureProfiles} perfis</span>
                  </div>
                  <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#1876f2] rounded-full" style={{ width: `${totalProfiles ? Math.round((matureProfiles / totalProfiles) * 100) : 85}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Trust Tier Distribution */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h3 className="text-lg font-bold mb-6">Distribuição de Confiança</h3>
              <div className="flex flex-col items-center justify-center py-4">
                <div className="relative w-48 h-48">
                  <svg className="w-full h-full" viewBox="0 0 36 36">
                    <circle className="stroke-slate-100" cx="18" cy="18" fill="none" r="16" strokeWidth="4" />
                    <circle className="stroke-[#1876f2]" cx="18" cy="18" fill="none" r="16" strokeDasharray={`${t2Pct}, 100`} strokeDashoffset={`-${t3Pct}`} strokeLinecap="round" strokeWidth="4" />
                    <circle className="stroke-emerald-500" cx="18" cy="18" fill="none" r="16" strokeDasharray={`${t3Pct}, 100`} strokeLinecap="round" strokeWidth="4" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black">{predominantTier}</span>
                    <span className="text-xs text-slate-500 font-medium">Predominante</span>
                  </div>
                </div>
                <div className="mt-8 w-full space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-emerald-500" />
                      <span className="text-sm font-medium">Confiança Alta (T3)</span>
                    </div>
                    <span className="text-sm font-bold">{t3Pct}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-[#1876f2]" />
                      <span className="text-sm font-medium">Confiança Média (T2)</span>
                    </div>
                    <span className="text-sm font-bold">{t2Pct}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-slate-300" />
                      <span className="text-sm font-medium">Confiança Baixa (T1)</span>
                    </div>
                    <span className="text-sm font-bold">{t1Pct}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold">Atividade Recente</h3>
              <button className="text-[#1876f2] text-sm font-bold hover:underline">Ver tudo</button>
            </div>
            <div className="divide-y divide-slate-100">
              {profiles.slice(0, 4).map((p, i) => {
                const icons = ["trending_up", "person_add", "settings_backup_restore", "error"];
                const colors = ["emerald", "blue", "amber", "rose"];
                const color = colors[i % 4];
                const bgMap: Record<string, string> = { emerald: "bg-emerald-100 text-emerald-600", blue: "bg-blue-100 text-[#1876f2]", amber: "bg-amber-100 text-amber-600", rose: "bg-rose-100 text-rose-600" };
                const date = new Date(p.created_at);
                const ago = Math.round((Date.now() - date.getTime()) / 60000);
                const agoLabel = ago < 60 ? `${ago}m` : ago < 1440 ? `${Math.round(ago / 60)}h` : `${Math.round(ago / 1440)}d`;
                return (
                  <div key={p.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${bgMap[color]}`}>
                        <MIcon name={icons[i % 4]} />
                      </div>
                      <div>
                        <p className="text-sm font-bold">Perfil {p.profile_code} — {p.status === "completed" ? "Maturidade concluída" : p.status === "active" ? `Dia ${p.current_day}/${p.track_days}` : "Restrição detectada"}</p>
                        <p className="text-xs text-slate-500">
                          Esteira {TRACKS[p.track_type]?.label} • {new Date(p.created_at).toLocaleDateString("pt-BR")}
                          {p.created_by && creatorNames[p.created_by] && <span className="ml-1 text-[#1876f2] font-semibold">• {creatorNames[p.created_by]}</span>}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-slate-400">{agoLabel}</span>
                  </div>
                );
              })}
              {profiles.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-sm">Nenhuma atividade recente</div>
              )}
            </div>
          </div>
        </main>
      )}

      {/* ── Esteiras Tab ── */}
      {activeTab === "esteiras" && (
        <div id="form-section" className="max-w-5xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-12 gap-5 pb-8 pt-6 w-full">
          {/* ── Selection Form Section ── */}
          <section className="lg:col-span-5">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2.5">
                <MIcon name="add_circle" className="text-[#1876f2] text-xl" />
                <h2 className="text-base font-bold text-slate-900">Iniciar Novo Aquecimento</h2>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Código do Perfil</label>
                  <div className="relative">
                    <MIcon name="fingerprint" className="absolute left-3 top-2.5 text-slate-400 text-lg" />
                    <input
                      className="w-full pl-10 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-400 focus:border-slate-400 text-slate-900 transition-all"
                      placeholder="ex: FB-123"
                      value={profileCode}
                      onChange={(e) => setProfileCode(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Esteira</label>
                  <div className="relative flex items-center gap-2 pl-10 pr-3 py-2.5 text-sm bg-slate-100 border border-slate-200 rounded-lg text-slate-600">
                    <MIcon name="layers" className="absolute left-3 top-2.5 text-slate-400 text-lg" />
                    7 Dias - Básica
                    <span className="ml-auto text-[10px] font-bold text-slate-400 uppercase">Automático</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Após concluir 7 dias, avança automaticamente para 15 e depois 30 dias.</p>
                </div>
                {profileCode.trim() ? (
                  <button
                    onClick={handleCreate}
                    disabled={creating}
                    className="w-full bg-[#1876f2] hover:bg-[#1565c0] text-white font-bold py-3 rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                  >
                    <MIcon name="play_arrow" className="text-lg" />
                    {creating ? "Atribuindo..." : "Iniciar Tarefa"}
                  </button>
                ) : isTimerActive && selectedProfileId ? (
                  <button
                    onClick={() => setFinishSignal(prev => prev + 1)}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 text-sm"
                  >
                    <MIcon name="check_circle" className="text-lg" />
                    Finalizar Tarefa
                  </button>
                ) : selectedProfileId && selectedTasks.some(t => !t.completed) ? (
                  <button
                    onClick={() => setStartSignal(prev => prev + 1)}
                    className="w-full bg-[#1876f2] hover:bg-[#1565c0] text-white font-bold py-3 rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 text-sm"
                  >
                    <MIcon name="play_arrow" className="text-lg" />
                    Iniciar Tarefa
                  </button>
                ) : (
                  <button
                    onClick={handleCreate}
                    disabled={creating || !profileCode.trim()}
                    className="w-full bg-[#1876f2] hover:bg-[#1565c0] text-white font-bold py-3 rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                  >
                    <MIcon name="assignment_ind" className="text-lg" />
                    {creating ? "Atribuindo..." : "Atribuir Perfil"}
                  </button>
                )}
                <p className="text-[11px] text-slate-400 text-center leading-tight">
                  Certifique-se de que o perfil está logado no navegador multilogin antes de iniciar.
                </p>
              </div>
            </div>

            {profiles.length > 1 && (
              <div className="mt-3 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-100">
                  <h3 className="text-xs font-bold text-slate-600">Perfis em Aquecimento</h3>
                </div>
                <div className="max-h-40 overflow-y-auto">
                  {profiles.map((p) => {
                    const prog = getProgress(p);
                    const isSelected = selectedProfileId === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => { setSelectedProfileId(p.id); if (!tasks[p.id]) fetchTasks(p.id); }}
                        className={`flex items-center gap-2.5 px-4 py-2 cursor-pointer border-b border-slate-50 transition-colors ${isSelected ? "bg-slate-100" : "hover:bg-slate-50"}`}
                      >
                        <MIcon
                          name={p.status === "completed" ? "check_circle" : p.status === "restricted" ? "warning" : "play_circle"}
                          className={`text-base ${p.status === "completed" ? "text-green-500" : p.status === "restricted" ? "text-red-500" : "text-[#1876f2]"}`}
                        />
                        <div className="flex-grow min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{p.profile_code}</p>
                          <p className="text-[11px] text-slate-500">
                            {TRACKS[p.track_type]?.label} • {prog}%
                            {p.created_by && creatorNames[p.created_by] && <span className="ml-1 text-[#1876f2]">• {creatorNames[p.created_by]}</span>}
                          </p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          p.status === "active" ? "bg-blue-100 text-[#1876f2]" :
                          p.status === "completed" ? "bg-green-50 text-green-600" :
                          p.status === "restricted" ? "bg-red-50 text-red-600" :
                          "bg-yellow-50 text-yellow-600"
                        }`}>
                          {p.status === "active" ? "Ativo" : p.status === "completed" ? "Concluído" : p.status === "restricted" ? "Restrição" : "Pausado"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          <section className="lg:col-span-7">
            {loading ? (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
                <MIcon name="hourglass_empty" className="text-slate-300 text-3xl" />
                <p className="text-slate-500 text-xs mt-2">Carregando...</p>
              </div>
            ) : !selectedProfile ? (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
                <MIcon name="thermostat" className="text-slate-300 text-3xl" />
                <p className="text-slate-500 text-xs mt-2">Informe o código do perfil para iniciar o aquecimento.</p>
              </div>
            ) : !selectedTasks.some(t => !t.completed) ? (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
                <MIcon name="check_circle" className="text-green-500 text-3xl" />
                <p className="text-sm font-bold text-green-600 mt-2">Tarefa do dia concluída para "{selectedProfile.profile_code}"!</p>
                <p className="text-xs text-slate-500 mt-1">Informe o próximo código de perfil no painel ao lado.</p>
              </div>
            ) : (
              <WarmingSessionTimer
                profile={selectedProfile}
                tasks={selectedTasks}
                trackLabel={selectedTrackDef?.label || selectedProfile.track_type}
                finishSignal={finishSignal}
                startSignal={startSignal}
                onTimerStateChange={(isRunning, taskTitle, elapsedVal) => {
                  setIsTimerActive(isRunning);
                  setActiveTaskTitle(taskTitle);
                  setCurrentElapsed(elapsedVal);
                }}
                onTaskCompleted={async () => {
                  fetchProfiles();
                  // After finishing a task, clear selection so operator enters next profile code
                  toast.success("✅ Tarefa concluída! Informe o próximo código de perfil.");
                  setSelectedProfileId(null);
                  setProfileCode("");
                  setIsTimerActive(false);
                }}
                onTrackCompleted={async (prof) => {
                  const NEXT_TRACK: Record<string, string> = { "7_days": "15_days", "15_days": "30_days" };
                  const nextTrackKey = NEXT_TRACK[prof.track_type];
                  if (!nextTrackKey) return;

                  const nextCustomTasks = configTasks[nextTrackKey] || [];
                  const nextTrackDef = TRACKS[nextTrackKey];
                  const tasksToUse = nextCustomTasks.length > 0 ? nextCustomTasks : nextTrackDef.tasks;

                  await supabase.from("warming_profiles").update({
                    track_type: nextTrackKey,
                    track_days: tasksToUse.length,
                    current_day: 1,
                    status: "active",
                    updated_at: new Date().toISOString(),
                  }).eq("id", prof.id);

                  const taskRows = tasksToUse.map((t, i) => ({
                    profile_id: prof.id,
                    day_number: i + 1,
                    title: t.title,
                    description: t.description,
                  }));
                  await supabase.from("warming_tasks").insert(taskRows);

                  toast.success(`🎉 Perfil ${prof.profile_code} avançou para a esteira ${nextTrackDef.label}!`);
                  fetchTasks(prof.id);
                  fetchProfiles();
                }}
              />
            )}
          </section>
        </div>
      )}

      {/* ── Gestão Tab (Operator Dashboard) ── */}
      {activeTab === "gestao" && (
        <WarmingOperatorDashboard
          profiles={profiles}
          tasks={tasks}
          creatorNames={creatorNames}
          onRefresh={fetchProfiles}
        />
      )}

      {/* ── Relatórios Tab ── */}
      {activeTab === "relatorios" && (
        <main className="flex-1 px-6 md:px-8 lg:px-12 py-8 max-w-6xl mx-auto w-full space-y-8">
          {/* Summary Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-slate-500 text-sm font-medium mb-1">Total Perfis Aquecidos</p>
              <div className="flex items-end justify-between">
                <h3 className="text-3xl font-black text-slate-900">{totalProfiles.toLocaleString()}</h3>
                <span className="text-slate-400 text-sm font-medium">—</span>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-slate-500 text-sm font-medium mb-1">Taxa de Sucesso (%)</p>
              <div className="flex items-end justify-between">
                <h3 className="text-3xl font-black text-slate-900">
                  {totalProfiles > 0 ? ((completedProfiles / totalProfiles) * 100).toFixed(1) : "0.0"}%
                </h3>
                <span className="text-slate-400 text-sm font-medium">—</span>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-slate-500 text-sm font-medium mb-1">Tempo Médio Aquecimento</p>
              <div className="flex items-end justify-between">
                <h3 className="text-3xl font-black text-slate-900">
                  {totalProfiles > 0 ? Math.round(profiles.reduce((acc, p) => acc + p.current_day, 0) / totalProfiles) : 0} dias
                </h3>
                <span className="text-slate-400 text-sm font-medium">—</span>
              </div>
            </div>
          </div>

          {/* Performance Chart */}
          <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h4 className="font-bold text-lg">Desempenho de Aquecimento (30 dias)</h4>
              <div className="flex gap-4">
                <span className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  <span className="w-3 h-2 rounded-full bg-gradient-to-r from-[#3b82f6] to-[#ef4444]" /> Frio → Quente
                </span>
              </div>
            </div>
            <div className="h-64 w-full bg-slate-50 rounded-lg flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 flex items-end px-4 gap-2">
                {[24, 40, 50, 33, 60, 66, 75, 100, 80, 86, 50, 75].map((h, i, arr) => {
                  const t = i / (arr.length - 1);
                  const r = Math.round(59 + t * (239 - 59));
                  const g = Math.round(130 + t * (68 - 130));
                  const b = Math.round(246 + t * (68 - 246));
                  return (
                    <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${h}%`, backgroundColor: `rgb(${r},${g},${b})` }} />
                  );
                })}
              </div>
              <p className="relative z-10 text-slate-400 text-sm font-medium">Gráfico de Performance Temporal</p>
            </div>
          </section>

          {/* Recent Reports Table */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h4 className="font-bold text-lg">Relatórios Recentes</h4>
              <div className="relative">
                <input
                  className="pl-9 pr-4 py-2 text-sm bg-slate-100 border-none rounded-lg focus:ring-2 focus:ring-slate-400 w-64"
                  placeholder="Filtrar perfis..."
                  type="text"
                  value={reportFilter}
                  onChange={(e) => setReportFilter(e.target.value)}
                />
                <MIcon name="search" className="absolute left-3 top-2 text-slate-400 text-sm" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Código do Perfil</th>
                    <th className="px-6 py-4">Esteira Selecionada</th>
                    <th className="px-6 py-4">Data de Início</th>
                    <th className="px-6 py-4">Tempo Operador</th>
                    <th className="px-6 py-4">Status Final</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredReportProfiles.map((p) => {
                    const profileTasks = tasks[p.id] || [];
                    const totalSeconds = profileTasks.reduce((acc, t) => acc + (t.duration_seconds || 0), 0);
                    return (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900">#{p.profile_code}</td>
                      <td className="px-6 py-4">Esteira {p.track_days} dias</td>
                      <td className="px-6 py-4">{new Date(p.start_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}</td>
                      <td className="px-6 py-4">
                        {totalSeconds > 0 ? (
                          <span className="flex items-center gap-1 text-sm font-medium text-slate-700">
                            <MIcon name="timer" className="text-sm text-slate-400" />
                            {formatDuration(totalSeconds)}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-sm">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          p.status === "completed" ? "bg-emerald-100 text-emerald-800" :
                          p.status === "restricted" ? "bg-rose-100 text-rose-800" :
                          "bg-blue-100 text-[#1876f2]"
                        }`}>
                          {p.status === "completed" ? "Sucesso" : p.status === "restricted" ? "Falha" : "Em andamento"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => { setSelectedProfileId(p.id); if (!tasks[p.id]) fetchTasks(p.id); setActiveTab("esteiras"); }}
                          className="text-[#1876f2] font-bold text-sm hover:underline"
                        >
                          Ver Detalhes
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                  {filteredReportProfiles.length === 0 && (
                    <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">Nenhum perfil encontrado</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-6 border-t border-slate-200 flex items-center justify-between">
              <p className="text-sm text-slate-500">Mostrando {filteredReportProfiles.length} de {totalProfiles} resultados</p>
              <div className="flex gap-2">
                <button className="px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Anterior</button>
                <button className="px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Próximo</button>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* ── Configurações Tab ── */}
      {activeTab === "configuracoes" && (
        <main className="flex-1 p-6 md:p-10 max-w-5xl mx-auto w-full space-y-6">
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MIcon name="settings_accessibility" className="text-[#1876f2]" />
                <h2 className="text-lg font-bold text-slate-900">Configuração de Ações da Esteira</h2>
              </div>
              <div className="flex bg-slate-100 p-1 rounded-lg">
                {(["7_days", "15_days", "30_days"] as const).map((tk) => (
                  <button
                    key={tk}
                    onClick={() => setConfigTrack(tk)}
                    className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
                      configTrack === tk ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {tk === "7_days" ? "7 Dias" : tk === "15_days" ? "15 Dias" : "30 Dias"}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-6 space-y-3 max-h-[400px] overflow-y-auto">
              {configTasks[configTrack].map((task, i) => (
                <div key={i} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-blue-100 text-[#1876f2] font-bold text-xs rounded-full">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <input
                    className="flex-1 bg-transparent border-none p-0 text-sm text-slate-900 focus:ring-0 outline-none"
                    type="text"
                    value={task.title}
                    onChange={(e) => {
                      const val = e.target.value;
                      updateConfigTasks(prev => {
                        const updated = { ...prev };
                        updated[configTrack] = [...updated[configTrack]];
                        updated[configTrack][i] = { ...updated[configTrack][i], title: val };
                        return updated;
                      });
                    }}
                  />
                  <MIcon name="drag_indicator" className="text-slate-400 text-sm cursor-move" />
                </div>
              ))}
              <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-blue-100 text-[#1876f2] font-bold text-xs rounded-full">
                  {String(configTasks[configTrack].length + 1).padStart(2, "0")}
                </span>
                <input
                  id="new-track-action-input"
                  className="flex-1 bg-transparent border-none p-0 text-sm text-slate-900 focus:ring-0 outline-none placeholder:text-slate-400 placeholder:italic"
                  type="text"
                  placeholder={`Adicionar nova ação para o Dia ${configTasks[configTrack].length + 1}...`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
                      const newTitle = (e.target as HTMLInputElement).value.trim();
                      updateConfigTasks(prev => {
                        const updated = { ...prev };
                        updated[configTrack] = [...updated[configTrack], { title: newTitle, description: "" }];
                        return updated;
                      });
                      (e.target as HTMLInputElement).value = "";
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const input = document.getElementById("new-track-action-input") as HTMLInputElement;
                    if (input && input.value.trim()) {
                      const newTitle = input.value.trim();
                      updateConfigTasks(prev => {
                        const updated = { ...prev };
                        updated[configTrack] = [...updated[configTrack], { title: newTitle, description: "" }];
                        return updated;
                      });
                      input.value = "";
                    }
                  }}
                  className="text-[#1876f2] hover:text-blue-700 transition-colors"
                >
                  <MIcon name="add_circle" className="text-xl" />
                </button>
              </div>
            </div>
          </section>

          {/* Definição de Trust Tiers */}
           <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MIcon name="verified_user" className="text-[#1876f2]" />
                <h2 className="text-lg font-bold text-slate-900">Definição de Níveis de Confiança</h2>
              </div>
              <button
                onClick={() => setTrustTiers([...trustTiers, { label: `Nível ${trustTiers.length + 1}`, color: "bg-slate-100 text-slate-700", range: "0 - 0", criteria: "" }])}
                className="flex items-center gap-1 text-[#1876f2] text-sm font-bold hover:underline"
              >
                <MIcon name="add_circle" className="text-sm" /> Adicionar
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-6 py-3 font-bold text-slate-500 uppercase tracking-wider text-[10px]">Nível</th>
                    <th className="px-6 py-3 font-bold text-slate-500 uppercase tracking-wider text-[10px]">Faixa de Score</th>
                    <th className="px-6 py-3 font-bold text-slate-500 uppercase tracking-wider text-[10px]">Critérios de Validação</th>
                    <th className="px-6 py-3 font-bold text-slate-500 uppercase tracking-wider text-[10px] w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {trustTiers.map((tier, i) => (
                    <tr key={i} className="group">
                      <td className="px-6 py-4">
                        <input
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${tier.color} border-none outline-none bg-transparent w-full max-w-[220px]`}
                          value={tier.label}
                          onChange={(e) => { const t = [...trustTiers]; t[i] = { ...t[i], label: e.target.value }; setTrustTiers(t); }}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs w-20 text-slate-900"
                          value={tier.range}
                          onChange={(e) => { const t = [...trustTiers]; t[i] = { ...t[i], range: e.target.value }; setTrustTiers(t); }}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          className="w-full bg-transparent border-none p-0 text-xs text-slate-700 focus:ring-0 outline-none"
                          value={tier.criteria}
                          onChange={(e) => { const t = [...trustTiers]; t[i] = { ...t[i], criteria: e.target.value }; setTrustTiers(t); }}
                        />
                      </td>
                      <td className="px-6 py-4 text-right">
                        {trustTiers.length > 1 && (
                          <button
                            onClick={() => setTrustTiers(trustTiers.filter((_, idx) => idx !== i))}
                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all"
                          >
                            <MIcon name="delete" className="text-base" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Zerar Esteiras e Perfis */}
          <section className="bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-red-100 flex items-center gap-3">
              <MIcon name="warning" className="text-red-500" />
              <h2 className="text-lg font-bold text-red-700">Zona de Perigo</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-red-50 border border-red-100 rounded-lg p-4">
                <h3 className="font-bold text-sm text-red-800 mb-1">Zerar todas as Esteiras e Perfis</h3>
                <p className="text-xs text-red-600 mb-4">
                  Esta ação irá <strong>excluir permanentemente</strong> todos os perfis de aquecimento e suas tarefas associadas. Não é possível desfazer.
                </p>
                {!showResetConfirm ? (
                  <button
                    onClick={() => setShowResetConfirm(true)}
                    className="flex items-center gap-2 bg-red-600 text-white font-bold text-sm px-5 py-2.5 rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <MIcon name="delete_forever" className="text-base" />
                    Zerar Tudo
                  </button>
                ) : (
                  <div className="space-y-3 bg-white p-4 rounded-lg border border-red-200">
                    <p className="text-xs font-bold text-red-800">Para confirmar, digite sua senha de administrador:</p>
                    <input
                      type="password"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-red-400/30 outline-none"
                      placeholder="Senha do admin"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                    />
                    {resetError && <p className="text-xs text-red-600 font-medium">{resetError}</p>}
                    <div className="flex gap-3">
                      <button
                        onClick={handleResetAll}
                        disabled={resetting || !resetPassword}
                        className="flex items-center gap-2 bg-red-600 text-white font-bold text-sm px-5 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        {resetting ? (
                          <><MIcon name="hourglass_empty" className="text-base animate-spin" /> Zerando...</>
                        ) : (
                          <><MIcon name="delete_forever" className="text-base" /> Confirmar Reset</>
                        )}
                      </button>
                      <button
                        onClick={() => { setShowResetConfirm(false); setResetPassword(""); setResetError(""); }}
                        className="px-5 py-2 text-sm font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Integrações de API */}
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
              <MIcon name="api" className="text-[#1876f2]" />
              <h2 className="text-lg font-bold text-slate-900">Integrações de API</h2>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Facebook App ID</label>
                  <input className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-slate-400/20 outline-none" placeholder="Ex: 827419230192" type="text" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Facebook App Secret</label>
                  <input className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-slate-400/20 outline-none" type="password" defaultValue="••••••••••••••••" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Token da API de Conversão do Pixel</label>
                <div className="relative">
                  <input className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm pr-12 text-slate-900 focus:ring-2 focus:ring-slate-400/20 outline-none" type="text" defaultValue="EAAGm0PX4ZCpsBAK7ZA9Bf7ZB8qZC4ZB9ZA..." />
                  <button
                    onClick={() => { navigator.clipboard.writeText("EAAGm0PX4ZCpsBAK7ZA9Bf7ZB8qZC4ZB9ZA..."); toast.success("Token copiado"); }}
                    className="absolute right-2 top-1.5 p-1 text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    <MIcon name="content_copy" className="text-base" />
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-2 italic">Mantenha seus tokens seguros. Nunca compartilhe estas chaves com terceiros.</p>
              </div>
            </div>
          </section>

        </main>
      )}

    </div>
  );
}
