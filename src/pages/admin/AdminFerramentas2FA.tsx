import { useState, useEffect, useCallback } from "react";
import * as OTPAuth from "otpauth";
import { Copy, CheckCircle, ShieldCheck, RefreshCw, Trash2, Plus, Clock } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface SavedSecret {
  id: string;
  label: string;
  secret: string;
}

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

export default function AdminFerramentas2FA() {
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

  // Quick generate (without saving)
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
    if (!clean) {
      toast.error("Insira um secret válido");
      return;
    }
    const test = generateTOTP(clean);
    if (!test) {
      toast.error("Secret inválido — verifique o formato Base32");
      return;
    }
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
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" />
          Gerador 2FA (TOTP)
        </h1>
        <p className="text-sm text-muted-foreground">
          Cole o secret Base32 para gerar códigos de autenticação em dois fatores (compatível com Facebook, Google, etc.)
        </p>
      </div>

      {/* Quick Generator */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Gerar código rápido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Cole o 2FA Secret (Base32) aqui..."
              value={secretInput}
              onChange={(e) => setSecretInput(e.target.value)}
              className="flex-1 font-mono text-sm"
            />
            <Input
              placeholder="Nome (opcional)"
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              className="sm:w-48"
            />
          </div>

          {quickResult && (
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
              <div
                className="text-3xl font-mono font-bold tracking-[0.3em] cursor-pointer select-all"
                onClick={handleCopyQuick}
              >
                {quickResult.code.slice(0, 3)} {quickResult.code.slice(3)}
              </div>
              <div className="flex-1">
                <Progress
                  value={(quickResult.remaining / quickResult.period) * 100}
                  className={`h-1.5 ${quickResult.remaining <= 5 ? "[&>div]:bg-destructive" : "[&>div]:bg-primary"}`}
                />
                <span className="text-xs text-muted-foreground font-mono">{quickResult.remaining}s</span>
              </div>
              <div className="flex gap-1">
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

      {/* Saved Secrets */}
      {savedSecrets.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <RefreshCw className="size-4" />
              Secrets Salvos ({savedSecrets.length})
            </h2>
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
