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
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-zinc-900 border-zinc-800">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-white">Portal do Fornecedor</CardTitle>
            <p className="text-zinc-400 text-sm">Informe seu token de acesso para continuar</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input 
              placeholder="Digite seu token de 8 dígitos" 
              value={token} 
              onChange={e => setToken(e.target.value)}
              className="bg-black border-zinc-700 text-white text-center text-lg tracking-widest"
              maxLength={8}
            />
            <Button 
              className="w-full bg-primary hover:bg-primary/90 text-white" 
              onClick={handleAuth}
              disabled={loading}
            >
              {loading ? <Loader2 className="animate-spin mr-2" /> : "Acessar Portal"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] flex text-white font-sans">
      {/* Sidebar */}
      <div className="w-64 bg-zinc-900 border-r border-zinc-800 p-6 flex flex-col gap-8">
        <div className="text-xl font-black text-primary">PORTAL FORNECEDOR</div>
        <nav className="space-y-2 flex-1">
          <Button variant={activeTab === 'dashboard' ? 'secondary' : 'ghost'} className="w-full justify-start" onClick={() => setActiveTab('dashboard')}><LayoutDashboard className="h-4 w-4 mr-2"/> Dashboard</Button>
          <Button variant={activeTab === 'reposicoes' ? 'secondary' : 'ghost'} className="w-full justify-start" onClick={() => setActiveTab('reposicoes')}><Inbox className="h-4 w-4 mr-2"/> Solicitações</Button>
          <Button variant={activeTab === 'vendas' ? 'secondary' : 'ghost'} className="w-full justify-start" onClick={() => setActiveTab('vendas')}><PackagePlus className="h-4 w-4 mr-2"/> Ofertas de Venda</Button>
        </nav>
        <Button variant="ghost" className="justify-start text-zinc-500" onClick={() => setIsAuth(false)}>Sair</Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black text-white capitalize">{activeTab}</h1>
            <p className="text-zinc-400">Olá, {supplier.name}. Seja bem vindo!</p>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-zinc-900 border-zinc-800 p-6">
              <CardHeader className="p-0 pb-4"><CardTitle>Enviar Reposição Rápida</CardTitle></CardHeader>
              <div className="space-y-4">
                <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Cole seus dados aqui..." className="bg-black border-zinc-800 min-h-[150px]"/>
                <Button className="w-full bg-primary" onClick={() => handleSubmit()} disabled={submitting}>Enviar</Button>
              </div>
            </Card>
            <Card className="bg-zinc-900 border-zinc-800 p-6">
              <CardHeader className="p-0 pb-4"><CardTitle>Resumo</CardTitle></CardHeader>
              <p className="text-zinc-500">Total solicitações: {requests.length}</p>
            </Card>
          </div>
        )}

        {activeTab === 'reposicoes' && (
           <div className="space-y-4">
             {requests.map(req => (
                <Collapsible key={req.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                  <CollapsibleTrigger className="flex justify-between w-full">
                    <span className="font-bold">{req.title}</span>
                    <ChevronDown className="h-4 w-4"/>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-4 pt-4 border-t border-zinc-800">
                    <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Responder com links..."/>
                    <Button className="mt-2" onClick={() => handleSubmit(req.id)}>Responder</Button>
                  </CollapsibleContent>
                </Collapsible>
             ))}
           </div>
        )}

        {activeTab === 'vendas' && (
          <Card className="bg-zinc-900 border-zinc-800 p-6">
            <CardHeader className="p-0 pb-4"><CardTitle>Cadastrar Oferta de Produto</CardTitle></CardHeader>
            <Textarea value={offerContent} onChange={e => setOfferContent(e.target.value)} placeholder="Descreva o produto, preço e quantidade..." className="bg-black border-zinc-800 min-h-[150px]"/>
            <Button className="w-full mt-4" onClick={() => toast.success("Oferta enviada!")}>Enviar Oferta</Button>
          </Card>
        )}
      </div>
    </div>
  );
}