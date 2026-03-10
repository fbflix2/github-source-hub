import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  PlusCircle, Fingerprint, Layers, UserCheck, Thermometer, 
  Check, RefreshCw, ShieldCheck, RotateCw, Play, Pause, 
  Trash2, ChevronDown, ChevronUp, AlertTriangle
} from "lucide-react";

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
      { day: 14, title: "Checar Trust Tier", description: "Verificar nível de confiança da conta." },
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
      { day: 14, title: "Checar Tier", description: "Verificar trust tier." },
      { day: 15, title: "BM parcial check", description: "Checar BM status." },
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
}

export default function AdminAquecimento() {
  const [profiles, setProfiles] = useState<WarmingProfile[]>([]);
  const [tasks, setTasks] = useState<Record<string, WarmingTask[]>>({});
  const [loading, setLoading] = useState(true);
  const [profileCode, setProfileCode] = useState("");
  const [profileName, setProfileName] = useState("");
  const [selectedTrack, setSelectedTrack] = useState("15_days");
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("warming_profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar perfis");
      console.error(error);
    } else {
      setProfiles(data || []);
      // auto-expand first active
      const first = data?.find((p: any) => p.status === "active");
      if (first) {
        setExpandedProfile(first.id);
        fetchTasks(first.id);
      }
    }
    setLoading(false);
  };

  const fetchTasks = async (profileId: string) => {
    const { data, error } = await supabase
      .from("warming_tasks")
      .select("*")
      .eq("profile_id", profileId)
      .order("day_number", { ascending: true });
    if (!error && data) {
      setTasks((prev) => ({ ...prev, [profileId]: data }));
    }
  };

  const handleCreate = async () => {
    if (!profileCode.trim()) {
      toast.error("Digite o código do perfil");
      return;
    }
    setCreating(true);
    const track = TRACKS[selectedTrack];
    const { data: { user } } = await supabase.auth.getUser();

    const { data: profile, error } = await supabase
      .from("warming_profiles")
      .insert({
        profile_code: profileCode.trim(),
        profile_name: profileName.trim() || null,
        track_type: selectedTrack,
        track_days: track.days,
        created_by: user?.id || null,
      })
      .select()
      .single();

    if (error || !profile) {
      toast.error("Erro ao criar perfil");
      setCreating(false);
      return;
    }

    // Insert tasks
    const taskRows = track.tasks.map((t) => ({
      profile_id: profile.id,
      day_number: t.day,
      title: t.title,
      description: t.description,
    }));

    await supabase.from("warming_tasks").insert(taskRows);

    toast.success(`Perfil ${profileCode} atribuído à esteira ${track.label}`);
    setProfileCode("");
    setProfileName("");
    setExpandedProfile(profile.id);
    fetchProfiles();
    fetchTasks(profile.id);
    setCreating(false);
  };

  const toggleTask = async (task: WarmingTask) => {
    const newCompleted = !task.completed;
    await supabase
      .from("warming_tasks")
      .update({
        completed: newCompleted,
        completed_at: newCompleted ? new Date().toISOString() : null,
      })
      .eq("id", task.id);

    // Update current_day on profile
    if (newCompleted) {
      const profileTasks = tasks[task.profile_id] || [];
      const completedCount = profileTasks.filter((t) => t.completed || t.id === task.id).length;
      const profile = profiles.find((p) => p.id === task.profile_id);
      if (profile) {
        const newDay = Math.min(completedCount + 1, profile.track_days);
        const newStatus = completedCount >= profile.track_days ? "completed" : "active";
        await supabase
          .from("warming_profiles")
          .update({ current_day: newDay, status: newStatus, updated_at: new Date().toISOString() })
          .eq("id", task.profile_id);
      }
    }

    fetchTasks(task.profile_id);
    fetchProfiles();
  };

  const updateStatus = async (profileId: string, status: string) => {
    await supabase
      .from("warming_profiles")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", profileId);
    fetchProfiles();
    toast.success(`Status atualizado para ${status}`);
  };

  const deleteProfile = async (profileId: string) => {
    if (!confirm("Tem certeza que deseja excluir este perfil de aquecimento?")) return;
    await supabase.from("warming_profiles").delete().eq("id", profileId);
    setProfiles((prev) => prev.filter((p) => p.id !== profileId));
    toast.success("Perfil removido");
  };

  const updateTrustTier = async (profileId: string) => {
    const tier = prompt("Digite o Trust Tier atual (ex: Tier 1, Tier 2, Tier 3):");
    if (!tier) return;
    await supabase
      .from("warming_profiles")
      .update({ trust_tier: tier, updated_at: new Date().toISOString() })
      .eq("id", profileId);
    fetchProfiles();
    toast.success("Trust Tier atualizado");
  };

  const getProgress = (profile: WarmingProfile) => {
    const profileTaskList = tasks[profile.id];
    if (!profileTaskList) {
      // fallback: day-based
      return Math.min(100, Math.round(((profile.current_day - 1) / profile.track_days) * 100));
    }
    const completed = profileTaskList.filter((t) => t.completed).length;
    return Math.min(100, Math.round((completed / profileTaskList.length) * 100));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active": return { label: "ATIVO", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" };
      case "completed": return { label: "CONCLUÍDO", color: "bg-green-500/10 text-green-400 border-green-500/20" };
      case "paused": return { label: "PAUSADO", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" };
      case "restricted": return { label: "RESTRIÇÃO", color: "bg-red-500/10 text-red-400 border-red-500/20" };
      default: return { label: status.toUpperCase(), color: "bg-white/10 text-white/60" };
    }
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Hero Banner */}
      <div className="relative overflow-hidden bg-primary rounded-xl py-10 px-6 lg:px-12 text-center">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto">
          <h1 className="text-white text-3xl lg:text-4xl font-black mb-3 tracking-tight">
            Esteira Operacional FBFlix
          </h1>
          <p className="text-white/80 text-sm lg:text-base max-w-2xl mx-auto font-normal leading-relaxed">
            Sistema para aquecer perfis de Facebook Ads em 7, 15 ou 30 dias, com atribuição inteligente e monitoramento em tempo real.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ── Form Section ── */}
        <section className="lg:col-span-5">
          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
            <div className="p-5 border-b border-white/10 flex items-center gap-3">
              <PlusCircle className="size-5 text-primary" />
              <h2 className="text-lg font-bold text-white">Iniciar Novo Aquecimento</h2>
            </div>
            <div className="p-5 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-white/70 mb-2">Código do Perfil</label>
                <div className="relative">
                  <Fingerprint className="absolute left-3 top-3 text-white/40 size-5" />
                  <input
                    className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-white placeholder:text-white/30 transition-all text-sm"
                    placeholder="ex: FB-123"
                    value={profileCode}
                    onChange={(e) => setProfileCode(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-white/70 mb-2">Nome do Perfil (opcional)</label>
                <div className="relative">
                  <UserCheck className="absolute left-3 top-3 text-white/40 size-5" />
                  <input
                    className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-white placeholder:text-white/30 transition-all text-sm"
                    placeholder="ex: Perfil Alfa"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-white/70 mb-2">Escolha a Esteira</label>
                <div className="relative">
                  <Layers className="absolute left-3 top-3 text-white/40 size-5" />
                  <select
                    className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-white appearance-none transition-all text-sm"
                    value={selectedTrack}
                    onChange={(e) => setSelectedTrack(e.target.value)}
                  >
                    <option value="7_days" className="bg-[#1a1a1a]">7 Dias - Básica</option>
                    <option value="15_days" className="bg-[#1a1a1a]">15 Dias - Média</option>
                    <option value="30_days" className="bg-[#1a1a1a]">30 Dias - Premium</option>
                  </select>
                </div>
              </div>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3.5 rounded-lg shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
              >
                <UserCheck className="size-4" />
                {creating ? "Atribuindo..." : "Atribuir Perfil"}
              </button>
              <p className="text-[11px] text-white/40 text-center leading-tight">
                Certifique-se de que o perfil está logado no navegador multilogin antes de iniciar.
              </p>
            </div>
          </div>
        </section>

        {/* ── Profiles Dashboard ── */}
        <section className="lg:col-span-7 space-y-4">
          {loading ? (
            <div className="bg-white/5 rounded-xl border border-white/10 p-12 text-center">
              <RefreshCw className="size-6 text-white/40 animate-spin mx-auto mb-2" />
              <p className="text-white/50 text-sm">Carregando perfis...</p>
            </div>
          ) : profiles.length === 0 ? (
            <div className="bg-white/5 rounded-xl border border-white/10 p-12 text-center">
              <Thermometer className="size-8 text-white/20 mx-auto mb-3" />
              <p className="text-white/50 text-sm">Nenhum perfil em aquecimento.</p>
              <p className="text-white/30 text-xs mt-1">Atribua um perfil para começar.</p>
            </div>
          ) : (
            profiles.map((profile) => {
              const progress = getProgress(profile);
              const badge = getStatusBadge(profile.status);
              const isExpanded = expandedProfile === profile.id;
              const profileTasks = tasks[profile.id] || [];
              const trackDef = TRACKS[profile.track_type];

              return (
                <div
                  key={profile.id}
                  className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden"
                >
                  {/* Header */}
                  <div
                    className="p-5 flex justify-between items-center cursor-pointer hover:bg-white/[0.02] transition-colors"
                    onClick={() => {
                      if (isExpanded) {
                        setExpandedProfile(null);
                      } else {
                        setExpandedProfile(profile.id);
                        if (!tasks[profile.id]) fetchTasks(profile.id);
                      }
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-1.5 rounded-full ${profile.status === "active" ? "bg-green-500/20 text-green-400" : profile.status === "completed" ? "bg-blue-500/20 text-blue-400" : profile.status === "restricted" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                        {profile.status === "completed" ? <Check className="size-4" /> : profile.status === "restricted" ? <AlertTriangle className="size-4" /> : <Play className="size-4" />}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-white font-bold text-sm truncate">
                          {profile.profile_code}
                          {profile.profile_name && <span className="text-white/50 font-normal"> ({profile.profile_name})</span>}
                        </h3>
                        <p className="text-white/40 text-xs">
                          Esteira: {trackDef?.label || profile.track_type} • Dia {profile.current_day}/{profile.track_days}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider border ${badge.color}`}>
                        {badge.label}
                      </span>
                      {profile.trust_tier && (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          {profile.trust_tier}
                        </span>
                      )}
                      {isExpanded ? <ChevronUp className="size-4 text-white/40" /> : <ChevronDown className="size-4 text-white/40" />}
                    </div>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="px-5 pb-5 space-y-6 border-t border-white/5 pt-5">
                      {/* Thermometer */}
                      <div>
                        <div className="flex justify-between items-end mb-3">
                          <span className="text-sm font-bold text-white/70 flex items-center gap-1.5">
                            <Thermometer className="size-4 text-orange-400" />
                            Status de Aquecimento
                          </span>
                          <span className="text-2xl font-black text-primary">{progress}%</span>
                        </div>
                        <div className="relative h-5 w-full bg-white/5 rounded-full overflow-hidden border border-white/10">
                          <div
                            className="absolute top-0 left-0 h-full bg-green-500 transition-all duration-500"
                            style={{ width: `${Math.min(progress, 45)}%`, boxShadow: "0 0 10px rgba(34,197,94,0.4)" }}
                          />
                          <div
                            className="absolute top-0 h-full bg-yellow-400 opacity-30"
                            style={{ left: "45%", width: "35%" }}
                          />
                          <div
                            className="absolute top-0 h-full bg-red-500 opacity-20"
                            style={{ left: "80%", width: "20%" }}
                          />
                          {/* Actual progress overlay */}
                          <div
                            className="absolute top-0 left-0 h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${progress}%`,
                              background: progress <= 30 ? "#ef4444" : progress <= 70 ? "#eab308" : "#22c55e",
                              boxShadow: `0 0 12px ${progress <= 30 ? "rgba(239,68,68,0.4)" : progress <= 70 ? "rgba(234,179,8,0.4)" : "rgba(34,197,94,0.4)"}`,
                            }}
                          />
                        </div>
                        <div className="flex justify-between mt-1.5 px-1">
                          <span className="text-[10px] font-bold text-white/30 uppercase tracking-tighter">Início</span>
                          <span className="text-[10px] font-bold text-white/30 uppercase tracking-tighter">Ideal</span>
                          <span className="text-[10px] font-bold text-white/30 uppercase tracking-tighter">Pronto</span>
                        </div>
                      </div>

                      {/* Tasks */}
                      <div className="space-y-2">
                        <h3 className="text-xs font-bold text-white/60 uppercase tracking-wider">Cronograma de Atividades</h3>
                        <div className="max-h-[320px] overflow-y-auto space-y-2 pr-1">
                          {profileTasks.map((task) => {
                            const isCurrent = !task.completed && profileTasks.filter((t) => !t.completed)[0]?.id === task.id;
                            return (
                              <div
                                key={task.id}
                                className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                                  task.completed
                                    ? "bg-white/[0.02] border-white/5"
                                    : isCurrent
                                    ? "bg-primary/5 border-primary/20 ring-1 ring-primary/20"
                                    : "bg-white/[0.02] border-white/5 opacity-50"
                                }`}
                                onClick={() => toggleTask(task)}
                              >
                                <div className={`p-1.5 rounded-full shrink-0 ${
                                  task.completed ? "bg-green-500/20 text-green-400" : isCurrent ? "bg-primary/20 text-primary" : "bg-white/10 text-white/30"
                                }`}>
                                  {task.completed ? <Check className="size-3.5" /> : isCurrent ? <RotateCw className="size-3.5" /> : <div className="size-3.5" />}
                                </div>
                                <div className="flex-grow min-w-0">
                                  <p className={`text-xs font-bold ${task.completed ? "text-white/50 line-through" : "text-white"}`}>
                                    Dia {task.day_number}: {task.title}
                                  </p>
                                  <p className="text-[11px] text-white/40 truncate">{task.description}</p>
                                </div>
                                <span className={`text-[10px] font-bold shrink-0 ${
                                  task.completed ? "text-green-400" : isCurrent ? "text-primary animate-pulse" : "text-white/20"
                                }`}>
                                  {task.completed ? "Concluído" : isCurrent ? "Em andamento" : "Pendente"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                        <button
                          onClick={() => { fetchTasks(profile.id); fetchProfiles(); toast.success("Progresso atualizado"); }}
                          className="flex items-center justify-center gap-1.5 bg-white/5 text-white/70 font-semibold py-2.5 rounded-lg hover:bg-white/10 transition-colors text-xs"
                        >
                          <RefreshCw className="size-3.5" />
                          Atualizar
                        </button>
                        <button
                          onClick={() => updateTrustTier(profile.id)}
                          className="flex items-center justify-center gap-1.5 bg-white/5 text-white/70 font-semibold py-2.5 rounded-lg hover:bg-white/10 transition-colors text-xs"
                        >
                          <ShieldCheck className="size-3.5" />
                          Trust Tier
                        </button>
                        <button
                          onClick={() => updateStatus(profile.id, profile.status === "paused" ? "active" : "paused")}
                          className="flex items-center justify-center gap-1.5 bg-white/5 text-white/70 font-semibold py-2.5 rounded-lg hover:bg-white/10 transition-colors text-xs"
                        >
                          {profile.status === "paused" ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
                          {profile.status === "paused" ? "Retomar" : "Pausar"}
                        </button>
                        <button
                          onClick={() => deleteProfile(profile.id)}
                          className="flex items-center justify-center gap-1.5 bg-red-500/10 text-red-400 font-semibold py-2.5 rounded-lg hover:bg-red-500/20 transition-colors text-xs"
                        >
                          <Trash2 className="size-3.5" />
                          Excluir
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>
      </div>
    </div>
  );
}
