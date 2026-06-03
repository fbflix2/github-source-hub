import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  XCircle,
  Activity,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import logoFbflix from "@/assets/logo-fbflix.webp";

type ServiceStatus = "operational" | "degraded" | "down" | "unknown";

interface HistoryPoint {
  service: string;
  status: ServiceStatus;
  latency_ms: number | null;
  checked_at: string;
}

interface ServiceSummary {
  key: string;
  label: string;
  current: ServiceStatus;
  latency_ms: number | null;
  last_check: string | null;
  uptime_24h: number;
  history: HistoryPoint[];
}

interface StatusPayload {
  overall: ServiceStatus;
  services: ServiceSummary[];
  upstream?: UpstreamPayload | null;
  generated_at: string;
}

type UpstreamIndicator = "none" | "minor" | "major" | "critical";
type UpstreamCompStatus =
  | "operational"
  | "degraded_performance"
  | "partial_outage"
  | "major_outage"
  | "under_maintenance";
type UpstreamIncidentStatus =
  | "investigating"
  | "identified"
  | "monitoring"
  | "resolved"
  | "postmortem";

interface UpstreamPayload {
  status: { indicator: UpstreamIndicator; description: string };
  components: { id: string; name: string; status: UpstreamCompStatus }[];
  incidents: {
    id: string;
    name: string;
    status: UpstreamIncidentStatus;
    impact: UpstreamIndicator;
    created_at: string;
    updated_at: string;
    resolved_at: string | null;
    updates: { status: UpstreamIncidentStatus; body: string; created_at: string }[];
  }[];
}

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const ENDPOINT = `https://${PROJECT_ID}.supabase.co/functions/v1/proxy-status`;

const STATUS_COPY: Record<ServiceStatus, { label: string; description: string; tone: string }> = {
  operational: {
    label: "Tudo operando normalmente",
    description: "Todos os sistemas estão funcionando como esperado.",
    tone: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/40 text-emerald-300",
  },
  degraded: {
    label: "Performance reduzida",
    description: "Estamos observando lentidão em parte dos serviços.",
    tone: "from-amber-500/20 to-amber-500/5 border-amber-500/40 text-amber-300",
  },
  down: {
    label: "Estamos enfrentando problemas",
    description: "Um ou mais serviços estão fora do ar. Já estamos acompanhando.",
    tone: "from-red-500/20 to-red-500/5 border-red-500/40 text-red-300",
  },
  unknown: {
    label: "Coletando informações",
    description: "Aguardando primeira verificação dos serviços.",
    tone: "from-muted/30 to-muted/5 border-border text-muted-foreground",
  },
};

function StatusIcon({ status, className }: { status: ServiceStatus; className?: string }) {
  if (status === "operational")
    return <CheckCircle2 className={cn("text-emerald-400", className)} />;
  if (status === "degraded")
    return <AlertTriangle className={cn("text-amber-400", className)} />;
  if (status === "down") return <XCircle className={cn("text-red-400", className)} />;
  return <Loader2 className={cn("text-muted-foreground animate-spin", className)} />;
}

function HistoryBar({ history }: { history: HistoryPoint[] }) {
  // Always render 90 slots; fill missing on the left with "unknown" placeholders.
  const slots: (HistoryPoint | null)[] = [];
  const padding = Math.max(0, 90 - history.length);
  for (let i = 0; i < padding; i++) slots.push(null);
  slots.push(...history);

  return (
    <div className="flex items-end gap-[2px] h-9 w-full">
      {slots.map((p, i) => {
        const color = !p
          ? "bg-muted/30"
          : p.status === "operational"
          ? "bg-emerald-500"
          : p.status === "degraded"
          ? "bg-amber-500"
          : p.status === "down"
          ? "bg-red-500"
          : "bg-muted/40";
        return (
          <div
            key={i}
            className={cn("flex-1 h-full rounded-[2px] transition-colors", color)}
            title={
              p
                ? `${new Date(p.checked_at).toLocaleString("pt-BR")} • ${p.status}`
                : "Sem dados"
            }
          />
        );
      })}
    </div>
  );
}

function timeAgo(iso: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `há ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

const COMP_STATUS_COPY: Record<UpstreamCompStatus, { label: string; color: string; dot: string }> = {
  operational: { label: "Operacional", color: "text-emerald-300", dot: "bg-emerald-500" },
  degraded_performance: { label: "Performance reduzida", color: "text-amber-300", dot: "bg-amber-500" },
  partial_outage: { label: "Interrupção parcial", color: "text-orange-300", dot: "bg-orange-500" },
  major_outage: { label: "Interrupção total", color: "text-red-300", dot: "bg-red-500" },
  under_maintenance: { label: "Em manutenção", color: "text-sky-300", dot: "bg-sky-500" },
};

const INC_STATUS_COPY: Record<UpstreamIncidentStatus, { label: string; tone: string }> = {
  investigating: { label: "Investigando", tone: "bg-red-500/15 text-red-300 border-red-500/30" },
  identified: { label: "Identificado", tone: "bg-orange-500/15 text-orange-300 border-orange-500/30" },
  monitoring: { label: "Monitorando", tone: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  resolved: { label: "Resolvido", tone: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  postmortem: { label: "Análise pós-incidente", tone: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
};

export default function Status() {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(ENDPOINT, { method: "GET" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as StatusPayload;
      setData(json);
    } catch (e: any) {
      setError(e?.message || "Falha ao buscar status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 45_000);
    return () => clearInterval(id);
  }, [load]);

  const overall = data?.overall || (loading ? "unknown" : "down");
  const copy = STATUS_COPY[overall];

  useEffect(() => {
    document.title = "Status dos Serviços FBFlix";
    const meta = document.querySelector('meta[name="description"]');
    const original = meta?.getAttribute("content");
    meta?.setAttribute(
      "content",
      "Acompanhe em tempo real o status dos proxies, API e painel da FBFlix.",
    );
    return () => {
      if (meta && original) meta.setAttribute("content", original);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-card/40 backdrop-blur">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src={logoFbflix} alt="FBFlix" className="w-9 h-9 object-contain" />
            <span className="font-bold text-lg tracking-tight">FBFLIX</span>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Atualizar
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        <h1 className="sr-only">Status dos Serviços FBFlix</h1>

        <div
          className={cn(
            "rounded-2xl border bg-gradient-to-br p-6 flex items-start gap-4",
            copy.tone,
          )}
        >
          <StatusIcon status={overall} className="w-8 h-8 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h2 className="text-xl md:text-2xl font-bold text-foreground">
              {copy.label}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">{copy.description}</p>
            {data && (
              <p className="text-xs text-muted-foreground/80 mt-3">
                Última verificação {timeAgo(data.generated_at)} • atualiza a cada 45s
              </p>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
            Não foi possível carregar o status: {error}
          </div>
        )}

        {data?.upstream && data.upstream.incidents.filter((i) => i.status !== "resolved").length > 0 && (
          <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
            <div className="px-6 py-4 border-b border-amber-500/20 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-300" />
              <h2 className="font-semibold text-amber-200">Incidentes em andamento</h2>
            </div>
            <div className="divide-y divide-amber-500/10">
              {data.upstream.incidents
                .filter((i) => i.status !== "resolved")
                .map((inc) => (
                  <IncidentBlock key={inc.id} incident={inc} />
                ))}
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur overflow-hidden">
          <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between">
            <h2 className="font-semibold">Status dos sistemas</h2>
            <span className="text-xs text-muted-foreground">
              Histórico das últimas 24h
            </span>
          </div>
          <div className="divide-y divide-border/60">
            {(data?.services || []).map((s) => (
              <div key={s.key} className="px-6 py-5 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <StatusIcon status={s.current} className="w-5 h-5 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{s.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.current === "operational" && "Operacional"}
                        {s.current === "degraded" && "Performance reduzida"}
                        {s.current === "down" && "Fora do ar"}
                        {s.current === "unknown" && "Aguardando dados"}
                        {s.latency_ms != null && ` • ${s.latency_ms}ms`}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold tabular-nums">
                      {s.uptime_24h.toFixed(2)}%
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      uptime 24h
                    </div>
                  </div>
                </div>
                <HistoryBar history={s.history} />
              </div>
            ))}
            {!data && loading && (
              <div className="px-6 py-10 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Verificando serviços...
              </div>
            )}
          </div>
        </section>

        {data?.upstream && data.upstream.components.length > 0 && (
          <section className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur overflow-hidden">
            <div className="px-6 py-4 border-b border-border/60 flex items-center gap-2">
              <Activity className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-semibold">Componentes da rede de proxies</h2>
            </div>
            <div className="divide-y divide-border/60">
              {data.upstream.components.map((c) => {
                const copy = COMP_STATUS_COPY[c.status] || COMP_STATUS_COPY.operational;
                return (
                  <div
                    key={c.id}
                    className="px-6 py-3.5 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", copy.dot)} />
                      <span className="truncate text-sm">{c.name}</span>
                    </div>
                    <span className={cn("text-xs font-medium shrink-0", copy.color)}>
                      {copy.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {data?.upstream && data.upstream.incidents.some((i) => i.status === "resolved") && (
          <section className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur overflow-hidden">
            <div className="px-6 py-4 border-b border-border/60 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-semibold">Histórico de incidentes resolvidos</h2>
            </div>
            <div className="divide-y divide-border/60">
              {data.upstream.incidents
                .filter((i) => i.status === "resolved")
                .slice(0, 6)
                .map((inc) => (
                  <IncidentBlock key={inc.id} incident={inc} compact />
                ))}
            </div>
          </section>
        )}

        <footer className="text-center text-xs text-muted-foreground pt-6 pb-10">
          <p>
            Atualizamos esta página automaticamente. Para problemas urgentes, fale
            com nosso{" "}
            <Link to="/suporte" className="underline hover:text-foreground">
              suporte
            </Link>
            .
          </p>
          <p className="mt-2">© {new Date().getFullYear()} FBFlix</p>
        </footer>
      </main>
    </div>
  );
}

function IncidentBlock({
  incident,
  compact,
}: {
  incident: UpstreamPayload["incidents"][number];
  compact?: boolean;
}) {
  const status = INC_STATUS_COPY[incident.status] || INC_STATUS_COPY.investigating;
  const latest = incident.updates[0];
  return (
    <div className="px-6 py-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium text-sm leading-snug flex-1">{incident.name}</h3>
        <span
          className={cn(
            "shrink-0 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full border",
            status.tone,
          )}
        >
          {status.label}
        </span>
      </div>
      {latest && !compact && (
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
          {latest.body}
        </p>
      )}
      <div className="text-[11px] text-muted-foreground/80">
        {incident.status === "resolved" && incident.resolved_at
          ? `Resolvido ${timeAgo(incident.resolved_at)}`
          : `Atualizado ${timeAgo(incident.updated_at)}`}
        {" • "}
        Iniciado em {new Date(incident.created_at).toLocaleString("pt-BR")}
      </div>
    </div>
  );
}