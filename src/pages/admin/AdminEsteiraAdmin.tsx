import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useNavigate } from "react-router-dom";
import WarmingOperatorDashboard from "@/components/admin/warming/WarmingOperatorDashboard";
import WarmingAuditDashboard from "@/components/admin/warming/WarmingAuditDashboard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toast } from "sonner";
import {
  DEFAULT_READY_CRITERIA,
  getEffectiveProfileQuality,
  parseReadyCriteria,
  type ProfileQualityData,
} from "@/lib/warming-ready";

// ── Track definitions (shared) ──
const TRACKS: Record<string, { label: string; days: number }> = {
  "7_days": { label: "7 Dias - Básica", days: 7 },
  "15_days": { label: "15 Dias - Média", days: 15 },
  "30_days": { label: "30 Dias - Premium", days: 30 },
};

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

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export default function AdminEsteiraAdmin() {
  const { role } = useAdminAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<WarmingProfile[]>([]);
  const [tasks, setTasks] = useState<Record<string, WarmingTask[]>>({});
  const [loading, setLoading] = useState(true);
  const [creatorNames, setCreatorNames] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<"gestao" | "relatorios" | "prontos" | "bd_perfis" | "configuracoes" | "auditoria" | "analise_interna">("gestao");
  const [reportFilter, setReportFilter] = useState("");
  const [report2faFilter, setReport2faFilter] = useState(false);
  const [qualityMap, setQualityMap] = useState<Record<string, ProfileQualityData>>({});
  const [configTrack, setConfigTrack] = useState<"7_days" | "15_days" | "30_days">("7_days");
  const [profileCode, setProfileCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [teamOperators, setTeamOperators] = useState<{ id: string; name: string }[]>([]);
  const [assignOperatorId, setAssignOperatorId] = useState("");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetting, setResetting] = useState(false);
  const [commissionRate, setCommissionRate] = useState("0.25");
  const [savingCommission, setSavingCommission] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editingCode, setEditingCode] = useState("");
  const [readyTaskFilter, setReadyTaskFilter] = useState("");
  const [expandedChecklists, setExpandedChecklists] = useState<Set<string>>(new Set());
  const [approvedProfileIds, setApprovedProfileIds] = useState<Set<string>>(new Set());
  const [analiseSearch, setAnaliseSearch] = useState("");
  const [analiseSelectedId, setAnaliseSelectedId] = useState<string | null>(null);
  const [profileListSearch, setProfileListSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const defaultConfigTasks: Record<string, { title: string; description: string }[]> = {
    "7_days": [
      { title: "Orgânico puro", description: "" },
      { title: "Curtir 5 posts", description: "" },
      { title: "Comentar em 2 grupos", description: "" },
      { title: "Criar BM/Page", description: "" },
      { title: "Ads Engagement R$5", description: "" },
      { title: "Ads Traffic R$8", description: "" },
      { title: "Ads Traffic R$10", description: "" },
    ],
    "15_days": Array.from({ length: 15 }, (_, i) => ({ title: `Tarefa dia ${i + 1}`, description: "" })),
    "30_days": Array.from({ length: 30 }, (_, i) => ({ title: `Tarefa dia ${i + 1}`, description: "" })),
  };
  const [configTasks, setConfigTasks] = useState<Record<string, { title: string; description: string }[]>>(defaultConfigTasks);
  const configSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const trackKeys = ["7_days", "15_days", "30_days"] as const;

  // Client warming config state
  const defaultClientTasks: { title: string; description: string }[] = [
    { title: "Completar perfil", description: "Preencha foto, capa e bio do perfil." },
    { title: "Navegar organicamente", description: "Role o feed por 5-10 minutos, curta 3-5 posts." },
    { title: "Adicionar 5-10 amigos", description: "Envie solicitações de amizade para pessoas do seu nicho." },
    { title: "Engajar em grupos", description: "Comente em 2-3 grupos relacionados ao seu nicho." },
    { title: "Criar página", description: "Crie uma página comercial e publique 1-2 posts." },
    { title: "Ativar 2FA", description: "Configure autenticação de dois fatores para segurança." },
    { title: "Verificar restrições", description: "Verifique se a conta está sem restrições e pronta para uso." },
  ];
  const [clientConfigTasks, setClientConfigTasks] = useState<{ title: string; description: string }[]>(defaultClientTasks);
  const clientConfigSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [clientDragIndex, setClientDragIndex] = useState<number | null>(null);
  const [clientDragOverIndex, setClientDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };
  const handleDrop = (index: number) => {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    updateConfigTasks(prev => {
      const updated = { ...prev };
      const items = [...updated[configTrack]];
      const [moved] = items.splice(dragIndex, 1);
      items.splice(index, 0, moved);
      updated[configTrack] = items;
      return updated;
    });
    setDragIndex(null);
    setDragOverIndex(null);
    toast.success("Ordem atualizada!");
  };
  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const defaultTiers = [
    { label: "Nível 1 (Confiança Baixa)", color: "bg-red-100 text-red-700", range: "0 - 30", criteria: "Contas novas, sem histórico." },
    { label: "Nível 2 (Confiança Média)", color: "bg-amber-100 text-amber-700", range: "31 - 75", criteria: "7+ dias, 2FA ativa." },
    { label: "Nível 3 (Confiança Alta)", color: "bg-green-100 text-green-700", range: "76 - 100", criteria: "Esteira completa, 30+ dias." },
  ];
  const [trustTiers, setTrustTiers] = useState(() => {
    try {
      const saved = localStorage.getItem("warming_trust_tiers");
      if (saved) return JSON.parse(saved);
    } catch {}
    return defaultTiers;
  });
  const [trustTiersSaved, setTrustTiersSaved] = useState(true);
  const [trustTiersSaving, setTrustTiersSaving] = useState(false);
  const defaultReadyCriteria = DEFAULT_READY_CRITERIA;
  const [readyCriteria, setReadyCriteria] = useState(() => {
    try {
      const saved = localStorage.getItem("warming_ready_criteria");
      if (saved) return parseReadyCriteria(JSON.parse(saved));
    } catch {}
    return defaultReadyCriteria;
  });
  const [readyCriteriaSaved, setReadyCriteriaSaved] = useState(true);
  const [readyCriteriaSaving, setReadyCriteriaSaving] = useState(false);

  const updateTrustTiers = (newTiers: typeof defaultTiers) => {
    setTrustTiers(newTiers);
    setTrustTiersSaved(false);
  };

  const saveTrustTiers = () => {
    setTrustTiersSaving(true);
    localStorage.setItem("warming_trust_tiers", JSON.stringify(trustTiers));
    setTimeout(() => {
      setTrustTiersSaving(false);
      setTrustTiersSaved(true);
      toast.success("Níveis de confiança salvos com sucesso!");
    }, 400);
  };

  const updateReadyCriteria = (updates: Partial<typeof defaultReadyCriteria>) => {
    setReadyCriteria(prev => ({ ...prev, ...updates }));
    setReadyCriteriaSaved(false);
  };

  const saveReadyCriteria = async () => {
    setReadyCriteriaSaving(true);
    const jsonValue = JSON.stringify(readyCriteria);
    localStorage.setItem("warming_ready_criteria", jsonValue);
    try {
      const { data: existing } = await supabase
        .from("site_settings")
        .select("id")
        .eq("key", "warming_ready_criteria")
        .maybeSingle();

      if (existing) {
        await supabase.from("site_settings").update({ value: jsonValue }).eq("key", "warming_ready_criteria");
      } else {
        await supabase.from("site_settings").insert({ key: "warming_ready_criteria", value: jsonValue });
      }

      setReadyCriteriaSaved(true);
      toast.success("Critérios de perfil pronto salvos com sucesso!");
    } catch {
      toast.error("Erro ao salvar critérios de perfil pronto.");
    } finally {
      setReadyCriteriaSaving(false);
    }
  };

  useEffect(() => {
    if (!document.querySelector('link[href*="Material+Symbols+Outlined"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap";
      document.head.appendChild(link);
    }
    fetchProfiles();
    loadConfigFromDB();
    fetchTeamOperators();
    // Load commission rate
    supabase.from("site_settings").select("value").eq("key", "warming_commission_rate").maybeSingle().then(({ data }) => {
      if (data?.value) setCommissionRate(data.value);
    });

    // Realtime subscriptions for instant updates
    const profilesChannel = supabase
      .channel("warming-profiles-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "warming_profiles" }, () => {
        fetchProfiles();
      })
      .subscribe();

    const tasksChannel = supabase
      .channel("warming-tasks-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "warming_tasks" }, () => {
        fetchProfiles();
      })
      .subscribe();

    // Realtime for config changes (site_settings)
    const configChannel = supabase
      .channel("warming-config-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "site_settings" }, (payload) => {
        const row = payload.new as any;
        if (row?.key === "warming_track_config") {
          loadConfigFromDB();
        }
        if (row?.key === "warming_ready_criteria") {
          try {
            setReadyCriteria(parseReadyCriteria(JSON.parse(row.value)));
            setReadyCriteriaSaved(true);
          } catch {}
        }
      })
      .subscribe();

    // Fallback polling every 10s to ensure data stays fresh
    const pollInterval = setInterval(() => {
      fetchProfiles();
    }, 10000);

    return () => {
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(tasksChannel);
      supabase.removeChannel(configChannel);
      clearInterval(pollInterval);
    };
  }, []);

  // Redirect non-admins without permission
  useEffect(() => {
    if (role && role !== "admin") {
      (async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data: permData } = await supabase
          .from("moderator_permissions")
          .select("allowed_paths")
          .eq("user_id", session.user.id)
          .maybeSingle();
        const paths = permData?.allowed_paths || [];
        const hasAccess = paths.some((p: string) =>
          p === "/admin/esteira-admin" || p.startsWith("/admin/esteira-admin/")
        );
        if (!hasAccess) {
          navigate("/admin/aquecimento");
        }
      })();
    }
  }, [role, navigate]);

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
    // Also load client warming config
    try {
      const { data: clientData } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "client_warming_track_config")
        .maybeSingle();
      if (clientData?.value) {
        try {
          const parsed = JSON.parse(clientData.value);
          if (Array.isArray(parsed)) {
            setClientConfigTasks(parsed);
          } else if (parsed?.["7_days"]) {
            setClientConfigTasks(parsed["7_days"]);
          }
        } catch {}
      }
    } catch {}
  };

  const syncClientProfilesTasks = async (updatedTasks: { title: string; description: string }[]) => {
    try {
      // Fetch all active client warming profiles
      const { data: activeProfiles } = await supabase
        .from("client_warming_profiles")
        .select("id")
        .eq("status", "ativo");

      if (!activeProfiles || activeProfiles.length === 0) return;

      const profileIds = activeProfiles.map(p => p.id);

      // For each profile, delete existing tasks and re-create with new config
      for (const profileId of profileIds) {
        // Get existing tasks to preserve completion status
        const { data: existingTasks } = await supabase
          .from("client_warming_tasks")
          .select("*")
          .eq("profile_id", profileId)
          .order("day_number", { ascending: true });

        const completionMap = new Map<number, { completed: boolean; completed_at: string | null }>();
        (existingTasks || []).forEach(t => {
          completionMap.set(t.day_number, { completed: t.completed, completed_at: t.completed_at });
        });

        // Delete old tasks
        await supabase.from("client_warming_tasks").delete().eq("profile_id", profileId);

        // Insert new tasks preserving completion state
        const newTasks = updatedTasks.map((t, idx) => {
          const dayNum = idx + 1;
          const prev = completionMap.get(dayNum);
          return {
            profile_id: profileId,
            day_number: dayNum,
            title: t.title,
            description: t.description,
            completed: prev?.completed ?? false,
            completed_at: prev?.completed_at ?? null,
          };
        });

        if (newTasks.length > 0) {
          await supabase.from("client_warming_tasks").insert(newTasks);
        }
      }

      toast.success(`Tarefas atualizadas para ${profileIds.length} perfil(is) ativo(s)`);
    } catch (err) {
      console.error("Erro ao sincronizar tarefas dos clientes:", err);
    }
  };

  const saveClientConfigToDB = (updatedTasks: { title: string; description: string }[]) => {
    if (clientConfigSaveTimer.current) clearTimeout(clientConfigSaveTimer.current);
    clientConfigSaveTimer.current = setTimeout(async () => {
      try {
        const jsonValue = JSON.stringify({ "7_days": updatedTasks });
        const { data: existing } = await supabase
          .from("site_settings")
          .select("id")
          .eq("key", "client_warming_track_config")
          .maybeSingle();
        if (existing) {
          await supabase.from("site_settings").update({ value: jsonValue }).eq("key", "client_warming_track_config");
        } else {
          await supabase.from("site_settings").insert({ key: "client_warming_track_config", value: jsonValue });
        }
        // Sync all active client profiles with updated tasks
        await syncClientProfilesTasks(updatedTasks);
      } catch (err) {
        console.error("Erro ao salvar config da esteira do cliente:", err);
      }
    }, 800);
  };

  const updateClientConfigTasks = (updater: (prev: { title: string; description: string }[]) => { title: string; description: string }[]) => {
    setClientConfigTasks(prev => {
      const next = updater(prev);
      saveClientConfigToDB(next);
      return next;
    });
  };

  const handleClientDragStart = (index: number) => setClientDragIndex(index);
  const handleClientDragOver = (e: React.DragEvent, index: number) => { e.preventDefault(); setClientDragOverIndex(index); };
  const handleClientDrop = (index: number) => {
    if (clientDragIndex === null || clientDragIndex === index) { setClientDragIndex(null); setClientDragOverIndex(null); return; }
    updateClientConfigTasks(prev => {
      const items = [...prev];
      const [moved] = items.splice(clientDragIndex, 1);
      items.splice(index, 0, moved);
      return items;
    });
    setClientDragIndex(null);
    setClientDragOverIndex(null);
  };
  const handleClientDragEnd = () => { setClientDragIndex(null); setClientDragOverIndex(null); };

  const syncActiveProfilesWithConfig = async (updatedConfig: Record<string, { title: string; description: string }[]>) => {
    const pageSize = 1000;

    const syncTrack = async (trackKey: typeof trackKeys[number]) => {
      const configuredTasks = updatedConfig[trackKey] || [];
      const desiredTaskCount = configuredTasks.length;
      if (desiredTaskCount === 0) return;

      const allProfiles: Array<Pick<WarmingProfile, "id" | "current_day">> = [];
      let profileFrom = 0;

      while (true) {
        const { data: profileBatch, error: profileError } = await supabase
          .from("warming_profiles")
          .select("id, current_day")
          .eq("track_type", trackKey)
          .neq("status", "completed")
          .range(profileFrom, profileFrom + pageSize - 1);

        if (profileError) throw profileError;
        if (!profileBatch || profileBatch.length === 0) break;

        allProfiles.push(...profileBatch);
        if (profileBatch.length < pageSize) break;
        profileFrom += pageSize;
      }

      if (allProfiles.length === 0) return;

      const profileIds = allProfiles.map((profile) => profile.id);
      const allExistingTasks: Array<Pick<WarmingTask, "id" | "profile_id" | "day_number" | "title" | "description">> = [];
      let taskFrom = 0;

      while (true) {
        const { data: taskBatch, error: taskError } = await supabase
          .from("warming_tasks")
          .select("id, profile_id, day_number, title, description")
          .in("profile_id", profileIds)
          .order("day_number", { ascending: true })
          .range(taskFrom, taskFrom + pageSize - 1);

        if (taskError) throw taskError;
        if (!taskBatch || taskBatch.length === 0) break;

        allExistingTasks.push(...taskBatch);
        if (taskBatch.length < pageSize) break;
        taskFrom += pageSize;
      }

      const tasksByProfile = allExistingTasks.reduce<Record<string, typeof allExistingTasks>>((acc, task) => {
        if (!acc[task.profile_id]) acc[task.profile_id] = [];
        acc[task.profile_id].push(task);
        return acc;
      }, {});

      await Promise.all(allProfiles.map(async (profile) => {
        const existingTasks = tasksByProfile[profile.id] || [];
        const updateRows = existingTasks
          .slice(0, desiredTaskCount)
          .map((task, index) => {
            const configTask = configuredTasks[index];
            if (!configTask) return null;

            const nextDay = index + 1;
            const sameTitle = task.title === configTask.title;
            const sameDescription = (task.description || "") === (configTask.description || "");
            const sameDay = task.day_number === nextDay;

            if (sameTitle && sameDescription && sameDay) return null;

            return {
              id: task.id,
              day_number: nextDay,
              title: configTask.title,
              description: configTask.description,
            };
          })
          .filter(Boolean);

        const extraTaskIds = existingTasks.slice(desiredTaskCount).map((task) => task.id);
        const insertRows = configuredTasks.slice(existingTasks.length).map((task, index) => ({
          profile_id: profile.id,
          day_number: existingTasks.length + index + 1,
          title: task.title,
          description: task.description,
        }));

        const operations: Promise<unknown>[] = [
          ...updateRows.map((task) =>
            (async () => {
              await supabase
                .from("warming_tasks")
                .update({
                  day_number: task.day_number,
                  title: task.title,
                  description: task.description,
                })
                .eq("id", task.id);
            })()
          ),
        ];

        if (extraTaskIds.length > 0) {
          operations.push((async () => {
            await supabase.from("warming_tasks").delete().in("id", extraTaskIds);
          })());
        }

        if (insertRows.length > 0) {
          operations.push((async () => {
            await supabase.from("warming_tasks").insert(insertRows);
          })());
        }

        operations.push((async () => {
          await supabase
            .from("warming_profiles")
            .update({
              track_days: desiredTaskCount,
              current_day: Math.min(profile.current_day, desiredTaskCount),
              updated_at: new Date().toISOString(),
            })
            .eq("id", profile.id);
        })());

        await Promise.all(operations);
      }));
    };

    await Promise.all(trackKeys.map((trackKey) => syncTrack(trackKey)));
  };

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
        await syncActiveProfilesWithConfig(updatedConfig);
      } catch (err) {
        console.error("Erro ao salvar config:", err);
      }
    }, 800);
  };

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

  const handleCreateProfile = async () => {
    if (!profileCode.trim()) { toast.error("Digite o código do perfil"); return; }
    if (!assignOperatorId) { toast.error("Selecione um operador"); return; }
    setCreating(true);

    const { data: existing } = await supabase
      .from("warming_profiles")
      .select("id")
      .eq("profile_code", profileCode.trim())
      .maybeSingle();
    if (existing) {
      toast.error(`O perfil "${profileCode.trim()}" já está cadastrado.`);
      setCreating(false);
      return;
    }

    const trackKey = "7_days";
    const customTasks = configTasks[trackKey] || [];
    const tasksToUse = customTasks.length > 0 ? customTasks : defaultConfigTasks[trackKey];

    const { data: profile, error } = await supabase
      .from("warming_profiles")
      .insert({ profile_code: profileCode.trim(), track_type: trackKey, track_days: tasksToUse.length, created_by: assignOperatorId })
      .select()
      .single();
    if (error || !profile) { toast.error("Erro ao criar perfil"); setCreating(false); return; }

    const taskRows = tasksToUse.map((t, i) => ({ profile_id: profile.id, day_number: i + 1, title: t.title, description: t.description }));
    await supabase.from("warming_tasks").insert(taskRows);

    toast.success(`✅ Perfil "${profileCode.trim()}" cadastrado!`);
    setProfileCode("");
    fetchProfiles();
    setCreating(false);
  };

  const handleImportTxt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!assignOperatorId) { toast.error("Selecione um operador primeiro"); e.target.value = ""; return; }
    setImporting(true);
    try {
      const text = await file.text();
      const codes = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (codes.length === 0) { toast.error("Arquivo vazio"); setImporting(false); e.target.value = ""; return; }

      const trackKey = "7_days";
      const customTasks = configTasks[trackKey] || [];
      const tasksToUse = customTasks.length > 0 ? customTasks : defaultConfigTasks[trackKey];

      // Check existing codes
      const { data: existingProfiles } = await supabase
        .from("warming_profiles")
        .select("profile_code")
        .in("profile_code", codes);
      const existingSet = new Set((existingProfiles || []).map(p => p.profile_code));
      const newCodes = codes.filter(c => !existingSet.has(c));
      const skipped = codes.length - newCodes.length;

      if (newCodes.length === 0) {
        toast.error(`Todos os ${codes.length} perfis já estão cadastrados.`, { duration: 5000 });
        setImporting(false);
        e.target.value = "";
        return;
      }

      let created = 0;
      for (const code of newCodes) {
        const { data: profile, error } = await supabase
          .from("warming_profiles")
          .insert({ profile_code: code, track_type: trackKey, track_days: tasksToUse.length, created_by: assignOperatorId })
          .select()
          .single();
        if (error || !profile) continue;
        const taskRows = tasksToUse.map((t, i) => ({ profile_id: profile.id, day_number: i + 1, title: t.title, description: t.description }));
        await supabase.from("warming_tasks").insert(taskRows);
        created++;
      }

      const msg = skipped > 0
        ? `✅ ${created} perfis importados!\n⚠️ ${skipped} já cadastrados (ignorados)`
        : `✅ ${created} perfis importados com sucesso!`;
      toast.success(msg, { duration: 5000 });
      fetchProfiles();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao importar arquivo");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const getProgress = (profile: WarmingProfile) => {
    const profileTaskList = tasks[profile.id];
    if (!profileTaskList) return Math.min(100, Math.round(((profile.current_day - 1) / profile.track_days) * 100));
    const completed = profileTaskList.filter((t) => t.completed).length;
    return Math.min(100, Math.round((completed / profileTaskList.length) * 100));
  };

  const fetchProfiles = async () => {
    setLoading(true);

    try {
      const allProfiles: WarmingProfile[] = [];
      const pageSize = 1000;
      const filterChunkSize = 75;
      let from = 0;

      while (true) {
        const { data: batch, error } = await supabase
          .from("warming_profiles")
          .select("*")
          .order("created_at", { ascending: false })
          .range(from, from + pageSize - 1);

        if (error) throw error;
        if (!batch || batch.length === 0) break;

        allProfiles.push(...(batch as WarmingProfile[]));
        if (batch.length < pageSize) break;
        from += pageSize;
      }

      setProfiles(allProfiles);

      const groupedTasks: Record<string, WarmingTask[]> = {};
      const derivedQualityMap: Record<string, ProfileQualityData> = {};

      if (allProfiles.length > 0) {
        const profileIds = allProfiles.map((profile) => profile.id);
        const profileIdChunks = chunkArray(profileIds, filterChunkSize);
        const allTasks: WarmingTask[] = [];

        for (const profileIdChunk of profileIdChunks) {
          let taskFrom = 0;

          while (true) {
            const { data: taskBatch, error: taskError } = await supabase
              .from("warming_tasks")
              .select("*")
              .in("profile_id", profileIdChunk)
              .order("profile_id", { ascending: true })
              .order("day_number", { ascending: true })
              .range(taskFrom, taskFrom + pageSize - 1);

            if (taskError) throw taskError;
            if (!taskBatch || taskBatch.length === 0) break;

            allTasks.push(...(taskBatch as WarmingTask[]));
            if (taskBatch.length < pageSize) break;
            taskFrom += pageSize;
          }
        }

        allTasks.forEach((task) => {
          if (!groupedTasks[task.profile_id]) groupedTasks[task.profile_id] = [];
          groupedTasks[task.profile_id].push(task);
        });
        setTasks(groupedTasks);

        const manualQualityMap: Record<string, Partial<ProfileQualityData>> = {};
        const qualityKeyChunks = chunkArray(
          profileIds.map((id) => `warming_quality_${id}`),
          filterChunkSize,
        );

        for (const qualityKeyChunk of qualityKeyChunks) {
          const { data: qualityBatch, error: qualityError } = await supabase
            .from("site_settings")
            .select("key, value")
            .in("key", qualityKeyChunk);

          if (qualityError) throw qualityError;

          (qualityBatch || []).forEach((row: any) => {
            const profileId = row.key.replace("warming_quality_", "");
            try {
              const parsed = JSON.parse(row.value);
              manualQualityMap[profileId] = {
                has2FA: !!parsed.has2FA,
                hasBM: !!parsed.hasBM,
                hasPage: !!parsed.hasPage,
                friendRange: parsed.friendRange || "0-5",
              };
            } catch {
              manualQualityMap[profileId] = {};
            }
          });
        }

        profileIds.forEach((profileId) => {
          derivedQualityMap[profileId] = getEffectiveProfileQuality(
            manualQualityMap[profileId],
            groupedTasks[profileId] || [],
          );
        });

        setQualityMap(derivedQualityMap);

        const { data: earningsData } = await supabase
          .from("operator_earnings")
          .select("profile_id")
          .eq("status", "confirmed");

        setApprovedProfileIds(new Set((earningsData || []).map((earning) => earning.profile_id)));
      } else {
        setTasks({});
        setQualityMap({});
        setApprovedProfileIds(new Set());
      }

      const creatorIds = [...new Set(allProfiles.map((profile) => profile.created_by).filter(Boolean))] as string[];
      if (creatorIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", creatorIds);

        if (profilesData) {
          const nameMap: Record<string, string> = {};
          profilesData.forEach((profile) => {
            nameMap[profile.user_id] = profile.full_name || "Sem nome";
          });
          setCreatorNames(nameMap);
        }
      } else {
        setCreatorNames({});
      }
    } catch (error) {
      console.error("Erro ao carregar esteira admin:", error);
      toast.error("Erro ao carregar perfis");
    } finally {
      setLoading(false);
    }
  };

  const handleResetAll = async () => {
    if (!resetPassword) return;
    setResetting(true);
    setResetError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) { setResetError("Usuário não autenticado"); setResetting(false); return; }
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: resetPassword });
      if (signInError) { setResetError("Senha incorreta."); setResetting(false); return; }
      const profileIds = profiles.map(p => p.id);
      if (profileIds.length > 0) {
        await supabase.from("warming_tasks").delete().in("profile_id", profileIds);
        await supabase.from("warming_profiles").delete().in("id", profileIds);
      }
      toast.success("Todas as esteiras e perfis foram zerados!");
      setShowResetConfirm(false);
      setResetPassword("");
      setProfiles([]);
      setTasks({});
      fetchProfiles();
    } catch {
      setResetError("Erro inesperado ao zerar.");
    }
    setResetting(false);
  };

  const totalProfiles = profiles.length;
  const completedProfiles = profiles.filter(p => p.status === "completed").length;
  const readyProfiles = useMemo(
    () => profiles.filter((p) => (p.status === "completed" || p.status === "sent_to_store" || p.status === "removed_multilogin") && approvedProfileIds.has(p.id)),
    [profiles, approvedProfileIds],
  );

  const readyTaskTitles = useMemo(() => {
    const titles = new Set<string>();
    readyProfiles.forEach((p) => {
      (tasks[p.id] || []).forEach((t) => titles.add(t.title));
    });
    return Array.from(titles).sort();
  }, [readyProfiles, tasks]);

  const filteredReadyProfiles = useMemo(() => {
    if (!readyTaskFilter) return readyProfiles;
    return readyProfiles.filter((p) => {
      const profileTasks = tasks[p.id] || [];
      return profileTasks.some((t) => t.completed && t.title === readyTaskFilter);
    });
  }, [readyProfiles, tasks, readyTaskFilter]);

  const activeProfiles = useMemo(
    () => profiles.filter((p) => p.status !== "completed"),
    [profiles],
  );

  const readySummary = useMemo(() => {
    const totals = readyProfiles.reduce(
      (acc, profile) => {
        const profileTasks = tasks[profile.id] || [];
        const completedTasks = profileTasks.filter((task) => task.completed).length;
        const totalSeconds = profileTasks.reduce((sum, task) => sum + (task.duration_seconds || 0), 0);
        const completedAt = profileTasks
          .filter((task) => task.completed_at)
          .reduce<number>((latest, task) => {
            const value = new Date(task.completed_at as string).getTime();
            return value > latest ? value : latest;
          }, 0);

        acc.totalDuration += totalSeconds;
        acc.totalChecklist += completedTasks;
        acc.totalExpectedChecklist += profileTasks.length;
        if (completedAt > acc.latestCompletion) acc.latestCompletion = completedAt;

        return acc;
      },
      {
        totalDuration: 0,
        totalChecklist: 0,
        totalExpectedChecklist: 0,
        latestCompletion: 0,
      },
    );

    return {
      count: readyProfiles.length,
      averageDuration:
        readyProfiles.length > 0 ? Math.round(totals.totalDuration / readyProfiles.length) : 0,
      checklistCompletion:
        totals.totalExpectedChecklist > 0
          ? Math.round((totals.totalChecklist / totals.totalExpectedChecklist) * 100)
          : 0,
      latestCompletion: totals.latestCompletion,
    };
  }, [readyProfiles, tasks]);

  const filteredReportProfiles = profiles.filter(p => {
    if (reportFilter && !p.profile_code.toLowerCase().includes(reportFilter.toLowerCase())) return false;
    if (report2faFilter && !qualityMap[p.id]?.has2FA) return false;
    return true;
  });

  const tabs = [
    { key: "gestao" as const, label: "Gestão", icon: "supervisor_account" },
    { key: "relatorios" as const, label: "Relatórios", icon: "analytics" },
    { key: "auditoria" as const, label: "Auditoria", icon: "fact_check" },
    { key: "analise_interna" as const, label: "Análise Interna", icon: "troubleshoot" },
    { key: "prontos" as const, label: "Perfis Prontos", icon: "inventory_2" },
    { key: "bd_perfis" as const, label: "BD Perfis", icon: "database" },
    { key: "configuracoes" as const, label: "Configurações", icon: "settings" },
  ];

  const checkpointProfiles = useMemo(
    () => profiles.filter((p) => p.status === "checkpoint"),
    [profiles],
  );

  if (!role) return null;

  return (
    <div className="flex flex-col min-h-full bg-[#f5f7f8] dark:bg-[#0a0505] text-slate-900 dark:text-white" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <section className="relative overflow-hidden text-white pt-8 pb-12 px-6 md:px-12 lg:px-40" style={{ background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 40%, #3a3a3a 70%, #1a1a1a 100%)" }}>
        <div className="max-w-[1200px] mx-auto relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#1876f2] flex items-center justify-center">
                <MIcon name="admin_panel_settings" className="text-white text-2xl" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight">Esteira Admin</h1>
                <p className="text-white/50 text-sm">Gestão, relatórios e configurações de aquecimento</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <button
                onClick={() => navigate("/admin/aquecimento")}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all"
              >
                <MIcon name="local_fire_department" className="text-lg" />
                Ir para Operação
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs */}
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

      {/* Gestão Tab */}
      {activeTab === "gestao" && (
        <WarmingOperatorDashboard
          profiles={profiles}
          tasks={tasks}
          creatorNames={creatorNames}
          onRefresh={fetchProfiles}
        />
      )}

      {/* Auditoria Tab */}
      {activeTab === "auditoria" && (
        <WarmingAuditDashboard
          profiles={profiles}
          qualityMap={qualityMap as Record<string, { has2FA: boolean; hasBM: boolean; hasPage: boolean; friendRange: string }>}
          tasks={tasks}
          creatorNames={creatorNames}
          onRefresh={fetchProfiles}
        />
      )}

      {/* Análise Interna Tab - Perfis com Checkpoint */}
      {activeTab === "analise_interna" && (() => {
        const analiseProfiles = analiseSearch.trim()
          ? profiles.filter(p => p.profile_code.toLowerCase().includes(analiseSearch.trim().toLowerCase()))
          : checkpointProfiles;
        const selectedProfile = analiseSelectedId ? profiles.find(p => p.id === analiseSelectedId) : null;
        const selectedTasks = selectedProfile ? (tasks[selectedProfile.id] || []) : [];
        const selectedQuality = selectedProfile ? qualityMap[selectedProfile.id] : null;

        return (
        <main className="flex-1 px-6 md:px-8 lg:px-12 py-8 max-w-6xl mx-auto w-full space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black flex items-center gap-2">
                <MIcon name="troubleshoot" className="text-amber-500" />
                Análise Interna
              </h2>
              <p className="text-sm text-muted-foreground mt-1">Busque perfis por código para análise manual ou veja os checkpoints</p>
            </div>
            <span className="text-sm font-bold bg-amber-500/10 text-amber-500 px-3 py-1 rounded-full">
              {checkpointProfiles.length} checkpoints
            </span>
          </div>

          {/* Search */}
          <div className="relative">
            <MIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-lg" />
            <input
              type="text"
              placeholder="Buscar por código do perfil..."
              value={analiseSearch}
              onChange={e => { setAnaliseSearch(e.target.value); setAnaliseSelectedId(null); }}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm focus:ring-2 focus:ring-amber-500/30 outline-none"
            />
          </div>

          {/* Selected profile detail panel */}
          {selectedProfile && (
            <div className="bg-white dark:bg-white/5 rounded-xl border border-amber-200 dark:border-amber-500/20 overflow-hidden">
              <div className="px-5 py-3 border-b border-amber-100 dark:border-amber-500/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button onClick={() => setAnaliseSelectedId(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                    <MIcon name="arrow_back" className="text-lg" />
                  </button>
                  <span className="text-base font-black">{selectedProfile.profile_code}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    selectedProfile.status === "checkpoint" ? "bg-amber-500/10 text-amber-500" :
                    selectedProfile.status === "active" ? "bg-green-500/10 text-green-600" :
                    selectedProfile.status === "completed" ? "bg-blue-500/10 text-blue-600" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {selectedProfile.status === "checkpoint" ? "Checkpoint" :
                     selectedProfile.status === "active" ? "Ativo" :
                     selectedProfile.status === "completed" ? "Pronto" :
                     selectedProfile.status}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {selectedProfile.status !== "completed" && (
                    <button
                      onClick={async () => {
                        const { error } = await supabase.from("warming_profiles").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", selectedProfile.id);
                        if (error) { toast.error("Erro ao aprovar"); return; }
                        toast.success(`Perfil ${selectedProfile.profile_code} aprovado — movido para Perfis Prontos!`);
                        setAnaliseSelectedId(null);
                        fetchProfiles();
                      }}
                      className="text-xs font-bold px-4 py-1.5 rounded-lg bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors flex items-center gap-1"
                    >
                      <MIcon name="check_circle" className="text-sm" />
                      Aprovar
                    </button>
                  )}
                  {selectedProfile.status === "checkpoint" && (
                    <button
                      onClick={async () => {
                        const { error } = await supabase.from("warming_profiles").update({ status: "active" }).eq("id", selectedProfile.id);
                        if (error) { toast.error("Erro ao reativar"); return; }
                        toast.success("Perfil reativado!");
                        setAnaliseSelectedId(null);
                        fetchProfiles();
                      }}
                      className="text-xs font-bold px-4 py-1.5 rounded-lg bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-colors flex items-center gap-1"
                    >
                      <MIcon name="play_arrow" className="text-sm" />
                      Reativar
                    </button>
                  )}
                </div>
              </div>

              <div className="p-5 space-y-4">
                {/* Info row */}
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span>Operador: <strong className="text-foreground">{selectedProfile.created_by ? creatorNames[selectedProfile.created_by] || "—" : "—"}</strong></span>
                  <span>Track: <strong className="text-foreground">{TRACKS[selectedProfile.track_type]?.label || selectedProfile.track_type}</strong></span>
                  <span>Dia: <strong className="text-foreground">{Math.max(0, Math.floor((Date.now() - new Date(selectedProfile.start_date).getTime()) / 86400000))}/{selectedProfile.track_days}</strong></span>
                  {selectedQuality?.has2FA && <span className="font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500">2FA ✓</span>}
                  {selectedQuality?.hasBM && <span className="font-bold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-500">BM ✓</span>}
                  {selectedQuality?.hasPage && <span className="font-bold px-1.5 py-0.5 rounded bg-pink-500/10 text-pink-500">Page ✓</span>}
                </div>

                {/* Tasks checklist */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Checklist de Tarefas ({selectedTasks.filter(t => t.completed).length}/{selectedTasks.length})</p>
                  <div className="space-y-1.5">
                    {selectedTasks.sort((a, b) => a.day_number - b.day_number).map(task => (
                      <div key={task.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${task.completed ? "bg-green-500/5" : "bg-muted/30"}`}>
                        <MIcon
                          name={task.completed ? "check_circle" : "radio_button_unchecked"}
                          className={`text-base ${task.completed ? "text-green-500" : "text-muted-foreground/40"}`}
                        />
                        <div className="flex-1 min-w-0">
                          <span className={`font-medium ${task.completed ? "text-foreground" : "text-muted-foreground"}`}>
                            D{task.day_number} — {task.title}
                          </span>
                          {task.description && <p className="text-[11px] text-muted-foreground mt-0.5">{task.description}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 text-[11px] text-muted-foreground">
                          {task.duration_seconds ? <span>{formatDuration(task.duration_seconds)}</span> : null}
                          {task.completed_at && (
                            <span>{new Date(task.completed_at).toLocaleDateString("pt-BR")}</span>
                          )}
                        </div>
                      </div>
                    ))}
                    {selectedTasks.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">Nenhuma tarefa registrada</p>
                    )}
                  </div>
                </div>

                {selectedProfile.notes && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Notas</p>
                    <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">{selectedProfile.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Profile list */}
          {!analiseSelectedId && (
            <>
              {analiseProfiles.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <MIcon name={analiseSearch.trim() ? "search_off" : "check_circle"} className="text-5xl mb-3 text-muted-foreground/30" />
                  <p className="font-semibold">{analiseSearch.trim() ? "Nenhum perfil encontrado" : "Nenhum perfil com checkpoint"}</p>
                </div>
              ) : (
                <div className="bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 divide-y divide-slate-100 dark:divide-white/5">
                  {analiseProfiles.map((profile) => {
                    const profileTasks = tasks[profile.id] || [];
                    const completedTasks = profileTasks.filter((t) => t.completed);
                    const operatorName = profile.created_by ? creatorNames[profile.created_by] || "—" : "—";
                    const trackInfo = TRACKS[profile.track_type] || { label: profile.track_type, days: profile.track_days };
                    const daysPassed = Math.max(0, Math.floor((Date.now() - new Date(profile.start_date).getTime()) / 86400000));
                    const quality = qualityMap[profile.id];

                    return (
                      <div
                        key={profile.id}
                        onClick={() => setAnaliseSelectedId(profile.id)}
                        className="flex items-center justify-between px-5 py-3 hover:bg-muted/50 transition-colors gap-4 cursor-pointer"
                      >
                        <div className="flex flex-col gap-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-black">{profile.profile_code}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              profile.status === "checkpoint" ? "bg-amber-500/10 text-amber-500" :
                              profile.status === "active" ? "bg-green-500/10 text-green-600" :
                              profile.status === "completed" ? "bg-blue-500/10 text-blue-600" :
                              profile.status === "blocked" || profile.status === "restricted" ? "bg-red-500/10 text-red-500" :
                              "bg-muted text-muted-foreground"
                            }`}>
                              {profile.status === "checkpoint" ? "Checkpoint" :
                               profile.status === "active" ? "Ativo" :
                               profile.status === "completed" ? "Pronto" :
                               profile.status === "blocked" || profile.status === "restricted" ? "Restrito" :
                               profile.status === "sent_to_store" ? "Enviado" :
                               profile.status}
                            </span>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{trackInfo.label}</span>
                            {quality?.has2FA && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500">2FA</span>}
                            {quality?.hasBM && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-500">BM</span>}
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {operatorName} · Dia {daysPassed}/{trackInfo.days} · {completedTasks.length}/{profileTasks.length} tarefas
                          </p>
                        </div>
                        <MIcon name="chevron_right" className="text-muted-foreground/40 text-lg" />
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </main>
        );
      })()}

      {activeTab === "relatorios" && (
        <main className="flex-1 px-6 md:px-8 lg:px-12 py-8 max-w-6xl mx-auto w-full space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-white/5 p-6 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
              <p className="text-slate-500 dark:text-white/50 text-sm font-medium mb-1">Total Perfis Aquecidos</p>
              <h3 className="text-3xl font-black">{totalProfiles.toLocaleString()}</h3>
            </div>
            <div className="bg-white dark:bg-white/5 p-6 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
              <p className="text-slate-500 dark:text-white/50 text-sm font-medium mb-1">Taxa de Sucesso (%)</p>
              <h3 className="text-3xl font-black">
                {totalProfiles > 0 ? ((completedProfiles / totalProfiles) * 100).toFixed(1) : "0.0"}%
              </h3>
            </div>
            <div className="bg-white dark:bg-white/5 p-6 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
              <p className="text-slate-500 dark:text-white/50 text-sm font-medium mb-1">Tempo Médio Aquecimento</p>
              <h3 className="text-3xl font-black">
                {totalProfiles > 0 ? Math.round(profiles.reduce((acc, p) => acc + p.current_day, 0) / totalProfiles) : 0} dias
              </h3>
            </div>
          </div>

          <section className="bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-white/10 flex flex-wrap justify-between items-center gap-3">
              <h4 className="font-bold text-lg">Relatórios Recentes</h4>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setReport2faFilter(!report2faFilter)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    report2faFilter
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                      : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-white/50"
                  }`}
                >
                  <MIcon name="verified_user" className="text-sm" />
                  2FA Ativo
                </button>
                <div className="relative">
                  <input
                    className="pl-9 pr-4 py-2 text-sm bg-slate-100 dark:bg-white/10 border-none rounded-lg focus:ring-2 focus:ring-slate-400 w-64 dark:text-white"
                    placeholder="Filtrar perfis..."
                    value={reportFilter}
                    onChange={(e) => setReportFilter(e.target.value)}
                  />
                  <MIcon name="search" className="absolute left-3 top-2 text-slate-400 dark:text-white/40 text-sm" />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-white/50 text-xs font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Código</th>
                    <th className="px-6 py-4">Esteira</th>
                    <th className="px-6 py-4">Data Início</th>
                    <th className="px-6 py-4">Tempo Operador</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                  {filteredReportProfiles.map((p) => {
                    const profileTasks = tasks[p.id] || [];
                    const totalSeconds = profileTasks.reduce((acc, t) => acc + (t.duration_seconds || 0), 0);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 font-medium">#{p.profile_code}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                            p.track_type === "7_days" ? "bg-blue-50 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400" :
                            p.track_type === "15_days" ? "bg-purple-50 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400" :
                            "bg-amber-50 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
                          }`}>
                            {p.track_type === "7_days" ? "7 Dias" : p.track_type === "15_days" ? "15 Dias" : "30 Dias"}
                          </span>
                        </td>
                        <td className="px-6 py-4">{new Date(p.start_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}</td>
                        <td className="px-6 py-4">
                          {totalSeconds > 0 ? (
                            <span className="flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-white/70">
                              <MIcon name="timer" className="text-sm text-slate-400 dark:text-white/40" />
                              {formatDuration(totalSeconds)}
                            </span>
                          ) : <span className="text-slate-400 dark:text-white/40 text-sm">—</span>}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            p.status === "completed" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400" :
                            p.status === "restricted" ? "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-400" :
                            "bg-blue-100 text-[#1876f2] dark:bg-blue-500/20 dark:text-blue-400"
                          }`}>
                            {p.status === "completed" ? "Sucesso" : p.status === "restricted" ? "Falha" : "Em andamento"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredReportProfiles.length === 0 && (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400 dark:text-white/40">Nenhum perfil encontrado</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-6 border-t border-slate-200 dark:border-white/10">
              <p className="text-sm text-slate-500 dark:text-white/50">Mostrando {filteredReportProfiles.length} de {totalProfiles} resultados</p>
            </div>
          </section>
        </main>
      )}

      {activeTab === "prontos" && (
        <main className="flex-1 px-6 md:px-8 lg:px-12 py-8 max-w-6xl mx-auto w-full space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-white/5 p-6 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
              <p className="text-slate-500 dark:text-white/50 text-sm font-medium mb-1">Perfis prontos</p>
              <h3 className="text-3xl font-black">{readySummary.count.toLocaleString()}</h3>
            </div>
            <div className="bg-white dark:bg-white/5 p-6 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
              <p className="text-slate-500 dark:text-white/50 text-sm font-medium mb-1">Tempo médio de aquecimento</p>
              <h3 className="text-3xl font-black">{readySummary.averageDuration ? formatDuration(readySummary.averageDuration) : "—"}</h3>
            </div>
            <div className="bg-white dark:bg-white/5 p-6 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
              <p className="text-slate-500 dark:text-white/50 text-sm font-medium mb-1">Checklist concluído</p>
              <h3 className="text-3xl font-black">{readySummary.checklistCompletion}%</h3>
            </div>
            <div className="bg-white dark:bg-white/5 p-6 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
              <p className="text-slate-500 dark:text-white/50 text-sm font-medium mb-1">Última finalização</p>
              <h3 className="text-xl font-black">
                {readySummary.latestCompletion
                  ? new Date(readySummary.latestCompletion).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
                  : "—"}
              </h3>
            </div>
          </div>

          <section className="bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-lg">Estoque de perfis prontos para venda</h4>
                <p className="text-sm text-slate-500 dark:text-white/50 mt-1">
                  Todo perfil concluído sai da esteira ativa e fica listado aqui com o histórico completo do aquecimento.
                </p>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <select
                  value={readyTaskFilter}
                  onChange={(e) => setReadyTaskFilter(e.target.value)}
                  className="text-xs bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-slate-700 dark:text-white/80 focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="">Todas as tarefas</option>
                  {readyTaskTitles.map((title) => (
                    <option key={title} value={title}>{title}</option>
                  ))}
                </select>
                <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                  {filteredReadyProfiles.length} disponíveis
                </span>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {filteredReadyProfiles.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 dark:border-white/10 p-10 text-center text-slate-500 dark:text-white/50">
                  {readyTaskFilter ? "Nenhum perfil encontrado com essa tarefa concluída." : "Nenhum perfil pronto ainda."}
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-white/10">
                  {filteredReadyProfiles.map((profile) => {
                    const profileTasks = tasks[profile.id] || [];
                    const completedTasks = profileTasks.filter((task) => task.completed).length;
                    const totalSeconds = profileTasks.reduce((sum, task) => sum + (task.duration_seconds || 0), 0);
                    const operatorName = profile.created_by ? creatorNames[profile.created_by] || "—" : "—";
                    const latestCompletedTask = [...profileTasks]
                      .filter((task) => task.completed_at)
                      .sort((a, b) => new Date(b.completed_at || 0).getTime() - new Date(a.completed_at || 0).getTime())[0];
                    const isSent = profile.status === "sent_to_store" || profile.status === "removed_multilogin";

                    return (
                      <div
                        key={profile.id}
                        className="flex items-center justify-between px-5 py-3 hover:bg-white/5 transition-colors gap-4"
                      >
                        {/* Left: code + badges + operator */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className="material-symbols-outlined text-xl text-muted-foreground">person</span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-black text-foreground">{profile.profile_code}</span>
                              {profile.status === "removed_multilogin" ? (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 uppercase">Removido ML</span>
                              ) : profile.status === "sent_to_store" ? (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 uppercase">Enviado</span>
                              ) : (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 uppercase">Pronto</span>
                              )}
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-muted-foreground uppercase">
                                {TRACKS[profile.track_type]?.label || profile.track_type}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {operatorName} · {completedTasks}/{profileTasks.length} tarefas · {totalSeconds ? formatDuration(totalSeconds) : "—"} · {latestCompletedTask?.completed_at
                                ? new Date(latestCompletedTask.completed_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
                                : "—"}
                            </p>
                          </div>
                        </div>

                        {/* Right: actions */}
                        <div className="shrink-0 flex items-center gap-2">
                          {!isSent ? (
                            <>
                              <button
                                onClick={async () => {
                                  const { error } = await supabase
                                    .from("warming_profiles" as any)
                                    .update({ status: "sent_to_store" })
                                    .eq("id", profile.id);
                                  if (error) {
                                    toast.error("Erro ao marcar como enviado");
                                  } else {
                                    toast.success(`Perfil ${profile.profile_code} enviado para loja!`);
                                    fetchProfiles();
                                  }
                                }}
                                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all flex items-center gap-1.5"
                              >
                                <span className="material-symbols-outlined text-sm">storefront</span>
                                Enviado p/ Loja
                              </button>
                              <button
                                onClick={async () => {
                                  const { error } = await supabase
                                    .from("warming_profiles" as any)
                                    .update({ status: "removed_multilogin" })
                                    .eq("id", profile.id);
                                  if (error) {
                                    toast.error("Erro ao marcar remoção");
                                  } else {
                                    toast.success(`Perfil ${profile.profile_code} removido do Multilogin!`);
                                    fetchProfiles();
                                  }
                                }}
                                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all flex items-center gap-1.5"
                              >
                                <span className="material-symbols-outlined text-sm">delete_sweep</span>
                                Removido do ML
                              </button>
                            </>
                          ) : (
                            <div className="flex items-center gap-3">
                              <span className="text-[11px] text-blue-400 font-semibold flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">check</span>
                                Enviado
                              </span>
                              {profile.status !== "removed_multilogin" && (
                                <button
                                  onClick={async () => {
                                    const { error } = await supabase
                                      .from("warming_profiles" as any)
                                      .update({ status: "removed_multilogin" })
                                      .eq("id", profile.id);
                                    if (error) {
                                      toast.error("Erro ao marcar remoção");
                                    } else {
                                      toast.success(`Perfil ${profile.profile_code} removido do Multilogin!`);
                                      fetchProfiles();
                                    }
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all flex items-center gap-1.5"
                                >
                                  <span className="material-symbols-outlined text-sm">delete_sweep</span>
                                  Removido do ML
                                </button>
                              )}
                            </div>
                          )}
                          {profile.status === "removed_multilogin" && (
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">check_circle</span>
                                Finalizado
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </main>
      )}

      {/* BD Perfis Tab */}
      {activeTab === "bd_perfis" && (
        <main className="flex-1 px-6 md:px-8 lg:px-12 py-8 max-w-3xl mx-auto w-full space-y-6">
          {/* Operator Selection - persistent */}
          <div className="bg-white dark:bg-white/5 rounded-xl shadow-sm border border-slate-200 dark:border-white/10 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-white/10 flex items-center gap-2.5">
              <MIcon name="person" className="text-[#1876f2] text-xl" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Operador Selecionado</h2>
            </div>
            <div className="p-5">
              <div className="flex flex-wrap gap-2">
                {teamOperators.map(op => (
                  <button
                    key={op.id}
                    onClick={() => setAssignOperatorId(op.id)}
                    className={`px-4 py-2.5 rounded-lg text-sm font-bold transition-all border ${
                      assignOperatorId === op.id
                        ? "bg-[#1876f2] text-white border-[#1876f2] shadow-md"
                        : "bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white/70 border-slate-200 dark:border-white/15 hover:bg-slate-200 dark:hover:bg-white/20"
                    }`}
                  >
                    {op.name}
                  </button>
                ))}
              </div>
              {assignOperatorId && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-3 flex items-center gap-1">
                  <MIcon name="check_circle" className="text-sm" />
                  Todos os perfis serão atribuídos a <strong>{teamOperators.find(o => o.id === assignOperatorId)?.name}</strong>
                </p>
              )}
              {!assignOperatorId && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-3 flex items-center gap-1">
                  <MIcon name="warning" className="text-sm" />
                  Selecione um operador antes de cadastrar perfis
                </p>
              )}
            </div>
          </div>

          {/* Profile Creation Form */}
          <div className="bg-white dark:bg-white/5 rounded-xl shadow-sm border border-slate-200 dark:border-white/10 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-white/10 flex items-center gap-2.5">
              <MIcon name="person_add" className="text-[#1876f2] text-xl" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Cadastrar Novo Perfil</h2>
              {assignOperatorId && (
                <span className="ml-auto text-xs font-bold px-2.5 py-1 rounded-full bg-[#1876f2]/10 text-[#1876f2]">
                  → {teamOperators.find(o => o.id === assignOperatorId)?.name}
                </span>
              )}
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-white/60 mb-1.5">Código do Perfil</label>
                <div className="relative">
                  <MIcon name="fingerprint" className="absolute left-3 top-2.5 text-slate-400 text-lg" />
                  <input
                    className="w-full pl-10 pr-3 py-2.5 text-sm bg-slate-50 dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-[#1876f2] focus:border-[#1876f2] text-slate-900 dark:text-white transition-all"
                    placeholder="ex: FB-123"
                    value={profileCode}
                    onChange={(e) => setProfileCode(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleCreateProfile(); }}
                  />
                </div>
              </div>
              <div>
                <div className="relative flex items-center gap-2 pl-10 pr-3 py-2.5 text-sm bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg text-slate-600 dark:text-white/60">
                  <MIcon name="layers" className="absolute left-3 top-2.5 text-slate-400 text-lg" />
                  7 Dias - Básica
                  <span className="ml-auto text-[10px] font-bold text-slate-400 uppercase">Automático</span>
                </div>
              </div>
              <button
                onClick={handleCreateProfile}
                disabled={creating || !profileCode.trim() || !assignOperatorId}
                className="w-full bg-[#1876f2] hover:bg-[#1565c0] text-white font-bold py-3 rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
              >
                <MIcon name="person_add" className="text-lg" />
                {creating ? "Cadastrando..." : "Cadastrar Perfil"}
              </button>
              <div className="relative">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt"
                  onChange={handleImportTxt}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing || !assignOperatorId}
                  className="w-full bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-700 dark:text-white/80 font-bold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 text-xs disabled:opacity-50 border border-slate-200 dark:border-white/10"
                >
                  <MIcon name="upload_file" className="text-base" />
                  {importing ? "Importando..." : "Importar lista .txt"}
                </button>
                <p className="text-[10px] text-muted-foreground text-center mt-1">Um código por linha</p>
              </div>
            </div>
          </div>

          {/* Profiles List */}
          <div className="bg-white dark:bg-white/5 rounded-xl shadow-sm border border-slate-200 dark:border-white/10 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-white/10 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <MIcon name="list" className="text-[#1876f2] text-xl" />
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">Perfis Cadastrados</h2>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-white/50">
                  {activeProfiles.length} ativos
                </span>
              </div>
              <div className="relative">
                <MIcon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40 text-base" />
                <input
                  type="text"
                  placeholder="Buscar por código do perfil..."
                  value={profileListSearch}
                  onChange={e => setProfileListSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-[#1876f2]"
                />
              </div>
            </div>
            <div className="max-h-[400px] overflow-y-auto divide-y divide-slate-100 dark:divide-white/10">
              {(() => {
                const searchTerm = profileListSearch.trim().toLowerCase();
                let filtered = activeProfiles;
                if (assignOperatorId) {
                  filtered = filtered.filter(p => p.created_by === assignOperatorId);
                }
                if (searchTerm) {
                  filtered = filtered.filter(p => p.profile_code.toLowerCase().includes(searchTerm));
                }
                if (filtered.length === 0) return (
                  <div className="p-6 text-center text-xs text-slate-500">
                    {searchTerm || assignOperatorId ? `Nenhum perfil encontrado.` : "Nenhum perfil cadastrado ainda."}
                  </div>
                );
                return filtered.slice(0, 50).map(p => {
                  const prog = getProgress(p);
                  const operatorName = p.created_by ? creatorNames[p.created_by] || "—" : "—";
                  return (
                    <div key={p.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-white/5">
                      <MIcon
                        name={p.status === "completed" ? "check_circle" : p.status === "blocked" ? "block" : "local_fire_department"}
                        className={`text-base ${p.status === "completed" ? "text-emerald-500" : p.status === "blocked" ? "text-rose-500" : "text-orange-400"}`}
                      />
                      <div className="flex-1 min-w-0">
                        {editingProfileId === p.id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              autoFocus
                              value={editingCode}
                              onChange={(e) => setEditingCode(e.target.value)}
                              onKeyDown={async (e) => {
                                if (e.key === "Enter") {
                                  if (!editingCode.trim()) return;
                                  await supabase.from("warming_profiles").update({ profile_code: editingCode.trim() }).eq("id", p.id);
                                  toast.success("Código atualizado!");
                                  setEditingProfileId(null);
                                  fetchProfiles();
                                }
                                if (e.key === "Escape") setEditingProfileId(null);
                              }}
                              className="w-24 text-sm font-bold bg-slate-100 dark:bg-white/10 border border-slate-300 dark:border-white/20 rounded px-1.5 py-0.5 dark:text-white"
                            />
                            <button
                              onClick={async () => {
                                if (!editingCode.trim()) return;
                                await supabase.from("warming_profiles").update({ profile_code: editingCode.trim() }).eq("id", p.id);
                                toast.success("Código atualizado!");
                                setEditingProfileId(null);
                                fetchProfiles();
                              }}
                              className="text-emerald-500 hover:text-emerald-400"
                            >
                              <MIcon name="check" className="text-base" />
                            </button>
                            <button onClick={() => setEditingProfileId(null)} className="text-slate-400 hover:text-slate-300">
                              <MIcon name="close" className="text-base" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 group/code">
                            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{p.profile_code}</p>
                            <button
                              onClick={() => { setEditingProfileId(p.id); setEditingCode(p.profile_code); }}
                              className="opacity-0 group-hover/code:opacity-100 transition-opacity text-slate-400 hover:text-[#1876f2]"
                            >
                              <MIcon name="edit" className="text-sm" />
                            </button>
                          </div>
                        )}
                        <p className="text-[11px] text-slate-500 dark:text-white/50">
                          {TRACKS[p.track_type]?.label || p.track_type} • {prog}% • <span className="text-[#1876f2]">{operatorName}</span>
                        </p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        p.status === "completed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" :
                        p.status === "blocked" ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300" :
                        "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
                      }`}>
                        {p.status === "completed" ? "Concluído" : p.status === "blocked" ? "Bloqueado" : "Ativo"}
                      </span>
                    </div>
                  );
                })
              })()}
            </div>
          </div>
        </main>
      )}

      {/* Configurações Tab */}
      {activeTab === "configuracoes" && (
        <main className="flex-1 p-6 md:p-10 max-w-5xl mx-auto w-full space-y-6">
          {/* Commission Rate */}
          <section className="bg-white dark:bg-white/5 rounded-xl shadow-sm border border-slate-200 dark:border-white/10 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-white/10 flex items-center gap-3">
              <MIcon name="payments" className="text-[#1876f2]" />
              <h2 className="text-lg font-bold">Comissão por Perfil Aquecido</h2>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-500 dark:text-white/50 mb-4">
                Valor em R$ que cada operador recebe por perfil aquecido. Os operadores podem alternar a visualização entre quantidade e valor no painel.
              </p>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-slate-700 dark:text-white/70">R$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(e.target.value)}
                  className="w-32 bg-slate-50 dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm font-bold dark:text-white"
                />
                <span className="text-xs text-slate-400 dark:text-white/40">por perfil</span>
                <button
                  disabled={savingCommission}
                  onClick={async () => {
                    setSavingCommission(true);
                    const val = commissionRate;
                    const { data: existing } = await supabase.from("site_settings").select("id").eq("key", "warming_commission_rate").maybeSingle();
                    if (existing) {
                      await supabase.from("site_settings").update({ value: val }).eq("key", "warming_commission_rate");
                    } else {
                      await supabase.from("site_settings").insert({ key: "warming_commission_rate", value: val });
                    }
                    setSavingCommission(false);
                    toast.success("Comissão atualizada!");
                  }}
                  className="px-4 py-2 text-sm font-bold text-white bg-[#1876f2] rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {savingCommission ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          </section>

          <section className="bg-white dark:bg-white/5 rounded-xl shadow-sm border border-slate-200 dark:border-white/10 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MIcon name="settings_accessibility" className="text-[#1876f2]" />
                <h2 className="text-lg font-bold">Configuração de Ações da Esteira</h2>
              </div>
              <div className="flex bg-slate-100 dark:bg-white/10 p-1 rounded-lg">
                {(["7_days", "15_days", "30_days"] as const).map((tk) => (
                  <button
                    key={tk}
                    onClick={() => setConfigTrack(tk)}
                    className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
                      configTrack === tk ? "bg-white dark:bg-white/20 shadow-sm" : "text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80"
                    }`}
                  >
                    {tk === "7_days" ? "7 Dias" : tk === "15_days" ? "15 Dias" : "30 Dias"}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-6 space-y-3 max-h-[400px] overflow-y-auto">
              {configTasks[configTrack].map((task, i) => (
                <div
                  key={`${configTrack}-${i}`}
                  draggable
                  onDragStart={() => handleDragStart(i)}
                  onDragOver={(e) => handleDragOver(e, i)}
                  onDrop={() => handleDrop(i)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-4 p-3 bg-slate-50 dark:bg-white/5 rounded-lg border transition-all ${
                    dragOverIndex === i ? "border-[#1876f2] bg-blue-50 dark:bg-blue-500/10" :
                    dragIndex === i ? "opacity-50 border-slate-100 dark:border-white/10" :
                    "border-slate-100 dark:border-white/10"
                  }`}
                >
                  <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-blue-100 dark:bg-blue-500/20 text-[#1876f2] font-bold text-xs rounded-full">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <input
                    className="flex-1 bg-transparent border-none p-0 text-sm focus:ring-0 outline-none dark:text-white"
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
                  <button
                    onClick={() => {
                      updateConfigTasks(prev => {
                        const updated = { ...prev };
                        updated[configTrack] = updated[configTrack].filter((_, idx) => idx !== i);
                        return updated;
                      });
                    }}
                    className="text-slate-300 hover:text-red-500 dark:text-white/20 dark:hover:text-red-400 transition-colors"
                  >
                    <MIcon name="close" className="text-base" />
                  </button>
                  <MIcon name="drag_indicator" className="text-slate-400 dark:text-white/40 text-sm cursor-grab active:cursor-grabbing" />
                </div>
              ))}
              <div className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-100 dark:border-white/10">
                <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-blue-100 dark:bg-blue-500/20 text-[#1876f2] font-bold text-xs rounded-full">
                  {String(configTasks[configTrack].length + 1).padStart(2, "0")}
                </span>
                <input
                  id="admin-new-track-action"
                  className="flex-1 bg-transparent border-none p-0 text-sm focus:ring-0 outline-none placeholder:text-slate-400 placeholder:italic dark:text-white"
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
                    const input = document.getElementById("admin-new-track-action") as HTMLInputElement;
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

          {/* Trust Tiers */}
          <section className="bg-white dark:bg-white/5 rounded-xl shadow-sm border border-slate-200 dark:border-white/10 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MIcon name="verified_user" className="text-[#1876f2]" />
                <h2 className="text-lg font-bold">Definição de Níveis de Confiança</h2>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => updateTrustTiers([...trustTiers, { label: `Nível ${trustTiers.length + 1}`, color: "bg-slate-100 text-slate-700", range: "0 - 0", criteria: "" }])}
                  className="flex items-center gap-1 text-[#1876f2] text-sm font-bold hover:underline"
                >
                  <MIcon name="add_circle" className="text-sm" /> Adicionar
                </button>
                <button
                  onClick={saveTrustTiers}
                  disabled={trustTiersSaved || trustTiersSaving}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    trustTiersSaved
                      ? "bg-emerald-500/20 text-emerald-400 cursor-default"
                      : "bg-[#1876f2] text-white hover:bg-[#1876f2]/90"
                  }`}
                >
                  <MIcon name={trustTiersSaved ? "check_circle" : "save"} className="!text-sm" />
                  {trustTiersSaving ? "Salvando..." : trustTiersSaved ? "Salvo" : "Salvar"}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-white/5">
                    <th className="px-6 py-3 font-bold text-slate-500 dark:text-white/50 uppercase tracking-wider text-[10px]">Nível</th>
                    <th className="px-6 py-3 font-bold text-slate-500 dark:text-white/50 uppercase tracking-wider text-[10px]">Faixa</th>
                    <th className="px-6 py-3 font-bold text-slate-500 dark:text-white/50 uppercase tracking-wider text-[10px]">Critérios</th>
                    <th className="px-6 py-3 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                  {trustTiers.map((tier, i) => (
                    <tr key={i} className="group">
                      <td className="px-6 py-4">
                        <input
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${tier.color} border-none outline-none bg-transparent w-full max-w-[220px]`}
                          value={tier.label}
                          onChange={(e) => { const t = [...trustTiers]; t[i] = { ...t[i], label: e.target.value }; updateTrustTiers(t); }}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          className="bg-slate-50 dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded px-2 py-1 text-xs w-20 dark:text-white"
                          value={tier.range}
                          onChange={(e) => { const t = [...trustTiers]; t[i] = { ...t[i], range: e.target.value }; updateTrustTiers(t); }}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          className="w-full bg-transparent border-none p-0 text-xs text-slate-700 dark:text-white/70 focus:ring-0 outline-none"
                          value={tier.criteria}
                          onChange={(e) => { const t = [...trustTiers]; t[i] = { ...t[i], criteria: e.target.value }; updateTrustTiers(t); }}
                        />
                      </td>
                      <td className="px-6 py-4 text-right">
                        {trustTiers.length > 1 && (
                          <button
                            onClick={() => updateTrustTiers(trustTiers.filter((_, idx) => idx !== i))}
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

          <section className="bg-white dark:bg-white/5 rounded-xl shadow-sm border border-slate-200 dark:border-white/10 overflow-hidden mt-4">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MIcon name="task_alt" className="text-[#1876f2]" />
                <div>
                  <h2 className="text-lg font-bold">Critérios para Perfil Pronto para Venda</h2>
                  <p className="text-xs text-slate-500 dark:text-white/50">Configure as regras mínimas para considerar o perfil pronto.</p>
                </div>
              </div>
              <button
                onClick={saveReadyCriteria}
                disabled={readyCriteriaSaved || readyCriteriaSaving}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  readyCriteriaSaved
                    ? "bg-emerald-500/20 text-emerald-400 cursor-default"
                    : "bg-[#1876f2] text-white hover:bg-[#1876f2]/90"
                }`}
              >
                <MIcon name={readyCriteriaSaved ? "check_circle" : "save"} className="!text-sm" />
                {readyCriteriaSaving ? "Salvando..." : readyCriteriaSaved ? "Salvo" : "Salvar"}
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-4 space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-white/50">Amizade mínima</label>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/10 px-3 py-2 text-sm"
                  value={readyCriteria.minFriends}
                  onChange={(e) => updateReadyCriteria({ minFriends: Number(e.target.value) || 0 })}
                />
                <p className="text-xs text-slate-500 dark:text-white/50">Mínimo recomendado: 20 amigos.</p>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-white/50">Segurança</label>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1">Exigir 2FA ativo</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={readyCriteria.require2FA}
                    onChange={(e) => updateReadyCriteria({ require2FA: e.target.checked })}
                    className="mt-1 h-4 w-4"
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-white/50">Se ativo, o perfil só fica pronto com 2FA ligado.</p>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-4 space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-white/50">Dias mínimos de aquecimento</label>
                <input
                  type="number"
                  min={1}
                  className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/10 px-3 py-2 text-sm"
                  value={readyCriteria.minWarmingDays}
                  onChange={(e) => updateReadyCriteria({ minWarmingDays: Number(e.target.value) || 1 })}
                />
                <p className="text-xs text-slate-500 dark:text-white/50">Base atual: mais de 7 dias.</p>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-4 space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-white/50">BM opcional</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min={0}
                    className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/10 px-3 py-2 text-sm"
                    value={readyCriteria.optionalBmMin}
                    onChange={(e) => updateReadyCriteria({ optionalBmMin: Number(e.target.value) || 0 })}
                  />
                  <input
                    type="number"
                    min={readyCriteria.optionalBmMin}
                    className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/10 px-3 py-2 text-sm"
                    value={readyCriteria.optionalBmMax}
                    onChange={(e) => updateReadyCriteria({ optionalBmMax: Number(e.target.value) || 0 })}
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-white/50">Faixa sugerida: 1 a 2 BM.</p>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-4 space-y-3 md:col-span-2 xl:col-span-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-white/50">Página</label>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1">Página como item opcional</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={readyCriteria.optionalPage}
                    onChange={(e) => updateReadyCriteria({ optionalPage: e.target.checked })}
                    className="mt-1 h-4 w-4"
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-white/50">Mantém página como recomendação, sem obrigatoriedade.</p>
              </div>

              <div className="rounded-xl border border-dashed border-slate-200 dark:border-white/15 bg-white dark:bg-white/5 p-4 md:col-span-2 xl:col-span-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-white/50 mb-2">Resumo atual</p>
                <p className="text-sm text-slate-700 dark:text-white/70 leading-relaxed">
                  Perfil pronto para venda com pelo menos <span className="font-bold text-slate-900 dark:text-white">{readyCriteria.minFriends} amigos</span>,
                  {readyCriteria.require2FA ? <span className="font-bold text-slate-900 dark:text-white"> 2FA ativo</span> : <span> 2FA opcional</span>},
                  <span> BM opcional entre </span>
                  <span className="font-bold text-slate-900 dark:text-white">{readyCriteria.optionalBmMin} e {readyCriteria.optionalBmMax}</span>,
                  readyCriteria.optionalPage ? <span> com <span className="font-bold text-slate-900 dark:text-white">página opcional</span> e </span> : <span> sem página nos critérios e </span>
                  <span className="font-bold text-slate-900 dark:text-white">mais de {readyCriteria.minWarmingDays} dias de aquecimento</span>.
                </p>
              </div>
            </div>
          </section>

          {/* Client Warming Config */}
          <section className="bg-white dark:bg-white/5 rounded-xl shadow-sm border border-orange-200 dark:border-orange-500/20 overflow-hidden">
            <div className="px-6 py-4 border-b border-orange-100 dark:border-orange-500/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MIcon name="local_fire_department" className="text-orange-500" />
                <div>
                  <h2 className="text-lg font-bold">Esteira do Cliente (7 Dias)</h2>
                  <p className="text-xs text-slate-500 dark:text-white/40">Tarefas que aparecem na esteira de aquecimento do cliente</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-3 max-h-[400px] overflow-y-auto">
              {clientConfigTasks.map((task, i) => (
                <div
                  key={`client-${i}`}
                  draggable
                  onDragStart={() => handleClientDragStart(i)}
                  onDragOver={(e) => handleClientDragOver(e, i)}
                  onDrop={() => handleClientDrop(i)}
                  onDragEnd={handleClientDragEnd}
                  className={`flex items-start gap-4 p-3 bg-slate-50 dark:bg-white/5 rounded-lg border transition-all ${
                    clientDragOverIndex === i ? "border-orange-500 bg-orange-50 dark:bg-orange-500/10" :
                    clientDragIndex === i ? "opacity-50 border-slate-100 dark:border-white/10" :
                    "border-slate-100 dark:border-white/10"
                  }`}
                >
                  <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-orange-100 dark:bg-orange-500/20 text-orange-600 font-bold text-xs rounded-full mt-1">
                    D{i + 1}
                  </span>
                  <div className="flex-1 space-y-1">
                    <input
                      className="w-full bg-transparent border-none p-0 text-sm font-bold focus:ring-0 outline-none dark:text-white"
                      type="text"
                      value={task.title}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateClientConfigTasks(prev => {
                          const updated = [...prev];
                          updated[i] = { ...updated[i], title: val };
                          return updated;
                        });
                      }}
                    />
                    <textarea
                      className="w-full bg-transparent border-none p-0 text-xs text-slate-500 dark:text-white/50 focus:ring-0 outline-none resize-none overflow-hidden"
                      placeholder="Descrição..."
                      rows={1}
                      value={task.description}
                      onChange={(e) => {
                        const val = e.target.value;
                        e.target.style.height = "auto";
                        e.target.style.height = e.target.scrollHeight + "px";
                        updateClientConfigTasks(prev => {
                          const updated = [...prev];
                          updated[i] = { ...updated[i], description: val };
                          return updated;
                        });
                      }}
                      onFocus={(e) => {
                        e.target.style.height = "auto";
                        e.target.style.height = e.target.scrollHeight + "px";
                      }}
                    />
                  </div>
                  <button
                    onClick={() => {
                      updateClientConfigTasks(prev => prev.filter((_, idx) => idx !== i));
                    }}
                    className="text-slate-300 hover:text-red-500 dark:text-white/20 dark:hover:text-red-400 transition-colors mt-1"
                  >
                    <MIcon name="close" className="text-base" />
                  </button>
                  <MIcon name="drag_indicator" className="text-slate-400 dark:text-white/40 text-sm cursor-grab active:cursor-grabbing mt-1" />
                </div>
              ))}
              <div className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-100 dark:border-white/10">
                <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-orange-100 dark:bg-orange-500/20 text-orange-600 font-bold text-xs rounded-full">
                  D{clientConfigTasks.length + 1}
                </span>
                <input
                  id="admin-new-client-track-action"
                  className="flex-1 bg-transparent border-none p-0 text-sm focus:ring-0 outline-none placeholder:text-slate-400 placeholder:italic dark:text-white"
                  type="text"
                  placeholder={`Adicionar tarefa para o Dia ${clientConfigTasks.length + 1}...`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
                      const newTitle = (e.target as HTMLInputElement).value.trim();
                      updateClientConfigTasks(prev => [...prev, { title: newTitle, description: "" }]);
                      (e.target as HTMLInputElement).value = "";
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const input = document.getElementById("admin-new-client-track-action") as HTMLInputElement;
                    if (input && input.value.trim()) {
                      const newTitle = input.value.trim();
                      updateClientConfigTasks(prev => [...prev, { title: newTitle, description: "" }]);
                      input.value = "";
                    }
                  }}
                  className="text-orange-500 hover:text-orange-600 transition-colors"
                >
                  <MIcon name="add_circle" className="text-xl" />
                </button>
              </div>
            </div>
          </section>

          {/* Danger Zone */}
          <section className="bg-white dark:bg-white/5 rounded-xl shadow-sm border border-red-200 dark:border-red-500/20 overflow-hidden">
            <div className="px-6 py-4 border-b border-red-100 dark:border-red-500/20 flex items-center gap-3">
              <MIcon name="warning" className="text-red-500" />
              <h2 className="text-lg font-bold text-red-700 dark:text-red-400">Zona de Perigo</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-lg p-4">
                <h3 className="font-bold text-sm text-red-800 dark:text-red-400 mb-1">Zerar todas as Esteiras e Perfis</h3>
                <p className="text-xs text-red-600 dark:text-red-400/70 mb-4">
                  Esta ação é irreversível. Todos os perfis e tarefas serão excluídos permanentemente.
                </p>
                {!showResetConfirm ? (
                  <button
                    onClick={() => setShowResetConfirm(true)}
                    className="px-5 py-2 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Zerar Tudo
                  </button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-red-700 dark:text-red-400 font-bold">Digite sua senha para confirmar:</p>
                    <input
                      type="password"
                      value={resetPassword}
                      onChange={e => setResetPassword(e.target.value)}
                      className="w-full max-w-xs bg-white dark:bg-white/10 border border-red-200 dark:border-red-500/20 rounded-lg px-3 py-2 text-sm dark:text-white"
                      placeholder="Sua senha"
                    />
                    {resetError && <p className="text-xs text-red-600 font-bold">{resetError}</p>}
                    <div className="flex gap-3">
                      <button
                        onClick={handleResetAll}
                        disabled={resetting || !resetPassword}
                        className="px-5 py-2 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        {resetting ? "Zerando..." : "Confirmar"}
                      </button>
                      <button
                        onClick={() => { setShowResetConfirm(false); setResetPassword(""); setResetError(""); }}
                        className="px-5 py-2 text-sm font-bold text-slate-600 dark:text-white/60 bg-slate-100 dark:bg-white/10 rounded-lg hover:bg-slate-200 dark:hover:bg-white/20 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </main>
      )}
    </div>
  );
}
