import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
  import { Loader2, Send, FileText, CheckCircle2, Clock, AlertCircle, ExternalLink, Copy, ChevronDown, ChevronUp, LayoutDashboard, Hash, Calendar, PackagePlus, Inbox, BriefcaseBusiness, Menu, RefreshCw, History, TrendingUp, ArrowUpRight, ArrowDownRight, DollarSign, Activity } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie } from 'recharts';
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
          {activeTab === 'reposicoes' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-black text-zinc-500 uppercase tracking-widest">Lista de Pedidos para Reposição</p>
                <Badge className="bg-primary/10 text-primary border-primary/20">{requests.length} Pedidos</Badge>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {requests.length === 0 ? (
                  <div className="text-center py-20 bg-black/20 rounded-2xl border border-dashed border-zinc-800">
                    <Inbox className="h-10 w-10 text-zinc-700 mx-auto mb-4"/>
                    <p className="text-zinc-500 font-bold">Nenhum pedido pendente.</p>
                  </div>
                ) : requests.map(req => (
                  <Collapsible 
                    key={req.id} 
                    open={expandedRequests[req.id]} 
                    onOpenChange={() => toggleRequestExpand(req.id)}
                    className="bg-[#0a0a0a] border border-zinc-800 rounded-2xl overflow-hidden shadow-lg transition-all hover:border-zinc-700"
                  >
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-6 text-left hover:bg-white/[0.02]">
                      <div className="flex items-center gap-6">
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-primary uppercase mb-1 flex items-center gap-2">
                            <Hash className="h-3 w-3"/>
                            {req.title || `REQ-${req.id.slice(0, 5)}`}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-black text-white tracking-tight">Reposição Solicitada</span>
                            {req.reason && (
                              <Badge variant="outline" className="border-red-500/30 text-red-400 bg-red-500/5 text-[10px]">
                                MOTIVO: {req.reason.toUpperCase()}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge className={getStatusColor(req.status)}>{getStatusLabel(req.status)}</Badge>
                        <ChevronDown className={`h-5 w-5 text-zinc-500 transition-transform ${expandedRequests[req.id] ? 'rotate-180' : ''}`}/>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="p-6 bg-black/40 border-t border-zinc-800 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <p className="text-xs font-black text-zinc-500 uppercase tracking-widest">Itens para Reposição</p>
                          <div className="space-y-2">
                            {req.items && req.items.length > 0 ? req.items.map((item: any) => (
                              <div key={item.id} className="flex items-center justify-between bg-zinc-900/50 p-3 rounded-xl border border-zinc-800 group">
                                <div className="flex flex-col gap-1 overflow-hidden">
                                  <span className="text-[10px] font-black text-zinc-600 uppercase">IDENTIFICADOR / LINK</span>
                                  <code className="text-xs text-primary truncate pr-4">{item.details}</code>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {item.details.startsWith('http') && (
                                    <Button 
                                      size="icon" 
                                      variant="ghost" 
                                      className="h-8 w-8 text-zinc-400 hover:text-white"
                                      onClick={() => window.open(item.details, '_blank')}
                                    >
                                      <ExternalLink className="h-4 w-4"/>
                                    </Button>
                                  )}
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="h-8 w-8 text-zinc-400 hover:text-white"
                                    onClick={() => copyToClipboard(item.details)}
                                  >
                                    <Copy className="h-4 w-4"/>
                                  </Button>
                                </div>
                              </div>
                            )) : (
                              <p className="text-xs text-zinc-500 italic p-4 bg-black/20 rounded-xl border border-dashed border-zinc-800">
                                Detalhes descritos: {req.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="space-y-4">
                          <p className="text-xs font-black text-zinc-500 uppercase tracking-widest">Realizar Reposição</p>
                          <div className="space-y-4">
                            <Textarea 
                              className="bg-black border-zinc-800 min-h-[160px] font-mono text-xs focus:ring-primary/20 p-4 leading-relaxed" 
                              placeholder="Cole aqui os novos links ou dados dos perfis/BMs para repor os itens acima..."
                              value={content}
                              onChange={e => setContent(e.target.value)}
                            />
                            <div className="flex gap-3">
                              <Button 
                                className="flex-1 bg-primary hover:bg-primary/90 text-white font-black h-12 tracking-tight" 
                                onClick={() => handleSubmit(req.id)} 
                                disabled={submitting}
                              >
                                {submitting ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                                EFETUAR REPOSIÇÃO
                              </Button>
                              <Button 
                                variant="outline" 
                                className="border-zinc-800 text-zinc-500 font-bold" 
                                onClick={() => setExpandedRequests(prev => ({ ...prev, [req.id]: false }))}
                              >
                                CANCELAR
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </div>
          )}
          {activeTab === 'vendas' && <div className="space-y-4">...</div>}
        </div>
      </main>
    </div>
  );
}