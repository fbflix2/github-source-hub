import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TicketMessage {
  id: string;
  content: string;
  sender: "user" | "support";
  created_at: string;
  read: boolean;
  ticket_id: string;
}

export interface TicketData {
  id: string;
  code: string;
  title: string;
  status: "open" | "answered" | "closed" | "in_progress" | "resolved";
  priority: "low" | "medium" | "high" | "urgent";
  created_at: string;
  updated_at: string;
  messages: TicketMessage[];
  unread_count: number;
}

export function useTickets() {
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalUnread, setTotalUnread] = useState(0);

  const fetchTickets = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: ticketsData, error: ticketsError } = await supabase
      .from("tickets")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (ticketsError) {
      console.error("Error fetching tickets:", ticketsError);
      setLoading(false);
      return;
    }

    if (!ticketsData || ticketsData.length === 0) {
      setTickets([]);
      setTotalUnread(0);
      setLoading(false);
      return;
    }

    const ticketIds = ticketsData.map(t => t.id);
    const { data: messagesData, error: messagesError } = await supabase
      .from("ticket_messages")
      .select("*")
      .in("ticket_id", ticketIds)
      .order("created_at", { ascending: true });

    if (messagesError) {
      console.error("Error fetching messages:", messagesError);
    }

    const messages = (messagesData || []) as TicketMessage[];

    const enrichedTickets: TicketData[] = ticketsData.map(ticket => {
      const ticketMessages = messages.filter(m => m.ticket_id === ticket.id);
      const unreadCount = ticketMessages.filter(m => m.sender === "support" && !m.read).length;
      return {
        ...ticket,
        status: ticket.status as TicketData["status"],
        priority: ticket.priority as TicketData["priority"],
        messages: ticketMessages,
        unread_count: unreadCount,
      };
    });

    setTickets(enrichedTickets);
    setTotalUnread(enrichedTickets.reduce((sum, t) => sum + t.unread_count, 0));
    setLoading(false);
  }, []);

  const sendReply = useCallback(async (ticketId: string, content: string) => {
    const { error } = await supabase
      .from("ticket_messages")
      .insert({ ticket_id: ticketId, content, sender: "user", read: true });

    if (error) {
      toast.error("Erro ao enviar mensagem");
      console.error(error);
      return false;
    }
    // Refetch immediately so the user sees their own message
    await fetchTickets();
    return true;
  }, [fetchTickets]);

  const markAsRead = useCallback(async (ticketId: string) => {
    const { error } = await supabase
      .from("ticket_messages")
      .update({ read: true })
      .eq("ticket_id", ticketId)
      .eq("sender", "support")
      .eq("read", false);

    if (error) console.error("Error marking as read:", error);
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel("tickets-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ticket_messages" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newMsg = payload.new as TicketMessage;
            if (newMsg.sender === "support") {
              toast.info("Nova resposta do suporte!", {
                description: "Você recebeu uma nova mensagem em um ticket.",
              });
            }
          }
          fetchTickets();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        () => {
          fetchTickets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTickets]);

  return { tickets, loading, totalUnread, sendReply, markAsRead, refetch: fetchTickets };
}
