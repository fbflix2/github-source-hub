import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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

function MIcon({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

export default function AdminAquecimento() {
  const [profiles, setProfiles] = useState<WarmingProfile[]>([]);
  const [tasks, setTasks] = useState<Record<string, WarmingTask[]>>({});
  const [loading, setLoading] = useState(true);
  const [profileCode, setProfileCode] = useState("");
  const [selectedTrack, setSelectedTrack] = useState("15_days");
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "esteiras" | "relatorios">("esteiras");

  useEffect(() => {
    if (!document.querySelector('link[href*="Material+Symbols+Outlined"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap";
      document.head.appendChild(link);
    }
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
    } else {
      setProfiles(data || []);
      const first = data?.find((p: any) => p.status === "active");
      if (first) {
        setSelectedProfileId(first.id);
        fetchTasks(first.id);
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
    setCreating(true);
    const track = TRACKS[selectedTrack];
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile, error } = await supabase
      .from("warming_profiles")
      .insert({ profile_code: profileCode.trim(), track_type: selectedTrack, track_days: track.days, created_by: user?.id || null })
      .select()
      .single();
    if (error || !profile) { toast.error("Erro ao criar perfil"); setCreating(false); return; }
    const taskRows = track.tasks.map((t) => ({ profile_id: profile.id, day_number: t.day, title: t.title, description: t.description }));
    await supabase.from("warming_tasks").insert(taskRows);
    toast.success(`Perfil ${profileCode} atribuído à esteira ${track.label}`);
    setProfileCode("");
    setSelectedProfileId(profile.id);
    fetchProfiles();
    fetchTasks(profile.id);
    setCreating(false);
  };

  const toggleTask = async (task: WarmingTask) => {
    const newCompleted = !task.completed;
    await supabase.from("warming_tasks").update({ completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null }).eq("id", task.id);
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
    const tier = prompt("Digite o Trust Tier atual (ex: Tier 1, Tier 2, Tier 3):");
    if (!tier) return;
    await supabase.from("warming_profiles").update({ trust_tier: tier, updated_at: new Date().toISOString() }).eq("id", profileId);
    fetchProfiles();
    toast.success("Trust Tier atualizado");
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
    { key: "dashboard", label: "Dashboard", icon: "dashboard" },
    { key: "esteiras", label: "Esteiras", icon: "layers" },
    { key: "relatorios", label: "Relatórios", icon: "analytics" },
  ] as const;

  return (
    <div className="flex flex-col min-h-full bg-[#f5f7f8]" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* ── Hero Section ── */}
      <div className="relative overflow-hidden bg-[#1876f2] py-16 px-6 lg:px-20 text-center">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
        </div>
        <div className="relative z-10 max-w-4xl mx-auto">
          <h1 className="text-white text-4xl lg:text-5xl font-black mb-4 tracking-tight">
            Esteira Operacional FBFlix
          </h1>
          <p className="text-white/80 text-lg lg:text-xl max-w-2xl mx-auto font-normal leading-relaxed">
            Sistema para aquecer perfis de Facebook Ads em 7, 15 ou 30 dias, com atribuição inteligente e monitoramento em tempo real.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <button
              onClick={() => document.getElementById("form-section")?.scrollIntoView({ behavior: "smooth" })}
              className="bg-white text-[#1876f2] px-6 py-3 rounded-lg font-bold text-sm shadow-lg hover:bg-slate-50 transition-all flex items-center gap-2"
            >
              <MIcon name="play_circle" />
              Iniciar Agora
            </button>
            <button className="bg-[#1876f2]/20 text-white border border-white/30 px-6 py-3 rounded-lg font-bold text-sm backdrop-blur-sm hover:bg-[#1876f2]/30 transition-all">
              Documentação
            </button>
          </div>
        </div>
      </div>

      {/* ── Tab Navigation ── */}
      <div className="relative z-20 -mt-7 flex justify-center px-6">
        <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 flex items-center gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                activeTab === tab.key
                  ? "bg-[#1876f2] text-white shadow-md shadow-[#1876f2]/20"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <MIcon name={tab.icon} className="text-lg" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main Content ── */}
      <div id="form-section" className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-8 pb-12 pt-16 w-full">
        {/* ── Selection Form Section ── */}
        <section className="lg:col-span-5">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center gap-3">
              <MIcon name="add_circle" className="text-[#1876f2]" />
              <h2 className="text-xl font-bold text-slate-900">Iniciar Novo Aquecimento</h2>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Código do Perfil</label>
                <div className="relative">
                  <MIcon name="fingerprint" className="absolute left-3 top-3.5 text-slate-400 text-xl" />
                  <input
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#1876f2] focus:border-[#1876f2] text-slate-900 transition-all"
                    placeholder="ex: FB-123"
                    value={profileCode}
                    onChange={(e) => setProfileCode(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Escolha a Esteira</label>
                <div className="relative">
                  <MIcon name="layers" className="absolute left-3 top-3.5 text-slate-400 text-xl" />
                  <select
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#1876f2] focus:border-[#1876f2] text-slate-900 appearance-none transition-all"
                    value={selectedTrack}
                    onChange={(e) => setSelectedTrack(e.target.value)}
                  >
                    <option value="7_days">7 Dias - Básica</option>
                    <option value="15_days">15 Dias - Média</option>
                    <option value="30_days">30 Dias - Premium</option>
                  </select>
                </div>
              </div>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="w-full bg-[#1876f2] hover:bg-[#1876f2]/90 text-white font-bold py-4 rounded-lg shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <MIcon name="assignment_ind" />
                {creating ? "Atribuindo..." : "Atribuir Perfil"}
              </button>
              <p className="text-xs text-slate-500 text-center leading-tight">
                Certifique-se de que o perfil está logado no navegador multilogin antes de iniciar.
              </p>
            </div>
          </div>

          {profiles.length > 1 && (
            <div className="mt-4 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-700">Perfis em Aquecimento</h3>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {profiles.map((p) => {
                  const prog = getProgress(p);
                  const isSelected = selectedProfileId === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => { setSelectedProfileId(p.id); if (!tasks[p.id]) fetchTasks(p.id); }}
                      className={`flex items-center gap-3 px-6 py-3 cursor-pointer border-b border-slate-50 transition-colors ${isSelected ? "bg-[#1876f2]/5" : "hover:bg-slate-50"}`}
                    >
                      <MIcon
                        name={p.status === "completed" ? "check_circle" : p.status === "restricted" ? "warning" : "play_circle"}
                        className={`text-lg ${p.status === "completed" ? "text-green-500" : p.status === "restricted" ? "text-red-500" : "text-[#1876f2]"}`}
                      />
                      <div className="flex-grow min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{p.profile_code}</p>
                        <p className="text-xs text-slate-500">{TRACKS[p.track_type]?.label} • {prog}%</p>
                      </div>
                      <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
                        p.status === "active" ? "bg-[#1876f2]/10 text-[#1876f2]" :
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

        {/* ── Progress Dashboard Section ── */}
        <section className="lg:col-span-7">
          {loading ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
              <MIcon name="hourglass_empty" className="text-slate-300 text-4xl" />
              <p className="text-slate-500 text-sm mt-2">Carregando...</p>
            </div>
          ) : !selectedProfile ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
              <MIcon name="thermostat" className="text-slate-300 text-4xl" />
              <p className="text-slate-500 text-sm mt-2">Nenhum perfil em aquecimento. Atribua um perfil para começar.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              {/* Header */}
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <MIcon name="check_circle" className="text-green-500 text-lg" />
                    <h2 className="text-xl font-bold text-slate-900">
                      {selectedProfile.profile_code}
                      {selectedProfile.profile_name && ` (${selectedProfile.profile_name})`}
                    </h2>
                  </div>
                  <p className="text-sm text-slate-500 font-medium">
                    Esteira: {selectedTrackDef?.label || selectedProfile.track_type}
                    {selectedProfile.trust_tier && <span className="ml-2 text-purple-600 font-bold">• {selectedProfile.trust_tier}</span>}
                  </p>
                </div>
                <span className="bg-[#1876f2]/10 text-[#1876f2] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                  {selectedProfile.status === "active" ? "Ativo" : selectedProfile.status === "completed" ? "Concluído" : selectedProfile.status}
                </span>
              </div>

              <div className="p-6 space-y-8">
                {/* Thermometer Progress Bar */}
                <div>
                  <div className="flex justify-between items-end mb-4">
                    <span className="text-sm font-bold text-slate-700 flex items-center gap-1">
                      <MIcon name="thermostat" className="text-orange-500" />
                      Status de Aquecimento
                    </span>
                    <span className="text-2xl font-black text-[#1876f2]">{selectedProgress}%</span>
                  </div>
                  <div className="relative h-6 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200 shadow-inner">
                    <div className="absolute top-0 left-0 h-full bg-green-500" style={{ width: `${selectedProgress}%`, boxShadow: "0 0 10px rgba(34,197,94,0.4)" }} />
                    <div className="absolute top-0 h-full bg-yellow-400 opacity-30" style={{ left: "45%", width: "35%" }} />
                    <div className="absolute top-0 h-full bg-red-500 opacity-20" style={{ left: "80%", width: "20%" }} />
                  </div>
                  <div className="flex justify-between mt-2 px-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Início</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Ideal</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Pronto</span>
                  </div>
                </div>

                {/* Daily Steps List */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Cronograma de Atividades</h3>
                  {selectedTasks.map((task) => {
                    const isCurrent = !task.completed && selectedTasks.filter((t) => !t.completed)[0]?.id === task.id;
                    return (
                      <div
                        key={task.id}
                        onClick={() => toggleTask(task)}
                        className={`flex items-center gap-4 p-3 rounded-lg border cursor-pointer transition-all ${
                          task.completed
                            ? "bg-slate-50 border-slate-100"
                            : isCurrent
                            ? "bg-[#1876f2]/5 border-[#1876f2]/20 ring-1 ring-[#1876f2]/20"
                            : "bg-slate-50 border-slate-100 opacity-60"
                        }`}
                      >
                        <div className={`p-2 rounded-full ${
                          task.completed ? "bg-green-100 text-green-600" : isCurrent ? "bg-[#1876f2]/20 text-[#1876f2]" : "bg-slate-200 text-slate-400"
                        }`}>
                          <MIcon name={task.completed ? "check" : isCurrent ? "sync" : "radio_button_unchecked"} className="text-lg" />
                        </div>
                        <div className="flex-grow">
                          <p className={`text-sm font-bold ${task.completed ? "text-slate-400 line-through" : "text-slate-900"}`}>
                            Dia {task.day_number}: {task.title}
                          </p>
                          <p className="text-xs text-slate-500">{task.description}</p>
                        </div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded whitespace-nowrap ${
                          task.completed ? "text-green-600 bg-green-50" : isCurrent ? "text-[#1876f2] animate-pulse" : "text-slate-400"
                        }`}>
                          {task.completed ? "Concluído" : isCurrent ? "Em andamento" : "Pendente"}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <button
                    onClick={() => { fetchTasks(selectedProfile.id); fetchProfiles(); toast.success("Progresso atualizado"); }}
                    className="flex items-center justify-center gap-2 bg-slate-100 text-slate-700 font-bold py-3 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    <MIcon name="refresh" className="text-lg" />
                    Atualizar Progresso
                  </button>
                  <button
                    onClick={() => updateTrustTier(selectedProfile.id)}
                    className="flex items-center justify-center gap-2 bg-slate-100 text-slate-700 font-bold py-3 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    <MIcon name="verified_user" className="text-lg" />
                    Checar Trust Tier
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* ── Footer ── */}
      <footer className="bg-white border-t border-slate-200 py-8 px-6 lg:px-20 mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <MIcon name="hub" className="text-[#1876f2]" />
            <span className="font-bold text-slate-900">FBFlix Operational</span>
          </div>
          <p className="text-sm text-slate-500">© 2024 FBFlix Dashboard. Todos os direitos reservados.</p>
          <div className="flex gap-6">
            <a className="text-slate-400 hover:text-[#1876f2] transition-colors text-sm font-medium" href="#">Suporte</a>
            <a className="text-slate-400 hover:text-[#1876f2] transition-colors text-sm font-medium" href="#">Termos</a>
            <a className="text-slate-400 hover:text-[#1876f2] transition-colors text-sm font-medium" href="#">Privacidade</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
