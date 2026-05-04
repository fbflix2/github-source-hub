import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, FileText, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
    const { data } = await supabase
      .from("supplier_requests")
      .select("*")
      .eq("supplier_id", supplierId)
      .order("created_at", { ascending: false });
    setRequests(data || []);
  };

  const handleSubmit = async () => {
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
          name: `Envio Fornecedor (${type}) - ${new Date().toLocaleDateString("pt-BR")}`,
          notes: notes || `Envio via portal público`,
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
                  onClick={handleSubmit}
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
                <Card key={req.id} className="bg-zinc-900 border-zinc-800">
                  <CardContent className="p-4 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge className={req.status === 'completed' ? 'bg-green-500/20 text-green-500' : 'bg-yellow-500/20 text-yellow-500'}>
                          {req.status === 'completed' ? 'Concluído' : 'Pendente'}
                        </Badge>
                        <span className="text-xs text-zinc-500">{new Date(req.created_at).toLocaleDateString()}</span>
                      </div>
                      <h3 className="font-bold text-white">{req.title}</h3>
                      <p className="text-sm text-zinc-400">{req.description}</p>
                    </div>
                    {req.priority === 'high' && <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}