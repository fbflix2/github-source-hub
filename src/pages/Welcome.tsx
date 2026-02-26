import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Lock, PartyPopper } from "lucide-react";

export default function Welcome() {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
        data: { must_change_password: false },
      });

      if (error) throw error;

      toast.success("Senha alterada com sucesso! Bem-vindo à FBFLIX!");
      navigate("/loja");
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
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
          {/* Welcome Header */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20">
              <PartyPopper className="w-8 h-8 text-primary" />
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-2xl">play_circle</span>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                FBFLIX <span className="text-primary">2.0</span>
              </h1>
            </div>
            <h2 className="text-lg font-semibold text-foreground">Bem-vindo! 🎉</h2>
            <p className="text-sm text-muted-foreground text-center">
              Esta é sua primeira vez aqui. Por segurança, defina uma nova senha para sua conta.
            </p>
          </div>

          {/* Password Change Form */}
          <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-muted-foreground pl-1">Nova Senha</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                </div>
                <Input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-10 pr-10 py-3.5 rounded-xl"
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-muted-foreground pl-1">Confirmar Senha</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                </div>
                <Input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 py-3.5 rounded-xl"
                  placeholder="Repita a senha"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-2 w-full font-bold text-sm py-3.5 rounded-xl shadow-[0_0_20px_rgba(220,38,38,0.2)] hover:shadow-[0_0_25px_rgba(220,38,38,0.4)] transition-all"
            >
              {loading ? "Salvando..." : "Definir senha e continuar"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
