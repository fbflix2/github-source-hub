import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  getEffectiveProfileQualityWithSource,
  getProfileWarmingDays,
  type ProfileQualityData,
  type ProfileQualityWithSource,
} from "@/lib/warming-ready";

function MIcon({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
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

interface AuditTask {
  title: string;
  description: string | null;
  completed: boolean;
}

interface Props {
  profiles: WarmingProfile[];
  qualityMap: Record<string, ProfileQualityData>;
  manualQualityMap: Record<string, Partial<ProfileQualityData>>;
  tasks: Record<string, AuditTask[]>;
  creatorNames: Record<string, string>;
  onRefresh: () => void;
}

const FRIEND_RANGE_MIN: Record<string, number> = {
  "0-5": 0,
  "5-19": 5,
  "20-50": 20,
  "50-100+": 50,
};

const FRIEND_OPTIONS = [
  { value: 0, label: "Qualquer" },
  { value: 5, label: "5+ amigos" },
  { value: 20, label: "20+ amigos" },
  { value: 50, label: "50+ amigos" },
];

const DAYS_OPTIONS = [
  { value: 0, label: "Qualquer" },
  { value: 7, label: "7+ dias" },
  { value: 15, label: "15+ dias" },
  { value: 20, label: "20+ dias" },
  { value: 30, label: "30+ dias" },
];

type StatusFilter = "all" | "pending" | "approved" | "restricted" | "sent";

const STATUS_OPTIONS: { value: StatusFilter; label: string; icon: string }[] = [
  { value: "all", label: "Todos", icon: "list" },
  { value: "pending", label: "Pendentes", icon: "pending" },
  { value: "approved", label: "Aprovados", icon: "check_circle" },
  { value: "restricted", label: "Restritos", icon: "block" },
  { value: "sent", label: "Enviados", icon: "local_shipping" },
];

function SourceBadge({ active, label }: { active: boolean; label: string; source?: "manual" | "task" | "both" | null }) {
  if (!active) return null;

  const colorMap = {
    "2FA": "bg-emerald-500/20 text-emerald-400",
    BM: "bg-blue-500/20 text-blue-400",
    Page: "bg-purple-500/20 text-purple-400",
  };
  const color = colorMap[label as keyof typeof colorMap] || "bg-emerald-500/20 text-emerald-400";

  return <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${color}`}>{label}</span>;
}

export default function WarmingAuditDashboard({ profiles, qualityMap, manualQualityMap, tasks, creatorNames, onRefresh }: Props) {
  const [filter2FA, setFilter2FA] = useState(false);
  const [filterBM, setFilterBM] = useState(false);
  const [filterPage, setFilterPage] = useState(false);
  const [minFriends, setMinFriends] = useState(0);
  const [minDays, setMinDays] = useState(0);
  const [filterOperator, setFilterOperator] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [approving, setApproving] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [approvedCount, setApprovedCount] = useState(0);

  useEffect(() => {
    const fetchApprovedCount = async () => {
      const { count } = await supabase
        .from("operator_earnings")
        .select("*", { count: "exact", head: true })
        .eq("status", "confirmed");
      setApprovedCount(count || 0);
    };
    fetchApprovedCount();
  }, [profiles]);

  const operators = useMemo(() => {
    const map = new Map<string, string>();
    profiles.forEach((p) => {
      if (p.created_by) map.set(p.created_by, creatorNames[p.created_by] || "Sem nome");
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [profiles, creatorNames]);

  // Unified quality map derived from manual data + task evidence
  const effectiveQualityMap = useMemo(() => {
    const map: Record<string, ProfileQualityWithSource> = {};
    profiles.forEach((profile) => {
      map[profile.id] = getEffectiveProfileQualityWithSource(qualityMap[profile.id], tasks[profile.id] || []);
    });
    return map;
  }, [profiles, qualityMap, tasks]);

  // Status-based counts (always from full profile list)
  const statusCounts = useMemo(() => {
    const counts = { total: profiles.length, pending: 0, approved: 0, restricted: 0, sent: 0 };
    profiles.forEach((p) => {
      if (p.status === "completed") counts.approved++;
      else if (p.status === "restricted" || p.status === "blocked") counts.restricted++;
      else if (p.status === "sent_to_store") counts.sent++;
      else counts.pending++; // active, checkpoint
    });
    return counts;
  }, [profiles]);

  // Quality counts from ALL profiles using manual data only
  const qualityCounts = useMemo(() => {
    let with2FA = 0;
    let withBM = 0;
    profiles.forEach((p) => {
      const q = manualQualityMap[p.id];
      if (q?.has2FA) with2FA++;
      if (q?.hasBM) withBM++;
    });
    return { with2FA, withBM };
  }, [profiles, manualQualityMap]);

  const auditProfiles = useMemo(() => {
    const searchTrimmed = search.trim().toLowerCase();

    return profiles.filter((p) => {
      // Search overrides all filters
      if (searchTrimmed) {
        return p.profile_code.toLowerCase().includes(searchTrimmed);
      }

      // Status filter
      if (statusFilter !== "all") {
        if (statusFilter === "pending" && p.status !== "checkpoint" && p.status !== "active") return false;
        if (statusFilter === "approved" && p.status !== "completed") return false;
        if (statusFilter === "restricted" && p.status !== "restricted" && p.status !== "blocked") return false;
        if (statusFilter === "sent" && p.status !== "sent_to_store") return false;
      }

      const quality = effectiveQualityMap[p.id];
      const manualQuality = manualQualityMap[p.id] || {};
      const days = getProfileWarmingDays(p);

      if (minDays > 0 && days < minDays) return false;
      if (filter2FA && !manualQuality.has2FA) return false;
      if (filterBM && !manualQuality.hasBM) return false;
      if (filterPage && !manualQuality.hasPage) return false;
      if (minFriends > 0) {
        const friendMin = FRIEND_RANGE_MIN[manualQuality.friendRange || "0-5"] || 0;
        if (friendMin < minFriends) return false;
      }
      if (filterOperator !== "all" && p.created_by !== filterOperator) return false;

      return true;
    });
  }, [profiles, effectiveQualityMap, manualQualityMap, filter2FA, filterBM, filterPage, minFriends, minDays, filterOperator, search, statusFilter]);

  const approveProfile = async (profile: WarmingProfile) => {
    setApproving(profile.id);
    try {
      await supabase
        .from("warming_profiles" as any)
        .update({ status: "completed" })
        .eq("id", profile.id);

      if (profile.created_by) {
        const { data: existing } = await supabase
          .from("operator_earnings")
          .select("id")
          .eq("profile_id", profile.id)
          .maybeSingle();

        const now = new Date().toISOString();

        if (existing) {
          await supabase
            .from("operator_earnings")
            .update({
              status: "confirmed",
              confirmed_at: now,
            })
            .eq("id", existing.id);
        } else {
          const { data: rateSetting } = await supabase
            .from("site_settings")
            .select("value")
            .eq("key", "warming_commission_rate")
            .maybeSingle();
          const rate = rateSetting ? parseFloat(rateSetting.value) : 0.25;

          await supabase
            .from("operator_earnings")
            .insert({
              user_id: profile.created_by,
              profile_id: profile.id,
              profile_code: profile.profile_code,
              amount: rate,
              status: "confirmed",
              confirmed_at: now,
            });
        }
      }

      toast.success(`Perfil ${profile.profile_code} aprovado! Saldo liberado em 72h.`);
      onRefresh();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao aprovar perfil");
    } finally {
      setApproving(null);
    }
  };

  return (
    <main className="flex-1 px-6 md:px-12 lg:px-40 py-10 max-w-[1200px] mx-auto w-full space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <MIcon name="fact_check" className="text-[#1876f2] text-2xl" />
        <div>
          <h2 className="text-xl font-bold">Auditoria de Perfis</h2>
          <p className="text-sm text-muted-foreground">Avalie e aprove perfis prontos para uso</p>
        </div>
      </div>

      {/* KPI Cards - always show totals from full dataset */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 p-4">
          <p className="text-[11px] text-muted-foreground uppercase tracking-widest mb-1">TOTAL CADASTRADOS</p>
          <p className="text-2xl font-black">{statusCounts.total}</p>
        </div>
        <div className="bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 p-4">
          <p className="text-[11px] text-muted-foreground uppercase tracking-widest mb-1">Com 2FA</p>
          <p className="text-2xl font-black text-emerald-500">{qualityCounts.with2FA}</p>
        </div>
        <div className="bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 p-4">
          <p className="text-[11px] text-muted-foreground uppercase tracking-widest mb-1">Com BM</p>
          <p className="text-2xl font-black text-blue-500">{qualityCounts.withBM}</p>
        </div>
        <div className="bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 p-4">
          <p className="text-[11px] text-muted-foreground uppercase tracking-widest mb-1">Aprovados Total</p>
          <p className="text-2xl font-black text-amber-500">{approvedCount}</p>
        </div>
        <div className="bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 p-4">
          <p className="text-[11px] text-muted-foreground uppercase tracking-widest mb-1">Resultado Filtro</p>
          <p className="text-2xl font-black text-[#1876f2]">{auditProfiles.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <MIcon name="filter_list" className="text-slate-400" />
          <h3 className="text-sm font-bold">Filtros Combinados</h3>
        </div>

        {/* Status filter tabs */}
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1 ${
                statusFilter === opt.value
                  ? "bg-[#1876f2]/20 border-[#1876f2]/40 text-[#1876f2]"
                  : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
              }`}
            >
              <MIcon name={opt.icon} className="text-sm" />
              {opt.label}
              <span className="ml-1 text-[10px] opacity-70">
                ({opt.value === "all" ? statusCounts.total : statusCounts[opt.value]})
              </span>
            </button>
          ))}
        </div>

        {/* Quality filters */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setFilter2FA(!filter2FA)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1 ${
              filter2FA
                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
            }`}
          >
            <MIcon name="lock" className="text-sm" /> 2FA Ativo
          </button>

          <button
            onClick={() => setFilterBM(!filterBM)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1 ${
              filterBM
                ? "bg-blue-500/20 border-blue-500/40 text-blue-400"
                : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
            }`}
          >
            <MIcon name="business_center" className="text-sm" /> BM Criada
          </button>

          <button
            onClick={() => setFilterPage(!filterPage)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1 ${
              filterPage
                ? "bg-purple-500/20 border-purple-500/40 text-purple-400"
                : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
            }`}
          >
            <MIcon name="web" className="text-sm" /> Página Criada
          </button>

          <select
            value={minFriends}
            onChange={(e) => setMinFriends(Number(e.target.value))}
            className="bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs font-medium"
          >
            {FRIEND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <select
            value={minDays}
            onChange={(e) => setMinDays(Number(e.target.value))}
            className="bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs font-medium"
          >
            {DAYS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <select
            value={filterOperator}
            onChange={(e) => setFilterOperator(e.target.value)}
            className="bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs font-medium"
          >
            <option value="all">Todos Operadores</option>
            {operators.map((op) => (
              <option key={op.id} value={op.id}>{op.name}</option>
            ))}
          </select>
        </div>

        <div className="relative max-w-xs">
          <MIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código (ignora filtros)..."
            className="w-full bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Profile list */}
      <div className="space-y-2">
        {auditProfiles.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <MIcon name="search_off" className="text-4xl mb-2" />
            <p className="text-sm">Nenhum perfil encontrado com os filtros atuais</p>
          </div>
        ) : (
          auditProfiles.map((profile) => {
            const quality = effectiveQualityMap[profile.id];
            const days = getProfileWarmingDays(profile);
            const friendMin = FRIEND_RANGE_MIN[quality?.friendRange || "0-5"] || 0;
            const isApproved = profile.status === "completed";

            return (
              <div
                key={profile.id}
                className="bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 p-4 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-[#1876f2]/10 flex items-center justify-center shrink-0">
                    <MIcon name="person" className="text-[#1876f2]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{profile.profile_code}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {creatorNames[profile.created_by || ""] || "—"} · {days} dias · {profile.track_type.replace("_", " ")}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <SourceBadge active={quality?.has2FA} label="2FA" source={quality?.has2FA_source} />
                  <SourceBadge active={quality?.hasBM} label="BM" source={quality?.hasBM_source} />
                  <SourceBadge active={quality?.hasPage} label="Page" source={quality?.hasPage_source} />
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/5 text-muted-foreground">
                    {friendMin}+ amigos
                  </span>
                </div>

                {isApproved ? (
                  <span className="flex items-center gap-1 text-emerald-400 text-xs font-bold shrink-0">
                    <MIcon name="check_circle" className="text-base" /> Aprovado
                  </span>
                ) : (
                  <button
                    onClick={() => approveProfile(profile)}
                    disabled={approving === profile.id}
                    className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0"
                  >
                    {approving === profile.id ? (
                      <span className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                      <MIcon name="verified" className="text-base" />
                    )}
                    Aprovar
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 flex gap-3 text-sm">
        <MIcon name="info" className="text-yellow-400 shrink-0 mt-0.5" />
        <div className="text-muted-foreground text-xs space-y-1">
          <p>Ao aprovar um perfil, o saldo correspondente é <strong className="text-foreground">confirmado</strong> no painel financeiro do operador.</p>
          <p>O saldo fica <strong className="text-yellow-400">disponível para saque após 72 horas</strong> da aprovação.</p>
        </div>
      </div>
    </main>
  );
}
