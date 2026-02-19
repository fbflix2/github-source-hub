import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error("Credenciais inválidas");
        return;
      }

      // TODO: Check if user is admin
      toast.success("Login realizado com sucesso!");
      navigate("/admin");
    } catch (error) {
      toast.error("Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0505] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-blue-900/10 rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="relative flex items-center justify-center size-12 rounded-xl bg-gradient-to-br from-primary to-red-900 shadow-lg shadow-primary/20">
            <Play className="text-white size-6" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-white text-2xl font-bold tracking-tight">
              FBFLIX <span className="text-primary">Admin</span>
            </h1>
            <p className="text-white/40 text-xs font-medium">Painel de Controle</p>
          </div>
        </div>

        {/* Login Card */}
        <div className="glass-card-static rounded-2xl p-8">
          <div className="text-center mb-8">
            <h2 className="text-xl font-semibold text-white mb-2">Acesso Administrativo</h2>
            <p className="text-white/50 text-sm">Entre com suas credenciais de administrador</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-white/70 text-sm font-medium mb-2">
                Email
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border-white/10 text-white placeholder:text-white/30"
                placeholder="admin@fbflix.com"
                required
              />
            </div>

            <div>
              <label className="block text-white/70 text-sm font-medium mb-2">
                Senha
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border-white/10 text-white placeholder:text-white/30 pr-10"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-6 rounded-xl shadow-lg shadow-primary/20"
            >
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </div>

        <p className="text-center text-white/30 text-xs mt-6">
          © 2024 FBFLIX. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
