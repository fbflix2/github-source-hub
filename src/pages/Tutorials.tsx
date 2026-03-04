import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, Play } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Tutorial {
  id: string;
  title: string;
  video_url: string | null;
  description: string | null;
  content: string | null;
  category: string | null;
  thumbnail_url: string | null;
  position: number;
  published: boolean;
}

interface TutorialCategory {
  name: string;
  color: string;
}

const colorAccentMap: Record<string, { accent: string; hover: string }> = {
  blue: { accent: "bg-blue-500", hover: "group-hover:text-blue-400" },
  purple: { accent: "bg-purple-500", hover: "group-hover:text-purple-400" },
  orange: { accent: "bg-orange-500", hover: "group-hover:text-orange-400" },
  emerald: { accent: "bg-emerald-500", hover: "group-hover:text-emerald-400" },
  pink: { accent: "bg-pink-500", hover: "group-hover:text-pink-400" },
  cyan: { accent: "bg-cyan-500", hover: "group-hover:text-cyan-400" },
  amber: { accent: "bg-amber-500", hover: "group-hover:text-amber-400" },
  rose: { accent: "bg-rose-500", hover: "group-hover:text-rose-400" },
};

function getYouTubeId(url: string | null): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

function getYouTubeThumbnail(url: string | null): string | null {
  const id = getYouTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null;
}

function getEmbedUrl(url: string | null): string | null {
  const id = getYouTubeId(url);
  return id ? `https://www.youtube.com/embed/${id}?autoplay=1` : null;
}

interface TutorialCardProps {
  tutorial: Tutorial;
  hoverColorClass?: string;
  onPlay: (tutorial: Tutorial) => void;
}

const TutorialCard = ({ tutorial, hoverColorClass = "group-hover:text-primary", onPlay }: TutorialCardProps) => {
  const thumbnail = tutorial.thumbnail_url || getYouTubeThumbnail(tutorial.video_url);

  return (
    <div
      className="min-w-[280px] md:min-w-[320px] relative group cursor-pointer transition-transform duration-300 hover:scale-105 hover:z-10"
      onClick={() => onPlay(tutorial)}
    >
      <div className="aspect-video rounded-lg overflow-hidden bg-muted relative shadow-lg">
        {thumbnail ? (
          <img
            alt={tutorial.title}
            className="w-full h-full object-cover"
            src={thumbnail}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <Play className="size-10 text-muted-foreground" />
          </div>
        )}
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform scale-50 group-hover:scale-100">
            <Play className="size-5 text-white fill-white" />
          </div>
        </div>
      </div>
      <div className="mt-3">
        <h3 className={`text-base font-semibold text-foreground transition-colors ${hoverColorClass}`}>
          {tutorial.title}
        </h3>
        {tutorial.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{tutorial.description}</p>
        )}
        {tutorial.category && (
          <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
            <span>{tutorial.category}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default function Tutorials() {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [categories, setCategories] = useState<TutorialCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [playingTutorial, setPlayingTutorial] = useState<Tutorial | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [tutorialsRes, categoriesRes] = await Promise.all([
      supabase
        .from("tutorials")
        .select("*")
        .eq("published", true)
        .order("position", { ascending: true }),
      supabase
        .from("site_settings")
        .select("value")
        .eq("key", "tutorial_categories")
        .maybeSingle(),
    ]);

    setTutorials(tutorialsRes.data || []);

    if (categoriesRes.data?.value) {
      try {
        setCategories(JSON.parse(categoriesRes.data.value));
      } catch {
        setCategories([]);
      }
    }

    setLoading(false);
  };

  const handlePlay = (tutorial: Tutorial) => {
    if (tutorial.video_url) {
      const embedUrl = getEmbedUrl(tutorial.video_url);
      if (embedUrl) {
        setPlayingTutorial(tutorial);
      } else {
        window.open(tutorial.video_url, "_blank");
      }
    }
  };

  // Filter tutorials by search
  const filtered = tutorials.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      (t.description || "").toLowerCase().includes(q) ||
      (t.category || "").toLowerCase().includes(q) ||
      (t.content || "").toLowerCase().includes(q)
    );
  });

  // Group by category
  const grouped: { name: string; color: string; tutorials: Tutorial[] }[] = [];
  const categoryOrder = categories.map((c) => c.name);
  const usedCategories = new Set<string>();

  for (const catName of categoryOrder) {
    const items = filtered.filter((t) => t.category === catName);
    if (items.length > 0) {
      const cat = categories.find((c) => c.name === catName);
      grouped.push({ name: catName, color: cat?.color || "blue", tutorials: items });
      usedCategories.add(catName);
    }
  }

  // Add uncategorized or categories not in settings
  const uncategorized = filtered.filter(
    (t) => !t.category || !usedCategories.has(t.category)
  );
  // Group remaining by their category name
  const otherCategories = new Map<string, Tutorial[]>();
  for (const t of uncategorized) {
    const key = t.category || "Outros";
    if (!otherCategories.has(key)) otherCategories.set(key, []);
    otherCategories.get(key)!.push(t);
  }
  for (const [name, items] of otherCategories) {
    grouped.push({ name, color: "blue", tutorials: items });
  }

  // Rotating featured tutorial every 4 seconds
  const [featuredIndex, setFeaturedIndex] = useState(0);

  useEffect(() => {
    if (tutorials.length <= 1) return;
    const interval = setInterval(() => {
      setFeaturedIndex((prev) => {
        let next: number;
        do {
          next = Math.floor(Math.random() * tutorials.length);
        } while (next === prev && tutorials.length > 1);
        return next;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [tutorials.length]);

  const featuredTutorial = tutorials.length > 0 ? tutorials[featuredIndex] : null;
  const featuredThumbnail = featuredTutorial
    ? featuredTutorial.thumbnail_url || getYouTubeThumbnail(featuredTutorial.video_url)
    : null;

  return (
    <div className="animate-fade-in">
      {/* Netflix-style Hero */}
      {featuredTutorial && (
        <div
          className="relative rounded-xl overflow-hidden mb-10 cursor-pointer group"
          onClick={() => handlePlay(featuredTutorial)}
        >
          <div className="aspect-[21/9] md:aspect-[3/1] w-full relative transition-opacity duration-700" key={featuredTutorial.id}>
            {featuredThumbnail ? (
              <img
                src={featuredThumbnail}
                alt={featuredTutorial.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center">
                <Play className="size-16 text-muted-foreground" />
              </div>
            )}
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-background/80 to-transparent" />
          </div>
          {/* Content overlay */}
          <div className="absolute bottom-0 left-0 p-6 md:p-10 max-w-2xl">
            {featuredTutorial.category && (
              <span className="text-xs font-semibold uppercase tracking-wider text-primary mb-2 inline-block">
                {featuredTutorial.category}
              </span>
            )}
            <h1 className="text-2xl md:text-4xl font-bold text-foreground mb-2 leading-tight">
              {featuredTutorial.title}
            </h1>
            {featuredTutorial.description && (
              <p className="text-sm md:text-base text-muted-foreground mb-4 line-clamp-2">
                {featuredTutorial.description}
              </p>
            )}
            <button className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors group-hover:scale-105 transform duration-200">
              <Play className="size-5 fill-current" />
              Assistir agora
            </button>
          </div>
        </div>
      )}

      {/* Header + Search */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">
            Todos os Tutoriais
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Aprenda a usar a plataforma com nossos guias em vídeo.
          </p>
        </div>
        <div className="relative max-w-md w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar tutorial..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          {search ? "Nenhum tutorial encontrado para sua busca." : "Nenhum tutorial disponível no momento."}
        </div>
      ) : (
        <div className="space-y-10">
          {grouped.map((group) => {
            const colors = colorAccentMap[group.color] || colorAccentMap.blue;
            return (
              <div key={group.name} className="space-y-4">
                <h2 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
                  <span className={`w-1 h-6 rounded-full ${colors.accent}`} />
                  {group.name}
                </h2>
                <div className="flex overflow-x-auto hide-scrollbar pb-6 pt-2 gap-4 pr-8">
                  {group.tutorials.map((tutorial) => (
                    <TutorialCard
                      key={tutorial.id}
                      tutorial={tutorial}
                      hoverColorClass={colors.hover}
                      onPlay={handlePlay}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Video Player Modal */}
      {playingTutorial && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPlayingTutorial(null)}
        >
          <div
            className="w-full max-w-4xl aspect-video rounded-xl overflow-hidden shadow-2xl bg-black"
            onClick={(e) => e.stopPropagation()}
          >
            <iframe
              src={getEmbedUrl(playingTutorial.video_url)!}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}
    </div>
  );
}
