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
  const [activeTab, setActiveTab] = useState<"dashboard" | "esteiras" | "relatorios" | "configuracoes">("dashboard");
  const [reportFilter, setReportFilter] = useState("");
  const [configTrack, setConfigTrack] = useState<"7_days" | "15_days" | "30_days">("7_days");
  const [configTasks, setConfigTasks] = useState<Record<string, { title: string; description: string }[]>>({
    "7_days": TRACKS["7_days"].tasks.map(t => ({ title: t.title, description: t.description })),
    "15_days": TRACKS["15_days"].tasks.map(t => ({ title: t.title, description: t.description })),
    "30_days": TRACKS["30_days"].tasks.map(t => ({ title: t.title, description: t.description })),
  });

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
      <section className="relative overflow-hidden text-white pt-12 pb-20 px-6 md:px-12 lg:px-40" style={{ background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 40%, #3a3a3a 70%, #1a1a1a 100%)" }}>
        <div className="absolute top-0 right-0 w-1/3 h-full opacity-10 pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <path d="M44.7,-76.4C58.1,-69.2,69.5,-57.4,77.4,-43.8C85.3,-30.2,89.7,-15.1,89.1,-0.3C88.5,14.4,82.9,28.8,74.1,41.2C65.3,53.6,53.2,64.1,39.6,71.7C26,79.2,13,83.9,-0.8,85.2C-14.5,86.5,-29,84.5,-42.1,77.5C-55.2,70.5,-66.8,58.6,-74.6,44.9C-82.4,31.2,-86.3,15.6,-86.1,0.1C-85.9,-15.4,-81.5,-30.8,-73.2,-44C-64.9,-57.2,-52.7,-68.1,-38.8,-75C-24.9,-81.8,-9.2,-84.6,3.4,-90.4C16,-96.2,27.1,-83.5,44.7,-76.4Z" fill="currentColor" transform="translate(100 100)" />
          </svg>
        </div>
        <div className="max-w-[1200px] mx-auto relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
              <MIcon name="fluid" className="text-white text-3xl" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">FBFlix</h2>
          </div>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2">
              <h1 className="text-4xl md:text-5xl font-black tracking-tight">Dashboard Operacional</h1>
              <p className="text-white/80 text-lg max-w-2xl">
                Acompanhe em tempo real o desempenho das esteiras de aquecimento e a distribuição dos perfis por maturidade.
              </p>
            </div>
            <div className="flex gap-4">
              <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20 min-w-[140px]">
                <p className="text-xs font-medium text-white/70 uppercase tracking-wider">Status Geral</p>
                <p className="text-2xl font-bold">Operacional</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20 min-w-[140px]">
                <p className="text-xs font-medium text-white/70 uppercase tracking-wider">Uptime</p>
                <p className="text-2xl font-bold">99.9%</p>
              </div>
            </div>
          </div>
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
                  ? "border-slate-800 text-slate-900"
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
                <MIcon name="group" className="text-slate-700" />
              </div>
              <p className="text-3xl font-black text-slate-900">{totalProfiles.toLocaleString()}</p>
              <div className="flex items-center gap-1 text-emerald-500 font-bold text-sm">
                <MIcon name="trending_up" className="text-sm" />
                <span>+12% este mês</span>
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
              <div className="flex items-center gap-1 text-rose-500 font-bold text-sm">
                <MIcon name="trending_down" className="text-sm" />
                <span>-2% que ontem</span>
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
                    <div className="h-full bg-slate-400 rounded-full" style={{ width: `${totalProfiles ? Math.round((newProfiles / totalProfiles) * 100) : 35}%` }} />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-bold">
                    <span>Intermediários (15 dias)</span>
                    <span>{midProfiles} perfis</span>
                  </div>
                  <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-slate-600 rounded-full" style={{ width: `${totalProfiles ? Math.round((midProfiles / totalProfiles) * 100) : 55}%` }} />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-bold">
                    <span>Maturidade Máxima (30+ dias)</span>
                    <span>{matureProfiles} perfis</span>
                  </div>
                  <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-slate-800 rounded-full" style={{ width: `${totalProfiles ? Math.round((matureProfiles / totalProfiles) * 100) : 85}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Trust Tier Distribution */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h3 className="text-lg font-bold mb-6">Trust Tier Distribution</h3>
              <div className="flex flex-col items-center justify-center py-4">
                <div className="relative w-48 h-48">
                  <svg className="w-full h-full" viewBox="0 0 36 36">
                    <circle className="stroke-slate-100" cx="18" cy="18" fill="none" r="16" strokeWidth="4" />
                    <circle className="stroke-slate-600" cx="18" cy="18" fill="none" r="16" strokeDasharray={`${t2Pct}, 100`} strokeDashoffset={`-${t3Pct}`} strokeLinecap="round" strokeWidth="4" />
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
                      <span className="text-sm font-medium">High Trust (T3)</span>
                    </div>
                    <span className="text-sm font-bold">{t3Pct}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-slate-600" />
                      <span className="text-sm font-medium">Medium Trust (T2)</span>
                    </div>
                    <span className="text-sm font-bold">{t2Pct}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-slate-300" />
                      <span className="text-sm font-medium">Low Trust (T1)</span>
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
              <button className="text-slate-700 text-sm font-bold hover:underline">Ver tudo</button>
            </div>
            <div className="divide-y divide-slate-100">
              {profiles.slice(0, 4).map((p, i) => {
                const icons = ["trending_up", "person_add", "settings_backup_restore", "error"];
                const colors = ["emerald", "blue", "amber", "rose"];
                const color = colors[i % 4];
                const bgMap: Record<string, string> = { emerald: "bg-emerald-100 text-emerald-600", blue: "bg-slate-200 text-slate-700", amber: "bg-amber-100 text-amber-600", rose: "bg-rose-100 text-rose-600" };
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
                        <p className="text-xs text-slate-500">Esteira {TRACKS[p.track_type]?.label} • {new Date(p.created_at).toLocaleDateString("pt-BR")}</p>
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
                <MIcon name="add_circle" className="text-slate-700 text-xl" />
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
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Escolha a Esteira</label>
                  <div className="relative">
                    <MIcon name="layers" className="absolute left-3 top-2.5 text-slate-400 text-lg" />
                    <select
                      className="w-full pl-10 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-400 focus:border-slate-400 text-slate-900 appearance-none transition-all"
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
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  <MIcon name="assignment_ind" className="text-lg" />
                  {creating ? "Atribuindo..." : "Atribuir Perfil"}
                </button>
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
                          className={`text-base ${p.status === "completed" ? "text-green-500" : p.status === "restricted" ? "text-red-500" : "text-slate-700"}`}
                        />
                        <div className="flex-grow min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{p.profile_code}</p>
                          <p className="text-[11px] text-slate-500">{TRACKS[p.track_type]?.label} • {prog}%</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          p.status === "active" ? "bg-slate-200 text-slate-700" :
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
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
                <MIcon name="hourglass_empty" className="text-slate-300 text-3xl" />
                <p className="text-slate-500 text-xs mt-2">Carregando...</p>
              </div>
            ) : !selectedProfile ? (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
                <MIcon name="thermostat" className="text-slate-300 text-3xl" />
                <p className="text-slate-500 text-xs mt-2">Nenhum perfil em aquecimento. Atribua um perfil para começar.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100 flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <MIcon name="check_circle" className="text-green-500 text-base" />
                      <h2 className="text-base font-bold text-slate-900">
                        {selectedProfile.profile_code}
                        {selectedProfile.profile_name && ` (${selectedProfile.profile_name})`}
                      </h2>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">
                      Esteira: {selectedTrackDef?.label || selectedProfile.track_type}
                      {selectedProfile.trust_tier && <span className="ml-2 text-purple-600 font-bold">• {selectedProfile.trust_tier}</span>}
                    </p>
                  </div>
                  <span className="bg-slate-200 text-slate-700 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                    {selectedProfile.status === "active" ? "Ativo" : selectedProfile.status === "completed" ? "Concluído" : selectedProfile.status}
                  </span>
                </div>

                <div className="p-5 space-y-5">
                  <div>
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                        <MIcon name="thermostat" className="text-orange-500 text-base" />
                        Status de Aquecimento
                      </span>
                      <span className="text-lg font-black text-slate-800">{selectedProgress}%</span>
                    </div>
                    <div className="relative h-4 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200 shadow-inner">
                      <div className="absolute top-0 left-0 h-full bg-green-500" style={{ width: `${selectedProgress}%`, boxShadow: "0 0 8px rgba(34,197,94,0.3)" }} />
                      <div className="absolute top-0 h-full bg-yellow-400 opacity-30" style={{ left: "45%", width: "35%" }} />
                      <div className="absolute top-0 h-full bg-red-500 opacity-20" style={{ left: "80%", width: "20%" }} />
                    </div>
                    <div className="flex justify-between mt-1 px-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Início</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Ideal</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Pronto</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider">Cronograma de Atividades</h3>
                    <div className="max-h-[280px] overflow-y-auto space-y-2 pr-1">
                      {selectedTasks.map((task) => {
                        const isCurrent = !task.completed && selectedTasks.filter((t) => !t.completed)[0]?.id === task.id;
                        return (
                          <div
                            key={task.id}
                            onClick={() => toggleTask(task)}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${
                              task.completed
                                ? "bg-slate-50 border-slate-100"
                                : isCurrent
                                ? "bg-slate-100 border-slate-300 ring-1 ring-slate-300"
                                : "bg-slate-50 border-slate-100 opacity-60"
                            }`}
                          >
                            <div className={`p-1.5 rounded-full ${
                              task.completed ? "bg-green-100 text-green-600" : isCurrent ? "bg-slate-200 text-slate-700" : "bg-slate-200 text-slate-400"
                            }`}>
                              <MIcon name={task.completed ? "check" : isCurrent ? "sync" : "radio_button_unchecked"} className="text-base" />
                            </div>
                            <div className="flex-grow min-w-0">
                              <p className={`text-xs font-bold ${task.completed ? "text-slate-400 line-through" : "text-slate-900"}`}>
                                Dia {task.day_number}: {task.title}
                              </p>
                              <p className="text-[11px] text-slate-500 truncate">{task.description}</p>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap ${
                              task.completed ? "text-green-600 bg-green-50" : isCurrent ? "text-slate-700 animate-pulse" : "text-slate-400"
                            }`}>
                              {task.completed ? "Concluído" : isCurrent ? "Em andamento" : "Pendente"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      onClick={() => { fetchTasks(selectedProfile.id); fetchProfiles(); toast.success("Progresso atualizado"); }}
                      className="flex items-center justify-center gap-1.5 bg-slate-100 text-slate-700 font-bold py-2.5 rounded-lg hover:bg-slate-200 transition-colors text-xs"
                    >
                      <MIcon name="refresh" className="text-base" />
                      Atualizar Progresso
                    </button>
                    <button
                      onClick={() => updateTrustTier(selectedProfile.id)}
                      className="flex items-center justify-center gap-1.5 bg-slate-100 text-slate-700 font-bold py-2.5 rounded-lg hover:bg-slate-200 transition-colors text-xs"
                    >
                      <MIcon name="verified_user" className="text-base" />
                      Checar Trust Tier
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
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
                <span className="text-emerald-500 text-sm font-bold flex items-center gap-1">
                  <MIcon name="trending_up" className="text-sm" /> +12%
                </span>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-slate-500 text-sm font-medium mb-1">Taxa de Sucesso (%)</p>
              <div className="flex items-end justify-between">
                <h3 className="text-3xl font-black text-slate-900">
                  {totalProfiles > 0 ? ((completedProfiles / totalProfiles) * 100).toFixed(1) : "0.0"}%
                </h3>
                <span className="text-emerald-500 text-sm font-bold flex items-center gap-1">
                  <MIcon name="trending_up" className="text-sm" /> +2.5%
                </span>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-slate-500 text-sm font-medium mb-1">Tempo Médio Aquecimento</p>
              <div className="flex items-end justify-between">
                <h3 className="text-3xl font-black text-slate-900">
                  {totalProfiles > 0 ? Math.round(profiles.reduce((acc, p) => acc + p.current_day, 0) / totalProfiles) : 0} dias
                </h3>
                <span className="text-orange-500 text-sm font-bold flex items-center gap-1">
                  <MIcon name="trending_down" className="text-sm" /> -1 dia
                </span>
              </div>
            </div>
          </div>

          {/* Performance Chart */}
          <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h4 className="font-bold text-lg">Desempenho de Aquecimento (30 dias)</h4>
              <div className="flex gap-4">
                <span className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  <span className="w-2 h-2 rounded-full bg-slate-700" /> Sucesso
                </span>
                <span className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  <span className="w-2 h-2 rounded-full bg-slate-200" /> Falhas
                </span>
              </div>
            </div>
            <div className="h-64 w-full bg-slate-50 rounded-lg flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 flex items-end px-4 gap-2">
                {[24, 40, 50, 33, 60, 66, 75, 100, 80, 86, 50, 75].map((h, i) => (
                  <div key={i} className="flex-1 bg-slate-700 rounded-t-sm" style={{ height: `${h}%`, opacity: 0.2 + (h / 100) * 0.8 }} />
                ))}
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
                    <th className="px-6 py-4">Status Final</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredReportProfiles.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900">#{p.profile_code}</td>
                      <td className="px-6 py-4">Esteira {p.track_days} dias</td>
                      <td className="px-6 py-4">{new Date(p.start_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          p.status === "completed" ? "bg-emerald-100 text-emerald-800" :
                          p.status === "restricted" ? "bg-rose-100 text-rose-800" :
                          "bg-slate-200 text-slate-700"
                        }`}>
                          {p.status === "completed" ? "Sucesso" : p.status === "restricted" ? "Falha" : "Em andamento"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => { setSelectedProfileId(p.id); if (!tasks[p.id]) fetchTasks(p.id); setActiveTab("esteiras"); }}
                          className="text-slate-700 font-bold text-sm hover:underline"
                        >
                          Ver Detalhes
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredReportProfiles.length === 0 && (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">Nenhum perfil encontrado</td></tr>
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
          {/* Perfil do Usuário */}
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
              <MIcon name="person" className="text-slate-700" />
              <h2 className="text-lg font-bold text-slate-900">Perfil do Usuário</h2>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nome Completo</label>
                  <input className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-slate-400/20 focus:border-slate-400 outline-none transition-all" type="text" defaultValue="" placeholder="Seu nome completo" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Email Principal</label>
                  <input className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-slate-400/20 focus:border-slate-400 outline-none transition-all" type="email" defaultValue="" placeholder="seu@email.com" />
                </div>
              </div>
              <div className="flex flex-col justify-end">
                <div className="bg-[#1876f2]/5 p-4 rounded-xl border border-[#1876f2]/20">
                  <p className="text-xs text-slate-600 mb-3">Sua senha foi alterada pela última vez há 45 dias.</p>
                  <button className="w-full bg-[#1876f2] text-white text-sm font-bold py-2 rounded-lg hover:bg-[#1876f2]/90 transition-all">
                    Alterar Senha de Acesso
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Configuração de Ações da Esteira */}
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
                      configTrack === tk ? "bg-white shadow-sm text-[#1876f2]" : "text-slate-500 hover:text-[#1876f2]"
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
                  <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-[#1876f2]/10 text-[#1876f2] font-bold text-xs rounded-full">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <input
                    className="flex-1 bg-transparent border-none p-0 text-sm text-slate-900 focus:ring-0 outline-none"
                    type="text"
                    value={task.title}
                    onChange={(e) => {
                      const updated = { ...configTasks };
                      updated[configTrack][i].title = e.target.value;
                      setConfigTasks({ ...updated });
                    }}
                  />
                  <MIcon name="drag_indicator" className="text-slate-400 text-sm cursor-move" />
                </div>
              ))}
              <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-[#1876f2]/10 text-[#1876f2] font-bold text-xs rounded-full">
                  {String(configTasks[configTrack].length + 1).padStart(2, "0")}
                </span>
                <input
                  className="flex-1 bg-transparent border-none p-0 text-sm text-slate-400 italic focus:ring-0 outline-none"
                  type="text"
                  placeholder={`Adicionar nova ação para o Dia ${configTasks[configTrack].length + 1}...`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
                      const updated = { ...configTasks };
                      updated[configTrack] = [...updated[configTrack], { title: (e.target as HTMLInputElement).value.trim(), description: "" }];
                      setConfigTasks({ ...updated });
                      (e.target as HTMLInputElement).value = "";
                    }
                  }}
                />
                <MIcon name="add_circle" className="text-[#1876f2] text-sm cursor-pointer" />
              </div>
            </div>
          </section>

          {/* Definição de Trust Tiers */}
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
              <MIcon name="verified_user" className="text-[#1876f2]" />
              <h2 className="text-lg font-bold text-slate-900">Definição de Trust Tiers</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-6 py-3 font-bold text-slate-500 uppercase tracking-wider text-[10px]">Tier</th>
                    <th className="px-6 py-3 font-bold text-slate-500 uppercase tracking-wider text-[10px]">Score Range</th>
                    <th className="px-6 py-3 font-bold text-slate-500 uppercase tracking-wider text-[10px]">Critérios de Validação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">Tier 1 (Low Trust)</span>
                    </td>
                    <td className="px-6 py-4">
                      <input className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs w-20 text-slate-900" type="text" defaultValue="0 - 30" />
                    </td>
                    <td className="px-6 py-4">
                      <input className="w-full bg-transparent border-none p-0 text-xs text-slate-700 focus:ring-0 outline-none" type="text" defaultValue="Contas novas, sem histórico de interação ou fotos reais." />
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">Tier 2 (Medium Trust)</span>
                    </td>
                    <td className="px-6 py-4">
                      <input className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs w-20 text-slate-900" type="text" defaultValue="31 - 75" />
                    </td>
                    <td className="px-6 py-4">
                      <input className="w-full bg-transparent border-none p-0 text-xs text-slate-700 focus:ring-0 outline-none" type="text" defaultValue="Histórico de 7+ dias, interações diárias, autenticação 2FA ativa." />
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">Tier 3 (High Trust)</span>
                    </td>
                    <td className="px-6 py-4">
                      <input className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs w-20 text-slate-900" type="text" defaultValue="76 - 100" />
                    </td>
                    <td className="px-6 py-4">
                      <input className="w-full bg-transparent border-none p-0 text-xs text-slate-700 focus:ring-0 outline-none" type="text" defaultValue="Esteira completa, verificação de identidade, 30+ dias de atividade." />
                    </td>
                  </tr>
                </tbody>
              </table>
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
                  <input className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-[#1876f2]/20 outline-none" placeholder="Ex: 827419230192" type="text" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Facebook App Secret</label>
                  <input className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-[#1876f2]/20 outline-none" type="password" defaultValue="••••••••••••••••" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Pixel Conversion API Token</label>
                <div className="relative">
                  <input className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm pr-12 text-slate-900 focus:ring-2 focus:ring-[#1876f2]/20 outline-none" type="text" defaultValue="EAAGm0PX4ZCpsBAK7ZA9Bf7ZB8qZC4ZB9ZA..." />
                  <button
                    onClick={() => { navigator.clipboard.writeText("EAAGm0PX4ZCpsBAK7ZA9Bf7ZB8qZC4ZB9ZA..."); toast.success("Token copiado"); }}
                    className="absolute right-2 top-1.5 p-1 text-slate-400 hover:text-[#1876f2] transition-colors"
                  >
                    <MIcon name="content_copy" className="text-base" />
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-2 italic">Mantenha seus tokens seguros. Nunca compartilhe estas chaves com terceiros.</p>
              </div>
            </div>
          </section>

          {/* Footer */}
          <div className="pt-4 pb-8 text-center">
            <p className="text-xs text-slate-400">© 2024 FBFlix Platform - Todos os direitos reservados</p>
            <p className="text-xs text-slate-400 mt-1">Versão do sistema 2.4.12-stable</p>
          </div>
        </main>
      )}

    </div>
  );
}
