import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PlatformFeedbackProps {
  userName?: string;
}

const labels = [
  { value: "otima", label: "Ótima", icon: "sentiment_very_satisfied" },
  { value: "boa", label: "Boa", icon: "sentiment_satisfied" },
  { value: "pode_melhorar", label: "Pode melhorar", icon: "sentiment_dissatisfied" },
] as const;

export function PlatformFeedback({ userName }: PlatformFeedbackProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [existingFeedback, setExistingFeedback] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("platform_feedback" as any)
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setExistingFeedback(true);
        setSubmitted(true);
      }
    })();
  }, []);

  const handleSubmit = async () => {
    if (rating === 0 || !selectedLabel) return;
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSubmitting(false); return; }

    const payload: any = {
      user_id: user.id,
      rating,
      label: selectedLabel,
      suggestion: selectedLabel === "pode_melhorar" ? suggestion.trim() || null : null,
    };

    const { error } = await supabase.from("platform_feedback" as any).insert(payload);
    setSubmitting(false);

    if (error) {
      if (error.code === "23505") {
        toast.info("Você já enviou seu feedback! Obrigado.");
        setSubmitted(true);
      } else {
        toast.error("Erro ao enviar feedback.");
      }
      return;
    }

    setSubmitted(true);
    toast.success("Feedback enviado com sucesso!");
  };

  if (submitted) {
    const firstName = userName?.split(" ")[0] || "você";
    return (
      <div className="glass-panel rounded-xl p-5 text-center space-y-2">
        <span className="material-symbols-outlined text-primary text-[36px]">favorite</span>
        <p className="text-sm font-bold text-foreground">
          Muito obrigado, {firstName}! 💛
        </p>
        <p className="text-xs text-muted-foreground">
          Seu feedback nos ajuda a construir uma plataforma cada vez melhor para você.
        </p>
      </div>
    );
  }

  const displayRating = hoverRating || rating;

  return (
    <div className="glass-panel rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-amber-400 text-lg">rate_review</span>
        <h3 className="text-sm font-bold text-foreground">Avalie nossa plataforma</h3>
      </div>
      <p className="text-xs text-muted-foreground">Sua opinião é muito importante para nós!</p>

      {/* Star Rating */}
      <div className="flex justify-center gap-1.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            onClick={() => setRating(star)}
            className="transition-transform hover:scale-110"
          >
            <span
              className={`material-symbols-outlined text-[28px] transition-colors ${
                star <= displayRating ? "text-amber-400" : "text-muted-foreground/30"
              }`}
              style={{ fontVariationSettings: star <= displayRating ? "'FILL' 1" : "'FILL' 0" }}
            >
              star
            </span>
          </button>
        ))}
      </div>

      {/* Labels */}
      {rating > 0 && (
        <div className="flex justify-center gap-2 flex-wrap animate-fade-in">
          {labels.map((l) => (
            <button
              key={l.value}
              onClick={() => setSelectedLabel(l.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                selectedLabel === l.value
                  ? "bg-primary/20 text-primary border-primary/40 shadow-[0_0_8px_rgba(220,38,38,0.15)]"
                  : "bg-muted/50 text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">{l.icon}</span>
              {l.label}
            </button>
          ))}
        </div>
      )}

      {/* Suggestion box */}
      {selectedLabel === "pode_melhorar" && (
        <div className="animate-fade-in space-y-1.5">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
            O que podemos melhorar?
          </label>
          <textarea
            value={suggestion}
            onChange={(e) => setSuggestion(e.target.value)}
            placeholder="Conte pra gente o que pode ser melhor..."
            className="w-full bg-background/50 border border-border rounded-lg p-2.5 text-xs text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 min-h-[70px]"
            maxLength={500}
          />
          <p className="text-[10px] text-muted-foreground text-right">{suggestion.length}/500</p>
        </div>
      )}

      {/* Submit */}
      {selectedLabel && (
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 animate-fade-in"
        >
          {submitting ? (
            <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
          ) : (
            <span className="material-symbols-outlined text-[14px]">send</span>
          )}
          {submitting ? "Enviando..." : "Enviar Feedback"}
        </button>
      )}
    </div>
  );
}
