import { useState, useEffect, useRef, useCallback } from "react";
import { validateImageFile } from "@/lib/file-validation";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Bell, Monitor, Search, Link as LinkIcon, Edit, Trash2, Send, Image,
  Megaphone, Clock, Loader2, X, Users, Globe, UserPlus, Palette,
  BarChart3, Eye, CheckCircle, XCircle, MousePointerClick, Plus,
  ArrowRight, CalendarClock,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";

interface AdminNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  image_url: string | null;
  link: string | null;
  cta_text?: string | null;
  cta_color?: string | null;
  status: string;
  scheduled_at: string | null;
  is_active: boolean;
  global: boolean;
  target_user_ids: string[] | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface UserOption {
  user_id: string;
  full_name: string | null;
}

interface CampaignMetric {
  id: string;
  title: string;
  type: string;
  sent_at: string;
  global: boolean;
  target_count: number;
  total_sent: number;
  total_read: number;
}

interface ReaderUser {
  user_id: string;
  full_name: string | null;
  read: boolean;
}

const BUTTON_COLORS = [
  { label: "Vermelho", value: "#dc2626" },
  { label: "Verde", value: "#16a34a" },
  { label: "Azul", value: "#2563eb" },
  { label: "Roxo", value: "#7c3aed" },
  { label: "Laranja", value: "#ea580c" },
  { label: "Rosa", value: "#db2777" },
  { label: "Amarelo", value: "#ca8a04" },
  { label: "Ciano", value: "#0891b2" },
];

const inputCls = "bg-[rgba(20,20,20,0.6)] border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:border-primary focus:ring-primary/20 h-9";

export default function AdminNotificacoes() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("criar");

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formType, setFormType] = useState<"push" | "popup">("push");
  const [formTitle, setFormTitle] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formLink, setFormLink] = useState("");
  const [formCtaText, setFormCtaText] = useState("");
  const [formCtaColor, setFormCtaColor] = useState("#dc2626");

  // Send modal state
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [sendingNotif, setSendingNotif] = useState<AdminNotification | null>(null);
  const [sendAudience, setSendAudience] = useState<"all" | "specific">("all");
  const [sendSchedule, setSendSchedule] = useState<"now" | "schedule">("now");
  const [sendScheduledAt, setSendScheduledAt] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<UserOption[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<UserOption[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const userSearchTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Metrics state
  const [metrics, setMetrics] = useState<CampaignMetric[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(false);

  // Readers modal
  const [readersModalOpen, setReadersModalOpen] = useState(false);
  const [readersModalTitle, setReadersModalTitle] = useState("");
  const [readers, setReaders] = useState<ReaderUser[]>([]);
  const [readersLoading, setReadersLoading] = useState(false);
  const [readersFilter, setReadersFilter] = useState<"all" | "read" | "unread">("all");

  // ── Data fetching ──

  const fetchNotifications = async () => {
    const { data, error } = await supabase
      .from("admin_notifications")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar notificações");
    else setNotifications((data || []) as AdminNotification[]);
    setLoading(false);
  };

  useEffect(() => { fetchNotifications(); }, []);

  const fetchMetrics = useCallback(async () => {
    setMetricsLoading(true);
    const { data: campaigns } = await supabase
      .from("admin_notifications")
      .select("*")
      .eq("status", "sent")
      .order("updated_at", { ascending: false });

    if (!campaigns || campaigns.length === 0) {
      setMetrics([]);
      setMetricsLoading(false);
      return;
    }

    const campaignIds = campaigns.map(c => c.id);
    const { data: notifs } = await supabase
      .from("notifications")
      .select("campaign_id, read")
      .in("campaign_id", campaignIds);

    const statsMap: Record<string, { total: number; read: number }> = {};
    (notifs || []).forEach((n: any) => {
      if (!n.campaign_id) return;
      if (!statsMap[n.campaign_id]) statsMap[n.campaign_id] = { total: 0, read: 0 };
      statsMap[n.campaign_id].total++;
      if (n.read) statsMap[n.campaign_id].read++;
    });

    setMetrics(campaigns.map((c: any) => ({
      id: c.id,
      title: c.title,
      type: c.type,
      sent_at: c.updated_at,
      global: c.global,
      target_count: c.target_user_ids?.length || 0,
      total_sent: statsMap[c.id]?.total || 0,
      total_read: statsMap[c.id]?.read || 0,
    })));
    setMetricsLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab === "metricas") fetchMetrics();
  }, [activeTab, fetchMetrics]);

  // Realtime metrics refresh
  useEffect(() => {
    if (activeTab !== "metricas") return;
    const channel = supabase
      .channel("metrics-realtime")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications" }, () => {
        fetchMetrics();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeTab, fetchMetrics]);

  // ── Form handlers ──

  const resetForm = () => {
    setEditingId(null);
    setFormType("push");
    setFormTitle("");
    setFormMessage("");
    setFormImageUrl("");
    setFormLink("");
    setFormCtaText("");
    setFormCtaColor("#dc2626");
  };

  const handleSaveNotification = async () => {
    if (!formTitle.trim()) { toast.error("Título é obrigatório"); return; }
    setSaving(true);

    const payload: any = {
      type: formType,
      title: formTitle.trim(),
      message: formMessage.trim(),
      image_url: formImageUrl.trim() || null,
      link: formLink.trim() || "",
      cta_text: formCtaText.trim() || null,
      cta_color: formCtaColor || null,
      status: "draft",
      is_active: false,
      global: false,
      target_user_ids: null,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from("admin_notifications").update(payload as any).eq("id", editingId));
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      payload.created_by = user?.id || null;
      ({ error } = await supabase.from("admin_notifications").insert(payload as any));
    }

    if (error) { toast.error("Erro ao salvar"); setSaving(false); return; }
    toast.success(editingId ? "Notificação atualizada!" : "Notificação criada!");
    resetForm();
    fetchNotifications();
    setSaving(false);
    // Switch to manage tab to see the new notification
    if (!editingId) setActiveTab("campanhas");
  };

  const handleEdit = (n: AdminNotification) => {
    setEditingId(n.id);
    setFormType(n.type as "push" | "popup");
    setFormTitle(n.title);
    setFormMessage(n.message);
    setFormImageUrl(n.image_url || "");
    setFormLink(n.link || "");
    setFormCtaText(n.cta_text || "");
    setFormCtaColor((n as any).cta_color || "#dc2626");
    setActiveTab("criar");
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("admin_notifications").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir");
    else { toast.success("Notificação excluída"); fetchNotifications(); }
  };

  const handleToggleActive = async (n: AdminNotification) => {
    await supabase.from("admin_notifications").update({ is_active: !n.is_active }).eq("id", n.id);
    fetchNotifications();
  };

  // ── Send modal ──

  const openSendModal = (n: AdminNotification) => {
    setSendingNotif(n);
    setSendAudience(n.global ? "all" : (n.target_user_ids?.length ? "specific" : "all"));
    setSendSchedule("now");
    setSendScheduledAt("");
    setSelectedUsers([]);
    setUserSearch("");
    setUserResults([]);
    setSendModalOpen(true);

    // Load existing users if specific
    if (n.target_user_ids?.length) {
      supabase.from("profiles").select("user_id, full_name").in("user_id", n.target_user_ids)
        .then(({ data }) => setSelectedUsers((data || []) as UserOption[]));
    }
  };

  const searchUsers = async (query: string) => {
    if (query.length < 2) { setUserResults([]); return; }
    setSearchingUsers(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .or(`full_name.ilike.%${query}%`)
      .limit(10);
    setUserResults((data || []).filter(u => !selectedUsers.some(s => s.user_id === u.user_id)) as UserOption[]);
    setSearchingUsers(false);
  };

  const handleUserSearch = (val: string) => {
    setUserSearch(val);
    if (userSearchTimeout.current) clearTimeout(userSearchTimeout.current);
    userSearchTimeout.current = setTimeout(() => searchUsers(val), 300);
  };

  const handleDispatch = async () => {
    if (!sendingNotif) return;
    setDispatching(true);

    const n = sendingNotif;
    const isGlobal = sendAudience === "all";
    const targetIds = !isGlobal ? selectedUsers.map(u => u.user_id) : null;

    if (!isGlobal && (!targetIds || targetIds.length === 0)) {
      toast.error("Selecione ao menos um usuário");
      setDispatching(false);
      return;
    }

    // Update audience on admin_notifications
    await supabase.from("admin_notifications").update({
      global: isGlobal,
      target_user_ids: targetIds,
      scheduled_at: sendSchedule === "schedule" && sendScheduledAt ? new Date(sendScheduledAt).toISOString() : null,
    } as any).eq("id", n.id);

    if (sendSchedule === "schedule" && sendScheduledAt) {
      await supabase.from("admin_notifications").update({ status: "scheduled" } as any).eq("id", n.id);
      toast.success("Notificação agendada!");
      setSendModalOpen(false);
      setDispatching(false);
      fetchNotifications();
      return;
    }

    // Dispatch now
    const notifBase: any = {
      title: n.title,
      message: n.message,
      type: n.type === "push" ? "info" : "promo",
      link: n.link || null,
      image_url: n.image_url || null,
      cta_text: n.cta_text || null,
      cta_color: (n as any).cta_color || null,
      campaign_id: n.id,
    };

    let sendError;
    if (isGlobal) {
      let allUserIds: string[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data: page, error: usersError } = await supabase
          .from("profiles").select("user_id").eq("status", "active")
          .range(from, from + pageSize - 1);
        if (usersError) { toast.error("Erro ao buscar usuários"); setDispatching(false); return; }
        if (!page || page.length === 0) break;
        allUserIds.push(...page.map((u: any) => u.user_id));
        if (page.length < pageSize) break;
        from += pageSize;
      }
      const uniqueIds = [...new Set(allUserIds)];
      if (uniqueIds.length === 0) { toast.error("Nenhum usuário ativo"); setDispatching(false); return; }

      for (let i = 0; i < uniqueIds.length; i += 500) {
        const batch = uniqueIds.slice(i, i + 500);
        const { error } = await supabase.from("notifications").insert(
          batch.map(uid => ({ ...notifBase, global: false, user_id: uid })) as any
        );
        if (error) { sendError = error; break; }
      }
    } else if (targetIds && targetIds.length > 0) {
      const { error } = await supabase.from("notifications").insert(
        targetIds.map(uid => ({ ...notifBase, global: false, user_id: uid })) as any
      );
      sendError = error || undefined;
    }

    if (sendError) { toast.error("Erro ao enviar"); setDispatching(false); return; }

    await supabase.from("admin_notifications").update({ status: "sent", is_active: true } as any).eq("id", n.id);
    toast.success("Notificação enviada!");
    setSendModalOpen(false);
    setDispatching(false);
    fetchNotifications();
  };

  // ── Metrics readers modal ──

  const openReadersModal = useCallback(async (campaignId: string, title: string) => {
    setReadersModalTitle(title);
    setReadersModalOpen(true);
    setReadersLoading(true);
    setReadersFilter("all");

    let allNotifs: { user_id: string; read: boolean }[] = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from("notifications").select("user_id, read")
        .eq("campaign_id", campaignId).not("user_id", "is", null)
        .range(from, from + pageSize - 1);
      if (error || !data || data.length === 0) break;
      allNotifs.push(...(data as any));
      if (data.length < pageSize) break;
      from += pageSize;
    }

    const userIds = [...new Set(allNotifs.map(n => n.user_id).filter(Boolean))] as string[];
    const profiles: Record<string, string | null> = {};
    for (let i = 0; i < userIds.length; i += 500) {
      const batch = userIds.slice(i, i + 500);
      const { data: pd } = await supabase.from("profiles").select("user_id, full_name").in("user_id", batch);
      (pd || []).forEach((p: any) => { profiles[p.user_id] = p.full_name; });
    }

    const list: ReaderUser[] = allNotifs.map(n => ({
      user_id: n.user_id,
      full_name: profiles[n.user_id] || null,
      read: n.read,
    }));
    list.sort((a, b) => (a.read === b.read ? 0 : a.read ? -1 : 1));
    setReaders(list);
    setReadersLoading(false);
  }, []);

  // ── Filtered notifications ──

  const filteredNotifications = notifications.filter((n) => {
    if (searchQuery && !n.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (statusFilter !== "all" && n.status !== statusFilter) return false;
    if (typeFilter !== "all" && n.type !== typeFilter) return false;
    return true;
  });

  const getStatusBadge = (status: string) => {
    const cfg: Record<string, { color: string; label: string }> = {
      sent: { color: "bg-green-500", label: "Enviada" },
      scheduled: { color: "bg-yellow-500", label: "Agendada" },
      draft: { color: "bg-gray-400", label: "Rascunho" },
    };
    const c = cfg[status] || cfg.draft;
    return (
      <span className="bg-black/60 backdrop-blur-md border border-white/10 px-2 py-0.5 rounded-full text-[10px] font-medium text-white flex items-center gap-1">
        <span className={`w-1.5 h-1.5 rounded-full ${c.color}`} />
        {c.label}
      </span>
    );
  };

  // ── Render ──

  return (
    <div className="flex flex-col gap-4 py-4">
      <header>
        <h1 className="text-2xl font-black tracking-tight text-white">Notificações</h1>
        <p className="text-white/50 text-sm">Crie, gerencie e monitore alertas e pop-ups.</p>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-black/40 border border-white/10 mb-4">
          <TabsTrigger value="criar" className="data-[state=active]:bg-primary data-[state=active]:text-white text-white/60 text-xs gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Criar
          </TabsTrigger>
          <TabsTrigger value="campanhas" className="data-[state=active]:bg-primary data-[state=active]:text-white text-white/60 text-xs gap-1.5">
            <Megaphone className="w-3.5 h-3.5" /> Campanhas
          </TabsTrigger>
          <TabsTrigger value="metricas" className="data-[state=active]:bg-primary data-[state=active]:text-white text-white/60 text-xs gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" /> Métricas
          </TabsTrigger>
        </TabsList>

        {/* ═══ TAB: CRIAR ═══ */}
        <TabsContent value="criar">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Left: Form */}
            <div className="rounded-xl border border-white/10 bg-[rgba(20,20,20,0.4)] p-5 flex flex-col gap-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <h2 className="text-sm font-bold text-white">{editingId ? "Editar Notificação" : "Nova Notificação"}</h2>
                {editingId && (
                  <button onClick={resetForm} className="p-1 rounded hover:bg-white/10 text-white/50">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Type selector */}
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-black/40 rounded-lg">
                <button type="button" onClick={() => setFormType("push")}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-all ${formType === "push" ? "bg-primary text-white" : "text-white/60 hover:text-white/80"}`}>
                  <Bell className="w-3.5 h-3.5" /> Push
                </button>
                <button type="button" onClick={() => setFormType("popup")}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-all ${formType === "popup" ? "bg-primary text-white" : "text-white/60 hover:text-white/80"}`}>
                  <Monitor className="w-3.5 h-3.5" /> Pop-up
                </button>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-white/70">Título</label>
                <Input className={inputCls} placeholder="Ex: Estreia da Temporada 2" value={formTitle} onChange={e => setFormTitle(e.target.value)} />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-white/70">Mensagem</label>
                <Textarea
                  className="bg-[rgba(20,20,20,0.6)] border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 resize-none focus:border-primary focus:ring-primary/20 min-h-[80px]"
                  placeholder="Corpo da notificação..."
                  rows={3}
                  value={formMessage}
                  onChange={e => setFormMessage(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-white/70">Imagem (URL)</label>
                <div className="flex gap-1.5">
                  <Input className={`${inputCls} flex-1`} placeholder="https://..." type="url" value={formImageUrl} onChange={e => setFormImageUrl(e.target.value)} />
                  <input type="file" accept="image/*" className="hidden" id="notif-image-upload"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const validation = await validateImageFile(file, 5);
                      if (!validation.valid) { toast.error(validation.error || 'Arquivo inválido'); return; }
                      setUploading(true);
                      const ext = file.name.split('.').pop();
                      const path = `notifications/${Date.now()}.${ext}`;
                      const { error } = await supabase.storage.from('banners').upload(path, file);
                      if (error) { toast.error('Erro ao enviar imagem'); setUploading(false); return; }
                      const { data: urlData } = supabase.storage.from('banners').getPublicUrl(path);
                      setFormImageUrl(urlData.publicUrl);
                      toast.success('Imagem enviada!');
                      setUploading(false);
                      e.target.value = '';
                    }}
                  />
                  <Button type="button" variant="outline" className="w-9 h-9 p-0 bg-[rgba(20,20,20,0.6)] border-white/10 rounded-lg hover:bg-white/10" disabled={uploading}
                    onClick={() => document.getElementById('notif-image-upload')?.click()}>
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin text-white/70" /> : <Image className="w-4 h-4 text-white/70" />}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-white/70">Link de Destino</label>
                  <Input className={inputCls} placeholder="/pagina" value={formLink} onChange={e => setFormLink(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-white/70">Texto do Botão</label>
                  <Input className={inputCls} placeholder="Ver mais" value={formCtaText} onChange={e => setFormCtaText(e.target.value)} />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-white/70 flex items-center gap-1.5">
                  <Palette className="w-3 h-3" /> Cor do Botão
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {BUTTON_COLORS.map(c => (
                    <button key={c.value} type="button" onClick={() => setFormCtaColor(c.value)}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${formCtaColor === c.value ? "border-white scale-110" : "border-transparent opacity-70 hover:opacity-100"}`}
                      style={{ backgroundColor: c.value }} title={c.label} />
                  ))}
                  <input type="color" value={formCtaColor} onChange={e => setFormCtaColor(e.target.value)}
                    className="w-6 h-6 rounded-full cursor-pointer border-0 p-0 bg-transparent" title="Cor personalizada" />
                </div>
              </div>

              <Button type="button" onClick={handleSaveNotification} disabled={saving}
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-2 rounded-lg text-sm flex items-center justify-center gap-2 mt-2">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                {editingId ? "Salvar Alterações" : "Criar Notificação"}
              </Button>

              <p className="text-[10px] text-white/30 text-center">
                Após criar, vá em <strong>Campanhas</strong> para definir o público e enviar.
              </p>
            </div>

            {/* Right: Live Preview */}
            <div className="sticky top-4 flex flex-col gap-3">
              <p className="text-[11px] font-medium text-white/40 uppercase tracking-wider">Preview em tempo real</p>

              {/* Full-size notification preview */}
              <div className="flex items-center justify-center min-h-[400px] rounded-2xl bg-black/30 border border-white/5 p-6">
                <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
                  {/* Close button mock */}
                  <div className="relative">
                    <button className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-background/80 border border-border cursor-default">
                      <X className="size-4 text-muted-foreground" />
                    </button>

                    {formImageUrl && (
                      <div className="w-full h-48 overflow-hidden bg-muted">
                        <img src={formImageUrl} alt="Preview" className="w-full h-full object-cover"
                          onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }} />
                      </div>
                    )}
                  </div>

                  <div className="p-5 space-y-3">
                    <h3 className="text-base font-bold text-foreground leading-tight">
                      {formTitle || "Título da notificação"}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {formMessage || "Mensagem da notificação..."}
                    </p>

                    <div className="flex items-center gap-3 pt-2">
                      <button className="flex-1 h-9 rounded-lg border border-border text-sm font-medium text-muted-foreground cursor-default">
                        Fechar
                      </button>
                      {(formLink || formCtaText) && (
                        <button className="flex-1 h-9 rounded-lg text-white text-sm font-bold cursor-default"
                          style={{ backgroundColor: formCtaColor }}>
                          {formCtaText || "Ver mais"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ═══ TAB: CAMPANHAS ═══ */}
        <TabsContent value="campanhas">
          <div className="flex flex-col gap-3">
            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
                <Input className={`${inputCls} pl-8 w-full`} placeholder="Buscar..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-[rgba(20,20,20,0.6)] border-white/10 rounded-lg px-2.5 h-9 text-xs text-white/80 w-[120px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-white/10">
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="sent">Enviada</SelectItem>
                  <SelectItem value="scheduled">Agendada</SelectItem>
                  <SelectItem value="draft">Rascunho</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="bg-[rgba(20,20,20,0.6)] border-white/10 rounded-lg px-2.5 h-9 text-xs text-white/80 w-[120px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-white/10">
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="push">Push</SelectItem>
                  <SelectItem value="popup">Pop-up</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => setActiveTab("criar")}
                className="bg-primary/10 border-primary/30 text-primary hover:bg-primary/20 text-xs gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Nova
              </Button>
            </div>

            {/* Cards */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-white/40" />
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="text-center py-12 text-white/40">
                <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">Nenhuma notificação</p>
                <p className="text-xs mt-1">Crie uma na aba "Criar".</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {filteredNotifications.map((n) => (
                  <div key={n.id}
                    className="bg-[#141414] border border-white/[0.05] rounded-xl overflow-hidden flex flex-col group hover:border-primary/30 transition-all duration-200">
                    <div className="h-24 bg-gradient-to-br from-gray-900 to-black relative">
                      {n.image_url ? (
                        <div className="absolute inset-0 bg-cover bg-center opacity-40 group-hover:opacity-60 transition-all" style={{ backgroundImage: `url(${n.image_url})` }} />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent opacity-50" />
                      )}
                      <div className="absolute top-2 left-2 z-10">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 ${n.type === "push" ? "bg-primary text-white" : "bg-white/90 text-black"}`}>
                          {n.type === "push" ? <><Bell className="w-2.5 h-2.5" /> Push</> : <><Monitor className="w-2.5 h-2.5" /> Pop-up</>}
                        </span>
                      </div>
                      <div className="absolute top-2 right-2 z-10">{getStatusBadge(n.status)}</div>
                    </div>

                    <div className="p-3 flex flex-col gap-2 flex-1">
                      <div>
                        <h3 className="text-sm font-bold text-white leading-tight line-clamp-1">{n.title}</h3>
                        <p className="text-xs text-white/50 line-clamp-2 mt-0.5">{n.message}</p>
                      </div>

                      <div className="mt-auto flex flex-col gap-1.5">
                        {n.link && (
                          <div className="bg-white/[0.03] border border-white/5 rounded-md p-1.5 flex items-center gap-2">
                            <LinkIcon className="w-3 h-3 text-white/20 shrink-0" />
                            <span className="text-[10px] font-mono text-white/40 truncate">{n.link}</span>
                          </div>
                        )}

                        {n.scheduled_at && n.status === "scheduled" && (
                          <div className="flex items-center gap-1.5 text-yellow-500/80 text-[10px] font-medium bg-yellow-500/5 px-2 py-1 rounded-md border border-yellow-500/10">
                            <Clock className="w-3 h-3" />
                            {format(new Date(n.scheduled_at), "dd/MM 'às' HH:mm")}
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 text-[10px] text-white/40">
                          {n.target_user_ids && n.target_user_ids.length > 0 ? (
                            <><Users className="w-3 h-3" /> {n.target_user_ids.length} usuário{n.target_user_ids.length > 1 ? "s" : ""}</>
                          ) : n.status === "sent" ? (
                            <><Globe className="w-3 h-3" /> Todos</>
                          ) : (
                            <span className="italic">Público não definido</span>
                          )}
                        </div>

                        <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                          <div className="flex items-center gap-0.5">
                            <button onClick={() => handleEdit(n)} className="p-1.5 text-white/40 hover:text-white hover:bg-white/5 rounded-md transition-colors" title="Editar">
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            {(n.status === "draft" || n.status === "scheduled") && (
                              <button onClick={() => openSendModal(n)} className="p-1.5 text-white/40 hover:text-green-400 hover:bg-green-500/10 rounded-md transition-colors" title="Enviar">
                                <Send className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button onClick={() => handleDelete(n.id)} className="p-1.5 text-white/40 hover:text-primary hover:bg-primary/10 rounded-md transition-colors" title="Excluir">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <Switch checked={n.is_active} onCheckedChange={() => handleToggleActive(n)}
                            className={`scale-75 ${n.status === "scheduled" ? "data-[state=checked]:bg-yellow-600" : "data-[state=checked]:bg-primary"}`} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && filteredNotifications.length > 0 && (
              <p className="text-[11px] text-white/30 mt-1">{filteredNotifications.length} de {notifications.length}</p>
            )}
          </div>
        </TabsContent>

        {/* ═══ TAB: MÉTRICAS ═══ */}
        <TabsContent value="metricas">
          {metricsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-white/40" />
            </div>
          ) : metrics.length === 0 ? (
            <div className="text-center py-12 text-white/40">
              <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">Nenhuma campanha enviada</p>
              <p className="text-xs mt-1">Envie uma notificação para ver as métricas aqui.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-white/10 bg-[rgba(20,20,20,0.4)] p-4">
                  <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Campanhas Enviadas</p>
                  <p className="text-2xl font-black text-white">{metrics.length}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-[rgba(20,20,20,0.4)] p-4">
                  <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Total Notificações</p>
                  <p className="text-2xl font-black text-white">{metrics.reduce((s, m) => s + m.total_sent, 0)}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-[rgba(20,20,20,0.4)] p-4">
                  <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Total Lidas</p>
                  <p className="text-2xl font-black text-green-400">{metrics.reduce((s, m) => s + m.total_read, 0)}</p>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-[rgba(20,20,20,0.4)] overflow-hidden">
                <div className="grid grid-cols-[1fr_80px_80px_80px_100px] gap-2 px-4 py-2.5 border-b border-white/10 text-[10px] uppercase tracking-wider text-white/40 font-medium">
                  <span>Campanha</span>
                  <span className="text-center">Enviadas</span>
                  <span className="text-center">Lidas</span>
                  <span className="text-center">Taxa</span>
                  <span className="text-right">Data</span>
                </div>
                {metrics.map(m => {
                  const rate = m.total_sent > 0 ? Math.round((m.total_read / m.total_sent) * 100) : 0;
                  return (
                    <div key={m.id} className="grid grid-cols-[1fr_80px_80px_80px_100px] gap-2 px-4 py-3 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors items-center">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${m.type === "push" ? "bg-primary/20 text-primary" : "bg-white/10 text-white/70"}`}>
                          {m.type === "push" ? "Push" : "Pop-up"}
                        </span>
                        <span className="text-sm font-medium text-white truncate">{m.title}</span>
                        {m.global ? <Globe className="w-3 h-3 text-white/30 shrink-0" /> : <span className="text-[10px] text-white/30 shrink-0">{m.target_count}u</span>}
                      </div>
                      <span className="text-center text-sm text-white/70 font-medium">{m.total_sent}</span>
                      <button onClick={() => openReadersModal(m.id, m.title)}
                        className="text-center text-sm font-medium flex items-center justify-center gap-1 hover:bg-white/5 rounded-md px-1 py-0.5 transition-colors cursor-pointer" title="Ver leitores">
                        <Eye className="w-3 h-3 text-green-400" />
                        <span className="text-green-400">{m.total_read}</span>
                      </button>
                      <div className="flex flex-col items-center gap-0.5">
                        <span className={`text-sm font-bold ${rate >= 70 ? "text-green-400" : rate >= 40 ? "text-yellow-400" : "text-white/50"}`}>{rate}%</span>
                        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${rate >= 70 ? "bg-green-500" : rate >= 40 ? "bg-yellow-500" : "bg-white/30"}`} style={{ width: `${rate}%` }} />
                        </div>
                      </div>
                      <span className="text-right text-[11px] text-white/40">
                        {format(new Date(m.sent_at), "dd/MM HH:mm")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ═══ SEND MODAL ═══ */}
      <Dialog open={sendModalOpen} onOpenChange={setSendModalOpen}>
        <DialogContent className="bg-[#111] border-white/10 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white text-sm font-bold flex items-center gap-2">
              <Send className="w-4 h-4 text-primary" />
              Enviar: {sendingNotif?.title}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 pt-2">
            {/* Audience */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-white/70">Público</label>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-black/40 rounded-lg">
                <button type="button" onClick={() => setSendAudience("all")}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-md text-xs font-medium transition-all ${sendAudience === "all" ? "bg-primary text-white" : "text-white/60"}`}>
                  <Globe className="w-3.5 h-3.5" /> Todos os ativos
                </button>
                <button type="button" onClick={() => setSendAudience("specific")}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-md text-xs font-medium transition-all ${sendAudience === "specific" ? "bg-primary text-white" : "text-white/60"}`}>
                  <Users className="w-3.5 h-3.5" /> Específicos
                </button>
              </div>
            </div>

            {sendAudience === "specific" && (
              <div className="flex flex-col gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
                  <Input className={`${inputCls} pl-8`} placeholder="Buscar usuário..." value={userSearch} onChange={e => handleUserSearch(e.target.value)} />
                  {searchingUsers && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-white/40" />}
                </div>
                {userResults.length > 0 && (
                  <div className="bg-[rgba(20,20,20,0.9)] border border-white/10 rounded-lg overflow-hidden max-h-32 overflow-y-auto">
                    {userResults.map(u => (
                      <button key={u.user_id} type="button" onClick={() => {
                        setSelectedUsers(prev => [...prev, u]);
                        setUserResults(prev => prev.filter(r => r.user_id !== u.user_id));
                        setUserSearch("");
                      }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-white/80 hover:bg-white/5 text-left">
                        <UserPlus className="w-3 h-3 text-primary shrink-0" />
                        <span className="truncate">{u.full_name || "Sem nome"}</span>
                      </button>
                    ))}
                  </div>
                )}
                {selectedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedUsers.map(u => (
                      <span key={u.user_id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/15 text-primary text-[10px] font-medium">
                        {u.full_name || "Sem nome"}
                        <button type="button" onClick={() => setSelectedUsers(prev => prev.filter(x => x.user_id !== u.user_id))} className="hover:text-white"><X className="w-2.5 h-2.5" /></button>
                      </span>
                    ))}
                  </div>
                )}
                {selectedUsers.length === 0 && <p className="text-[10px] text-white/30 italic">Nenhum usuário selecionado</p>}
              </div>
            )}

            {/* Schedule */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-white/70">Quando enviar</label>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-black/40 rounded-lg">
                <button type="button" onClick={() => setSendSchedule("now")}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-md text-xs font-medium transition-all ${sendSchedule === "now" ? "bg-primary text-white" : "text-white/60"}`}>
                  <Send className="w-3.5 h-3.5" /> Agora
                </button>
                <button type="button" onClick={() => setSendSchedule("schedule")}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-md text-xs font-medium transition-all ${sendSchedule === "schedule" ? "bg-primary text-white" : "text-white/60"}`}>
                  <CalendarClock className="w-3.5 h-3.5" /> Agendar
                </button>
              </div>
              {sendSchedule === "schedule" && (
                <Input type="datetime-local" className={inputCls} value={sendScheduledAt} onChange={e => setSendScheduledAt(e.target.value)} />
              )}
            </div>

            <Button type="button" onClick={handleDispatch} disabled={dispatching}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2">
              {dispatching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {sendSchedule === "schedule" ? "Agendar Envio" : "Enviar Agora"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ READERS MODAL ═══ */}
      <Dialog open={readersModalOpen} onOpenChange={setReadersModalOpen}>
        <DialogContent className="bg-[#111] border-white/10 max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-white text-sm font-bold truncate">
              Leitores — {readersModalTitle}
            </DialogTitle>
          </DialogHeader>

          {readersLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-white/40" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1 p-0.5 bg-black/40 rounded-lg mb-3">
                {([
                  { key: "all", label: `Todos (${readers.length})` },
                  { key: "read", label: `Lidas (${readers.filter(r => r.read).length})` },
                  { key: "unread", label: `Não lidas (${readers.filter(r => !r.read).length})` },
                ] as const).map(f => (
                  <button key={f.key} onClick={() => setReadersFilter(f.key)}
                    className={`flex-1 py-1.5 rounded-md text-[10px] font-medium transition-all ${readersFilter === f.key ? "bg-primary text-white" : "text-white/50 hover:text-white/70"}`}>
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto max-h-[50vh] space-y-0.5">
                {readers
                  .filter(r => readersFilter === "all" ? true : readersFilter === "read" ? r.read : !r.read)
                  .map((r, i) => (
                    <div key={`${r.user_id}-${i}`} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                      {r.read ? <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-white/20 shrink-0" />}
                      <span className="text-xs text-white/80 truncate flex-1">{r.full_name || "Sem nome"}</span>
                      <span className={`text-[10px] font-medium ${r.read ? "text-green-400" : "text-white/30"}`}>{r.read ? "Leu" : "Pendente"}</span>
                    </div>
                  ))
                }
                {readers.filter(r => readersFilter === "all" ? true : readersFilter === "read" ? r.read : !r.read).length === 0 && (
                  <p className="text-center text-white/30 text-xs py-8">Nenhum resultado</p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
