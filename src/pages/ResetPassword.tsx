import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logoFbflix from "@/assets/logo-fbflix.webp";
import { Eye, EyeOff, Lock, KeyRound, MessageCircle, ArrowLeft } from "lucide-react";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialEmail = params.get("email") || "";

  const [step, setStep] = useState<"code" | "password">("code");
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || code.length < 6) {
      toast.error("Informe o email e o código de 6 dígitos.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-password-reset", {
        body: { action: "verify", email, code },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || "Código inválido");
      toast.success("Código confirmado! Defina sua nova senha.");
      setStep("password");
    } catch (err: any) {
      toast.error(err.message || "Código inválido");
    } finally {
      setLoading(false);
    }
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) return toast.error("A senha deve ter pelo menos 6 caracteres.");
    if (newPassword !== confirmPassword) return toast.error("As senhas não coincidem.");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-password-reset", {
        body: { action: "reset", email, code, new_password: newPassword },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || "Erro ao alterar senha");
      toast.success("Senha alterada com sucesso! Faça login.");
      navigate("/auth");
    } catch (err: any) {
      toast.error(err.message || "Erro ao alterar senha");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background min-h-screen flex items-center justify-center relative overflow-hidden text-foreground">
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />

      <div className="container px-4 mx-auto flex justify-center items-center relative z-10 py-10">
        <div className="glass-card-static w-full max-w-[440px] rounded-3xl p-8 flex flex-col gap-6">
          <div className="flex flex-col items-center gap-3">
            <img src={logoFbflix} alt="FBFLIX" className="w-16 h-16 object-contain" />
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20">
              <KeyRound className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground text-center">
              {step === "code" ? "Confirmar código" : "Definir nova senha"}
            </h1>
            <p className="text-sm text-muted-foreground text-center">
              {step === "code"
                ? "Digite o código de 6 dígitos que enviamos para o seu WhatsApp."
                : "Escolha uma nova senha para sua conta."}
            </p>
          </div>

          {step === "code" ? (
            <form onSubmit={verifyCode} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-muted-foreground pl-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-card border border-border rounded-xl py-3.5 px-4 text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-sm font-medium"
                  placeholder="seu@email.com"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-muted-foreground pl-1">Código (6 dígitos)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MessageCircle className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <input
                    inputMode="numeric"
                    pattern="\d*"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="w-full bg-card border border-border rounded-xl py-3.5 pl-10 pr-4 text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-lg font-bold tracking-[0.4em] text-center"
                    placeholder="000000"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm py-3.5 rounded-xl transition-all disabled:opacity-50"
              >
                {loading ? "Verificando..." : "Confirmar código"}
              </button>

              <Link to="/auth" className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-4 h-4" /> Voltar para o Login
              </Link>
            </form>
          ) : (
            <form onSubmit={submitPassword} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-muted-foreground pl-1">Nova Senha</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-card border border-border rounded-xl py-3.5 pl-10 pr-10 text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-sm font-medium"
                    placeholder="Mínimo 6 caracteres"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-muted-foreground pl-1">Confirmar Senha</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-card border border-border rounded-xl py-3.5 pl-10 pr-4 text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-sm font-medium"
                    placeholder="Repita a senha"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm py-3.5 rounded-xl transition-all disabled:opacity-50"
              >
                {loading ? "Salvando..." : "Alterar senha"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}