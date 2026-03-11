import { useState, useEffect, useCallback } from "react";
import * as OTPAuth from "otpauth";
import { Copy, CheckCircle, ShieldCheck, RefreshCw, Trash2, Plus, Clock, UserCheck, Loader2, AlertTriangle, XCircle, HelpCircle, Wrench, Search } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

// ============= 2FA TOTP SECTION =============

function generateTOTP(secret: string): { code: string; remaining: number; period: number } | null {
  try {
    const cleanSecret = secret.replace(/\s+/g, "").toUpperCase();
    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(cleanSecret),
      digits: 6,
      period: 30,
      algorithm: "SHA1",
    });
    const code = totp.generate();
    const now = Math.floor(Date.now() / 1000);
    const remaining = 30 - (now % 30);
    return { code, remaining, period: 30 };
  } catch {
    return null;
  }
}

interface SavedSecret {
  id: string;
  label: string;
  secret: string;
}

function TOTPDisplay({ secret, label, onRemove }: { secret: string; label: string; onRemove?: () => void }) {
  const [result, setResult] = useState<{ code: string; remaining: number; period: number } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const update = () => setResult(generateTOTP(secret));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [secret]);

  const handleCopy = useCallback(() => {
    if (!result) return;
    navigator.clipboard.writeText(result.code);
    setCopied(true);
    toast.success("Código copiado!");
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  if (!result) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="p-4 text-sm text-destructive">
          Secret inválido: {secret.substring(0, 20)}...
        </CardContent>
      </Card>
    );
  }

  const progressPercent = (result.remaining / result.period) * 100;
  const isUrgent = result.remaining <= 5;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground truncate max-w-[200px]">{label}</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="size-7" onClick={handleCopy}>
              {copied ? <CheckCircle className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
            </Button>
            {onRemove && (
              <Button variant="ghost" size="icon" className="size-7 text-destructive" onClick={onRemove}>
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
        <div
          className="text-4xl font-mono font-bold tracking-[0.3em] text-center cursor-pointer select-all py-2"
          onClick={handleCopy}
        >
          {result.code.slice(0, 3)} {result.code.slice(3)}
        </div>
        <div className="space-y-1">
          <Progress value={progressPercent} className={`h-1.5 ${isUrgent ? "[&>div]:bg-destructive" : "[&>div]:bg-primary"}`} />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              {isUrgent ? "Renovando..." : "Tempo restante"}
            </span>
            <span className={`font-mono font-semibold ${isUrgent ? "text-destructive" : ""}`}>
              {result.remaining}s
            </span>
          </div>
        </div>
        <div className="text-[10px] text-muted-foreground font-mono truncate">
          {secret.replace(/\s+/g, "").substring(0, 32)}...
        </div>
      </CardContent>
    </Card>
  );
}

function TOTP2FATab() {
  const [secretInput, setSecretInput] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const [quickResult, setQuickResult] = useState<{ code: string; remaining: number; period: number } | null>(null);
  const [savedSecrets, setSavedSecrets] = useState<SavedSecret[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("fbflix_2fa_secrets") || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!secretInput.trim()) {
      setQuickResult(null);
      return;
    }
    const update = () => setQuickResult(generateTOTP(secretInput));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [secretInput]);

  useEffect(() => {
    localStorage.setItem("fbflix_2fa_secrets", JSON.stringify(savedSecrets));
  }, [savedSecrets]);

  const handleSave = () => {
    const clean = secretInput.replace(/\s+/g, "").toUpperCase();
    if (!clean) { toast.error("Insira um secret válido"); return; }
    const test = generateTOTP(clean);
    if (!test) { toast.error("Secret inválido — verifique o formato Base32"); return; }
    const label = labelInput.trim() || `Secret ${savedSecrets.length + 1}`;
    setSavedSecrets((prev) => [...prev, { id: crypto.randomUUID(), label, secret: clean }]);
    setSecretInput("");
    setLabelInput("");
    toast.success(`"${label}" salvo com sucesso!`);
  };

  const handleRemove = (id: string) => {
    setSavedSecrets((prev) => prev.filter((s) => s.id !== id));
    toast.success("Secret removido");
  };

  const handleCopyQuick = () => {
    if (quickResult) {
      navigator.clipboard.writeText(quickResult.code);
      toast.success("Código copiado!");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Gerar código rápido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input placeholder="Cole o 2FA Secret (Base32) aqui..." value={secretInput} onChange={(e) => setSecretInput(e.target.value)} className="flex-1 font-mono text-sm" />
            <Input placeholder="Nome (opcional)" value={labelInput} onChange={(e) => setLabelInput(e.target.value)} className="sm:w-48" />
          </div>
          {quickResult && (
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="text-3xl font-mono font-bold tracking-[0.3em] cursor-pointer select-all" onClick={handleCopyQuick}>
                {quickResult.code.slice(0, 3)} {quickResult.code.slice(3)}
              </div>
              <div className="flex-1">
                <Progress value={(quickResult.remaining / quickResult.period) * 100} className={`h-1.5 ${quickResult.remaining <= 5 ? "[&>div]:bg-destructive" : "[&>div]:bg-primary"}`} />
                <span className="text-xs text-muted-foreground font-mono">{quickResult.remaining}s</span>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={handleCopyQuick}><Copy className="size-3 mr-1" /> Copiar</Button>
                <Button size="sm" onClick={handleSave}><Plus className="size-3 mr-1" /> Salvar</Button>
              </div>
            </div>
          )}
          {secretInput && !quickResult && <p className="text-sm text-destructive">Secret inválido — verifique se é um código Base32 válido</p>}
        </CardContent>
      </Card>

      {savedSecrets.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2"><RefreshCw className="size-4" /> Secrets Salvos ({savedSecrets.length})</h2>
            <p className="text-xs text-muted-foreground">Os códigos atualizam automaticamente a cada 30s</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {savedSecrets.map((s) => (
              <TOTPDisplay key={s.id} secret={s.secret} label={s.label} onRemove={() => handleRemove(s.id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============= PROFILE CHECKER SECTION =============

type ProfileStatus = "active" | "blocked" | "not_found" | "unknown" | "error";

interface CheckResult {
  url: string;
  status: ProfileStatus;
  httpStatus: number;
  detail: string;
  stockItemId?: string;
  stockItemName?: string;
}

const STATUS_CONFIG: Record<ProfileStatus, { label: string; color: string; icon: typeof CheckCircle }> = {
  active: { label: "Ativo", color: "bg-green-500/10 text-green-600 border-green-500/20", icon: CheckCircle },
  blocked: { label: "Bloqueado", color: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle },
  not_found: { label: "Não encontrado", color: "bg-orange-500/10 text-orange-600 border-orange-500/20", icon: AlertTriangle },
  unknown: { label: "Incerto", color: "bg-muted text-muted-foreground border-border", icon: HelpCircle },
  error: { label: "Erro", color: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle },
};

function ProfileCheckerTab() {
  const [urlsInput, setUrlsInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [results, setResults] = useState<CheckResult[]>([]);
  const [checkingStock, setCheckingStock] = useState(false);
  const [stockResults, setStockResults] = useState<CheckResult[]>([]);
  const [stockFilter, setStockFilter] = useState<"estoque" | "vendido" | "all">("estoque");

  const handleCheckUrls = async () => {
    const urls = urlsInput
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean);
    if (urls.length === 0) {
      toast.error("Cole pelo menos uma URL de perfil");
      return;
    }
    if (urls.length > 20) {
      toast.error("Máximo 20 URLs por vez");
      return;
    }

    setChecking(true);
    setResults([]);
    try {
      const { data, error } = await supabase.functions.invoke("check-fb-profile", {
        body: { action: "check-batch", urls },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setResults(data.results || []);
      const active = (data.results || []).filter((r: CheckResult) => r.status === "active").length;
      const blocked = (data.results || []).filter((r: CheckResult) => r.status === "blocked").length;
      toast.success(`Verificação concluída: ${active} ativos, ${blocked} bloqueados`);
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || "Falha na verificação"));
    } finally {
      setChecking(false);
    }
  };

  const handleCheckStock = async () => {
    setCheckingStock(true);
    setStockResults([]);
    try {
      const statusFilter = stockFilter === "estoque" ? "estoque" : stockFilter;
      const { data, error } = await supabase.functions.invoke("check-fb-profile", {
        body: { action: "check-stock", limit: 20, statusFilter },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setStockResults(data.results || []);
      const active = (data.results || []).filter((r: CheckResult) => r.status === "active").length;
      const blocked = (data.results || []).filter((r: CheckResult) => r.status === "blocked").length;
      toast.success(`Verificação: ${active} ativos, ${blocked} bloqueados de ${data.total}`);
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || "Falha na verificação"));
    } finally {
      setCheckingStock(false);
    }
  };

  const renderResults = (items: CheckResult[]) => {
    if (items.length === 0) return null;

    const summary = {
      active: items.filter((r) => r.status === "active").length,
      blocked: items.filter((r) => r.status === "blocked").length,
      not_found: items.filter((r) => r.status === "not_found").length,
      unknown: items.filter((r) => r.status === "unknown").length,
      error: items.filter((r) => r.status === "error").length,
    };

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {summary.active > 0 && <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">✅ {summary.active} Ativos</Badge>}
          {summary.blocked > 0 && <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">❌ {summary.blocked} Bloqueados</Badge>}
          {summary.not_found > 0 && <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20">⚠️ {summary.not_found} Não encontrados</Badge>}
          {summary.unknown > 0 && <Badge variant="outline">❓ {summary.unknown} Incertos</Badge>}
          {summary.error > 0 && <Badge variant="destructive">{summary.error} Erros</Badge>}
        </div>

        <div className="space-y-2">
          {items.map((r, i) => {
            const cfg = STATUS_CONFIG[r.status];
            const Icon = cfg.icon;
            return (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${cfg.color}`}>
                <Icon className="size-4 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{r.stockItemName || r.url}</span>
                    <Badge variant="outline" className="text-[10px]">{cfg.label}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{r.detail}</p>
                  {r.stockItemId && (
                    <p className="text-[10px] text-muted-foreground font-mono mt-1">ID: {r.stockItemId}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground font-mono truncate">{r.url}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Manual URL Check */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Search className="size-4" />
            Verificar URLs manualmente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder={"Cole as URLs de perfis do Facebook (uma por linha):\nhttps://facebook.com/perfil1\nhttps://facebook.com/perfil2"}
            value={urlsInput}
            onChange={(e) => setUrlsInput(e.target.value)}
            rows={4}
            className="font-mono text-sm"
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Máximo 20 URLs por vez • ~10s por URL</p>
            <Button onClick={handleCheckUrls} disabled={checking}>
              {checking ? <Loader2 className="size-4 mr-1 animate-spin" /> : <UserCheck className="size-4 mr-1" />}
              {checking ? "Verificando..." : "Verificar Perfis"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Resultados da verificação manual</CardTitle>
          </CardHeader>
          <CardContent>{renderResults(results)}</CardContent>
        </Card>
      )}

      {/* Stock Check */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <UserCheck className="size-4" />
            Verificar Perfis do Estoque
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Verifica automaticamente os últimos 20 itens do estoque que possuem links do Facebook (status "revisado" ou "aguardando").
          </p>
          <Button onClick={handleCheckStock} disabled={checkingStock}>
            {checkingStock ? <Loader2 className="size-4 mr-1 animate-spin" /> : <RefreshCw className="size-4 mr-1" />}
            {checkingStock ? "Verificando estoque..." : "Verificar Estoque"}
          </Button>
        </CardContent>
      </Card>

      {stockResults.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Resultados do Estoque</CardTitle>
          </CardHeader>
          <CardContent>{renderResults(stockResults)}</CardContent>
        </Card>
      )}
    </div>
  );
}

// ============= MAIN PAGE =============

export default function AdminFerramentas() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Wrench className="size-5 text-primary" />
          Ferramentas
        </h1>
        <p className="text-sm text-muted-foreground">
          Gerador 2FA, verificador de perfis e mais
        </p>
      </div>

      <Tabs defaultValue="2fa" className="w-full">
        <TabsList>
          <TabsTrigger value="2fa" className="gap-1.5">
            <ShieldCheck className="size-3.5" />
            Gerador 2FA
          </TabsTrigger>
          <TabsTrigger value="profile-checker" className="gap-1.5">
            <UserCheck className="size-3.5" />
            Verificador de Perfis
          </TabsTrigger>
        </TabsList>

        <TabsContent value="2fa" className="mt-4">
          <TOTP2FATab />
        </TabsContent>

        <TabsContent value="profile-checker" className="mt-4">
          <ProfileCheckerTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
