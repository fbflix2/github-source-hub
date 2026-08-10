import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import logoFbflix from "@/assets/logo-fbflix.webp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const clearStaleAdminSession = () => {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith("sb-") && key.endsWith("-auth-token"))
      .forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    console.warn("[AdminLogin] não foi possível limpar a sessão antiga:", error);
  }
};

const withTimeout = async <T,>(promise: PromiseLike<T>, timeoutMs: number, message: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([Promise.resolve(promise), timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    return localStorage.getItem("admin_remember_me") !== "false";
  });
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Save remember me preference
      localStorage.setItem("admin_remember_me", rememberMe ? "true" : "false");

      // Do not call signOut here: when a stale refresh token is timing out,
      // signOut waits for the same blocked auth initialization indefinitely.
      clearStaleAdminSession();

      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({ email: email.trim(), password }),
        20000,
        "O servidor demorou para responder. Tente novamente.",
      );

      if (error) {
        toast.error("Credenciais inválidas");
        return;
      }

      const { data: validatedUser, error: userError } = await withTimeout(
        supabase.auth.getUser(),
        15000,
        "Não foi possível validar a sessão. Tente novamente.",
      );

      if (userError || !validatedUser.user || validatedUser.user.id !== data.user.id) {
        toast.error("Não foi possível validar a sessão administrativa.");
        return;
      }

      // Use the same role checks as the admin guard, avoiding divergence between login and layout.
      const adminResult = await withTimeout(
        supabase.rpc("has_role", { _user_id: data.user.id, _role: "admin" as const }),
        15000,
        "A validação de acesso demorou para responder. Tente novamente.",
      );

      let isStaff = adminResult.data === true;
      let roleError = adminResult.error;

      if (!isStaff && !roleError) {
        const moderatorResult = await withTimeout(
          supabase.rpc("has_role", { _user_id: data.user.id, _role: "moderator" as const }),
          15000,
          "A validação de acesso demorou para responder. Tente novamente.",
        );
        isStaff = moderatorResult.data === true;
        roleError = moderatorResult.error;
      }

      if (roleError || !isStaff) {
        if (!roleError) clearStaleAdminSession();
        toast.error(roleError
          ? "Não foi possível consultar sua permissão. Tente novamente."
          : "Acesso negado. Você não tem permissão de administrador ou moderador.");
        return;
      }

      toast.success("Login realizado com sucesso!");
      window.location.replace("/admin");
    } catch (error: unknown) {
      console.error("[AdminLogin] erro inesperado:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao fazer login. Tente novamente.");
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
          <img src={logoFbflix} alt="FBFLIX" className="size-14 object-contain" />
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

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <Switch
                  checked={rememberMe}
                  onCheckedChange={setRememberMe}
                  className="data-[state=checked]:bg-primary"
                />
                <span className="text-sm text-white/60">Manter conectado</span>
              </label>
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
          © 2026 FBFLIX. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
