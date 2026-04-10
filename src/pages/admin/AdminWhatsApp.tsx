import { useState, useMemo } from "react";
import {
  MessageCircle, Plus, Send, Eye, Trash2, ToggleLeft, ToggleRight, Search, Phone, Clock,
  CheckCircle, XCircle, RefreshCw, Users, Zap, Bell, AlertTriangle, Image, MousePointerClick,
  BarChart3, ArrowUpRight, MessageSquareReply, CheckCheck, Mail, TrendingUp
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
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
  replied: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  failed: "bg-red-500/20 text-red-400 border-red-500/30",
};

const STATUS_LABELS: Record<string, string> = {
  queued: "Na fila",
  sent: "Enviado",
  delivered: "Entregue",
  read: "Lido",
  replied: "Respondido",
  failed: "Falhou",
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
        .limit(500);
      if (eventFilter && eventFilter !== "all") q = q.eq("event_key", eventFilter);
      if (search) q = q.or(`phone.ilike.%${search}%,message_sent.ilike.%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    refetchInterval: 15_000,
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

// ============= STATS CARD COMPONENT =============
function StatCard({ label, value, icon: Icon, color, subtitle }: { label: string; value: string | number; icon: any; color: string; subtitle?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className={`flex items-center justify-center size-8 rounded-lg ${color}`}>
            <Icon className="size-4 text-white" />
          </div>
        </div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

// ============= RATE BAR COMPONENT =============
function RateBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{value} ({pct}%)</span>
      </div>
      <Progress value={pct} className={`h-2 ${color}`} />
    </div>
  );
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
  const [quickSendType, setQuickSendType] = useState<"text" | "image" | "button">("text");
  const [quickImageUrl, setQuickImageUrl] = useState("");
  const [quickButtons, setQuickButtons] = useState<Array<{ id: string; text: string }>>([{ id: "1", text: "" }]);

  // Connection status
  const [connectionStatus, setConnectionStatus] = useState<any>(null);

  // Expiring alerts
  const [showExpiringModal, setShowExpiringModal] = useState(false);
  const [expiringDays, setExpiringDays] = useState("0");
  const [expiringResults, setExpiringResults] = useState<any>(null);

  const sendExpiringAlerts = useMutation({
    mutationFn: (dryRun: boolean) =>
      callWapi("send-expiring-alerts", { days_ahead: Number(expiringDays), dry_run: dryRun }),
    onSuccess: (data) => {
      setExpiringResults(data);
      if (!data.dry_run) {
        toast.success(`${data.queued || data.sent} mensagem(ns) enfileirada(s)!`);
        qc.invalidateQueries({ queryKey: ["whatsapp-logs"] });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
    mutationFn: () => {
      if (quickSendType === "image") {
        return callWapi("send-image", { phone: quickPhone, image_url: quickImageUrl, caption: quickMessage, event_key: quickEventKey });
      }
      if (quickSendType === "button") {
        const validButtons = quickButtons.filter((b) => b.text.trim());
        return callWapi("send-button", { phone: quickPhone, message: quickMessage, buttons: validButtons, event_key: quickEventKey });
      }
      return callWapi("send-text", { phone: quickPhone, message: quickMessage, event_key: quickEventKey });
    },
    onSuccess: () => {
      toast.success("Mensagem enviada!");
      setShowQuickSend(false);
      setQuickPhone("");
      setQuickMessage("");
      setQuickImageUrl("");
      qc.invalidateQueries({ queryKey: ["whatsapp-logs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const checkConnection = useMutation({
    mutationFn: () => callWapi("check-status", {}),
    onSuccess: (data) => {
      setConnectionStatus(data.status);
      toast.success(data.connected ? "WhatsApp conectado!" : "WhatsApp desconectado!");
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

  // ============= COMPUTED STATS =============
  const stats = useMemo(() => {
    if (!logs) return { total: 0, sent: 0, delivered: 0, read: 0, replied: 0, failed: 0, today: 0, byEvent: {} as Record<string, any> };

    const todayStr = new Date().toISOString().slice(0, 10);
    const byEvent: Record<string, { total: number; sent: number; delivered: number; read: number; replied: number; failed: number }> = {};

    for (const l of logs as any[]) {
      const ek = l.event_key || "custom";
      if (!byEvent[ek]) byEvent[ek] = { total: 0, sent: 0, delivered: 0, read: 0, replied: 0, failed: 0 };
      byEvent[ek].total++;
      if (l.status === "failed") byEvent[ek].failed++;
      else byEvent[ek].sent++;
      if (l.delivered_at) byEvent[ek].delivered++;
      if (l.read_at) byEvent[ek].read++;
      if (l.replied_at) byEvent[ek].replied++;
    }

    return {
      total: logs.length,
      sent: logs.filter((l: any) => l.status !== "failed").length,
      delivered: logs.filter((l: any) => l.delivered_at).length,
      read: logs.filter((l: any) => l.read_at).length,
      replied: logs.filter((l: any) => l.replied_at).length,
      failed: logs.filter((l: any) => l.status === "failed").length,
      today: logs.filter((l: any) => l.created_at?.startsWith(todayStr)).length,
      byEvent,
    };
  }, [logs]);

  // Group logs by template for campaign view
  const campaigns = useMemo(() => {
    if (!logs || !templates) return [];
    const map: Record<string, { template: any; logs: any[]; stats: any }> = {};

    for (const l of logs as any[]) {
      const key = l.template_id || "direct";
      if (!map[key]) {
        const tpl = templates?.find((t: any) => t.id === l.template_id);
        map[key] = { template: tpl || { name: "Envio Direto", event_key: l.event_key }, logs: [], stats: {} };
      }
      map[key].logs.push(l);
    }

    return Object.entries(map).map(([id, { template, logs: cLogs }]) => {
      const total = cLogs.length;
      const sent = cLogs.filter((l: any) => l.status !== "failed").length;
      const delivered = cLogs.filter((l: any) => l.delivered_at).length;
      const read = cLogs.filter((l: any) => l.read_at).length;
      const replied = cLogs.filter((l: any) => l.replied_at).length;
      const failed = cLogs.filter((l: any) => l.status === "failed").length;
      const lastSent = cLogs[0]?.created_at;

      return {
        id,
        template,
        total,
        sent,
        delivered,
        read,
        replied,
        failed,
        lastSent,
        deliveryRate: sent > 0 ? Math.round((delivered / sent) * 100) : 0,
        readRate: delivered > 0 ? Math.round((read / delivered) * 100) : 0,
        replyRate: delivered > 0 ? Math.round((replied / delivered) * 100) : 0,
      };
    }).sort((a, b) => new Date(b.lastSent || 0).getTime() - new Date(a.lastSent || 0).getTime());
  }, [logs, templates]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-10 rounded-xl bg-gradient-to-br from-green-500 to-green-700 shadow-lg shadow-green-500/20">
            <MessageCircle className="text-white size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">WhatsApp Automático</h1>
            <p className="text-xs text-muted-foreground">Dashboard completo de envios via W-API</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => checkConnection.mutate()} disabled={checkConnection.isPending}>
            <Zap className="size-3.5 mr-1" />
            {checkConnection.isPending ? "..." : "Conexão"}
          </Button>
          <Button size="sm" onClick={() => { setExpiringResults(null); setShowExpiringModal(true); }} className="gap-1 bg-amber-600 hover:bg-amber-700">
            <Bell className="size-3.5" />
            Avisos Vencimento
          </Button>
          <Button size="sm" onClick={() => setShowQuickSend(true)} className="gap-1 bg-green-600 hover:bg-green-700">
            <Send className="size-3.5" />
            Envio Rápido
          </Button>
        </div>
      </div>

      {/* Connection status */}
      {connectionStatus && (
        <div className={`rounded-lg p-3 border ${connectionStatus.connected ? "bg-green-500/10 border-green-500/20" : "bg-red-500/10 border-red-500/20"}`}>
          <p className="text-xs">
            {connectionStatus.connected ? "✅ WhatsApp conectado" : "❌ WhatsApp desconectado"} — Instância: {connectionStatus.instanceId}
          </p>
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <StatCard label="Total Envios" value={stats.total} icon={Mail} color="bg-blue-600" />
        <StatCard label="Enviados" value={stats.sent} icon={Send} color="bg-sky-600" />
        <StatCard label="Entregues" value={stats.delivered} icon={CheckCheck} color="bg-green-600" subtitle={stats.sent > 0 ? `${Math.round((stats.delivered / stats.sent) * 100)}%` : ""} />
        <StatCard label="Lidos" value={stats.read} icon={Eye} color="bg-emerald-600" subtitle={stats.delivered > 0 ? `${Math.round((stats.read / stats.delivered) * 100)}%` : ""} />
        <StatCard label="Respondidos" value={stats.replied} icon={MessageSquareReply} color="bg-purple-600" subtitle={stats.delivered > 0 ? `${Math.round((stats.replied / stats.delivered) * 100)}%` : ""} />
        <StatCard label="Falhas" value={stats.failed} icon={XCircle} color="bg-red-600" subtitle={stats.total > 0 ? `${Math.round((stats.failed / stats.total) * 100)}%` : ""} />
        <StatCard label="Hoje" value={stats.today} icon={TrendingUp} color="bg-amber-600" />
      </div>

      {/* Funnel Rates */}
      {stats.total > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="size-4 text-green-500" />
              Funil de Engajamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <RateBar label="📤 Enviados" value={stats.sent} total={stats.total} color="[&>div]:bg-blue-500" />
            <RateBar label="📬 Entregues" value={stats.delivered} total={stats.sent} color="[&>div]:bg-green-500" />
            <RateBar label="👀 Lidos (✓✓)" value={stats.read} total={stats.delivered} color="[&>div]:bg-emerald-500" />
            <RateBar label="💬 Respondidos" value={stats.replied} total={stats.delivered} color="[&>div]:bg-purple-500" />
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="campaigns" className="space-y-4">
        <TabsList className="bg-card/60 border border-border/40">
          <TabsTrigger value="campaigns">
            <BarChart3 className="size-4 mr-1.5" />Campanhas
          </TabsTrigger>
          <TabsTrigger value="templates">
            <MessageCircle className="size-4 mr-1.5" />Templates
          </TabsTrigger>
          <TabsTrigger value="logs">
            <Clock className="size-4 mr-1.5" />Histórico
          </TabsTrigger>
        </TabsList>

        {/* CAMPAIGNS TAB */}
        <TabsContent value="campaigns" className="space-y-4">
          {!campaigns.length ? (
            <Card>
              <CardContent className="py-12 text-center">
                <BarChart3 className="size-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">Nenhuma campanha registrada</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {campaigns.map((c) => (
                <Card key={c.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-sm text-foreground">{c.template.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-[10px]">
                            {EVENT_KEYS.find((e) => e.value === c.template.event_key)?.label || c.template.event_key}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            Último: {c.lastSent ? new Date(c.lastSent).toLocaleString("pt-BR") : "—"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">
                          <Users className="size-3 mr-1" />{c.total} destinatários
                        </Badge>
                      </div>
                    </div>

                    {/* Campaign metrics */}
                    <div className="grid grid-cols-5 gap-3 mb-3">
                      <div className="text-center p-2 rounded-lg bg-muted/30">
                        <p className="text-lg font-bold text-blue-400">{c.sent}</p>
                        <p className="text-[9px] text-muted-foreground uppercase">Enviados</p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-muted/30">
                        <p className="text-lg font-bold text-green-400">{c.delivered}</p>
                        <p className="text-[9px] text-muted-foreground uppercase">Entregues</p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-muted/30">
                        <p className="text-lg font-bold text-emerald-400">{c.read}</p>
                        <p className="text-[9px] text-muted-foreground uppercase">Lidos</p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-muted/30">
                        <p className="text-lg font-bold text-purple-400">{c.replied}</p>
                        <p className="text-[9px] text-muted-foreground uppercase">Respondidos</p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-muted/30">
                        <p className="text-lg font-bold text-red-400">{c.failed}</p>
                        <p className="text-[9px] text-muted-foreground uppercase">Falhas</p>
                      </div>
                    </div>

                    {/* Rate bars */}
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-muted-foreground">Entrega</span>
                          <span className="font-medium text-green-400">{c.deliveryRate}%</span>
                        </div>
                        <Progress value={c.deliveryRate} className="h-1.5 [&>div]:bg-green-500" />
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-muted-foreground">Leitura</span>
                          <span className="font-medium text-emerald-400">{c.readRate}%</span>
                        </div>
                        <Progress value={c.readRate} className="h-1.5 [&>div]:bg-emerald-500" />
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-muted-foreground">Resposta</span>
                          <span className="font-medium text-purple-400">{c.replyRate}%</span>
                        </div>
                        <Progress value={c.replyRate} className="h-1.5 [&>div]:bg-purple-500" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* TEMPLATES TAB */}
        <TabsContent value="templates" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Placeholders: <code className="text-green-400">{"{{nome}}"}</code>, <code className="text-green-400">{"{{produto}}"}</code>, <code className="text-green-400">{"{{valor}}"}</code>, <code className="text-green-400">{"{{data}}"}</code>, <code className="text-green-400">{"{{link}}"}</code>
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
              {templates.map((tpl: any) => {
                // Count logs for this template
                const tplLogs = logs?.filter((l: any) => l.template_id === tpl.id) || [];
                const tplSent = tplLogs.filter((l: any) => l.status !== "failed").length;
                const tplDelivered = tplLogs.filter((l: any) => l.delivered_at).length;
                const tplRead = tplLogs.filter((l: any) => l.read_at).length;

                return (
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

                      {/* Template mini stats */}
                      {tplLogs.length > 0 && (
                        <div className="flex gap-3 text-[10px]">
                          <span className="text-blue-400">📤 {tplSent} enviados</span>
                          <span className="text-green-400">📬 {tplDelivered} entregues</span>
                          <span className="text-emerald-400">👀 {tplRead} lidos</span>
                        </div>
                      )}

                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openEdit(tpl)}>
                          <Eye className="size-3 mr-1" />Editar
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => toggleTemplate.mutate({ id: tpl.id, active: tpl.active })}>
                          {tpl.active ? <ToggleRight className="size-3 mr-1" /> : <ToggleLeft className="size-3 mr-1" />}
                          {tpl.active ? "Desativar" : "Ativar"}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400 hover:text-red-300" onClick={() => { if (confirm("Excluir template?")) deleteTemplate.mutate(tpl.id); }}>
                          <Trash2 className="size-3 mr-1" />Excluir
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* LOGS TAB */}
        <TabsContent value="logs" className="space-y-4">
          <div className="flex gap-2 items-center">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input placeholder="Buscar telefone ou mensagem..." value={logSearch} onChange={(e) => setLogSearch(e.target.value)} className="pl-8 h-8 text-xs" />
            </div>
            <Select value={logEventFilter} onValueChange={setLogEventFilter}>
              <SelectTrigger className="w-48 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os eventos</SelectItem>
                {EVENT_KEYS.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
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
                      {log.status === "failed" ? <XCircle className="size-5 text-red-400" /> :
                       log.status === "replied" ? <MessageSquareReply className="size-5 text-purple-400" /> :
                       log.read_at ? <CheckCheck className="size-5 text-emerald-400" /> :
                       log.delivered_at ? <CheckCheck className="size-5 text-green-400" /> :
                       <CheckCircle className="size-5 text-blue-400" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-medium text-foreground flex items-center gap-1">
                          <Phone className="size-3" />{log.phone}
                        </span>
                        <Badge className={`text-[9px] ${STATUS_COLORS[log.status] || ""}`}>
                          {STATUS_LABELS[log.status] || log.status}
                        </Badge>
                        {log.message_type && log.message_type !== "text" && (
                          <Badge variant="outline" className="text-[9px]">
                            {log.message_type === "image" ? <Image className="size-2.5 mr-0.5" /> : <MousePointerClick className="size-2.5 mr-0.5" />}
                            {log.message_type}
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-[9px]">
                          {EVENT_KEYS.find((e) => e.value === log.event_key)?.label || log.event_key}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{log.message_sent}</p>

                      {/* Status timeline */}
                      <div className="flex gap-2 mt-1">
                        {log.delivered_at && <span className="text-[9px] text-green-400">📬 {new Date(log.delivered_at).toLocaleTimeString("pt-BR")}</span>}
                        {log.read_at && <span className="text-[9px] text-emerald-400">👀 {new Date(log.read_at).toLocaleTimeString("pt-BR")}</span>}
                        {log.replied_at && <span className="text-[9px] text-purple-400">💬 {new Date(log.replied_at).toLocaleTimeString("pt-BR")}</span>}
                      </div>

                      {log.reply_message && (
                        <p className="text-[10px] text-purple-300 bg-purple-500/10 rounded px-2 py-1 mt-1 truncate">↩ {log.reply_message}</p>
                      )}
                      {log.error_message && <p className="text-[10px] text-red-400 truncate mt-0.5">{log.error_message}</p>}
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
              <Input value={tplForm.name} onChange={(e) => setTplForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Aviso vencimento proxy" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Tipo de Evento</label>
              <Select value={tplForm.event_key} onValueChange={(v) => setTplForm((f) => ({ ...f, event_key: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_KEYS.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Mensagem</label>
              <Textarea value={tplForm.message_body} onChange={(e) => setTplForm((f) => ({ ...f, message_body: e.target.value }))} placeholder={"Olá {{nome}}, seu proxy {{produto}} vence em {{data}}. Renove agora!"} rows={5} />
              <p className="text-[10px] text-muted-foreground mt-1">
                Placeholders: {"{{nome}}"}, {"{{produto}}"}, {"{{valor}}"}, {"{{data}}"}, {"{{link}}"}, {"{{email}}"}
              </p>
            </div>
            <Button onClick={() => saveTemplate.mutate()} disabled={!tplForm.name || !tplForm.message_body || saveTemplate.isPending} className="w-full">
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
            {/* Send type selector */}
            <div className="flex gap-1">
              {[
                { val: "text" as const, label: "Texto", icon: MessageCircle },
                { val: "image" as const, label: "Imagem", icon: Image },
                { val: "button" as const, label: "Botões", icon: MousePointerClick },
              ].map((t) => (
                <Button key={t.val} size="sm" variant={quickSendType === t.val ? "default" : "outline"} onClick={() => setQuickSendType(t.val)} className="flex-1 gap-1 text-xs">
                  <t.icon className="size-3" />{t.label}
                </Button>
              ))}
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Telefone (com DDD)</label>
              <Input value={quickPhone} onChange={(e) => setQuickPhone(e.target.value)} placeholder="11999999999" />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Tipo de Evento</label>
              <Select value={quickEventKey} onValueChange={setQuickEventKey}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_KEYS.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {quickSendType === "image" && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">URL da Imagem</label>
                <Input value={quickImageUrl} onChange={(e) => setQuickImageUrl(e.target.value)} placeholder="https://..." />
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                {quickSendType === "image" ? "Legenda (opcional)" : "Mensagem"}
              </label>
              <Textarea value={quickMessage} onChange={(e) => setQuickMessage(e.target.value)} placeholder="Digite a mensagem..." rows={4} />
            </div>

            {quickSendType === "button" && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Botões (máx 3)</label>
                {quickButtons.map((btn, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={btn.text}
                      onChange={(e) => {
                        const nb = [...quickButtons];
                        nb[i] = { ...nb[i], text: e.target.value };
                        setQuickButtons(nb);
                      }}
                      placeholder={`Texto do botão ${i + 1}`}
                      className="text-xs"
                    />
                    {quickButtons.length > 1 && (
                      <Button size="sm" variant="ghost" className="shrink-0" onClick={() => setQuickButtons(quickButtons.filter((_, j) => j !== i))}>
                        <Trash2 className="size-3" />
                      </Button>
                    )}
                  </div>
                ))}
                {quickButtons.length < 3 && (
                  <Button size="sm" variant="outline" className="text-xs w-full" onClick={() => setQuickButtons([...quickButtons, { id: String(quickButtons.length + 1), text: "" }])}>
                    <Plus className="size-3 mr-1" />Adicionar Botão
                  </Button>
                )}
              </div>
            )}

            <Button
              onClick={() => sendQuick.mutate()}
              disabled={!quickPhone || (!quickMessage && quickSendType !== "image") || (quickSendType === "image" && !quickImageUrl) || sendQuick.isPending}
              className="w-full bg-green-600 hover:bg-green-700 gap-1"
            >
              <Send className="size-3.5" />
              {sendQuick.isPending ? "Enviando..." : "Enviar Mensagem"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Expiring Alerts Modal */}
      <Dialog open={showExpiringModal} onOpenChange={setShowExpiringModal}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="size-4 text-amber-500" />
              Disparar Avisos de Vencimento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Vencimento em quantos dias?</label>
              <Select value={expiringDays} onValueChange={setExpiringDays}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Hoje</SelectItem>
                  <SelectItem value="1">Amanhã</SelectItem>
                  <SelectItem value="2">Em 2 dias</SelectItem>
                  <SelectItem value="3">Em 3 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => sendExpiringAlerts.mutate(true)} disabled={sendExpiringAlerts.isPending} className="flex-1">
                <Eye className="size-3.5 mr-1" />
                {sendExpiringAlerts.isPending ? "Buscando..." : "Pré-visualizar"}
              </Button>
              <Button
                onClick={() => {
                  if (confirm(`Confirma o envio dos avisos?`)) sendExpiringAlerts.mutate(false);
                }}
                disabled={sendExpiringAlerts.isPending}
                className="flex-1 bg-amber-600 hover:bg-amber-700"
              >
                <Send className="size-3.5 mr-1" />Enviar Agora
              </Button>
            </div>

            {expiringResults && (
              <div className="space-y-3">
                <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                  <p className="text-xs font-medium text-foreground">
                    📅 Data: {expiringResults.date} | {expiringResults.dry_run ? "🔍 Pré-visualização" : "✅ Enfileirado"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {expiringResults.total_subs} assinatura(s) • {expiringResults.total_users || expiringResults.results?.length} cliente(s)
                    {expiringResults.queued != null && ` • ${expiringResults.queued} enfileirado(s)`}
                    {expiringResults.no_phone != null && Number(expiringResults.no_phone) > 0 && ` • ${expiringResults.no_phone} sem telefone`}
                  </p>
                </div>

                {expiringResults.results?.length > 0 ? (
                  <div className="space-y-2">
                    {expiringResults.results.map((r: any, i: number) => (
                      <div key={i} className="rounded-lg border border-border/40 p-2.5 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                            {r.success !== false ? <CheckCircle className="size-3.5 text-green-400" /> : <XCircle className="size-3.5 text-red-400" />}
                            {r.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{r.phone || "sem telefone"}</span>
                        </div>
                        {r.message_preview && (
                          <p className="text-[11px] text-muted-foreground whitespace-pre-wrap bg-muted/30 rounded p-2 max-h-20 overflow-y-auto">
                            {r.message_preview}
                          </p>
                        )}
                        {r.error && <p className="text-[10px] text-red-400">{r.error}</p>}
                      </div>
                    ))}
                  </div>
                ) : !expiringResults.dry_run ? null : (
                  <div className="text-center py-4">
                    <AlertTriangle className="size-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-xs text-muted-foreground">{expiringResults.message || "Nenhum cliente para notificar"}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
