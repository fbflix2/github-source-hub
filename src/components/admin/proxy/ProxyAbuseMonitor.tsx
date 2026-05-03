import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Activity, AlertTriangle, Settings2, ShieldAlert, BarChart3, RefreshCw, User, Download, Upload } from "lucide-react";
import { useProxyFbflixUsageStats, useProxyUsageAlerts, useUpsertUsageAlert } from "@/hooks/useProxyFbflix";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ProxyAbuseMonitor() {
  const [period, setPeriod] = useState<"1h" | "24h" | "7d">("24h");
  const { data, isLoading, refetch, isFetching } = useProxyFbflixUsageStats(period);
  const { data: alerts } = useProxyUsageAlerts();
  const upsertAlert = useUpsertUsageAlert();

  const handleUpdateAlert = (period: string, threshold: number, is_active: boolean, id?: string) => {
    upsertAlert.mutate({
      id,
      metric: "bandwidth_gb",
      period,
      threshold,
      is_active
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <ShieldAlert className="size-5 text-red-500" />
            Monitor de Abuso (ProxyFbflix)
          </h2>
          <p className="text-xs text-muted-foreground">Identificação de torrents e downloads pesados por proxy</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
            <SelectTrigger className="w-[140px] h-9 bg-card">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Última Hora</SelectItem>
              <SelectItem value="24h">Últimas 24h</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="top10" className="space-y-4">
        <TabsList className="bg-card border border-border/40">
          <TabsTrigger value="top10" className="gap-1.5">
            <BarChart3 className="size-4" /> Top 10 Consumo
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-1.5">
            <Settings2 className="size-4" /> Regras de Alerta
          </TabsTrigger>
        </TabsList>

        <TabsContent value="top10">
          <div className="grid gap-4">
            {/* Summary of findings if any */}
            {data?.alerts_triggered?.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle className="size-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-red-400">Suspeita de Abuso Detectada</h4>
                  <p className="text-xs text-red-200/70">
                    {data.alerts_triggered.length} usuário(s) excederam o limite configurado para o período de {period}.
                  </p>
                </div>
              </div>
            )}

            <Card className="border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden">
              <CardHeader className="pb-3 border-b border-border/30">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="size-4 text-blue-500" />
                  Usuários que mais consomem banda ({period})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/30 hover:bg-transparent">
                      <TableHead>Cliente</TableHead>
                      <TableHead>Proxy / Sub</TableHead>
                      <TableHead className="text-right">Download</TableHead>
                      <TableHead className="text-right">Upload</TableHead>
                      <TableHead className="text-right">Total (GB)</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                      ))
                    ) : data?.top10?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                          Nenhum dado de consumo encontrado no período.
                        </TableCell>
                      </TableRow>
                    ) : (
                      data?.top10?.map((row: any, i: number) => {
                        const isAlert = data.alerts_triggered?.some((a: any) => a.proxy_id === row.proxy_id);
                        return (
                          <TableRow key={i} className={`border-border/20 ${isAlert ? "bg-red-500/5" : ""}`}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <User className="size-3 text-muted-foreground" />
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium text-foreground">{row.user_name}</span>
                                  <span className="text-[10px] text-muted-foreground">{row.user_email}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="text-xs font-mono">#{row.proxy_id}</span>
                                <span className="text-[10px] text-muted-foreground">{row.subscription_name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              <div className="flex items-center justify-end gap-1 text-muted-foreground">
                                <Download className="size-3" /> {row.download_gb.toFixed(2)} GB
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              <div className="flex items-center justify-end gap-1 text-muted-foreground">
                                <Upload className="size-3" /> {row.upload_gb.toFixed(2)} GB
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={`font-bold text-sm ${row.usage_gb > 5 ? "text-amber-500" : "text-foreground"}`}>
                                {row.usage_gb.toFixed(2)} GB
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              {isAlert ? (
                                <Badge variant="destructive" className="text-[10px] h-5 animate-pulse">ALERTA ABUSO</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] h-5 border-green-500/30 text-green-500">Normal</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="alerts">
          <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Configuração de Limites</CardTitle>
              <p className="text-xs text-muted-foreground">Defina o consumo máximo em GB para cada período antes de disparar um alerta.</p>
            </CardHeader>
            <CardContent className="space-y-6">
              {["1h", "24h", "7d"].map((p) => {
                const existing = alerts?.find((a: any) => a.period === p);
                const [val, setVal] = useState(existing?.threshold || (p === "1h" ? 2 : p === "24h" ? 10 : 50));
                const [active, setActive] = useState(existing?.is_active ?? true);

                return (
                  <div key={p} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-white/5 bg-white/5">
                    <div>
                      <h4 className="text-sm font-bold text-foreground">Período: {p === "1h" ? "Hora" : p === "24h" ? "Dia" : "Semana"}</h4>
                      <p className="text-[10px] text-muted-foreground">Alerta para downloads {'>'} {val} GB em {p}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Input 
                          type="number" 
                          className="w-20 h-8 text-xs bg-black/30" 
                          value={val} 
                          onChange={(e) => setVal(Number(e.target.value))} 
                        />
                        <span className="text-xs text-muted-foreground">GB</span>
                      </div>
                      <div className="flex items-center gap-2 border-l border-white/10 pl-4">
                        <span className="text-xs text-muted-foreground">{active ? "Ativo" : "Inativo"}</span>
                        <Switch checked={active} onCheckedChange={setActive} />
                      </div>
                      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleUpdateAlert(p, val, active, existing?.id)}>
                        Salvar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
