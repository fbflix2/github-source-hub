import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Bell,
  BellRing,
  Monitor,
  Search,
  Link as LinkIcon,
  Edit,
  Eye,
  Trash2,
  Send,
  Image,
  Settings,
  Megaphone,
  Calendar,
  Clock,
  Loader2,
  X,
  Users,
  Globe,
  UserPlus,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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

export default function AdminNotificacoes() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formType, setFormType] = useState<"push" | "popup">("push");
  const [formTitle, setFormTitle] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formLink, setFormLink] = useState("");
  const [formSchedule, setFormSchedule] = useState("now");
  const [formScheduledAt, setFormScheduledAt] = useState("");
  const [formAudience, setFormAudience] = useState<"all" | "specific">("all");
  const [selectedUsers, setSelectedUsers] = useState<UserOption[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<UserOption[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const userSearchTimeout = useRef<ReturnType<typeof setTimeout>>();

  const searchUsers = async (query: string) => {
    if (query.length < 2) { setUserResults([]); return; }
    setSearchingUsers(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .or(`full_name.ilike.%${query}%`)
      .limit(10);
    setUserResults(
      (data || []).filter(u => !selectedUsers.some(s => s.user_id === u.user_id)) as UserOption[]
    );
    setSearchingUsers(false);
  };

  const handleUserSearch = (val: string) => {
    setUserSearch(val);
    if (userSearchTimeout.current) clearTimeout(userSearchTimeout.current);
    userSearchTimeout.current = setTimeout(() => searchUsers(val), 300);
  };

  const addUser = (u: UserOption) => {
    setSelectedUsers(prev => [...prev, u]);
    setUserResults(prev => prev.filter(r => r.user_id !== u.user_id));
    setUserSearch("");
  };

  const removeUser = (userId: string) => {
    setSelectedUsers(prev => prev.filter(u => u.user_id !== userId));
  };

  const fetchNotifications = async () => {
    const { data, error } = await supabase
      .from("admin_notifications")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar notificações");
    } else {
      setNotifications((data || []) as AdminNotification[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setFormType("push");
    setFormTitle("");
    setFormMessage("");
    setFormImageUrl("");
    setFormLink("");
    setFormSchedule("now");
    setFormScheduledAt("");
    setFormAudience("all");
    setSelectedUsers([]);
    setUserSearch("");
    setUserResults([]);
  };

  const handleSubmit = async () => {
    if (!formTitle.trim()) {
      toast.error("Título é obrigatório");
      return;
    }
    setSaving(true);

    const status =
      formSchedule === "now"
        ? "sent"
        : formSchedule === "schedule"
        ? "scheduled"
        : "draft";

    const payload: any = {
      type: formType,
      title: formTitle.trim(),
      message: formMessage.trim(),
      image_url: formImageUrl.trim() || null,
      link: formLink.trim() || "",
      status,
      scheduled_at:
        formSchedule === "schedule" && formScheduledAt
          ? new Date(formScheduledAt).toISOString()
          : null,
      is_active: status !== "draft",
    };

    let error;
    if (editingId) {
      ({ error } = await supabase
        .from("admin_notifications")
        .update(payload)
        .eq("id", editingId));
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      payload.created_by = user?.id || null;
      ({ error } = await supabase.from("admin_notifications").insert(payload));

      // If sending now, also create a record in the notifications table for users
      if (status === "sent") {
        await supabase.from("notifications").insert({
          title: payload.title,
          message: payload.message,
          type: formType === "push" ? "info" : "promo",
          global: true,
        });
      }
    }

    if (error) {
      toast.error("Erro ao salvar notificação");
    } else {
      toast.success(
        editingId ? "Notificação atualizada!" : "Notificação criada!"
      );
      resetForm();
      fetchNotifications();
    }
    setSaving(false);
  };

  const handleEdit = (n: AdminNotification) => {
    setEditingId(n.id);
    setFormType(n.type as "push" | "popup");
    setFormTitle(n.title);
    setFormMessage(n.message);
    setFormImageUrl(n.image_url || "");
    setFormLink(n.link || "");
    if (n.status === "scheduled") {
      setFormSchedule("schedule");
      setFormScheduledAt(
        n.scheduled_at
          ? format(new Date(n.scheduled_at), "yyyy-MM-dd'T'HH:mm")
          : ""
      );
    } else if (n.status === "draft") {
      setFormSchedule("draft");
    } else {
      setFormSchedule("now");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("admin_notifications")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("Erro ao excluir");
    } else {
      toast.success("Notificação excluída");
      fetchNotifications();
    }
  };

  const handleToggleActive = async (n: AdminNotification) => {
    await supabase
      .from("admin_notifications")
      .update({ is_active: !n.is_active })
      .eq("id", n.id);
    fetchNotifications();
  };

  const handleSendNow = async (n: AdminNotification) => {
    await supabase
      .from("admin_notifications")
      .update({ status: "sent", is_active: true })
      .eq("id", n.id);

    // Push to user notifications
    await supabase.from("notifications").insert({
      title: n.title,
      message: n.message,
      type: n.type === "push" ? "info" : "promo",
      global: true,
    });

    toast.success("Notificação enviada!");
    fetchNotifications();
  };

  const filteredNotifications = notifications.filter((n) => {
    if (searchQuery && !n.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (statusFilter !== "all" && n.status !== statusFilter) return false;
    if (typeFilter !== "all" && n.type !== typeFilter) return false;
    return true;
  });

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      sent: { color: "bg-green-500", label: "Enviada" },
      scheduled: { color: "bg-yellow-500", label: "Agendada" },
      draft: { color: "bg-gray-400", label: "Rascunho" },
      active: { color: "bg-green-500", label: "Ativa" },
    };
    const config = statusConfig[status] || statusConfig.draft;
    return (
      <span className="bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1 rounded-full text-[11px] font-medium text-white flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${config.color} ${status !== "draft" ? "shadow-[0_0_8px_rgba(34,197,94,0.6)]" : ""}`} />
        {config.label}
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-8 py-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white">
          Gerenciamento de Notificações
        </h1>
        <p className="text-white/60 text-lg font-light max-w-2xl">
          Crie, agende e monitore alertas e pop-ups para os usuários da plataforma.
        </p>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        {/* Form Panel */}
        <div className="xl:col-span-4 w-full">
          <div className="rounded-2xl p-6 md:p-8 flex flex-col gap-6 sticky top-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <BellRing className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-bold tracking-tight">
                  {editingId ? "Editar Notificação" : "Nova Notificação"}
                </h2>
              </div>
              {editingId && (
                <button onClick={resetForm} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex flex-col gap-5">
              {/* Type */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-white/80">Tipo de Notificação</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-black/40 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setFormType("push")}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      formType === "push" ? "bg-primary text-white" : "text-white/60 hover:text-white/80"
                    }`}
                  >
                    <Bell className="w-4 h-4" /> Push
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormType("popup")}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      formType === "popup" ? "bg-primary text-white" : "text-white/60 hover:text-white/80"
                    }`}
                  >
                    <Monitor className="w-4 h-4" /> Pop-up
                  </button>
                </div>
              </div>

              {/* Title */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-white/80">Título</label>
                <Input
                  className="bg-[rgba(20,20,20,0.6)] border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:border-primary focus:ring-primary/20"
                  placeholder="Ex: Estreia da Temporada 2"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
              </div>

              {/* Message */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-white/80">Mensagem / Conteúdo</label>
                <Textarea
                  className="bg-[rgba(20,20,20,0.6)] border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 resize-none focus:border-primary focus:ring-primary/20"
                  placeholder="Digite o corpo da notificação..."
                  rows={4}
                  value={formMessage}
                  onChange={(e) => setFormMessage(e.target.value)}
                />
              </div>

              {/* Image URL */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-white/80">Imagem ou Vídeo (URL)</label>
                <div className="flex gap-2">
                  <Input
                    className="bg-[rgba(20,20,20,0.6)] border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 flex-1 focus:border-primary focus:ring-primary/20"
                    placeholder="https://..."
                    type="url"
                    value={formImageUrl}
                    onChange={(e) => setFormImageUrl(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-12 h-auto bg-[rgba(20,20,20,0.6)] border-white/10 rounded-xl hover:bg-white/10"
                  >
                    <Image className="w-5 h-5 text-white/70" />
                  </Button>
                </div>
              </div>

              {/* Link */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-white/80">Link de Destino</label>
                <Input
                  className="bg-[rgba(20,20,20,0.6)] border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:border-primary focus:ring-primary/20"
                  placeholder="/series/dark-matter"
                  value={formLink}
                  onChange={(e) => setFormLink(e.target.value)}
                />
              </div>

              {/* Schedule */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-white/80">Agendamento</label>
                <Select value={formSchedule} onValueChange={setFormSchedule}>
                  <SelectTrigger className="bg-[rgba(20,20,20,0.6)] border-white/10 rounded-xl px-4 py-3 text-sm text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-white/10">
                    <SelectItem value="now">Enviar Agora</SelectItem>
                    <SelectItem value="schedule">Agendar para depois</SelectItem>
                    <SelectItem value="draft">Salvar como Rascunho</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formSchedule === "schedule" && (
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-white/80">Data e Hora</label>
                  <Input
                    type="datetime-local"
                    className="bg-[rgba(20,20,20,0.6)] border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-primary focus:ring-primary/20"
                    value={formScheduledAt}
                    onChange={(e) => setFormScheduledAt(e.target.value)}
                  />
                </div>
              )}

              {/* Submit */}
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="mt-4 w-full bg-primary hover:bg-primary/90 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-primary/20 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {editingId ? "Salvar Alterações" : "Criar Notificação"}
              </Button>
            </div>
          </div>
        </div>

        {/* Notifications List */}
        <div className="xl:col-span-8 w-full flex flex-col gap-6">
          {/* Filters */}
          <div className="bg-[rgba(30,30,30,0.6)] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <Input
                className="bg-[rgba(20,20,20,0.6)] border-white/10 w-full pl-10 pr-4 py-2.5 rounded-lg text-sm text-white placeholder-white/30 focus:border-primary/50"
                placeholder="Buscar por título..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-[rgba(20,20,20,0.6)] border-white/10 rounded-lg px-3 py-2.5 text-sm text-white/80 min-w-[140px]">
                  <SelectValue placeholder="Todos Status" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-white/10">
                  <SelectItem value="all">Todos Status</SelectItem>
                  <SelectItem value="active">Ativa</SelectItem>
                  <SelectItem value="scheduled">Agendada</SelectItem>
                  <SelectItem value="sent">Enviada</SelectItem>
                  <SelectItem value="draft">Rascunho</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="bg-[rgba(20,20,20,0.6)] border-white/10 rounded-lg px-3 py-2.5 text-sm text-white/80 min-w-[140px]">
                  <SelectValue placeholder="Todos Tipos" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-white/10">
                  <SelectItem value="all">Todos Tipos</SelectItem>
                  <SelectItem value="push">Push</SelectItem>
                  <SelectItem value="popup">Pop-up</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Cards */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-white/40" />
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="text-center py-16 text-white/40">
              <Megaphone className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Nenhuma notificação encontrada</p>
              <p className="text-sm mt-1">Crie uma nova notificação usando o formulário ao lado.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredNotifications.map((n) => (
                <div
                  key={n.id}
                  className="bg-[#141414] border border-white/[0.05] rounded-2xl overflow-hidden flex flex-col group h-full hover:border-primary/30 hover:-translate-y-0.5 hover:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] transition-all duration-300"
                >
                  {/* Card Header */}
                  <div className="h-40 bg-gradient-to-br from-gray-900 to-black relative">
                    {n.image_url ? (
                      <div
                        className="absolute inset-0 bg-cover bg-center opacity-40 group-hover:opacity-60 transition-all duration-500"
                        style={{ backgroundImage: `url(${n.image_url})` }}
                      />
                    ) : (
                      <>
                        <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent opacity-50 group-hover:opacity-70 transition-all" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          {n.status === "active" ? (
                            <Settings className="w-16 h-16 text-white/5" />
                          ) : (
                            <Megaphone className="w-16 h-16 text-white/5" />
                          )}
                        </div>
                      </>
                    )}

                    <div className="absolute top-4 left-4 z-10">
                      {n.type === "push" ? (
                        <span className="bg-primary text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-[0_2px_10px_rgba(249,6,6,0.3)]">
                          <Bell className="w-3 h-3" /> Push
                        </span>
                      ) : (
                        <span className="bg-white/90 text-black px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                          <Monitor className="w-3 h-3" /> Pop-up
                        </span>
                      )}
                    </div>

                    <div className="absolute top-4 right-4 z-10">
                      {getStatusBadge(n.status)}
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-5 flex flex-col gap-4 flex-1">
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1.5 leading-tight">
                        {n.title}
                      </h3>
                      <p className="text-sm text-white/50 line-clamp-2 leading-relaxed">
                        {n.message}
                      </p>
                    </div>

                    <div className="mt-auto flex flex-col gap-4">
                      {n.link && (
                        <div className="bg-white/[0.03] border border-white/5 rounded-lg p-2.5 flex items-center gap-3">
                          <LinkIcon className="w-4 h-4 text-white/20" />
                          <span className="text-xs font-mono text-white/40 truncate">
                            {n.link}
                          </span>
                        </div>
                      )}

                      {n.scheduled_at && n.status === "scheduled" && (
                        <div className="flex items-center gap-2 text-yellow-500/80 text-xs font-medium bg-yellow-500/5 px-3 py-2 rounded-lg border border-yellow-500/10">
                          <Clock className="w-3.5 h-3.5" />
                          Envia em: {format(new Date(n.scheduled_at), "dd/MM 'às' HH:mm")}
                        </div>
                      )}

                      <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEdit(n)}
                            className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {(n.status === "draft" || n.status === "scheduled") && (
                            <button
                              onClick={() => handleSendNow(n)}
                              className="p-2 text-white/40 hover:text-green-400 hover:bg-green-500/10 rounded-lg transition-colors"
                              title="Enviar Agora"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(n.id)}
                            className="p-2 text-white/40 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <Switch
                          checked={n.is_active}
                          onCheckedChange={() => handleToggleActive(n)}
                          className={
                            n.status === "scheduled"
                              ? "data-[state=checked]:bg-yellow-600"
                              : "data-[state=checked]:bg-primary"
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Count */}
          {!loading && filteredNotifications.length > 0 && (
            <div className="text-sm text-white/40 mt-2">
              Mostrando {filteredNotifications.length} de {notifications.length} notificações
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
