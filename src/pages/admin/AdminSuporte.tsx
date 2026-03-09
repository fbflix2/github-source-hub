import { useState, useEffect, useMemo } from "react";
import { 
  MailOpen, Clock, CheckCircle, Timer, RefreshCw, ArrowUp, ArrowDown,
  MessageSquare, Loader2, Inbox, RotateCcw, Star, CalendarDays, ChevronLeft, ChevronRight
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import AdminTicketModal from "@/components/admin/AdminTicketModal";

type Filter = "todos" | "novos" | "andamento" | "prioridade" | "resolvidos-hoje" | "resolvidos";
type ModalMode = "history" | "respond" | "preview" | null;

interface TicketRow {
  id: string;
  code: string;
  title: string;
  status: string;
  priority: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  link: string | null;
}

const getPriorityConfig = (priority: string) => {
  switch (priority) {
    case "high":
      return { label: "Alta Urgência", bgColor: "bg-primary/20", textColor: "text-primary", borderColor: "border-primary/20", leftBorder: "border-l-primary" };
    case "medium":
      return { label: "Média", bgColor: "bg-orange-500/20", textColor: "text-orange-500", borderColor: "border-orange-500/20", leftBorder: "border-l-orange-500" };
    default:
      return { label: "Baixa", bgColor: "bg-gray-500/20", textColor: "text-gray-400", borderColor: "border-gray-500/20", leftBorder: "border-l-gray-500" };
  }
};

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `há ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  return `há ${Math.floor(hours / 24)}d`;
};

export default function AdminSuporte() {
  const [activeFilter, setActiveFilter] = useState<Filter>("todos");
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Record<string, { full_name: string | null; avatar_url: string | null }>>({});
  const [selectedTicket, setSelectedTicket] = useState<TicketRow | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [ratings, setRatings] = useState<Record<string, { rating: number; comment: string | null }>>({});

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const fetchTickets = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("tickets")
      .select("*")
      .order("created_at", { ascending: false });
    const ticketList = (data ?? []) as TicketRow[];
    setTickets(ticketList);

    // Fetch profiles for ticket owners
    const userIds = [...new Set(ticketList.map(t => t.user_id))];
    if (userIds.length > 0) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", userIds);
      const map: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
      (profileData ?? []).forEach(p => { map[p.user_id] = { full_name: p.full_name, avatar_url: p.avatar_url }; });
      setProfiles(map);
    }

    // Fetch ratings
    const { data: ratingsData } = await supabase
      .from("ticket_ratings")
      .select("ticket_id, rating, comment");
    const ratingsMap: Record<string, { rating: number; comment: string | null }> = {};
    (ratingsData ?? []).forEach(r => { ratingsMap[r.ticket_id] = { rating: r.rating, comment: r.comment }; });
    setRatings(ratingsMap);

    setLoading(false);
  };

  useEffect(() => { fetchTickets(); }, []);

  const today = new Date().toDateString();
  const resolvedTodayTickets = tickets.filter(t => t.status === "resolved" && new Date(t.updated_at).toDateString() === today);

  const filtered = useMemo(() => {
    return tickets.filter(t => {
      switch (activeFilter) {
        case "novos": return t.status === "open";
        case "andamento": return t.status === "in_progress";
        case "prioridade": return t.priority === "high" && t.status !== "resolved" && t.status !== "closed";
        case "resolvidos-hoje": return t.status === "resolved" && new Date(t.updated_at).toDateString() === today;
        case "resolvidos": {
          const [year, month] = selectedMonth.split("-").map(Number);
          const d = new Date(t.updated_at);
          return (t.status === "resolved" || t.status === "closed") && d.getFullYear() === year && d.getMonth() + 1 === month;
        }
        default: return t.status !== "resolved" && t.status !== "closed";
      }
    });
  }, [tickets, activeFilter, selectedMonth, today]);

  const openCount = tickets.filter(t => t.status === "open").length;
  const waitingCount = tickets.filter(t => t.status === "in_progress").length;
  const resolvedToday = resolvedTodayTickets.length;
  const activeTotal = tickets.filter(t => t.status !== "resolved" && t.status !== "closed").length;

  const handleReopenTicket = async (ticketId: string) => {
    await supabase.from("tickets").update({ status: "open" }).eq("id", ticketId);
    toast.success("Ticket reaberto!");
    fetchTickets();
  };

  const stats = [
    { label: "Tickets Abertos", value: String(openCount), icon: MailOpen, iconColor: "text-primary", progressColor: "bg-primary", progressWidth: openCount > 0 ? "65%" : "0%", clickable: false },
    { label: "Em Andamento", value: String(waitingCount), icon: Clock, iconColor: "text-orange-400", progressColor: "bg-orange-400", progressWidth: waitingCount > 0 ? "40%" : "0%", clickable: false },
    { label: "Resolvidos Hoje", value: String(resolvedToday), icon: CheckCircle, iconColor: "text-green-500", progressColor: "bg-green-500", progressWidth: resolvedToday > 0 ? "85%" : "0%", clickable: true, filterKey: "resolvidos-hoje" as Filter },
    { label: "Na Fila", value: String(activeTotal), icon: Timer, iconColor: "text-blue-400", progressColor: "bg-blue-400", progressWidth: "100%", clickable: false },
  ];

  const filters = [
    { id: "todos" as Filter, label: "Todos" },
    { id: "novos" as Filter, label: "Novos" },
    { id: "andamento" as Filter, label: "Em Andamento" },
    { id: "prioridade" as Filter, label: "Alta Prioridade" },
    { id: "resolvidos" as Filter, label: "📁 Resolvidos" }
  ];

  const getInitials = (name: string | null) => {
    if (!name) return "??";
    return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
  };

  const isResolvedView = activeFilter === "resolvidos-hoje" || activeFilter === "resolvidos";

  const monthLabel = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const date = new Date(year, month - 1);
    return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }, [selectedMonth]);

  const shiftMonth = (delta: number) => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const d = new Date(year, month - 1 + delta);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)] -mx-6 -mt-6 p-4 lg:p-8 gap-8 relative">
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] mix-blend-screen" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] mix-blend-screen" />
      </div>

      <div className="relative z-10 flex flex-col gap-8 max-w-[1600px] mx-auto w-full">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white mb-1">
              Dashboard de Atendimento
            </h1>
            <p className="text-gray-400 text-sm font-medium tracking-wide uppercase">
              FBFLIX <span className="mx-2 text-primary">•</span> Painel Administrativo
            </p>
          </div>
        </header>

        {/* Stats Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <div
              key={index}
              onClick={() => {
                if (stat.clickable && stat.filterKey) {
                  setActiveFilter(activeFilter === stat.filterKey ? "todos" : stat.filterKey);
                }
              }}
              className={`bg-gradient-to-br from-white/5 to-white/[0.01] backdrop-blur-lg border rounded-2xl p-6 flex flex-col gap-2 relative overflow-hidden group hover:-translate-y-0.5 transition-all duration-300 ${
                stat.clickable ? "cursor-pointer" : ""
              } ${
                activeFilter === (stat as any).filterKey
                  ? "border-green-500/40 ring-1 ring-green-500/20"
                  : "border-white/5 hover:border-primary/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-gray-400 text-sm font-medium">{stat.label}</p>
                <stat.icon className={`size-5 ${stat.iconColor}`} />
              </div>
              <h3 className="text-3xl font-bold text-white mt-1">{loading ? "..." : stat.value}</h3>
              <div className="w-full bg-gray-800 h-1 rounded-full mt-3 overflow-hidden">
                <div className={`${stat.progressColor} h-full rounded-full`} style={{ width: stat.progressWidth }} />
              </div>
            </div>
          ))}
        </section>

        {/* Tickets Queue */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              {isResolvedView ? "Resolvidos Hoje" : "Fila de Atendimento"}
              <span className="text-sm font-normal text-gray-500 bg-white/5 px-2 py-0.5 rounded-lg border border-white/5">
                {filtered.length} total
              </span>
              {isResolvedView && (
                <button
                  onClick={() => setActiveFilter("todos")}
                  className="ml-2 text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1 rounded-lg transition-colors"
                >
                  ← Voltar à fila
                </button>
              )}
            </h2>
            {!isResolvedView && (
              <div className="flex items-center gap-2 bg-black/40 p-1 rounded-xl border border-white/10">
                {filters.map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => setActiveFilter(filter.id)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      activeFilter === filter.id
                        ? "bg-white/10 text-white font-semibold shadow-sm"
                        : "text-gray-400 hover:bg-white/5"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <Inbox className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">
                {isResolvedView ? "Nenhum ticket resolvido hoje." : "Nenhum ticket encontrado."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filtered.map((ticket) => {
                const priorityConfig = getPriorityConfig(ticket.priority);
                const profile = profiles[ticket.user_id];
                const isResolved = ticket.status === "resolved";
                
                return (
                  <div 
                    key={ticket.id}
                    className={`bg-gradient-to-br from-white/5 to-white/[0.01] backdrop-blur-lg border border-white/5 rounded-2xl p-5 flex flex-col gap-4 border-l-4 ${
                      isResolved ? "border-l-green-500" : priorityConfig.leftBorder
                    } relative hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-300`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex gap-2">
                        {isResolved ? (
                          <span className="px-2 py-1 rounded-md bg-green-500/20 text-green-400 text-[10px] font-bold border border-green-500/30 uppercase tracking-wide">
                            ✓ Resolvido
                          </span>
                        ) : (
                          <span className={`px-2 py-1 rounded-md ${priorityConfig.bgColor} ${priorityConfig.textColor} text-[10px] font-bold border ${priorityConfig.borderColor} uppercase tracking-wide`}>
                            {priorityConfig.label}
                          </span>
                        )}
                        {!isResolved && (
                          <span className="px-2 py-1 rounded-md bg-white/5 text-gray-400 text-[10px] font-medium border border-white/5 capitalize">
                            {ticket.status === "open" ? "Aberto" : ticket.status === "in_progress" ? "Em Andamento" : ticket.status}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">#{ticket.code} • {timeAgo(ticket.created_at)}</span>
                    </div>

                    <div className="flex-grow">
                      <h3 className="text-lg font-bold text-white leading-tight mb-1 line-clamp-1">
                        {ticket.title}
                      </h3>
                    </div>

                    <div className="flex items-center gap-3 border-t border-white/5 pt-4 mt-auto">
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-zinc-600 to-zinc-800 flex items-center justify-center text-white text-xs font-bold">
                          {getInitials(profile?.full_name ?? null)}
                        </div>
                      )}
                      <span className="text-sm font-semibold text-white flex-1">{profile?.full_name || "Usuário"}</span>
                      {ratings[ticket.id] && (
                        <div className="flex items-center gap-1" title={ratings[ticket.id].comment || "Avaliação do cliente"}>
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`size-3.5 ${
                                s <= ratings[ticket.id].rating
                                  ? "fill-yellow-400 text-yellow-400"
                                  : "text-gray-600"
                              }`}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 mt-2">
                      {isResolved ? (
                        <>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setSelectedTicket(ticket); setModalMode("history"); }}
                            className="flex-1 text-xs font-medium py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors"
                          >
                            Ver Histórico
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleReopenTicket(ticket.id); }}
                            className="flex-1 text-xs font-bold py-2.5 rounded-lg bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border border-orange-500/20 transition-colors flex items-center justify-center gap-1.5"
                          >
                            <RotateCcw className="size-3" />
                            Reabrir
                          </button>
                        </>
                      ) : (
                        <>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setSelectedTicket(ticket); setModalMode("preview"); }}
                            className="flex-1 text-xs font-medium py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors"
                          >
                            Ver Ticket
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setSelectedTicket(ticket); setModalMode("history"); }}
                            className="flex-1 text-xs font-medium py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors"
                          >
                            Ver Histórico
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setSelectedTicket(ticket); setModalMode("respond"); }}
                            className="flex-1 text-xs font-bold py-2.5 rounded-lg bg-primary text-white hover:bg-red-700 shadow-lg shadow-primary/20 transition-colors"
                          >
                            Responder
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Ticket Modal */}
      {selectedTicket && modalMode && (
        <AdminTicketModal
          ticket={selectedTicket}
          profileName={profiles[selectedTicket.user_id]?.full_name || "Usuário"}
          mode={modalMode as "history" | "respond" | "preview"}
          onClose={() => { setSelectedTicket(null); setModalMode(null); }}
          onStatusChange={fetchTickets}
          onOpenSupport={() => setModalMode("respond")}
        />
      )}
    </div>
  );
}
