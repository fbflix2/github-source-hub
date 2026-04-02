import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Search, Shield, Star, TrendingUp, Heart, ChevronRight, Filter, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const PLATFORMS = [
  { value: "all", label: "Todos", icon: "🌐" },
  { value: "instagram", label: "Instagram", icon: "📸" },
  { value: "tiktok", label: "TikTok", icon: "🎵" },
  { value: "youtube", label: "YouTube", icon: "▶️" },
];

const NICHES = ["Marketing", "Lifestyle", "Fitness", "Tecnologia", "Moda", "Gastronomia", "Educação", "Entretenimento"];

const FOLLOWER_RANGES = [
  { label: "Até 10k", min: 0, max: 10000 },
  { label: "10k - 50k", min: 10000, max: 50000 },
  { label: "50k - 100k", min: 50000, max: 100000 },
  { label: "100k - 500k", min: 100000, max: 500000 },
  { label: "500k+", min: 500000, max: 999999999 },
];

function formatFollowers(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function formatPrice(n: number) {
  return `R$ ${n.toFixed(2).replace(".", ",")}`;
}

function getPlatformIcon(platform: string) {
  switch (platform) {
    case "instagram": return "📸";
    case "tiktok": return "🎵";
    case "youtube": return "▶️";
    default: return "🌐";
  }
}

interface Listing {
  id: string;
  seller_id: string;
  platform: string;
  title: string;
  description: string | null;
  price: number;
  status: string;
  followers: number;
  engagement_rate: number | null;
  niche: string | null;
  is_verified: boolean;
  is_monetized: boolean;
  has_original_email: boolean;
  account_age_months: number | null;
  screenshots: string[];
  featured: boolean;
  views_count: number;
  created_at: string;
}

export default function SocialSafeHome() {
  const navigate = useNavigate();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("all");
  const [selectedNiche, setSelectedNiche] = useState<string | null>(null);
  const [followerRange, setFollowerRange] = useState<typeof FOLLOWER_RANGES[0] | null>(null);
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [onlyMonetized, setOnlyMonetized] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchListings();
    fetchFavorites();
  }, []);

  async function fetchListings() {
    setLoading(true);
    const { data } = await supabase
      .from("ss_listings")
      .select("*")
      .eq("status", "published")
      .order("featured", { ascending: false })
      .order("created_at", { ascending: false });
    setListings((data as any[]) || []);
    setLoading(false);
  }

  async function fetchFavorites() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("ss_favorites")
      .select("listing_id")
      .eq("user_id", user.id);
    if (data) setFavorites(new Set(data.map((f: any) => f.listing_id)));
  }

  async function toggleFavorite(e: React.MouseEvent, listingId: string) {
    e.stopPropagation();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (favorites.has(listingId)) {
      await supabase.from("ss_favorites").delete().eq("user_id", user.id).eq("listing_id", listingId);
      setFavorites(prev => { const n = new Set(prev); n.delete(listingId); return n; });
    } else {
      await supabase.from("ss_favorites").insert({ user_id: user.id, listing_id: listingId });
      setFavorites(prev => new Set(prev).add(listingId));
    }
  }

  const filtered = listings.filter(l => {
    if (platform !== "all" && l.platform !== platform) return false;
    if (search && !l.title.toLowerCase().includes(search.toLowerCase()) && !l.description?.toLowerCase().includes(search.toLowerCase())) return false;
    if (selectedNiche && l.niche !== selectedNiche) return false;
    if (followerRange && (l.followers < followerRange.min || l.followers > followerRange.max)) return false;
    if (onlyVerified && !l.is_verified) return false;
    if (onlyMonetized && !l.is_monetized) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-[hsl(var(--ss-bg))]">
      {/* Hero Header */}
      <header className="sticky top-0 z-50 bg-[hsl(var(--ss-header))] border-b border-[hsl(var(--ss-border))] backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center gap-4">
            {/* Logo */}
            <button onClick={() => navigate("/socialsafe")} className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-[hsl(var(--ss-primary))] flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-[hsl(var(--ss-foreground))] hidden sm:block">
                Social<span className="text-[hsl(var(--ss-primary))]">Safe</span>
              </span>
            </button>

            {/* Search Bar */}
            <div className="flex-1 max-w-2xl relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--ss-muted-fg))]" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar contas por nome, nicho, plataforma..."
                className="pl-10 h-10 bg-[hsl(var(--ss-input))] border-[hsl(var(--ss-border))] text-[hsl(var(--ss-foreground))] placeholder:text-[hsl(var(--ss-muted-fg))] rounded-full focus-visible:ring-[hsl(var(--ss-primary))]"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/socialsafe/criar-anuncio")}
                className="border-[hsl(var(--ss-primary))] text-[hsl(var(--ss-primary))] hover:bg-[hsl(var(--ss-primary))]/10 rounded-full text-xs font-semibold"
              >
                Vender Conta
              </Button>
              <Button
                size="sm"
                onClick={() => navigate("/socialsafe/minha-conta")}
                className="bg-[hsl(var(--ss-primary))] hover:bg-[hsl(var(--ss-primary))]/90 text-white rounded-full text-xs font-semibold"
              >
                Minha Conta
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Trust Badges */}
        <div className="flex items-center gap-6 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          <div className="flex items-center gap-2 text-xs text-[hsl(var(--ss-muted-fg))] whitespace-nowrap">
            <Shield className="w-4 h-4 text-[hsl(var(--ss-primary))]" />
            <span>Escrow Seguro</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-[hsl(var(--ss-muted-fg))] whitespace-nowrap">
            <Star className="w-4 h-4 text-[hsl(var(--ss-accent))]" />
            <span>Contas Verificadas</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-[hsl(var(--ss-muted-fg))] whitespace-nowrap">
            <TrendingUp className="w-4 h-4 text-[hsl(var(--ss-secondary))]" />
            <span>Validação Humana</span>
          </div>
        </div>

        {/* Platform Chips */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
          {PLATFORMS.map(p => (
            <button
              key={p.value}
              onClick={() => setPlatform(p.value)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                platform === p.value
                  ? "bg-[hsl(var(--ss-primary))] text-white shadow-lg shadow-[hsl(var(--ss-primary))]/25"
                  : "bg-[hsl(var(--ss-card))] text-[hsl(var(--ss-foreground))] border border-[hsl(var(--ss-border))] hover:border-[hsl(var(--ss-primary))]/50"
              }`}
            >
              <span>{p.icon}</span>
              {p.label}
            </button>
          ))}

          <div className="w-px h-6 bg-[hsl(var(--ss-border))] mx-1" />

          {/* Quick Filters */}
          <button
            onClick={() => setOnlyVerified(!onlyVerified)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${
              onlyVerified
                ? "bg-[hsl(var(--ss-primary))]/10 text-[hsl(var(--ss-primary))] border-[hsl(var(--ss-primary))]/30"
                : "bg-[hsl(var(--ss-card))] text-[hsl(var(--ss-muted-fg))] border-[hsl(var(--ss-border))]"
            }`}
          >
            ✓ Verificadas
          </button>
          <button
            onClick={() => setOnlyMonetized(!onlyMonetized)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${
              onlyMonetized
                ? "bg-[hsl(var(--ss-primary))]/10 text-[hsl(var(--ss-primary))] border-[hsl(var(--ss-primary))]/30"
                : "bg-[hsl(var(--ss-card))] text-[hsl(var(--ss-muted-fg))] border-[hsl(var(--ss-border))]"
            }`}
          >
            💰 Monetizadas
          </button>
        </div>

        {/* Niche Chips */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          {NICHES.map(n => (
            <button
              key={n}
              onClick={() => setSelectedNiche(selectedNiche === n ? null : n)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${
                selectedNiche === n
                  ? "bg-[hsl(var(--ss-secondary))]/10 text-[hsl(var(--ss-secondary))] border-[hsl(var(--ss-secondary))]/30"
                  : "bg-[hsl(var(--ss-card))] text-[hsl(var(--ss-muted-fg))] border-[hsl(var(--ss-border))] hover:border-[hsl(var(--ss-secondary))]/50"
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        {/* Follower Range */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          <SlidersHorizontal className="w-4 h-4 text-[hsl(var(--ss-muted-fg))] shrink-0" />
          <span className="text-xs text-[hsl(var(--ss-muted-fg))] shrink-0">Seguidores:</span>
          {FOLLOWER_RANGES.map(r => (
            <button
              key={r.label}
              onClick={() => setFollowerRange(followerRange?.label === r.label ? null : r)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${
                followerRange?.label === r.label
                  ? "bg-[hsl(var(--ss-primary))]/10 text-[hsl(var(--ss-primary))] border-[hsl(var(--ss-primary))]/30"
                  : "bg-[hsl(var(--ss-card))] text-[hsl(var(--ss-muted-fg))] border-[hsl(var(--ss-border))]"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-[hsl(var(--ss-muted-fg))]">
            {loading ? "Carregando..." : `${filtered.length} conta${filtered.length !== 1 ? "s" : ""} encontrada${filtered.length !== 1 ? "s" : ""}`}
          </p>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden bg-[hsl(var(--ss-card))] border border-[hsl(var(--ss-border))]">
                <Skeleton className="h-48 w-full" />
                <div className="p-4 space-y-3">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-6 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-[hsl(var(--ss-card))] border border-[hsl(var(--ss-border))] flex items-center justify-center mx-auto mb-4">
              <Search className="w-7 h-7 text-[hsl(var(--ss-muted-fg))]" />
            </div>
            <h3 className="text-lg font-semibold text-[hsl(var(--ss-foreground))] mb-1">Nenhuma conta encontrada</h3>
            <p className="text-sm text-[hsl(var(--ss-muted-fg))]">Tente ajustar os filtros ou buscar por outro termo.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(listing => (
              <article
                key={listing.id}
                onClick={() => navigate(`/socialsafe/anuncio/${listing.id}`)}
                className="group rounded-2xl overflow-hidden bg-[hsl(var(--ss-card))] border border-[hsl(var(--ss-border))] hover:border-[hsl(var(--ss-primary))]/40 transition-all cursor-pointer hover:shadow-lg hover:shadow-[hsl(var(--ss-primary))]/5 relative"
              >
                {/* Featured badge */}
                {listing.featured && (
                  <div className="absolute top-3 left-3 z-10">
                    <Badge className="bg-[hsl(var(--ss-accent))] text-black text-[10px] font-bold px-2 py-0.5 rounded-full">
                      ⭐ Destaque
                    </Badge>
                  </div>
                )}

                {/* Favorite */}
                <button
                  onClick={e => toggleFavorite(e, listing.id)}
                  className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/40 backdrop-blur flex items-center justify-center hover:bg-black/60 transition"
                >
                  <Heart className={`w-4 h-4 ${favorites.has(listing.id) ? "fill-red-500 text-red-500" : "text-white"}`} />
                </button>

                {/* Image placeholder */}
                <div className="h-44 bg-gradient-to-br from-[hsl(var(--ss-card))] to-[hsl(var(--ss-input))] flex items-center justify-center relative overflow-hidden">
                  {listing.screenshots && listing.screenshots.length > 0 ? (
                    <img src={listing.screenshots[0]} alt={listing.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center">
                      <span className="text-4xl">{getPlatformIcon(listing.platform)}</span>
                      <p className="text-[10px] text-[hsl(var(--ss-muted-fg))] mt-1">{listing.platform}</p>
                    </div>
                  )}

                  {/* Platform badge bottom */}
                  <div className="absolute bottom-2 left-2 flex gap-1.5">
                    <Badge className="bg-black/60 backdrop-blur text-white text-[10px] font-medium px-2 py-0.5 rounded-full border-0">
                      {getPlatformIcon(listing.platform)} {listing.platform}
                    </Badge>
                    {listing.is_verified && (
                      <Badge className="bg-[hsl(var(--ss-primary))]/90 text-white text-[10px] font-medium px-2 py-0.5 rounded-full border-0">
                        ✓ Verificada
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 space-y-3">
                  <h3 className="text-sm font-bold text-[hsl(var(--ss-foreground))] line-clamp-2 leading-tight group-hover:text-[hsl(var(--ss-primary))] transition-colors">
                    {listing.title}
                  </h3>

                  {/* Metrics row */}
                  <div className="flex items-center gap-3 text-xs text-[hsl(var(--ss-muted-fg))]">
                    <span className="flex items-center gap-1">
                      👥 {formatFollowers(listing.followers)}
                    </span>
                    {listing.engagement_rate && listing.engagement_rate > 0 && (
                      <span className="flex items-center gap-1">
                        📈 {listing.engagement_rate.toFixed(1)}%
                      </span>
                    )}
                    {listing.niche && (
                      <span className="flex items-center gap-1">
                        🏷️ {listing.niche}
                      </span>
                    )}
                  </div>

                  {/* Tags */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {listing.is_monetized && (
                      <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-500 rounded-full px-2 py-0">
                        💰 Monetizada
                      </Badge>
                    )}
                    {listing.has_original_email && (
                      <Badge variant="outline" className="text-[10px] border-[hsl(var(--ss-secondary))]/30 text-[hsl(var(--ss-secondary))] rounded-full px-2 py-0">
                        ✉️ Email Original
                      </Badge>
                    )}
                    {listing.account_age_months && listing.account_age_months > 24 && (
                      <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-400 rounded-full px-2 py-0">
                        🕐 +{Math.floor(listing.account_age_months / 12)} anos
                      </Badge>
                    )}
                  </div>

                  {/* Price + CTA */}
                  <div className="flex items-center justify-between pt-2 border-t border-[hsl(var(--ss-border))]">
                    <div>
                      <p className="text-lg font-bold text-[hsl(var(--ss-primary))]">{formatPrice(listing.price)}</p>
                    </div>
                    <Button
                      size="sm"
                      className="bg-[hsl(var(--ss-primary))] hover:bg-[hsl(var(--ss-primary))]/90 text-white rounded-full text-xs px-4 h-8 font-semibold"
                    >
                      Ver mais <ChevronRight className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
