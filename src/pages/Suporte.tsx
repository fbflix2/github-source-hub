import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { 
  Plus, 
  Info, 
  Send, 
  Upload, 
  ChevronDown, 
  CheckCircle, 
  X,
  Star,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RatingModal } from "@/components/RatingModal";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface TicketListItem {
  id: string;
  code: string;
  title: string;
  priority: string;
  status: string;
  created_at: string;
  has_rating: boolean;
}

export default function Suporte() {
  const [searchParams] = useSearchParams();
  const pedidoParam = searchParams.get("pedido");
  const itemParam = searchParams.get("item");

  const [title, setTitle] = useState(
    pedidoParam ? `Problema com item: ${itemParam || ''} — Pedido ${pedidoParam}` : ""
  );
  const [urgency, setUrgency] = useState("medium");
  const [link, setLink] = useState(pedidoParam ? window.location.origin + `/orders/${encodeURIComponent(pedidoParam)}` : "");
  const [orderCode, setOrderCode] = useState(pedidoParam || "");
  const [orderCodeError, setOrderCodeError] = useState("");
  const [validatingOrder, setValidatingOrder] = useState(false);
  const [orderValidated, setOrderValidated] = useState(!!pedidoParam);
  const [description, setDescription] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [createdCode, setCreatedCode] = useState("");
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedTicketForRating, setSelectedTicketForRating] = useState<string | null>(null);
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchTickets = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoadingTickets(false); return; }

    const { data: ticketsData } = await supabase
      .from("tickets")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!ticketsData) { setLoadingTickets(false); return; }

    // Check which tickets have ratings
    const ticketIds = ticketsData.map(t => t.id);
    const { data: ratingsData } = await supabase
      .from("ticket_ratings")
      .select("ticket_id")
      .in("ticket_id", ticketIds.length > 0 ? ticketIds : ["__none__"]);

    const ratedIds = new Set((ratingsData || []).map(r => r.ticket_id));

    setTickets(ticketsData.map(t => ({
      ...t,
      has_rating: ratedIds.has(t.id),
    })));
    setLoadingTickets(false);
  };

  useEffect(() => { fetchTickets(); }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const validFiles = Array.from(files).filter(f => f.size <= 20 * 1024 * 1024);
    if (validFiles.length < files.length) toast.error("Alguns arquivos excedem 20MB e foram ignorados.");
    setAttachedFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async (userId: string, ticketId: string): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of attachedFiles) {
      const ext = file.name.split('.').pop();
      const path = `${userId}/${ticketId}/${Date.now()}_${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("support-attachments")
        .upload(path, file, { contentType: file.type, cacheControl: "3600" });
      if (error) {
        console.error("Upload error:", error);
        continue;
      }
      const { data } = supabase.storage.from("support-attachments").getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    return urls;
  };

  const validateOrderCode = async (code: string) => {
    if (!code.trim()) {
      setOrderCodeError("Código do pedido é obrigatório.");
      setOrderValidated(false);
      return false;
    }
    setValidatingOrder(true);
    setOrderCodeError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setOrderCodeError("Você precisa estar logado.");
      setValidatingOrder(false);
      setOrderValidated(false);
      return false;
    }
    const { data } = await supabase
      .from("orders")
      .select("id")
      .eq("code", code.trim())
      .eq("user_id", user.id)
      .limit(1);
    
    if (!data || data.length === 0) {
      setOrderCodeError("Código de pedido não encontrado. Verifique e tente novamente.");
      setValidatingOrder(false);
      setOrderValidated(false);
      return false;
    }
    setOrderCodeError("");
    setValidatingOrder(false);
    setOrderValidated(true);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !orderCode.trim()) return;

    if (!orderValidated) {
      const valid = await validateOrderCode(orderCode);
      if (!valid) return;
    }

    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Você precisa estar logado."); setSubmitting(false); return; }

    const code = `#${Math.floor(1000 + Math.random() * 9000)}`;

    const { error: ticketError, data: ticketData } = await supabase
      .from("tickets")
      .insert({ user_id: user.id, title: title.trim(), priority: urgency, code, link: link || null })
      .select()
      .single();

    if (ticketError) {
      toast.error("Erro ao criar ticket.");
      console.error(ticketError);
      setSubmitting(false);
      return;
    }

    // Upload attachments
    let attachmentUrls: string[] = [];
    if (attachedFiles.length > 0) {
      setUploading(true);
      attachmentUrls = await uploadFiles(user.id, ticketData.id);
      setUploading(false);
    }

    // Build message content with order code and attachment links
    let messageContent = "";
    if (orderCode.trim()) {
      messageContent += `📦 Pedido: ${orderCode.trim()}\n\n`;
    }
    messageContent += description.trim();
    if (attachmentUrls.length > 0) {
      messageContent += "\n\n📎 Anexos:\n" + attachmentUrls.map((url, i) => `[Arquivo ${i + 1}](${url})`).join("\n");
    }

    // Insert initial message (use first attachment URL in the attachment_url field)
    await supabase
      .from("ticket_messages")
      .insert({
        ticket_id: ticketData.id,
        content: messageContent,
        sender: "user",
        read: true,
        attachment_url: attachmentUrls[0] || null,
      });

    // Create global notification for admin team
    await supabase.from("notifications").insert({
      title: "Novo Ticket de Suporte",
      message: `${title.trim()} — Prioridade: ${urgency === "high" ? "Alta" : urgency === "medium" ? "Média" : "Baixa"} (${code})`,
      type: "ticket",
      global: true,
    });

    setCreatedCode(code);
    setShowModal(true);
    setTitle("");
    setUrgency("medium");
    setLink("");
    setOrderCode("");
    setDescription("");
    setAttachedFiles([]);
    setSubmitting(false);
    fetchTickets();
  };

  const handleOpenRating = (ticketId: string) => {
    setSelectedTicketForRating(ticketId);
    setShowRatingModal(true);
  };

  const handleRatingSubmit = async (rating: number, comment: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !selectedTicketForRating) return;

    const { error } = await supabase.from("ticket_ratings").insert({
      ticket_id: selectedTicketForRating,
      user_id: user.id,
      rating,
      comment: comment || null,
    });

    if (error) {
      toast.error("Erro ao enviar avaliação.");
      console.error(error);
      return;
    }

    toast.success(`Avaliação enviada! ${rating} estrelas`);
    fetchTickets();
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "open": return { label: "ABERTO", color: "bg-blue-500/20 text-blue-400" };
      case "answered": return { label: "RESPONDIDO", color: "bg-yellow-500/20 text-yellow-500" };
      case "closed": return { label: "RESOLVIDO", color: "bg-green-900/40 text-green-600" };
      default: return { label: status.toUpperCase(), color: "bg-muted text-muted-foreground" };
    }
  };

  const getUrgencyConfig = (priority: string) => {
    switch (priority) {
      case "high": case "urgent": return { label: "Alta", color: "bg-red-500" };
      case "medium": return { label: "Média", color: "bg-yellow-500" };
      default: return { label: "Baixa", color: "bg-green-500" };
    }
  };

  const pendingCount = tickets.filter(t => t.status !== "closed").length;

  return (
    <div className="text-foreground font-sans relative">
      {/* Header */}
      <header className="mb-4">
        <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-foreground">Central de Ajuda</h1>
        <p className="text-muted-foreground text-sm">Suporte Técnico FBFLIX</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: New Ticket Form */}
        <section className="lg:col-span-7">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border">
            <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
              <Plus className="size-4" />
            </div>
            <h2 className="text-lg font-bold tracking-tight">Abrir Novo Ticket</h2>
          </div>
          
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Título do Assunto</label>
              <input 
                className="w-full rounded-lg px-3 py-2.5 placeholder-muted-foreground/50 bg-card border border-border text-foreground text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all" 
                placeholder="Resumo do problema (ex: Erro ao reproduzir vídeo)" 
                required 
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Nível de Urgência</label>
                <div className="relative">
                  <select 
                    className="w-full rounded-lg px-3 py-2.5 appearance-none cursor-pointer bg-card border border-border text-foreground text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value)}
                  >
                    <option value="low">Baixa (Dúvidas gerais)</option>
                    <option value="medium">Média (Problemas de uso)</option>
                    <option value="high">Alta (Item veio bloqueado)</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground size-4" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Código do Pedido
                </label>
                <div className="relative">
                  <input 
                    className={cn(
                      "w-full rounded-lg px-3 py-2.5 placeholder-muted-foreground/50 bg-card border text-foreground text-sm focus:outline-none focus:ring-1 transition-all",
                      orderCodeError 
                        ? "border-destructive focus:border-destructive focus:ring-destructive" 
                        : orderValidated 
                          ? "border-green-500/50 focus:border-green-500 focus:ring-green-500/30" 
                          : "border-border focus:border-primary focus:ring-primary"
                    )}
                    placeholder="Ex: ORD-MLVP10XS"
                    type="text"
                    required
                    value={orderCode}
                    onChange={(e) => {
                      setOrderCode(e.target.value);
                      setOrderValidated(false);
                      setOrderCodeError("");
                    }}
                    onBlur={() => {
                      if (orderCode.trim()) validateOrderCode(orderCode);
                    }}
                  />
                  {validatingOrder && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground animate-spin" />
                  )}
                  {orderValidated && !validatingOrder && (
                    <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-green-500" />
                  )}
                </div>
                {orderCodeError && (
                  <p className="text-[11px] text-destructive">{orderCodeError}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Link de Referência <span className="text-muted-foreground/50 text-[10px] font-normal">(Opcional)</span>
                </label>
                <input 
                  className="w-full rounded-lg px-3 py-2.5 placeholder-muted-foreground/50 bg-card border border-border text-foreground text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all" 
                  placeholder="https://fbflix.com/..." 
                  type="url"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Descrição Detalhada</label>
              <textarea 
                className="w-full rounded-lg px-3 py-2.5 min-h-[100px] resize-none placeholder-muted-foreground/50 bg-card border border-border text-foreground text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all" 
                placeholder="Descreva seu problema ou dúvida detalhadamente."
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Anexar Arquivos</label>
              <label className="border-dashed border flex flex-col items-center justify-center p-4 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors group bg-card border-border">
                <Upload className="size-6 text-muted-foreground mb-1 group-hover:text-primary transition-colors" />
                <span className="text-xs text-muted-foreground">
                  Arraste ou <span className="text-primary font-semibold">clique para buscar</span>
                </span>
                <span className="text-[10px] text-muted-foreground/50 mt-0.5">PNG, JPG, MP4, TXT, PDF até 20MB</span>
                <input
                  className="hidden"
                  multiple
                  type="file"
                  accept="image/*,video/*,.txt,.pdf,.doc,.docx"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
              </label>
              {attachedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {attachedFiles.map((file, i) => (
                    <div key={i} className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5 text-xs border border-border">
                      <span className="text-foreground truncate max-w-[150px]">{file.name}</span>
                      <span className="text-muted-foreground">({(file.size / 1024 / 1024).toFixed(1)}MB)</span>
                      <button type="button" onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="flex justify-end">
              <button 
                className="bg-primary hover:bg-primary/80 text-primary-foreground font-bold py-3 px-6 rounded-lg shadow-[0_0_15px_rgba(249,6,6,0.3)] hover:shadow-[0_0_20px_rgba(249,6,6,0.5)] transition-all transform active:scale-95 flex items-center gap-2 text-sm disabled:opacity-50" 
                type="submit"
                disabled={submitting}
              >
                {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                <span>{submitting ? "ENVIANDO..." : "ENVIAR TICKET"}</span>
              </button>
            </div>
          </form>
        </section>
        
        {/* Right Column: Active Tickets */}
        <section className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-gradient-to-r from-muted to-card border border-border rounded-lg p-4 flex items-start gap-3">
            <div className="bg-blue-500/10 p-1.5 rounded-lg text-blue-400">
              <Info className="size-4" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground text-xs">Horário de Atendimento</h4>
              <p className="text-muted-foreground text-[11px] mt-0.5 leading-relaxed">
                Nossa equipe está disponível de Seg-Sex das 08h às 20h. Tickets abertos fora deste horário serão priorizados no próximo dia útil.
              </p>
            </div>
          </div>
          
          <div>
            <div className="pb-3 flex justify-between items-center">
              <h3 className="text-base font-bold">Seus Tickets</h3>
              <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded border border-border">
                {pendingCount} Pendente{pendingCount !== 1 ? "s" : ""}
              </span>
            </div>

            {loadingTickets ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-5 text-primary animate-spin" />
              </div>
            ) : tickets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhum ticket criado ainda.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {tickets.map((ticket) => {
                  const statusCfg = getStatusConfig(ticket.status);
                  const urgCfg = getUrgencyConfig(ticket.priority);
                  const isResolved = ticket.status === "closed";
                  
                  return (
                    <div 
                      key={ticket.id}
                      className={cn(
                        "group p-3 rounded-lg transition-all",
                        isResolved 
                          ? "bg-card/50 border border-border opacity-60 hover:opacity-100" 
                          : "bg-card hover:bg-muted border border-border hover:border-primary/20"
                      )}
                    >
                      <div className="flex justify-between items-start mb-1.5">
                        <span className="text-[10px] font-mono text-muted-foreground">{ticket.code}</span>
                        <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider", statusCfg.color)}>
                          {statusCfg.label}
                        </span>
                      </div>
                      <h4 className={cn(
                        "font-medium text-sm transition-colors",
                        isResolved ? "text-muted-foreground group-hover:text-foreground" : "text-foreground group-hover:text-primary"
                      )}>
                        {ticket.title}
                      </h4>
                      <div className="flex justify-between items-center mt-2 text-[10px] text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <span className={cn("w-1.5 h-1.5 rounded-full", urgCfg.color)} />
                          <span>Urgência: {urgCfg.label}</span>
                        </div>
                        <span>{new Date(ticket.created_at).toLocaleDateString("pt-BR")}</span>
                      </div>
                      
                      {isResolved && !ticket.has_rating && (
                        <button
                          onClick={() => handleOpenRating(ticket.id)}
                          className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 text-yellow-400 text-xs font-medium transition-all"
                        >
                          <Star className="size-3.5" />
                          Avaliar Atendimento
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Success Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm transition-all duration-300">
          <div className="w-full max-w-md p-6 rounded-2xl flex flex-col items-center text-center relative animate-in fade-in zoom-in duration-300 bg-card border border-border">
            <button 
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowModal(false)}
            >
              <X className="size-5" />
            </button>
            <div className="h-16 w-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4 text-green-500 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
              <CheckCircle className="size-8" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-1.5">Ticket Enviado!</h3>
            <p className="text-muted-foreground text-sm mb-6">Recebemos sua solicitação. Nossa equipe já foi notificada.</p>
            <div className="w-full bg-muted rounded-lg p-3 border border-border mb-4 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">ID do Ticket</span>
                <span className="text-primary font-mono font-bold">{createdCode}</span>
              </div>
            </div>
            <button 
              className="w-full bg-foreground text-background font-bold py-2.5 rounded-lg hover:opacity-90 transition-colors text-sm"
              onClick={() => setShowModal(false)}
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Rating Modal */}
      <RatingModal
        isOpen={showRatingModal}
        onClose={() => setShowRatingModal(false)}
        ticketId={selectedTicketForRating || ""}
        onSubmit={handleRatingSubmit}
      />
    </div>
  );
}
