import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Send, MessageCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TeamMessage {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
}

interface UserInfo {
  full_name: string | null;
  avatar_url: string | null;
}

// Generate a short notification sound using Web Audio API
function playNotificationSound(type: "send" | "receive") {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "send") {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } else {
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.setValueAtTime(900, ctx.currentTime + 0.08);
      osc.frequency.setValueAtTime(1200, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    }

    osc.onended = () => ctx.close();
  } catch {
    // Audio not available
  }
}

export default function AdminTeamChat() {
  const [message, setMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userProfiles, setUserProfiles] = useState<Record<string, UserInfo>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const isInitialLoad = useRef(true);

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  // Fetch messages
  const { data: messages = [], refetch } = useQuery({
    queryKey: ["team-messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_messages")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data || []) as TeamMessage[];
    },
    staleTime: 5_000,
    refetchInterval: 10_000, // Poll every 10s as fallback
  });

  // Load user profiles for messages
  const loadProfiles = useCallback(async (userIds: string[]) => {
    const missing = userIds.filter(id => !userProfiles[id]);
    if (missing.length === 0) return;

    const { data } = await supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url")
      .in("user_id", missing);

    if (data) {
      const newProfiles: Record<string, UserInfo> = { ...userProfiles };
      data.forEach(p => {
        newProfiles[p.user_id] = {
          full_name: p.full_name,
          avatar_url: p.avatar_url,
        };
      });
      setUserProfiles(newProfiles);
    }
  }, [userProfiles]);

  useEffect(() => {
    const userIds = [...new Set(messages.map(m => m.user_id))];
    if (userIds.length > 0) loadProfiles(userIds);
  }, [messages]);

  // Realtime subscription
  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel("team-chat-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "team_messages" },
        (payload) => {
          const newMsg = payload.new as TeamMessage;
          queryClient.setQueryData<TeamMessage[]>(["team-messages"], (old = []) => {
            if (old.some(m => m.id === newMsg.id)) return old;
            return [...old, newMsg];
          });

          // Play sound
          if (newMsg.user_id === currentUserId) {
            playNotificationSound("send");
          } else {
            playNotificationSound("receive");
          }

          // Load profile if missing
          if (!userProfiles[newMsg.user_id]) {
            loadProfiles([newMsg.user_id]);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "team_messages" },
        (payload) => {
          const deletedId = payload.old?.id;
          if (deletedId) {
            queryClient.setQueryData<TeamMessage[]>(["team-messages"], (old = []) =>
              old.filter(m => m.id !== deletedId)
            );
          }
        }
      )
      .subscribe((status) => {
        console.log("Team chat realtime status:", status);
        if (status === "SUBSCRIBED") {
          // Refetch to ensure we have latest data
          refetch();
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [currentUserId, queryClient, refetch]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    if (messages.length > 0) isInitialLoad.current = false;
  }, [messages]);

  // Send message
  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!currentUserId) throw new Error("Não autenticado");
      const { error } = await supabase.from("team_messages").insert({
        user_id: currentUserId,
        content,
      } as any);
      if (error) throw error;
    },
  });

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed || sendMutation.isPending) return;
    setMessage("");
    sendMutation.mutate(trimmed);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("team_messages").delete().eq("id", id);
  };

  const getProfile = (userId: string): UserInfo => {
    return userProfiles[userId] || { full_name: null, avatar_url: null };
  };

  const getInitial = (userId: string) => {
    const p = getProfile(userId);
    return (p.full_name || "?").charAt(0).toUpperCase();
  };

  // Group messages by date
  const groupedMessages: { date: string; msgs: TeamMessage[] }[] = [];
  let lastDate = "";
  for (const msg of messages) {
    const date = format(new Date(msg.created_at), "dd 'de' MMMM, yyyy", { locale: ptBR });
    if (date !== lastDate) {
      groupedMessages.push({ date, msgs: [msg] });
      lastDate = date;
    } else {
      groupedMessages[groupedMessages.length - 1].msgs.push(msg);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-white/10 mb-4">
        <div className="flex items-center justify-center size-10 rounded-xl bg-primary/10">
          <MessageCircle className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">Chat da Equipe</h1>
          <p className="text-xs text-muted-foreground">Comunicação interna em tempo real</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-1 pr-2 scroll-smooth">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageCircle className="size-12 mb-3 opacity-30" />
            <p className="text-sm">Nenhuma mensagem ainda. Comece a conversa!</p>
          </div>
        )}

        {groupedMessages.map((group) => (
          <div key={group.date}>
            {/* Date separator */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{group.date}</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {group.msgs.map((msg, i) => {
              const isMe = msg.user_id === currentUserId;
              const profile = getProfile(msg.user_id);
              const prevMsg = i > 0 ? group.msgs[i - 1] : null;
              const showAvatar = !prevMsg || prevMsg.user_id !== msg.user_id;

              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-2 group",
                    isMe ? "flex-row-reverse" : "flex-row",
                    showAvatar ? "mt-3" : "mt-0.5"
                  )}
                >
                  {/* Avatar */}
                  <div className="w-8 flex-shrink-0">
                    {showAvatar && (
                      <Avatar className="size-8">
                        <AvatarImage src={profile.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                          {getInitial(msg.user_id)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>

                  {/* Bubble */}
                  <div className={cn("max-w-[70%] flex flex-col", isMe ? "items-end" : "items-start")}>
                    {showAvatar && (
                      <span className={cn(
                        "text-[10px] font-medium mb-0.5 px-1",
                        isMe ? "text-primary" : "text-muted-foreground"
                      )}>
                        {profile.full_name || "Membro"}
                      </span>
                    )}
                    <div className="flex items-end gap-1.5 group">
                      <div
                        className={cn(
                          "px-3 py-2 rounded-2xl text-sm leading-relaxed break-words",
                          isMe
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-card border border-border text-foreground rounded-bl-md"
                        )}
                      >
                        {msg.content}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[9px] text-muted-foreground whitespace-nowrap">
                          {format(new Date(msg.created_at), "HH:mm")}
                        </span>
                        {isMe && (
                          <button
                            onClick={() => handleDelete(msg.id)}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="pt-4 border-t border-white/10 mt-2">
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex items-center gap-2"
        >
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Digite sua mensagem..."
            className="flex-1 bg-card border-border text-foreground placeholder:text-muted-foreground rounded-xl h-11"
            autoComplete="off"
          />
          <Button
            type="submit"
            disabled={!message.trim() || sendMutation.isPending}
            className="rounded-xl h-11 w-11 p-0 bg-primary hover:bg-primary/90"
          >
            <Send className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
