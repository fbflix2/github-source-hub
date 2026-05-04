import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
  import { Loader2, Send, FileText, CheckCircle2, Clock, AlertCircle, ExternalLink, Copy, ChevronDown, ChevronUp, LayoutDashboard, Hash, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function FornecedorPublicPage() {
  const [token, setToken] = useState("");
  const [isAuth, setIsAuth] = useState(false);
  const [supplier, setSupplier] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  
  // Upload state
  const [type, setType] = useState<"perfil" | "bm">("perfil");
  const [content, setContent] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expandedRequests, setExpandedRequests] = useState<Record<string, boolean>>({});

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
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Olá, {supplier.name}</h1>
            <p className="text-zinc-400">Gerencie suas reposições e envios</p>
          </div>
          <Button variant="outline" className="text-zinc-400 border-zinc-800" onClick={() => setIsAuth(false)}>Sair</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-lg">Enviar Produtos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Tabs value={type} onValueChange={(v: any) => setType(v)}>
                  <TabsList className="bg-black border border-zinc-800 w-full">
                    <TabsTrigger value="perfil" className="flex-1">Perfis</TabsTrigger>
                    <TabsTrigger value="bm" className="flex-1">BMs</TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="space-y-2">
                  <label className="text-sm text-zinc-400">
                    {type === "perfil" ? "Cole os dados dos perfis (Login|Senha|...)" : "Cole os links das BMs (um por linha)"}
                  </label>
                  <Textarea 
                    className="bg-black border-zinc-800 min-h-[200px] font-mono text-sm"
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder={type === "perfil" ? "10008273|Senha123|Token\n10009823|Senha456|Token" : "https://fb.me/...\nhttps://fb.me/..."}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-zinc-400">Observações</label>
                  <Input 
                    className="bg-black border-zinc-800"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>

                <Button 
                  className="w-full bg-primary hover:bg-primary/90 text-white h-12"
                  onClick={() => handleSubmit()}
                  disabled={submitting}
                >
                  {submitting ? <Loader2 className="animate-spin mr-2" /> : <Send className="mr-2 h-4 w-4" />}
                  Enviar para Auditoria
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Solicitações Pendentes
            </h2>
            
            <div className="space-y-4">
              {requests.length === 0 ? (
                <div className="bg-zinc-900/50 border border-zinc-800 border-dashed rounded-xl p-8 text-center">
                  <CheckCircle2 className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
                  <p className="text-zinc-500">Nenhuma solicitação pendente no momento.</p>
                </div>
               ) : requests.map(req => (
                  <Collapsible 
                    key={req.id} 
                    open={expandedRequests[req.id]} 
                    onOpenChange={() => toggleRequestExpand(req.id)}
                  >
                    <Card className="bg-zinc-900 border-zinc-800 overflow-hidden mb-4">
                      <CardContent className="p-4 space-y-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className={getStatusColor(req.status)}>
                                {getStatusLabel(req.status)}
                              </Badge>
                              <span className="text-xs text-zinc-500">{new Date(req.created_at).toLocaleString('pt-BR')}</span>
                              {req.unit_price > 0 && (
                                <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">
                                  Unitário: R$ {req.unit_price.toFixed(2)}
                                </Badge>
                              )}
                            </div>
                            <h3 className="font-bold text-white text-lg">{req.title}</h3>
                            {req.reason && (
                              <p className="text-xs text-primary font-medium bg-primary/10 inline-block px-2 py-0.5 rounded">
                                Motivo: {req.reason}
                              </p>
                            )}
                            <p className="text-sm text-zinc-400">{req.description}</p>
                          </div>
                          <CollapsibleTrigger asChild>
                            <Button size="icon" variant="ghost" className="text-zinc-500">
                              {expandedRequests[req.id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          </CollapsibleTrigger>
                        </div>

                        {req.items && req.items.length > 0 && (
                          <div className="space-y-2 pt-2 border-t border-zinc-800/50">
                            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Itens solicitados ({req.items.length})</p>
                            <div className="space-y-2">
                              {req.items.map((item: any) => (
                                <div key={item.id} className="flex items-center justify-between gap-3 p-2 bg-black/40 rounded-lg group">
                                  <span className="text-xs font-mono text-zinc-300 truncate flex-1">{item.details}</span>
                                  <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                    {item.details.startsWith('http') && (
                                      <Button 
                                        size="icon" 
                                        variant="ghost" 
                                        className="h-7 w-7 text-primary hover:text-primary hover:bg-primary/10"
                                        onClick={() => window.open(item.details, '_blank')}
                                      >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                    <Button 
                                      size="icon" 
                                      variant="ghost" 
                                      className="h-7 w-7 text-zinc-400 hover:text-white"
                                      onClick={() => copyToClipboard(item.details)}
                                    >
                                      <Copy className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <CollapsibleContent className="space-y-4 pt-4 border-t border-zinc-800/50 animate-in slide-in-from-top-2">
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-primary uppercase tracking-wider">Responder Reposição</label>
                            <Textarea 
                              placeholder="Cole aqui os novos links ou dados para reposição..."
                              className="bg-black border-zinc-800 min-h-[120px] font-mono text-xs"
                              value={content}
                              onChange={e => setContent(e.target.value)}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              className="flex-1 bg-primary hover:bg-primary/90 text-white"
                              onClick={() => handleSubmit(req.id)}
                              disabled={submitting}
                            >
                              {submitting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />}
                              Enviar Reposição
                            </Button>
                            <Button 
                              variant="outline" 
                              className="border-zinc-800 text-zinc-400"
                              onClick={() => setExpandedRequests(prev => ({ ...prev, [req.id]: false }))}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </CollapsibleContent>
                      </CardContent>
                    </Card>
                  </Collapsible>
               ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}