import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
  import { Loader2, Send, FileText, CheckCircle2, Clock, AlertCircle, ExternalLink, Copy, ChevronDown, ChevronUp, LayoutDashboard, Hash, Calendar, PackagePlus, Inbox, BriefcaseBusiness, Menu } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function FornecedorPublicPage() {
  const [token, setToken] = useState(localStorage.getItem("supplier_token") || "");
  const [rememberMe, setRememberMe] = useState(true);
  const [isAuth, setIsAuth] = useState(false);
  const [supplier, setSupplier] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  
  // Upload state
  const [activeTab, setActiveTab] = useState("dashboard");
  const [type, setType] = useState<"perfil" | "bm">("perfil");
  const [content, setContent] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expandedRequests, setExpandedRequests] = useState<Record<string, boolean>>({});
  const [offerContent, setOfferContent] = useState("");

  const handleAuth = async () => {
    if (token.length < 8) {
      toast.error("O token deve ter pelo menos 8 dígitos");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name, status")
        .eq("access_token", token)
        .eq("status", "active")
        .maybeSingle();

      if (error || !data) {
        toast.error("Token inválido ou fornecedor inativo");
        setLoading(false);
        return;
      }

      setSupplier(data);
      setIsAuth(true);
      fetchRequests(data.id);
      toast.success("Acesso liberado, " + data.name);
    } catch (err) {
      toast.error("Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  };

   const fetchRequests = async (supplierId: string) => {
     const { data, error } = await supabase
       .from("supplier_requests")
       .select(`
         *,
         items:supplier_request_items(*)
       `)
       .eq("supplier_id", supplierId)
       .order("created_at", { ascending: false });
     
     if (error) {
       console.error("Error fetching requests:", error);
       return;
     }
     setRequests(data || []);
   };

   const getStatusLabel = (status: string) => {
     const labels: Record<string, string> = {
       'pending_replenishment': 'Aguardando Reposição',
       'accepted': 'Aceito',
       'testing': 'Em Teste',
       'completed': 'Concluído',
       'pending': 'Pendente'
     };
     return labels[status] || status;
   };

   const getStatusColor = (status: string) => {
     const colors: Record<string, string> = {
       'pending_replenishment': 'bg-yellow-500/20 text-yellow-500',
       'accepted': 'bg-blue-500/20 text-blue-500',
       'testing': 'bg-purple-500/20 text-purple-500',
       'completed': 'bg-green-500/20 text-green-500',
       'pending': 'bg-zinc-500/20 text-zinc-400'
     };
     return colors[status] || 'bg-zinc-500/20 text-zinc-400';
   };

   const copyToClipboard = (text: string) => {
     navigator.clipboard.writeText(text);
     toast.success("Copiado para a área de transferência");
   };

  const toggleRequestExpand = (requestId: string) => {
    setExpandedRequests(prev => ({
      ...prev,
      [requestId]: !prev[requestId]
    }));
  };

  const handleSubmit = async (requestId?: string) => {
    if (!content.trim()) {
      toast.error("Insira o conteúdo (links ou dados)");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create batch
      const { data: batch, error: batchError } = await supabase
        .from("supplier_batches")
        .insert({
          supplier_id: supplier.id,
          name: requestId 
            ? `Reposição via Portal - Req #${requestId.slice(0, 4)}`
            : `Envio Fornecedor (${type}) - ${new Date().toLocaleDateString("pt-BR")}`,
          notes: notes || (requestId ? `Reposição para solicitação ${requestId}` : `Envio via portal público`),
          purchased_at: new Date().toISOString().split('T')[0],
          type: "replacement"
        })
        .select()
        .single();

      if (batchError) throw batchError;

      // 2. Simple parse and insert
      const lines = content.split('\n').filter(l => l.trim());
      const accounts = lines.map(line => ({
        batch_id: batch.id,
        supplier_id: supplier.id,
        login: type === "bm" ? "BM_PORTAL" : (line.split('|')[0] || line).trim(),
        password: type === "bm" ? "N/A" : (line.split('|')[1] || "").trim(),
        notes: line,
        status: "aguardando",
        has_bm: type === "bm"
      }));

      const { error: insertError } = await supabase.from("supplier_accounts").insert(accounts);
      if (insertError) throw insertError;

      toast.success(`${accounts.length} itens enviados com sucesso! Nossa equipe irá auditar.`);
      setContent("");
      setNotes("");
      
      if (requestId) {
        setExpandedRequests(prev => ({ ...prev, [requestId]: false }));
      }
    } catch (err: any) {
      toast.error("Erro ao enviar: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuth) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-[#0a0a0a] border-zinc-800 shadow-2xl p-6">
          <CardHeader className="text-center pb-8">
            <div className="text-3xl font-black text-primary tracking-tighter mb-2">FBFLIX</div>
            <CardTitle className="text-xl font-bold text-white">Portal do Fornecedor</CardTitle>
            <p className="text-zinc-500 text-sm">Autenticação obrigatória para acessar pedidos.</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase">Token de Acesso</label>
                <Input 
                  placeholder="Digite seu token de 8 dígitos" 
                  value={token} 
                  onChange={e => setToken(e.target.value)}
                  className="bg-black border-zinc-800 text-white text-center text-lg tracking-[0.5em] h-14 font-mono"
                  maxLength={8}
                />
              </div>
              <div className="flex items-center space-x-2 px-1">
                <input 
                  type="checkbox" 
                  id="remember" 
                  checked={rememberMe} 
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-800 bg-zinc-900 text-primary focus:ring-primary"
                />
                <label htmlFor="remember" className="text-sm text-zinc-500 cursor-pointer select-none">
                  Manter conectado neste navegador
                </label>
              </div>
            </div>
            <Button 
              className="w-full bg-primary hover:bg-primary/90 text-white h-14 font-bold text-lg" 
              onClick={handleAuth}
              disabled={loading}
            >
              {loading ? <Loader2 className="animate-spin mr-2" /> : "Entrar no Painel"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex">
      <aside className="w-64 bg-[#0a0a0a] border-r border-zinc-800 p-6 flex flex-col gap-10">
        <div className="text-2xl font-black text-primary tracking-tighter">FBFLIX <span className="text-white text-sm font-medium block mt-1">Fornecedor</span></div>
        <nav className="flex flex-col gap-2 flex-1">
          <Button variant={activeTab === 'dashboard' ? 'default' : 'ghost'} className="justify-start gap-3 h-12" onClick={() => setActiveTab('dashboard')}><LayoutDashboard className="h-5 w-5"/> Dashboard</Button>
          <Button variant={activeTab === 'reposicoes' ? 'default' : 'ghost'} className="justify-start gap-3 h-12" onClick={() => setActiveTab('reposicoes')}><Inbox className="h-5 w-5"/> Reposições</Button>
          <Button variant={activeTab === 'vendas' ? 'default' : 'ghost'} className="justify-start gap-3 h-12" onClick={() => setActiveTab('vendas')}><BriefcaseBusiness className="h-5 w-5"/> Vender</Button>
        </nav>
        <Button variant="ghost" className="justify-start text-zinc-500 hover:text-red-400" onClick={() => setIsAuth(false)}>Sair</Button>
      </aside>
      <main className="flex-1 bg-[#09090b]">
        <div className="h-20 border-b border-zinc-800 flex items-center px-10 justify-between">
          <h2 className="text-xl font-bold uppercase tracking-wider">{activeTab}</h2>
          <div className="flex items-center gap-3">
            <Badge className="bg-zinc-800 text-white border-zinc-700">{supplier.name}</Badge>
          </div>
        </div>
        <div className="p-10">
          {activeTab === 'dashboard' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="col-span-2 bg-[#0a0a0a] border-zinc-800 p-6"><CardTitle className="mb-4 text-sm font-bold text-zinc-500 uppercase tracking-widest">Resumo de Atividade</CardTitle></Card>
              <Card className="bg-[#0a0a0a] border-zinc-800 p-6"><CardTitle className="mb-4 text-sm font-bold text-zinc-500 uppercase tracking-widest">Status da Conta</CardTitle></Card>
            </div>
          )}
          {activeTab === 'reposicoes' && <div className="space-y-4">...</div>}
          {activeTab === 'vendas' && <div className="space-y-4">...</div>}
        </div>
      </main>
    </div>
  );
}