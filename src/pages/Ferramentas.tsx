import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, CheckCircle, Trash2, Plus, Loader2, Search, ArrowLeft, Construction, Upload, Download, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { generateTOTP, sanitizeTOTPInput, syncTOTPTimeOffset } from "@/lib/totp";

// ============= Material Icon helper =============
function MaterialIcon({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

interface SavedSecret { id: string; label: string; secret: string; }

// ============= Constants for Document Emitter =============
const SETTINGS_KEY = "imageviewer_base_template_url";
const DOC_IDENTIDADE_KEY = "imageviewer_doc_identidade";
const DEFAULT_DOC_IDENTIDADE = "503234175 SSPSP";
const DEFAULT_PHOTO = { xPct: 19.94, yPct: 21.0, wPct: 22.59, hPct: 22.25 };
const FIXED_DOC_IDENTIDADE_POSITION = { xPct: 45.3, yPct: 27.0 };
const DEFAULT_TEXT = {
  nome: { xPct: 22.01, yPct: 16.2 },
  docIdentidade: FIXED_DOC_IDENTIDADE_POSITION,
  nascimento: { xPct: 45.57, yPct: 19.8 },
  filiacao: { xPct: 49.71, yPct: 40.31 },
  assinatura: { xPct: 25.0, yPct: 43.61 },
};
const FIXED_DOC_IDENTIDADE_FONT_SIZE = 8.5;
const DEFAULT_FONT_SIZES = {
  nome: 8.5,
  docIdentidade: FIXED_DOC_IDENTIDADE_FONT_SIZE,
  nascimento: 8,
  filiacao: 8,
  assinatura: 10.5,
};
const SIGNATURE_FONTS = ["Dancing Script", "Caveat", "Satisfy"];
const NOMES_MASCULINOS = [
  "José", "Carlos", "Antonio", "Francisco", "João", "Pedro", "Paulo", "Luiz",
  "Roberto", "Marcos", "Sebastião", "Manoel", "Geraldo", "Jorge", "Fernando",
  "Edson", "Márcio", "Ricardo", "Cláudio", "Valdir", "Nelson", "Ademir",
  "Arnaldo", "Benedito", "Nilton", "Reginaldo", "Sergio", "Wagner", "Adilson",
  "Osvaldo", "Reinaldo", "Alcides", "Djalma", "Humberto", "Laércio",
];

const NOMES_FEMININOS = [
  "Maria", "Ana", "Francisca", "Antonia", "Adriana", "Aparecida", "Sandra",
  "Lúcia", "Marta", "Neusa", "Rosângela", "Cleusa", "Vera", "Sueli", "Marisa",
  "Terezinha", "Iolanda", "Sônia", "Elza", "Dalva", "Ivone", "Iracema",
  "Neuza", "Marlene", "Conceição", "Josefa", "Raimunda", "Helena", "Célia",
  "Nilza", "Fátima", "Luzia", "Valdete", "Solange", "Edna",
];

function extractSobrenome(nomeCompleto: string): string {
  const parts = nomeCompleto.trim().split(/\s+/);
  if (parts.length <= 1) return "";
  return parts.slice(1).join(" ");
}

function gerarNomePai(sobrenome: string): string {
  return `${pickRandom(NOMES_MASCULINOS)} ${sobrenome}`.toUpperCase();
}

function gerarNomeMae(sobrenome: string): string {
  return `${pickRandom(NOMES_FEMININOS)} ${sobrenome}`.toUpperCase();
}

function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

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

import safeBmVaultImg from "@/assets/safe-bm-vault.png";

const BG_IMAGES = {
  "2fa": "https://lh3.googleusercontent.com/aida-public/AB6AXuD3zhUhWINVhFwGZm73Govuh_Mi66RHOPwByHTVCEnRiHKlVQtudOW4Co7xQblP0yPqr02nVU8Db-YOKscKekN27WgCOsn0R3dBCrZAQS-1n4qvyfnp1gVBZRbWys11W3e_1KX020BIaigWliTKGNqACWddmpcIElnjOZPFLRrEGP9ELlvn0jDGUBmJO0ne9x117bycNBi-7QYJRwke6fBndvXMmJJB0roM7rzLBdi3ZB1eM-5Fp6VR5I4OlpMXkIvxEb1mgWQItmg",
  emissor: "https://lh3.googleusercontent.com/aida-public/AB6AXuDCWyvZL0dbnMNbC9Lm8fzg5sGni28VSu_I5jjSSdgyY_muGVIigRe4ztfuLVi0hWoLGmeCc8dBvoFR0OfkIWZLPnQL2nJtGaAcUxOHXVITE9qtQa95xyD9P0_TW9sj3TzDBU8AzrD-6Xv27tniLdHsvFDHMspIKN41VZb0biZR6EuGVT5G6IaWbZmCA9KViOqrPV-cc6YyxbMOxPLldGio5aWHEiTHpTVxYt5zAYqV_gMcLzVqo5oekZGPFD33SnTK-OpOca3HvNg",
  verificador: "https://lh3.googleusercontent.com/aida-public/AB6AXuALX2sCdvZRoXjIpVH3eyovVJUXYK-Q2CxW0VNq5Zgbm3GqLRPnT3DVmfTJGKswZbfoJvNsHkx9mRmS-TWMqpi_OVeaWGsSseYC8TnOnnw8ffMOb87pL-2Y5Y7OckO-IVmCrlEO97HkyrkDsV8DCUCSCXnJtxaCdZbSz4pxpO_KQc36d6RoGzSl2oC7Eijk7suxTtCgL1DFrwiBWQnac25DCdEHaI8Q3qx2eUos4Xb4ki65FEIpWl9Fqjy_3K7qSOHFk30P4QR6T4E",
  safebm: safeBmVaultImg,
};

type ToolId = "2fa" | "verificador" | "emissor";

interface ProfileResult { url: string; status: "active" | "blocked" | "uncertain" | "error"; message?: string; }

// ============= SUB-COMPONENTS =============

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

function ToolsInfoBanner({ hasSafeBm }: { hasSafeBm: boolean }) {
  const navigate = useNavigate();
  return (
    <section className="max-w-4xl mx-auto space-y-4">
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-[#0a1a12] via-[#0f1f18] to-[#0a0e13] p-6">
        <div className="absolute -right-20 -top-20 w-72 h-72 bg-emerald-500/8 blur-[100px] rounded-full" />
        <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-emerald-400/5 blur-[80px] rounded-full" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <MaterialIcon name="shield_lock" className="text-3xl text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-black text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>BM Safe — Cofre Digital</h3>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[9px] font-bold uppercase tracking-wider">Popular</span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed mb-3">Proteja suas Business Managers com backup criptografado e monitoramento 24/7.</p>
            <div className="flex items-center gap-4 flex-wrap">
               <div className="flex items-center gap-1.5"><MaterialIcon name="verified" className="!text-sm text-emerald-400" /><span className="text-[11px] text-slate-500">Monitoramento 24/7</span></div>
               <div className="flex items-center gap-1.5"><MaterialIcon name="lock" className="!text-sm text-emerald-400" /><span className="text-[11px] text-slate-500">AES-256</span></div>
            </div>
          </div>
          {!hasSafeBm ? (
            <button onClick={() => navigate("/checkout?product=e5118c63-ed52-4f4e-8983-f44c1ba0d17b&qty=1")} className="shrink-0 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all flex items-center gap-2 text-sm shadow-lg shadow-emerald-600/20 hover:shadow-emerald-500/30"><MaterialIcon name="shield_lock" className="!text-lg" />Ativar BM Safe</button>
          ) : (
            <button onClick={() => navigate("/safe-bm")} className="shrink-0 px-6 py-3 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl transition-all flex items-center gap-2 text-sm border border-white/10"><MaterialIcon name="open_in_new" className="!text-lg" />Acessar Cofre</button>
          )}
        </div>
      </div>
    </section>
  );
}

function GlassCard({ children, bgImage, onClick, className = "", disabled = false }: { children: React.ReactNode; bgImage: string; onClick?: () => void; className?: string; disabled?: boolean; }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className={`p-5 rounded-xl flex flex-col group h-full ${disabled ? "cursor-not-allowed" : "cursor-pointer"} ${className}`}
      style={{ ...glassCardStyle, ...(hovered && !disabled ? { background: "rgba(255, 255, 255, 0.06)", borderColor: "rgba(249, 6, 6, 0.4)", transform: "translateY(-4px)", boxShadow: "0 0 25px rgba(249, 6, 6, 0.15)" } : {}) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={disabled ? undefined : onClick}
    >
      <img alt="" src={bgImage} style={{ ...cardBgImageStyle, ...(hovered ? { opacity: 0.25, transform: "scale(1.05)" } : {}) }} />
      <div className="relative z-10 flex flex-col h-full">{children}</div>
    </div>
  );
}

// ============= TOOL COMPONENTS =============

function TwoFATool({ onBack }: { onBack: () => void }) {
  const [secrets, setSecrets] = useState<SavedSecret[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [newSecret, setNewSecret] = useState("");
  useEffect(() => { try { setSecrets(JSON.parse(localStorage.getItem("fbflix-2fa-secrets") || "[]")); } catch { setSecrets([]); } }, []);
  useEffect(() => { void syncTOTPTimeOffset(); }, []);
  const save = (list: SavedSecret[]) => { setSecrets(list); localStorage.setItem("fbflix-2fa-secrets", JSON.stringify(list)); };
  const addSecret = () => {
    const sanitizedInput = sanitizeTOTPInput(newSecret);
    const trimLabel = newLabel.trim() || `Secret ${secrets.length + 1}`;
    if (!sanitizedInput) { toast.error("Cole o secret TOTP"); return; }
    if (!generateTOTP(sanitizedInput)) { toast.error("Secret inválido"); return; }
    save([...secrets, { id: crypto.randomUUID(), label: trimLabel, secret: sanitizedInput }]);
    setNewLabel(""); setNewSecret(""); toast.success("Secret adicionado!");
  };
  return (
    <div className="relative overflow-hidden pt-8 pb-24 px-4 sm:px-8 lg:px-20">
      <div className="max-w-2xl mx-auto">
        <button onClick={onBack} className="mb-8 text-sm text-slate-400 hover:text-white flex items-center gap-2 transition-colors"><ArrowLeft className="size-4" />Voltar</button>
        <div className="flex items-center gap-3 mb-8"><div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center"><MaterialIcon name="security" className="text-3xl" /></div><h2 className="text-2xl font-bold text-white">Gerador de 2FA</h2></div>
        <div className="p-5 rounded-xl mb-6 space-y-3" style={glassCardStyle}>
          <div className="relative z-10 space-y-3">
            <Input placeholder="Nome / Label (opcional)" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} className="bg-white/5 border-white/10" />
            <Input placeholder="Cole o Secret TOTP" value={newSecret} onChange={(e) => setNewSecret(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSecret()} className="bg-white/5 border-white/10" />
            <button onClick={addSecret} className="w-full py-3 px-6 bg-primary hover:bg-red-700 text-white font-bold rounded-lg transition-all flex items-center gap-2"><Plus className="size-4" />Adicionar</button>
          </div>
        </div>
        <div className="space-y-3">{secrets.map((s) => (<TOTPDisplay key={s.id} secret={s.secret} label={s.label} onRemove={() => save(secrets.filter((x) => x.id !== s.id))} />))}</div>
      </div>
    </div>
  );
}

function VerificadorTool({ onBack }: { onBack: () => void }) {
  const [urls, setUrls] = useState("");
  const [results, setResults] = useState<ProfileResult[]>([]);
  const [loading, setLoading] = useState(false);
  const checkProfiles = async () => {
    const lines = urls.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("http"));
    if (!lines.length) { toast.error("Cole as URLs"); return; }
    setLoading(true); setResults([]);
    try {
      const { data, error } = await supabase.functions.invoke("check-fb-profile", { body: { urls: lines } });
      if (error) throw error;
      setResults(data?.results || []);
    } catch (err: any) { toast.error(err.message || "Erro"); } finally { setLoading(false); }
  };
  return (
    <div className="relative overflow-hidden pt-8 pb-24 px-4 sm:px-8 lg:px-20">
      <div className="max-w-2xl mx-auto">
        <button onClick={onBack} className="mb-8 text-sm text-slate-400 hover:text-white flex items-center gap-2 transition-colors"><ArrowLeft className="size-4" />Voltar</button>
        <div className="flex items-center gap-3 mb-8"><div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center"><MaterialIcon name="how_to_reg" className="text-3xl" /></div><h2 className="text-2xl font-bold text-white">Verificador de Perfis</h2></div>
        <div className="p-5 rounded-xl mb-6 space-y-3" style={glassCardStyle}>
          <Textarea placeholder={"URLs (uma por linha)"} rows={6} value={urls} onChange={(e) => setUrls(e.target.value)} className="bg-white/5 border-white/10" />
          <button onClick={checkProfiles} disabled={loading} className="w-full py-3 px-6 bg-primary hover:bg-red-700 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2">{loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}Verificar</button>
        </div>
        {results.length > 0 && (<div className="rounded-xl overflow-hidden divide-y divide-white/5" style={glassCardStyle}>{results.map((r, i) => (<div key={i} className="p-4 text-white text-sm relative z-10 flex justify-between"><span>{r.url}</span><span>{r.status}</span></div>))}</div>)}
      </div>
    </div>
  );
}

function EmissorTool({ onBack }: { onBack: () => void }) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [photoOverlay, setPhotoOverlay] = useState<string | null>(null);
  const [docIdentidade, setDocIdentidade] = useState(DEFAULT_DOC_IDENTIDADE);
  const [generating, setGenerating] = useState(false);
  const [formData, setFormData] = useState({ nomeCompleto: "", dataNascimento: "", naturalidade: "SÃO PAULO", uf: "SP", nomePai: "", nomeMae: "" });
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("site_settings").select("key, value").in("key", [SETTINGS_KEY, DOC_IDENTIDADE_KEY]);
      data?.forEach(r => { if (r.key === SETTINGS_KEY) setSelectedImage(r.value); if (r.key === DOC_IDENTIDADE_KEY) setDocIdentidade(r.value || DEFAULT_DOC_IDENTIDADE); });
    };
    load();
  }, []);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) { if (photoOverlay) URL.revokeObjectURL(photoOverlay); setPhotoOverlay(URL.createObjectURL(file)); }
  };

  const generate = async () => {
    if (!selectedImage) { toast.error("Template não configurado"); return; }
    setGenerating(true);
    try {
      const baseImg = new Image(); baseImg.crossOrigin = "anonymous"; baseImg.src = selectedImage;
      await new Promise(res => baseImg.onload = res);
      const canvas = document.createElement("canvas"); canvas.width = baseImg.naturalWidth; canvas.height = baseImg.naturalHeight;
      const ctx = canvas.getContext("2d")!; const W = canvas.width; const H = canvas.height; ctx.drawImage(baseImg, 0, 0);
      // Desenhar foto
      if (photoOverlay) {
        const pImg = new Image();
        pImg.src = photoOverlay;
        await new Promise(res => pImg.onload = res);
        const dx = (DEFAULT_PHOTO.xPct / 100) * W;
        const dy = (DEFAULT_PHOTO.yPct / 100) * H;
        const dw = (DEFAULT_PHOTO.wPct / 100) * W;
        const dh = (DEFAULT_PHOTO.hPct / 100) * H;

        const imgAspect = pImg.naturalWidth / pImg.naturalHeight;
        const destAspect = dw / dh;
        let sx, sy, sw, sh;
        if (imgAspect > destAspect) {
          sh = pImg.naturalHeight;
          sw = sh * destAspect;
          sx = (pImg.naturalWidth - sw) / 2;
          sy = 0;
        } else {
          sw = pImg.naturalWidth;
          sh = sw / destAspect;
          sx = 0;
          sy = (pImg.naturalHeight - sh) / 2;
        }
        ctx.drawImage(pImg, sx, sy, sw, sh, dx, dy, dw, dh);
      }

      ctx.textBaseline = "top";
      // Calibração de escala para corresponder EXATAMENTE ao AdminImageViewer.
      // Lá o scale = W / imgRect.w (largura exibida no navegador, ~600px CSS).
      // Os DEFAULT_FONT_SIZES (8.5, 8, etc.) são em CSS pixels naquela exibição.
      const scale = W / 600;

      const offset = (fs: number) => fs * 0.15;
      ctx.fillStyle = "rgba(0,0,0,0.9)"; // Mesma cor de preenchimento do visualizador

      if (formData.nomeCompleto) {
        const fs = DEFAULT_FONT_SIZES.nome * scale;
        ctx.font = `bold ${fs}px "Arial Narrow", Arial, sans-serif`; // Mesma fonte e peso
        ctx.letterSpacing = "0.05em";
        ctx.fillText(formData.nomeCompleto.toUpperCase(), (DEFAULT_TEXT.nome.xPct / 100) * W, (DEFAULT_TEXT.nome.yPct / 100) * H + offset(fs));
        ctx.letterSpacing = "0px";
      }

      if (formData.dataNascimento) {
        const fs = DEFAULT_FONT_SIZES.nascimento * scale;
        ctx.font = `600 ${fs}px "Arial Narrow", Arial, sans-serif`; // Mesma fonte e peso
        const dt = parseLocalDate(formData.dataNascimento).toLocaleDateString("pt-BR");
        ctx.fillText(`${dt} - ${formData.naturalidade} - ${formData.uf}`.toUpperCase(), (DEFAULT_TEXT.nascimento.xPct / 100) * W, (DEFAULT_TEXT.nascimento.yPct / 100) * H + offset(fs));
      }

      if (docIdentidade) {
        const fs = FIXED_DOC_IDENTIDADE_FONT_SIZE * scale;
        ctx.font = `600 ${fs}px "Arial Narrow", Arial, sans-serif`; // Mesma fonte e peso
        ctx.fillText(docIdentidade.toUpperCase(), (DEFAULT_TEXT.docIdentidade.xPct / 100) * W, (DEFAULT_TEXT.docIdentidade.yPct / 100) * H + offset(fs));
      }

      // Filiação
      const sobrenome = extractSobrenome(formData.nomeCompleto);
      const pai = formData.nomePai || gerarNomePai(sobrenome);
      const mae = formData.nomeMae || gerarNomeMae(sobrenome);

      if (pai || mae) {
        const fs = DEFAULT_FONT_SIZES.filiacao * scale;
        ctx.font = `600 ${fs}px "Arial Narrow", Arial, sans-serif`; // Mesma fonte e peso
        const x = (DEFAULT_TEXT.filiacao.xPct / 100) * W;
        let currY = (DEFAULT_TEXT.filiacao.yPct / 100) * H + offset(fs);
        if (pai) { ctx.fillText(pai.toUpperCase(), x, currY); currY += fs * 1.15; }
        if (mae) { ctx.fillText(mae.toUpperCase(), x, currY); }
      }

      // Assinatura
      if (formData.nomeCompleto) {
        const fs = DEFAULT_FONT_SIZES.assinatura * scale;
        ctx.font = `${fs}px "${SIGNATURE_FONTS[0]}", cursive`;
        ctx.fillStyle = "#1a1a8a";
        ctx.fillText(formData.nomeCompleto, (DEFAULT_TEXT.assinatura.xPct / 100) * W, (DEFAULT_TEXT.assinatura.yPct / 100) * H + offset(fs));
      }
      canvas.toBlob(blob => {
        if (blob) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "documento.png"; a.click(); toast.success("Sucesso!"); }
      });
    } catch { toast.error("Erro ao gerar"); } finally { setGenerating(false); }
  };

  return (
    <div className="relative overflow-hidden pt-8 pb-24 px-4 sm:px-8 lg:px-20">
      <div className="max-w-2xl mx-auto">
        <button onClick={onBack} className="mb-8 text-sm text-slate-400 hover:text-white flex items-center gap-2"><ArrowLeft className="size-4" />Voltar</button>
        <div className="flex items-center gap-3 mb-8"><div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center"><MaterialIcon name="article" className="text-3xl" /></div><h2 className="text-2xl font-bold text-white">Emissor de Documentos <Badge className="bg-blue-500/20 text-blue-400 ml-2">Beta</Badge></h2></div>
        <div className="p-6 rounded-xl space-y-6" style={glassCardStyle}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label className="text-slate-400 text-xs uppercase">Nome Completo</Label><Input value={formData.nomeCompleto} onChange={e => setFormData(p => ({ ...p, nomeCompleto: e.target.value }))} className="bg-white/5 border-white/10" placeholder="Ex: João da Silva" /></div>
            <div className="space-y-2"><Label className="text-slate-400 text-xs uppercase">Data de Nascimento</Label><Input type="date" value={formData.dataNascimento} onChange={e => setFormData(p => ({ ...p, dataNascimento: e.target.value }))} className="bg-white/5 border-white/10" /></div>
            <div className="space-y-2"><Label className="text-slate-400 text-xs uppercase">Cidade</Label><Input value={formData.naturalidade} onChange={e => setFormData(p => ({ ...p, naturalidade: e.target.value }))} className="bg-white/5 border-white/10" /></div>
            <div className="space-y-2"><Label className="text-slate-400 text-xs uppercase">UF</Label><Input value={formData.uf} onChange={e => setFormData(p => ({ ...p, uf: e.target.value }))} className="bg-white/5 border-white/10" /></div>
            <div className="space-y-2"><Label className="text-slate-400 text-xs uppercase">Nome do Pai (Opcional)</Label><Input value={formData.nomePai} onChange={e => setFormData(p => ({ ...p, nomePai: e.target.value }))} className="bg-white/5 border-white/10" /></div>
            <div className="space-y-2"><Label className="text-slate-400 text-xs uppercase">Nome da Mãe (Opcional)</Label><Input value={formData.nomeMae} onChange={e => setFormData(p => ({ ...p, nomeMae: e.target.value }))} className="bg-white/5 border-white/10" /></div>
          </div>
          <div className="border-2 border-dashed border-white/10 p-8 text-center cursor-pointer" onClick={() => photoInputRef.current?.click()}>
            {photoOverlay ? <img src={photoOverlay} className="w-24 h-24 mx-auto object-cover" /> : <p className="text-slate-400">Enviar Foto de Perfil</p>}
            <input type="file" ref={photoInputRef} hidden onChange={handlePhoto} />
          </div>
          <button onClick={generate} disabled={generating || !formData.nomeCompleto || !photoOverlay} className="w-full py-4 bg-primary text-white font-black rounded-xl">{generating ? "GERANDO..." : "GERAR E BAIXAR"}</button>
        </div>
        <div className="mt-6 p-5 rounded-xl border border-yellow-500/30 bg-yellow-500/5 text-xs text-slate-300 leading-relaxed space-y-2">
          <p className="font-bold text-yellow-400 uppercase tracking-wide text-[11px]">⚠️ Aviso Legal / Isenção de Responsabilidade</p>
          <p>O documento gerado por esta ferramenta é um <strong>mockup fictício</strong>, criado apenas como recurso técnico para abrir a possibilidade de uma <strong>revisão de conta</strong> junto ao Facebook. <strong>Não é um documento oficial</strong> e não possui qualquer validade jurídica, fiscal ou de identificação real.</p>
          <p>É <strong>crime</strong> utilizar documentos de terceiros ou falsificar documentos oficiais. Esta ferramenta <strong>não deve, em hipótese alguma</strong>, ser usada para fraudes, golpes, falsidade ideológica ou qualquer atividade ilícita. O uso indevido é de inteira responsabilidade do usuário.</p>
          <p>O envio do mockup ao Facebook apenas <strong>abre a possibilidade</strong> de uma análise da conta — quem decide se a conta será reativada é exclusivamente o Facebook. <strong>Não há garantia</strong> de retorno, aprovação ou reativação da conta.</p>
          <p className="text-slate-400">Ao utilizar esta ferramenta, você declara estar ciente e concorda com estes termos.</p>
        </div>
      </div>
    </div>
  );
}

// ============= MAIN PAGE =============
export default function Ferramentas() {
  const navigate = useNavigate();
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  const [hasSafeBm, setHasSafeBm] = useState(false);
  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
      const { data } = await supabase.from("safe_bm_vaults").select("id").eq("user_id", user.id).eq("status", "active").limit(1);
      if (data?.length) setHasSafeBm(true);
    }
    check();
  }, []);

  if (activeTool === "2fa") return <TwoFATool onBack={() => setActiveTool(null)} />;
  if (activeTool === "verificador") return <VerificadorTool onBack={() => setActiveTool(null)} />;
  if (activeTool === "emissor") return <EmissorTool onBack={() => setActiveTool(null)} />;

  return (
    <div className="relative overflow-hidden pt-4 pb-6 px-4 sm:px-6 lg:px-12">
      <main className="max-w-6xl mx-auto">
        <header className="text-center mb-6">
          <h1 className="text-3xl font-black text-white">Central de <span className="text-primary">Ferramentas</span></h1>
          <p className="text-sm text-slate-400">Otimize seu fluxo de trabalho.</p>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
           <GlassCard bgImage={BG_IMAGES["2fa"]} onClick={() => setActiveTool("2fa")}>
             <h3 className="text-base font-bold text-white">Gerador de 2FA</h3>
             <p className="text-slate-400 text-xs mt-2">Gere códigos de autenticação instantaneamente.</p>
           </GlassCard>
           <GlassCard bgImage={BG_IMAGES.emissor} onClick={() => setActiveTool("emissor")}>
             <h3 className="text-base font-bold text-white">Emissor de Documentos</h3>
             <Badge className="bg-blue-500/20 text-blue-400 w-fit mt-1">Beta</Badge>
             <p className="text-slate-400 text-xs mt-2">Crie documentos para verificação de perfis.</p>
           </GlassCard>
           <GlassCard bgImage={BG_IMAGES.verificador} disabled>
             <h3 className="text-base font-bold text-white">Verificador</h3>
             <Badge className="bg-yellow-500/20 text-yellow-400 w-fit mt-1">Em breve</Badge>
             <p className="text-slate-400 text-xs mt-2">Verifique o status de múltiplas contas.</p>
           </GlassCard>
           <GlassCard bgImage={BG_IMAGES.safebm} onClick={() => navigate("/safe-bm")}>
             <h3 className="text-base font-bold text-white">BM Safe</h3>
             <p className="text-slate-400 text-xs mt-2">Cofre digital para Business Managers.</p>
           </GlassCard>
           <GlassCard bgImage={BG_IMAGES["2fa"]} onClick={() => navigate("/esteira-aquecimento")}>
             <h3 className="text-base font-bold text-white">Esteira Aquecimento</h3>
             <p className="text-slate-400 text-xs mt-2">Aqueça seus perfis com tarefas guiadas.</p>
           </GlassCard>
        </div>
        <ToolsInfoBanner hasSafeBm={hasSafeBm} />
      </main>
    </div>
  );
}
