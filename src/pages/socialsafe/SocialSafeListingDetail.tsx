import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Star, Heart, ArrowLeft, MessageCircle, AlertTriangle, CheckCircle2, Clock, User, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

function formatFollowers(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function formatPrice(n: number) {
  return `R$ ${n.toFixed(2).replace(".", ",")}`;
}

function getPlatformColor(platform: string) {
  switch (platform) {
    case "instagram": return "from-pink-500 to-purple-600";
    case "tiktok": return "from-slate-900 to-slate-700";
    case "youtube": return "from-red-600 to-red-800";
    default: return "from-gray-500 to-gray-700";
  }
}

export default function SocialSafeListingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchListing();
  }, [id]);

  async function fetchListing() {
    setLoading(true);
    const { data } = await supabase.from("ss_listings").select("*").eq("id", id).maybeSingle();
    setListing(data);
    setLoading(false);
  }

  async function handleBuy() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Faça login para comprar."); return; }
    if (user.id === listing.seller_id) { toast.error("Você não pode comprar sua própria conta."); return; }

    setBuying(true);
    const fee = listing.price * 0.15;
    const { error } = await supabase.from("ss_transactions").insert({
      listing_id: listing.id,
      buyer_id: user.id,
      seller_id: listing.seller_id,
      amount: listing.price,
      platform_fee: fee,
      fee_rate: 0.15,
      status: "pending_payment",
    });
    setBuying(false);

    if (error) {
      toast.error("Erro ao iniciar compra.");
    } else {
      toast.success("Compra iniciada! Acompanhe na sua conta.");
      navigate("/socialsafe/minha-conta");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[hsl(var(--ss-bg))]">
        <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-[hsl(var(--ss-bg))] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-[hsl(var(--ss-muted-fg))] mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-[hsl(var(--ss-foreground))]">Anúncio não encontrado</h2>
          <Button variant="link" onClick={() => navigate("/socialsafe")} className="text-[hsl(var(--ss-primary))]">
            Voltar ao marketplace
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--ss-bg))]">
      {/* Top bar */}
      <header className="sticky top-0 z-50 bg-[hsl(var(--ss-header))] border-b border-[hsl(var(--ss-border))] backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate("/socialsafe")} className="flex items-center gap-2 text-[hsl(var(--ss-muted-fg))] hover:text-[hsl(var(--ss-foreground))] transition">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Voltar</span>
          </button>
          <div className="flex items-center gap-2 ml-auto">
            <div className="w-7 h-7 rounded-lg bg-[hsl(var(--ss-primary))] flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-[hsl(var(--ss-foreground))]">
              Social<span className="text-[hsl(var(--ss-primary))]">Safe</span>
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left - Images + Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Main image */}
            <div className={`rounded-2xl overflow-hidden h-72 bg-gradient-to-br ${getPlatformColor(listing.platform)} flex items-center justify-center relative`}>
              {listing.screenshots && listing.screenshots.length > 0 ? (
                <img src={listing.screenshots[0]} alt={listing.title} className="w-full h-full object-cover" />
              ) : (
                <div className="text-center text-white">
                  <span className="text-6xl block mb-2">
                    {listing.platform === "instagram" ? "📸" : listing.platform === "tiktok" ? "🎵" : "▶️"}
                  </span>
                  <p className="text-white/70 text-sm">{listing.platform}</p>
                </div>
              )}

              {listing.is_verified && (
                <div className="absolute top-4 left-4">
                  <Badge className="bg-[hsl(var(--ss-primary))] text-white font-bold text-xs rounded-full px-3 py-1 border-0">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Verificada SocialSafe
                  </Badge>
                </div>
              )}
            </div>

            {/* Title + Description */}
            <div className="bg-[hsl(var(--ss-card))] rounded-2xl border border-[hsl(var(--ss-border))] p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold text-[hsl(var(--ss-foreground))]">{listing.title}</h1>
                  <p className="text-sm text-[hsl(var(--ss-muted-fg))] mt-1 capitalize">{listing.platform} · {listing.niche || "Sem nicho definido"}</p>
                </div>
                <p className="text-2xl font-bold text-[hsl(var(--ss-primary))] shrink-0">{formatPrice(listing.price)}</p>
              </div>

              {listing.description && (
                <p className="text-sm text-[hsl(var(--ss-muted-fg))] leading-relaxed whitespace-pre-line">{listing.description}</p>
              )}
            </div>

            {/* Metrics */}
            <div className="bg-[hsl(var(--ss-card))] rounded-2xl border border-[hsl(var(--ss-border))] p-6">
              <h3 className="text-sm font-bold text-[hsl(var(--ss-foreground))] mb-4">📊 Métricas da Conta</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center p-3 rounded-xl bg-[hsl(var(--ss-input))]">
                  <p className="text-lg font-bold text-[hsl(var(--ss-foreground))]">{formatFollowers(listing.followers)}</p>
                  <p className="text-[10px] text-[hsl(var(--ss-muted-fg))] mt-0.5">Seguidores</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-[hsl(var(--ss-input))]">
                  <p className="text-lg font-bold text-[hsl(var(--ss-foreground))]">{listing.engagement_rate?.toFixed(1) || "0"}%</p>
                  <p className="text-[10px] text-[hsl(var(--ss-muted-fg))] mt-0.5">Engajamento</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-[hsl(var(--ss-input))]">
                  <p className="text-lg font-bold text-[hsl(var(--ss-foreground))]">{listing.account_age_months ? `${Math.floor(listing.account_age_months / 12)}a` : "N/A"}</p>
                  <p className="text-[10px] text-[hsl(var(--ss-muted-fg))] mt-0.5">Idade da Conta</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-[hsl(var(--ss-input))]">
                  <p className="text-lg font-bold text-[hsl(var(--ss-foreground))]">{listing.views_count}</p>
                  <p className="text-[10px] text-[hsl(var(--ss-muted-fg))] mt-0.5">Visualizações</p>
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="bg-[hsl(var(--ss-card))] rounded-2xl border border-[hsl(var(--ss-border))] p-6">
              <h3 className="text-sm font-bold text-[hsl(var(--ss-foreground))] mb-3">🏷️ Características</h3>
              <div className="flex flex-wrap gap-2">
                {listing.is_verified && (
                  <Badge className="bg-[hsl(var(--ss-primary))]/10 text-[hsl(var(--ss-primary))] border border-[hsl(var(--ss-primary))]/20 rounded-full text-xs">
                    ✓ Verificada
                  </Badge>
                )}
                {listing.is_monetized && (
                  <Badge className="bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-full text-xs">
                    💰 Monetizada
                  </Badge>
                )}
                {listing.has_original_email && (
                  <Badge className="bg-[hsl(var(--ss-secondary))]/10 text-[hsl(var(--ss-secondary))] border border-[hsl(var(--ss-secondary))]/20 rounded-full text-xs">
                    ✉️ Email Original
                  </Badge>
                )}
                <Badge className="bg-[hsl(var(--ss-input))] text-[hsl(var(--ss-foreground))] border border-[hsl(var(--ss-border))] rounded-full text-xs capitalize">
                  {listing.platform}
                </Badge>
                {listing.niche && (
                  <Badge className="bg-[hsl(var(--ss-input))] text-[hsl(var(--ss-foreground))] border border-[hsl(var(--ss-border))] rounded-full text-xs">
                    {listing.niche}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Right - Buy sidebar */}
          <div className="space-y-4">
            {/* Escrow info */}
            <div className="bg-[hsl(var(--ss-card))] rounded-2xl border border-[hsl(var(--ss-border))] p-5 space-y-4 sticky top-20">
              <div className="flex items-center gap-2 p-3 rounded-xl bg-[hsl(var(--ss-primary))]/5 border border-[hsl(var(--ss-primary))]/10">
                <Shield className="w-5 h-5 text-[hsl(var(--ss-primary))]" />
                <div>
                  <p className="text-xs font-bold text-[hsl(var(--ss-primary))]">Escrow Seguro</p>
                  <p className="text-[10px] text-[hsl(var(--ss-muted-fg))]">Seu dinheiro fica protegido até a entrega</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[hsl(var(--ss-muted-fg))]">Valor da conta</span>
                  <span className="font-bold text-[hsl(var(--ss-foreground))]">{formatPrice(listing.price)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[hsl(var(--ss-muted-fg))]">Taxa SocialSafe (15%)</span>
                  <span className="text-[hsl(var(--ss-muted-fg))]">{formatPrice(listing.price * 0.15)}</span>
                </div>
                <hr className="border-[hsl(var(--ss-border))]" />
                <div className="flex justify-between text-sm">
                  <span className="font-bold text-[hsl(var(--ss-foreground))]">Total</span>
                  <span className="font-bold text-[hsl(var(--ss-primary))] text-lg">{formatPrice(listing.price)}</span>
                </div>
              </div>

              <Button
                onClick={handleBuy}
                disabled={buying}
                className="w-full bg-[hsl(var(--ss-primary))] hover:bg-[hsl(var(--ss-primary))]/90 text-white font-bold rounded-xl h-12 text-sm"
              >
                {buying ? "Processando..." : "Comprar com Segurança"}
              </Button>

              <Button
                variant="outline"
                className="w-full border-[hsl(var(--ss-border))] text-[hsl(var(--ss-foreground))] rounded-xl h-10 text-sm"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Enviar Mensagem
              </Button>

              {/* Process steps */}
              <div className="space-y-3 pt-2">
                <p className="text-xs font-bold text-[hsl(var(--ss-foreground))]">Como funciona:</p>
                {[
                  { icon: "1️⃣", text: "Você paga e o valor fica retido" },
                  { icon: "2️⃣", text: "Vendedor envia os dados da conta" },
                  { icon: "3️⃣", text: "Equipe SocialSafe valida a conta" },
                  { icon: "4️⃣", text: "Conta entregue com segurança" },
                  { icon: "5️⃣", text: "Você confirma e o vendedor recebe" },
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-xs">{step.icon}</span>
                    <span className="text-[11px] text-[hsl(var(--ss-muted-fg))]">{step.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
