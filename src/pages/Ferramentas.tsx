import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, CheckCircle, Trash2, Plus, Loader2, Search, ArrowLeft, Construction } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { generateTOTP, sanitizeTOTPInput, syncTOTPTimeOffset } from "@/lib/totp";

// ============= Material Icon helper =============
function MaterialIcon({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

interface SavedSecret { id: string; label: string; secret: string; }

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
    <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
      Secret inválido: {label}
    </div>
  );

  const pct = (result.remaining / result.period) * 100;
  const urgent = result.remaining <= 5;

  return (
    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:border-primary/30 transition-all">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-white truncate max-w-[60%]">{label}</span>
        {onRemove && (
          <button onClick={onRemove} className="p-1.5 rounded-md hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors">
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button onClick={handleCopy} className={`text-3xl font-mono font-bold tracking-[0.3em] transition-colors cursor-pointer ${urgent ? "text-red-500 animate-pulse" : "text-white"}`}>
          {result.code.slice(0, 3)} {result.code.slice(3)}
        </button>
        <button onClick={handleCopy} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
          {copied ? <CheckCircle className="size-4 text-emerald-400" /> : <Copy className="size-4 text-slate-400" />}
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Progress value={pct} className={`h-1 flex-1 ${urgent ? "[&>div]:bg-red-500" : "[&>div]:bg-primary"}`} />
        <span className={`text-xs font-mono ${urgent ? "text-red-500" : "text-slate-400"}`}>{result.remaining}s</span>
      </div>
    </div>
  );
}

// ============= Profile Checker types =============
interface ProfileResult { url: string; status: "active" | "blocked" | "uncertain" | "error"; message?: string; }

// ============= STYLES (matching the reference) =============
const glassCardStyle: React.CSSProperties = {
  background: "rgba(255, 255, 255, 0.03)",
  backdropFilter: "blur(12px)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  position: "relative",
  overflow: "hidden",
};

const cardBgImageStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "cover",
  opacity: 0.15,
  mixBlendMode: "luminosity",
  transition: "opacity 0.3s ease, transform 0.3s ease",
  zIndex: 0,
};

// Background images from the reference
import safeBmVaultImg from "@/assets/safe-bm-vault.png";

const BG_IMAGES = {
  "2fa": "https://lh3.googleusercontent.com/aida-public/AB6AXuD3zhUhWINVhFwGZm73Govuh_Mi66RHOPwByHTVCEnRiHKlVQtudOW4Co7xQblP0yPqr02nVU8Db-YOKscKekN27WgCOsn0R3dBCrZAQS-1n4qvyfnp1gVBZRbWys11W3e_1KX020BIaigWliTKGNqACWddmpcIElnjOZPFLRrEGP9ELlvn0jDGUBmJO0ne9x117bycNBi-7QYJRwke6fBndvXMmJJB0roM7rzLBdi3ZB1eM-5Fp6VR5I4OlpMXkIvxEb1mgWQItmg",
  emissor: "https://lh3.googleusercontent.com/aida-public/AB6AXuDCWyvZL0dbnMNbC9Lm8fzg5sGni28VSu_I5jjSSdgyY_muGVIigRe4ztfuLVi0hWoLGmeCc8dBvoFR0OfkIWZLPnQL2nJtGaAcUxOHXVITE9qtQa95xyD9P0_TW9sj3TzDBU8AzrD-6Xv27tniLdHsvFDHMspIKN41VZb0biZR6EuGVT5G6IaWbZmCA9KViOqrPV-cc6YyxbMOxPLldGio5aWHEiTHpTVxYt5zAYqV_gMcLzVqo5oekZGPFD33SnTK-OpOca3HvNg",
  verificador: "https://lh3.googleusercontent.com/aida-public/AB6AXuALX2sCdvZRoXjIpVH3eyovVJUXYK-Q2CxW0VNq5Zgbm3GqLRPnT3DVmfTJGKswZbfoJvNsHkx9mRmS-TWMqpi_OVeaWGsSseYC8TnOnnw8ffMOb87pL-2Y5Y7OckO-IVmCrlEO97HkyrkDsV8DCUCSCXnJtxaCdZbSz4pxpO_KQc36d6RoGzSl2oC7Eijk7suxTtCgL1DFrwiBWQnac25DCdEHaI8Q3qx2eUos4Xb4ki65FEIpWl9Fqjy_3K7qSOHFk30P4QR6T4E",
  safebm: safeBmVaultImg,
};

// ============= RECENT ACTIVITIES =============
function RecentActivities() {
  const [activities, setActivities] = useState<{ icon: string; iconColor: string; iconBg: string; title: string; subtitle: string; time: string }[]>([]);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const items: typeof activities = [];

      // Recent orders
      const { data: orders } = await supabase
        .from("orders")
        .select("code, status, total, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(3);

      orders?.forEach((o) => {
        const statusMap: Record<string, { icon: string; color: string; bg: string; label: string }> = {
          completed: { icon: "check_circle", color: "text-emerald-400", bg: "bg-emerald-500/20", label: "Pedido Concluído" },
          pending: { icon: "hourglass_top", color: "text-yellow-400", bg: "bg-yellow-500/20", label: "Pedido Pendente" },
          processing: { icon: "sync", color: "text-blue-400", bg: "bg-blue-500/20", label: "Pedido em Processamento" },
        };
        const s = statusMap[o.status] || { icon: "receipt_long", color: "text-primary", bg: "bg-primary/20", label: `Pedido ${o.status}` };
        items.push({
          icon: s.icon,
          iconColor: s.color,
          iconBg: s.bg,
          title: s.label,
          subtitle: `#${o.code} • R$ ${Number(o.total).toFixed(2)}`,
          time: o.created_at,
        });
      });

      // Recent wallet transactions
      const { data: txns } = await supabase
        .from("wallet_transactions")
        .select("title, type, amount, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(3);

      txns?.forEach((t) => {
        const isCredit = t.type === "credit";
        items.push({
          icon: isCredit ? "account_balance_wallet" : "payments",
          iconColor: isCredit ? "text-emerald-400" : "text-primary",
          iconBg: isCredit ? "bg-emerald-500/20" : "bg-primary/20",
          title: t.title,
          subtitle: `${isCredit ? "+" : "-"} R$ ${Math.abs(Number(t.amount)).toFixed(2)}`,
          time: t.created_at,
        });
      });

      // Sort by time descending, take top 5
      items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      setActivities(items.slice(0, 5));
    }
    load();
  }, []);

  const formatTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Agora";
    if (mins < 60) return `Há ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Há ${hours}h`;
    const days = Math.floor(hours / 24);
    return `Há ${days}d`;
  };

  return (
    <section className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-3 px-2">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <MaterialIcon name="history" className="text-primary text-xl" />
          Atividades Recentes
        </h2>
      </div>
      <div className="rounded-xl overflow-hidden divide-y divide-white/5" style={glassCardStyle}>
        {activities.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma atividade recente</div>
        ) : (
          activities.map((a, i) => (
            <div key={i} className="flex items-center gap-3 p-3 hover:bg-white/5 transition-colors relative z-10">
              <div className={`w-9 h-9 rounded-lg ${a.iconBg} ${a.iconColor} flex items-center justify-center shrink-0`}>
                <MaterialIcon name={a.icon} className="text-lg" />
              </div>
              <div className="flex-grow min-w-0">
                <p className="font-bold text-foreground text-sm">{a.title}</p>
                <p className="text-xs text-muted-foreground">{a.subtitle}</p>
              </div>
              <p className="text-[10px] font-semibold text-muted-foreground shrink-0">{formatTime(a.time)}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

type ToolId = "2fa" | "verificador";

// ============= GLASS CARD COMPONENT =============
function GlassCard({
  children,
  bgImage,
  onClick,
  className = "",
  disabled = false,
}: {
  children: React.ReactNode;
  bgImage: string;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className={`p-5 rounded-xl flex flex-col group h-full ${disabled ? "cursor-not-allowed" : "cursor-pointer"} ${className}`}
      style={{
        ...glassCardStyle,
        ...(hovered && !disabled
          ? {
              background: "rgba(255, 255, 255, 0.06)",
              borderColor: "rgba(249, 6, 6, 0.4)",
              transform: "translateY(-4px)",
              boxShadow: "0 0 25px rgba(249, 6, 6, 0.15)",
            }
          : {}),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={disabled ? undefined : onClick}
    >
      <img
        alt=""
        src={bgImage}
        style={{
          ...cardBgImageStyle,
          ...(hovered ? { opacity: 0.25, transform: "scale(1.05)" } : {}),
        }}
      />
      <div className="relative z-10 flex flex-col h-full">{children}</div>
    </div>
  );
}

// ============= MAIN PAGE =============
export default function Ferramentas() {
  const navigate = useNavigate();
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);

  if (activeTool === "2fa") return <TwoFATool onBack={() => setActiveTool(null)} />;
  if (activeTool === "verificador") return <VerificadorTool onBack={() => setActiveTool(null)} />;

  return (
    <div className="relative overflow-hidden pt-4 pb-6 px-4 sm:px-6 lg:px-12">
      {/* Background Accents */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full -z-10 pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full" />
      </div>

      <main className="max-w-6xl mx-auto">
        {/* Header Section */}
        <header className="text-center mb-6">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2 text-white">
            Central de <span className="text-primary">Ferramentas</span>
          </h1>
          <p className="text-sm text-slate-400 max-w-xl mx-auto font-medium">
            Otimize seu fluxo de trabalho com nossas ferramentas exclusivas de alta performance.
          </p>
        </header>

        {/* Tools Grid - 4 columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Tool 1: Gerador de 2FA */}
          <GlassCard bgImage={BG_IMAGES["2fa"]} onClick={() => setActiveTool("2fa")}>
            <div className="w-11 h-11 bg-primary/10 text-primary rounded-lg flex items-center justify-center mb-3 group-hover:bg-primary group-hover:text-white transition-colors duration-300">
              <MaterialIcon name="security" className="text-2xl" />
            </div>
            <h3 className="text-base font-bold mb-1.5 text-white">Gerador de 2FA</h3>
            <p className="text-slate-400 mb-4 flex-grow leading-relaxed text-xs">
              Gere códigos de autenticação de dois fatores instantaneamente com segurança máxima.
            </p>
            <button className="w-full py-2.5 px-4 bg-primary hover:bg-red-700 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 text-sm group/btn">
              <span>Acessar Ferramenta</span>
              <MaterialIcon name="arrow_forward" className="text-lg group-hover/btn:translate-x-1 transition-transform" />
            </button>
          </GlassCard>

          {/* Tool 2: Emissor de Documentos (Em Desenvolvimento) */}
          <GlassCard bgImage={BG_IMAGES.emissor} disabled>
            <div className="w-11 h-11 bg-primary/10 text-primary rounded-lg flex items-center justify-center mb-3">
              <MaterialIcon name="article" className="text-2xl" />
            </div>
            <h3 className="text-base font-bold mb-1.5 text-white">Emissor de Documentos</h3>
            <div className="mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-[10px] font-semibold border border-yellow-500/30">
                <Construction className="size-2.5" />
                Em Desenvolvimento
              </span>
            </div>
            <p className="text-slate-400 mb-4 flex-grow leading-relaxed text-xs">
              Crie documentos personalizados em segundos para verificação de perfis e contas business.
            </p>
            <button
              disabled
              className="w-full py-2.5 px-4 bg-slate-700/50 text-slate-500 font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-not-allowed text-sm"
            >
              <span>Em Breve</span>
              <MaterialIcon name="arrow_forward" className="text-lg" />
            </button>
          </GlassCard>

          {/* Tool 3: Verificador de Perfis */}
          <GlassCard bgImage={BG_IMAGES.verificador} onClick={() => setActiveTool("verificador")}>
            <div className="w-11 h-11 bg-primary/10 text-primary rounded-lg flex items-center justify-center mb-3 group-hover:bg-primary group-hover:text-white transition-colors duration-300">
              <MaterialIcon name="how_to_reg" className="text-2xl" />
            </div>
            <h3 className="text-base font-bold mb-1.5 text-white">Verificador de Perfis</h3>
            <p className="text-slate-400 mb-4 flex-grow leading-relaxed text-xs">
              Verifique o status de múltiplas contas simultaneamente e identifique restrições em tempo real.
            </p>
            <button className="w-full py-2.5 px-4 bg-primary hover:bg-red-700 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 text-sm group/btn">
              <span>Acessar Ferramenta</span>
              <MaterialIcon name="arrow_forward" className="text-lg group-hover/btn:translate-x-1 transition-transform" />
            </button>
          </GlassCard>

          {/* Tool 4: BM Safe */}
          <GlassCard bgImage={BG_IMAGES.safebm} onClick={() => navigate("/safe-bm")}>
            <div className="w-11 h-11 bg-primary/10 text-primary rounded-lg flex items-center justify-center mb-3 group-hover:bg-primary group-hover:text-white transition-colors duration-300">
              <MaterialIcon name="shield_lock" className="text-2xl" />
            </div>
            <h3 className="text-base font-bold mb-1.5 text-white">BM Safe</h3>
            <p className="text-slate-400 mb-4 flex-grow leading-relaxed text-xs">
              Cofre digital para suas Business Managers. Proteja seus ativos com backup seguro e monitoramento 24/7.
            </p>
            <button
              onClick={(e) => { e.stopPropagation(); navigate("/checkout?product=e5118c63-ed52-4f4e-8983-f44c1ba0d17b&qty=1"); }}
              className="w-full py-2.5 px-4 bg-primary hover:bg-red-700 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 text-sm group/btn"
            >
              <span>Ativar Agora</span>
              <MaterialIcon name="arrow_forward" className="text-lg group-hover/btn:translate-x-1 transition-transform" />
            </button>
          </GlassCard>
        </div>

        {/* Recent Activity Section */}
        <RecentActivities />
      </main>

      <footer className="mt-6 text-center border-t border-white/5 pt-4">
        <p className="text-xs text-slate-500 font-medium">
          © 2026 FBFLIX 2.0 • Sistema de Gestão de Contingência Profissional
        </p>
      </footer>
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

  useEffect(() => {
    void syncTOTPTimeOffset();
  }, []);

  const save = (list: SavedSecret[]) => {
    setSecrets(list);
    localStorage.setItem("fbflix-2fa-secrets", JSON.stringify(list));
  };

  const addSecret = () => {
    const sanitizedInput = sanitizeTOTPInput(newSecret);
    const trimLabel = newLabel.trim() || `Secret ${secrets.length + 1}`;
    if (!sanitizedInput) { toast.error("Cole o secret TOTP"); return; }
    const test = generateTOTP(sanitizedInput);
    if (!test) { toast.error("Secret Base32 ou URI otpauth inválido"); return; }
    save([...secrets, { id: crypto.randomUUID(), label: trimLabel, secret: sanitizedInput }]);
    setNewLabel("");
    setNewSecret("");
    toast.success("Secret adicionado!");
  };

  return (
    <div className="relative overflow-hidden pt-8 pb-24 px-4 sm:px-8 lg:px-20">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full -z-10 pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full" />
      </div>
      <div className="max-w-2xl mx-auto">
        <button
          onClick={onBack}
          className="mb-8 text-sm text-slate-400 hover:text-white flex items-center gap-2 transition-colors"
        >
          <ArrowLeft className="size-4" />
          Voltar às ferramentas
        </button>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
            <MaterialIcon name="security" className="text-3xl" />
          </div>
          <h2 className="text-2xl font-bold text-white">Gerador de 2FA</h2>
        </div>

        {/* Add new */}
        <div className="p-5 rounded-xl mb-6 space-y-3" style={glassCardStyle}>
          <div className="relative z-10 space-y-3">
            <Input
              placeholder="Nome / Label (opcional)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="bg-white/5 border-white/10"
            />
            <Input
              placeholder="Cole o Secret TOTP (Base32)"
              value={newSecret}
              onChange={(e) => setNewSecret(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSecret()}
              className="bg-white/5 border-white/10"
            />
            <button
              onClick={addSecret}
              className="w-full py-3 px-6 bg-primary hover:bg-red-700 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2"
            >
              <Plus className="size-4" />
              Adicionar
            </button>
          </div>
        </div>

        {/* Saved secrets */}
        <div className="space-y-3">
          {secrets.length === 0 && (
            <p className="text-center text-slate-500 py-8 text-sm">
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
    </div>
  );
}

// ============= VERIFICADOR TOOL =============
function VerificadorTool({ onBack }: { onBack: () => void }) {
  const [urls, setUrls] = useState("");
  const [results, setResults] = useState<ProfileResult[]>([]);
  const [loading, setLoading] = useState(false);

  const checkProfiles = async () => {
    const lines = urls.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("http"));
    if (!lines.length) { toast.error("Cole pelo menos uma URL de perfil"); return; }
    if (lines.length > 20) { toast.error("Máximo de 20 URLs por vez"); return; }

    setLoading(true);
    setResults([]);
    try {
      const { data, error } = await supabase.functions.invoke("check-fb-profile", { body: { urls: lines } });
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
      case "active": return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Ativo</Badge>;
      case "blocked": return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Bloqueado</Badge>;
      case "uncertain": return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Incerto</Badge>;
      default: return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">Erro</Badge>;
    }
  };

  return (
    <div className="relative overflow-hidden pt-8 pb-24 px-4 sm:px-8 lg:px-20">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full -z-10 pointer-events-none opacity-20">
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full" />
      </div>
      <div className="max-w-2xl mx-auto">
        <button
          onClick={onBack}
          className="mb-8 text-sm text-slate-400 hover:text-white flex items-center gap-2 transition-colors"
        >
          <ArrowLeft className="size-4" />
          Voltar às ferramentas
        </button>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
            <MaterialIcon name="how_to_reg" className="text-3xl" />
          </div>
          <h2 className="text-2xl font-bold text-white">Verificador de Perfis</h2>
        </div>

        <div className="p-5 rounded-xl mb-6 space-y-3" style={glassCardStyle}>
          <div className="relative z-10 space-y-3">
            <Textarea
              placeholder={"Cole as URLs dos perfis (uma por linha, máx 20)\nhttps://facebook.com/profile..."}
              rows={6}
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              className="bg-white/5 border-white/10"
            />
            <button
              onClick={checkProfiles}
              disabled={loading}
              className="w-full py-3 px-6 bg-primary hover:bg-red-700 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              {loading ? "Verificando..." : "Verificar Perfis"}
            </button>
          </div>
        </div>

        {results.length > 0 && (
          <div className="rounded-xl overflow-hidden divide-y divide-white/5" style={glassCardStyle}>
            {results.map((r, i) => (
              <div key={i} className="flex items-center gap-3 p-4 relative z-10">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{r.url}</p>
                  {r.message && <p className="text-xs text-slate-400 mt-0.5">{r.message}</p>}
                </div>
                {getStatusBadge(r.status)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
