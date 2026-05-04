 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, FileText, CheckCircle2, Clock, AlertCircle, ExternalLink, Copy, ChevronDown, ChevronUp, LayoutDashboard, Hash, Calendar, PackagePlus, Inbox, BriefcaseBusiness, Menu, RefreshCw, History, TrendingUp, ArrowUpRight, ArrowDownRight, DollarSign, Activity, Users, IdCard, KeyRound, Mail, Lock, AtSign, ShieldCheck, ShieldAlert, Award, Search, CreditCard, Plus, Trash2, ShoppingBag } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie } from 'recharts';
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
  const [filterType, setFilterStatus] = useState<string>("all");
  const [filterItemType, setFilterItemType] = useState<string>("all");
  
  // Upload state
  const [activeTab, setActiveTab] = useState("dashboard");
  const [type, setType] = useState<"perfil" | "bm">("perfil");
  const [content, setContent] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expandedRequests, setExpandedRequests] = useState<Record<string, boolean>>({});
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [newPaymentType, setNewPaymentType] = useState("pix"); // 'pix' or 'bank'
  const [pixType, setPixType] = useState("cpf"); // 'cpf', 'email', 'phone', 'random'
  const [pixKey, setPixKey] = useState("");
  const [bankData, setBankData] = useState({ bank: "", agency: "", account: "", holder: "", document: "" });
   const [offerData, setOfferData] = useState({ type: "bm" as "bm" | "perfil", description: "", price: "", content: "" });
   const [replenishItemContent, setReplenishItemContent] = useState<Record<string, string>>({});
   const [selectedRequest, setSelectedRequest] = useState<any>(null);
   const [purchaseRequests, setPurchaseRequests] = useState<any[]>([]);

  useEffect(() => {
    const savedToken = localStorage.getItem("supplier_token");
    if (savedToken && !isAuth) {
      autoAuth(savedToken);
    }
  }, []);

  const autoAuth = async (tokenToUse: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name, status")
        .eq("access_token", tokenToUse)
        .eq("status", "active")
        .maybeSingle();

      if (!error && data) {
        setSupplier(data);
        setIsAuth(true);
        fetchRequests(data.id);
        fetchPaymentMethods(data.id);
        fetchPurchaseRequests();
      }
    } catch (err) {
      console.error("Auto-auth failed");
    } finally {
      setLoading(false);
    }
  };

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
      fetchPaymentMethods(data.id);
      
      if (rememberMe) {
        localStorage.setItem("supplier_token", token);
      } else {
        localStorage.removeItem("supplier_token");
      }
      
      toast.success("Acesso liberado, " + data.name);
    } catch (err) {
      toast.error("Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentMethods = async (supplierId: string) => {
    const { data, error } = await supabase
      .from("supplier_payment_methods")
      .select("*")
      .eq("supplier_id", supplierId)
      .order("created_at", { ascending: false });
    
    if (error) {
      console.error("Error fetching payment methods:", error);
      return;
    }
    setPaymentMethods(data || []);
  };

  const validatePix = (type: string, key: string) => {
    if (!key.trim()) return "Informe a chave PIX";
    if (type === 'cpf' && !/^\d{11}$|^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(key)) return "CPF inválido";
    if (type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key)) return "E-mail inválido";
    if (type === 'phone' && !/^\d{10,11}$/.test(key.replace(/\D/g, ''))) return "Telefone inválido";
    return null;
  };

  const handleAddPaymentMethod = async () => {
    let details = "";
    if (newPaymentType === 'pix') {
      const error = validatePix(pixType, pixKey);
      if (error) {
        toast.error(error);
        return;
      }
       if (!bankData.bank || !bankData.holder) {
         toast.error("Preencha o banco e o nome do titular");
         return;
       }
       details = `PIX (${pixType.toUpperCase()}) | ${bankData.bank} | Chave: ${pixKey} | Titular: ${bankData.holder}`;
    } else {
      if (!bankData.bank || !bankData.agency || !bankData.account || !bankData.holder) {
        toast.error("Preencha todos os dados bancários");
        return;
      }
      details = `${bankData.bank} | Ag: ${bankData.agency} | Cc: ${bankData.account} | Titular: ${bankData.holder}`;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("supplier_payment_methods")
        .insert({
          supplier_id: supplier.id,
          type: newPaymentType,
          details: details,
          is_primary: paymentMethods.length === 0
        })
        .select()
        .single();

      if (error) throw error;

      setPaymentMethods([data, ...paymentMethods]);
      setPixKey("");
      setBankData({ bank: "", agency: "", account: "", holder: "", document: "" });
      toast.success("Forma de recebimento cadastrada!");
    } catch (err: any) {
      toast.error("Erro ao cadastrar: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };


  const handleDeletePaymentMethod = async (id: string) => {
    try {
      const { error } = await supabase
        .from("supplier_payment_methods")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setPaymentMethods(paymentMethods.filter(pm => pm.id !== id));
      toast.success("Removido com sucesso");
    } catch (err: any) {
      toast.error("Erro ao remover: " + err.message);
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

   const fetchPurchaseRequests = async () => {
     const { data, error } = await supabase
       .from("purchase_requests")
       .select("*")
       .eq("status", "open")
       .order("created_at", { ascending: false });
     
     if (!error) setPurchaseRequests(data || []);
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

   const handleSubmit = async (requestId?: string, itemId?: string) => {
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
          notes: notes || (itemId 
            ? `Reposição individual para item ${itemId} da solicitação ${requestId}` 
            : requestId ? `Reposição para solicitação ${requestId}` : `Envio via portal público`),
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

      // If it's a specific item replacement, we might want to mark just that item
      // But for now, we'll keep the current logic of notifying the team for audit
      if (itemId) {
        // Update item details in local state to show it was replied if we had a status there
        // Or just show the success toast
      }

      toast.success(`${accounts.length} itens enviados com sucesso! Nossa equipe irá auditar.`);
      setContent("");
      setNotes("");
      
      if (requestId) {
        if (!itemId) {
          setExpandedRequests(prev => ({ ...prev, [requestId]: false }));
        } else {
          // If it was an individual item, refresh the selected request to show any state changes if needed
          const updatedRequests = requests.map(r => {
            if (r.id === requestId) {
              // We'd ideally fetch again, but for now just clear the input
              return r;
            }
            return r;
          });
        }
      }
    } catch (err: any) {
      toast.error("Erro ao enviar: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOffer = async () => {
    if (!offerData.description || !offerData.price) {
      toast.error("Preencha a descrição e o preço da oferta");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("supplier_batches")
        .insert({
          supplier_id: supplier.id,
          name: `Oferta: ${offerData.type.toUpperCase()} - ${offerData.description}`,
          notes: `OFERTA DE VENDA\nTipo: ${offerData.type}\nPreço sugerido: R$ ${offerData.price}\nDescrição: ${offerData.description}\nConteúdo: ${offerData.content}`,
          purchased_at: new Date().toISOString().split('T')[0],
          type: "offer"
        });

      if (error) throw error;

      toast.success("Sua oferta foi enviada! Nossa equipe analisará em breve.");
      setOfferData({ type: "bm", description: "", price: "", content: "" });
    } catch (err: any) {
      toast.error("Erro ao enviar oferta: " + err.message);
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
          <Button variant={activeTab === 'compras' ? 'default' : 'ghost'} className="justify-start gap-3 h-12" onClick={() => setActiveTab('compras')}><ShoppingBag className="h-5 w-5"/> Solicitações de Compra</Button>
          <Button variant={activeTab === 'vendas' ? 'default' : 'ghost'} className="justify-start gap-3 h-12" onClick={() => setActiveTab('vendas')}><BriefcaseBusiness className="h-5 w-5"/> Vender</Button>
          <Button variant={activeTab === 'financeiro' ? 'default' : 'ghost'} className="justify-start gap-3 h-12" onClick={() => setActiveTab('financeiro')}><CreditCard className="h-5 w-5"/> Financeiro</Button>
        </nav>
        <Button variant="ghost" className="justify-start text-zinc-500 hover:text-red-400" onClick={() => {
          localStorage.removeItem("supplier_token");
          setIsAuth(false);
        }}>Sair</Button>
      </aside>
      <main className="flex-1 bg-[#09090b]">
        <div className="h-20 border-b border-zinc-800 flex items-center px-10 justify-between">
          <h2 className="text-xl font-bold uppercase tracking-wider">{activeTab}</h2>
          <div className="flex items-center gap-3">
            <Badge className="bg-zinc-800 text-white border-zinc-700">{supplier.name}</Badge>
          </div>
        </div>
        <div className="p-6">
          {activeTab === 'dashboard' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-[#0a0a0a] border-zinc-800 p-4 flex flex-col gap-3 relative overflow-hidden group">
                  <div className="absolute -right-2 -top-2 bg-primary/5 rounded-full p-6 transition-transform group-hover:scale-110"><DollarSign className="h-6 w-6 text-primary/20"/></div>
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-500/10 rounded-lg"><TrendingUp className="h-3.5 w-3.5 text-emerald-500"/></div>
                    <span className="text-xs font-black text-zinc-500 uppercase tracking-widest">Saldo a Receber</span>
                  </div>
                   <div className="space-y-0.5">
                     <span className="text-xl font-black text-white">R$ 0,00</span>
                     <div className="flex items-center gap-1 text-[9px] text-zinc-500 font-bold italic">Processando...</div>
                   </div>
                </Card>
                
                <Card className="bg-[#0a0a0a] border-zinc-800 p-4 flex flex-col gap-3 relative overflow-hidden group">
                  <div className="absolute -right-2 -top-2 bg-primary/5 rounded-full p-6 transition-transform group-hover:scale-110"><Activity className="h-6 w-6 text-primary/20"/></div>
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-primary/10 rounded-lg"><Clock className="h-3.5 w-3.5 text-primary"/></div>
                    <span className="text-xs font-black text-zinc-500 uppercase tracking-widest">Aguardando Reposição</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-xl font-black text-white">{requests.filter(r => r.status === 'pending_replenishment').length}</span>
                    <div className="flex items-center gap-1 text-[9px] text-zinc-500 font-bold italic">Média: 4h</div>
                  </div>
                </Card>

                <Card className="bg-[#0a0a0a] border-zinc-800 p-4 flex flex-col gap-3 relative overflow-hidden group">
                  <div className="absolute -right-2 -top-2 bg-primary/5 rounded-full p-6 transition-transform group-hover:scale-110"><PackagePlus className="h-6 w-6 text-primary/20"/></div>
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-500/10 rounded-lg"><Send className="h-3.5 w-3.5 text-blue-500"/></div>
                    <span className="text-xs font-black text-zinc-500 uppercase tracking-widest">Total Enviado</span>
                  </div>
                   <div className="space-y-0.5">
                     <span className="text-xl font-black text-white">0</span>
                     <div className="flex items-center gap-1 text-[9px] text-zinc-500 font-bold italic">Aguardando envios</div>
                   </div>
                </Card>

                <Card className="bg-[#0a0a0a] border-zinc-800 p-4 flex flex-col gap-3 relative overflow-hidden group">
                  <div className="absolute -right-2 -top-2 bg-primary/5 rounded-full p-6 transition-transform group-hover:scale-110"><BriefcaseBusiness className="h-6 w-6 text-primary/20"/></div>
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-zinc-800 rounded-lg"><Activity className="h-3.5 w-3.5 text-zinc-400"/></div>
                    <span className="text-xs font-black text-zinc-500 uppercase tracking-widest">Health Score</span>
                  </div>
                   <div className="space-y-1">
                     <span className="text-xl font-black text-zinc-500">N/A</span>
                     <div className="flex items-center gap-1 w-20">
                       {[1,2,3,4,5].map(i => <div key={i} className="h-1 flex-1 bg-zinc-800 rounded-full"/>)}
                     </div>
                   </div>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 bg-[#0a0a0a] border-zinc-800 p-6 shadow-2xl">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <CardTitle className="text-sm font-black text-zinc-500 uppercase tracking-widest mb-1 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4"/> Performance de Vendas
                      </CardTitle>
                      <p className="text-[10px] text-zinc-600 font-bold uppercase">Volume de faturamento nos últimos 7 dias</p>
                    </div>
                  </div>
                   <div className="h-[240px] w-full flex items-center justify-center border border-dashed border-zinc-800 rounded-xl bg-zinc-950/20">
                     <div className="text-center space-y-2">
                       <Activity className="h-8 w-8 text-zinc-800 mx-auto" />
                       <p className="text-[10px] font-black text-zinc-700 uppercase tracking-widest">Sem dados de performance no momento</p>
                     </div>
                   </div>
                </Card>

                <div className="space-y-6">
                  <Card className="bg-[#0a0a0a] border-zinc-800 p-6 shadow-2xl flex flex-col h-full">
                    <CardTitle className="text-sm font-black text-zinc-500 uppercase tracking-widest mb-6 flex items-center justify-between">
                      Solicitação de Compra
                      <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] uppercase font-black animate-pulse">Live</Badge>
                    </CardTitle>
                    
                    <div className="flex-1 space-y-4 overflow-y-auto max-h-[350px] pr-2 custom-scrollbar">
                      {purchaseRequests.length === 0 ? (
                        <div className="text-center py-10 opacity-40">
                          <PackagePlus className="h-8 w-8 mx-auto mb-2" />
                          <p className="text-[10px] font-bold uppercase tracking-widest">Nenhuma demanda no momento</p>
                        </div>
                      ) : (
                        purchaseRequests.map((req) => (
                          <div key={req.id} className="bg-zinc-900/50 border border-zinc-800 p-3 rounded-xl space-y-2 hover:border-primary/30 transition-all group">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <div className="text-xs font-black text-white group-hover:text-primary transition-colors">{req.title}</div>
                                <div className="flex gap-2">
                                  <Badge className="bg-zinc-800 text-zinc-400 text-[8px] uppercase font-black">{req.type}</Badge>
                                  <Badge className="bg-emerald-500/10 text-emerald-500 text-[8px] uppercase font-black">Qtd: {req.quantity}</Badge>
                                </div>
                              </div>
                            </div>
                            {req.description && <p className="text-[10px] text-zinc-500 line-clamp-2 leading-relaxed">{req.description}</p>}
                            <Button 
                              variant="outline" 
                              className="w-full h-7 text-[9px] font-black uppercase tracking-widest border-zinc-800 hover:bg-primary hover:text-white hover:border-primary"
                              onClick={() => {
                                setActiveTab('vendas');
                                setOfferData({ ...offerData, type: req.type as "bm" | "perfil", description: req.title });
                              }}
                            >
                              Ofertar agora
                            </Button>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="mt-6 pt-6 border-t border-zinc-800/50">
                      <p className="text-[9px] text-zinc-500 font-bold italic text-center">
                        Deseja vender algo que não está na lista? <br/> 
                        Use a aba <span className="text-primary cursor-pointer hover:underline" onClick={() => setActiveTab('vendas')}>Vendas</span> para ofertar.
                      </p>
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'reposicoes' && (
            <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-700">
              <div className="flex flex-col md:flex-row gap-3 items-center bg-[#0a0a0a]/80 backdrop-blur-md p-3 rounded-2xl border border-zinc-800/50 shadow-2xl">
                <div className="flex-1 flex gap-3 items-center w-full px-2">
                  <Search className="h-4 w-4 text-zinc-500" />
                  <Tabs value={filterItemType} onValueChange={setFilterItemType} className="flex-1">
                    <TabsList className="bg-black/40 border border-zinc-800/50 w-full h-8 p-1">
                      <TabsTrigger value="all" className="flex-1 data-[state=active]:bg-zinc-800 font-black text-[8px] uppercase tracking-widest">Todos</TabsTrigger>
                      <TabsTrigger value="bm" className="flex-1 data-[state=active]:bg-zinc-800 font-black text-[8px] uppercase tracking-widest">BMs</TabsTrigger>
                      <TabsTrigger value="perfil" className="flex-1 data-[state=active]:bg-zinc-800 font-black text-[8px] uppercase tracking-widest">Perfis</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                <div className="h-4 w-px bg-zinc-800 hidden md:block" />
                <div className="flex-1 w-full px-2">
                  <Tabs value={filterType} onValueChange={setFilterStatus} className="w-full">
                    <TabsList className="bg-black/40 border border-zinc-800/50 w-full h-8 p-1">
                      <TabsTrigger value="all" className="flex-1 data-[state=active]:bg-zinc-800 font-black text-[8px] uppercase tracking-widest">Status</TabsTrigger>
                      <TabsTrigger value="pending" className="flex-1 data-[state=active]:bg-zinc-800 font-black text-[8px] uppercase tracking-widest text-yellow-500/80">Pendentes</TabsTrigger>
                      <TabsTrigger value="completed" className="flex-1 data-[state=active]:bg-zinc-800 font-black text-[8px] uppercase tracking-widest text-emerald-500/80">Concluídos</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {requests
                  .filter(r => {
                    if (r.type === 'purchase') return false;
                    const matchesStatus = filterType === 'all' 
                      ? true 
                      : filterType === 'pending' 
                        ? r.status !== 'completed' 
                        : r.status === 'completed';
                    const matchesType = filterItemType === 'all'
                      ? true
                      : filterItemType === 'bm'
                        ? r.title?.toLowerCase().includes('bm')
                        : r.title?.toLowerCase().includes('perfil') || r.title?.toLowerCase().includes('perfis');
                    return matchesStatus && matchesType;
                  }).length === 0 ? (
                  <div className="text-center py-16 bg-black/20 rounded-2xl border border-dashed border-zinc-800/50">
                    <Inbox className="h-12 w-12 text-zinc-800 mx-auto mb-4 opacity-50"/>
                    <p className="text-zinc-600 font-black text-sm uppercase tracking-widest">Nenhuma solicitação encontrada</p>
                  </div>
                ) : (
                  requests
                    .filter(r => {
                      if (r.type === 'purchase') return false;
                      const matchesStatus = filterType === 'all' 
                        ? true 
                        : filterType === 'pending' 
                          ? r.status !== 'completed' 
                          : r.status === 'completed';
                      const matchesType = filterItemType === 'all'
                        ? true
                        : filterItemType === 'bm'
                          ? r.title?.toLowerCase().includes('bm')
                          : r.title?.toLowerCase().includes('perfil') || r.title?.toLowerCase().includes('perfis');
                      return matchesStatus && matchesType;
                    })
                    .map(req => (
                      <Card key={req.id} className="bg-white/5 border-white/10 hover:border-primary/30 transition-all duration-300">
                        <CardContent className="p-4 space-y-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-base truncate flex items-center gap-2 text-white">
                                {req.title || 'Solicitação'}
                                <Badge className={`${getStatusColor(req.status)} border text-[9px] px-1.5 py-0 uppercase font-black`}>
                                  {getStatusLabel(req.status)}
                                </Badge>
                              </div>
                              <div className="text-[10px] text-white/40 mt-1 flex items-center gap-2">
                                <Hash className="size-2.5" /> {req.id.slice(0, 8)} 
                                <span className="text-white/20">|</span> 
                                <Calendar className="size-2.5" /> {new Date(req.created_at).toLocaleDateString('pt-BR')}
                              </div>
                            </div>
                            <div className="flex flex-col gap-1">
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="size-8 text-white/50 hover:text-white hover:bg-white/10"
                                onClick={() => toggleRequestExpand(req.id)}
                              >
                                {expandedRequests[req.id] ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                              </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-center">
                            <div className="bg-white/5 p-2 rounded-md border border-white/5">
                              <div className="text-[10px] text-white/50 uppercase font-bold tracking-wider">Itens</div>
                              <div className="font-black text-white">{req.items?.length || 0}</div>
                            </div>
                            <div className={`p-2 rounded-md border ${req.reason ? 'bg-red-500/10 border-red-500/20' : 'bg-white/5 border-white/5'}`}>
                              <div className={`text-[10px] uppercase font-bold tracking-wider ${req.reason ? 'text-red-400' : 'text-white/50'}`}>Motivo</div>
                              <div className={`font-black truncate px-1 ${req.reason ? 'text-red-400' : 'text-white'}`}>
                                {req.reason ? req.reason.toUpperCase() : '-'}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="text-[11px] font-bold text-white/70 uppercase tracking-tighter italic">Conteúdo da Reposição</div>
                            <div className="space-y-2">
                              {req.items && req.items.length > 0 ? (
                                 <div className="rounded-md border border-white/10 bg-white/5 p-2 space-y-2">
                                   {req.items.slice(0, 1).map((item: any) => {
                                    const hasSeparator = item.details.includes('|');
                                    const [id, link] = hasSeparator ? item.details.split('|') : [null, item.details];
                                    const displayValue = link || id;
                                    const cleanLink = link?.trim() || id?.trim();

                                    return (
                                      <div key={item.id} className="space-y-1.5 pb-2 last:pb-0 last:border-0 border-b border-white/5">
                                        {id && hasSeparator && (
                                          <div className="flex items-center gap-1 text-[10px]">
                                            <IdCard className="size-3 text-sky-400 shrink-0" />
                                            <span className="text-white/40 shrink-0 w-[50px]">ID BM:</span>
                                            <span className="flex-1 truncate text-white/85 font-mono">{id}</span>
                                            <Button size="icon" variant="ghost" className="h-5 w-5 p-0 opacity-50 hover:opacity-100" onClick={() => copyToClipboard(id)}>
                                              <Copy className="size-2.5" />
                                            </Button>
                                          </div>
                                        )}
                                        <div className="flex items-center gap-1 text-[10px]">
                                          <ExternalLink className="size-3 text-primary shrink-0" />
                                          <span className="text-white/40 shrink-0 w-[50px]">Link:</span>
                                          <span className="flex-1 truncate text-white/85 font-mono">{displayValue}</span>
                                          <div className="flex gap-1 shrink-0">
                                            {cleanLink && (cleanLink.startsWith('http') || cleanLink.includes('business.facebook.com')) && (
                                              <Button size="icon" variant="ghost" className="h-5 w-5 p-0 opacity-50 hover:opacity-100" onClick={() => window.open(cleanLink.startsWith('http') ? cleanLink : `https://${cleanLink}`, '_blank')}>
                                                <ExternalLink className="size-2.5"/>
                                              </Button>
                                            )}
                                            <Button size="icon" variant="ghost" className="h-5 w-5 p-0 opacity-50 hover:opacity-100" onClick={() => copyToClipboard(displayValue)}>
                                              <Copy className="size-2.5" />
                                            </Button>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {!expandedRequests[req.id] && req.items.length > 1 && (
                                    <div className="text-[10px] text-center text-primary font-bold uppercase py-1 border-t border-white/5">
                                      +{req.items.length - 1} itens no lote (clique em ver todos os itens)
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="rounded-md border border-dashed border-white/10 px-2 py-4 text-center">
                                  <p className="text-[10px] text-white/40 italic">{req.description || 'Sem detalhes técnicos.'}</p>
                                </div>
                              )}
                            </div>
                          </div>

                          {expandedRequests[req.id] && (
                            <div className="pt-2 space-y-3 animate-in fade-in duration-300">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                                  <RefreshCw className="size-3" /> Responder Reposição
                                </div>
                                <Textarea 
                                  className="bg-black/50 border-white/10 min-h-[100px] text-[11px] font-mono focus:border-emerald-500/50 transition-all resize-none" 
                                  placeholder="Novos links/dados..."
                                  value={content}
                                  onChange={e => setContent(e.target.value)}
                                />
                              </div>
                              <Button 
                                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black h-9 text-[10px] uppercase tracking-widest" 
                                onClick={() => handleSubmit(req.id)} 
                                disabled={submitting}
                              >
                                {submitting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                                Enviar Reposição
                              </Button>
                            </div>
                          )}

                           {req.items && req.items.length > 1 ? (
                             <Button 
                               variant="outline" 
                               className="w-full h-8 text-[10px] font-bold border-white/10 hover:bg-white/5"
                               onClick={() => setSelectedRequest(req)}
                             >
                               VER TODOS OS ITENS ({req.items.length})
                             </Button>
                           ) : (
                             <Button 
                               variant="outline" 
                               className="w-full h-8 text-[10px] font-bold border-white/10 hover:bg-white/5"
                               onClick={() => toggleRequestExpand(req.id)}
                             >
                               {expandedRequests[req.id] ? 'RECOLHER DETALHES' : 'RESPONDER REPOSIÇÃO'}
                             </Button>
                           )}
                        </CardContent>
                      </Card>
                    ))
                )}
              </div>
            </div>
          )}
          {activeTab === 'vendas' && (
            <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-6 duration-700">
              <Card className="bg-[#0a0a0a] border-zinc-800 p-8 shadow-2xl space-y-8">
                <div className="text-center space-y-2">
                  <div className="inline-flex p-3 bg-primary/10 rounded-2xl mb-2">
                    <BriefcaseBusiness className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-2xl font-black text-white tracking-tighter uppercase italic">Ofertagem de Estoque</h3>
                  <p className="text-zinc-500 text-sm">Tem estoque parado? Oferte para a FBFLIX agora mesmo.</p>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">O que você quer vender?</label>
                    <Tabs value={offerData.type} onValueChange={(v: any) => setOfferData({...offerData, type: v})} className="w-full">
                      <TabsList className="bg-black border border-zinc-800 w-full h-12 p-1">
                        <TabsTrigger value="bm" className="flex-1 data-[state=active]:bg-zinc-800 font-bold text-xs uppercase tracking-wider">BMs</TabsTrigger>
                        <TabsTrigger value="perfil" className="flex-1 data-[state=active]:bg-zinc-800 font-bold text-xs uppercase tracking-wider">Perfis</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Título/Descrição Curta</label>
                      <Input 
                        placeholder="Ex: BM ILIMITADA MATURADA" 
                        className="bg-black border-zinc-800 h-12 text-sm"
                        value={offerData.description}
                        onChange={e => setOfferData({...offerData, description: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Preço Sugerido (R$)</label>
                      <Input 
                        placeholder="0,00" 
                        className="bg-black border-zinc-800 h-12 text-sm"
                        value={offerData.price}
                        onChange={e => setOfferData({...offerData, price: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Detalhes Adicionais (Opcional)</label>
                    <Textarea 
                      placeholder="Informe detalhes como tempo de criação, se tem limite de gasto, etc." 
                      className="bg-black border-zinc-800 min-h-[100px] text-sm resize-none"
                      value={offerData.content}
                      onChange={e => setOfferData({...offerData, content: e.target.value})}
                    />
                  </div>

                  <Button 
                    className="w-full bg-primary hover:bg-primary/90 text-white font-black h-14 text-sm uppercase tracking-widest shadow-lg shadow-primary/20" 
                    onClick={handleOffer}
                    disabled={submitting}
                  >
                    {submitting ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : <Send className="h-5 w-5 mr-2" />}
                    ENVIAR OFERTA PARA ANÁLISE
                  </Button>
                  
                  <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
                    <p className="text-[10px] text-zinc-500 leading-relaxed text-center">
                      As ofertas são analisadas manualmente por nossa equipe comercial. <br/>
                      Caso aprovada, você receberá o saldo diretamente em seu painel após o envio dos itens.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}
          {activeTab === 'financeiro' && (
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
              <div className="flex flex-col gap-2">
                <h3 className="text-2xl font-black text-white tracking-tighter uppercase italic">Dados Financeiros</h3>
                <p className="text-zinc-500 text-sm">Gerencie suas formas de recebimento para pagamentos automáticos.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <Card className="md:col-span-1 bg-[#0a0a0a] border-zinc-800 p-6 space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Tipo de Conta</label>
                      <Tabs value={newPaymentType} onValueChange={setNewPaymentType} className="w-full">
                        <TabsList className="bg-black border border-zinc-800 w-full h-10 p-1">
                          <TabsTrigger value="pix" className="flex-1 data-[state=active]:bg-zinc-800 font-bold text-[10px] uppercase">PIX</TabsTrigger>
                          <TabsTrigger value="bank" className="flex-1 data-[state=active]:bg-zinc-800 font-bold text-[10px] uppercase">Conta</TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                     {newPaymentType === 'pix' ? (
                       <div className="space-y-3 animate-in fade-in duration-300">
                         <div className="space-y-1">
                           <label className="text-[9px] font-black text-zinc-500 uppercase">Banco</label>
                           <Input 
                             value={bankData.bank}
                             onChange={e => setBankData({...bankData, bank: e.target.value})}
                             placeholder="Ex: Nubank"
                             className="bg-black border-zinc-800 h-9 text-xs"
                           />
                         </div>
                         <div className="grid grid-cols-2 gap-2">
                           <div className="space-y-1">
                             <label className="text-[9px] font-black text-zinc-500 uppercase">Tipo de Chave</label>
                             <Select value={pixType} onValueChange={setPixType}>
                               <SelectTrigger className="bg-black border-zinc-800 h-9 text-[10px] font-bold uppercase">
                                 <SelectValue />
                               </SelectTrigger>
                               <SelectContent className="bg-zinc-900 border-zinc-800">
                                 <SelectItem value="cpf">CPF</SelectItem>
                                 <SelectItem value="email">E-mail</SelectItem>
                                 <SelectItem value="phone">Telefone</SelectItem>
                                 <SelectItem value="random">Aleatória</SelectItem>
                               </SelectContent>
                             </Select>
                           </div>
                           <div className="space-y-1">
                             <label className="text-[9px] font-black text-zinc-500 uppercase">Chave PIX</label>
                             <Input 
                               value={pixKey}
                               onChange={e => setPixKey(e.target.value)}
                               placeholder={pixType === 'cpf' ? "000.000.000-00" : pixType === 'phone' ? "(00) 00..." : "Chave..."}
                               className="bg-black border-zinc-800 h-9 text-xs"
                             />
                           </div>
                         </div>
                         <div className="space-y-1">
                           <label className="text-[9px] font-black text-zinc-500 uppercase">Nome do Titular</label>
                           <Input 
                             value={bankData.holder}
                             onChange={e => setBankData({...bankData, holder: e.target.value})}
                             placeholder="Nome Completo"
                             className="bg-black border-zinc-800 h-9 text-xs"
                           />
                         </div>
                       </div>
                     ) : (
                      <div className="space-y-3 animate-in fade-in duration-300">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-zinc-500 uppercase">Banco</label>
                            <Input 
                              value={bankData.bank}
                              onChange={e => setBankData({...bankData, bank: e.target.value})}
                              placeholder="Ex: Nubank"
                              className="bg-black border-zinc-800 h-9 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-zinc-500 uppercase">Agência</label>
                            <Input 
                              value={bankData.agency}
                              onChange={e => setBankData({...bankData, agency: e.target.value})}
                              placeholder="0001"
                              className="bg-black border-zinc-800 h-9 text-xs"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-zinc-500 uppercase">Número da Conta</label>
                          <Input 
                            value={bankData.account}
                            onChange={e => setBankData({...bankData, account: e.target.value})}
                            placeholder="00000-0"
                            className="bg-black border-zinc-800 h-9 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-zinc-500 uppercase">Nome do Titular</label>
                          <Input 
                            value={bankData.holder}
                            onChange={e => setBankData({...bankData, holder: e.target.value})}
                            placeholder="Nome Completo"
                            className="bg-black border-zinc-800 h-9 text-xs"
                          />
                        </div>
                      </div>
                    )}
                    <Button 
                      className="w-full bg-primary hover:bg-primary/90 text-white font-black h-12" 
                      onClick={handleAddPaymentMethod}
                      disabled={submitting}
                    >
                      {submitting ? <Loader2 className="animate-spin h-5 w-5" /> : <Plus className="h-4 w-4 mr-2" />}
                      CADASTRAR
                    </Button>
                  </div>
                </Card>

                <Card className="md:col-span-2 bg-[#0a0a0a] border-zinc-800 overflow-hidden">
                  <div className="p-6 border-b border-zinc-800/50 flex items-center justify-between">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Contas Cadastradas</span>
                    <Badge className="bg-zinc-800 text-zinc-400 border-zinc-700">{paymentMethods.length}</Badge>
                  </div>
                  <div className="p-0">
                    {paymentMethods.length === 0 ? (
                      <div className="p-12 text-center text-zinc-600">
                        <CreditCard className="h-10 w-10 mx-auto mb-4 opacity-20" />
                        <p className="text-sm font-medium">Nenhuma forma de recebimento cadastrada.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-zinc-800/50">
                        {paymentMethods.map(pm => (
                          <div key={pm.id} className="p-6 flex items-center justify-between hover:bg-white/[0.01] transition-colors group">
                            <div className="flex items-center gap-4">
                              <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-800">
                                <CreditCard className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-black text-white uppercase tracking-wider">{pm.type}</span>
                                  {pm.is_primary && <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[8px] font-black uppercase">Principal</Badge>}
                                </div>
                                <p className="text-zinc-400 text-sm mt-1 font-mono">{pm.details}</p>
                              </div>
                            </div>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-500 transition-all"
                              onClick={() => handleDeletePaymentMethod(pm.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          )}
         </div>
       </main>
 
       <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
         <DialogContent className="bg-[#0a0a0a] border-zinc-800 text-white max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
           <DialogHeader className="p-6 border-b border-white/5">
             <DialogTitle className="text-xl font-black uppercase italic tracking-tighter flex items-center gap-2">
               {selectedRequest?.title || 'Detalhes do Lote'}
               <Badge className={`${selectedRequest ? getStatusColor(selectedRequest.status) : ''} border text-[10px] uppercase font-black`}>
                 {selectedRequest ? getStatusLabel(selectedRequest.status) : ''}
               </Badge>
             </DialogTitle>
             <DialogDescription className="text-zinc-500 text-xs uppercase font-bold tracking-widest mt-1">
               Lote ID: {selectedRequest?.id?.slice(0, 8)} • {selectedRequest?.items?.length} itens detectados
             </DialogDescription>
           </DialogHeader>
           
           <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
             <div className="grid grid-cols-1 gap-3">
               {selectedRequest?.items?.map((item: any, idx: number) => {
                 const hasSeparator = item.details.includes('|');
                 const [id, link] = hasSeparator ? item.details.split('|') : [null, item.details];
                 const displayValue = link || id;
                 const cleanLink = link?.trim() || id?.trim();
 
                 return (
                   <div key={item.id} className="bg-white/5 border border-white/5 rounded-lg p-3 space-y-2 group hover:border-primary/30 transition-all">
                      <div className="flex items-center justify-between mb-1">
                       <span className="text-[10px] font-black text-white/20 uppercase">Item #{idx + 1}</span>
                        {item.reason && (
                          <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-[8px] px-1.5 py-0 uppercase font-black">
                            {item.reason}
                          </Badge>
                        )}
                     </div>
                     
                     {id && hasSeparator && (
                       <div className="flex items-center gap-2 text-[11px]">
                         <IdCard className="size-3.5 text-sky-400 shrink-0" />
                         <span className="text-white/40 shrink-0 w-[50px]">ID BM:</span>
                         <span className="flex-1 truncate text-white/90 font-mono font-bold">{id}</span>
                         <Button size="icon" variant="ghost" className="h-6 w-6 p-0 hover:bg-white/10" onClick={() => copyToClipboard(id)}>
                           <Copy className="size-3" />
                         </Button>
                       </div>
                     )}
                     
                     <div className="flex items-center gap-2 text-[11px]">
                       <ExternalLink className="size-3.5 text-primary shrink-0" />
                       <span className="text-white/40 shrink-0 w-[50px]">Link:</span>
                       <span className="flex-1 truncate text-white/90 font-mono font-bold">{displayValue}</span>
                       <div className="flex gap-1 shrink-0">
                         {cleanLink && (cleanLink.startsWith('http') || cleanLink.includes('business.facebook.com')) && (
                           <Button size="icon" variant="ghost" className="h-6 w-6 p-0 hover:bg-white/10" onClick={() => window.open(cleanLink.startsWith('http') ? cleanLink : `https://${cleanLink}`, '_blank')}>
                             <ExternalLink className="size-3" />
                           </Button>
                         )}
                         <Button size="icon" variant="ghost" className="h-6 w-6 p-0 hover:bg-white/10" onClick={() => copyToClipboard(displayValue)}>
                           <Copy className="size-3" />
                         </Button>
                       </div>
                     </div>

                      <Collapsible className="pt-2 mt-2 border-t border-white/5">
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" className="w-full h-8 text-[9px] font-black text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/5 uppercase tracking-widest flex items-center justify-center gap-1">
                            <RefreshCw className="size-3" /> Repor apenas este item
                            <ChevronDown className="size-3 ml-1" />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-2 space-y-2 animate-in fade-in slide-in-from-top-1 duration-300">
                          <Textarea 
                            className="bg-black/60 border-emerald-500/20 min-h-[70px] text-[11px] font-mono focus:border-emerald-500/50 transition-all resize-none" 
                            placeholder="Cole aqui o novo link/dados apenas para este item..."
                            value={replenishItemContent[item.id] || ""}
                            onChange={e => setReplenishItemContent(prev => ({ ...prev, [item.id]: e.target.value }))}
                          />
                          <Button 
                            className="w-full bg-emerald-600/90 hover:bg-emerald-500 text-white font-black h-9 text-[10px] uppercase tracking-widest" 
                            onClick={async () => {
                              const itemContent = replenishItemContent[item.id];
                              if (!itemContent?.trim()) {
                                toast.error("Insira o conteúdo de reposição deste item");
                                return;
                              }
                              const prevContent = content;
                              setContent(itemContent);
                              await new Promise(r => setTimeout(r, 50));
                              await handleSubmit(selectedRequest.id, item.id);
                              setReplenishItemContent(prev => ({ ...prev, [item.id]: "" }));
                              setContent(prevContent);
                            }} 
                            disabled={submitting}
                          >
                            {submitting ? <Loader2 className="animate-spin h-3 w-3 mr-2" /> : <CheckCircle2 className="h-3 w-3 mr-2" />}
                            ENVIAR REPOSIÇÃO INDIVIDUAL
                          </Button>
                        </CollapsibleContent>
                      </Collapsible>
                   </div>
                 );
               })}
             </div>
 
             <div className="pt-4 border-t border-white/5 space-y-3">
               <div className="flex items-center gap-2 text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                  <RefreshCw className="size-3" /> OU Responder Todo o Lote de uma vez
               </div>
               <Textarea 
                 className="bg-black border-white/10 min-h-[120px] text-[12px] font-mono focus:border-emerald-500/50 transition-all resize-none" 
                 placeholder="Insira os novos dados para reposição deste lote..."
                 value={content}
                 onChange={e => setContent(e.target.value)}
               />
               <Button 
                 className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black h-12 uppercase tracking-widest text-xs" 
                 onClick={() => {
                   handleSubmit(selectedRequest.id);
                   setSelectedRequest(null);
                 }} 
                 disabled={submitting}
               >
                 {submitting ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : <CheckCircle2 className="h-5 w-5 mr-2" />}
                 Confirmar Reposição do Lote
               </Button>
             </div>
           </div>
         </DialogContent>
       </Dialog>
     </div>
   );
 }