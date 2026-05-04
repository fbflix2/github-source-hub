import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
  import { Loader2, Send, FileText, CheckCircle2, Clock, AlertCircle, ExternalLink, Copy, ChevronDown, ChevronUp, LayoutDashboard, Hash, Calendar, PackagePlus, Inbox, BriefcaseBusiness, Menu, RefreshCw, History, TrendingUp, ArrowUpRight, ArrowDownRight, DollarSign, Activity, Users, IdCard, KeyRound, Mail, Lock, AtSign, ShieldCheck, ShieldAlert, Award, Search, CreditCard, Plus, Trash2 } from "lucide-react";
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
  const [offerContent, setOfferContent] = useState("");

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
      details = `PIX (${pixType.toUpperCase()}): ${pixKey}`;
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
                    <span className="text-xl font-black text-white">R$ {(requests.length * 45).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                    <div className="flex items-center gap-1 text-[9px] text-emerald-500 font-bold"><ArrowUpRight className="h-2.5 w-2.5"/> +12.5%</div>
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
                    <span className="text-xl font-black text-white">{requests.length * 15}</span>
                    <div className="flex items-center gap-1 text-[9px] text-primary font-bold"><ArrowUpRight className="h-2.5 w-2.5"/> Taxa: 98%</div>
                  </div>
                </Card>

                <Card className="bg-[#0a0a0a] border-zinc-800 p-4 flex flex-col gap-3 relative overflow-hidden group">
                  <div className="absolute -right-2 -top-2 bg-primary/5 rounded-full p-6 transition-transform group-hover:scale-110"><BriefcaseBusiness className="h-6 w-6 text-primary/20"/></div>
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-zinc-800 rounded-lg"><Activity className="h-3.5 w-3.5 text-zinc-400"/></div>
                    <span className="text-xs font-black text-zinc-500 uppercase tracking-widest">Health Score</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xl font-black text-emerald-500">9.8</span>
                    <div className="flex items-center gap-1 w-20">
                      {[1,2,3,4,5].map(i => <div key={i} className="h-1 flex-1 bg-emerald-500 rounded-full"/>)}
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
                  <div className="h-[240px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={[
                        { name: 'Seg', valor: 2400 }, { name: 'Ter', valor: 1398 }, { name: 'Qua', valor: 5800 },
                        { name: 'Qui', valor: 3908 }, { name: 'Sex', valor: 4800 }, { name: 'Sáb', valor: 3800 }, { name: 'Dom', valor: 4300 }
                      ]}>
                        <defs>
                          <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#D946EF" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#D946EF" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
                        <XAxis dataKey="name" stroke="#52525b" fontSize={10} axisLine={false} tickLine={false}/>
                        <YAxis hide/>
                        <RechartsTooltip 
                          contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #27272a', borderRadius: '12px' }}
                          itemStyle={{ color: '#D946EF', fontWeight: 900, fontSize: '12px' }}
                        />
                        <Area type="monotone" dataKey="valor" stroke="#D946EF" strokeWidth={4} fillOpacity={1} fill="url(#colorVal)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <div className="space-y-6">
                  <Card className="bg-[#0a0a0a] border-zinc-800 p-6 shadow-2xl">
                    <CardTitle className="text-sm font-black text-zinc-500 uppercase tracking-widest mb-6">Envio Rápido</CardTitle>
                    <div className="space-y-6">
                      <Tabs value={type} onValueChange={(v: any) => setType(v)} className="w-full">
                        <TabsList className="bg-black border border-zinc-800 w-full h-12 p-1">
                          <TabsTrigger value="perfil" className="flex-1 data-[state=active]:bg-zinc-800 font-bold text-xs uppercase tracking-wider">Perfis</TabsTrigger>
                          <TabsTrigger value="bm" className="flex-1 data-[state=active]:bg-zinc-800 font-bold text-xs uppercase tracking-wider">BMs</TabsTrigger>
                        </TabsList>
                      </Tabs>
                      <Textarea 
                        className="bg-black border-zinc-800 min-h-[120px] font-mono text-xs focus:ring-primary/20" 
                        placeholder={type === 'perfil' ? "123456|Senha123\n987654|Senha456" : "https://fb.me/..."}
                        value={content}
                        onChange={e => setContent(e.target.value)}
                      />
                      <Button className="w-full bg-primary hover:bg-primary/90 text-white font-black h-10 text-xs" onClick={() => handleSubmit()} disabled={submitting}>
                        {submitting ? <Loader2 className="animate-spin h-5 w-5" /> : "PROCESSAR ENVIO"}
                      </Button>
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
                                <div className={`rounded-md border border-white/10 bg-white/5 p-2 space-y-2 ${expandedRequests[req.id] ? 'max-h-[300px] overflow-y-auto custom-scrollbar' : ''}`}>
                                  {req.items.slice(0, expandedRequests[req.id] ? undefined : 1).map((item: any) => {
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

                          <Button 
                            variant="outline" 
                            className="w-full h-8 text-[10px] font-bold border-white/10 hover:bg-white/5"
                            onClick={() => toggleRequestExpand(req.id)}
                          >
                            {expandedRequests[req.id] ? 'RECOLHER DETALHES' : 'VER TODOS OS ITENS'}
                          </Button>
                        </CardContent>
                      </Card>
                    ))
                )}
              </div>
            </div>
          )}
          {activeTab === 'vendas' && <div className="space-y-4">...</div>}
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
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Detalhes (Chave ou Dados)</label>
                      <Textarea 
                        value={newPaymentDetails}
                        onChange={e => setNewPaymentDetails(e.target.value)}
                        placeholder={newPaymentType === 'pix' ? "Ex: CPF, E-mail, Celular ou Chave Aleatória" : "Banco, Agência, Conta e Titular"}
                        className="bg-black border-zinc-800 min-h-[120px] text-sm"
                      />
                    </div>
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
    </div>
  );
}