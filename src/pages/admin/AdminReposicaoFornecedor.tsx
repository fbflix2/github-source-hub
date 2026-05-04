import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
 import { RefreshCw, Upload, Link, FileText, Loader2, History, Trash2, UserPlus, Plus, ExternalLink, Copy, ListTodo, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Supplier {
  id: string;
  name: string;
}

interface ReplacementRecord {
  id: string;
  supplier_id: string;
  name: string;
  type: string;
  created_at: string;
  account_count?: number;
}

export default function AdminReposicaoFornecedor() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState("");
   const [history, setHistory] = useState<ReplacementRecord[]>([]);
   const [activeRequests, setActiveRequests] = useState<any[]>([]);
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [creatingSupplier, setCreatingSupplier] = useState(false);

  // Profile upload state
  const [txtContent, setTxtContent] = useState("");
  
  // BM links state
  const [bmLinks, setBmLinks] = useState("");

  // Request state
  const [requestUnitPrice, setRequestUnitPrice] = useState("");
  const [requestReason, setRequestReason] = useState("");
  const [requestStatus, setRequestStatus] = useState("pending_replenishment");
  const [requestType, setRequestType] = useState<"perfil" | "bm">("bm");
  const [requestContent, setRequestContent] = useState("");

   useEffect(() => {
     fetchSuppliers();
     fetchHistory();
     fetchActiveRequests();
   }, [selectedSupplier]);
   const fetchActiveRequests = async () => {
     let query = supabase
       .from("supplier_requests")
       .select("*, items:supplier_request_items(*)")
       .order("created_at", { ascending: false });
     
     if (selectedSupplier) {
       query = query.eq("supplier_id", selectedSupplier);
     }

     const { data } = await query;
     setActiveRequests(data || []);
   };

   const handleUpdateStatus = async (id: string, newStatus: string) => {
     const { error } = await supabase
       .from("supplier_requests")
       .update({ status: newStatus })
       .eq("id", id);
     
     if (error) {
       toast.error("Erro ao atualizar status: " + error.message);
     } else {
       toast.success("Status atualizado");
       fetchActiveRequests();
     }
   };

   const deleteRequest = async (id: string) => {
     if (!confirm("Excluir esta solicitação?")) return;
     const { error } = await supabase.from("supplier_requests").delete().eq("id", id);
     if (error) {
       toast.error("Erro ao excluir: " + error.message);
     } else {
       toast.success("Solicitação excluída");
       fetchActiveRequests();
     }
   };

  const fetchSuppliers = async () => {
    const { data } = await supabase.from("suppliers").select("id, name, access_token").eq("status", "active").order("name");
    setSuppliers(data || []);
    setLoading(false);
  };

  const handleCreateSupplier = async () => {
    if (!newSupplierName.trim()) {
      toast.error("Informe o nome do fornecedor");
      return;
    }

    setCreatingSupplier(true);
    try {
      // Generate 8 digit token
      const token = Math.random().toString(36).substring(2, 10).toUpperCase();
      
      const { data, error } = await supabase
        .from("suppliers")
        .insert({
          name: newSupplierName.trim(),
          access_token: token,
          status: "active"
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Fornecedor criado com sucesso!");
      setNewSupplierName("");
      setIsCreatingSupplier(false);
      fetchSuppliers();
    } catch (err: any) {
      toast.error("Erro ao criar fornecedor: " + err.message);
    } finally {
      setCreatingSupplier(false);
    }
  };

  const fetchHistory = async () => {
    const { data: batches, error } = await supabase
      .from("supplier_batches")
      .select("id, supplier_id, name, created_at, type")
      .eq("type", "replacement")
      .order("created_at", { ascending: false })
      .limit(10);

    if (batches) {
      // Count accounts for each batch
      const historyWithCounts = await Promise.all(batches.map(async (b) => {
        const { count } = await supabase
          .from("supplier_accounts")
          .select("*", { count: 'exact', head: true })
          .eq("batch_id", b.id);
        return { ...b, account_count: count || 0 };
      }));
      setHistory(historyWithCounts);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setTxtContent(ev.target?.result as string);
      toast.success("Arquivo carregado com sucesso");
    };
    reader.readAsText(file);
  };

  const parseTxtProfiles = (content: string) => {
    const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const parsed = [];
    for (const line of lines) {
      const usePipe = line.includes("|");
      const parts = (usePipe ? line.split("|") : line.split(":")).map(p => p.trim());
      if (parts.length < 2) continue;

      const linkIdx = parts.findIndex(p => /^https?:\/\//i.test(p));
      let login = "", password = "", profile_link: string | undefined;
      let email_principal: string | undefined;
      let email_password: string | undefined;
      let email_alt: string | undefined;

      if (usePipe) {
        login = parts[0] || "";
        password = parts[1] || "";
        const rest = parts.slice(2);
        const restLinkIdx = rest.findIndex(p => /^https?:\/\//i.test(p));
        if (restLinkIdx >= 0) profile_link = rest[restLinkIdx];

        const emails = rest.filter(p => p.includes("@"));
        const isPrincipalDomain = (e: string) => /@(hotmail|outlook|live|msn)\./i.test(e);
        const isAltDomain = (e: string) => /@fviainboxes\./i.test(e);
        const principalMatch = emails.find(isPrincipalDomain);
        const altMatch = emails.find(isAltDomain);
        email_principal = principalMatch || emails[0];
        email_alt = altMatch && altMatch !== email_principal ? altMatch : emails.find(e => e !== email_principal);

        if (email_principal) {
          const idxEmail = rest.indexOf(email_principal);
          const candidate = rest[idxEmail + 1];
          if (candidate && !candidate.includes("@") && !/^https?:\/\//i.test(candidate)) {
            email_password = candidate;
          }
        }
        if (!profile_link && /^\d{6,}$/.test(login)) {
          profile_link = `https://facebook.com/profile.php?id=${login}`;
        }
      } else if (linkIdx >= 0) {
        profile_link = parts[linkIdx];
        const rest = parts.filter((_, i) => i !== linkIdx);
        login = rest[0] || "";
        password = rest.slice(1).join(":") || "";
      } else if (parts.length === 2) {
        [login, password] = parts;
      } else {
        login = parts[0];
        password = parts.slice(1).join(":");
      }

      if (login && password) {
        parsed.push({ login, password, profile_link, email_principal, email_password, email_alt, raw: line });
      }
    }
    return parsed;
  };

  const parseBmLinks = (content: string) => {
    const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    return lines.map(line => ({
      profile_link: line,
      login: "BM_REPOSITION",
      password: "N/A",
      notes: line,
      has_bm: true
    }));
  };

  const handleSubmit = async (type: "perfil" | "bm") => {
    if (!selectedSupplier) {
      toast.error("Selecione um fornecedor");
      return;
    }

    const dataToImport = type === "perfil" ? parseTxtProfiles(txtContent) : parseBmLinks(bmLinks);

    if (dataToImport.length === 0) {
      toast.error("Nenhum dado válido para importar");
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // 1. Create a replacement batch
      const { data: batch, error: batchError } = await supabase
        .from("supplier_batches")
        .insert({
          supplier_id: selectedSupplier,
          name: `Reposição ${type === "perfil" ? "Perfis" : "BMs"} - ${new Date().toLocaleDateString("pt-BR")}`,
          notes: notes || `Reposição manual de ${type}`,
          purchased_at: new Date().toISOString().split('T')[0],
          created_by: user?.id,
          type: "replacement"
        })
        .select()
        .single();

      if (batchError) throw batchError;

      // 2. Prepare accounts
      const accounts = dataToImport.map(item => ({
        batch_id: batch.id,
        supplier_id: selectedSupplier,
        login: item.login,
        password: (item as any).password,
        profile_link: item.profile_link || null,
        email_principal: (item as any).email_principal || null,
        email_password: (item as any).email_password || null,
        email_alt: (item as any).email_alt || null,
        notes: (item as any).raw || (item as any).notes,
        is_replacement: true,
        status: "aguardando" as const,
        has_bm: (item as any).has_bm || false
      }));

      // 3. Insert in chunks
      const chunkSize = 100;
      for (let i = 0; i < accounts.length; i += chunkSize) {
        const chunk = accounts.slice(i, i + chunkSize);
        const { error: insertError } = await supabase.from("supplier_accounts").insert(chunk);
        if (insertError) throw insertError;
      }

      toast.success(`Sucesso: ${accounts.length} itens registrados como reposição`);
      setTxtContent("");
      setBmLinks("");
      setNotes("");
      fetchHistory();
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao registrar reposição: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateRequest = async () => {
    if (!selectedSupplier) {
      toast.error("Selecione um fornecedor");
      return;
    }
    if (!requestContent.trim()) {
      toast.error("Insira os itens para reposição");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create request
      const { data: request, error: reqError } = await supabase
        .from("supplier_requests")
        .insert({
          supplier_id: selectedSupplier,
          title: `Solicitação de Reposição - ${requestType === "bm" ? "BMs" : "Perfis"}`,
          description: `Valor Unitário: R$ ${requestUnitPrice || '0'} | Motivo: ${requestReason}`,
          status: requestStatus,
          type: "replacement",
          unit_price: requestUnitPrice ? parseFloat(requestUnitPrice) : 0,
          reason: requestReason
        })
        .select()
        .single();

      if (reqError) throw reqError;

      // 2. Create items
      const lines = requestContent.split('\n').filter(l => l.trim());
      const items = lines.map(line => ({
        request_id: request.id,
        details: line
      }));

      const { error: itemsError } = await supabase.from("supplier_request_items").insert(items);
      if (itemsError) throw itemsError;

       toast.success("Solicitação criada com sucesso!");
       setRequestContent("");
       setRequestUnitPrice("");
       setRequestReason("");
       fetchActiveRequests();
    } catch (err: any) {
      toast.error("Erro ao criar solicitação: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const deleteBatch = async (id: string) => {
    if (!confirm("Excluir este registro de reposição?")) return;
    const { error } = await supabase.from("supplier_batches").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir: " + error.message);
      return;
    }
    toast.success("Registro excluído");
    fetchHistory();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-2">
            <RefreshCw className="h-8 w-8 text-primary" />
            Reposição Fornecedor
          </h1>
          <p className="text-zinc-400 mt-1">Solicite e registre reposições de fornecedores manualmente.</p>
        </div>
        <Button 
          onClick={() => setIsCreatingSupplier(!isCreatingSupplier)}
          className="bg-zinc-800 hover:bg-zinc-700 text-white"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Cadastrar Fornecedor
        </Button>
      </div>

      {isCreatingSupplier && (
        <Card className="bg-zinc-900/80 border-primary/20 animate-in fade-in slide-in-from-top-4">
          <CardContent className="p-4 flex flex-col sm:flex-row items-end gap-4">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium text-zinc-400">Nome do Novo Fornecedor</label>
              <Input 
                placeholder="Ex: Fornecedor de Perfis VIP"
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                className="bg-zinc-950 border-zinc-800 text-white"
              />
            </div>
            <Button 
              onClick={handleCreateSupplier} 
              disabled={creatingSupplier}
              className="bg-primary text-white"
            >
              {creatingSupplier ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Criar Fornecedor
            </Button>
          </CardContent>
        </Card>
      )}

       <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
         <div className="lg:col-span-2 space-y-6">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-lg text-white">Nova Solicitação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-400">Selecionar Fornecedor</label>
                <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                    <SelectValue placeholder="Escolha um fornecedor..." />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} {(s as any).access_token ? `(${ (s as any).access_token })` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

               <Tabs defaultValue="perfil" className="w-full">
                 <TabsList className="grid w-full grid-cols-3 bg-zinc-950 border border-zinc-800">
                  <TabsTrigger value="perfil" className="data-[state=active]:bg-primary">
                    <FileText className="h-4 w-4 mr-2" /> Perfis
                  </TabsTrigger>
                  <TabsTrigger value="bm" className="data-[state=active]:bg-primary">
                    <Link className="h-4 w-4 mr-2" /> BMs
                  </TabsTrigger>
                  <TabsTrigger value="request" className="data-[state=active]:bg-primary">
                    <ListTodo className="h-4 w-4 mr-2" /> Solicitar
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="perfil" className="space-y-4 mt-4">
                  <div className="border-2 border-dashed border-zinc-800 rounded-xl p-8 flex flex-col items-center justify-center bg-zinc-950/50">
                    <Upload className="h-10 w-10 text-zinc-600 mb-4" />
                    <p className="text-zinc-400 text-sm mb-4">Arraste seu arquivo TXT aqui ou clique para selecionar</p>
                    <Input
                      type="file"
                      accept=".txt"
                      onChange={handleFileUpload}
                      className="max-w-xs bg-zinc-900 border-zinc-800"
                    />
                    {txtContent && (
                      <p className="mt-4 text-emerald-400 text-xs font-medium">
                        {txtContent.split('\n').filter(Boolean).length} linhas detectadas
                      </p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-400">Observações (opcional)</label>
                    <Textarea 
                      placeholder="Ex: Reposição referente ao lote de ontem"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="bg-zinc-950 border-zinc-800 text-white min-h-[80px]"
                    />
                  </div>

                  <Button 
                    className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12"
                    onClick={() => handleSubmit("perfil")}
                    disabled={submitting || !txtContent || !selectedSupplier}
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Registrar Reposição de Perfis
                  </Button>
                </TabsContent>

                <TabsContent value="bm" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-400">Cole os links das BMs (um por linha)</label>
                    <Textarea 
                      placeholder="https://fb.me/..."
                      value={bmLinks}
                      onChange={(e) => setBmLinks(e.target.value)}
                      className="bg-zinc-950 border-zinc-800 text-white min-h-[200px] font-mono text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-400">Observações (opcional)</label>
                    <Textarea 
                      placeholder="Ex: Reposição de BMs bloqueadas"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="bg-zinc-950 border-zinc-800 text-white min-h-[80px]"
                    />
                  </div>

                  <Button 
                    className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12"
                    onClick={() => handleSubmit("bm")}
                    disabled={submitting || !bmLinks || !selectedSupplier}
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Registrar Reposição de BMs
                  </Button>
                </TabsContent>
                <TabsContent value="request" className="space-y-4 mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-400">Tipo</label>
                      <Select value={requestType} onValueChange={(v: any) => setRequestType(v)}>
                        <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                          <SelectItem value="bm">BMs</SelectItem>
                          <SelectItem value="perfil">Perfis</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-400">Status Inicial</label>
                      <Select value={requestStatus} onValueChange={setRequestStatus}>
                        <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                          <SelectItem value="pending_replenishment">Aguardando Reposição</SelectItem>
                          <SelectItem value="accepted">Aceito</SelectItem>
                          <SelectItem value="testing">Em Teste</SelectItem>
                          <SelectItem value="completed">Concluído</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-400">Valor Unitário (R$)</label>
                      <Input 
                        type="number" 
                        placeholder="0.00"
                        value={requestUnitPrice}
                        onChange={e => setRequestUnitPrice(e.target.value)}
                        className="bg-zinc-950 border-zinc-800 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-400">Motivo da Reposição</label>
                      <Input 
                        placeholder="Ex: Block, Link Expirado, etc."
                        value={requestReason}
                        onChange={e => setRequestReason(e.target.value)}
                        className="bg-zinc-950 border-zinc-800 text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-400">
                      {requestType === 'bm' ? 'Links das BMs' : 'Dados dos Perfis'} (um por linha)
                    </label>
                    <Textarea 
                      placeholder={requestType === 'bm' ? "https://fb.me/..." : "login|senha|..."}
                      value={requestContent}
                      onChange={e => setRequestContent(e.target.value)}
                      className="bg-zinc-950 border-zinc-800 text-white min-h-[150px] font-mono text-sm"
                    />
                  </div>

                  <Button 
                    className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12"
                    onClick={handleCreateRequest}
                    disabled={submitting || !requestContent || !selectedSupplier}
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                    Enviar Solicitação ao Fornecedor
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

         <div className="lg:col-span-2 space-y-6">
           <Card className="bg-zinc-900/50 border-zinc-800">
             <CardHeader>
               <CardTitle className="text-lg text-white flex items-center gap-2">
                 <History className="h-5 w-5 text-primary" />
                 Solicitações Ativas
               </CardTitle>
             </CardHeader>
             <CardContent className="p-0">
               <div className="max-h-[600px] overflow-auto">
                 <Table>
                   <TableHeader>
                     <TableRow className="border-zinc-800 hover:bg-transparent">
                       <TableHead className="text-zinc-400">Solicitação</TableHead>
                       <TableHead className="text-zinc-400">Status</TableHead>
                       <TableHead className="text-zinc-400 text-right">Ações</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {activeRequests.length === 0 ? (
                       <TableRow>
                         <TableCell colSpan={3} className="text-center py-8 text-zinc-500">
                           Nenhuma solicitação ativa.
                         </TableCell>
                       </TableRow>
                     ) : activeRequests.map((req) => (
                       <TableRow key={req.id} className="border-zinc-800 hover:bg-zinc-800/30">
                         <TableCell>
                           <div className="space-y-1">
                             <div className="font-bold text-white text-sm">{req.title}</div>
                             <div className="text-xs text-zinc-500">{new Date(req.created_at).toLocaleDateString()}</div>
                             {req.reason && <div className="text-[10px] text-primary">{req.reason}</div>}
                           </div>
                         </TableCell>
                         <TableCell>
                           <Select 
                             value={req.status} 
                             onValueChange={(val) => handleUpdateStatus(req.id, val)}
                           >
                             <SelectTrigger className="h-8 bg-zinc-950 border-zinc-800 text-[10px] w-[140px]">
                               <SelectValue />
                             </SelectTrigger>
                             <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                               <SelectItem value="pending_replenishment">Aguardando Reposição</SelectItem>
                               <SelectItem value="accepted">Aceito</SelectItem>
                               <SelectItem value="testing">Em Teste</SelectItem>
                               <SelectItem value="completed">Concluído</SelectItem>
                             </SelectContent>
                           </Select>
                         </TableCell>
                         <TableCell className="text-right">
                           <Button 
                             variant="ghost" 
                             size="icon" 
                             className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-400/10"
                             onClick={() => deleteRequest(req.id)}
                           >
                             <Trash2 className="h-4 w-4" />
                           </Button>
                         </TableCell>
                       </TableRow>
                     ))}
                   </TableBody>
                 </Table>
               </div>
             </CardContent>
           </Card>
          {selectedSupplier && (
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-primary flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" /> Link do Fornecedor
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-zinc-400">Envie este link e o token para seu fornecedor:</p>
                <div className="flex items-center gap-2">
                  <Input 
                    readOnly 
                    value={`${window.location.origin}/fornecedor/portal`} 
                    className="bg-black/40 border-zinc-800 text-[10px] h-8"
                  />
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/fornecedor/portal`);
                    toast.success("Link copiado!");
                  }}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex items-center justify-between p-2 bg-black/40 rounded border border-zinc-800">
                  <span className="text-[10px] text-zinc-400">TOKEN:</span>
                  <span className="font-mono font-bold text-primary text-sm">
                    {(suppliers.find(s => s.id === selectedSupplier) as any)?.access_token || "SEM TOKEN"}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Últimas Reposições
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-800 hover:bg-transparent">
                      <TableHead className="text-zinc-500 text-xs">DATA</TableHead>
                      <TableHead className="text-zinc-500 text-xs">FORNECEDOR</TableHead>
                      <TableHead className="text-zinc-500 text-xs">QTD</TableHead>
                      <TableHead className="text-zinc-500 text-xs"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-zinc-500 text-sm">Nenhum registro</TableCell>
                      </TableRow>
                    ) : history.map((h) => (
                      <TableRow key={h.id} className="border-zinc-800 hover:bg-zinc-800/30">
                        <TableCell className="text-zinc-300 text-xs">
                          {new Date(h.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-white text-xs font-medium">
                          {suppliers.find(s => s.id === h.supplier_id)?.name || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary text-[10px]">
                            {h.account_count} itens
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-zinc-500 hover:text-red-400"
                            onClick={() => deleteBatch(h.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}