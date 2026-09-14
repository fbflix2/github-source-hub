import { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import logoFbflix from "@/assets/logo-fbflix.webp";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useResellerBranding } from "@/hooks/useResellerBranding";

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { branding, loading: brandingLoading } = useResellerBranding();
  const isCustomDomain =
    typeof document !== "undefined" &&
    document.documentElement.getAttribute("data-custom-domain") === "1";
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // If the user was sent to /auth with a ?redirect=... target (e.g. from a
  // reseller store "Comprar" button), honor it after successful login/register.
  const getRedirectTarget = (): string | null => {
    const params = new URLSearchParams(location.search);
    const redirect = params.get("redirect");
    if (!redirect || !redirect.startsWith("/")) return null;
    // Forward remaining query params (product, qty, r, etc.) to the target.
    const forwarded = new URLSearchParams();
    params.forEach((v, k) => {
      if (k !== "redirect" && k !== "type") forwarded.append(k, v);
    });
    const qs = forwarded.toString();
    return qs ? `${redirect}?${qs}` : redirect;
  };

  const getResellerSlug = (): string | null => {
    const params = new URLSearchParams(location.search);
    const redirect = params.get("redirect");
    const fromRedirect = redirect?.match(/^\/r\/([^/?#]+)/)?.[1];
    const slug = params.get("r") || fromRedirect || localStorage.getItem("reseller_slug");
    if (slug) localStorage.setItem("reseller_slug", slug);
    return slug;
  };

  const getAuthDestination = (): string => {
    const target = getRedirectTarget();
    if (target) return target;
    const slug = getResellerSlug();
    return slug ? `/r/${slug}` : "/loja";
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("type") === "recovery") {
      setIsResetting(false);
      // We don't necessarily need to do anything here as the recovery link 
      // will have set the session, and App.tsx will handle the logged-in state.
      // But we want to make sure they go to /welcome.
      const checkSession = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          navigate("/welcome");
        }
      };
      checkSession();
    }
  }, [location, navigate]);

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Reset password state
  const [isResetting, setIsResetting] = useState(false);
  const [resetEmail, setResetEmail] = useState("");

  // Register state
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  useEffect(() => {
    const mode = new URLSearchParams(location.search).get("mode");
    if (mode === "signup") setIsLogin(false);
    if (mode === "login") setIsLogin(true);
  }, [location.search]);

  const validateFullName = (name: string) => {
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2 && parts.every(p => p.length >= 2);
  };

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

      let isStaff = isAdmin;
      if (!isStaff) {
        const { data: isMod } = await supabase.rpc('has_role', {
          _user_id: data.user.id,
          _role: 'moderator' as const,
        });
        isStaff = isMod;
      }

      const { data: resellerData } = await supabase
        .from("resellers")
        .select("id")
        .eq("user_id", data.user.id)
        .maybeSingle();

      toast({
        title: "Bem-vindo!",
        description: "Login realizado com sucesso.",
      });
      const target = getRedirectTarget();
      if (target && !isStaff && !resellerData) {
        navigate(target);
      } else {
        navigate(isStaff ? "/admin" : resellerData ? "/revenda" : "/loja");
      }
    }

    setLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("request-password-reset", {
        body: { email: resetEmail },
      });
      if (error) throw error;
      toast({
        title: "Código enviado!",
        description: "Enviamos um código de confirmação para o seu WhatsApp. Verifique e continue a troca de senha.",
      });
      navigate(`/reset-password?email=${encodeURIComponent(resetEmail)}`);
    } catch (err: any) {
      toast({
        title: "Erro ao solicitar troca",
        description: err.message || "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateFullName(registerName)) {
      toast({
        title: "Nome inválido",
        description: "Informe seu nome completo (nome e sobrenome).",
        variant: "destructive",
      });
      return;
    }
    if (!acceptTerms) {
      toast({
        title: "Termos obrigatórios",
        description: "Você precisa aceitar os termos de uso.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);

    const { data: signUpData, error } = await supabase.auth.signUp({
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
      // Save CPF and Referrer to profile
      if (signUpData?.user) {
        const partnerRefId = localStorage.getItem("partner_ref_id");
        // Se o cadastro é no domínio ou na loja de um revendedor, vincula o cliente a ele
        let resellerIdToLink: string | null = null;
        try {
          const resellerSlug = getResellerSlug();
          if (resellerSlug) {
            const { data: r } = await supabase.rpc("get_reseller_public_by_slug", { _slug: resellerSlug });
            const row = Array.isArray(r) ? r[0] : r;
            if (row?.id) resellerIdToLink = row.id as string;
          }
        } catch { /* noop */ }
        try {
          const host = window.location.hostname.toLowerCase();
          const isMainHost =
            ["fbflix.com.br", "www.fbflix.com.br", "fbflix1.lovable.app", "localhost"].includes(host) ||
            host.endsWith(".lovableproject.com") ||
            host.endsWith(".lovable.app");
          if (!isMainHost) {
            const { data: slug } = await supabase.rpc("get_reseller_slug_by_domain", { _domain: host });
            if (slug) {
              const { data: r } = await supabase.rpc("get_reseller_public_by_slug", { _slug: slug as string });
              const row = Array.isArray(r) ? r[0] : r;
              if (row?.id) resellerIdToLink = row.id as string;
            }
          }
        } catch { /* noop */ }

        await supabase.from("profiles").update({
          full_name: registerName.trim(),
          referrer_id: partnerRefId || null,
          ...(resellerIdToLink ? { reseller_id: resellerIdToLink } : {}),
        }).eq("user_id", signUpData.user.id);
        // Link earlier anonymous journey events to this newly-created user
        try {
          const visitorId = localStorage.getItem("fbflix_visitor_id");
          if (visitorId) {
            await supabase.rpc("partner_journey_claim_visitor" as any, {
              _visitor_id: visitorId,
              _user_id: signUpData.user.id,
            });
          }
        } catch { /* noop */ }
      }
      toast({
        title: "Conta criada!",
        description: "Você já pode fazer login.",
      });
      navigate(getAuthDestination());
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
           <div className="flex flex-col items-center gap-3">
             <div className="flex flex-col items-center justify-center">
               {branding ? (
                 <>
                   {branding.logo_url ? (
                     <img
                       src={branding.logo_url}
                       alt={branding.brand_name || branding.company_name || "Logo"}
                       className="w-20 h-20 object-contain rounded-xl"
                     />
                   ) : (
                     <div className="w-20 h-20 rounded-xl bg-primary/10 flex items-center justify-center text-2xl font-black text-foreground">
                       {(branding.brand_name || branding.company_name || "?").charAt(0).toUpperCase()}
                     </div>
                   )}
                   <span className="text-sm font-black tracking-[0.2em] text-foreground mt-2 uppercase text-center">
                     {branding.brand_name || branding.company_name}
                   </span>
                 </>
               ) : isCustomDomain || brandingLoading ? (
                 <div className="w-20 h-20 rounded-xl bg-muted/30 animate-pulse" />
               ) : (
                 <>
                   <img src={logoFbflix} alt="FBFLIX" className="w-20 h-20 object-contain" />
                   <span className="text-xs font-black tracking-[0.4em] text-foreground mt-2 -mr-[0.4em]">F B F L I X</span>
                 </>
               )}
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
          {isResetting ? (
            <form onSubmit={handleResetPassword} className="flex flex-col gap-5">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-muted-foreground pl-1">Email da conta</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="material-symbols-outlined text-muted-foreground group-focus-within:text-primary transition-colors text-[20px]">
                        mail
                      </span>
                    </div>
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="w-full bg-card border border-border rounded-xl py-3.5 pl-10 pr-4 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm font-medium"
                      placeholder="seu@email.com"
                      required
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm py-3.5 rounded-xl shadow-[0_0_20px_rgba(220,38,38,0.2)] hover:shadow-[0_0_25px_rgba(220,38,38,0.4)] transition-all duration-300 transform active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? "Enviando..." : "Enviar código no WhatsApp"}
              </button>

              <button
                type="button"
                onClick={() => setIsResetting(false)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors text-center"
              >
                Voltar para o Login
              </button>
            </form>
          ) : isLogin ? (
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
                    <button 
                      type="button" 
                      onClick={() => {
                        setIsResetting(true);
                        setResetEmail(loginEmail);
                      }}
                      className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      Esqueci minha senha
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
                      placeholder="Nome e Sobrenome"
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
                const params = new URLSearchParams(location.search);
                const redirect = params.get("redirect");
                const resellerSlug = getResellerSlug();
                const destination = redirect && redirect.startsWith("/") ? redirect : resellerSlug ? `/r/${resellerSlug}` : "/loja";
                const callbackParams = new URLSearchParams();
                callbackParams.set("redirect", destination);
                if (resellerSlug) callbackParams.set("r", resellerSlug);
                localStorage.setItem("auth_redirect", destination);
                const { error } = await supabase.auth.signInWithOAuth({
                  provider: 'google',
                  options: {
                    redirectTo: `${window.location.origin}/auth?${callbackParams.toString()}`,
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
