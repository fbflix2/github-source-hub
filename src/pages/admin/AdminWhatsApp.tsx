import { useState, useMemo } from "react";
import { MessageCircle, Plus, Send, Eye, Trash2, ToggleLeft, ToggleRight, Search, Phone, Clock, CheckCircle, XCircle, RefreshCw, Users, Zap, Bell, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const EVENT_KEYS = [
  { value: "proxy_expiring", label: "Vencimento de Proxy" },
  { value: "proxy_cancelled", label: "Cancelamento de Proxy" },
  { value: "password_reset", label: "Reset de Senha" },
  { value: "promo", label: "Oferta / Promoção" },
  { value: "general", label: "Aviso Geral" },
  { value: "custom", label: "Personalizado" },
];

const STATUS_COLORS: Record<string, string> = {
  queued: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  sent: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  delivered: "bg-green-500/20 text-green-400 border-green-500/30",
  read: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  failed: "bg-red-500/20 text-red-400 border-red-500/30",
};

function useTemplates() {
  return useQuery({
    queryKey: ["whatsapp-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

function useLogs(search: string, eventFilter: string) {
  return useQuery({
    queryKey: ["whatsapp-logs", search, eventFilter],
    queryFn: async () => {
      let q = supabase
        .from("whatsapp_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (eventFilter && eventFilter !== "all") q = q.eq("event_key", eventFilter);
      if (search) q = q.or(`phone.ilike.%${search}%,message_sent.ilike.%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    refetchInterval: 30_000,
  });
}

async function callWapi(action: string, payload: Record<string, any>) {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const res = await fetch(`https://${projectId}.supabase.co/functions/v1/wapi-send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erro ao chamar W-API");
  return data;
}

export default function AdminWhatsApp() {
  const qc = useQueryClient();
  const { data: templates, isLoading: loadingTemplates } = useTemplates();
  const [logSearch, setLogSearch] = useState("");
  const [logEventFilter, setLogEventFilter] = useState("all");
  const { data: logs, isLoading: loadingLogs, refetch: refetchLogs } = useLogs(logSearch, logEventFilter);

  // Template form
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [tplForm, setTplForm] = useState({ name: "", event_key: "general", message_body: "" });

  // Quick send
  const [showQuickSend, setShowQuickSend] = useState(false);
  const [quickPhone, setQuickPhone] = useState("");
  const [quickMessage, setQuickMessage] = useState("");
  const [quickEventKey, setQuickEventKey] = useState("custom");

  // Connection status
  const [connectionStatus, setConnectionStatus] = useState<any>(null);

  const saveTemplate = useMutation({
    mutationFn: async () => {
      if (editingTemplate) {
        const { error } = await supabase
          .from("whatsapp_templates")
          .update({ name: tplForm.name, event_key: tplForm.event_key, message_body: tplForm.message_body })
          .eq("id", editingTemplate.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("whatsapp_templates").insert(tplForm);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingTemplate ? "Template atualizado!" : "Template criado!");
      qc.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      setShowTemplateModal(false);
      setEditingTemplate(null);
      setTplForm({ name: "", event_key: "general", message_body: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleTemplate = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("whatsapp_templates").update({ active: !active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      toast.success("Status atualizado!");
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("whatsapp_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      toast.success("Template excluído!");
    },
  });

  const sendQuick = useMutation({
    mutationFn: () =>
      callWapi("send-text", { phone: quickPhone, message: quickMessage, event_key: quickEventKey }),
    onSuccess: () => {
      toast.success("Mensagem enviada!");
      setShowQuickSend(false);
      setQuickPhone("");
      setQuickMessage("");
      qc.invalidateQueries({ queryKey: ["whatsapp-logs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const checkConnection = useMutation({
    mutationFn: () => callWapi("check-status", {}),
    onSuccess: (data) => {
      setConnectionStatus(data.status);
      toast.success("Status verificado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (tpl: any) => {
    setEditingTemplate(tpl);
    setTplForm({ name: tpl.name, event_key: tpl.event_key, message_body: tpl.message_body });
    setShowTemplateModal(true);
  };

  const openNew = () => {
    setEditingTemplate(null);
    setTplForm({ name: "", event_key: "general", message_body: "" });
    setShowTemplateModal(true);
  };

  // Stats
  const stats = useMemo(() => {
    if (!logs) return { total: 0, sent: 0, failed: 0, today: 0 };
    const todayStr = new Date().toISOString().slice(0, 10);
    return {
      total: logs.length,
      sent: logs.filter((l: any) => l.status === "sent" || l.status === "delivered" || l.status === "read").length,
      failed: logs.filter((l: any) => l.status === "failed").length,
      today: logs.filter((l: any) => l.created_at?.startsWith(todayStr)).length,
    };
  }, [logs]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-10 rounded-xl bg-gradient-to-br from-green-500 to-green-700 shadow-lg shadow-green-500/20">
            <MessageCircle className="text-white size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">WhatsApp Automático</h1>
            <p className="text-xs text-muted-foreground">Envio de alertas e notificações via W-API</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => checkConnection.mutate()} disabled={checkConnection.isPending}>
            <Zap className="size-3.5 mr-1" />
            {checkConnection.isPending ? "Verificando..." : "Verificar Conexão"}
          </Button>
          <Button size="sm" onClick={() => setShowQuickSend(true)} className="gap-1 bg-green-600 hover:bg-green-700">
            <Send className="size-3.5" />
            Envio Rápido
          </Button>
        </div>
      </div>

      {/* Connection status */}
      {connectionStatus && (
        <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3">
          <p className="text-xs text-green-300">
            <strong>Status da instância:</strong> {JSON.stringify(connectionStatus)}
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Envios</p>
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Enviados</p>
            <p className="text-2xl font-bold text-green-400">{stats.sent}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Falhas</p>
            <p className="text-2xl font-bold text-red-400">{stats.failed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Hoje</p>
            <p className="text-2xl font-bold text-amber-400">{stats.today}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="templates" className="space-y-4">
        <TabsList className="bg-card/60 border border-border/40">
          <TabsTrigger value="templates">
            <MessageCircle className="size-4 mr-1.5" />Templates
          </TabsTrigger>
          <TabsTrigger value="logs">
            <Clock className="size-4 mr-1.5" />Histórico
          </TabsTrigger>
        </TabsList>

        {/* TEMPLATES TAB */}
        <TabsContent value="templates" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Crie templates com placeholders: <code className="text-green-400">{"{{nome}}"}</code>, <code className="text-green-400">{"{{produto}}"}</code>, <code className="text-green-400">{"{{valor}}"}</code>, <code className="text-green-400">{"{{data}}"}</code>, <code className="text-green-400">{"{{link}}"}</code>
            </p>
            <Button size="sm" onClick={openNew} className="gap-1">
              <Plus className="size-3.5" />Novo Template
            </Button>
          </div>

          {loadingTemplates ? (
            <div className="text-center text-muted-foreground py-8">Carregando...</div>
          ) : !templates?.length ? (
            <Card>
              <CardContent className="py-12 text-center">
                <MessageCircle className="size-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">Nenhum template criado ainda</p>
                <Button size="sm" className="mt-3" onClick={openNew}>Criar Primeiro Template</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {templates.map((tpl: any) => (
                <Card key={tpl.id} className={!tpl.active ? "opacity-50" : ""}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">{tpl.name}</CardTitle>
                      <div className="flex items-center gap-1">
                        <Badge variant="secondary" className="text-[10px]">
                          {EVENT_KEYS.find((e) => e.value === tpl.event_key)?.label || tpl.event_key}
                        </Badge>
                        <Badge variant={tpl.active ? "default" : "secondary"} className="text-[10px]">
                          {tpl.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap bg-muted/30 rounded p-2 max-h-24 overflow-y-auto">
                      {tpl.message_body}
                    </p>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openEdit(tpl)}>
                        <Eye className="size-3 mr-1" />Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => toggleTemplate.mutate({ id: tpl.id, active: tpl.active })}
                      >
                        {tpl.active ? <ToggleRight className="size-3 mr-1" /> : <ToggleLeft className="size-3 mr-1" />}
                        {tpl.active ? "Desativar" : "Ativar"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-red-400 hover:text-red-300"
                        onClick={() => { if (confirm("Excluir template?")) deleteTemplate.mutate(tpl.id); }}
                      >
                        <Trash2 className="size-3 mr-1" />Excluir
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* LOGS TAB */}
        <TabsContent value="logs" className="space-y-4">
          <div className="flex gap-2 items-center">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar telefone ou mensagem..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <Select value={logEventFilter} onValueChange={setLogEventFilter}>
              <SelectTrigger className="w-48 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os eventos</SelectItem>
                {EVENT_KEYS.map((e) => (
                  <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => refetchLogs()}>
              <RefreshCw className="size-3.5" />
            </Button>
          </div>

          {loadingLogs ? (
            <div className="text-center text-muted-foreground py-8">Carregando...</div>
          ) : !logs?.length ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Clock className="size-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">Nenhum envio registrado</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {logs.map((log: any) => (
                <Card key={log.id}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="shrink-0">
                      {log.status === "failed" ? (
                        <XCircle className="size-5 text-red-400" />
                      ) : (
                        <CheckCircle className="size-5 text-green-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-medium text-foreground flex items-center gap-1">
                          <Phone className="size-3" />{log.phone}
                        </span>
                        <Badge className={`text-[9px] ${STATUS_COLORS[log.status] || ""}`}>
                          {log.status}
                        </Badge>
                        <Badge variant="secondary" className="text-[9px]">
                          {EVENT_KEYS.find((e) => e.value === log.event_key)?.label || log.event_key}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{log.message_sent}</p>
                      {log.error_message && (
                        <p className="text-[10px] text-red-400 truncate mt-0.5">{log.error_message}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(log.created_at).toLocaleString("pt-BR")}
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Template Modal */}
      <Dialog open={showTemplateModal} onOpenChange={setShowTemplateModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Editar Template" : "Novo Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nome do Template</label>
              <Input
                value={tplForm.name}
                onChange={(e) => setTplForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Aviso vencimento proxy"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Tipo de Evento</label>
              <Select value={tplForm.event_key} onValueChange={(v) => setTplForm((f) => ({ ...f, event_key: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_KEYS.map((e) => (
                    <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Mensagem</label>
              <Textarea
                value={tplForm.message_body}
                onChange={(e) => setTplForm((f) => ({ ...f, message_body: e.target.value }))}
                placeholder={"Olá {{nome}}, seu proxy {{produto}} vence em {{data}}. Renove agora!"}
                rows={5}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Placeholders: {"{{nome}}"}, {"{{produto}}"}, {"{{valor}}"}, {"{{data}}"}, {"{{link}}"}, {"{{email}}"}
              </p>
            </div>
            <Button
              onClick={() => saveTemplate.mutate()}
              disabled={!tplForm.name || !tplForm.message_body || saveTemplate.isPending}
              className="w-full"
            >
              {saveTemplate.isPending ? "Salvando..." : editingTemplate ? "Salvar Alterações" : "Criar Template"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Send Modal */}
      <Dialog open={showQuickSend} onOpenChange={setShowQuickSend}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="size-4 text-green-500" />
              Envio Rápido de WhatsApp
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Telefone (com DDD)</label>
              <Input
                value={quickPhone}
                onChange={(e) => setQuickPhone(e.target.value)}
                placeholder="11999999999"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Tipo de Evento</label>
              <Select value={quickEventKey} onValueChange={setQuickEventKey}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_KEYS.map((e) => (
                    <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Mensagem</label>
              <Textarea
                value={quickMessage}
                onChange={(e) => setQuickMessage(e.target.value)}
                placeholder="Digite a mensagem..."
                rows={4}
              />
            </div>
            <Button
              onClick={() => sendQuick.mutate()}
              disabled={!quickPhone || !quickMessage || sendQuick.isPending}
              className="w-full bg-green-600 hover:bg-green-700 gap-1"
            >
              <Send className="size-3.5" />
              {sendQuick.isPending ? "Enviando..." : "Enviar Mensagem"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
