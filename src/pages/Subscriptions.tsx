import { useState } from "react";

type SubscriptionStatus = "active" | "expiring" | "cancelled" | "expired";

interface Subscription {
  id: number;
  name: string;
  type: string;
  icon: string;
  status: SubscriptionStatus;
  daysRemaining?: number;
  daysExpired?: number;
  startDate: string;
  endDate: string;
  progressPercent: number;
}

const subscriptions: Subscription[] = [
  {
    id: 1,
    name: "Proxy DC USA",
    type: "Datacenter Premium",
    icon: "dns",
    status: "expiring",
    daysRemaining: 2,
    startDate: "01 Out 2023",
    endDate: "01 Nov 2023",
    progressPercent: 95,
  },
  {
    id: 2,
    name: "Residencial BR",
    type: "IP Residencial SP",
    icon: "router",
    status: "active",
    daysRemaining: 25,
    startDate: "15 Out 2023",
    endDate: "15 Nov 2023",
    progressPercent: 30,
  },
  {
    id: 3,
    name: "Mobile 4G RJ",
    type: "Rotação Automática",
    icon: "wifi_tethering",
    status: "active",
    daysRemaining: 12,
    startDate: "10 Out 2023",
    endDate: "10 Nov 2023",
    progressPercent: 60,
  },
  {
    id: 4,
    name: "Proxy UK Static",
    type: "Datacenter",
    icon: "public",
    status: "expired",
    daysExpired: 5,
    startDate: "01 Set 2023",
    endDate: "01 Out 2023",
    progressPercent: 0,
  },
];

const filters = [
  { key: "all", label: "Todas", count: 8 },
  { key: "active", label: "Ativas", count: 2 },
  { key: "expiring", label: "Vencendo", count: 1, isWarning: true },
  { key: "cancelled", label: "Canceladas", count: 0 },
  { key: "expired", label: "Expiradas", count: 5 },
];

export default function Subscriptions() {
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const filteredSubscriptions = subscriptions.filter((sub) => {
    if (activeFilter === "all") return true;
    return sub.status === activeFilter;
  });

  const getStatusBadge = (status: SubscriptionStatus) => {
    switch (status) {
      case "expiring":
        return (
          <span className="bg-danger/10 text-danger border border-danger/20 text-[10px] uppercase font-bold px-2 py-1 rounded-md tracking-wide">
            Crítico
          </span>
        );
      case "active":
        return (
          <span className="bg-green-500/10 text-green-500 border border-green-500/20 text-[10px] uppercase font-bold px-2 py-1 rounded-md tracking-wide">
            Ativo
          </span>
        );
      case "expired":
        return (
          <span className="bg-muted text-text-secondary border border-border text-[10px] uppercase font-bold px-2 py-1 rounded-md tracking-wide">
            Expirado
          </span>
        );
      case "cancelled":
        return (
          <span className="bg-muted text-text-secondary border border-border text-[10px] uppercase font-bold px-2 py-1 rounded-md tracking-wide">
            Cancelado
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight">Minhas Assinaturas</h1>
          <p className="text-text-secondary text-base">Gerencie seus planos de proxy e renovações automáticas.</p>
        </div>
        <button className="bg-primary hover:bg-[#00c968] text-background h-11 px-6 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-glow hover:shadow-glow-lg">
          <span className="material-symbols-outlined">add_shopping_cart</span>
          Nova Assinatura
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel rounded-xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500">
            <span className="material-symbols-outlined">verified</span>
          </div>
          <div>
            <p className="text-text-secondary text-xs uppercase font-semibold tracking-wider">Ativas</p>
            <p className="text-foreground text-2xl font-bold">2 Assinaturas</p>
          </div>
        </div>
        <div className="glass-panel rounded-xl p-5 flex items-center gap-4 border-danger/30 bg-danger/5">
          <div className="w-10 h-10 rounded-lg bg-danger/10 flex items-center justify-center text-danger">
            <span className="material-symbols-outlined">priority_high</span>
          </div>
          <div>
            <p className="text-danger/80 text-xs uppercase font-semibold tracking-wider">Atenção</p>
            <p className="text-foreground text-2xl font-bold">1 Vencendo</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-glass-border">
        <div className="flex gap-8 overflow-x-auto pb-px no-scrollbar">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`group flex items-center gap-2 pb-4 border-b-2 transition-colors ${
                activeFilter === f.key
                  ? "border-primary"
                  : f.isWarning
                  ? "border-transparent hover:border-danger/50"
                  : "border-transparent hover:border-glass-border"
              }`}
            >
              <span
                className={`text-sm font-medium transition-colors ${
                  activeFilter === f.key
                    ? "text-foreground font-bold"
                    : f.isWarning
                    ? "text-text-secondary group-hover:text-danger"
                    : "text-text-secondary group-hover:text-foreground"
                }`}
              >
                {f.label}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                  activeFilter === f.key
                    ? "bg-primary/20 text-primary"
                    : f.isWarning
                    ? "bg-danger/10 text-danger"
                    : "bg-muted text-text-secondary group-hover:text-foreground"
                }`}
              >
                {f.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Subscription Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredSubscriptions.map((sub) => (
          <div
            key={sub.id}
            className={`glass-card rounded-2xl p-6 flex flex-col gap-6 relative overflow-hidden group ${
              sub.status === "expired" ? "opacity-75 hover:opacity-100 transition-opacity" : ""
            }`}
          >
            {/* Critical indicator bar */}
            {sub.status === "expiring" && (
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-danger to-orange-500"></div>
            )}

            {/* Header */}
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center border border-border ${
                  sub.status === "expired" ? "text-text-secondary" : "text-foreground"
                }`}>
                  <span className="material-symbols-outlined">{sub.icon}</span>
                </div>
                <div>
                  <h3 className="text-foreground font-bold text-lg leading-tight">{sub.name}</h3>
                  <span className="text-text-secondary text-xs">{sub.type}</span>
                </div>
              </div>
              {getStatusBadge(sub.status)}
            </div>

            {/* Status Info */}
            <div className="flex flex-col gap-1">
              {sub.status === "expiring" && (
                <div className="flex items-center gap-2 text-danger">
                  <span className="material-symbols-outlined text-sm">timer</span>
                  <span className="text-sm font-bold">Vence em {sub.daysRemaining} dias</span>
                </div>
              )}
              {sub.status === "active" && (
                <div className="flex items-center gap-2 text-green-500">
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  <span className="text-sm font-bold">{sub.daysRemaining} dias restantes</span>
                </div>
              )}
              {sub.status === "expired" && (
                <div className="flex items-center gap-2 text-text-secondary">
                  <span className="material-symbols-outlined text-sm">event_busy</span>
                  <span className="text-sm font-bold">Expirou há {sub.daysExpired} dias</span>
                </div>
              )}
              
              {/* Progress Bar */}
              <div className={`w-full h-1.5 rounded-full mt-1 overflow-hidden ${
                sub.status === "expired" ? "bg-muted" : "bg-muted"
              }`}>
                {sub.progressPercent > 0 && (
                  <div
                    className={`h-full rounded-full ${
                      sub.status === "expiring" ? "bg-danger" : "bg-green-500"
                    }`}
                    style={{ width: `${sub.progressPercent}%` }}
                  ></div>
                )}
              </div>
            </div>

            {/* Dates */}
            <div className="flex flex-col gap-3 pt-2 border-t border-glass-border">
              <div className="flex justify-between text-xs">
                <span className="text-text-secondary">Início</span>
                <span className={sub.status === "expired" ? "text-text-secondary/70" : "text-foreground font-medium"}>
                  {sub.startDate}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-secondary">Vencimento</span>
                <span className={sub.status === "expired" ? "text-text-secondary/70" : "text-foreground font-medium"}>
                  {sub.endDate}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-auto">
              {sub.status === "expiring" && (
                <button className="flex-1 bg-danger hover:bg-red-600 text-danger-foreground h-10 rounded-lg text-sm font-bold transition-all shadow-[0_0_15px_rgba(255,59,48,0.3)] hover:shadow-[0_0_20px_rgba(255,59,48,0.5)]">
                  Renovar Agora
                </button>
              )}
              {sub.status === "active" && (
                <button className="flex-1 border border-border hover:border-foreground text-foreground bg-transparent hover:bg-muted h-10 rounded-lg text-sm font-bold transition-all">
                  Gerenciar
                </button>
              )}
              {sub.status === "expired" && (
                <button className="flex-1 border border-glass-border hover:border-primary hover:text-primary text-text-secondary bg-transparent h-10 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-lg">replay</span>
                  Reativar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredSubscriptions.length === 0 && (
        <div className="text-center py-12">
          <span className="material-symbols-outlined text-[48px] text-text-secondary mb-4">inbox</span>
          <p className="text-text-secondary">Nenhuma assinatura encontrada com este filtro.</p>
        </div>
      )}

      {/* CTA Banner */}
      <div className="w-full mt-8 rounded-2xl glass-card border border-primary/20 p-8 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        {/* Decorative background */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
        
        <div className="flex flex-col gap-3 z-10">
          <h2 className="text-2xl font-bold text-foreground">Precisa de mais performance?</h2>
          <p className="text-text-secondary max-w-xl">
            Nossos novos planos de Proxy Residencial Rotativo oferecem IPs limpos e alta velocidade para suas operações.
          </p>
        </div>
        <button className="z-10 whitespace-nowrap bg-primary hover:bg-[#00c968] text-background h-12 px-8 rounded-xl text-base font-bold transition-all shadow-lg hover:shadow-primary/20">
          Conhecer Novos Planos
        </button>
      </div>
    </div>
  );
}
