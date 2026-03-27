import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Ticket,
  Clock,
  CheckCircle2,
  MessageCircle,
  ChevronRight,
  AlertCircle,
  Send,
  Loader2,
  Star,
  Copy,
  Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useTickets, TicketData } from "@/hooks/useTickets";
import { supabase } from "@/integrations/supabase/client";
import TicketRatingPopup from "@/components/TicketRatingPopup";

type TicketStatus = "open" | "answered" | "closed" | "in_progress" | "resolved";
type TicketPriority = "low" | "medium" | "high" | "urgent";

const getStatusConfig = (status: TicketStatus | string) => {
  switch (status) {
    case "open":
      return { label: "Aguardando", color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20", icon: Clock };
    case "answered":
    case "in_progress":
      return { label: "Em Andamento", color: "bg-blue-500/10 text-blue-500 border-blue-500/20", icon: MessageCircle };
    case "resolved":
      return { label: "Respondido", color: "bg-green-500/10 text-green-500 border-green-500/20", icon: CheckCircle2 };
    case "closed":
      return { label: "Fechado", color: "bg-muted text-muted-foreground border-border", icon: CheckCircle2 };
    default:
      return { label: status, color: "bg-muted text-muted-foreground border-border", icon: Clock };
  }
};

const getPriorityConfig = (priority: TicketPriority) => {
  switch (priority) {
    case "urgent":
      return { label: "Urgente", color: "bg-red-500/10 text-red-500 border-red-500/20" };
    case "high":
      return { label: "Alta", color: "bg-orange-500/10 text-orange-500 border-orange-500/20" };
    case "medium":
      return { label: "Média", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" };
    case "low":
      return { label: "Baixa", color: "bg-muted text-muted-foreground border-border" };
  }
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function Tickets() {
  const navigate = useNavigate();
  const { tickets, loading, totalUnread, sendReply, markAsRead } = useTickets();
  const [selectedTicket, setSelectedTicket] = useState<TicketData | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<"all" | "open" | "answered" | "closed" | "in_progress" | "resolved">("all");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [ratingTicket, setRatingTicket] = useState<TicketData | null>(null);
  const [ratedTicketIds, setRatedTicketIds] = useState<Set<string>>(new Set());
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  const handleCopyMsg = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedMsgId(id);
    setTimeout(() => setCopiedMsgId(null), 1500);
  };

  // Fetch already-rated tickets
  useEffect(() => {
    const fetchRated = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("ticket_ratings")
        .select("ticket_id")
        .eq("user_id", user.id);
      if (data) setRatedTicketIds(new Set(data.map(r => r.ticket_id)));
    };
    fetchRated();
  }, []);

  // Auto-show rating popup when a ticket transitions to resolved
  const prevTicketsRef = useRef<TicketData[]>([]);
  useEffect(() => {
    if (prevTicketsRef.current.length > 0) {
      for (const ticket of tickets) {
        if (ticket.status === "resolved" && !ratedTicketIds.has(ticket.id)) {
          const prev = prevTicketsRef.current.find(t => t.id === ticket.id);
          if (prev && prev.status !== "resolved") {
            setRatingTicket(ticket);
            break;
          }
        }
      }
    }
    prevTicketsRef.current = tickets;
  }, [tickets, ratedTicketIds]);

  // Keep selectedTicket in sync with fetched data, preserving optimistic messages
  useEffect(() => {
    if (selectedTicket) {
      const updated = tickets.find(t => t.id === selectedTicket.id);
      if (updated) {
        // Merge: keep any optimistic (temp) messages not yet confirmed by server
        const serverMsgIds = new Set(updated.messages.map(m => m.id));
        const optimisticMsgs = selectedTicket.messages.filter(m => m.id.startsWith("temp-") && !serverMsgIds.has(m.id));
        setSelectedTicket({ ...updated, messages: [...updated.messages, ...optimisticMsgs] });
      }
    }
  }, [tickets]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedTicket?.messages]);

  const handleSelectTicket = (ticket: TicketData) => {
    setSelectedTicket(ticket);
    if (ticket.unread_count > 0) {
      markAsRead(ticket.id);
    }
  };

  const handleSendReply = async () => {
    if (!replyMessage.trim() || !selectedTicket) return;
    const msgText = replyMessage.trim();
    setReplyMessage("");
    setSending(true);

    // Optimistic update: add message to UI immediately
    const optimisticMsg = {
      id: `temp-${Date.now()}`,
      content: msgText,
      sender: "user" as const,
      created_at: new Date().toISOString(),
      read: true,
      ticket_id: selectedTicket.id,
    };
    setSelectedTicket(prev => prev ? { ...prev, messages: [...prev.messages, optimisticMsg] } : prev);

    await sendReply(selectedTicket.id, msgText);
    setSending(false);
  };

  const filteredTickets = tickets.filter(ticket => {
    if (filter === "all") return true;
    if (filter === "answered") return ticket.status === "answered" || ticket.status === "in_progress" || ticket.status === "resolved";
    return ticket.status === filter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 text-primary animate-spin" />
      </div>
    );
  }

  // Empty state — no tickets at all
  if (!loading && tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4 animate-fade-in">
        <div className="p-4 rounded-2xl bg-muted/50 border border-border">
          <Ticket className="size-12 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Nenhum ticket ainda</h2>
        <p className="text-muted-foreground text-sm text-center max-w-md">
          Você ainda não abriu nenhum ticket de suporte. Se precisar de ajuda, abra seu primeiro ticket.
        </p>
        <button
          onClick={() => navigate("/suporte")}
          className="mt-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors flex items-center gap-2"
        >
          <MessageCircle className="size-4" />
          Abrir Primeiro Ticket
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Ticket className="size-6 text-primary" />
            </div>
            Meus Tickets
          </h1>
          <p className="text-muted-foreground mt-1">
            Acompanhe as respostas dos seus tickets de suporte
          </p>
        </div>
        {totalUnread > 0 && (
          <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 px-4 py-2 rounded-xl">
            <AlertCircle className="size-5 text-primary" />
            <span className="text-sm font-medium text-primary">
              {totalUnread} {totalUnread === 1 ? "nova resposta" : "novas respostas"}
            </span>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: "all", label: "Todos" },
          { key: "answered", label: "Respondidos" },
          { key: "open", label: "Aguardando" },
          { key: "closed", label: "Fechados" },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setFilter(item.key as typeof filter)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all",
              filter === item.key
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/50"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Tickets List */}
        <div className="space-y-3">
          {filteredTickets.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <Ticket className="size-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhum ticket encontrado</p>
            </div>
          ) : (
            filteredTickets.map((ticket) => {
              const statusConfig = getStatusConfig(ticket.status);
              const priorityConfig = getPriorityConfig(ticket.priority);
              const StatusIcon = statusConfig.icon;

              return (
                <button
                  key={ticket.id}
                  onClick={() => handleSelectTicket(ticket)}
                  className={cn(
                    "w-full text-left bg-card border rounded-xl p-4 transition-all hover:border-primary/50",
                    selectedTicket?.id === ticket.id ? "border-primary ring-1 ring-primary/20" : "border-border"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-muted-foreground">{ticket.code}</span>
                        {ticket.unread_count > 0 && (
                          <span className="flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                            {ticket.unread_count}
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-foreground truncate">{ticket.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Atualizado em {formatDate(ticket.updated_at)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant="outline" className={cn("text-xs", statusConfig.color)}>
                        <StatusIcon className="size-3 mr-1" />
                        {statusConfig.label}
                      </Badge>
                      <Badge variant="outline" className={cn("text-xs", priorityConfig.color)}>
                        {priorityConfig.label}
                      </Badge>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Ticket Detail / Messages */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {selectedTicket ? (
            <div className="flex flex-col h-[600px]">
              {/* Ticket Header */}
              <div className="p-4 border-b border-border bg-muted/30">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-xs font-mono text-muted-foreground">{selectedTicket.code}</span>
                    <h3 className="font-semibold text-foreground mt-1">{selectedTicket.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Criado em {formatDate(selectedTicket.created_at)}
                    </p>
                  </div>
                  <Badge variant="outline" className={cn("text-xs", getStatusConfig(selectedTicket.status).color)}>
                    {getStatusConfig(selectedTicket.status).label}
                  </Badge>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {selectedTicket.messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex",
                      message.sender === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-3 relative group/bubble",
                        message.sender === "user"
                          ? "bg-secondary text-secondary-foreground rounded-br-md"
                          : "bg-muted text-foreground rounded-bl-md"
                      )}
                    >
                      {message.sender === "support" && !message.read && (
                        <span className="absolute -left-2 top-3 w-2 h-2 rounded-full bg-primary animate-pulse" />
                      )}
                      <p className="text-sm whitespace-pre-wrap" style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>{message.content}</p>
                      <div className="flex items-center justify-between gap-2 mt-2">
                        <p className={cn(
                          "text-xs",
                          message.sender === "user" ? "text-secondary-foreground/70" : "text-muted-foreground"
                        )}>
                          {formatDate(message.created_at)}
                        </p>
                        <button
                          onClick={() => handleCopyMsg(message.id, message.content)}
                          className={cn(
                            "opacity-0 group-hover/bubble:opacity-100 transition-opacity",
                            message.sender === "user" ? "text-secondary-foreground/60 hover:text-secondary-foreground" : "text-muted-foreground hover:text-foreground"
                          )}
                          title="Copiar"
                        >
                          {copiedMsgId === message.id ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply Input - only available if last message is from support */}
              {selectedTicket.status !== "closed" && selectedTicket.messages.length > 0 && selectedTicket.messages[selectedTicket.messages.length - 1].sender === "support" ? (
                <div className="p-4 border-t border-border bg-muted/30">
                  <div className="flex gap-3">
                    <Textarea
                      placeholder="Digite sua resposta..."
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      className="min-h-[80px] bg-background border-border resize-none text-foreground"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendReply();
                        }
                      }}
                    />
                    <Button
                      onClick={handleSendReply}
                      disabled={!replyMessage.trim() || sending}
                      className="self-end"
                    >
                      {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    </Button>
                  </div>
                </div>
              ) : selectedTicket.status !== "closed" ? (
                <div className="p-4 border-t border-border bg-muted/30 text-center">
                  <p className="text-sm text-muted-foreground">
                    ⏳ Aguarde o retorno da nossa equipe de suporte para enviar outra mensagem.
                  </p>
                </div>
              ) : null}

              {/* Rating button for resolved tickets */}
              {selectedTicket.status === "resolved" && !ratedTicketIds.has(selectedTicket.id) && (
                <div className="p-4 border-t border-border bg-primary/5 text-center">
                  <button
                    onClick={() => setRatingTicket(selectedTicket)}
                    className="px-6 py-2.5 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
                  >
                    <Star className="size-4" />
                    Avaliar Atendimento
                  </button>
                </div>
              )}
              {selectedTicket.status === "resolved" && ratedTicketIds.has(selectedTicket.id) && (
                <div className="p-4 border-t border-border bg-green-500/5 text-center">
                  <p className="text-sm text-green-500 font-medium flex items-center justify-center gap-2">
                    <CheckCircle2 className="size-4" />
                    Você já avaliou este atendimento
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="h-[600px] flex items-center justify-center">
              <div className="text-center">
                <MessageCircle className="size-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Selecione um ticket para ver as mensagens</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Rating Popup */}
      {ratingTicket && (
        <TicketRatingPopup
          ticketId={ratingTicket.id}
          ticketCode={ratingTicket.code}
          onClose={() => setRatingTicket(null)}
          onSubmitted={() => {
            setRatedTicketIds(prev => new Set([...prev, ratingTicket.id]));
            setRatingTicket(null);
          }}
        />
      )}
    </div>
  );
}
