import { useState, useEffect, useCallback } from "react";
import { Copy, CheckCircle, ShieldCheck, Clock, Plus, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { generateTOTP, sanitizeTOTPInput, syncTOTPTimeOffset } from "@/lib/totp";

interface SavedSecret {
  id: string;
  label: string;
  secret: string;
}

function TOTPCard({ secret, label, onRemove }: { secret: string; label: string; onRemove?: () => void }) {
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

  const cappedRemaining = Math.min(result.remaining, 60);
  const cappedPeriod = Math.min(result.period, 60);
  const progressPercent = (cappedRemaining / cappedPeriod) * 100;
  const isUrgent = cappedRemaining <= 5;

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
      </CardContent>
    </Card>
  );
}

export default function Public2FA() {
  const [secretInput, setSecretInput] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const [quickResult, setQuickResult] = useState<{ code: string; remaining: number; period: number } | null>(null);
  const [savedSecrets, setSavedSecrets] = useState<SavedSecret[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("fbflix_public_2fa") || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    void syncTOTPTimeOffset();
  }, []);

  useEffect(() => {
    if (!secretInput.trim()) { setQuickResult(null); return; }
    const update = () => setQuickResult(generateTOTP(secretInput));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [secretInput]);

  useEffect(() => {
    localStorage.setItem("fbflix_public_2fa", JSON.stringify(savedSecrets));
  }, [savedSecrets]);

  const handleSave = () => {
    const sanitized = sanitizeTOTPInput(secretInput);
    if (!sanitized) { toast.error("Insira um secret válido"); return; }
    const test = generateTOTP(sanitized);
    if (!test) { toast.error("Secret inválido — verifique o formato Base32 ou URI otpauth"); return; }
    const label = labelInput.trim() || `Secret ${savedSecrets.length + 1}`;
    setSavedSecrets((prev) => [...prev, { id: crypto.randomUUID(), label, secret: sanitized }]);
    setSecretInput("");
    setLabelInput("");
    toast.success(`"${label}" salvo!`);
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
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <ShieldCheck className="size-8 text-primary" />
            <h1 className="text-2xl font-bold">Gerador 2FA</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Cole seu secret TOTP (Base32) ou URI otpauth:// para gerar códigos de autenticação em tempo real.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Gerar código</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Cole o 2FA Secret (Base32) ou URI otpauth://..."
              value={secretInput}
              onChange={(e) => setSecretInput(e.target.value)}
              className="font-mono text-sm"
            />
            <Input
              placeholder="Nome / Label (opcional)"
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
            />

            {quickResult && (
              <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-muted/50 rounded-lg">
                <div
                  className="text-4xl font-mono font-bold tracking-[0.3em] cursor-pointer select-all"
                  onClick={handleCopyQuick}
                >
                  {quickResult.code.slice(0, 3)} {quickResult.code.slice(3)}
                </div>
                <div className="flex-1 w-full">
                  <Progress
                    value={(quickResult.remaining / quickResult.period) * 100}
                    className={`h-1.5 ${quickResult.remaining <= 5 ? "[&>div]:bg-destructive" : "[&>div]:bg-primary"}`}
                  />
                  <span className="text-xs text-muted-foreground font-mono">{quickResult.remaining}s</span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleCopyQuick}>
                    <Copy className="size-3 mr-1" /> Copiar
                  </Button>
                  <Button size="sm" onClick={handleSave}>
                    <Plus className="size-3 mr-1" /> Salvar
                  </Button>
                </div>
              </div>
            )}

            {secretInput && !quickResult && (
              <p className="text-sm text-destructive">Secret inválido — verifique se é um código Base32 válido</p>
            )}
          </CardContent>
        </Card>

        {savedSecrets.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <RefreshCw className="size-4" />
                Secrets Salvos ({savedSecrets.length})
              </h2>
              <p className="text-xs text-muted-foreground">Salvos localmente no navegador</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {savedSecrets.map((s) => (
                <TOTPCard key={s.id} secret={s.secret} label={s.label} onRemove={() => handleRemove(s.id)} />
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Tudo roda no seu navegador. Nenhum dado é enviado a servidores.
        </p>
      </div>
    </div>
  );
}
