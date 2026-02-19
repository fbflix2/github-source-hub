import { useState } from "react";
import { X, Star, Send } from "lucide-react";

interface RatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticketId: string;
  onSubmit: (rating: number, comment: string) => void;
}

export function RatingModal({ isOpen, onClose, ticketId, onSubmit }: RatingModalProps) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");

  if (!isOpen) return null;

  const handleSubmit = () => {
    onSubmit(rating, comment);
    setRating(0);
    setComment("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal Card */}
      <div className="relative w-full max-w-md bg-[#120a0a] border border-white/10 rounded-2xl shadow-2xl p-6 overflow-hidden">
        {/* Decorative Glow */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/20 rounded-full blur-[50px]" />
        
        <div className="relative z-10 flex flex-col gap-5">
          {/* Modal Header */}
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xl font-bold text-white">Avaliar Atendimento</h3>
              <p className="text-sm text-white/50 mt-1">
                Ticket {ticketId} - <span className="text-green-400">Resolvido</span>
              </p>
            </div>
            <button 
              onClick={onClose}
              className="text-white/30 hover:text-white transition-colors"
            >
              <X className="size-6" />
            </button>
          </div>

          {/* Star Rating */}
          <div className="flex flex-col gap-2 items-center py-2">
            <p className="text-sm font-medium text-white/80">Como você avalia a resolução?</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="hover:scale-110 transition-transform"
                >
                  <Star 
                    className={`size-8 transition-colors ${
                      star <= (hoveredRating || rating)
                        ? "text-yellow-500 fill-yellow-500"
                        : "text-white/20"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Comment Input */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-white/60 uppercase tracking-wide">
              Comentário (Opcional)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full h-24 bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary resize-none"
              placeholder="Conte-nos mais sobre sua experiência..."
            />
          </div>

          {/* Action Button */}
          <button
            onClick={handleSubmit}
            disabled={rating === 0}
            className="w-full h-12 mt-2 bg-white text-black hover:bg-gray-200 font-bold rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-white/10 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>Enviar Avaliação</span>
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
