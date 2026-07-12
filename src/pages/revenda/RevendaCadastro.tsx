import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Store,
  Building2,
  Mail,
  User,
  Phone,
  Lock,
  Loader2,
  Sparkles,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
    <div className="min-h-screen w-full flex bg-[#0a0505] text-foreground font-display relative overflow-hidden">
      {/* Ambient bg */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-15%] left-[-10%] w-[45%] h-[45%] bg-primary/15 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[35%] h-[35%] bg-primary/5 rounded-full blur-[120px]" />
      </div>

      {/* Left panel */}
      <aside className="hidden lg:flex relative z-10 w-[42%] xl:w-[38%] flex-col justify-between p-10 xl:p-14 border-r border-border/30 bg-gradient-to-br from-card/40 to-transparent backdrop-blur-xl">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <div className="size-10 rounded-xl bg-gradient-to-br from-primary to-red-900 flex items-center justify-center shadow-lg shadow-primary/30">
              <Store className="size-5 text-white" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-widest">
              Programa de Revenda
            </span>
          </div>
          <h1 className="text-4xl xl:text-5xl font-bold tracking-tight leading-tight">
            Construa sua marca no{" "}
            <span className="bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent">
              maior ecossistema
            </span>{" "}
            de proxies do Brasil.
          </h1>
          <p className="text-sm text-muted-foreground mt-4 max-w-md leading-relaxed">
            Painel white-label completo, precificação livre por proxy, comissão automática
            e suporte técnico dedicado. Comece a revender em minutos.
          </p>
        </div>

        <div className="space-y-4">
          {[
            {
              icon: <Sparkles className="size-4" />,
              t: "Painel white-label",
              d: "Sua marca, seu domínio, sua identidade visual.",
            },
            {
              icon: <ShieldCheck className="size-4" />,
              t: "Infraestrutura FBFlix",
              d: "99.94% de uptime e suporte técnico em até 30min.",
            },
            {
              icon: <Building2 className="size-4" />,
              t: "Precificação flexível",
              d: "Defina sua margem em cada proxy, sem intermediários.",
            },
          ].map((f) => (
            <div key={f.t} className="flex items-start gap-3">
              <div className="size-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                {f.icon}
              </div>
              <div>
                <p className="text-sm font-bold">{f.t}</p>
                <p className="text-xs text-muted-foreground">{f.d}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-muted-foreground">
          Já tem uma conta?{" "}
          <Link to="/auth" className="text-primary hover:underline">
            Fazer login
          </Link>
        </p>
      </aside>

      {/* Form */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-6 lg:p-12 overflow-y-auto">
        <Card className="w-full max-w-xl bg-card/60 border-border/40 backdrop-blur-xl p-6 md:p-8 shadow-2xl">
          <div className="mb-6">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              Cadastro de Revendedor
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Preencha os dados abaixo e acesse seu painel imediatamente.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field
              icon={<User className="size-4" />}
              label="Seu nome completo"
              value={form.full_name}
              onChange={(v) => update("full_name", v)}
              placeholder="Nome e sobrenome"
              autoComplete="name"
            />

            <div className="grid md:grid-cols-2 gap-4">
              <Field
                icon={<Mail className="size-4" />}
                label="E-mail"
                type="email"
                value={form.email}
                onChange={(v) => update("email", v)}
                placeholder="voce@empresa.com"
                autoComplete="email"
              />
              <Field
                icon={<Phone className="size-4" />}
                label="WhatsApp"
                value={form.whatsapp}
                onChange={(v) => update("whatsapp", maskPhone(v))}
                placeholder="(11) 99999-9999"
                autoComplete="tel"
              />
            </div>

            <Field
              icon={<Lock className="size-4" />}
              label="Senha"
              type="password"
              value={form.password}
              onChange={(v) => update("password", v)}
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
            />

            <div className="pt-3 border-t border-border/40 space-y-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Dados da empresa
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <Field
                  icon={<Building2 className="size-4" />}
                  label="Nome da empresa"
                  value={form.company_name}
                  onChange={(v) => update("company_name", v)}
                  placeholder="Ex: MinhaCloud Proxies"
                />
                <Field
                  icon={<Building2 className="size-4" />}
                  label="CNPJ"
                  value={form.cnpj}
                  onChange={(v) => update("cnpj", maskCNPJ(v))}
                  placeholder="00.000.000/0000-00"
                />
              </div>
              {form.company_name.trim() && (
                <div className="text-[11px] text-muted-foreground bg-muted/20 border border-border/30 rounded-lg px-3 py-2">
                  Seu painel será configurado como{" "}
                  <span className="text-foreground font-bold">
                    {form.company_name.trim()}
                  </span>{" "}
                  · slug sugerido:{" "}
                  <span className="font-mono text-primary">
                    /revenda/{slugify(form.company_name) || "revenda"}
                  </span>
                </div>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading}
              className={cn(
                "w-full h-11 gap-2 font-bold shadow-lg shadow-primary/25",
                "bg-gradient-to-r from-primary to-primary/80 hover:from-primary hover:to-primary"
              )}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  Criar meu painel de revenda
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>

            <p className="text-[11px] text-muted-foreground text-center">
              Ao continuar você concorda com os{" "}
              <Link to="/termos" className="underline hover:text-foreground">
                Termos
              </Link>{" "}
              e{" "}
              <Link to="/privacidade" className="underline hover:text-foreground">
                Política de Privacidade
              </Link>
              .
            </p>
            <p className="text-xs text-center text-muted-foreground lg:hidden">
              Já tem conta?{" "}
              <Link to="/auth" className="text-primary hover:underline">
                Fazer login
              </Link>
            </p>
          </form>
        </Card>
      </main>
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
  icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {icon}
          </span>
        )}
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          type={type}
          autoComplete={autoComplete}
          className={cn(
            "bg-background/60 border-border/40 focus-visible:ring-primary/40",
            icon && "pl-10"
          )}
        />
      </div>
    </div>
  );
}