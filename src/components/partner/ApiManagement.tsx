import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Key, Copy, Check, Terminal, Code2, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ApiManagement() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const fetchSession = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      setToken(session.access_token);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSession();
  }, []);

  const handleCopy = () => {
    if (!token) return;
    navigator.clipboard.writeText(token);
    setCopied(true);
    toast.success("Token copiado com sucesso!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Code2 className="text-primary size-6" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-foreground">Desenvolvedor & API</h3>
          <p className="text-sm text-muted-foreground text-pretty">Acesse sua chave de autorização para integração externa.</p>
        </div>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3">
        <AlertCircle className="size-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-bold text-amber-500">Atenção com a segurança</p>
          <p className="text-xs text-amber-200/70">
            Seu Token de Acesso é pessoal e intransferível. Ele permite realizar compras usando seu saldo. 
            Nunca compartilhe este token com terceiros.
          </p>
        </div>
      </div>

      <div className="glass-panel p-6 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="size-4 text-primary" />
            <span className="text-sm font-bold">Seu Token JWT (Bearer)</span>
          </div>
          <Badge variant="outline" className="text-[10px] font-mono border-primary/20 text-primary">
            Expira em 1 hora
          </Badge>
        </div>

        <div className="relative group">
          <div className="bg-black/40 border border-white/10 rounded-xl p-4 pr-12 font-mono text-[10px] break-all leading-relaxed min-h-[80px] text-gray-400">
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="size-3 animate-spin" /> Gerando token seguro...
              </div>
            ) : token}
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-2 right-2 h-8 w-8 text-white hover:bg-white/10"
            onClick={handleCopy}
            disabled={loading || !token}
          >
            {copied ? <Check className="size-4 text-green-500" /> : <Copy className="size-4" />}
          </Button>
        </div>

        <div className="pt-2 flex flex-col gap-2">
          <p className="text-[11px] text-muted-foreground">
            Este token é baseado na sua sessão atual. Para integrações fixas de longa duração, contate o suporte para solicitar um Token B2B permanente.
          </p>
          <Button 
            variant="link" 
            className="p-0 h-auto text-primary text-xs justify-start w-fit font-bold"
            onClick={() => window.open("/api-docs", "_blank")}
          >
            Ver documentação de implementação →
          </Button>
        </div>
      </div>
    </div>
  );
}

function Badge({ children, variant, className }: any) {
  return (
    <span className={`px-2 py-0.5 rounded-full ${variant === "outline" ? "border" : "bg-primary"} ${className}`}>
      {children}
    </span>
  );
}
