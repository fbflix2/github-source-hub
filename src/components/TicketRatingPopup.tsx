import { useState } from "react";
import { Star, X, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  ticketId: string;
  ticketCode: string;
  onClose: () => void;
  onSubmitted: () => void;
}

export default function TicketRatingPopup({ ticketId, ticketCode, onClose, onSubmitted }: Props) {
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);

  const labels = ["", "Péssimo", "Ruim", "Regular", "Bom", "Excelente"];

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Selecione uma nota de 1 a 5");
      return;
    }
    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { error } = await supabase.from("ticket_ratings").insert({
        ticket_id: ticketId,
        user_id: user.id,
        rating,
        comment: comment.trim() || null,
      });

      if (error) {
        if (error.code === "23505") {
          toast.info("Você já avaliou este atendimento!");
          onClose();
          return;
        }
        throw error;
      }

      toast.success("Obrigado pela avaliação! 🎉");
      onSubmitted();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao enviar avaliação.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        {/* Close */}
        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors">
          <X className="size-5" />
        </button>

        {/* Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-2">
            <Star className="size-7 text-primary" />
          </div>
          <h3 className="text-lg font-bold text-foreground">Como foi o atendimento?</h3>
          <p className="text-sm text-muted-foreground">
            Ticket <span className="font-mono font-semibold">#{ticketCode}</span> foi resolvido
          </p>
        </div>

        {/* Stars */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredStar(star)}
                onMouseLeave={() => setHoveredStar(0)}
                className="p-1 transition-transform hover:scale-110"
              >
                <Star
                  className={`size-9 transition-colors ${
                    star <= (hoveredStar || rating)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground/30"
                  }`}
                />
              </button>
            ))}
          </div>
          {(hoveredStar || rating) > 0 && (
            <span className="text-sm font-medium text-foreground animate-in fade-in duration-150">
              {labels[hoveredStar || rating]}
            </span>
          )}
        </div>

        {/* Comment */}
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Deixe um comentário (opcional)..."
          rows={3}
          className="w-full bg-muted/50 border border-border rounded-xl p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
        />

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-muted hover:bg-muted/80 text-foreground border border-border transition-colors"
          >
            Pular
          </button>
          <button
            onClick={handleSubmit}
            disabled={sending || rating === 0}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
