import { useState, useEffect, useRef } from "react";
import { X, Send, Loader2, Paperclip, Image as ImageIcon, FileIcon, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { validateFileUpload } from "@/lib/file-validation";

interface Message {
  id: string;
  content: string;
  sender: string;
  created_at: string;
  attachment_url: string | null;
}

interface TicketInfo {
  id: string;
  code: string;
  title: string;
  status: string;
  priority: string;
  user_id: string;
  created_at: string;
}

interface Props {
  ticket: TicketInfo | null;
  profileName: string;
  mode: "history" | "respond" | "preview";
  onClose: () => void;
  onStatusChange?: () => void;
  onOpenSupport?: () => void;
}

export default function AdminTicketModal({ ticket, profileName, mode, onClose, onStatusChange, onOpenSupport }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ticket) return;
    setNewStatus(ticket.status);
    fetchMessages();
  }, [ticket]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchMessages = async () => {
    if (!ticket) return;
    setLoading(true);
    const { data } = await supabase
      .from("ticket_messages")
      .select("*")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true });
    setMessages((data ?? []) as Message[]);
    setLoading(false);
  };

  const handleSend = async () => {
    if (!reply.trim() || !ticket) return;
    setSending(true);
    try {
      const { error } = await supabase.from("ticket_messages").insert({
        ticket_id: ticket.id,
        content: reply.trim(),
        sender: "support",
        read: false,
      });
      if (error) throw error;

      // Update ticket status if changed
      if (newStatus !== ticket.status) {
        await supabase.from("tickets").update({ status: newStatus }).eq("id", ticket.id);
      } else if (ticket.status === "open") {
        await supabase.from("tickets").update({ status: "in_progress" }).eq("id", ticket.id);
      }

      setReply("");
      await fetchMessages();
      onStatusChange?.();
      toast.success("Resposta enviada!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao enviar resposta.");
    } finally {
      setSending(false);
    }
  };

  if (!ticket) return null;

  const statusOptions = [
    { value: "open", label: "Aberto" },
    { value: "in_progress", label: "Em Andamento" },
    { value: "resolved", label: "Resolvido" },
    { value: "closed", label: "Fechado" },
  ];

  const isImageUrl = (url: string) => /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(url);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[85vh] bg-[#120a0a] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div>
            <h3 className="text-lg font-bold text-white">
              {mode === "preview" ? "Detalhes do Ticket" : mode === "history" ? "Histórico" : "Responder"} — #{ticket.code}
            </h3>
            <p className="text-sm text-white/50 mt-0.5">
              {ticket.title} • <span className="text-white/70">{profileName}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {ticket.status !== "closed" && (
              <button
                onClick={async () => {
                  if (ticket.status === "resolved") return;
                  await supabase.from("tickets").update({ status: "resolved" }).eq("id", ticket.id);
                  onStatusChange?.();
                  toast.success("Ticket marcado como resolvido!");
                  onClose();
                }}
                disabled={ticket.status === "resolved"}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  ticket.status === "resolved"
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 cursor-default"
                    : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white"
                }`}
              >
                {ticket.status === "resolved" ? "✓ Resolvido" : "Marcar como Resolvido"}
              </button>
            )}
            <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
              <X className="size-6" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : messages.length === 0 ? (
            <p className="text-center text-white/40 py-10">Nenhuma mensagem ainda.</p>
          ) : (
            messages.map((msg) => {
              const isSupport = msg.sender === "support";
              // Check for attachment links in content
              const urlRegex = /(https?:\/\/[^\s]+)/g;
              const urls = msg.content.match(urlRegex) || [];
              const imageUrls = urls.filter(isImageUrl);

              return (
                <div key={msg.id} className={`flex ${isSupport ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${
                    isSupport
                      ? "bg-primary/20 text-white border border-primary/20"
                      : "bg-white/5 text-white/90 border border-white/5"
                  }`}>
                    <p className="text-[10px] font-semibold uppercase tracking-wide mb-1 opacity-50">
                      {isSupport ? "Suporte" : profileName}
                    </p>
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    {/* Render image attachments */}
                    {imageUrls.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {imageUrls.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                            <img src={url} alt="Anexo" className="max-w-full max-h-48 rounded-lg border border-white/10 mt-1" />
                          </a>
                        ))}
                      </div>
                    )}
                    {msg.attachment_url && isImageUrl(msg.attachment_url) && (
                      <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer">
                        <img src={msg.attachment_url} alt="Anexo" className="max-w-full max-h-48 rounded-lg border border-white/10 mt-2" />
                      </a>
                    )}
                    <p className="text-[10px] opacity-40 mt-1.5">
                      {new Date(msg.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Reply area (respond mode) */}
        {mode === "respond" && (
          <div className="border-t border-white/10 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <label className="text-xs text-white/50 font-medium">Status:</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {statusOptions.map((s) => (
                  <option key={s.value} value={s.value} className="bg-[#1a1a1a]">
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Digite sua resposta..."
                rows={2}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <button
                onClick={handleSend}
                disabled={sending || !reply.trim()}
                className="px-4 rounded-xl bg-primary text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </button>
            </div>
          </div>
        )}

        {/* Preview mode - action buttons */}
        {mode === "preview" && (
          <div className="border-t border-white/10 p-4 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors"
            >
              Fechar
            </button>
            <button
              onClick={() => onOpenSupport?.()}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-primary text-white hover:bg-red-700 shadow-lg shadow-primary/20 transition-colors"
            >
              Abrir Atendimento
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
