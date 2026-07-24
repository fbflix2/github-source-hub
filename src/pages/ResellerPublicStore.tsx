import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, Loader2, MessageCircle, ShoppingCart, Zap, LogOut, User as UserIcon, Package } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ResellerPublic {
  id: string;
  slug: string;
  company_name: string;
  brand_name: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  support_whatsapp: string | null;
  support_email: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  about_text: string | null;
  proxy_price_mode: string;
  proxy_price_multiplier: number;
  proxy_fixed_price: number | null;
  status: string;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  badge_text: string | null;
  badge_color: string | null;
  badge_icon: string | null;
  stock: number;
  tags: string[] | null;
}

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

const purposes = ["Todos", "Youtube", "Tiktok", "Apostas", "Google Ads", "Contingência", "Web Scraping"];

export default function ResellerPublicStore() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [loading, setLoading] = useState(true);
  const [reseller, setReseller] = useState<ResellerPublic | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [banners, setBanners] = useState<HeroBanner[]>([]);
  const [proxyImages, setProxyImages] = useState<{ name: string; url: string }[]>([]);
  const [overrides, setOverrides] = useState<Record<string, { custom_price: number; enabled: boolean }>>({});
  const [currentBanner, setCurrentBanner] = useState(0);
  const [activePurpose, setActivePurpose] = useState("Todos");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string | null; full_name: string | null; avatar_url: string | null } | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadUser = async (userId: string, email: string | null) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("user_id", userId)
        .maybeSingle();
      if (!mounted) return;
      setCurrentUser({
        id: userId,
        email,
        full_name: profile?.full_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
      });
    };
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) loadUser(data.session.user.id, data.session.user.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) loadUser(session.user.id, session.user.email ?? null);
      else setCurrentUser(null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    toast.success("Sessão encerrada");
  };

  useEffect(() => {
    if (!slug) return;
    (async () => {
      setLoading(true);
      const { data: rData, error } = await supabase.rpc("get_reseller_public_by_slug", { _slug: slug });
      const r = Array.isArray(rData) ? rData[0] : rData;
      if (error || !r) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setReseller(r as ResellerPublic);

      const [productsRes, imagesRes, bannersRes, ovsRes] = await Promise.all([
        supabase
          .from("products")
          .select("*, product_categories!inner(slug)")
          .eq("status", "active")
          .eq("product_categories.slug", "proxy"),
        supabase.from("product_images").select("name, url").eq("category", "proxy"),
        supabase
          .from("banners")
          .select("*")
          .eq("active", true)
          .eq("reseller_id", r.id)
          .order("position", { ascending: true }),
        supabase
          .from("reseller_price_overrides")
          .select("product_id, custom_price, enabled")
          .eq("reseller_id", r.id),
      ]);

      if (productsRes.data) setProducts(productsRes.data as any);
      if (imagesRes.data) setProxyImages(imagesRes.data);
      if (bannersRes.data) setBanners(bannersRes.data as any);
      if (ovsRes.data) {
        const map: Record<string, { custom_price: number; enabled: boolean }> = {};
        (ovsRes.data as any[]).forEach((o) => {
          map[o.product_id] = { custom_price: Number(o.custom_price), enabled: !!o.enabled };
        });
        setOverrides(map);
      }
      setLoading(false);
    })();
  }, [slug]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => setCurrentBanner((p) => (p + 1) % banners.length), 30000);
    return () => clearInterval(t);
  }, [banners.length]);

  const getProxyImage = (name: string) =>
    proxyImages.find((i) => i.name.toLowerCase().trim() === name.toLowerCase().trim())?.url || null;

  const priced = useMemo(() => {
    if (!reseller) return [];
    return products
      .filter((p) => {
        const o = overrides[p.id];
        return o ? o.enabled : true;
      })
      .map((p) => {
        const basePrice = Number(p.price || 0);
        const override = overrides[p.id];
        const newPrice = override
          ? Number(override.custom_price)
          : reseller.proxy_price_mode === "fixed" && reseller.proxy_fixed_price !== null
            ? Number(reseller.proxy_fixed_price)
            : basePrice * Number(reseller.proxy_price_multiplier || 1);
        return {
          ...p,
          price: newPrice,
          image_url: p.image_url || getProxyImage(p.name),
        };
      });
  }, [products, reseller, proxyImages, overrides]);

  const filtered = useMemo(() => {
    if (activePurpose === "Todos") return priced;
    const terms = activePurpose === "Apostas" ? ["apostas", "casa de apostas"] : [activePurpose.toLowerCase()];
    return priced.filter((p) =>
      (p.tags || []).some((t) => {
        const nt = t.toLowerCase();
        return terms.some((term) => nt.includes(term));
      })
    );
  }, [priced, activePurpose]);

  const getQty = (id: string) => quantities[id] || 1;
  const updateQty = (id: string, delta: number, max?: number) =>
    setQuantities((prev) => {
      const v = Math.max(1, (prev[id] || 1) + delta);
      return { ...prev, [id]: max ? Math.min(v, max) : v };
    });

  // Update <title> and favicon based on reseller
  useEffect(() => {
    if (!reseller) return;
    const prevTitle = document.title;
    document.title = `${reseller.brand_name || reseller.company_name} — Proxies Premium`;
    let favEl: HTMLLinkElement | null = null;
    if (reseller.favicon_url) {
      favEl = document.createElement("link");
      favEl.rel = "icon";
      favEl.href = reseller.favicon_url;
      document.head.appendChild(favEl);
    }
    return () => {
      document.title = prevTitle;
      if (favEl) document.head.removeChild(favEl);
    };
  }, [reseller]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="size-8 text-primary animate-spin" />
      </div>
    );
  }

  if (notFound || !reseller) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h1 className="text-3xl font-bold text-foreground mb-2">Loja não encontrada</h1>
          <p className="text-muted-foreground">
            A loja "{slug}" não existe ou está temporariamente indisponível.
          </p>
        </div>
      </div>
    );
  }

  const brandName = reseller.brand_name || reseller.company_name;
  const primaryColor = reseller.primary_color || "#22c55e";
  const heroTitle = reseller.hero_title || `Bem-vindo à ${brandName}`;
  const heroSubtitle = reseller.hero_subtitle || "Proxies residenciais premium para seu negócio";

  const openWhatsApp = () => {
    if (!reseller.support_whatsapp) return;
    const num = reseller.support_whatsapp.replace(/\D/g, "");
    window.open(`https://wa.me/${num}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-lg bg-background/80 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {reseller.logo_url ? (
              <img src={reseller.logo_url} alt={brandName} className="h-10 w-10 rounded-lg object-cover" />
            ) : (
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                style={{ background: primaryColor }}
              >
                {brandName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="font-bold text-foreground text-sm md:text-base">{brandName}</h1>
              <p className="text-[10px] text-muted-foreground">Proxies Residenciais</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {reseller.support_whatsapp && (
              <button
                onClick={openWhatsApp}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20 transition text-xs font-bold"
              >
                <MessageCircle className="size-4" /> WhatsApp
              </button>
            )}
            {currentUser ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-border hover:bg-muted transition"
                  >
                    {currentUser.avatar_url ? (
                      <img src={currentUser.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <div
                        className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                        style={{ background: primaryColor }}
                      >
                        {(currentUser.full_name || currentUser.email || "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="hidden sm:inline text-xs font-semibold text-foreground max-w-[120px] truncate">
                      {currentUser.full_name || currentUser.email?.split("@")[0] || "Minha conta"}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="truncate">
                    {currentUser.full_name || currentUser.email}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/perfil")}>
                    <UserIcon className="size-4 mr-2" /> Meu Perfil
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/orders")}>
                    <Package className="size-4 mr-2" /> Meus Pedidos
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-red-500 focus:text-red-500">
                    <LogOut className="size-4 mr-2" /> Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <button
                onClick={() => navigate("/auth")}
                className="px-4 py-2 rounded-lg text-white text-xs font-bold transition hover:opacity-90"
                style={{ background: primaryColor }}
              >
                Entrar
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Hero */}
        <section className="glass-card rounded-2xl p-6 md:p-10 relative overflow-hidden">
          <div
            className="absolute -right-20 -top-20 w-96 h-96 rounded-full blur-[100px] pointer-events-none opacity-30"
            style={{ background: primaryColor }}
          />
          <div className="relative z-10 max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border" style={{ borderColor: `${primaryColor}40`, background: `${primaryColor}20` }}>
              <span className="animate-pulse w-2 h-2 rounded-full" style={{ background: primaryColor }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: primaryColor }}>Loja Oficial</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold text-foreground leading-tight">{heroTitle}</h2>
            <p className="text-base md:text-lg text-muted-foreground">{heroSubtitle}</p>
          </div>
        </section>

        {/* Rotating banners */}
        {banners.length > 0 && (
          <section
            className="relative w-full rounded-2xl overflow-hidden glass-card group transition-colors duration-500 h-[220px] md:h-[280px]"
            style={banners[currentBanner]?.background_color ? { backgroundColor: banners[currentBanner].background_color! } : undefined}
          >
            {banners[currentBanner]?.image_style === "cover" && banners[currentBanner]?.image_url && (
              <>
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${banners[currentBanner].image_url}')` }} />
                <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-transparent" />
              </>
            )}
            <div className="relative z-10 flex flex-col justify-center p-6 md:p-8 h-full">
              <h3 className={`text-2xl md:text-4xl font-bold leading-tight ${banners[currentBanner]?.image_style === "cover" ? "text-white" : "text-foreground"}`}>
                {banners[currentBanner]?.title}
              </h3>
              {banners[currentBanner]?.subtitle && (
                <p className={`text-sm md:text-base mt-2 max-w-xl ${banners[currentBanner]?.image_style === "cover" ? "text-gray-300" : "text-muted-foreground"}`}>
                  {banners[currentBanner].subtitle}
                </p>
              )}
              {banners.length > 1 && (
                <div className="flex items-center gap-2 pt-3">
                  <button onClick={() => setCurrentBanner((p) => (p - 1 + banners.length) % banners.length)} className="p-2 rounded-lg bg-secondary/60 backdrop-blur border border-border">
                    <ChevronLeft className="size-4" />
                  </button>
                  <span className="text-xs text-muted-foreground font-medium">{currentBanner + 1}/{banners.length}</span>
                  <button onClick={() => setCurrentBanner((p) => (p + 1) % banners.length)} className="p-2 rounded-lg bg-secondary/60 backdrop-blur border border-border">
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Filtro */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mr-2 shrink-0">
            Finalidade
          </span>
          {purposes.map((p) => (
            <button
              key={p}
              onClick={() => setActivePurpose(p)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs transition-all border ${
                activePurpose === p
                  ? "text-white font-bold"
                  : "bg-secondary text-muted-foreground border-border hover:text-foreground"
              }`}
              style={activePurpose === p ? { background: primaryColor, borderColor: primaryColor } : undefined}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Catálogo */}
        <section>
          <div className="mb-4">
            <h2 className="text-xl font-bold text-foreground">Catálogo de Proxies</h2>
            <p className="text-xs text-muted-foreground">Proxies residenciais premium para todas as finalidades</p>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-16 glass-card rounded-2xl">
              <p className="text-muted-foreground">Nenhum proxy nessa finalidade.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filtered.map((product) => {
                const stockPercent = product.stock > 0 ? Math.min(100, Math.max(5, (product.stock / (product.stock + 50)) * 100)) : 0;
                return (
                  <article key={product.id} className="glass-card rounded-2xl overflow-hidden flex flex-col group h-full">
                    <div className="p-5 flex flex-col flex-1 gap-3">
                      <div className="flex items-center gap-3">
                        <div className="shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-secondary flex items-center justify-center">
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <span className="material-symbols-outlined text-[22px] text-muted-foreground">dns</span>
                          )}
                        </div>
                        <h3 className="text-sm font-bold text-foreground leading-tight truncate flex-1">{product.name}</h3>
                        <p className="text-base font-bold text-foreground shrink-0">R$ {Number(product.price).toFixed(2).replace(".", ",")}</p>
                      </div>

                      {product.tags && product.tags.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {product.tags.filter((t) => t.toLowerCase() !== "proxyfbflix").slice(0, 4).map((tag) => (
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
                        </div>
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-600" style={{ width: `${stockPercent}%` }} />
                        </div>
                      </div>

                      <div className="mt-auto pt-3 flex items-center gap-2 border-t border-border">
                        <div className="flex items-center bg-secondary rounded-lg border border-border h-8 px-0.5">
                          <button onClick={() => updateQty(product.id, -1, product.stock)} className="w-7 h-full flex items-center justify-center text-muted-foreground hover:text-foreground">
                            <span className="material-symbols-outlined text-[14px]">remove</span>
                          </button>
                          <span className="w-6 text-center text-xs font-medium text-foreground">{getQty(product.id)}</span>
                          <button onClick={() => updateQty(product.id, 1, product.stock)} className="w-7 h-full flex items-center justify-center text-muted-foreground hover:text-foreground">
                            <span className="material-symbols-outlined text-[14px]">add</span>
                          </button>
                        </div>
                        <button
                          onClick={() => {
                            addItem({
                              productId: product.id,
                              name: product.name,
                              price: Number(product.price),
                              quantity: getQty(product.id),
                              image: product.image_url || "/placeholder.svg",
                              isProxy: true,
                            });
                            toast.success(`${product.name} adicionado!`);
                          }}
                          className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground flex items-center justify-center shrink-0"
                          disabled={product.stock === 0}
                        >
                          <ShoppingCart className="size-4" />
                        </button>
                        <button
                          onClick={() => navigate(`/auth?redirect=/checkout&product=${product.id}&qty=${getQty(product.id)}&r=${reseller.slug}`)}
                          className="flex-1 h-8 text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 hover:opacity-90"
                          style={{ background: primaryColor }}
                          disabled={product.stock === 0}
                        >
                          <Zap className="size-3.5" /> Comprar
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {reseller.about_text && (
          <section className="glass-card rounded-2xl p-6 md:p-8">
            <h3 className="text-lg font-bold text-foreground mb-3">Sobre a {brandName}</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{reseller.about_text}</p>
          </section>
        )}

        <footer className="text-center py-8 border-t border-border">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {brandName}. Todos os direitos reservados.
          </p>
        </footer>
      </main>
    </div>
  );
}