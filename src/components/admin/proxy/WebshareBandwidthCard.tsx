import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { callWebshare } from "@/hooks/useWebshare";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Activity, HardDrive, AlertTriangle, CheckCircle2, Zap } from "lucide-react";

interface Props {
  bandwidthLimitGB: number | null;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i >= 3 ? 2 : 0)} ${units[i]}`;
}

function formatGB(bytes: number): number {
  return bytes / (1024 * 1024 * 1024);
}

export default function WebshareBandwidthCard({ bandwidthLimitGB }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["webshare-bandwidth-stats"],
    queryFn: () => callWebshare("get-bandwidth-stats"),
    staleTime: 300_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const stats = useMemo(() => {
    if (!data) return null;

    const agg = data.aggregate || {};
    const totalBandwidthBytes = agg.bandwidth_total || 0;
    const totalRequests = agg.requests_total || 0;
    const totalFailed = agg.requests_failed || 0;
    const usedGB = formatGB(totalBandwidthBytes);
    const limitGB = bandwidthLimitGB || 0;
    const usagePercent = limitGB > 0 ? Math.min((usedGB / limitGB) * 100, 100) : 0;

    // Calculate days in billing cycle and daily projection
    const start = new Date(data.billing_start);
    const end = new Date(data.billing_end);
    const now = new Date();
    const totalDays = Math.max(1, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const elapsedDays = Math.max(1, (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const projectedGB = (usedGB / elapsedDays) * totalDays;
    const daysRemaining = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    // Aggregate hourly data into daily for chart
    const dailyMap = new Map<string, { bandwidth: number; requests: number; concurrency: number; count: number }>();
    const hourlyData = Array.isArray(data.hourly) ? data.hourly : [];
    
    for (const entry of hourlyData) {
      if (entry.is_projected) continue;
      const day = entry.timestamp?.substring(0, 10);
      if (!day) continue;
      const existing = dailyMap.get(day) || { bandwidth: 0, requests: 0, concurrency: 0, count: 0 };
      existing.bandwidth += entry.bandwidth_total || 0;
      existing.requests += entry.requests_total || 0;
      existing.concurrency += entry.average_concurrency || 0;
      existing.count += 1;
      dailyMap.set(day, existing);
    }

    const dailyChart = Array.from(dailyMap.entries())
      .map(([date, val]) => ({
        date,
        bandwidthGB: parseFloat(formatGB(val.bandwidth).toFixed(2)),
        requests: val.requests,
        avgConcurrency: val.count > 0 ? parseFloat((val.concurrency / val.count).toFixed(2)) : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Status thresholds
    let status: "safe" | "warning" | "critical" = "safe";
    if (limitGB > 0) {
      if (usagePercent >= 90 || projectedGB > limitGB * 1.1) status = "critical";
      else if (usagePercent >= 70 || projectedGB > limitGB * 0.9) status = "warning";
    }

    return {
      usedGB,
      limitGB,
      usagePercent,
      projectedGB,
      totalRequests,
      totalFailed,
      daysRemaining,
      elapsedDays: Math.floor(elapsedDays),
      totalDays: Math.floor(totalDays),
      dailyChart,
      status,
      billingStart: data.billing_start,
      billingEnd: data.billing_end,
    };
  }, [data, bandwidthLimitGB]);

  if (isLoading) {
    return (
      <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
        <CardHeader><CardTitle className="text-sm">Consumo de Banda</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-[180px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const statusConfig = {
    safe: { color: "text-green-500", bg: "bg-green-500", icon: CheckCircle2, label: "Normal", barColor: "#22c55e" },
    warning: { color: "text-yellow-500", bg: "bg-yellow-500", icon: AlertTriangle, label: "Atenção", barColor: "#eab308" },
    critical: { color: "text-red-500", bg: "bg-red-500", icon: AlertTriangle, label: "Crítico", barColor: "#ef4444" },
  };
  const sc = statusConfig[stats.status];
  const StatusIcon = sc.icon;

  // Daily avg bandwidth for reference line
  const avgDailyGB = stats.dailyChart.length > 0
    ? stats.dailyChart.reduce((sum, d) => sum + d.bandwidthGB, 0) / stats.dailyChart.length
    : 0;

  return (
    <Card className="border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <HardDrive className="size-4 text-muted-foreground" />
            Consumo de Banda
          </CardTitle>
          <Badge variant="outline" className={`text-xs ${sc.color} border-current`}>
            <StatusIcon className="size-3 mr-1" />
            {sc.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Progress Gauge */}
        <div className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-3xl font-bold text-foreground">{stats.usedGB.toFixed(2)} <span className="text-lg text-muted-foreground font-normal">GB</span></p>
              <p className="text-xs text-muted-foreground">
                de {stats.limitGB > 0 ? `${stats.limitGB} GB` : "Ilimitado"} utilizados
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-foreground">{stats.usagePercent.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">{stats.daysRemaining} dias restantes</p>
            </div>
          </div>

          {/* Usage Bar */}
          {stats.limitGB > 0 && (
            <div className="relative">
              <div className="h-4 rounded-full bg-muted/40 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${
                    stats.status === "critical" ? "bg-red-500" : stats.status === "warning" ? "bg-yellow-500" : "bg-green-500"
                  }`}
                  style={{ width: `${Math.min(stats.usagePercent, 100)}%` }}
                />
              </div>
              {/* Projected marker */}
              {stats.projectedGB > 0 && stats.limitGB > 0 && (
                <div
                  className="absolute top-0 h-4 border-r-2 border-dashed border-muted-foreground/60"
                  style={{ left: `${Math.min((stats.projectedGB / stats.limitGB) * 100, 100)}%` }}
                  title={`Projeção: ${stats.projectedGB.toFixed(2)} GB`}
                />
              )}
              <div className="flex justify-between mt-1.5">
                <p className="text-[10px] text-muted-foreground">0 GB</p>
                <p className="text-[10px] text-muted-foreground">{stats.limitGB} GB</p>
              </div>
            </div>
          )}

          {/* Projection Alert */}
          {stats.limitGB > 0 && stats.projectedGB > stats.limitGB * 0.9 && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
              stats.projectedGB > stats.limitGB ? "bg-red-500/10 border border-red-500/20" : "bg-yellow-500/10 border border-yellow-500/20"
            }`}>
              <AlertTriangle className={`size-4 flex-shrink-0 ${stats.projectedGB > stats.limitGB ? "text-red-500" : "text-yellow-500"}`} />
              <p className="text-xs text-foreground">
                {stats.projectedGB > stats.limitGB
                  ? <>Projeção de <strong>{stats.projectedGB.toFixed(1)} GB</strong> excede o limite! Considere aumentar sua banda.</>
                  : <>Projeção de <strong>{stats.projectedGB.toFixed(1)} GB</strong> se aproxima do limite. Fique atento.</>
                }
              </p>
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-muted/20 p-3 text-center">
            <Activity className="size-4 mx-auto mb-1 text-blue-500" />
            <p className="text-lg font-bold text-foreground">{stats.totalRequests.toLocaleString("pt-BR")}</p>
            <p className="text-[10px] text-muted-foreground">Solicitações</p>
          </div>
          <div className="rounded-lg bg-muted/20 p-3 text-center">
            <Zap className="size-4 mx-auto mb-1 text-yellow-500" />
            <p className="text-lg font-bold text-foreground">
              {stats.elapsedDays > 0 ? (stats.usedGB / stats.elapsedDays).toFixed(2) : "0"}
              <span className="text-xs text-muted-foreground font-normal ml-0.5">GB</span>
            </p>
            <p className="text-[10px] text-muted-foreground">Média diária</p>
          </div>
          <div className="rounded-lg bg-muted/20 p-3 text-center">
            <HardDrive className="size-4 mx-auto mb-1 text-purple-500" />
            <p className="text-lg font-bold text-foreground">
              {stats.limitGB > 0 ? (stats.limitGB - stats.usedGB).toFixed(2) : "∞"}
              <span className="text-xs text-muted-foreground font-normal ml-0.5">GB</span>
            </p>
            <p className="text-[10px] text-muted-foreground">Restante</p>
          </div>
        </div>

        {/* Daily Bandwidth Chart */}
        {stats.dailyChart.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-3">Consumo diário de banda</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={stats.dailyChart} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => { const parts = v.split("-"); return `${parts[2]}/${parts[1]}`; }}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v} GB`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "hsl(var(--foreground))",
                  }}
                  formatter={(value: number, name: string) => [
                    name === "bandwidthGB" ? `${value.toFixed(2)} GB` : value.toLocaleString("pt-BR"),
                    name === "bandwidthGB" ? "Banda utilizada" : "Solicitações",
                  ]}
                  labelFormatter={(label) => { const [y, m, d] = label.split("-"); return `${d}/${m}/${y}`; }}
                />
                <ReferenceLine
                  y={avgDailyGB}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="4 4"
                  strokeOpacity={0.6}
                  label={{ value: "Média", position: "right", fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                />
                <Bar
                  dataKey="bandwidthGB"
                  fill={sc.barColor}
                  radius={[3, 3, 0, 0]}
                  opacity={0.85}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Billing Cycle Info */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/20">
          <span>Ciclo: {new Date(stats.billingStart).toLocaleDateString("pt-BR")} → {new Date(stats.billingEnd).toLocaleDateString("pt-BR")}</span>
          <span>Dia {stats.elapsedDays} de {stats.totalDays}</span>
        </div>
      </CardContent>
    </Card>
  );
}
