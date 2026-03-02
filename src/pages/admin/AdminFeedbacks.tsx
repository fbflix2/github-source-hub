import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Star, MessageSquare, TrendingUp, Users, Search, Filter } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface FeedbackRow {
  id: string;
  user_id: string;
  rating: number;
  label: string;
  suggestion: string | null;
  created_at: string;
  profile?: { full_name: string | null; avatar_url: string | null; phone: string | null } | null;
}

const labelMap: Record<string, { text: string; color: string; icon: string }> = {
  otima: { text: "Ótima", color: "text-green-400 bg-green-500/10 border-green-500/30", icon: "sentiment_very_satisfied" },
  boa: { text: "Boa", color: "text-amber-400 bg-amber-500/10 border-amber-500/30", icon: "sentiment_satisfied" },
  pode_melhorar: { text: "Pode melhorar", color: "text-red-400 bg-red-500/10 border-red-500/30", icon: "sentiment_dissatisfied" },
};

export default function AdminFeedbacks() {
  const navigate = useNavigate();
  const [feedbacks, setFeedbacks] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterLabel, setFilterLabel] = useState("all");
  const [filterRating, setFilterRating] = useState("all");

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const fetchFeedbacks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("platform_feedback" as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (error || !data) {
      setLoading(false);
      return;
    }

    // Fetch profiles for all user_ids
    const userIds = [...new Set((data as any[]).map((f: any) => f.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url, phone")
      .in("user_id", userIds);

    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

    const enriched: FeedbackRow[] = (data as any[]).map((f: any) => ({
      ...f,
      profile: profileMap.get(f.user_id) || null,
    }));

    setFeedbacks(enriched);
    setLoading(false);
  };

  const filtered = feedbacks.filter(f => {
    if (filterLabel !== "all" && f.label !== filterLabel) return false;
    if (filterRating !== "all" && f.rating !== Number(filterRating)) return false;
    if (search) {
      const s = search.toLowerCase();
      const name = f.profile?.full_name?.toLowerCase() || "";
      const sug = f.suggestion?.toLowerCase() || "";
      if (!name.includes(s) && !sug.includes(s)) return false;
    }
    return true;
  });

  const avgRating = feedbacks.length > 0
    ? (feedbacks.reduce((acc, f) => acc + f.rating, 0) / feedbacks.length).toFixed(1)
    : "0";

  const labelCounts = feedbacks.reduce((acc, f) => {
    acc[f.label] = (acc[f.label] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const ratingDist = [5, 4, 3, 2, 1].map(r => ({
    rating: r,
    count: feedbacks.filter(f => f.rating === r).length,
    pct: feedbacks.length > 0 ? (feedbacks.filter(f => f.rating === r).length / feedbacks.length) * 100 : 0,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/admin/configuracoes")} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
          <ArrowLeft className="size-4 text-white/70" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-foreground">Feedbacks da Plataforma</h1>
          <p className="text-xs text-muted-foreground">Análise das avaliações enviadas pelos clientes</p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-panel rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="size-4" />
            <span className="text-[10px] uppercase tracking-wider font-medium">Total</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{feedbacks.length}</p>
        </div>
        <div className="glass-panel rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-2 text-amber-400">
            <Star className="size-4" />
            <span className="text-[10px] uppercase tracking-wider font-medium">Média</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{avgRating} <span className="text-sm text-muted-foreground">/ 5</span></p>
        </div>
        <div className="glass-panel rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-2 text-green-400">
            <TrendingUp className="size-4" />
            <span className="text-[10px] uppercase tracking-wider font-medium">Positivos</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{(labelCounts["otima"] || 0) + (labelCounts["boa"] || 0)}</p>
        </div>
        <div className="glass-panel rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-2 text-red-400">
            <MessageSquare className="size-4" />
            <span className="text-[10px] uppercase tracking-wider font-medium">Sugestões</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{feedbacks.filter(f => f.suggestion).length}</p>
        </div>
      </div>

      {/* Rating distribution */}
      <div className="glass-panel rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-bold text-foreground">Distribuição de Notas</h3>
        <div className="space-y-2">
          {ratingDist.map(r => (
            <div key={r.rating} className="flex items-center gap-3">
              <div className="flex items-center gap-1 w-16">
                <span className="text-xs font-medium text-foreground">{r.rating}</span>
                <Star className="size-3 text-amber-400 fill-amber-400" />
              </div>
              <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full transition-all"
                  style={{ width: `${r.pct}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground w-10 text-right">{r.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou sugestão..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-white/5 border-white/10"
          />
        </div>
        <Select value={filterLabel} onValueChange={setFilterLabel}>
          <SelectTrigger className="w-[160px] bg-white/5 border-white/10">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            <SelectItem value="otima">Ótima</SelectItem>
            <SelectItem value="boa">Boa</SelectItem>
            <SelectItem value="pode_melhorar">Pode melhorar</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterRating} onValueChange={setFilterRating}>
          <SelectTrigger className="w-[130px] bg-white/5 border-white/10">
            <SelectValue placeholder="Nota" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas notas</SelectItem>
            {[5, 4, 3, 2, 1].map(r => (
              <SelectItem key={r} value={String(r)}>{r} estrela{r > 1 ? "s" : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Feedback list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <span className="material-symbols-outlined text-primary text-3xl animate-spin">progress_activity</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel rounded-xl p-8 text-center">
          <span className="material-symbols-outlined text-muted-foreground text-4xl mb-2">inbox</span>
          <p className="text-sm text-muted-foreground">Nenhum feedback encontrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(f => {
            const lbl = labelMap[f.label] || labelMap.boa;
            return (
              <div key={f.id} className="glass-panel rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {f.profile?.avatar_url ? (
                      <img src={f.profile.avatar_url} alt="" className="size-8 rounded-full object-cover" />
                    ) : (
                      <div className="size-8 rounded-full bg-white/10 flex items-center justify-center">
                        <span className="text-xs font-bold text-white/50">
                          {f.profile?.full_name?.charAt(0)?.toUpperCase() || "?"}
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-foreground">{f.profile?.full_name || "Usuário"}</p>
                      {f.profile?.phone && (
                        <p className="text-[10px] text-muted-foreground">{f.profile.phone}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} className={`size-3.5 ${s <= f.rating ? "text-amber-400 fill-amber-400" : "text-white/10"}`} />
                      ))}
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${lbl.color}`}>
                      {lbl.text}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {(() => {
                        const d = new Date(f.created_at);
                        return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                      })()}
                    </span>
                  </div>
                </div>
                {f.suggestion && (
                  <div className="ml-11 bg-white/5 rounded-lg p-3 border border-white/5">
                    <p className="text-xs text-muted-foreground italic">"{f.suggestion}"</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
