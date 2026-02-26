import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import logoFbflix from "@/assets/logo-fbflix.png";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export default function Auth() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register state
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });

    if (error) {
      toast({
        title: "Erro ao entrar",
        description: error.message,
        variant: "destructive",
      });
    } else {
      // Check if user must change password (first login)
      const mustChange = data.user.user_metadata?.must_change_password === true;
      if (mustChange) {
        navigate("/welcome");
        setLoading(false);
        return;
      }

      // Check if user has admin role
      const { data: isAdmin } = await supabase.rpc('has_role', {
        _user_id: data.user.id,
        _role: 'admin' as const,
      });

      toast({
        title: "Bem-vindo!",
        description: "Login realizado com sucesso.",
      });
      navigate(isAdmin ? "/admin" : "/loja");
    }

    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptTerms) {
      toast({
        title: "Termos obrigatórios",
        description: "Você precisa aceitar os termos de uso.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email: registerEmail,
      password: registerPassword,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: {
          full_name: registerName,
        },
      },
    });

    if (error) {
      toast({
        title: "Erro ao criar conta",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Conta criada!",
        description: "Você já pode fazer login.",
      });
      navigate("/loja");
    }

    setLoading(false);
  };

  return (
    <div className="bg-background min-h-screen flex items-center justify-center relative overflow-hidden text-foreground">
      {/* Ambient Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-danger/5 blur-[120px] pointer-events-none" />

      <div className="container px-4 mx-auto flex justify-center items-center h-full relative z-10 py-10">
        {/* Main Card Container */}
        <div className="glass-card-static w-full max-w-[440px] rounded-3xl p-8 flex flex-col gap-6">
          {/* Header & Logo */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 mb-2">
              <img src={logoFbflix} alt="FBFLIX" className="w-10 h-10 object-contain" />
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                FBFLIX <span className="text-primary">2.0</span>
              </h1>
            </div>
            <p className="text-muted-foreground text-sm font-medium">Bem-vindo de volta</p>
          </div>

          {/* Segmented Control (Toggle) */}
          <div className="bg-muted p-1 rounded-xl flex relative">
            {/* Active Indicator Background */}
            <div
              className="w-1/2 h-full absolute top-0 p-1 transition-all duration-300"
              style={{ left: isLogin ? "0" : "50%" }}
            >
              <div className="w-full h-full bg-secondary rounded-lg shadow-sm border border-border" />
            </div>
            <button
              type="button"
              onClick={() => setIsLogin(true)}
              className={`flex-1 relative z-10 py-2.5 text-sm font-semibold text-center transition-colors ${
                isLogin ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setIsLogin(false)}
              className={`flex-1 relative z-10 py-2.5 text-sm font-semibold text-center transition-colors ${
                !isLogin ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Cadastro
            </button>
          </div>

          {/* Login Form */}
          {isLogin ? (
            <form onSubmit={handleLogin} className="flex flex-col gap-5">
              <div className="flex flex-col gap-4">
                {/* Email Input */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-muted-foreground pl-1">Email</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="material-symbols-outlined text-muted-foreground group-focus-within:text-primary transition-colors text-[20px]">
                        mail
                      </span>
                    </div>
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full bg-card border border-border rounded-xl py-3.5 pl-10 pr-4 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm font-medium"
                      placeholder="seu@email.com"
                      required
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center pl-1">
                    <label className="text-sm font-medium text-muted-foreground">Senha</label>
                    <button type="button" className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">
                      Recuperar Senha?
                    </button>
                  </div>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="material-symbols-outlined text-muted-foreground group-focus-within:text-primary transition-colors text-[20px]">
                        lock
                      </span>
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full bg-card border border-border rounded-xl py-3.5 pl-10 pr-10 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm font-medium"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {showPassword ? "visibility" : "visibility_off"}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm py-3.5 rounded-xl shadow-[0_0_20px_rgba(220,38,38,0.2)] hover:shadow-[0_0_25px_rgba(220,38,38,0.4)] transition-all duration-300 transform active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? "Entrando..." : "Entrar"}
              </button>

              {/* Footer Switcher */}
              <div className="text-center pt-2">
                <p className="text-sm text-muted-foreground">
                  Não tem conta?{" "}
                  <button
                    type="button"
                    onClick={() => setIsLogin(false)}
                    className="text-foreground font-semibold hover:text-primary transition-colors ml-1"
                  >
                    Cadastre-se
                  </button>
                </p>
              </div>
            </form>
          ) : (
            /* Register Form */
            <form onSubmit={handleRegister} className="flex flex-col gap-5">
              <div className="flex flex-col gap-4">
                {/* Name Input */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-muted-foreground pl-1">Nome Completo</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="material-symbols-outlined text-muted-foreground group-focus-within:text-primary transition-colors text-[20px]">
                        person
                      </span>
                    </div>
                    <input
                      type="text"
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                      className="w-full bg-card border border-border rounded-xl py-3.5 pl-10 pr-4 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm font-medium"
                      placeholder="Seu nome"
                      required
                    />
                  </div>
                </div>

                {/* Email Input */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-muted-foreground pl-1">Email</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="material-symbols-outlined text-muted-foreground group-focus-within:text-primary transition-colors text-[20px]">
                        mail
                      </span>
                    </div>
                    <input
                      type="email"
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      className="w-full bg-card border border-border rounded-xl py-3.5 pl-10 pr-4 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm font-medium"
                      placeholder="seu@email.com"
                      required
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-muted-foreground pl-1">Senha</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="material-symbols-outlined text-muted-foreground group-focus-within:text-primary transition-colors text-[20px]">
                        lock
                      </span>
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      className="w-full bg-card border border-border rounded-xl py-3.5 pl-10 pr-10 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm font-medium"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {showPassword ? "visibility" : "visibility_off"}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Terms Checkbox */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="w-4 h-4 rounded border-border bg-background text-primary focus:ring-primary focus:ring-offset-0"
                  />
                  <span className="text-xs text-muted-foreground">
                    Li e aceito os{" "}
                    <a href="#" className="text-primary underline">
                      termos de uso
                    </a>
                  </span>
                </label>
              </div>

              {/* Action Button */}
              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm py-3.5 rounded-xl shadow-[0_0_20px_rgba(220,38,38,0.2)] hover:shadow-[0_0_25px_rgba(220,38,38,0.4)] transition-all duration-300 transform active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? "Criando conta..." : "Cadastrar"}
              </button>

              {/* Footer Switcher */}
              <div className="text-center pt-2">
                <p className="text-sm text-muted-foreground">
                  Já tem conta?{" "}
                  <button
                    type="button"
                    onClick={() => setIsLogin(true)}
                    className="text-foreground font-semibold hover:text-primary transition-colors ml-1"
                  >
                    Entrar
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* Social Login */}
          <div className="flex flex-col items-center gap-4 pt-4 border-t border-border">
            <span className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">Ou entre com</span>
            <button
              type="button"
              onClick={async () => {
                const { error } = await supabase.auth.signInWithOAuth({
                  provider: 'google',
                  options: {
                    redirectTo: `${window.location.origin}/loja`,
                  },
                });
                if (error) {
                  toast({
                    title: "Erro ao entrar com Google",
                    description: error.message,
                    variant: "destructive",
                  });
                }
              }}
              className="w-full flex items-center justify-center gap-3 bg-secondary hover:bg-secondary/80 text-foreground font-medium text-sm py-3 rounded-xl border border-border transition-all"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
              </svg>
              Continuar com Google
            </button>
          </div>

          {/* Footer - Legal Links */}
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              to="/termos"
              className="text-xs text-muted-foreground hover:text-primary transition-colors underline underline-offset-2"
            >
              Termos de Serviço
            </Link>
            <span className="text-muted-foreground/40 text-xs">•</span>
            <Link
              to="/privacidade"
              className="text-xs text-muted-foreground hover:text-primary transition-colors underline underline-offset-2"
            >
              Política de Privacidade
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
