import { useState, useRef } from "react";
import { 
  Plus, 
  Info, 
  Send, 
  Upload, 
  ChevronDown, 
  CheckCircle, 
  X,
  Star
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RatingModal } from "@/components/RatingModal";
import { toast } from "sonner";

const mockTickets = [
  {
    id: "#4892",
    title: "Erro ao alterar senha da conta",
    urgency: "Alta",
    urgencyColor: "bg-red-500",
    status: "EM ANÁLISE",
    statusColor: "bg-yellow-500/20 text-yellow-500",
    date: "24/10/2023",
    resolved: false
  },
  {
    id: "#4810",
    title: "Legendas não sincronizadas",
    urgency: "Baixa",
    urgencyColor: "bg-green-500",
    status: "ABERTO",
    statusColor: "bg-blue-500/20 text-blue-400",
    date: "22/10/2023",
    resolved: false
  },
  {
    id: "#4501",
    title: "Cobrança duplicada no cartão",
    urgency: "Alta",
    urgencyColor: "bg-gray-600",
    status: "RESOLVIDO",
    statusColor: "bg-green-900/40 text-green-600",
    date: "15/09/2023",
    resolved: true,
    needsRating: true
  }
];

export default function Suporte() {
  const [title, setTitle] = useState("");
  const [urgency, setUrgency] = useState("baixa");
  const [link, setLink] = useState("");
  const [description, setDescription] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedTicketForRating, setSelectedTicketForRating] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowModal(true);
  };

  const handleOpenRating = (ticketId: string) => {
    setSelectedTicketForRating(ticketId);
    setShowRatingModal(true);
  };

  const handleRatingSubmit = (rating: number, comment: string) => {
    toast.success(`Avaliação enviada! ${rating} estrelas`);
    console.log("Rating:", rating, "Comment:", comment, "Ticket:", selectedTicketForRating);
  };

  return (
    <div className="text-white font-sans relative">
      {/* Header */}
      <header className="mb-4">
        <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-white">Central de Ajuda</h1>
        <p className="text-gray-400 text-sm">Suporte Técnico FBFLIX</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: New Ticket Form */}
        <section className="lg:col-span-7">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-white/5">
            <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
              <Plus className="size-4" />
            </div>
            <h2 className="text-lg font-bold tracking-tight">Abrir Novo Ticket</h2>
          </div>
          
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            {/* Subject */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-300">Título do Assunto</label>
              <input 
                className="w-full rounded-lg px-3 py-2.5 placeholder-gray-600 bg-white/[0.03] border border-white/10 text-white text-sm focus:bg-white/[0.05] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all" 
                placeholder="Resumo do problema (ex: Erro ao reproduzir vídeo)" 
                required 
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            
            {/* Urgency & Link Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-300">Nível de Urgência</label>
                <div className="relative">
                  <select 
                    className="w-full rounded-lg px-3 py-2.5 appearance-none cursor-pointer bg-white/[0.03] border border-white/10 text-white text-sm focus:bg-white/[0.05] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value)}
                  >
                    <option className="bg-[#121212] text-gray-300" value="baixa">Baixa (Dúvidas gerais)</option>
                    <option className="bg-[#121212] text-gray-300" value="media">Média (Problemas de uso)</option>
                    <option className="bg-[#121212] text-white font-bold" value="alta">Alta (Sistema inoperante)</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 size-4" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-300">
                  Link de Referência <span className="text-gray-600 text-[10px] font-normal">(Opcional)</span>
                </label>
                <input 
                  className="w-full rounded-lg px-3 py-2.5 placeholder-gray-600 bg-white/[0.03] border border-white/10 text-white text-sm focus:bg-white/[0.05] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all" 
                  placeholder="https://fbflix.com/..." 
                  type="url"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                />
              </div>
            </div>
            
            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-300">Descrição Detalhada</label>
              <textarea 
                className="w-full rounded-lg px-3 py-2.5 min-h-[100px] resize-none placeholder-gray-600 bg-white/[0.03] border border-white/10 text-white text-sm focus:bg-white/[0.05] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all" 
                placeholder="Descreva seu problema ou dúvida detalhadamente."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            
            {/* File Upload */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-300">Anexar Imagens/Vídeos</label>
              <label className="border-dashed border flex flex-col items-center justify-center p-4 rounded-lg cursor-pointer hover:bg-white/5 transition-colors group bg-white/[0.03] border-white/10">
                <Upload className="size-6 text-gray-500 mb-1 group-hover:text-primary transition-colors" />
                <span className="text-xs text-gray-400">
                  Arraste ou <span className="text-primary font-semibold">clique para buscar</span>
                </span>
                <span className="text-[10px] text-gray-600 mt-0.5">PNG, JPG, MP4 até 20MB</span>
                <input className="hidden" multiple type="file" ref={fileInputRef} />
              </label>
            </div>
            
            {/* Submit Button */}
            <div className="flex justify-end">
              <button 
                className="bg-primary hover:bg-primary/80 text-white font-bold py-3 px-6 rounded-lg shadow-[0_0_15px_rgba(249,6,6,0.3)] hover:shadow-[0_0_20px_rgba(249,6,6,0.5)] transition-all transform active:scale-95 flex items-center gap-2 text-sm" 
                type="submit"
              >
                <span>ENVIAR TICKET</span>
                <Send className="size-4" />
              </button>
            </div>
          </form>
        </section>
        
        {/* Right Column: Active Tickets & History */}
        <section className="lg:col-span-5 flex flex-col gap-4">
          {/* Info Banner */}
          <div className="bg-gradient-to-r from-gray-900 to-gray-800 border border-white/10 rounded-lg p-4 flex items-start gap-3">
            <div className="bg-blue-500/10 p-1.5 rounded-lg text-blue-400">
              <Info className="size-4" />
            </div>
            <div>
              <h4 className="font-semibold text-white text-xs">Horário de Atendimento</h4>
              <p className="text-gray-400 text-[11px] mt-0.5 leading-relaxed">
                Nossa equipe está disponível de Seg-Sex das 08h às 20h. Tickets abertos fora deste horário serão priorizados no próximo dia útil.
              </p>
            </div>
          </div>
          
          {/* Active Tickets List */}
          <div>
            <div className="pb-3 flex justify-between items-center">
              <h3 className="text-base font-bold">Seus Tickets Ativos</h3>
              <span className="text-[10px] bg-white/10 text-gray-300 px-2 py-0.5 rounded">2 Pendentes</span>
            </div>
            <div className="flex flex-col gap-2">
              {mockTickets.map((ticket) => (
                <div 
                  key={ticket.id}
                  className={cn(
                    "group p-3 rounded-lg transition-all",
                    ticket.resolved 
                      ? "bg-black/20 border border-white/5 opacity-60 hover:opacity-100" 
                      : "bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20"
                  )}
                >
                  <div className="flex justify-between items-start mb-1.5">
                    <span className={cn("text-[10px] font-mono", ticket.resolved ? "text-gray-600" : "text-gray-500")}>
                      {ticket.id}
                    </span>
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider",
                      ticket.statusColor
                    )}>
                      {ticket.status}
                    </span>
                  </div>
                  <h4 className={cn(
                    "font-medium text-sm transition-colors",
                    ticket.resolved 
                      ? "text-gray-400 group-hover:text-gray-200" 
                      : "text-white group-hover:text-primary"
                  )}>
                    {ticket.title}
                  </h4>
                  <div className={cn(
                    "flex justify-between items-center mt-2 text-[10px]",
                    ticket.resolved ? "text-gray-500" : "text-gray-400"
                  )}>
                    <div className="flex items-center gap-1">
                      <span className={cn("w-1.5 h-1.5 rounded-full", ticket.urgencyColor)} />
                      <span>Urgência: {ticket.urgency}</span>
                    </div>
                    <span>{ticket.date}</span>
                  </div>
                  
                  {/* Rating Button for resolved tickets */}
                  {ticket.resolved && ticket.needsRating && (
                    <button
                      onClick={() => handleOpenRating(ticket.id)}
                      className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 text-yellow-400 text-xs font-medium transition-all"
                    >
                      <Star className="size-3.5" />
                      Avaliar Atendimento
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Success Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm transition-all duration-300">
          <div className="w-full max-w-md p-6 rounded-2xl flex flex-col items-center text-center relative animate-in fade-in zoom-in duration-300 bg-[#141414] border border-white/10">
            <button 
              className="absolute top-3 right-3 text-gray-500 hover:text-white transition-colors"
              onClick={() => setShowModal(false)}
            >
              <X className="size-5" />
            </button>
            <div className="h-16 w-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4 text-green-500 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
              <CheckCircle className="size-8" />
            </div>
            <h3 className="text-xl font-bold text-white mb-1.5">Ticket Enviado!</h3>
            <p className="text-gray-400 text-sm mb-6">Recebemos sua solicitação. Nossa equipe já foi notificada.</p>
            <div className="w-full bg-white/5 rounded-lg p-3 border border-white/10 mb-4 text-sm">
              <div className="flex justify-between items-center border-b border-white/10 pb-2 mb-2">
                <span className="text-gray-400">ID do Ticket</span>
                <span className="text-primary font-mono font-bold">#4923</span>
              </div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-gray-400">Posição na fila</span>
                <span className="text-white font-bold">5º lugar</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Tempo estimado</span>
                <span className="text-white font-bold">~45 min</span>
              </div>
            </div>
            <button 
              className="w-full bg-white text-black font-bold py-2.5 rounded-lg hover:bg-gray-200 transition-colors text-sm"
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
