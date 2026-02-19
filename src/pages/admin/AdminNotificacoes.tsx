import { useState } from "react";
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
  ChevronLeft,
  ChevronRight
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

interface Notification {
  id: string;
  type: "push" | "popup";
  title: string;
  message: string;
  imageUrl?: string;
  link: string;
  status: "sent" | "scheduled" | "draft" | "active";
  scheduledDate?: string;
  isActive: boolean;
}

const mockNotifications: Notification[] = [
  {
    id: "1",
    type: "push",
    title: "Estreia Stranger Things S5",
    message: "A espera acabou! Assista agora aos novos episódios da temporada final.",
    imageUrl: "https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?q=80&w=2070&auto=format&fit=crop",
    link: "/series/details/stranger-things-s5",
    status: "sent",
    isActive: true,
  },
  {
    id: "2",
    type: "popup",
    title: "Promoção Black Friday",
    message: "50% OFF no plano anual. Aproveite agora! Oferta válida por tempo limitado.",
    link: "/pricing/black-friday",
    status: "scheduled",
    scheduledDate: "24/11 às 09:00",
    isActive: true,
  },
  {
    id: "3",
    type: "push",
    title: 'Lançamento "Oppenheimer"',
    message: "Disponível para aluguel. Assista em 4K com exclusividade.",
    imageUrl: "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?q=80&w=2070&auto=format&fit=crop",
    link: "/movies/oppenheimer",
    status: "draft",
    isActive: false,
  },
  {
    id: "4",
    type: "popup",
    title: "Manutenção Programada",
    message: "O sistema ficará instável dia 30/11 às 03:00 para atualizações de segurança.",
    link: "/system/status",
    status: "active",
    scheduledDate: "30/11 às 03:00",
    isActive: true,
  },
];

export default function AdminNotificacoes() {
  const [notifications] = useState<Notification[]>(mockNotifications);
  const [notificationType, setNotificationType] = useState<"push" | "popup">("push");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

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
        <span className={`w-2 h-2 rounded-full ${config.color} ${status !== 'draft' ? 'shadow-[0_0_8px_rgba(34,197,94,0.6)]' : ''}`}></span>
        {config.label}
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-8 py-6">
      {/* Header */}
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white">
          Gerenciamento de Notificações
        </h1>
        <p className="text-white/60 text-lg font-light max-w-2xl">
          Crie, agende e monitore alertas e pop-ups para os usuários da plataforma.
        </p>
      </header>

      {/* Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        {/* Form Panel */}
        <div className="xl:col-span-4 w-full">
          <div className="rounded-2xl p-6 md:p-8 flex flex-col gap-6 sticky top-8">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <BellRing className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold tracking-tight">Nova Notificação</h2>
            </div>

            <form className="flex flex-col gap-5">
              {/* Notification Type */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-white/80">Tipo de Notificação</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-black/40 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setNotificationType("push")}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      notificationType === "push"
                        ? "bg-primary text-white"
                        : "text-white/60 hover:text-white/80"
                    }`}
                  >
                    <Bell className="w-4 h-4" />
                    Push
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotificationType("popup")}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      notificationType === "popup"
                        ? "bg-primary text-white"
                        : "text-white/60 hover:text-white/80"
                    }`}
                  >
                    <Monitor className="w-4 h-4" />
                    Pop-up
                  </button>
                </div>
              </div>

              {/* Title */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-white/80">Título</label>
                <Input
                  className="bg-[rgba(20,20,20,0.6)] border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:border-primary focus:ring-primary/20"
                  placeholder="Ex: Estreia da Temporada 2"
                />
              </div>

              {/* Message */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-white/80">Mensagem / Conteúdo</label>
                <Textarea
                  className="bg-[rgba(20,20,20,0.6)] border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 resize-none focus:border-primary focus:ring-primary/20"
                  placeholder="Digite o corpo da notificação..."
                  rows={4}
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
                />
              </div>

              {/* Schedule */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-white/80">Agendamento</label>
                <Select defaultValue="now">
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

              {/* Submit */}
              <Button
                type="button"
                className="mt-4 w-full bg-primary hover:bg-primary/90 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-primary/20 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                Criar Notificação
              </Button>
            </form>
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

          {/* Notification Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className="bg-[#141414] border border-white/[0.05] rounded-2xl overflow-hidden flex flex-col group h-full hover:border-primary/30 hover:-translate-y-0.5 hover:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] transition-all duration-300"
              >
                {/* Card Header Image */}
                <div className="h-40 bg-gradient-to-br from-gray-900 to-black relative">
                  {notification.imageUrl ? (
                    <div
                      className="absolute inset-0 bg-cover bg-center opacity-40 group-hover:opacity-60 transition-all duration-500"
                      style={{ backgroundImage: `url(${notification.imageUrl})` }}
                    />
                  ) : (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent opacity-50 group-hover:opacity-70 transition-all" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        {notification.status === "active" ? (
                          <Settings className="w-16 h-16 text-white/5" />
                        ) : (
                          <Megaphone className="w-16 h-16 text-white/5" />
                        )}
                      </div>
                    </>
                  )}
                  
                  {/* Type Badge */}
                  <div className="absolute top-4 left-4 z-10">
                    {notification.type === "push" ? (
                      <span className="bg-primary text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-[0_2px_10px_rgba(249,6,6,0.3)]">
                        <Bell className="w-3 h-3" /> Push
                      </span>
                    ) : (
                      <span className="bg-white/90 text-black px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <Monitor className="w-3 h-3" /> Pop-up
                      </span>
                    )}
                  </div>

                  {/* Status Badge */}
                  <div className="absolute top-4 right-4 z-10">
                    {getStatusBadge(notification.status)}
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-5 flex flex-col gap-4 flex-1">
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1.5 leading-tight">
                      {notification.title}
                    </h3>
                    <p className="text-sm text-white/50 line-clamp-2 leading-relaxed">
                      {notification.message}
                    </p>
                  </div>

                  <div className="mt-auto flex flex-col gap-4">
                    {/* Link */}
                    <div className="bg-white/[0.03] border border-white/5 rounded-lg p-2.5 flex items-center gap-3">
                      <LinkIcon className="w-4 h-4 text-white/20" />
                      <span className="text-xs font-mono text-white/40 truncate">
                        {notification.link}
                      </span>
                    </div>

                    {/* Scheduled Date */}
                    {notification.scheduledDate && notification.status === "scheduled" && (
                      <div className="flex items-center gap-2 text-yellow-500/80 text-xs font-medium bg-yellow-500/5 px-3 py-2 rounded-lg border border-yellow-500/10">
                        <Clock className="w-3.5 h-3.5" />
                        Envia em: {notification.scheduledDate}
                      </div>
                    )}

                    {notification.scheduledDate && notification.status === "active" && (
                      <div className="flex items-center gap-2 text-white/50 text-xs font-medium px-1">
                        <Calendar className="w-3.5 h-3.5" />
                        Data: {notification.scheduledDate}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <button
                          className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {notification.status === "sent" || notification.status === "active" ? (
                          <button
                            className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                            title="Visualizar"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            className="p-2 text-white/40 hover:text-green-400 hover:bg-green-500/10 rounded-lg transition-colors"
                            title="Enviar Agora"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          className="p-2 text-white/40 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <Switch
                        checked={notification.isActive}
                        className={notification.status === "scheduled" ? "data-[state=checked]:bg-yellow-600" : "data-[state=checked]:bg-primary"}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-sm text-white/40 mt-4">
            <span>Mostrando 1-4 de 24 notificações</span>
            <div className="flex items-center gap-2">
              <button className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
