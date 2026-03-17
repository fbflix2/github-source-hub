import { useState } from "react";
import { Shield, Copy, Check, RefreshCw, Wifi, Database, Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useWebshareRotatingBandwidth } from "@/hooks/useWebshare";

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success(`${label} copiado!`);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
        <p className="text-sm font-mono text-foreground truncate">{value}</p>
      </div>
      <Button size="icon" variant="ghost" className="shrink-0 size-8" onClick={copy}>
        {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
      </Button>
    </div>
  );
}

export default function AdminProxyInterno() {
  const { data, isLoading, refetch, isFetching } = useWebshareRotatingBandwidth();

  const username = data ? `${data.username}${data.country_suffix || "-country-BR-rotate"}` : "";
  const password = data?.password || "";
  const host = data?.proxy_host || "p.webshare.io";
  const httpPort = data?.http_port || 80;
  const socks5Port = data?.socks5_port || 1080;

  const usedBytes = data?.bandwidth_used_bytes || 0;
  const limitBytes = data?.bandwidth_limit_bytes || 0;
  const usedPct = limitBytes > 0 ? (usedBytes / limitBytes) * 100 : 0;

  const httpString = `${username}:${password}@${host}:${httpPort}`;
  const socks5String = `${username}:${password}@${host}:${socks5Port}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-700 shadow-lg shadow-amber-500/20">
            <Shield className="text-white size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Proxy Interno</h1>
            <p className="text-xs text-muted-foreground">Proxy rotativo BR para uso operacional da equipe</p>
          </div>
        </div>
        <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-[10px]">
          USO INTERNO
        </Badge>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      ) : !data ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Não foi possível carregar as credenciais.</p>
            <Button variant="outline" className="mt-4" onClick={() => refetch()}>Tentar novamente</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Credentials */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Wifi className="size-4 text-amber-500" />
                Credenciais Proxy Rotativo BR
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <CopyField label="Host" value={host} />
              <CopyField label="Porta HTTP" value={String(httpPort)} />
              <CopyField label="Porta SOCKS5" value={String(socks5Port)} />
              <CopyField label="Usuário" value={username} />
              <CopyField label="Senha" value={password} />

              <div className="pt-2 border-t border-border/50 space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Strings prontas</p>
                <CopyField label="HTTP" value={httpString} />
                <CopyField label="SOCKS5" value={socks5String} />
              </div>
            </CardContent>
          </Card>

          {/* Bandwidth */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Database className="size-4 text-amber-500" />
                  Consumo de Banda
                </CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1"
                  onClick={() => refetch()}
                  disabled={isFetching}
                >
                  <RefreshCw className={`size-3 ${isFetching ? "animate-spin" : ""}`} />
                  Atualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Usado</span>
                  <span>{formatBytes(usedBytes)} / {limitBytes > 0 ? formatBytes(limitBytes) : "Ilimitado"}</span>
                </div>
                <Progress
                  value={limitBytes > 0 ? usedPct : 0}
                  className="h-3"
                />
                {limitBytes > 0 && (
                  <p className="text-xs text-muted-foreground text-right">{usedPct.toFixed(1)}% utilizado</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/30 border border-border/50 p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Consumido</p>
                  <p className="text-lg font-bold text-foreground">{formatBytes(usedBytes)}</p>
                </div>
                <div className="rounded-lg bg-muted/30 border border-border/50 p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Restante</p>
                  <p className="text-lg font-bold text-foreground">
                    {limitBytes > 0 ? formatBytes(Math.max(0, limitBytes - usedBytes)) : "∞"}
                  </p>
                </div>
              </div>

              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
                <div className="flex items-start gap-2">
                  <Globe className="size-4 text-amber-500 mt-0.5 shrink-0" />
                  <div className="text-xs text-amber-200/80">
                    <p className="font-medium text-amber-400 mb-1">Como usar</p>
                    <p>Configure o proxy no navegador ou ferramenta usando as credenciais ao lado. O IP será rotacionado automaticamente a cada requisição com IPs brasileiros.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
