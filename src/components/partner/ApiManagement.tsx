import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Key, Copy, Check, Terminal, Code2, Loader2, AlertCircle, Plus, Trash2, Globe, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ApiManagement() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [b2bTokens, setB2bTokens] = useState<any[]>([]);
  const [loadingB2b, setLoadingB2b] = useState(false);

  const fetchSession = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      setToken(session.access_token);
    }
    setLoading(false);
  };

  const fetchB2bTokens = async () => {
    setLoadingB2b(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data, error } = await supabase
        .from("b2b_tokens")
        .select("*")
        .eq("user_id", session.user.id)
        .order('created_at', { ascending: false });
      if (!error && data) {
        setB2bTokens(data);
      }
    }
    setLoadingB2b(false);
  };

  useEffect(() => {
    fetchSession();
    fetchB2bTokens();
  }, []);

  const handleCopy = () => {
    if (!token) return;
    navigator.clipboard.writeText(token);
    setCopied(true);
    toast.success("Token copiado com sucesso!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado com sucesso!");
  };

  const generateB2bToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const newToken = `fbx_b2b_${crypto.randomUUID().replace(/-/g, '')}`;
    
    const { error } = await supabase
      .from("b2b_tokens")
      .insert({
        user_id: session.user.id,
        token: newToken,
        name: `Integração Fixa - ${new Date().toLocaleDateString('pt-BR')}`
      });

    if (error) {
      toast.error("Erro ao gerar token B2B");
    } else {
      toast.success("Token B2B permanente gerado!");
      fetchB2bTokens();
    }
  };

  const deleteB2bToken = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este token? Integrações usando ele pararão de funcionar.")) return;
    
    const { error } = await supabase
      .from("b2b_tokens")
      .delete()
      .eq("id", id);
    
    if (error) {
      toast.error("Erro ao excluir token");
    } else {
      toast.success("Token excluído!");
      fetchB2bTokens();
    }
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

        <div className="pt-2">
          <p className="text-[11px] text-muted-foreground italic">
            * Este token JWT é temporário e expira automaticamente. Utilize-o apenas para testes rápidos.
          </p>
        </div>
      </div>

      {/* B2B Permanent Tokens Section */}
      <div className="glass-panel p-6 rounded-2xl space-y-6 border-primary/20 bg-primary/5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Globe className="size-4 text-primary" />
              <h4 className="text-sm font-bold">Tokens B2B Permanentes</h4>
              <Badge className="bg-green-500/20 text-green-400 text-[10px] border-green-500/20">
                Longa Duração
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Estes tokens não expiram e são ideais para integrações fixas em servidores.
            </p>
          </div>
          <Button 
            size="sm" 
            onClick={generateB2bToken} 
            className="bg-primary hover:bg-primary/90 text-[11px] h-8 font-bold"
          >
            <Plus className="size-3 mr-1" /> Gerar Novo Token B2B
          </Button>
        </div>

        <div className="space-y-3">
          {loadingB2b ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="size-5 animate-spin text-primary" />
            </div>
          ) : b2bTokens.length > 0 ? (
            b2bTokens.map((t) => (
              <div key={t.id} className="bg-black/30 border border-white/5 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-200 truncate">{t.name}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${t.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                      {t.status === 'active' ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[10px] text-gray-500">
                    <span className="truncate">{t.token.substring(0, 12)}...{t.token.substring(t.token.length - 8)}</span>
                    <button 
                      onClick={() => handleCopyText(t.token)}
                      className="text-primary hover:text-primary/80"
                    >
                      <Copy className="size-3" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:bg-red-500/10"
                    onClick={() => deleteB2bToken(t.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-6 bg-black/20 rounded-xl border border-dashed border-white/10">
              <p className="text-xs text-muted-foreground">Você ainda não possui nenhum token permanente.</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-4 pt-2 border-t border-white/5">
          <Button 
            variant="link" 
            className="p-0 h-auto text-primary text-xs font-bold"
            onClick={() => window.open("/api-docs", "_blank")}
          >
            <Terminal className="size-3 mr-1" /> Documentação API →
          </Button>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground ml-auto">
            <Zap className="size-3 text-yellow-500" />
            Uso ilimitado
          </div>
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
