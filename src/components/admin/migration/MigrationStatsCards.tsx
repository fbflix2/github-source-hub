import { Users, Clock, CheckCircle2, UserCheck, UserPlus, TrendingUp } from "lucide-react";

interface MigrationStats {
  total_users: number;
  pending: number;
  migrated: number;
  direct_registrations: number;
  complete_profiles: number;
}

interface Props {
  stats: MigrationStats;
}

function pct(value: number, total: number) {
  if (!total) return "0";
  return ((value / total) * 100).toFixed(1);
}

export default function MigrationStatsCards({ stats }: Props) {
  const partial = stats.total_users - stats.complete_profiles;
  const migratedPct = stats.total_users > 0 ? (stats.migrated / stats.total_users) * 100 : 0;
  const pendingPct = stats.total_users > 0 ? (stats.pending / stats.total_users) * 100 : 0;

  const cards = [
    {
      label: "Total na Base",
      value: stats.total_users,
      sub: "100%",
      icon: Users,
      color: "text-foreground",
      border: "border-border",
      bg: "bg-muted/30",
    },
    {
      label: "Pendentes",
      value: stats.pending,
      sub: `${pct(stats.pending, stats.total_users)}% do total`,
      icon: Clock,
      color: "text-amber-400",
      border: "border-amber-500/20",
      bg: "bg-amber-500/10",
    },
    {
      label: "Migrados",
      value: stats.migrated,
      sub: `${pct(stats.migrated, stats.total_users)}% do total`,
      icon: CheckCircle2,
      color: "text-emerald-400",
      border: "border-emerald-500/20",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Perfil Completo",
      value: stats.complete_profiles,
      sub: `${pct(stats.complete_profiles, stats.total_users)}% do total`,
      icon: UserCheck,
      color: "text-blue-400",
      border: "border-blue-500/20",
      bg: "bg-blue-500/10",
    },
    {
      label: "Perfil Parcial",
      value: partial,
      sub: `${pct(partial, stats.total_users)}% do total`,
      icon: TrendingUp,
      color: "text-orange-400",
      border: "border-orange-500/20",
      bg: "bg-orange-500/10",
    },
    {
      label: "Cadastros Diretos",
      value: stats.direct_registrations,
      sub: "sem migração",
      icon: UserPlus,
      color: "text-purple-400",
      border: "border-purple-500/20",
      bg: "bg-purple-500/10",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-2xl border ${c.border} ${c.bg} p-4 space-y-1`}>
            <div className="flex items-center gap-2">
              <c.icon className={`size-4 ${c.color}`} />
              <span className="text-xs text-muted-foreground font-medium">{c.label}</span>
            </div>
            <p className={`text-2xl font-black ${c.color}`}>{c.value.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-muted-foreground">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Migration progress: migrated vs pending */}
      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-foreground">Progresso da Migração</span>
          <span className="text-sm font-bold text-emerald-400">
            {stats.migrated} migrados / {stats.pending} pendentes
          </span>
        </div>
        <div className="h-3 w-full rounded-full bg-muted overflow-hidden flex">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
            style={{ width: `${migratedPct}%` }}
          />
          <div
            className="h-full bg-amber-500/40 transition-all duration-500"
            style={{ width: `${pendingPct}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-xs text-muted-foreground">
          <span className="text-emerald-400">Migrados {migratedPct.toFixed(1)}%</span>
          <span className="text-amber-400">Pendentes {pendingPct.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}
