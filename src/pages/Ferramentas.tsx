import { useState, useEffect, useCallback } from "react";
import * as OTPAuth from "otpauth";
import { Shield, FileText, UserCheck, ArrowRight, Copy, CheckCircle, RefreshCw, Trash2, Plus, Clock, Loader2, AlertTriangle, XCircle, HelpCircle, Search, History, Key, Verified } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

// ============= 2FA TOTP =============

function generateTOTP(secret: string): { code: string; remaining: number; period: number } | null {
  try {
    const cleanSecret = secret.replace(/\s+/g, "").replace(/=+$/, "").toUpperCase();
    if (!/^[A-Z2-7]+$/.test(cleanSecret)) return null;
    const totp = new OTPAuth.TOTP({
      issuer: "FBFLIX",
      label: "2FA",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: cleanSecret,
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

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.code);
    setCopied(true);
    toast.success("Código copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (!result) return (
    <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
      Secret inválido: {label}
    </div>
  );

  const pct = (result.remaining / result.period) * 100;
  const urgent = result.remaining <= 5;

  return (
    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:border-primary/30 transition-all">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-foreground truncate max-w-[60%]">{label}</span>
        <div className="flex items-center gap-1">
          {onRemove && (
            <button onClick={onRemove} className="p-1.5 rounded-md hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors">
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={handleCopy}
          className={`text-3xl font-mono font-bold tracking-[0.3em] transition-colors cursor-pointer ${urgent ? "text-destructive animate-pulse" : "text-foreground"}`}
        >
          {result.code.slice(0, 3)} {result.code.slice(3)}
        </button>
        <button onClick={handleCopy} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
          {copied ? <CheckCircle className="size-4 text-green-400" /> : <Copy className="size-4 text-muted-foreground" />}
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Progress value={pct} className={`h-1 flex-1 ${urgent ? "[&>div]:bg-destructive" : "[&>div]:bg-primary"}`} />
        <span className={`text-xs font-mono ${urgent ? "text-destructive" : "text-muted-foreground"}`}>
          {result.remaining}s
        </span>
      </div>
    </div>
  );
}

// ============= Profile Checker =============

interface ProfileResult {
  url: string;
  status: "active" | "blocked" | "uncertain" | "error";
  message?: string;
}

// ============= TOOLS DATA =============

type ToolId = "2fa" | "verificador";

const tools = [
  {
    id: "2fa" as ToolId,
    title: "Gerador de 2FA",
    description: "Gere códigos de autenticação de dois fatores instantaneamente com segurança máxima.",
    icon: Shield,
  },
  {
    id: "verificador" as ToolId,
    title: "Verificador de Perfis",
    description: "Verifique o status de múltiplas contas simultaneamente e identifique restrições em tempo real.",
    icon: UserCheck,
  },
];

// ============= MAIN PAGE =============

export default function Ferramentas() {
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);

  if (activeTool === "2fa") return <TwoFATool onBack={() => setActiveTool(null)} />;
  if (activeTool === "verificador") return <VerificadorTool onBack={() => setActiveTool(null)} />;

  return (
    <div className="relative pt-8 pb-24 px-2 sm:px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <header className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4 text-foreground">
            Central de <span className="text-primary">Ferramentas</span>
          </h1>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto">
            Otimize seu fluxo de trabalho com nossas ferramentas exclusivas de alta performance para gestão de contingência.
          </p>
        </header>

        {/* Tools Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-16">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <div
                key={tool.id}
                className="group relative p-8 rounded-xl bg-white/[0.03] backdrop-blur-sm border border-white/[0.08] hover:bg-white/[0.06] hover:border-primary/40 hover:-translate-y-1 hover:shadow-[0_0_25px_rgba(var(--primary-rgb),0.15)] transition-all duration-300 flex flex-col cursor-pointer"
                onClick={() => setActiveTool(tool.id)}
              >
                <div className="w-14 h-14 bg-primary/10 text-primary rounded-xl flex items-center justify-center mb-5 group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                  <Icon className="size-7" />
                </div>
                <h3 className="text-xl font-bold mb-2 text-foreground">{tool.title}</h3>
                <p className="text-muted-foreground mb-6 flex-grow leading-relaxed text-sm">
                  {tool.description}
                </p>
                <Button className="w-full gap-2 font-bold" size="lg">
                  Acessar Ferramenta
                  <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============= 2FA TOOL =============

function TwoFATool({ onBack }: { onBack: () => void }) {
  const [secrets, setSecrets] = useState<SavedSecret[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [newSecret, setNewSecret] = useState("");

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("fbflix-2fa-secrets") || "[]");
      setSecrets(saved);
    } catch { setSecrets([]); }
  }, []);

  const save = (list: SavedSecret[]) => {
    setSecrets(list);
    localStorage.setItem("fbflix-2fa-secrets", JSON.stringify(list));
  };

  const addSecret = () => {
    const trimSecret = newSecret.trim();
    const trimLabel = newLabel.trim() || `Secret ${secrets.length + 1}`;
    if (!trimSecret) { toast.error("Cole o secret TOTP"); return; }
    const test = generateTOTP(trimSecret);
    if (!test) { toast.error("Secret Base32 inválido"); return; }
    save([...secrets, { id: crypto.randomUUID(), label: trimLabel, secret: trimSecret }]);
    setNewLabel("");
    setNewSecret("");
    toast.success("Secret adicionado!");
  };

  return (
    <div className="pt-8 pb-24 px-2 sm:px-4 max-w-2xl mx-auto">
      <button onClick={onBack} className="mb-6 text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
        ← Voltar às ferramentas
      </button>
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Shield className="size-6 text-primary" />
        Gerador de 2FA
      </h2>

      {/* Add new */}
      <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 mb-6 space-y-3">
        <Input
          placeholder="Nome / Label (opcional)"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
        />
        <Input
          placeholder="Cole o Secret TOTP (Base32)"
          value={newSecret}
          onChange={(e) => setNewSecret(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addSecret()}
        />
        <Button onClick={addSecret} className="w-full gap-2">
          <Plus className="size-4" /> Adicionar
        </Button>
      </div>

      {/* Saved secrets */}
      <div className="space-y-3">
        {secrets.length === 0 && (
          <p className="text-center text-muted-foreground py-8 text-sm">
            Nenhum secret salvo. Adicione acima para começar.
          </p>
        )}
        {secrets.map((s) => (
          <TOTPDisplay
            key={s.id}
            secret={s.secret}
            label={s.label}
            onRemove={() => {
              save(secrets.filter((x) => x.id !== s.id));
              toast.success("Removido!");
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ============= VERIFICADOR TOOL =============

function VerificadorTool({ onBack }: { onBack: () => void }) {
  const [urls, setUrls] = useState("");
  const [results, setResults] = useState<ProfileResult[]>([]);
  const [loading, setLoading] = useState(false);

  const checkProfiles = async () => {
    const lines = urls
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("http"));
    if (!lines.length) { toast.error("Cole pelo menos uma URL de perfil"); return; }
    if (lines.length > 20) { toast.error("Máximo de 20 URLs por vez"); return; }

    setLoading(true);
    setResults([]);
    try {
      const { data, error } = await supabase.functions.invoke("check-fb-profile", {
        body: { urls: lines },
      });
      if (error) throw error;
      setResults(data?.results || []);
      toast.success(`${data?.results?.length || 0} perfis verificados`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao verificar perfis");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Ativo</Badge>;
      case "blocked":
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Bloqueado</Badge>;
      case "uncertain":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Incerto</Badge>;
      default:
        return <Badge variant="outline">Erro</Badge>;
    }
  };

  return (
    <div className="pt-8 pb-24 px-2 sm:px-4 max-w-2xl mx-auto">
      <button onClick={onBack} className="mb-6 text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
        ← Voltar às ferramentas
      </button>
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <UserCheck className="size-6 text-primary" />
        Verificador de Perfis
      </h2>

      <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 mb-6 space-y-3">
        <Textarea
          placeholder={"Cole as URLs dos perfis (uma por linha, máx 20)\nhttps://facebook.com/profile..."}
          rows={6}
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
        />
        <Button onClick={checkProfiles} disabled={loading} className="w-full gap-2">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          {loading ? "Verificando..." : "Verificar Perfis"}
        </Button>
      </div>

      {results.length > 0 && (
        <div className="rounded-xl bg-white/[0.03] border border-white/10 overflow-hidden divide-y divide-white/5">
          {results.map((r, i) => (
            <div key={i} className="flex items-center gap-3 p-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">{r.url}</p>
                {r.message && <p className="text-xs text-muted-foreground mt-0.5">{r.message}</p>}
              </div>
              {getStatusBadge(r.status)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
