import { useNavigate } from "react-router-dom";
import type { SubscriptionStatus, ProxySubscription } from "@/pages/Subscriptions";

interface SubscriptionCardProps {
  subscription: ProxySubscription;
  status: SubscriptionStatus;
  daysRemaining: number;
  daysExpired: number;
  progressPercent: number;
  formattedStart: string;
  formattedEnd: string;
  onRenew: () => void;
  isRenewing: boolean;
  profileTag?: string | null;
}

function getStatusBadge(status: SubscriptionStatus) {
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
}

export default function SubscriptionCard({
  subscription: sub,
  status,
  daysRemaining,
  daysExpired,
  progressPercent,
  formattedStart,
  formattedEnd,
  onRenew,
  isRenewing,
  profileTag,
}: SubscriptionCardProps) {
  const navigate = useNavigate();
  return (
    <div
      className={`glass-card rounded-2xl p-6 flex flex-col gap-6 relative overflow-hidden group ${
        status === "expired" ? "opacity-75 hover:opacity-100 transition-opacity" : ""
      }`}
    >
      {status === "expiring" && (
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-danger to-orange-500"></div>
      )}

      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center border border-border ${
              status === "expired" ? "text-text-secondary" : "text-foreground"
            }`}
          >
            <span className="material-symbols-outlined">dns</span>
          </div>
          <div>
            <h3 className="text-foreground font-bold text-lg leading-tight">{sub.name || sub.code}</h3>
            <span className="text-text-secondary text-xs">{sub.product_name || sub.code}</span>
          </div>
        </div>
        {getStatusBadge(status)}
      </div>

      {/* Profile Tag */}
      {profileTag && (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-foreground/10 backdrop-blur-sm border border-foreground/10 text-foreground text-[11px] font-semibold w-fit">
          <span className="material-symbols-outlined text-sm text-primary">verified</span>
          {profileTag}
        </span>
      )}

      {/* Status Info */}
      <div className="flex flex-col gap-1">
        {status === "expiring" && (
          <div className="flex items-center gap-2 text-danger">
            <span className="material-symbols-outlined text-sm">timer</span>
            <span className="text-sm font-bold">Vence em {daysRemaining} dia{daysRemaining !== 1 ? "s" : ""}</span>
          </div>
        )}
        {status === "active" && (
          <div className="flex items-center gap-2 text-green-500">
            <span className="material-symbols-outlined text-sm">check_circle</span>
            <span className="text-sm font-bold">{daysRemaining} dia{daysRemaining !== 1 ? "s" : ""} restante{daysRemaining !== 1 ? "s" : ""}</span>
          </div>
        )}
        {status === "expired" && (
          <div className="flex items-center gap-2 text-text-secondary">
            <span className="material-symbols-outlined text-sm">event_busy</span>
            <span className="text-sm font-bold">Expirou há {daysExpired} dia{daysExpired !== 1 ? "s" : ""}</span>
          </div>
        )}

        <div className="w-full h-1.5 rounded-full mt-1 overflow-hidden bg-muted">
          {progressPercent > 0 && (
            <div
              className={`h-full rounded-full ${status === "expiring" ? "bg-danger" : "bg-green-500"}`}
              style={{ width: `${progressPercent}%` }}
            ></div>
          )}
        </div>
      </div>

      {/* Proxy info */}
      {sub.proxy && status !== "expired" && (
        <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/50 border border-border">
          <div className="flex justify-between text-xs">
            <span className="text-text-secondary">IP</span>
            <span className="text-foreground font-mono font-medium">{sub.proxy.ip}:{sub.proxy.port}</span>
          </div>
          {sub.proxy.username && (
            <div className="flex justify-between text-xs">
              <span className="text-text-secondary">User</span>
              <span className="text-foreground font-mono font-medium">{sub.proxy.username}</span>
            </div>
          )}
        </div>
      )}

      {/* Dates */}
      <div className="flex flex-col gap-3 pt-2 border-t border-glass-border">
        <div className="flex justify-between text-xs">
          <span className="text-text-secondary">Início</span>
          <span className={status === "expired" ? "text-text-secondary/70" : "text-foreground font-medium"}>
            {formattedStart}
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-text-secondary">Vencimento</span>
          <span className={status === "expired" ? "text-text-secondary/70" : "text-foreground font-medium"}>
            {formattedEnd}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-auto">
        {status === "expiring" && (
          <button
            onClick={onRenew}
            disabled={isRenewing}
            className="flex-1 bg-danger hover:bg-red-600 text-danger-foreground h-10 rounded-lg text-sm font-bold transition-all shadow-[0_0_15px_rgba(255,59,48,0.3)] hover:shadow-[0_0_20px_rgba(255,59,48,0.5)] disabled:opacity-50"
          >
            {isRenewing ? "Renovando..." : "Renovar Agora"}
          </button>
        )}
        {status === "active" && (
          <button
            onClick={() => navigate(`/subscriptions/${sub.code}`)}
            className="flex-1 border border-border hover:border-foreground text-foreground bg-transparent hover:bg-muted h-10 rounded-lg text-sm font-bold transition-all"
          >
            Gerenciar
          </button>
        )}
        {status === "expired" && (
          <button
            onClick={onRenew}
            disabled={isRenewing}
            className="flex-1 border border-glass-border hover:border-primary hover:text-primary text-text-secondary bg-transparent h-10 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-lg">replay</span>
            {isRenewing ? "Renovando..." : "Reativar"}
          </button>
        )}
      </div>
    </div>
  );
}
