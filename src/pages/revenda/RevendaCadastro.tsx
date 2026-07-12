import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Building2,
  Mail,
  User,
  Phone,
  Lock,
  Loader2,
  ArrowRight,
  Check,
  Shield,
  Globe2,
  Lock as LockIcon,
  Network,
} from "lucide-react";
import { cn } from "@/lib/utils";
import logoFbflix from "@/assets/logo-fbflix.webp";
import { GlobePulse } from "@/components/ui/cobe-globe-pulse";
import brandLinkedin from "@/assets/brands/linkedin.svg";
import brandX from "@/assets/brands/x-twitter.svg";
import brandYoutube from "@/assets/brands/youtube.svg";
import brandTelegram from "@/assets/brands/telegram.svg";
import brandMeta from "@/assets/brands/meta.svg";
import brandKwai from "@/assets/brands/kwai.svg";
import brandTiktok from "@/assets/brands/tiktok.svg";
import brandGoogle from "@/assets/brands/google.svg";
import brandInstagram from "@/assets/brands/instagram.svg";
import brandWhatsapp from "@/assets/brands/whatsapp.svg";

const BRAND_LOGOS = [
  { src: brandMeta, alt: "Meta" },
  { src: brandInstagram, alt: "Instagram" },
  { src: brandTiktok, alt: "TikTok" },
  { src: brandGoogle, alt: "Google" },
  { src: brandYoutube, alt: "YouTube" },
  { src: brandWhatsapp, alt: "WhatsApp" },
  { src: brandX, alt: "X" },
  { src: brandLinkedin, alt: "LinkedIn" },
  { src: brandTelegram, alt: "Telegram" },
  { src: brandKwai, alt: "Kwai" },
];

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40);
}

function maskCNPJ(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}
function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10)
    return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").trim();
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").trim();
}

export default function RevendaCadastro() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    whatsapp: "",
    company_name: "",
    cnpj: "",
  });

  const update = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !form.full_name.trim() ||
      !form.email.trim() ||
      !form.password ||
      !form.whatsapp.trim() ||
      !form.company_name.trim() ||
      !form.cnpj.trim()
    ) {
      toast.error("Preencha todos os campos");
      return;
    }
    if (form.password.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres");
      return;
    }
    const cnpjDigits = form.cnpj.replace(/\D/g, "");
    const phoneDigits = form.whatsapp.replace(/\D/g, "");
    if (cnpjDigits.length !== 14) {
      toast.error("CNPJ inválido");
      return;
    }
    if (phoneDigits.length < 10) {
      toast.error("WhatsApp inválido");
      return;
    }

    setLoading(true);
    try {
      const emailRedirectTo = `${window.location.origin}/revenda`;
      const { data: signUp, error: signUpErr } = await supabase.auth.signUp({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        options: {
          emailRedirectTo,
          data: { full_name: form.full_name.trim() },
        },
      });
      if (signUpErr) throw signUpErr;

      // If email confirmation is enabled, no session is returned.
      // Attempt sign-in to proceed with reseller row creation.
      let session = signUp.session;
      let userId = signUp.user?.id;
      if (!session) {
        const { data: signIn, error: signInErr } =
          await supabase.auth.signInWithPassword({
            email: form.email.trim().toLowerCase(),
            password: form.password,
          });
        if (signInErr) {
          toast.info(
            "Confirme seu e-mail para acessar seu painel de revendedor."
          );
          navigate("/auth");
          return;
        }
        session = signIn.session;
        userId = signIn.user?.id;
      }
      if (!userId) throw new Error("Falha ao autenticar após cadastro");

      // Update profile with WhatsApp + full name
      await supabase
        .from("profiles")
        .update({
          full_name: form.full_name.trim(),
          phone: phoneDigits,
        })
        .eq("user_id", userId);

      // Generate unique slug
      const base = slugify(form.company_name) || "revenda";
      let slug = base;
      for (let i = 0; i < 5; i++) {
        const { data: existing } = await supabase
          .from("resellers")
          .select("id")
          .eq("slug", slug)
          .maybeSingle();
        if (!existing) break;
        slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
      }

      const { error: resellerErr } = await supabase.from("resellers").insert({
        user_id: userId,
        slug,
        company_name: form.company_name.trim(),
        brand_name: form.company_name.trim(),
        cnpj: cnpjDigits,
        status: "active",
        model: "percentage",
      });
      if (resellerErr) {
        // Likely duplicated (already registered)
        if (
          resellerErr.message?.toLowerCase().includes("duplicate") ||
          resellerErr.code === "23505"
        ) {
          toast.error("Você já possui um painel de revenda cadastrado");
          navigate("/revenda");
          return;
        }
        throw resellerErr;
      }

      toast.success("Cadastro realizado! Bem-vindo ao painel de revenda.");
      navigate("/revenda");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao cadastrar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-black text-foreground font-display relative overflow-hidden antialiased">
      {/* Ambient light — extremely subtle */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-30%] left-[-10%] w-[60%] h-[80%] bg-primary/[0.06] rounded-full blur-[180px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[50%] bg-primary/[0.03] rounded-full blur-[160px]" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.6) 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      {/* Left — editorial black canvas */}
      <aside className="hidden lg:flex relative z-10 w-[46%] xl:w-[44%] flex-col justify-between p-12 xl:p-16 border-r border-white/[0.06]">
        {/* Globe background */}
        <div className="absolute inset-0 -z-10 flex items-center justify-center pointer-events-none overflow-hidden">
          <div className="absolute w-[120%] aspect-square opacity-70">
            <GlobePulse />
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black" />
        </div>
        <div>
          <Link to="/" className="inline-flex items-center gap-3 group">
            <img
              src={logoFbflix}
              alt="FBFlix"
              className="h-10 w-auto object-contain drop-shadow-[0_0_18px_rgba(220,38,38,0.35)] transition-transform duration-500 group-hover:scale-[1.03]"
            />
            <span className="text-[10px] font-medium uppercase tracking-[0.28em] text-white/40 border-l border-white/10 pl-3">
              Programa de Revenda
            </span>
          </Link>
        </div>

        <div className="space-y-8 max-w-lg">
          <h1 className="text-[2.5rem] xl:text-[2.75rem] font-semibold tracking-[-0.03em] leading-[1.1] text-white">
            Aumente em até 120% o faturamento da sua agência
            <br /> com sua própria
            <br /> infraestrutura de proxies.
          </h1>
          <p className="text-[15px] text-white/50 leading-relaxed max-w-md">
            Painel white-label, precificação livre e comissão automática. Sem burocracia, sem intermediários.
          </p>

          <div className="pt-4 max-w-md">
            <BrandMarquee />
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-white/30">
          <span>© {new Date().getFullYear()} FBFlix Proxies</span>
          <Link to="/auth" className="text-white/50 hover:text-white transition-colors">
            Já tem conta? <span className="text-primary">Entrar →</span>
          </Link>
        </div>
      </aside>

      {/* Right — form */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-6 lg:p-10 overflow-y-auto">
        <div className="w-full max-w-[460px]">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 flex items-center gap-3">
            <img src={logoFbflix} alt="FBFlix" className="h-9 w-auto" />
            <span className="text-[10px] font-medium uppercase tracking-[0.28em] text-white/40 border-l border-white/10 pl-3">
              Revenda
            </span>
          </div>

          <div className="mb-10">
            <h2 className="text-[2rem] font-semibold tracking-[-0.02em] leading-tight text-white">
              Crie sua conta
            </h2>
            <p className="text-[14px] text-white/45 mt-2">
              Acesse seu painel de revenda em menos de 60 segundos.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Field
              label="Nome completo"
              value={form.full_name}
              onChange={(v) => update("full_name", v)}
              placeholder="Nome e sobrenome"
              autoComplete="name"
            />

            <div className="grid md:grid-cols-2 gap-5">
              <Field
                label="E-mail"
                type="email"
                value={form.email}
                onChange={(v) => update("email", v)}
                placeholder="voce@empresa.com"
                autoComplete="email"
              />
              <Field
                label="WhatsApp"
                value={form.whatsapp}
                onChange={(v) => update("whatsapp", maskPhone(v))}
                placeholder="(11) 99999-9999"
                autoComplete="tel"
              />
            </div>

            <Field
              label="Senha"
              type="password"
              value={form.password}
              onChange={(v) => update("password", v)}
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
            />

            <div className="pt-6 mt-2 border-t border-white/[0.06] space-y-5">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-white/[0.06]" />
                <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-white/35">
                  Sua empresa
                </p>
                <div className="h-px flex-1 bg-white/[0.06]" />
              </div>
              <div className="grid md:grid-cols-2 gap-5">
                <Field
                  label="Nome da empresa"
                  value={form.company_name}
                  onChange={(v) => update("company_name", v)}
                  placeholder="Ex: MinhaCloud Proxies"
                />
                <Field
                  label="CNPJ"
                  value={form.cnpj}
                  onChange={(v) => update("cnpj", maskCNPJ(v))}
                  placeholder="00.000.000/0000-00"
                />
              </div>
              {form.company_name.trim() && (
                <div className="text-[12px] text-white/50 flex items-center gap-2 animate-fade-in">
                  <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                  Seu painel:{" "}
                  <span className="font-mono text-white/80">
                    /revenda/{slugify(form.company_name) || "revenda"}
                  </span>
                </div>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading}
              className={cn(
                "group relative w-full h-12 gap-2 mt-2 rounded-xl font-medium text-[14px]",
                "bg-white text-black hover:bg-white/90",
                "shadow-[0_10px_40px_-8px_rgba(255,255,255,0.15)] transition-all duration-300",
                "hover:shadow-[0_12px_48px_-6px_rgba(255,255,255,0.25)]"
              )}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  Criar meu painel
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </Button>

            <p className="text-[11px] text-white/35 text-center leading-relaxed pt-1">
              Ao continuar você concorda com os{" "}
              <Link to="/termos" className="text-white/60 hover:text-white transition-colors">
                Termos
              </Link>{" "}
              e{" "}
              <Link to="/privacidade" className="text-white/60 hover:text-white transition-colors">
                Política de Privacidade
              </Link>
              .
            </p>
            <p className="text-[12px] text-center text-white/40 lg:hidden pt-2">
              Já tem conta?{" "}
              <Link to="/auth" className="text-primary hover:underline">
                Fazer login
              </Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}

function BrandMarquee() {
  const items = [...BRAND_LOGOS, ...BRAND_LOGOS];
  return (
    <div className="mb-8 select-none">
      <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-white/35 mb-3">
        Dedicados para
      </p>
      <div
        className="relative overflow-hidden"
        style={{
          maskImage:
            "linear-gradient(to right, transparent, black 12%, black 88%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent, black 12%, black 88%, transparent)",
        }}
      >
        <div className="flex gap-10 w-max animate-[brand-marquee_28s_linear_infinite]">
          {items.map((logo, i) => (
            <img
              key={`${logo.alt}-${i}`}
              src={logo.src}
              alt={logo.alt}
              className="h-5 w-auto opacity-40 hover:opacity-80 transition-opacity shrink-0"
              loading="lazy"
              draggable={false}
            />
          ))}
        </div>
      </div>
      <style>{`
        @keyframes brand-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-2 group">
      <Label className="text-[11px] font-medium tracking-[0.02em] text-white/50 group-focus-within:text-white transition-colors">
        {label}
      </Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={type}
        autoComplete={autoComplete}
        className={cn(
          "h-11 bg-white/[0.02] border-white/[0.08] rounded-xl px-4 text-[14px]",
          "text-white placeholder:text-white/25",
          "hover:bg-white/[0.03] hover:border-white/[0.12]",
          "focus-visible:bg-white/[0.04] focus-visible:border-white/25 focus-visible:ring-0 focus-visible:ring-offset-0",
          "transition-all duration-200"
        )}
      />
    </div>
  );
}