import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Send, Search, User, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type Conversation = {
  phone: string;
  contact_name: string | null;
  last_message_at: string;
  last_message_preview: string | null;
  unread_count: number;
  status: string;
  client_user_id: string | null;
};

type Message = {
  id: string;
  phone: string;
  direction: "in" | "out";
  from_me: boolean;
  body: string | null;
  message_type: string;
  media_url: string | null;
  created_at: string;
};

export default function AdminWhatsAppCRM() {
  const qc = useQueryClient();
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: conversations = [], isLoading: loadingConvos, refetch: refetchConvos } = useQuery({
    queryKey: ["wa-conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_conversations")
        .select("*")
        .order("last_message_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as Conversation[];
    },
    refetchInterval: 15000,
  });

  const { data: messages = [], refetch: refetchMessages } = useQuery({
    queryKey: ["wa-messages", selectedPhone],
    queryFn: async () => {
      if (!selectedPhone) return [];
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("id, phone, direction, from_me, body, message_type, media_url, created_at")
        .eq("phone", selectedPhone)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return data as Message[];
    },
    enabled: !!selectedPhone,
    refetchInterval: 5000,
  });

  // Realtime subscription
  useEffect(() => {
    const ch = supabase
      .channel("wa-crm")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "whatsapp_messages" }, () => {
        qc.invalidateQueries({ queryKey: ["wa-messages"] });
        qc.invalidateQueries({ queryKey: ["wa-conversations"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_conversations" }, () => {
        qc.invalidateQueries({ queryKey: ["wa-conversations"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, selectedPhone]);

  // Mark as read when opening
  useEffect(() => {
    if (!selectedPhone) return;
    supabase
      .from("whatsapp_conversations")
      .update({ unread_count: 0 })
      .eq("phone", selectedPhone)
      .then(() => qc.invalidateQueries({ queryKey: ["wa-conversations"] }));
  }, [selectedPhone, qc]);

  const filteredConvos = useMemo(() => {
    if (!search) return conversations;
    const q = search.toLowerCase();
    return conversations.filter(c =>
      c.phone.includes(q) ||
      (c.contact_name || "").toLowerCase().includes(q) ||
      (c.last_message_preview || "").toLowerCase().includes(q)
    );
  }, [conversations, search]);

  const selectedConvo = conversations.find(c => c.phone === selectedPhone);

  const handleSend = async () => {
    if (!selectedPhone || !draft.trim() || sending) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("wapi-send", {
        body: {
          action: "send-text",
          phone: selectedPhone,
          message: draft.trim(),
          event_key: "crm_manual",
          user_id: selectedConvo?.client_user_id || null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setDraft("");
      refetchMessages();
      refetchConvos();
    } catch (e: any) {
      toast.error("Erro ao enviar: " + (e.message || e));
    } finally {
      setSending(false);
    }
  };

  const formatPhone = (p: string) => {
    if (p.length === 13 && p.startsWith("55")) {
      return `+55 (${p.slice(2,4)}) ${p.slice(4,9)}-${p.slice(9)}`;
    }
    return "+" + p;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center">
            <MessageCircle className="size-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">CRM WhatsApp</h1>
            <p className="text-xs text-muted-foreground">Painel de atendimento — conversas em tempo real</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => { refetchConvos(); refetchMessages(); }}>
          <RefreshCw className="size-4 mr-1.5" /> Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] gap-4 h-[calc(100vh-180px)]">
        {/* Conversations list */}
        <div className="bg-card/60 border border-border/40 rounded-xl flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border/40">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar conversa..."
                className="pl-9 h-9"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            {loadingConvos ? (
              <div className="p-8 flex justify-center"><Loader2 className="animate-spin size-5 text-muted-foreground" /></div>
            ) : filteredConvos.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhuma conversa ainda.<br />
                Mensagens recebidas via WhatsApp aparecerão aqui.
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {filteredConvos.map(c => (
                  <button
                    key={c.phone}
                    onClick={() => setSelectedPhone(c.phone)}
                    className={`w-full text-left p-3 hover:bg-white/5 transition-colors flex gap-3 ${selectedPhone === c.phone ? "bg-white/10" : ""}`}
                  >
                    <div className="size-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <User className="size-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm truncate">
                          {c.contact_name || formatPhone(c.phone)}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {formatDistanceToNow(new Date(c.last_message_at), { locale: ptBR, addSuffix: false })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground truncate">
                          {c.last_message_preview || "—"}
                        </span>
                        {c.unread_count > 0 && (
                          <Badge className="bg-green-500 text-white h-5 min-w-5 px-1.5 text-[10px]">
                            {c.unread_count}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Thread */}
        <div className="bg-card/60 border border-border/40 rounded-xl flex flex-col overflow-hidden">
          {!selectedPhone ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Selecione uma conversa
            </div>
          ) : (
            <>
              <div className="p-3 border-b border-border/40 flex items-center gap-3">
                <div className="size-9 rounded-full bg-muted flex items-center justify-center">
                  <User className="size-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="font-semibold text-sm">
                    {selectedConvo?.contact_name || formatPhone(selectedPhone)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatPhone(selectedPhone)}
                    {selectedConvo?.client_user_id && <span className="ml-2 text-green-500">• Cliente</span>}
                  </div>
                </div>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-background/30">
                {messages.length === 0 ? (
                  <div className="text-center text-xs text-muted-foreground py-8">Sem mensagens</div>
                ) : (
                  messages.map(m => (
                    <div key={m.id} className={`flex ${m.from_me ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm ${
                        m.from_me
                          ? "bg-green-600 text-white rounded-br-sm"
                          : "bg-muted text-foreground rounded-bl-sm"
                      }`}>
                        {m.media_url && (
                          <div className="text-[10px] opacity-80 mb-1">[{m.message_type}]</div>
                        )}
                        <div className="whitespace-pre-wrap break-words">{m.body || (m.media_url ? "(mídia)" : "(vazio)")}</div>
                        <div className={`text-[9px] mt-1 ${m.from_me ? "text-white/70" : "text-muted-foreground"}`}>
                          {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-3 border-t border-border/40 flex gap-2 items-end">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Escreva uma mensagem... (Enter envia, Shift+Enter quebra linha)"
                  className="min-h-[44px] max-h-32 resize-none"
                />
                <Button
                  onClick={handleSend}
                  disabled={!draft.trim() || sending}
                  className="bg-green-600 hover:bg-green-700 text-white shrink-0"
                >
                  {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}