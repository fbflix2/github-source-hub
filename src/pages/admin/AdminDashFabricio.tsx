import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, Eye, EyeOff, KeyRound } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { FbFinanceDashboard } from "@/components/admin/fb-finance/FbFinanceDashboard";

export default function AdminDashFabricio() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isFirstAccess, setIsFirstAccess] = useState<boolean | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkConfig();
  }, []);

  const checkConfig = async () => {
    const { data } = await supabase
      .from("fb_finance_config" as any)
      .select("id")
      .limit(1);
    setIsFirstAccess(!data || (data as any[]).length === 0);
    setLoading(false);
  };

  const simpleHash = async (text: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  };

  const handleSetPassword = async () => {
    if (password.length < 4) {
      toast({ title: "Senha deve ter pelo menos 4 caracteres", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Senhas não coincidem", variant: "destructive" });
      return;
    }
    const hash = await simpleHash(password);
    const { error } = await supabase
      .from("fb_finance_config" as any)
      .insert({ password_hash: hash } as any);
    if (error) {
      toast({ title: "Erro ao salvar senha", variant: "destructive" });
      return;
    }
    setAuthenticated(true);
    toast({ title: "Senha cadastrada com sucesso!" });
  };

  const handleLogin = async () => {
    const hash = await simpleHash(password);
    const { data } = await supabase
      .from("fb_finance_config" as any)
      .select("password_hash")
      .limit(1)
      .single();
    if ((data as any)?.password_hash === hash) {
      setAuthenticated(true);
    } else {
      toast({ title: "Senha incorreta", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (authenticated) {
    return <FbFinanceDashboard />;
  }

  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className="w-full max-w-md p-8 rounded-2xl bg-[#0c1929] border border-blue-900/30 shadow-2xl">
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <KeyRound className="size-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Fb Finance Dashboard</h1>
          <p className="text-blue-300/60 text-sm text-center">
            {isFirstAccess
              ? "Primeiro acesso — cadastre uma senha para proteger seu painel financeiro."
              : "Digite sua senha para acessar o painel financeiro."}
          </p>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-blue-400/50" />
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !isFirstAccess && handleLogin()}
              className="pl-10 pr-10 bg-[#0a1420] border-blue-900/30 text-white placeholder:text-blue-400/30 focus:border-blue-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-400/50 hover:text-blue-300"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>

          {isFirstAccess && (
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-blue-400/50" />
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Confirmar senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10 bg-[#0a1420] border-blue-900/30 text-white placeholder:text-blue-400/30 focus:border-blue-500"
              />
            </div>
          )}

          <Button
            onClick={isFirstAccess ? handleSetPassword : handleLogin}
            className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-semibold h-11"
          >
            {isFirstAccess ? "Cadastrar e Entrar" : "Entrar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
