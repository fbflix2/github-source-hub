import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useNavigate } from "react-router-dom";
import WarmingOperatorDashboard from "@/components/admin/warming/WarmingOperatorDashboard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toast } from "sonner";

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

export default function AdminEsteiraAdmin() {
  const { role } = useAdminAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<WarmingProfile[]>([]);
  const [tasks, setTasks] = useState<Record<string, WarmingTask[]>>({});
  const [loading, setLoading] = useState(true);
  const [creatorNames, setCreatorNames] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<"gestao" | "relatorios" | "configuracoes">("gestao");
  const [reportFilter, setReportFilter] = useState("");
  const [configTrack, setConfigTrack] = useState<"7_days" | "15_days" | "30_days">("7_days");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetting, setResetting] = useState(false);

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
  const [trustTiers, setTrustTiers] = useState([
    { label: "Nível 1 (Confiança Baixa)", color: "bg-red-100 text-red-700", range: "0 - 30", criteria: "Contas novas, sem histórico." },
    { label: "Nível 2 (Confiança Média)", color: "bg-amber-100 text-amber-700", range: "31 - 75", criteria: "7+ dias, 2FA ativa." },
    { label: "Nível 3 (Confiança Alta)", color: "bg-green-100 text-green-700", range: "76 - 100", criteria: "Esteira completa, 30+ dias." },
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

    // Fallback polling every 10s to ensure data stays fresh
    const pollInterval = setInterval(() => {
      fetchProfiles();
    }, 10000);

    return () => {
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(tasksChannel);
      clearInterval(pollInterval);
    };
  }, []);

  // Redirect non-admins
  useEffect(() => {
    if (role && role !== "admin") {
      navigate("/admin/aquecimento");
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
      }
      const creatorIds = [...new Set((data || []).map(p => p.created_by).filter(Boolean))] as string[];
      if (creatorIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", creatorIds);
        if (profilesData) {
          const nameMap: Record<string, string> = {};
          profilesData.forEach(p => { nameMap[p.user_id] = p.full_name || "Sem nome"; });
          setCreatorNames(nameMap);
        }
      }
    }
    setLoading(false);
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

  const filteredReportProfiles = profiles.filter(p =>
    !reportFilter || p.profile_code.toLowerCase().includes(reportFilter.toLowerCase())
  );

  const tabs = [
    { key: "gestao" as const, label: "Gestão", icon: "supervisor_account" },
    { key: "relatorios" as const, label: "Relatórios", icon: "analytics" },
    { key: "configuracoes" as const, label: "Configurações", icon: "settings" },
  ];

  if (role !== "admin") return null;

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
                <MIcon name="play_circle" className="text-lg" />
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

      {/* Relatórios Tab */}
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
            <div className="p-6 border-b border-slate-200 dark:border-white/10 flex justify-between items-center">
              <h4 className="font-bold text-lg">Relatórios Recentes</h4>
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
                        <td className="px-6 py-4">Esteira {p.track_days} dias</td>
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

      {/* Configurações Tab */}
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
                  id="admin-new-track-action"
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
                    <th className="px-6 py-3 font-bold text-slate-500 uppercase tracking-wider text-[10px]">Faixa</th>
                    <th className="px-6 py-3 font-bold text-slate-500 uppercase tracking-wider text-[10px]">Critérios</th>
                    <th className="px-6 py-3 w-16"></th>
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

          {/* Danger Zone */}
          <section className="bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-red-100 flex items-center gap-3">
              <MIcon name="warning" className="text-red-500" />
              <h2 className="text-lg font-bold text-red-700">Zona de Perigo</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-red-50 border border-red-100 rounded-lg p-4">
                <h3 className="font-bold text-sm text-red-800 mb-1">Zerar todas as Esteiras e Perfis</h3>
                <p className="text-xs text-red-600 mb-4">
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
                    <p className="text-xs text-red-700 font-bold">Digite sua senha para confirmar:</p>
                    <input
                      type="password"
                      value={resetPassword}
                      onChange={e => setResetPassword(e.target.value)}
                      className="w-full max-w-xs bg-white border border-red-200 rounded-lg px-3 py-2 text-sm"
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
        </main>
      )}
    </div>
  );
}
