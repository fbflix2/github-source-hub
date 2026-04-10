import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

import WarmingOperatorDashboard from "@/components/admin/warming/WarmingOperatorDashboard";
import WarmingSessionTimer from "@/components/admin/warming/WarmingSessionTimer";
import ProfileQualityMeter from "@/components/admin/warming/ProfileQualityMeter";
import ProfileQuickNotes from "@/components/admin/warming/ProfileQuickNotes";
import ProfileQuickInfo from "@/components/admin/warming/ProfileQuickInfo";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  DEFAULT_PROFILE_QUALITY_DATA,
  DEFAULT_READY_CRITERIA,
  isProfileReadyForSale,
  parseReadyCriteria,
} from "@/lib/warming-ready";

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
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<WarmingProfile[]>([]);
  const [tasks, setTasks] = useState<Record<string, WarmingTask[]>>({});
  const [loading, setLoading] = useState(true);
  const [creatorNames, setCreatorNames] = useState<Record<string, string>>({});
  const [creatorAvatars, setCreatorAvatars] = useState<Record<string, string | null>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  const currentUserIdRef = useRef<string | null>(null);
  const isUserAdminRef = useRef(false);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
  const [operatorGoals, setOperatorGoals] = useState<{ daily: number | null; weekly: number | null }>({ daily: null, weekly: null });
  const [profileCode, setProfileCode] = useState("");
  const [selectedTrack, setSelectedTrack] = useState("7_days");
  const [operationMode, setOperationMode] = useState<"register" | "execute">("execute");
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"count" | "currency">("count");
  const [queueSearch, setQueueSearch] = useState("");
  const [operatorDisplayName, setOperatorDisplayName] = useState("");
  const [operatorCoverUrl, setOperatorCoverUrl] = useState<string | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [commissionRate, setCommissionRate] = useState(0.25);
  const [creating, setCreating] = useState(false);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [activeTaskTitle, setActiveTaskTitle] = useState<string | null>(null);
  const [currentElapsed, setCurrentElapsed] = useState(0);
  const [finishSignal, setFinishSignal] = useState(0);
  const [startSignal, setStartSignal] = useState(0);
  const [activeTab, setActiveTab] = useState<"dashboard" | "esteiras" | "revisao" | "configuracoes">("dashboard");
  const [reviewFilter2FA, setReviewFilter2FA] = useState(false);
  const [reviewFilterBM, setReviewFilterBM] = useState(false);
  const [reviewFilterPage, setReviewFilterPage] = useState(false);
  const [reviewSearch, setReviewSearch] = useState("");
  const [teamOperators, setTeamOperators] = useState<{ id: string; name: string }[]>([]);
  const [configTasks, setConfigTasks] = useState<Record<string, { title: string; description: string }[]>>({
    "7_days": TRACKS["7_days"].tasks.map(t => ({ title: t.title, description: t.description })),
    "15_days": TRACKS["15_days"].tasks.map(t => ({ title: t.title, description: t.description })),
    "30_days": TRACKS["30_days"].tasks.map(t => ({ title: t.title, description: t.description })),
  });
  const [configLoaded, setConfigLoaded] = useState(false);
  const [readyCriteria, setReadyCriteria] = useState(DEFAULT_READY_CRITERIA);
  const configSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoadedProfilesRef = useRef(false);
  const userContextReadyRef = useRef(false);

  useEffect(() => {
    if (!document.querySelector('link[href*="Material+Symbols+Outlined"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap";
      document.head.appendChild(link);
    }
    // fetchProfiles is called after user context is ready (see below)
    loadConfigFromDB();

    // Realtime subscriptions for instant updates
    const profilesChannel = supabase
      .channel("operator-profiles-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "warming_profiles" }, () => {
        if (userContextReadyRef.current) fetchProfiles();
      })
      .subscribe();

    const tasksChannel = supabase
      .channel("operator-tasks-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "warming_tasks" }, () => {
        if (userContextReadyRef.current) fetchProfiles();
      })
      .subscribe();

    // Realtime for config changes from admin
    const configChannel = supabase
      .channel("operator-config-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "site_settings" }, (payload) => {
        const row = payload.new as any;
        if (row?.key === "warming_track_config") {
          loadConfigFromDB();
        }
        if (row?.key === "warming_ready_criteria") {
          try {
            setReadyCriteria(parseReadyCriteria(JSON.parse(row.value)));
          } catch {}
        }
      })
      .subscribe();

    // Cleanup function
    const cleanupChannels = () => {
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(tasksChannel);
      supabase.removeChannel(configChannel);
    };

    // Fetch current user — THEN fetch profiles so operator filtering works
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        currentUserIdRef.current = user.id;
        isUserAdminRef.current = false;
        setCurrentUserId(user.id);
        // Check if user is admin — AWAIT so isUserAdmin is set before fetchProfiles
        const { data: adminData } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' as const });
        isUserAdminRef.current = !!adminData;
        setIsUserAdmin(!!adminData);
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
        userContextReadyRef.current = true;
        // NOW fetch profiles — user context is ready
        fetchProfiles();
      }
    });
    // Fetch team operators (moderators) for admin assignment
    fetchTeamOperators();
    // Load commission rate
    supabase.from("site_settings").select("value").eq("key", "warming_commission_rate").maybeSingle().then(({ data }) => {
      if (data?.value) {
        const parsed = parseFloat(data.value);
        if (!isNaN(parsed)) setCommissionRate(parsed);
      }
    });
    supabase.from("site_settings").select("value").eq("key", "warming_ready_criteria").maybeSingle().then(({ data }) => {
      if (data?.value) {
        try {
          setReadyCriteria(parseReadyCriteria(JSON.parse(data.value)));
        } catch {}
      }
    });
    return () => {
      cleanupChannels();
    };
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

  const fetchTeamOperators = async () => {
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

  const fetchProfiles = async () => {
    const uid = currentUserIdRef.current;
    const admin = isUserAdminRef.current;
    if (!userContextReadyRef.current || !uid) return;
    if (!hasLoadedProfilesRef.current) {
      setLoading(true);
    }
    let query = supabase
      .from("warming_profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (!admin) {
      query = query.eq("created_by", uid);
    }

    const { data, error } = await query;
    if (error) {
      toast.error("Erro ao carregar perfis");
    } else {
      setProfiles(data || []);
      // Fetch tasks for ALL profiles (needed for avg time calculation)
      if (data && data.length > 0) {
        // Paginate tasks to avoid 1000 row limit
        const profileIds = data.map((p: any) => p.id);
        const allTasks: any[] = [];
        const pageSize = 1000;
        let from = 0;
        while (true) {
          const { data: batch } = await supabase
            .from("warming_tasks")
            .select("*")
            .in("profile_id", profileIds)
            .order("day_number", { ascending: true })
            .range(from, from + pageSize - 1);
          if (!batch || batch.length === 0) break;
          allTasks.push(...batch);
          if (batch.length < pageSize) break;
          from += pageSize;
        }
        const grouped: Record<string, WarmingTask[]> = {};
        allTasks.forEach((t: any) => {
          if (!grouped[t.profile_id]) grouped[t.profile_id] = [];
          grouped[t.profile_id].push(t);
        });
        setTasks(grouped);
        // Auto-selection will be handled by the useEffect with sortedActiveQueue
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
    hasLoadedProfilesRef.current = true;
    setLoading(false);
  };

  const fetchTasks = async (profileId: string) => {
    if (!isUserAdmin && !profiles.some((p) => p.id === profileId && p.created_by === currentUserId)) {
      return;
    }
    const { data } = await supabase
      .from("warming_tasks")
      .select("*")
      .eq("profile_id", profileId)
      .order("day_number", { ascending: true });
    if (data) setTasks((prev) => ({ ...prev, [profileId]: data }));
  };

  const checkAndMoveProfileToReady = async (profileId: string) => {
    const profile = profiles.find((p) => p.id === profileId);
    if (!profile || profile.status === "completed") return false;

    const { data: qualityRow } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", `warming_quality_${profileId}`)
      .maybeSingle();

    const quality = qualityRow?.value
      ? { ...DEFAULT_PROFILE_QUALITY_DATA, ...JSON.parse(qualityRow.value) }
      : DEFAULT_PROFILE_QUALITY_DATA;

    if (!isProfileReadyForSale(profile, quality, readyCriteria)) return false;

    await supabase
      .from("warming_profiles")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", profileId);

    // Mark earning as confirmed
    await supabase.from("operator_earnings").update({
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("profile_id", profileId);

    toast.success(`✅ Perfil "${profile.profile_code}" movido para Perfis Prontos.`);
    return true;
  };

  const handleCreate = async () => {
    if (!profileCode.trim()) { toast.error("Digite o código do perfil"); return; }
    // Always reset timer state when starting a new profile
    setIsTimerActive(false);
    setActiveTaskTitle(null);
    setCurrentElapsed(0);
    // Check for duplicate profile code
    const { data: existing } = await supabase
      .from("warming_profiles")
      .select("id, status, created_by")
      .eq("profile_code", profileCode.trim())
      .maybeSingle();
    if (existing) {
      if (!isUserAdmin && existing.created_by && existing.created_by !== currentUserId) {
        toast.error(`O perfil "${profileCode.trim()}" está cadastrado para outro operador.`);
        setProfileCode("");
        return;
      }
      // Profile exists: select it and start if it has pending tasks
      if (existing.status === "active") {
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
        setTimeout(() => setStartSignal(s => s + 1), 400);
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
    const assignTo = user?.id || null;
    const { data: profile, error } = await supabase
      .from("warming_profiles")
      .insert({ profile_code: profileCode.trim(), track_type: selectedTrack, track_days: tasksToUse.length, created_by: assignTo })
      .select()
      .single();
    if (error || !profile) { toast.error("Erro ao criar perfil"); setCreating(false); return; }
    const taskRows = tasksToUse.map((t, i) => ({ profile_id: profile.id, day_number: i + 1, title: t.title, description: t.description }));
    await supabase.from("warming_tasks").insert(taskRows);

    // Create earning record for this profile
    if (assignTo) {
      await supabase.from("operator_earnings").insert({
        user_id: assignTo,
        profile_id: profile.id,
        profile_code: profileCode.trim(),
        amount: commissionRate,
        status: "pending",
      }).then(({ error: eErr }) => { if (eErr) console.warn("Earning insert:", eErr); });
    }

    // Both modes: register + auto-start (new profile has priority)
    toast.success(`✅ Perfil "${profileCode.trim()}" cadastrado e iniciando tarefas!`);
    setProfileCode("");
    
    setSelectedProfileId(profile.id);
    await fetchProfiles();
    await fetchTasks(profile.id);
    setCreating(false);
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

  const selectedProfile = profiles.find(
    (p) => p.id === selectedProfileId && (isUserAdmin || p.created_by === currentUserId)
  );
  const selectedTasks = selectedProfileId ? tasks[selectedProfileId] || [] : [];
  const selectedTrackDef = selectedProfile ? TRACKS[selectedProfile.track_type] : null;
  const selectedProgress = selectedProfile ? getProgress(selectedProfile) : 0;

  const DEFAULT_COVERS = [
    "/covers/cover-1.jpg",
    "/covers/cover-2.jpg",
    "/covers/cover-3.jpg",
    "/covers/cover-4.jpg",
    "/covers/cover-5.jpg",
  ];

  // Load operator config from profiles table
  useEffect(() => {
    if (currentUserId) {
      supabase.from("profiles").select("full_name, avatar_url").eq("user_id", currentUserId).maybeSingle().then(({ data }) => {
        if (data) {
          setOperatorDisplayName(data.full_name || "");
        }
      });
      // Load cover from site_settings per user
      supabase.from("site_settings").select("value").eq("key", `operator_cover_${currentUserId}`).maybeSingle().then(({ data }) => {
        if (data?.value) setOperatorCoverUrl(data.value);
      });
    }
  }, [currentUserId]);

  const saveOperatorConfig = async () => {
    if (!currentUserId) return;
    setSavingConfig(true);
    try {
      // Update display name
      if (operatorDisplayName.trim()) {
        await supabase.from("profiles").update({ full_name: operatorDisplayName.trim() }).eq("user_id", currentUserId);
        setCurrentUserName(operatorDisplayName.trim());
      }
      // Save cover URL
      const coverKey = `operator_cover_${currentUserId}`;
      const { data: existing } = await supabase.from("site_settings").select("id").eq("key", coverKey).maybeSingle();
      if (existing) {
        await supabase.from("site_settings").update({ value: operatorCoverUrl || "" }).eq("key", coverKey);
      } else {
        await supabase.from("site_settings").insert({ key: coverKey, value: operatorCoverUrl || "" });
      }
      toast.success("Configurações salvas!");
    } catch {
      toast.error("Erro ao salvar configurações");
    }
    setSavingConfig(false);
  };

  const tabs = [
    { key: "dashboard" as const, label: "Painel", icon: "dashboard" },
    { key: "esteiras" as const, label: "Esteiras", icon: "layers" },
  ];

  // Filter profiles: non-admins only see their own profiles
  const visibleProfiles = useMemo(() => {
    if (isUserAdmin) return profiles;
    if (!currentUserId) return [];
    return profiles.filter(p => p.created_by === currentUserId);
  }, [profiles, isUserAdmin, currentUserId]);

  useEffect(() => {
    if (userContextReadyRef.current && currentUserId) {
      fetchProfiles();
    }
  }, [currentUserId, isUserAdmin]);

  // Helper: check if profile was worked on today
  const wasWorkedToday = (profileId: string) => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const profileTasks = tasks[profileId] || [];
    return profileTasks.some(t => t.completed && t.completed_at && new Date(t.completed_at).getTime() >= todayStart);
  };

  // Auto-promote profiles that completed 100% of their current track (7→15, 15→30)
  const promotingRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const NEXT_TRACK: Record<string, string> = { "7_days": "15_days", "15_days": "30_days" };
    const profilesToPromote = profiles.filter(p => {
      if (p.status !== "active") return false;
      if (!NEXT_TRACK[p.track_type]) return false;
      if (promotingRef.current.has(p.id)) return false;
      const profileTasks = tasks[p.id];
      if (!profileTasks || profileTasks.length === 0) return false;
      return profileTasks.every(t => t.completed);
    });

    profilesToPromote.forEach(async (prof) => {
      promotingRef.current.add(prof.id);
      const nextTrackKey = NEXT_TRACK[prof.track_type];
      const nextCustomTasks = configTasks[nextTrackKey] || [];
      const nextTrackDef = TRACKS[nextTrackKey];
      const tasksToUse = nextCustomTasks.length > 0 ? nextCustomTasks : nextTrackDef.tasks;

      // Delete ALL old tasks from previous track before inserting new ones
      await supabase.from("warming_tasks").delete().eq("profile_id", prof.id);

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

      toast.success(`🎉 Perfil ${prof.profile_code} avançou automaticamente para ${nextTrackDef.label}!`);
      promotingRef.current.delete(prof.id);
      fetchProfiles();
    });
  }, [profiles, tasks, configTasks]);

  // Helper: check if profile completed all tasks on current track (pending promotion)
  const isFullyCompleted = (p: WarmingProfile) => {
    const NEXT_TRACK: Record<string, string> = { "7_days": "15_days", "15_days": "30_days" };
    if (!NEXT_TRACK[p.track_type]) return false;
    const profileTasks = tasks[p.id];
    if (!profileTasks || profileTasks.length === 0) return false;
    return profileTasks.every(t => t.completed);
  };

  // Current track tier being shown (progressive: 7→15→30)
  const currentQueueTrack = useMemo(() => {
    const activeProfs = visibleProfiles.filter(p => p.status === "active" && !isFullyCompleted(p));
    const TRACK_ORDER = ["7_days", "15_days", "30_days"];
    
    // In execute mode: only "lock" on a track if it has profiles NOT yet worked today
    // This prevents the queue from being empty when all profiles in a track were already done
    for (const track of TRACK_ORDER) {
      const trackProfs = activeProfs.filter(p => p.track_type === track);
      if (trackProfs.length === 0) continue;
      const hasPending = trackProfs.some(p => !wasWorkedToday(p.id));
      if (hasPending) return track;
    }
    
    // If all tracks are done for today, show the first track that has active profiles
    for (const track of TRACK_ORDER) {
      if (activeProfs.some(p => p.track_type === track)) return track;
    }
    return "7_days";
  }, [visibleProfiles, tasks]);

  // Sort active profiles: PROGRESSIVE — only show current track tier
  const sortedActiveQueue = useMemo(() => {
    // Exclude profiles that are 100% on a promotable track (they'll be auto-promoted)
    const activeProfs = visibleProfiles.filter(p => p.status === "active" && !isFullyCompleted(p));
    
    // Progressive filter: only show profiles from the current track tier
    const trackProfs = activeProfs.filter(p => p.track_type === currentQueueTrack);
    
    // Separate: not worked today (available) vs worked today (done for the day)
    const available = trackProfs.filter(p => !wasWorkedToday(p.id));
    const doneToday = trackProfs.filter(p => wasWorkedToday(p.id));
    
    // Sort available: never worked first, then oldest completion first
    available.sort((a, b) => {
      const aLastCompleted = (tasks[a.id] || [])
        .filter(t => t.completed && t.completed_at)
        .reduce((max, t) => Math.max(max, new Date(t.completed_at!).getTime()), 0);
      const bLastCompleted = (tasks[b.id] || [])
        .filter(t => t.completed && t.completed_at)
        .reduce((max, t) => Math.max(max, new Date(t.completed_at!).getTime()), 0);
      
      if (aLastCompleted === 0 && bLastCompleted === 0) {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (aLastCompleted === 0) return -1;
      if (bLastCompleted === 0) return 1;
      return aLastCompleted - bLastCompleted;
    });
    
    // In execute mode, only show available profiles (hide done today)
    // In register mode, show all but done today go to the end
    if (operationMode === "execute") {
      return available;
    }
    return [...available, ...doneToday];
  }, [visibleProfiles, tasks, operationMode, currentQueueTrack]);

  // Keep the operator pinned to a valid queue item without clearing the right panel first
  useEffect(() => {
    if (operationMode !== "execute") return;

    if (sortedActiveQueue.length === 0) {
      if (!isTimerActive && selectedProfileId) {
        setSelectedProfileId(null);
      }
      return;
    }

    const selectedStillInQueue = selectedProfileId
      ? sortedActiveQueue.some((profile) => profile.id === selectedProfileId)
      : false;

    if (!selectedProfileId || !selectedStillInQueue) {
      const next = sortedActiveQueue[0];
      if (next && next.id !== selectedProfileId) {
        setSelectedProfileId(next.id);
        if (!tasks[next.id]) fetchTasks(next.id);
      }
    }
  }, [selectedProfileId, sortedActiveQueue, operationMode, tasks, isTimerActive]);

  // Dashboard stats from visible profiles
  const totalProfiles = visibleProfiles.length;
  const activeProfiles = visibleProfiles.filter(p => p.status === "active").length;
  const completedProfiles = visibleProfiles.filter(p => p.status === "completed").length;
  const checkpointProfiles = visibleProfiles.filter(p => p.status === "checkpoint").length;
  const restrictedProfiles = visibleProfiles.filter(p => p.status === "restricted" || p.status === "blocked").length;
  const totalPct = totalProfiles > 0 ? Math.round((activeProfiles / totalProfiles) * 100) : 0;

  const newProfiles = visibleProfiles.filter(p => p.track_type === "7_days").length;
  const midProfiles = visibleProfiles.filter(p => p.track_type === "15_days").length;
  const matureProfiles = visibleProfiles.filter(p => p.track_type === "30_days").length;

  const t3 = visibleProfiles.filter(p => p.trust_tier?.includes("3")).length;
  const t2 = visibleProfiles.filter(p => p.trust_tier?.includes("2") && !p.trust_tier?.includes("3")).length;
  const t1 = visibleProfiles.filter(p => {
    if (!p.trust_tier) return false;
    return !p.trust_tier.includes("2") && !p.trust_tier.includes("3");
  }).length;
  const noTier = visibleProfiles.filter(p => !p.trust_tier).length;
  const tierTotal = t3 + t2 + t1 + noTier || 1;
  const t3Pct = Math.round((t3 / tierTotal) * 100);
  const t2Pct = Math.round((t2 / tierTotal) * 100);
  const t1Pct = Math.round(((t1 + noTier) / tierTotal) * 100);
  const predominantTier = t3 > t2 && t3 > (t1 + noTier) ? "Tier 3" : t2 > t3 && t2 > (t1 + noTier) ? "Tier 2" : "Tier 1";


  return (
    <div className="flex flex-col min-h-full bg-[#f5f7f8] dark:bg-[#0a0505] text-slate-900 dark:text-white" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* ── Hero Section ── */}
      <section className="relative overflow-hidden text-white pt-10 pb-16 px-6 md:px-12 lg:px-40" style={operatorCoverUrl ? { backgroundImage: `url(${operatorCoverUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : { background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 40%, #3a3a3a 70%, #1a1a1a 100%)" }}>
        <div className="absolute inset-0 bg-black/50" />
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
              <ThemeToggle />
              <button
                onClick={() => setViewMode(viewMode === "count" ? "currency" : "count")}
                className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors"
                title={viewMode === "count" ? "Ver em R$" : "Ver em quantidade"}
              >
                <MIcon name={viewMode === "count" ? "payments" : "tag"} className="text-white text-xl" />
              </button>
            </div>
          </div>

          {/* Personal stats row */}
          {(() => {
            const myProfiles = currentUserId
              ? profiles.filter(p => isUserAdmin || p.created_by === currentUserId)
              : profiles;
            const todayStart = new Date(); todayStart.setHours(0,0,0,0);
            const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
            
            // Count unique profiles that had tasks completed today/this week
            const profilesWorkedToday = new Set<string>();
            const profilesWorkedThisWeek = new Set<string>();
            myProfiles.forEach(p => {
              (tasks[p.id] || []).forEach(t => {
                if (t.completed && t.completed_at) {
                  const completedTime = new Date(t.completed_at).getTime();
                  if (completedTime >= todayStart.getTime()) profilesWorkedToday.add(p.id);
                  if (completedTime >= weekStart.getTime()) profilesWorkedThisWeek.add(p.id);
                }
              });
            });
            const myToday = profilesWorkedToday.size;
            const myWeek = profilesWorkedThisWeek.size;
            const myActive = myProfiles.filter(p => p.status === "active").length;
            const myCompleted = myProfiles.filter(p => p.status === "completed").length;
            // All-time: count profiles that fully completed their track (all tasks done)
            const myAllTimeCompleted = myProfiles.filter(p => {
              const pTasks = tasks[p.id] || [];
              return pTasks.length > 0 && pTasks.every(t => t.completed);
            }).length;
            let myTotalTime = 0;
            let myTaskCount = 0;
            myProfiles.forEach(p => {
              (tasks[p.id] || []).forEach(t => {
                if (t.duration_seconds) { myTotalTime += t.duration_seconds; myTaskCount++; }
              });
            });
            const avgPerProfile = myProfiles.length > 0 ? Math.round(myTotalTime / myProfiles.length) : 0;

            const isCurrency = viewMode === "currency";
            const fmtVal = (count: number) => isCurrency
              ? `R$ ${(count * commissionRate).toFixed(2).replace(".", ",")}`
              : String(count);

            return (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-xl border border-white/15">
                  <p className="text-[10px] font-medium text-white/50 uppercase tracking-wider">
                    {isCurrency ? "Ganhos Hoje" : "Perfis Hoje"}
                  </p>
                  <div className="flex items-end gap-2 mt-1">
                    <p className={`font-black ${isCurrency ? "text-xl" : "text-2xl"}`}>{fmtVal(myToday)}</p>
                    {!isCurrency && operatorGoals.daily && (
                      <p className="text-xs text-white/40 mb-0.5">/ {operatorGoals.daily}</p>
                    )}
                  </div>
                  {!isCurrency && operatorGoals.daily && (
                    <div className="mt-2 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${myToday >= operatorGoals.daily ? "bg-emerald-400" : "bg-[#1876f2]"}`} style={{ width: `${Math.min(100, (myToday / operatorGoals.daily) * 100)}%` }} />
                    </div>
                  )}
                </div>
                <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-xl border border-white/15">
                  <p className="text-[10px] font-medium text-white/50 uppercase tracking-wider">
                    {isCurrency ? "Ganhos Semana" : "Perfis Semana"}
                  </p>
                  <div className="flex items-end gap-2 mt-1">
                    <p className={`font-black ${isCurrency ? "text-xl" : "text-2xl"}`}>{fmtVal(myWeek)}</p>
                    {!isCurrency && operatorGoals.weekly && (
                      <p className="text-xs text-white/40 mb-0.5">/ {operatorGoals.weekly}</p>
                    )}
                  </div>
                  {!isCurrency && operatorGoals.weekly && (
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
                  <p className="text-[10px] font-medium text-white/50 uppercase tracking-wider">
                    {isCurrency ? "Seu Saldo" : "Total Meus Perfis"}
                  </p>
                  <p className={`font-black mt-1 ${isCurrency ? "text-xl text-emerald-400" : "text-2xl"}`}>
                    {isCurrency ? fmtVal(myAllTimeCompleted) : myProfiles.length}
                  </p>
                </div>
              </div>
            );
          })()}
        </div>
      </section>

      {/* ── Tab Navigation ── */}
      <nav className="sticky top-0 z-50 bg-white dark:bg-[#111] border-b border-slate-200 dark:border-white/10 px-6 md:px-12 lg:px-40">
        <div className="max-w-[1200px] mx-auto flex gap-8">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 border-b-[3px] pb-4 pt-5 font-bold text-sm tracking-wide transition-colors ${
                activeTab === tab.key
                  ? "border-[#1876f2] text-slate-900 dark:text-white"
                  : "border-transparent text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Dashboard Tab ── */}
      {activeTab === "dashboard" && (
        <main className="flex-1 px-6 md:px-12 lg:px-40 py-5 max-w-[1200px] mx-auto w-full">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
            {[
              { label: "Total Perfis", value: totalProfiles, icon: "group", color: "text-[#1876f2]", sub: "Sem dados anteriores" },
              { label: "Em Aquecimento", value: activeProfiles, icon: "local_fire_department", color: "text-amber-500", sub: `${totalPct}% do total` },
              { label: "Prontos p/ Uso", value: completedProfiles, icon: "check_circle", color: "text-emerald-500", sub: "Alta maturidade", subIcon: "verified", subColor: "text-emerald-500" },
              { label: "Checkpoint", value: checkpointProfiles, icon: "warning", color: "text-yellow-500", sub: checkpointProfiles > 0 ? "Requer atenção" : "Nenhum no momento", subIcon: checkpointProfiles > 0 ? "priority_high" : undefined, subColor: checkpointProfiles > 0 ? "text-yellow-500" : undefined },
              { label: "Perdas (Mês)", value: restrictedProfiles, icon: "block", color: "text-rose-500", sub: restrictedProfiles > 0 ? `${restrictedProfiles} bloqueado(s)` : "Sem dados anteriores", subColor: restrictedProfiles > 0 ? "text-rose-500" : undefined },
            ].map(kpi => (
              <div key={kpi.label} className="bg-white dark:bg-white/5 px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
                <div className="flex items-center justify-between mb-0.5">
                  <p className="text-slate-500 dark:text-white/50 font-medium text-[11px]">{kpi.label}</p>
                  <MIcon name={kpi.icon} className={`text-base ${kpi.color}`} />
                </div>
                <p className="text-2xl font-black text-slate-900 dark:text-white">{kpi.value.toLocaleString()}</p>
                <div className={`flex items-center gap-1 ${kpi.subColor || "text-slate-400"} font-medium text-[11px]`}>
                  {kpi.subIcon && <MIcon name={kpi.subIcon} className="text-xs" />}
                  <span>{kpi.sub}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Progress by Stage + Trust Tier */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm px-5 py-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold">Progresso por Estágio</h3>
                  <p className="text-[11px] text-slate-500">Maturidade dos perfis na esteira</p>
                </div>
                <select className="bg-slate-50 dark:bg-white/10 dark:text-white border-none rounded-lg text-xs font-medium focus:ring-slate-400 py-1 px-2">
                  <option>Últimos 30 dias</option>
                  <option>Últimos 7 dias</option>
                </select>
              </div>
              <div className="space-y-4">
                {[
                  { label: "Esteira 7 Dias", count: newProfiles, opacity: "bg-[#1876f2]/40" },
                  { label: "Esteira 15 Dias", count: midProfiles, opacity: "bg-[#1876f2]/70" },
                  { label: "Esteira 30 Dias", count: matureProfiles, opacity: "bg-[#1876f2]" },
                ].map(track => (
                  <div key={track.label} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold">
                      <span>{track.label}</span>
                      <span>{track.count} perfis</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full ${track.opacity} rounded-full`} style={{ width: `${totalProfiles ? Math.round((track.count / totalProfiles) * 100) : 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Trust Tier Distribution */}
            <div className="bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm px-5 py-4">
              <h3 className="text-sm font-bold mb-3">Distribuição de Confiança</h3>
              <div className="flex items-center gap-4">
                <div className="relative w-28 h-28 flex-shrink-0">
                  <svg className="w-full h-full" viewBox="0 0 36 36">
                    <circle className="stroke-slate-100 dark:stroke-white/10" cx="18" cy="18" fill="none" r="16" strokeWidth="4" />
                    <circle className="stroke-[#1876f2]" cx="18" cy="18" fill="none" r="16" strokeDasharray={`${t2Pct}, 100`} strokeDashoffset={`-${t3Pct}`} strokeLinecap="round" strokeWidth="4" />
                    <circle className="stroke-emerald-500" cx="18" cy="18" fill="none" r="16" strokeDasharray={`${t3Pct}, 100`} strokeLinecap="round" strokeWidth="4" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-black">{predominantTier}</span>
                    <span className="text-[9px] text-slate-500 dark:text-white/50">Predominante</span>
                  </div>
                </div>
                <div className="space-y-2 flex-1">
                  {[
                    { label: "Alta (T3)", color: "bg-emerald-500", pct: t3Pct },
                    { label: "Média (T2)", color: "bg-[#1876f2]", pct: t2Pct },
                    { label: "Baixa (T1)", color: "bg-slate-300", pct: t1Pct },
                  ].map(tier => (
                    <div key={tier.label} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${tier.color}`} />
                        <span className="font-medium">{tier.label}</span>
                      </div>
                      <span className="font-bold">{tier.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ── Esteiras Tab ── */}
      {activeTab === "esteiras" && (
        <div id="form-section" className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-12 gap-4 pb-8 pt-6 w-full">
          {/* ── Selection Form Section ── */}
          <section className="lg:col-span-4">
            <div className="bg-white dark:bg-white/5 rounded-xl shadow-sm border border-slate-200 dark:border-white/10 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 dark:border-white/10 flex items-center gap-2.5">
                <MIcon name="local_fire_department" className="text-[#1876f2] text-xl" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Executar Aquecimento</h2>
              </div>
              <div className="p-5 space-y-4">
                {isTimerActive && selectedProfileId ? (
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
                    <MIcon name="local_fire_department" className="text-lg" />
                    Iniciar Tarefa
                  </button>
                ) : (
                  <div className="text-center py-2">
                    <p className="text-xs text-slate-500">Selecione um perfil na fila abaixo para iniciar.</p>
                  </div>
                )}
                <p className="text-[11px] text-slate-400 text-center leading-tight">
                  Certifique-se de que o perfil está logado no navegador multilogin antes de iniciar.
                </p>
              </div>
            </div>

            {/* Search field */}
            {sortedActiveQueue.length > 0 && (
              <div className="mt-3 relative">
                <MIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-base text-slate-400 dark:text-white/40" />
                <input
                  type="text"
                  value={queueSearch}
                  onChange={(e) => setQueueSearch(e.target.value)}
                  placeholder="Buscar perfil na fila..."
                  className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#1876f2]/30 focus:border-[#1876f2] transition-all"
                />
              </div>
            )}

            {/* Active queue - only show if there are pending profiles */}
            {sortedActiveQueue.length > 0 && (() => {
              const filteredQueue = queueSearch.trim()
                ? sortedActiveQueue.filter(p => p.profile_code.toLowerCase().includes(queueSearch.trim().toLowerCase()) || (p.profile_name && p.profile_name.toLowerCase().includes(queueSearch.trim().toLowerCase())))
                : sortedActiveQueue;
              return (
              <div className="mt-3 bg-white dark:bg-white/5 rounded-xl shadow-sm border border-slate-200 dark:border-white/10 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-600 dark:text-white/60">Fila de Aquecimento</h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    currentQueueTrack === "7_days" ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300" :
                    currentQueueTrack === "15_days" ? "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300" :
                    "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                  }`}>
                    Esteira {currentQueueTrack === "7_days" ? "7 Dias" : currentQueueTrack === "15_days" ? "15 Dias" : "30 Dias"}
                    {" • "}{filteredQueue.length} pendente{filteredQueue.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="max-h-52 overflow-y-auto">
                  {filteredQueue.map((p) => {
                    const prog = getProgress(p);
                    const isSelected = selectedProfileId === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => { setSelectedProfileId(p.id); if (!tasks[p.id]) fetchTasks(p.id); }}
                        className={`flex items-center gap-2.5 px-4 py-2 cursor-pointer border-b border-slate-50 dark:border-white/5 transition-colors ${isSelected ? "bg-blue-50 dark:bg-blue-500/10 border-l-2 border-l-[#1876f2]" : "hover:bg-slate-50 dark:hover:bg-white/5"}`}
                      >
                        <MIcon
                          name="local_fire_department"
                          className={`text-base ${isSelected && isTimerActive ? "text-orange-500 animate-pulse" : isSelected ? "text-orange-500" : "text-orange-400/60"}`}
                        />
                        <div className="flex-grow min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{p.profile_code}</p>
                          <p className="text-[11px] text-slate-500 dark:text-white/50">
                            {TRACKS[p.track_type]?.label} • {prog}%
                            {p.created_by && creatorNames[p.created_by] && <span className="ml-1 text-[#1876f2]">• {creatorNames[p.created_by]}</span>}
                          </p>
                        </div>
                        {p.track_type !== "7_days" && (
                          <button
                            title="Voltar para esteira de 7 dias"
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (!confirm(`Mover "${p.profile_code}" de volta para a esteira de 7 dias?`)) return;
                              const customTasks = configTasks["7_days"] || [];
                              const tasksToUse = customTasks.length > 0 ? customTasks : TRACKS["7_days"].tasks;
                              await supabase.from("warming_tasks").delete().eq("profile_id", p.id);
                              await supabase.from("warming_profiles").update({
                                track_type: "7_days",
                                track_days: tasksToUse.length,
                                current_day: 1,
                                status: "active",
                                updated_at: new Date().toISOString(),
                              }).eq("id", p.id);
                              const taskRows = tasksToUse.map((t, i) => ({
                                profile_id: p.id,
                                day_number: i + 1,
                                title: t.title,
                                description: t.description,
                              }));
                              await supabase.from("warming_tasks").insert(taskRows);
                              toast.success(`🔄 Perfil "${p.profile_code}" movido para esteira de 7 dias`);
                              fetchProfiles();
                              if (selectedProfileId === p.id) {
                                setSelectedProfileId(null);
                              }
                            }}
                            className="flex-shrink-0 p-1 rounded-md hover:bg-amber-100 dark:hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 transition-colors"
                          >
                            <MIcon name="replay" className="text-sm" />
                          </button>
                        )}
                        <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          isSelected && isTimerActive ? "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400" :
                          isSelected ? "bg-blue-100 dark:bg-blue-500/20 text-[#1876f2]" :
                          "bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-white/50"
                        }`}>
                          {isSelected && isTimerActive ? "Em execução" : isSelected ? "Selecionado" : "Na fila"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              ); })()}

            {/* History - profiles worked today */}
            {(() => {
              const doneTodayProfiles = visibleProfiles.filter(p => p.status === "active" && wasWorkedToday(p.id));
              if (doneTodayProfiles.length === 0) return null;
              return (
                <div className="mt-3 bg-white dark:bg-white/5 rounded-xl shadow-sm border border-slate-200 dark:border-white/10 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-600 dark:text-white/60">
                      <MIcon name="history" className="text-sm align-middle mr-1" />
                      Concluídos Hoje
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                      {doneTodayProfiles.length} perfil{doneTodayProfiles.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    {doneTodayProfiles.map((p) => {
                      const prog = getProgress(p);
                      return (
                        <div
                          key={p.id}
                          className="flex items-center gap-2.5 px-4 py-2 border-b border-slate-50 dark:border-white/5 opacity-60"
                        >
                          <MIcon name="check_circle" className="text-base text-emerald-500" />
                          <div className="flex-grow min-w-0">
                            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{p.profile_code}</p>
                            <p className="text-[11px] text-slate-500 dark:text-white/50">
                              {TRACKS[p.track_type]?.label} • {prog}%
                              {p.created_by && creatorNames[p.created_by] && <span className="ml-1 text-[#1876f2]">• {creatorNames[p.created_by]}</span>}
                            </p>
                          </div>
                          <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                            Feito
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </section>

          <section className="lg:col-span-5">
            {loading ? (
              <div className="bg-white dark:bg-white/5 rounded-xl shadow-sm border border-slate-200 dark:border-white/10 p-8 text-center">
                <MIcon name="hourglass_empty" className="text-slate-300 text-3xl" />
                <p className="text-slate-500 text-xs mt-2">Carregando...</p>
              </div>
            ) : !selectedProfile ? (
              <div className="bg-white dark:bg-white/5 rounded-xl shadow-sm border border-slate-200 dark:border-white/10 p-8 text-center">
                <MIcon name="thermostat" className="text-slate-300 text-3xl" />
                <p className="text-slate-500 text-xs mt-2">Informe o código do perfil para iniciar o aquecimento.</p>
              </div>
            ) : selectedTasks.length === 0 ? (
              <div className="bg-white dark:bg-white/5 rounded-xl shadow-sm border border-slate-200 dark:border-white/10 p-8 text-center">
                <MIcon name="hourglass_empty" className="text-slate-300 text-3xl animate-pulse" />
                <p className="text-slate-500 text-xs mt-2">Carregando tarefas...</p>
              </div>
            ) : !selectedTasks.some(t => !t.completed) ? (
              <div className="bg-white dark:bg-white/5 rounded-xl shadow-sm border border-slate-200 dark:border-white/10 p-8 text-center">
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
                  if (selectedProfileId) {
                    await checkAndMoveProfileToReady(selectedProfileId);
                  }

                  const nextProfile = sortedActiveQueue.find((profile) => profile.id !== selectedProfileId) || null;

                  setIsTimerActive(false);
                  setProfileCode("");

                  if (nextProfile) {
                    setSelectedProfileId(nextProfile.id);
                    if (!tasks[nextProfile.id]) {
                      await fetchTasks(nextProfile.id);
                    }
                  }

                  await fetchProfiles();
                  toast.success("✅ Tarefa concluída! Próximo perfil selecionado automaticamente.");
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
                onStatusChange={async (profileId, newStatus) => {
                  await supabase.from("warming_profiles").update({
                    status: newStatus,
                    updated_at: new Date().toISOString(),
                  }).eq("id", profileId);

                  // Sync operator_earnings status
                  const earningStatusMap: Record<string, { status: string; extra: Record<string, any> }> = {
                    checkpoint: { status: "frozen", extra: { frozen_at: new Date().toISOString() } },
                    blocked: { status: "cancelled", extra: { cancelled_at: new Date().toISOString() } },
                    restricted: { status: "cancelled", extra: { cancelled_at: new Date().toISOString() } },
                    active: { status: "pending", extra: { frozen_at: null, cancelled_at: null } },
                  };
                  const earningUpdate = earningStatusMap[newStatus];
                  if (earningUpdate) {
                    await supabase.from("operator_earnings").update({
                      status: earningUpdate.status,
                      ...earningUpdate.extra,
                      updated_at: new Date().toISOString(),
                    }).eq("profile_id", profileId);
                  }

                  const labels: Record<string, string> = {
                    blocked: "🚫 Perfil marcado como Bloqueado",
                    checkpoint: "⚠️ Perfil marcado como Checkpoint",
                    active: "✅ Perfil reativado",
                  };
                  toast.success(labels[newStatus] || `Status: ${newStatus}`);
                  fetchProfiles();
                  setSelectedProfileId(null);
                  setProfileCode("");
                }}
              />
            )}
            {/* Quality Meter below tasks */}
            {selectedProfile && (
              <div className="mt-3">
                <ProfileQualityMeter
                  key={selectedProfile.id}
                  profileId={selectedProfile.id}
                  profileCode={selectedProfile.profile_code}
                />
              </div>
            )}
          </section>

          {/* Right sidebar: Notes */}
          {selectedProfile && (
            <section className="lg:col-span-3 space-y-3">
              <ProfileQuickInfo profileId={selectedProfile.id} />
              <ProfileQuickNotes profileId={selectedProfile.id} profileCode={selectedProfile.profile_code} />
            </section>
          )}
        </div>
      )}

      {/* ── Configurações Tab ── */}
      {activeTab === "configuracoes" && (
        <main className="flex-1 px-6 md:px-12 lg:px-40 py-6 max-w-[900px] mx-auto w-full space-y-6">
          {/* Cover Preview */}
          <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-sm">
            <div className="h-40 bg-slate-200 dark:bg-white/10" style={operatorCoverUrl ? { backgroundImage: `url(${operatorCoverUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : { background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 40%, #3a3a3a 70%, #1a1a1a 100%)" }}>
            </div>
            <div className="absolute bottom-3 left-5 flex items-center gap-3">
              {currentUserAvatar ? (
                <img src={currentUserAvatar} alt="" className="w-16 h-16 rounded-full border-3 border-white shadow-lg object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center border-3 border-white shadow-lg">
                  <MIcon name="person" className="text-white text-3xl" />
                </div>
              )}
              <div>
                <p className="text-white font-bold text-lg drop-shadow-lg">{operatorDisplayName || currentUserName || "Operador"}</p>
                <p className="text-white/70 text-xs drop-shadow">Operador de Aquecimento</p>
              </div>
            </div>
          </div>

          {/* Edit Name */}
          <div className="bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <MIcon name="badge" className="text-[#1876f2] text-lg" />
              Nome de Exibição
            </h3>
            <input
              type="text"
              value={operatorDisplayName}
              onChange={(e) => setOperatorDisplayName(e.target.value)}
              placeholder="Seu nome de operador"
              className="w-full bg-slate-50 dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-[#1876f2] focus:border-transparent outline-none"
            />
            <p className="text-[11px] text-slate-400 mt-1.5">Este nome será exibido no painel e nos relatórios.</p>
          </div>

          {/* Cover Photo Selection */}
          <div className="bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <MIcon name="wallpaper" className="text-[#1876f2] text-lg" />
              Foto de Capa
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {/* Default option */}
              <button
                onClick={() => setOperatorCoverUrl(null)}
                className={`relative rounded-lg overflow-hidden h-20 border-2 transition-all ${!operatorCoverUrl ? "border-[#1876f2] ring-2 ring-[#1876f2]/30" : "border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20"}`}
              >
                <div className="w-full h-full" style={{ background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 40%, #3a3a3a 70%, #1a1a1a 100%)" }} />
                {!operatorCoverUrl && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <MIcon name="check_circle" className="text-white text-xl" />
                  </div>
                )}
                <span className="absolute bottom-1 left-1 text-[9px] text-white font-bold bg-black/40 px-1.5 py-0.5 rounded">Padrão</span>
              </button>
              {/* Cover options */}
              {DEFAULT_COVERS.map((cover, i) => {
                const isSelected = operatorCoverUrl === cover;
                return (
                  <button
                    key={cover}
                    onClick={() => setOperatorCoverUrl(cover)}
                    className={`relative rounded-lg overflow-hidden h-20 border-2 transition-all ${isSelected ? "border-[#1876f2] ring-2 ring-[#1876f2]/30" : "border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20"}`}
                  >
                    <img src={cover} alt={`Capa ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                    {isSelected && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <MIcon name="check_circle" className="text-white text-xl" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={saveOperatorConfig}
            disabled={savingConfig}
            className="w-full bg-[#1876f2] hover:bg-[#1565c0] disabled:opacity-50 text-white font-bold py-3 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 text-sm"
          >
            <MIcon name={savingConfig ? "hourglass_empty" : "save"} className="text-lg" />
            {savingConfig ? "Salvando..." : "Salvar Configurações"}
          </button>
        </main>
      )}

    </div>
  );
}
