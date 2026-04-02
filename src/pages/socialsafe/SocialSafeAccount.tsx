import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Shield, ArrowLeft, Package, ShoppingBag, Star, Heart, Plus, Clock, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

function formatPrice(n: number) {
  return `R$ ${n.toFixed(2).replace(".", ",")}`;
}

function getStatusInfo(status: string) {
  switch (status) {
    case "pending_payment": return { label: "Aguardando Pagamento", color: "text-amber-500", icon: Clock };
    case "in_escrow": return { label: "Em Intermediação", color: "text-[hsl(var(--ss-secondary))]", icon: Shield };
    case "validating": return { label: "Em Validação", color: "text-purple-400", icon: Clock };
    case "validated": return { label: "Validado", color: "text-[hsl(var(--ss-primary))]", icon: CheckCircle2 };
    case "delivered": return { label: "Entregue", color: "text-[hsl(var(--ss-primary))]", icon: CheckCircle2 };
    case "completed": return { label: "Finalizado", color: "text-[hsl(var(--ss-primary))]", icon: CheckCircle2 };
    case "disputed": return { label: "Em Disputa", color: "text-red-500", icon: AlertTriangle };
    case "cancelled": return { label: "Cancelado", color: "text-[hsl(var(--ss-muted-fg))]", icon: XCircle };
    default: return { label: status, color: "text-[hsl(var(--ss-muted-fg))]", icon: Clock };
  }
}

export default function SocialSafeAccount() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [myListings, setMyListings] = useState<any[]>([]);
  const [myBuys, setMyBuys] = useState<any[]>([]);
  const [mySales, setMySales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    setLoading(true);

    const [listings, buys, sales] = await Promise.all([
      supabase.from("ss_listings").select("*").eq("seller_id", user.id).order("created_at", { ascending: false }),
      supabase.from("ss_transactions").select("*, ss_listings(title, platform, price)").eq("buyer_id", user.id).order("created_at", { ascending: false }),
      supabase.from("ss_transactions").select("*, ss_listings(title, platform, price)").eq("seller_id", user.id).order("created_at", { ascending: false }),
    ]);

    setMyListings((listings.data as any[]) || []);
    setMyBuys((buys.data as any[]) || []);
    setMySales((sales.data as any[]) || []);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--ss-bg))]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[hsl(var(--ss-header))] border-b border-[hsl(var(--ss-border))] backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate("/socialsafe")} className="flex items-center gap-2 text-[hsl(var(--ss-muted-fg))] hover:text-[hsl(var(--ss-foreground))] transition">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Marketplace</span>
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
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[hsl(var(--ss-foreground))]">Minha Conta</h1>
          <Button
            onClick={() => navigate("/socialsafe/criar-anuncio")}
            className="bg-[hsl(var(--ss-primary))] hover:bg-[hsl(var(--ss-primary))]/90 text-white rounded-full text-xs font-semibold"
          >
            <Plus className="w-4 h-4 mr-1" /> Novo Anúncio
          </Button>
        </div>

        <Tabs defaultValue="listings" className="space-y-6">
          <TabsList className="bg-[hsl(var(--ss-card))] border border-[hsl(var(--ss-border))] rounded-full p-1">
            <TabsTrigger value="listings" className="rounded-full text-xs data-[state=active]:bg-[hsl(var(--ss-primary))] data-[state=active]:text-white">
              <Package className="w-3.5 h-3.5 mr-1.5" /> Meus Anúncios ({myListings.length})
            </TabsTrigger>
            <TabsTrigger value="purchases" className="rounded-full text-xs data-[state=active]:bg-[hsl(var(--ss-primary))] data-[state=active]:text-white">
              <ShoppingBag className="w-3.5 h-3.5 mr-1.5" /> Compras ({myBuys.length})
            </TabsTrigger>
            <TabsTrigger value="sales" className="rounded-full text-xs data-[state=active]:bg-[hsl(var(--ss-primary))] data-[state=active]:text-white">
              <Star className="w-3.5 h-3.5 mr-1.5" /> Vendas ({mySales.length})
            </TabsTrigger>
          </TabsList>

          {/* Listings */}
          <TabsContent value="listings" className="space-y-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
            ) : myListings.length === 0 ? (
              <div className="text-center py-12 bg-[hsl(var(--ss-card))] rounded-2xl border border-[hsl(var(--ss-border))]">
                <Package className="w-10 h-10 text-[hsl(var(--ss-muted-fg))] mx-auto mb-3" />
                <p className="text-sm text-[hsl(var(--ss-muted-fg))]">Você ainda não tem anúncios.</p>
                <Button onClick={() => navigate("/socialsafe/criar-anuncio")} className="mt-4 bg-[hsl(var(--ss-primary))] text-white rounded-full text-xs">
                  Criar Primeiro Anúncio
                </Button>
              </div>
            ) : (
              myListings.map(l => (
                <div
                  key={l.id}
                  onClick={() => navigate(`/socialsafe/anuncio/${l.id}`)}
                  className="bg-[hsl(var(--ss-card))] rounded-xl border border-[hsl(var(--ss-border))] p-4 flex items-center gap-4 cursor-pointer hover:border-[hsl(var(--ss-primary))]/40 transition"
                >
                  <div className="w-12 h-12 rounded-lg bg-[hsl(var(--ss-input))] flex items-center justify-center text-xl">
                    {l.platform === "instagram" ? "📸" : l.platform === "tiktok" ? "🎵" : "▶️"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-[hsl(var(--ss-foreground))] truncate">{l.title}</h3>
                    <p className="text-xs text-[hsl(var(--ss-muted-fg))]">{l.followers.toLocaleString()} seguidores · {l.platform}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-[hsl(var(--ss-primary))]">{formatPrice(l.price)}</p>
                    <Badge variant="outline" className={`text-[10px] rounded-full mt-1 ${l.status === "published" ? "text-[hsl(var(--ss-primary))] border-[hsl(var(--ss-primary))]/30" : "text-[hsl(var(--ss-muted-fg))]"}`}>
                      {l.status === "published" ? "Ativo" : l.status === "draft" ? "Rascunho" : l.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          {/* Purchases */}
          <TabsContent value="purchases" className="space-y-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
            ) : myBuys.length === 0 ? (
              <div className="text-center py-12 bg-[hsl(var(--ss-card))] rounded-2xl border border-[hsl(var(--ss-border))]">
                <ShoppingBag className="w-10 h-10 text-[hsl(var(--ss-muted-fg))] mx-auto mb-3" />
                <p className="text-sm text-[hsl(var(--ss-muted-fg))]">Nenhuma compra ainda.</p>
                <Button onClick={() => navigate("/socialsafe")} className="mt-4 bg-[hsl(var(--ss-primary))] text-white rounded-full text-xs">
                  Explorar Marketplace
                </Button>
              </div>
            ) : (
              myBuys.map(tx => {
                const info = getStatusInfo(tx.status);
                const Icon = info.icon;
                return (
                  <div key={tx.id} className="bg-[hsl(var(--ss-card))] rounded-xl border border-[hsl(var(--ss-border))] p-4 flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-[hsl(var(--ss-input))]`}>
                      <Icon className={`w-5 h-5 ${info.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-[hsl(var(--ss-foreground))] truncate">{tx.ss_listings?.title || "Anúncio"}</h3>
                      <p className={`text-xs font-medium ${info.color}`}>{info.label}</p>
                    </div>
                    <p className="text-sm font-bold text-[hsl(var(--ss-foreground))] shrink-0">{formatPrice(tx.amount)}</p>
                  </div>
                );
              })
            )}
          </TabsContent>

          {/* Sales */}
          <TabsContent value="sales" className="space-y-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
            ) : mySales.length === 0 ? (
              <div className="text-center py-12 bg-[hsl(var(--ss-card))] rounded-2xl border border-[hsl(var(--ss-border))]">
                <Star className="w-10 h-10 text-[hsl(var(--ss-muted-fg))] mx-auto mb-3" />
                <p className="text-sm text-[hsl(var(--ss-muted-fg))]">Nenhuma venda ainda.</p>
              </div>
            ) : (
              mySales.map(tx => {
                const info = getStatusInfo(tx.status);
                const Icon = info.icon;
                return (
                  <div key={tx.id} className="bg-[hsl(var(--ss-card))] rounded-xl border border-[hsl(var(--ss-border))] p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[hsl(var(--ss-input))]">
                      <Icon className={`w-5 h-5 ${info.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-[hsl(var(--ss-foreground))] truncate">{tx.ss_listings?.title || "Anúncio"}</h3>
                      <p className={`text-xs font-medium ${info.color}`}>{info.label}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-[hsl(var(--ss-foreground))]">{formatPrice(tx.amount)}</p>
                      <p className="text-[10px] text-[hsl(var(--ss-muted-fg))]">Taxa: {formatPrice(tx.platform_fee)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
