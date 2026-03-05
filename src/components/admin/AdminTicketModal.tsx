import { useState, useEffect, useRef } from "react";
import { X, Send, Loader2, Paperclip, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { validateSupportFile } from "@/lib/file-validation";

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
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    for (const file of files) {
      const validation = await validateSupportFile(file, 20);
      if (!validation.valid) {
        toast.error(validation.error || "Arquivo inválido");
        continue;
      }
      setAttachments(prev => [...prev, file]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFile = async (file: File, ticketId: string): Promise<string | null> => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const path = `tickets/${ticketId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    
    const { error } = await supabase.storage
      .from("support-attachments")
      .upload(path, file, { contentType: file.type });

    if (error) {
      console.error("Upload error:", error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("support-attachments")
      .getPublicUrl(path);

    return urlData.publicUrl;
  };

  const handleSend = async () => {
    if ((!reply.trim() && attachments.length === 0) || !ticket) return;
    setSending(true);
    setUploading(attachments.length > 0);

    try {
      const uploadedUrls: string[] = [];
      for (const file of attachments) {
        const url = await uploadFile(file, ticket.id);
        if (url) uploadedUrls.push(url);
      }

      let messageContent = reply.trim();
      if (uploadedUrls.length > 0 && !messageContent) {
        messageContent = "📎 Anexo(s) enviado(s)";
      }

      const { error } = await supabase.from("ticket_messages").insert({
        ticket_id: ticket.id,
        content: messageContent,
        sender: "support",
        read: false,
        attachment_url: uploadedUrls.length >= 1 ? uploadedUrls[0] : null,
      });
      if (error) throw error;

      // Extra attachments as separate messages
      for (let i = 1; i < uploadedUrls.length; i++) {
        await supabase.from("ticket_messages").insert({
          ticket_id: ticket.id,
          content: `📎 Anexo ${i + 1}`,
          sender: "support",
          read: false,
          attachment_url: uploadedUrls[i],
        });
      }

      if (newStatus !== ticket.status) {
        await supabase.from("tickets").update({ status: newStatus }).eq("id", ticket.id);
      } else if (ticket.status === "open") {
        await supabase.from("tickets").update({ status: "in_progress" }).eq("id", ticket.id);
      }

      setReply("");
      setAttachments([]);
      await fetchMessages();
      onStatusChange?.();
      toast.success("Resposta enviada!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao enviar resposta.");
    } finally {
      setSending(false);
      setUploading(false);
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
  const isVideoUrl = (url: string) => /\.(mp4|mov|avi|mkv|webm)(\?|$)/i.test(url);

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
                    {msg.attachment_url && isVideoUrl(msg.attachment_url) && (
                      <video src={msg.attachment_url} controls className="max-w-full max-h-48 rounded-lg border border-white/10 mt-2" />
                    )}
                    {msg.attachment_url && !isImageUrl(msg.attachment_url) && !isVideoUrl(msg.attachment_url) && (
                      <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 mt-2 text-xs text-primary hover:underline">
                        <Paperclip className="size-3" /> Abrir anexo
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

            {/* Attachment previews */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachments.map((file, i) => {
                  const isImg = file.type.startsWith("image/");
                  return (
                    <div key={i} className="relative group bg-white/5 border border-white/10 rounded-lg p-1.5 flex items-center gap-2 text-xs text-white/70">
                      {isImg ? (
                        <img src={URL.createObjectURL(file)} alt="" className="w-10 h-10 rounded object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-white/5 flex items-center justify-center">
                          <Paperclip className="size-4 text-white/40" />
                        </div>
                      )}
                      <span className="max-w-[100px] truncate">{file.name}</span>
                      <button onClick={() => removeAttachment(i)} className="text-white/30 hover:text-red-400 transition-colors">
                        <XCircle className="size-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,.pdf,.txt,.doc,.docx"
                className="hidden"
                onChange={handleFileSelect}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 rounded-xl bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 hover:text-white transition-colors flex items-center"
                title="Anexar arquivo"
              >
                <Paperclip className="size-4" />
              </button>
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
                disabled={sending || (!reply.trim() && attachments.length === 0)}
                className="px-4 rounded-xl bg-primary text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </button>
            </div>
            {uploading && (
              <p className="text-[10px] text-white/40 flex items-center gap-1">
                <Loader2 className="size-3 animate-spin" /> Enviando anexo(s)...
              </p>
            )}
          </div>
        )}

        {/* Preview mode */}
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
