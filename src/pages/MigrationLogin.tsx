import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, ArrowRight, Loader2, PartyPopper, MessageCircleQuestion } from "lucide-react";
import logoFbflix from "@/assets/logo-fbflix.png";

export default function MigrationLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleMigrationLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Digite seu email");
      return;
    }

    setLoading(true);
    try {
      // Call edge function to validate email and get magic link token
      const { data, error } = await supabase.functions.invoke("migration-login", {
        body: { email: email.trim() },
      });

      if (error) throw new Error(error.message || "Erro ao verificar email");
      if (data?.error) throw new Error(data.error);

      if (!data?.token) throw new Error("Erro ao gerar acesso");

      // Verify the OTP token to sign in
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: data.token,
        type: "magiclink",
      });

      if (verifyError) throw verifyError;

      toast.success("Login realizado! Defina sua nova senha.");
      navigate("/welcome");
    } catch (err: any) {
      toast.error(err.message || "Erro ao fazer login de migração");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background min-h-screen flex items-center justify-center relative overflow-hidden text-foreground">
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />

      <div className="container px-4 mx-auto flex justify-center items-center relative z-10 py-10">
        <div className="glass-card-static w-full max-w-[460px] rounded-3xl p-8 flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-col items-center gap-3">
            <img src={logoFbflix} alt="FBFLIX" className="w-14 h-14 object-contain" />
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                FBFLIX <span className="text-primary">2.0</span>
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <PartyPopper className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Migração de Conta</h2>
            </div>
            <p className="text-sm text-muted-foreground text-center leading-relaxed">
              Se você já era cliente da plataforma antiga, digite o <strong className="text-foreground">email que usava antes</strong> para acessar sua conta na nova plataforma.
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleMigrationLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-muted-foreground pl-1">Seu email da plataforma antiga</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                </div>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 py-3.5 rounded-xl"
                  placeholder="seuemail@exemplo.com"
                  required
                  autoFocus
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-2 w-full font-bold text-sm py-3.5 rounded-xl shadow-[0_0_20px_rgba(220,38,38,0.2)] hover:shadow-[0_0_25px_rgba(220,38,38,0.4)] transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  Entrar na nova plataforma
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </form>

          {/* Balance info */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex gap-3 items-start">
            <MessageCircleQuestion className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Tinha saldo na plataforma antiga?</strong>
              <br />
              Após fazer login, clique no ícone de suporte no canto inferior direito, selecione <strong className="text-foreground">"Dúvida Rápida"</strong> e informe que deseja migrar seu saldo para a nova plataforma.
            </div>
          </div>

          {/* Link to normal login */}
          <div className="text-center">
            <button
              type="button"
              onClick={() => navigate("/auth")}
              className="text-sm text-muted-foreground hover:text-primary transition-colors underline underline-offset-4"
            >
              Já tem conta na nova plataforma? Faça login aqui
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
