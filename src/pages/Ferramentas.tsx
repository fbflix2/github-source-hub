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

// ============= TOOLS INFO BANNER =============
function ToolsInfoBanner({ hasSafeBm }: { hasSafeBm: boolean }) {
  const navigate = useNavigate();

  const tools = [
    { icon: "security", name: "Gerador 2FA", desc: "Códigos TOTP instantâneos para proteger suas contas." },
    { icon: "how_to_reg", name: "Verificador de Perfis", desc: "Cheque o status de múltiplas contas em segundos." },
    { icon: "article", name: "Emissor de Documentos", desc: "Documentos personalizados para verificação de contas." },
  ];

  return (
    <section className="max-w-4xl mx-auto space-y-4">
      {/* BM Safe Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-[#0a1a12] via-[#0f1f18] to-[#0a0e13] p-6">
        <div className="absolute -right-20 -top-20 w-72 h-72 bg-emerald-500/8 blur-[100px] rounded-full" />
        <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-emerald-400/5 blur-[80px] rounded-full" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <MaterialIcon name="shield_lock" className="text-3xl text-emerald-400" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-black text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                BM Safe — Cofre Digital
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[9px] font-bold uppercase tracking-wider">
                Popular
              </span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed mb-3">
              Proteja suas Business Managers com backup criptografado, monitoramento em tempo real e regeneração segura de links de acesso. Blindagem completa contra phishing e acessos não autorizados.
            </p>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-1">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="w-5 h-5 rounded-full bg-emerald-500/30 border border-emerald-500/50 flex items-center justify-center">
                      <MaterialIcon name="person" className="!text-[10px] text-emerald-300" />
                    </div>
                  ))}
                </div>
                <span className="text-xs text-emerald-400 font-bold">85% dos anunciantes usam</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MaterialIcon name="verified" className="!text-sm text-emerald-400" />
                <span className="text-[11px] text-slate-500">Monitoramento 24/7</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MaterialIcon name="lock" className="!text-sm text-emerald-400" />
                <span className="text-[11px] text-slate-500">Criptografia AES-256</span>
              </div>
            </div>
          </div>

          {!hasSafeBm && (
            <button
              onClick={() => navigate("/checkout?product=e5118c63-ed52-4f4e-8983-f44c1ba0d17b&qty=1")}
              className="shrink-0 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all flex items-center gap-2 text-sm shadow-lg shadow-emerald-600/20 hover:shadow-emerald-500/30"
            >
              <MaterialIcon name="shield_lock" className="!text-lg" />
              Ativar BM Safe
            </button>
          )}
          {hasSafeBm && (
            <button
              onClick={() => navigate("/safe-bm")}
              className="shrink-0 px-6 py-3 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl transition-all flex items-center gap-2 text-sm border border-white/10"
            >
              <MaterialIcon name="open_in_new" className="!text-lg" />
              Acessar Cofre
            </button>
          )}
        </div>
      </div>

      {/* Other Tools Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {tools.map(t => (
          <div key={t.name} className="rounded-xl p-4 flex items-start gap-3" style={glassCardStyle}>
            <div className="relative z-10 w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <MaterialIcon name={t.icon} className="text-lg" />
            </div>
            <div className="relative z-10">
              <h4 className="text-sm font-bold text-white mb-0.5">{t.name}</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">{t.desc}</p>
            </div>
          </div>
        ))}
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
  const [hasSafeBm, setHasSafeBm] = useState(false);

  useEffect(() => {
    async function checkSafeBm() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("safe_bm_vaults")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1);
      if (data && data.length > 0) setHasSafeBm(true);
    }
    checkSafeBm();
  }, []);

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
          <GlassCard bgImage={BG_IMAGES.safebm} onClick={() => navigate(hasSafeBm ? "/safe-bm" : "/saiba-mais-safebm")}>
            <div className="w-11 h-11 bg-primary/10 text-primary rounded-lg flex items-center justify-center mb-3 group-hover:bg-primary group-hover:text-white transition-colors duration-300">
              <MaterialIcon name="shield_lock" className="text-2xl" />
            </div>
            <h3 className="text-base font-bold mb-1.5 text-white">BM Safe</h3>
            <p className="text-slate-400 mb-4 flex-grow leading-relaxed text-xs">
              Cofre digital para suas Business Managers. Proteja seus ativos com backup seguro e monitoramento 24/7.
            </p>
            {hasSafeBm ? (
              <button
                onClick={(e) => { e.stopPropagation(); navigate("/safe-bm"); }}
                className="w-full py-2.5 px-4 bg-primary hover:bg-red-700 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 text-sm group/btn"
              >
                <span>Acessar Ferramenta</span>
                <MaterialIcon name="arrow_forward" className="text-lg group-hover/btn:translate-x-1 transition-transform" />
              </button>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); navigate("/checkout?product=e5118c63-ed52-4f4e-8983-f44c1ba0d17b&qty=1"); }}
                className="w-full py-2.5 px-4 bg-primary hover:bg-red-700 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 text-sm group/btn"
              >
                <span>Ativar Agora</span>
                <MaterialIcon name="arrow_forward" className="text-lg group-hover/btn:translate-x-1 transition-transform" />
              </button>
            )}
          </GlassCard>
        </div>

        {/* Recent Activity Section */}
        <ToolsInfoBanner hasSafeBm={hasSafeBm} />
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
