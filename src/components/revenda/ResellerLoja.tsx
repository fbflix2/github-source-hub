import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";

interface HeroBanner {
  id: string;
  title: string;
  subtitle: string | null;
  cta_text: string | null;
  link_url: string | null;
  image_url: string | null;
  image_style: string | null;
  background_color: string | null;
  category: string | null;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  price_label: string | null;
  image_url: string | null;
  badge_text: string | null;
  badge_color: string | null;
  badge_icon: string | null;
  stock: number;
  available: boolean;
  category_id: string | null;
  tags: string[] | null;
  slug: string | null;
}

interface Props {
  resellerId: string;
  primaryColor?: string | null;
  proxyMultiplier?: number;
  proxyFixedPrice?: number | null;
  bannerOnly?: boolean;
  catalogOnly?: boolean;
}

const proxyPurposes = ["Todos", "Youtube", "Tiktok", "Apostas", "Google Ads", "Contingência", "Web Scraping"];

export function ResellerLoja({ primaryColor, proxyMultiplier = 1, proxyFixedPrice = null, bannerOnly = false, catalogOnly = false }: Props) {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [proxyImages, setProxyImages] = useState<{ name: string; url: string }[]>([]);
  const [banners, setBanners] = useState<HeroBanner[]>([]);
  const [bannerLabels, setBannerLabels] = useState<Record<string, string>>({});
  const [currentBanner, setCurrentBanner] = useState(0);
  const [activePurpose, setActivePurpose] = useState("Todos");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [totalClients, setTotalClients] = useState(3746);

  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => setCurrentBanner((p) => (p + 1) % banners.length), 30000);
    return () => clearInterval(t);
  }, [banners.length]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [productsRes, categoriesRes, proxyImagesRes, bannersRes, bannerCatsRes, countRes] = await Promise.all([
      supabase.from("products").select("*, product_categories!inner(slug)").eq("status", "active").eq("product_categories.slug", "proxy"),
      supabase.from("product_categories").select("id, slug"),
      supabase.from("product_images").select("name, url").eq("category", "proxy"),
      supabase.from("banners").select("*").eq("active", true).order("position", { ascending: true }),
      supabase.from("banner_categories").select("value, label").order("position"),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
    ]);

    if (productsRes.data) setProducts(productsRes.data as any);
    if (proxyImagesRes.data) setProxyImages(proxyImagesRes.data);
    if (bannersRes.data) setBanners(bannersRes.data as any);
    if (bannerCatsRes.data) {
      const map: Record<string, string> = {};
      bannerCatsRes.data.forEach((c: any) => { map[c.value] = c.label; });
      setBannerLabels(map);
    }
    if (countRes.count) setTotalClients(countRes.count);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getProxyImage = (name: string) => proxyImages.find(i => i.name.toLowerCase().trim() === name.toLowerCase().trim())?.url || null;

  const priced = useMemo(() => products.map(p => ({
    ...p,
    price: proxyFixedPrice !== null ? proxyFixedPrice : Number(p.price || 0) * proxyMultiplier,
    image_url: p.image_url || getProxyImage(p.name),
  })), [products, proxyMultiplier, proxyFixedPrice, proxyImages]);

  const filtered = useMemo(() => {
    if (activePurpose === "Todos") return priced;
    const terms = activePurpose === "Apostas" ? ["apostas", "casa de apostas"] : [activePurpose.toLowerCase()];
    return priced.filter(p => (p.tags || []).some(t => {
      const nt = t.toLowerCase();
      return terms.some(term => nt.includes(term));
    }));
  }, [priced, activePurpose]);

  const processedBanners = useMemo(() => banners.map(b => ({
    ...b,
    subtitle: b.subtitle?.replace(/3\.581/g, totalClients.toLocaleString("pt-BR")) || null,
  })), [banners, totalClients]);

  const getQty = (id: string) => quantities[id] || 1;
  const updateQty = (id: string, delta: number, max?: number) => setQuantities(prev => {
    const v = Math.max(1, (prev[id] || 1) + delta);
    return { ...prev, [id]: max ? Math.min(v, max) : v };
  });

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="size-8 text-primary animate-spin" /></div>;
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Rotating banner */}
      {!catalogOnly && processedBanners.length > 0 && (
        <section
          className="relative w-full rounded-2xl overflow-hidden glass-card shadow-glass group transition-colors duration-500 h-[240px] md:h-[300px]"
          style={processedBanners[currentBanner]?.background_color ? { backgroundColor: processedBanners[currentBanner].background_color! } : undefined}
        >
          {processedBanners[currentBanner]?.image_style === "cover" && processedBanners[currentBanner]?.image_url && (
            <div
              className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
              style={{ backgroundImage: `url('${processedBanners[currentBanner].image_url}')` }}
            />
          )}
          {processedBanners[currentBanner]?.image_style === "cover" && (
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-transparent" />
          )}
          {processedBanners[currentBanner]?.image_style !== "cover" && !processedBanners[currentBanner]?.background_color && (
            <>
              <div className="absolute -right-20 -top-20 w-96 h-96 bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
              <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
            </>
          )}
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between p-6 md:p-8 gap-4 h-full">
            <div className="flex-1 space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-primary/20 to-transparent border border-primary/20">
                <span className="animate-pulse w-2 h-2 rounded-full bg-primary" />
                <span className="text-xs font-bold text-primary uppercase tracking-wider">
                  {bannerLabels[processedBanners[currentBanner]?.category || ""] || processedBanners[currentBanner]?.category || "Destaque"}
                </span>
              </div>
              <h2 className={`text-2xl md:text-4xl font-bold leading-tight ${processedBanners[currentBanner]?.image_style === "cover" ? "text-white" : "text-foreground"}`}>
                {processedBanners[currentBanner]?.title}
              </h2>
              {processedBanners[currentBanner]?.subtitle && (
                <p className={`text-sm md:text-base max-w-xl line-clamp-2 ${processedBanners[currentBanner]?.image_style === "cover" ? "text-gray-300" : "text-muted-foreground"}`}>{processedBanners[currentBanner].subtitle}</p>
              )}
              {processedBanners.length > 1 && (
                <div className="flex items-center gap-2 pt-1">
                  <button onClick={() => setCurrentBanner(p => (p - 1 + processedBanners.length) % processedBanners.length)} className="p-2 rounded-lg bg-secondary/60 backdrop-blur border border-border hover:bg-muted transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                  <span className="text-xs text-muted-foreground font-medium">{currentBanner + 1}/{processedBanners.length}</span>
                  <button onClick={() => setCurrentBanner(p => (p + 1) % processedBanners.length)} className="p-2 rounded-lg bg-secondary/60 backdrop-blur border border-border hover:bg-muted transition-colors"><ChevronRight className="w-4 h-4" /></button>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Purpose filter */}
      {!bannerOnly && (
      <section className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">Catálogo de Proxies</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Todos os proxies disponíveis para revenda</p>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mr-2 shrink-0 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/40" />
            Finalidade
          </span>
          {proxyPurposes.map(purpose => (
            <button
              key={purpose}
              onClick={() => setActivePurpose(purpose)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs transition-all border ${
                activePurpose === purpose
                  ? "bg-primary/10 text-primary border-primary font-bold"
                  : "bg-secondary text-muted-foreground border-border hover:border-primary/50 hover:text-primary"
              }`}
            >
              {purpose}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 glass-card rounded-2xl">
            <span className="material-symbols-outlined text-[48px] text-muted-foreground mb-3">inventory_2</span>
            <p className="text-muted-foreground">Nenhum proxy nessa finalidade.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map(product => {
              const stockPercent = product.stock > 0 ? Math.min(100, Math.max(5, (product.stock / (product.stock + 50)) * 100)) : 0;
              const isPromo = (product.tags || []).some(t => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes("promoc"));
              return (
                <article key={product.id} className={`glass-card rounded-2xl overflow-hidden flex flex-col group h-full relative ${isPromo ? "ring-1 ring-red-500/30" : ""}`}>
                  {isPromo && (
                    <div className="absolute top-0 left-0 z-10 overflow-hidden w-24 h-24 pointer-events-none">
                      <div className="absolute top-[10px] left-[-28px] w-[120px] text-center text-[10px] font-extrabold uppercase tracking-wider bg-gradient-to-r from-red-600 to-orange-500 text-white py-1 rotate-[-45deg] shadow-lg shadow-red-500/30">
                        Promoção
                      </div>
                    </div>
                  )}
                  <div className="p-5 flex flex-col flex-1 gap-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border bg-primary/10 text-primary border-primary/20">
                        <span className="material-symbols-outlined text-[11px]">bolt</span>
                        Proxy
                      </span>
                      {product.badge_text && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${product.badge_color || "bg-muted text-foreground border-border"}`}>
                          {product.badge_icon && <span className="material-symbols-outlined text-[11px]">{product.badge_icon}</span>}
                          {product.badge_text}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-secondary flex items-center justify-center">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <span className="material-symbols-outlined text-[22px] text-muted-foreground">dns</span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors leading-tight truncate flex-1 min-w-0">{product.name}</h3>
                      <p className="text-base font-bold text-foreground shrink-0">R$ {Number(product.price).toFixed(2).replace(".", ",")}</p>
                    </div>

                    {product.tags && product.tags.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {product.tags.filter(t => t.toLowerCase() !== "proxyfbflix").slice(0, 4).map(tag => (
                          <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-foreground text-background font-medium">{tag}</span>
                        ))}
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-medium">
                        <span className={`flex items-center gap-1 ${product.stock > 0 ? "text-emerald-500" : "text-muted-foreground"}`}>
                          {product.stock > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                          {product.stock > 0 ? "Disponível" : "Sem estoque"}
                        </span>
                        <span className="text-muted-foreground">{product.stock > 0 ? `${product.stock} em estoque` : ""}</span>
                      </div>
                      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-600" style={{ width: `${stockPercent}%` }} />
                      </div>
                    </div>

                    <div className="mt-auto pt-3 flex items-center gap-2 border-t border-border">
                      <div className="flex items-center bg-secondary rounded-lg border border-border h-8 px-0.5">
                        <button onClick={() => updateQty(product.id, -1, product.stock)} className="w-7 h-full flex items-center justify-center text-muted-foreground hover:text-foreground rounded transition">
                          <span className="material-symbols-outlined text-[14px]">remove</span>
                        </button>
                        <span className="w-6 text-center text-xs font-medium text-foreground">{getQty(product.id)}</span>
                        <button onClick={() => updateQty(product.id, 1, product.stock)} className="w-7 h-full flex items-center justify-center text-muted-foreground hover:text-foreground rounded transition">
                          <span className="material-symbols-outlined text-[14px]">add</span>
                        </button>
                      </div>
                      <button
                        onClick={() => {
                          addItem({ productId: product.id, name: product.name, price: Number(product.price), quantity: getQty(product.id), image: product.image_url || "/placeholder.svg", isProxy: true });
                          toast.success(`${product.name} adicionado ao carrinho!`);
                        }}
                        className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all flex items-center justify-center shrink-0"
                        title="Adicionar ao carrinho"
                      >
                        <span className="material-symbols-outlined text-[16px]">shopping_cart</span>
                      </button>
                      <button
                        onClick={() => navigate(`/checkout?product=${product.id}&qty=${getQty(product.id)}`)}
                        className="flex-1 h-8 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5"
                        style={primaryColor ? { background: primaryColor } : undefined}
                      >
                        <span className="material-symbols-outlined text-[14px]">flash_on</span>
                        Comprar
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      )}
    </div>
  );
}