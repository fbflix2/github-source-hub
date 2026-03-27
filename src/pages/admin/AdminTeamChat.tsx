import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Send, MessageCircle, Trash2, Users, ArrowLeft, Reply, X, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TeamMembersList, type SelectedChat, type TeamMember } from "@/components/admin/team-chat/TeamMembersList";

interface TeamMessage {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  recipient_id: string | null;
  reply_to_id: string | null;
}

interface UserInfo {
  full_name: string | null;
  avatar_url: string | null;
}

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
  const [selectedChat, setSelectedChat] = useState<SelectedChat>({ type: "group" });
  const [showSidebar, setShowSidebar] = useState(true);
  const [replyTo, setReplyTo] = useState<TeamMessage | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const profilesRef = useRef<Record<string, UserInfo>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => { profilesRef.current = userProfiles; }, [userProfiles]);

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUserId(user.id);
        supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url")
          .eq("user_id", user.id)
          .maybeSingle()
          .then(({ data }) => {
            if (data) {
              setUserProfiles((prev) => ({
                ...prev,
                [data.user_id]: { full_name: data.full_name, avatar_url: data.avatar_url },
              }));
            }
          });
      }
    });
  }, []);

  // Fetch team members
  const { data: teamMembers = [] } = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["admin", "moderator"]);
      if (!roles || roles.length === 0) return [];
      const userIds = [...new Set(roles.map((r) => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", userIds);
      return (profiles || []) as TeamMember[];
    },
    staleTime: 60_000,
  });

  // Fetch messages based on selected chat
  const chatKey = selectedChat.type === "group" ? "group" : `dm-${selectedChat.userId}`;
  const { data: messages = [], refetch } = useQuery({
    queryKey: ["team-messages", chatKey],
    queryFn: async () => {
      let query = supabase
        .from("team_messages")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(200);

      if (selectedChat.type === "group") {
        query = query.is("recipient_id", null);
      } else {
        query = query.or(
          `and(user_id.eq.${currentUserId},recipient_id.eq.${selectedChat.userId}),and(user_id.eq.${selectedChat.userId},recipient_id.eq.${currentUserId})`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as TeamMessage[];
    },
    enabled: !!currentUserId,
    staleTime: 5_000,
    refetchInterval: 10_000,
  });

  // Load profiles for messages
  const loadProfiles = useCallback(async (userIds: string[]) => {
    const missing = userIds.filter((id) => !profilesRef.current[id]);
    if (missing.length === 0) return;
    const { data } = await supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url")
      .in("user_id", missing);
    if (data) {
      setUserProfiles((prev) => {
        const updated = { ...prev };
        data.forEach((p) => {
          updated[p.user_id] = { full_name: p.full_name, avatar_url: p.avatar_url };
        });
        return updated;
      });
    }
  }, []);

  useEffect(() => {
    const userIds = [...new Set(messages.map((m) => m.user_id))];
    if (userIds.length > 0) loadProfiles(userIds);
  }, [messages, loadProfiles]);

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
          // Determine which chat this message belongs to
          const msgChatKey = newMsg.recipient_id === null
            ? "group"
            : newMsg.user_id === currentUserId
              ? `dm-${newMsg.recipient_id}`
              : `dm-${newMsg.user_id}`;

          queryClient.setQueryData<TeamMessage[]>(["team-messages", msgChatKey], (old = []) => {
            if (old.some((m) => m.id === newMsg.id)) return old;
            return [...old, newMsg];
          });

          if (newMsg.user_id === currentUserId) {
            playNotificationSound("send");
          } else {
            playNotificationSound("receive");
          }

          if (!profilesRef.current[newMsg.user_id]) {
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
            // Remove from all cached queries
            queryClient.setQueriesData<TeamMessage[]>(
              { queryKey: ["team-messages"] },
              (old = []) => old.filter((m) => m.id !== deletedId)
            );
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") refetch();
      });

    return () => { supabase.removeChannel(channel); };
  }, [currentUserId, queryClient, refetch, loadProfiles]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Send message
  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!currentUserId) throw new Error("Não autenticado");
      const insertData: any = { user_id: currentUserId, content };
      if (selectedChat.type === "dm") {
        insertData.recipient_id = selectedChat.userId;
      }
      if (replyTo) {
        insertData.reply_to_id = replyTo.id;
      }
      const { error } = await supabase.from("team_messages").insert(insertData);
      if (error) throw error;
    },
  });

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed || sendMutation.isPending) return;
    setMessage("");
    setReplyTo(null);
    sendMutation.mutate(trimmed);
  };

  const handleReply = (msg: TeamMessage) => {
    setReplyTo(msg);
    inputRef.current?.focus();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("team_messages").delete().eq("id", id);
  };

  const handleCopy = (msg: TeamMessage) => {
    navigator.clipboard.writeText(msg.content);
    setCopiedId(msg.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const getProfile = (userId: string): UserInfo =>
    userProfiles[userId] || { full_name: null, avatar_url: null };

  const getInitial = (userId: string) =>
    (getProfile(userId).full_name || "?").charAt(0).toUpperCase();

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

  const chatTitle =
    selectedChat.type === "group"
      ? "Grupo da Equipe"
      : getProfile(selectedChat.userId).full_name || "Conversa";

  const chatSubtitle =
    selectedChat.type === "group"
      ? "Comunicação interna em tempo real"
      : "Mensagem direta";

  return (
    <div className="h-[calc(100vh-6rem)] min-h-0 overflow-hidden">
      <div className="flex h-full min-h-0 max-w-5xl mx-auto gap-0 overflow-hidden">
        {/* Sidebar - Members */}
        <div
          className={cn(
            "w-64 h-full min-h-0 flex-shrink-0 border-r border-border pr-3 overflow-y-auto transition-all",
            showSidebar ? "block" : "hidden md:block"
          )}
        >
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-border">
            <MessageCircle className="size-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Conversas</h2>
          </div>
          <TeamMembersList
            members={teamMembers}
            currentUserId={currentUserId}
            selectedChat={selectedChat}
            onSelect={(chat) => {
              setSelectedChat(chat);
              setShowSidebar(false);
            }}
          />
        </div>

        {/* Chat area */}
        <div className={cn("flex-1 flex h-full min-h-0 flex-col min-w-0 pl-4 overflow-hidden", !showSidebar ? "block" : "hidden md:flex")}>
          {/* Header - fixed */}
          <div className="flex items-center gap-3 pb-4 border-b border-border mb-4 flex-shrink-0">
            <button
              onClick={() => setShowSidebar(true)}
              className="md:hidden text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-5" />
            </button>
            <div className="flex items-center justify-center size-10 rounded-xl bg-primary/10">
              {selectedChat.type === "group" ? (
                <Users className="size-5 text-primary" />
              ) : (
                <Avatar className="size-8">
                  <AvatarImage src={getProfile(selectedChat.userId).avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                    {getInitial(selectedChat.userId)}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">{chatTitle}</h1>
              <p className="text-xs text-muted-foreground">{chatSubtitle}</p>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-1 pr-2 scroll-smooth">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <MessageCircle className="size-12 mb-3 opacity-30" />
              <p className="text-sm">Nenhuma mensagem ainda. Comece a conversa!</p>
            </div>
          )}

          {groupedMessages.map((group) => (
            <div key={group.date}>
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  {group.date}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {group.msgs.map((msg, i) => {
                const isMe = msg.user_id === currentUserId;
                const profile = getProfile(msg.user_id);
                const prevMsg = i > 0 ? group.msgs[i - 1] : null;
                const showAvatar = !prevMsg || prevMsg.user_id !== msg.user_id;

                // Find replied message
                const repliedMsg = msg.reply_to_id
                  ? messages.find((m) => m.id === msg.reply_to_id)
                  : null;
                const repliedProfile = repliedMsg ? getProfile(repliedMsg.user_id) : null;

                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex gap-2 group/msg",
                      isMe ? "flex-row-reverse" : "flex-row",
                      showAvatar ? "mt-3" : "mt-0.5"
                    )}
                  >
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

                    <div className={cn("max-w-[70%] min-w-0 flex flex-col", isMe ? "items-end" : "items-start")}>
                      {showAvatar && (
                        <span
                          className={cn(
                            "text-[10px] font-medium mb-0.5 px-1",
                            isMe ? "text-primary" : "text-muted-foreground"
                          )}
                        >
                          {profile.full_name || "Membro"}
                        </span>
                      )}

                      {/* Reply quote */}
                      {repliedMsg && (
                        <div className={cn(
                          "flex items-start gap-1.5 px-3 py-1.5 rounded-t-xl text-[11px] border-l-2 border-primary/50 bg-primary/5 mb-0.5 max-w-full",
                          isMe ? "rounded-br-none" : "rounded-bl-none"
                        )}>
                          <Reply className="size-3 text-primary/60 mt-0.5 flex-shrink-0 rotate-180" />
                          <div className="min-w-0">
                            <span className="font-semibold text-primary/80 block truncate">
                              {repliedProfile?.full_name || "Membro"}
                            </span>
                            <span className="text-muted-foreground truncate block">
                              {repliedMsg.content.length > 60 ? repliedMsg.content.slice(0, 60) + "…" : repliedMsg.content}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="flex items-end gap-1.5 group/actions max-w-full">
                        {/* Reply button - before bubble for own messages */}
                        {isMe && (
                          <button
                            onClick={() => handleReply(msg)}
                            className="text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover/msg:opacity-100 flex-shrink-0"
                            title="Responder"
                          >
                            <Reply className="size-3.5" />
                          </button>
                        )}
                        <div
                          className={cn(
                            "px-3 py-2 rounded-2xl text-sm leading-relaxed min-w-0",
                            isMe
                              ? "bg-accent/80 text-accent-foreground rounded-br-md"
                              : "bg-card border border-border text-foreground rounded-bl-md"
                          )}
                          style={{ wordBreak: "break-all", overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}
                        >
                          {msg.content}
                        </div>
                        {/* Reply button - after bubble for other messages */}
                        {!isMe && (
                          <button
                            onClick={() => handleReply(msg)}
                            className="text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover/msg:opacity-100"
                            title="Responder"
                          >
                            <Reply className="size-3.5" />
                          </button>
                        )}
                        <div className="flex items-center gap-1 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleCopy(msg)}
                            className="text-muted-foreground hover:text-primary transition-colors"
                            title="Copiar"
                          >
                            {copiedId === msg.id ? <Check className="size-3 text-green-500" /> : <Copy className="size-3" />}
                          </button>
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
        <div className="pt-3 border-t border-border mt-2 flex-shrink-0">
          {/* Reply preview bar */}
          {replyTo && (
            <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/20">
              <Reply className="size-4 text-primary flex-shrink-0 rotate-180" />
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-semibold text-primary block truncate">
                  {getProfile(replyTo.user_id).full_name || "Membro"}
                </span>
                <span className="text-[11px] text-muted-foreground truncate block">
                  {replyTo.content.length > 80 ? replyTo.content.slice(0, 80) + "…" : replyTo.content}
                </span>
              </div>
              <button onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>
          )}
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex items-center gap-2"
          >
            <Input
              ref={inputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                selectedChat.type === "group"
                  ? "Mensagem para o grupo..."
                  : `Mensagem para ${getProfile(selectedChat.userId).full_name || "membro"}...`
              }
              className="flex-1 bg-background border-border text-foreground placeholder:text-muted-foreground rounded-xl h-11"
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
    </div>
  );
}
