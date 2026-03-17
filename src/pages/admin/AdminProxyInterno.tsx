import { useState, useEffect } from "react";
import { Shield, Copy, Check, RefreshCw, Wifi, Database, Globe, AlertTriangle, Save, Zap, PenLine } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { callWebshare } from "@/hooks/useWebshare";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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
        <p className="text-sm font-mono text-foreground truncate">{value || "—"}</p>
      </div>
      <Button size="icon" variant="ghost" className="shrink-0 size-8" onClick={copy} disabled={!value}>
        {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
      </Button>
    </div>
  );
}

function useInternalProxyConfig() {
  return useQuery({
    queryKey: ["internal-proxy-config"],
    queryFn: () => callWebshare("get-internal-proxy-config"),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

function useSaveInternalProxyConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: Record<string, any>) => callWebshare("save-internal-proxy-config", { config }),
    onSuccess: () => {
      toast.success("Configuração salva!");
      qc.invalidateQueries({ queryKey: ["internal-proxy-config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export default function AdminProxyInterno() {
  const { data, isLoading, refetch, isFetching } = useInternalProxyConfig();
  const saveMutation = useSaveInternalProxyConfig();

  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({
    host: "",
    converted_host: "",
    http_port: "80",
    socks5_port: "1080",
    alt_http_port: "3128",
    username: "",
    password: "",
    notes: "",
  });

  // Populate form when data arrives
  useEffect(() => {
    if (data?.saved_override) {
      const s = data.saved_override;
      setForm({
        host: s.host || "p.webshare.io",
        converted_host: s.converted_host || "",
        http_port: String(s.http_port || 80),
        socks5_port: String(s.socks5_port || 1080),
        alt_http_port: String(s.alt_http_port || 3128),
        username: s.username || "",
        password: s.password || "",
        notes: s.notes || "",
      });
    } else if (data?.auto_suggested) {
      const a = data.auto_suggested;
      setForm({
        host: a.host || "p.webshare.io",
        converted_host: "",
        http_port: String(a.http_port || 80),
        socks5_port: String(a.socks5_port || 1080),
        alt_http_port: String(a.alt_http_port || 3128),
        username: a.username || "",
        password: a.password || "",
        notes: "",
      });
    }
  }, [data]);

  const handleSaveManual = () => {
    saveMutation.mutate({
      source: "manual_override",
      host: form.host,
      converted_host: form.converted_host || null,
      http_port: Number(form.http_port) || 80,
      socks5_port: Number(form.socks5_port) || 1080,
      alt_http_port: Number(form.alt_http_port) || 3128,
      username: form.username,
      password: form.password,
      notes: form.notes || null,
    });
    setEditMode(false);
  };

  const handleResetToAuto = () => {
    saveMutation.mutate({ source: "webshare_auto" });
    setEditMode(false);
  };

  // Active config for display
  const active = data?.active;
  const activeSource = data?.active_source || "webshare_auto";
  const bw = data?.bandwidth || {};
  const usedBytes = bw.used_bytes || 0;
  const limitBytes = bw.limit_bytes || 0;
  const usedPct = limitBytes > 0 ? (usedBytes / limitBytes) * 100 : 0;

  // Build connection strings from active config
  const buildStrings = (cfg: any, useConverted = false) => {
    if (!cfg) return { http80: "", http3128: "", socks5: "" };
    const h = useConverted && cfg.converted_host ? cfg.converted_host : cfg.host || "p.webshare.io";
    const u = cfg.username || "";
    const p = cfg.password || "";
    return {
      http80: `${u}:${p}@${h}:${cfg.http_port || 80}`,
      http3128: `${u}:${p}@${h}:${cfg.alt_http_port || 3128}`,
      socks5: `${u}:${p}@${h}:${cfg.socks5_port || 1080}`,
    };
  };

  const strDomain = buildStrings(active, false);
  const hasConvertedHost = active?.converted_host;
  const strIP = hasConvertedHost ? buildStrings(active, true) : null;

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
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-[10px]">
            USO INTERNO
          </Badge>
          <Badge
            variant={activeSource === "manual_override" ? "default" : "secondary"}
            className="text-[10px]"
          >
            {activeSource === "manual_override" ? "Override Manual" : "Automático"}
          </Badge>
        </div>
      </div>

      {/* Warning */}
      <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="size-4 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-200/80">
            Esta tela é exclusiva para uso operacional interno. Alterações aqui <strong>não afetam</strong> assinaturas de clientes, entregas ou cobranças.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      ) : !data ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Não foi possível carregar as credenciais.</p>
            <Button variant="outline" className="mt-4" onClick={() => refetch()}>Tentar novamente</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Active Config + Bandwidth */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Credentials */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Wifi className="size-4 text-amber-500" />
                    Configuração Ativa
                  </CardTitle>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => refetch()} disabled={isFetching}>
                      <RefreshCw className={`size-3 ${isFetching ? "animate-spin" : ""}`} />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setEditMode(!editMode)}>
                      <PenLine className="size-3" />
                      {editMode ? "Cancelar" : "Editar"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {active ? (
                  <>
                    <CopyField label="Host (Domínio)" value={active.host || "p.webshare.io"} />
                    {active.converted_host && (
                      <CopyField label="Host (IP Convertido)" value={active.converted_host} />
                    )}
                    <CopyField label="Usuário" value={active.username || ""} />
                    <CopyField label="Senha" value={active.password || ""} />

                    <div className="pt-2 border-t border-border/50 space-y-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Strings prontas (domínio)</p>
                      <CopyField label="HTTP :80" value={strDomain.http80} />
                      <CopyField label="HTTP :3128" value={strDomain.http3128} />
                      <CopyField label="SOCKS5 :1080" value={strDomain.socks5} />
                    </div>

                    {strIP && (
                      <div className="pt-2 border-t border-border/50 space-y-2">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1">
                          <Zap className="size-3 text-green-500" />
                          Strings prontas (IP convertido)
                        </p>
                        <CopyField label="HTTP :80" value={strIP.http80} />
                        <CopyField label="HTTP :3128" value={strIP.http3128} />
                        <CopyField label="SOCKS5 :1080" value={strIP.socks5} />
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma configuração disponível.</p>
                )}
              </CardContent>
            </Card>

            {/* Bandwidth */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Database className="size-4 text-amber-500" />
                  Consumo de Banda
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Usado</span>
                    <span>{formatBytes(usedBytes)} / {limitBytes > 0 ? formatBytes(limitBytes) : "Ilimitado"}</span>
                  </div>
                  <Progress value={limitBytes > 0 ? usedPct : 0} className="h-3" />
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

                <div className="rounded-lg bg-muted/30 border border-border/50 p-3">
                  <div className="flex items-start gap-2">
                    <Globe className="size-4 text-amber-500 mt-0.5 shrink-0" />
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p className="font-medium text-foreground">Dicas de compatibilidade</p>
                      <ul className="list-disc pl-3 space-y-0.5">
                        <li>Em ferramentas com seletor, use <strong>Ponto final de proxy rotativo</strong>, não <strong>Conexão de Backbone</strong>.</li>
                        <li>Use autenticação por <strong>Nome de usuário/Senha</strong>.</li>
                        <li>Se a ferramenta falhar com <code className="text-amber-400">p.webshare.io</code>, salve o IP convertido no override manual.</li>
                        <li>Para SOCKS5, use porta <strong>1080</strong>.</li>
                        <li>Para HTTP, tente porta <strong>80</strong> e depois <strong>3128</strong>.</li>
                        <li>O IP será rotacionado automaticamente a cada requisição.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Edit / Override section */}
          {editMode && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <PenLine className="size-4 text-amber-500" />
                  Override Manual
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Salve credenciais validadas manualmente. Estas terão prioridade sobre o automático.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Host (domínio)</label>
                    <Input value={form.host} onChange={e => setForm(f => ({ ...f, host: e.target.value }))} placeholder="p.webshare.io" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">IP Convertido (opcional)</label>
                    <Input value={form.converted_host} onChange={e => setForm(f => ({ ...f, converted_host: e.target.value }))} placeholder="Ex: 185.199.x.x" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Usuário</label>
                    <Input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="username-BR-rotate" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Senha</label>
                    <Input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Porta HTTP</label>
                    <Input value={form.http_port} onChange={e => setForm(f => ({ ...f, http_port: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Porta SOCKS5</label>
                    <Input value={form.socks5_port} onChange={e => setForm(f => ({ ...f, socks5_port: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Porta HTTP Alt</label>
                    <Input value={form.alt_http_port} onChange={e => setForm(f => ({ ...f, alt_http_port: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Notas</label>
                  <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Ex: Validado em 17/03 no GoLogin" rows={2} />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSaveManual} disabled={saveMutation.isPending} className="gap-1">
                    <Save className="size-3.5" />
                    Salvar Override Manual
                  </Button>
                  <Button variant="outline" onClick={handleResetToAuto} disabled={saveMutation.isPending}>
                    Resetar para Automático
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Auto-suggested reference */}
          {data.auto_suggested && (
            <Card className="opacity-70">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="size-4 text-muted-foreground" />
                  Sugestão Automática (Webshare API)
                  <Badge variant="secondary" className="text-[10px]">Referência</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 sm:grid-cols-3">
                  <CopyField label="Host" value={data.auto_suggested.host} />
                  <CopyField label="Usuário" value={data.auto_suggested.username} />
                  <CopyField label="Senha" value={data.auto_suggested.password} />
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
