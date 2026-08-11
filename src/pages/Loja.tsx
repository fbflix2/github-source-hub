import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useClientCount, applyClientCount } from "@/hooks/useClientCount";
import { Loader2, LayoutGrid, List, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { ProductListItem } from "@/components/loja/ProductListItem";
import { ProductDetailModal } from "@/components/loja/ProductDetailModal";
import { ProxyProductCard } from "@/components/loja/ProxyProductCard";
import { useProxyBRProducts } from "@/hooks/useProxyBR";
import { Skeleton } from "@/components/ui/skeleton";
import { LojaLayoutV2 } from "@/components/loja/LojaLayoutV2";
import { useStoreLayoutV2 } from "@/hooks/useStoreLayout";

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
  kind?: string | null;
  badge_text?: string | null;
  accent_color?: string | null;
  image_zoom?: number | null;
  image_pos_x?: number | null;
  image_pos_y?: number | null;
}

interface ProxyImage {
  name: string;
  url: string;
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
  external_id?: string | null;
  slug?: string | null;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addItem } = useCart();
  const initialFilter = searchParams.get("filter") || "Todos";
  const [activeFilter, setActiveFilter] = useState(initialFilter);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [inactiveProxyExternalIds, setInactiveProxyExternalIds] = useState<Set<string>>(new Set());
  const [categories, setCategories] = useState<(Category & { restricted_to?: string[] | null })[]>([]);
  const [activePurpose, setActivePurpose] = useState("Todos");
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    setActivePurpose("Todos");
  }, [activeFilter]);

  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
   const { data: proxyProductsData, isLoading: proxyLoading, error: proxyError } = useProxyBRProducts();
   
  const [proxyQuantities, setProxyQuantities] = useState<Record<string, number>>({});
  const [proxyImages, setProxyImages] = useState<ProxyImage[]>([]);
  const [heroBanners, setHeroBanners] = useState<HeroBanner[]>([]);
  const [subBanners, setSubBanners] = useState<HeroBanner[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentBanner, setCurrentBanner] = useState(0);
  const [bannerCategoryLabels, setBannerCategoryLabels] = useState<Record<string, string>>({});
  const totalClients = useClientCount(3746);
  const { layoutV2, headline, headlineVisible, layoutRev } = useStoreLayoutV2();
  const [legacyLayout, setLegacyLayout] = useState<boolean>(() => {
    try { return localStorage.getItem("store_layout_legacy") === "1"; } catch { return false; }
  });

  // Quando o admin altera o layout, a preferência local antiga é descartada
  useEffect(() => {
    try {
      const savedRev = localStorage.getItem("store_layout_legacy_rev") || "0";
      if (savedRev !== layoutRev) {
        localStorage.setItem("store_layout_legacy", "0");
        localStorage.setItem("store_layout_legacy_rev", layoutRev);
        setLegacyLayout(false);
      }
    } catch { /* noop */ }
  }, [layoutRev]);

  useEffect(() => {
    let cancelled = false;
    const mainHosts = ["fbflix.com.br", "www.fbflix.com.br", "fbflix1.lovable.app", "localhost"];
    const host = window.location.hostname.toLowerCase();
    const isMainHost =
      mainHosts.includes(host) ||
      host.endsWith(".lovableproject.com") ||
      host.endsWith(".lovable.app");

    if (isMainHost) return;

    supabase.rpc("get_reseller_slug_by_domain", { _domain: host }).then(({ data: slug }) => {
      if (!cancelled && slug) navigate(`/r/${slug as string}`, { replace: true });
    });

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  // Auto-slide banners every 6 seconds
  useEffect(() => {
    if (heroBanners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentBanner((p) => (p + 1) % heroBanners.length);
    }, 30000);
    return () => clearInterval(interval);
  }, [heroBanners.length]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    const [productsRes, categoriesRes, proxyImagesRes, bannersRes, bannerCatsRes, inactiveProxiesRes, profileRes] = await Promise.all([
      supabase.from("products").select("*").eq("status", "active").order("created_at", { ascending: false }),
      supabase.from("product_categories").select("*"),
      supabase.from("product_images").select("name, url").eq("category", "proxy"),
      supabase.from("banners").select("*").eq("active", true).or("audience.eq.store,audience.is.null").order("position", { ascending: true }),
      supabase.from("banner_categories").select("value, label").order("position"),
      // Fetch inactive proxy products to hide them from API results
      supabase.from("products").select("external_id").neq("status", "active").not("external_id", "is", null),
      user ? supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    ]);

    if (productsRes.data) setProducts(productsRes.data);
    if (categoriesRes.data) {
      const userDept = profileRes.data?.department;
      const filteredCats = categoriesRes.data.filter((cat: any) => {
        if (!cat.restricted_to || cat.restricted_to.length === 0) return true;
        if (!userDept) return false;
        return cat.restricted_to.some((dept: string) => dept.toLowerCase().trim() === userDept.toLowerCase().trim());
      });
      setCategories(filteredCats);
    }
    if (proxyImagesRes.data) setProxyImages(proxyImagesRes.data);
    if (bannersRes.data) {
      const all = bannersRes.data as any[];
      setHeroBanners(all.filter((b) => (b.kind || "hero") !== "sub"));
      setSubBanners(all.filter((b) => b.kind === "sub"));
    }
    if (bannerCatsRes.data) {
      const map: Record<string, string> = {};
      bannerCatsRes.data.forEach((c: any) => { map[c.value] = c.label; });
      setBannerCategoryLabels(map);
    }
    if (inactiveProxiesRes.data) {
      setInactiveProxyExternalIds(new Set(inactiveProxiesRes.data.map((p: any) => p.external_id).filter(Boolean)));
    }
    if (profileRes.data) setUserProfile(profileRes.data);
    setLoading(false);
  }, []);

  // Refetch every time the page is visited or becomes visible
  useEffect(() => {
    fetchData();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") fetchData();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [fetchData]);

   const rawProxyProductsData = useMemo(() => {
     // ProxyBR desativado: vendemos apenas proxies internos FBFlix.
     return [] as any[];
   }, [proxyProductsData, inactiveProxyExternalIds]);

  const getProxyQty = (id: string) => proxyQuantities[id] || 1;
  const updateProxyQty = (id: string, delta: number) => {
    setProxyQuantities((prev) => ({
      ...prev,
      [id]: Math.max(1, (prev[id] || 1) + delta),
    }));
  };

  const getProxyImage = (productName: string): string | null => {
    const match = proxyImages.find(
      (img) => img.name.toLowerCase().trim() === productName.toLowerCase().trim()
    );
    return match?.url || null;
  };

  const isProxyFilter = activeFilter === "Proxy";
   const showProxiesInAll = activeFilter === "Todos" && !proxyLoading && rawProxyProductsData.length > 0;

  const proxyCategoryId = categories.find((c) => c.slug === "proxy")?.id;
  const localProxyProducts = proxyCategoryId ? products.filter((p) => p.category_id === proxyCategoryId) : [];
  const normalizeStr = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
   const getLocalProxyData = useCallback((apiProduct: any) => {
    const apiId = String(apiProduct.id);
    const apiName = apiProduct.name || "";
    // Match ONLY by external_id. Do NOT match by name to avoid accidental
    // routing of local fbflix proxies to ProxyBR fulfillment.
    const match = localProxyProducts.find(
      (p) => p.external_id === apiId
    );
    if (match) {
      console.log(`[ProxyMatch] API id=${apiId} → local id=${match.id}, price=${match.price}, tags=${JSON.stringify(match.tags)}, desc=${match.description?.substring(0, 30)}`);
    } else {
      console.log(`[ProxyMatch] API id=${apiId} name="${apiName}" → NO MATCH. localProxyProducts:`, localProxyProducts.map(p => ({ id: p.id, ext: p.external_id, name: p.name })));
    }
     return match || null;
   }, [localProxyProducts]);

  const filters = ["Todos", ...categories.filter((c) => c.slug !== "proxy").map((c) => c.name), "Proxy"];

   const proxyProducts = useMemo(() => [...rawProxyProductsData].sort((a, b) => {
    const localA = getLocalProxyData(a);
    const localB = getLocalProxyData(b);
    
    const getCheapestPrice = (p: any, local: any) => {
      if (local?.price != null && local.price > 0) return local.price;
      const variants = p.variant || p.variants?.data || p.variants || [];
      if (variants.length > 0) {
        return Math.min(...variants.map((v: any) => v.price || 0));
      }
      return p.price || 0;
    };
    
     return getCheapestPrice(a, localA) - getCheapestPrice(b, localB);
   }), [rawProxyProductsData, getLocalProxyData]);

  // Local proxy products should show alongside regular products and in Proxy filter
   const isLocalProxy = useCallback((p: Product) => p.category_id === proxyCategoryId, [proxyCategoryId]);
   const proxyfbflixLocalProducts = useMemo(() => products.filter(isLocalProxy), [products, isLocalProxy]);

    const fbPurposes = ["Todos", "Black", "White", "Marketplace"];

    const apiProxyAsProducts: Product[] = useMemo(() => {
      const multiplier = Number(userProfile?.proxy_price_multiplier ?? 1) || 1;
      const fixedPrice = userProfile?.proxy_fixed_price ? Number(userProfile.proxy_fixed_price) : null;
      const base = proxyProducts.map((p: any) => {
        const local = getLocalProxyData(p);
        const variants = p.variant || p.variants?.data || p.variants || [];
        const cheapestVariant = variants.length
          ? variants.reduce((min: any, v: any) => ((v.price || 0) < (min.price || 0) ? v : min), variants[0])
          : null;
        const price = (local?.price != null && local.price > 0) ? local.price : (cheapestVariant?.price || p.price || 0);
        const totalApiStock = variants.reduce((sum: number, v: any) => sum + (v.stocks ?? 0), 0);
        return {
          id: local?.id || String(p.id),
          name: local?.name || p.name,
          description: local?.description || p.description || null,
          price: fixedPrice !== null ? fixedPrice : Number(price) * multiplier,
          price_label: "mensal",
          image_url: local?.image_url || getProxyImage(p.name),
          badge_text: local?.badge_text || null,
          badge_color: local?.badge_color || null,
          badge_icon: local?.badge_icon || null,
          stock: totalApiStock > 0 ? totalApiStock : (local?.stock ?? 0),
          available: local ? local.available : true,
          category_id: proxyCategoryId || null,
          tags: local?.tags || null,
          slug: local?.slug || null,
          icon_type: 'proxy',
        };
      }).filter(p => p.available);

      // Ocultar proxies se não estiver no filtro de Proxy e o filtro atual não for "Todos"
      // OU se houver uma finalidade de Facebook selecionada (Black, White, Marketplace)
      const isFBFilter = activeFilter === "Perfis" || activeFilter === "Bm";
      const isFBPurpose = activePurpose !== "Todos" && fbPurposes.includes(activePurpose);
      
      if (activeFilter === "Perfis" || activeFilter === "Bm") {
        return [];
      }

      if (activeFilter !== "Proxy" && isFBPurpose) {
        return [];
      }
      return base;
    }, [proxyProducts, getLocalProxyData, proxyCategoryId, proxyImages, activeFilter, activePurpose, userProfile]);

    const proxyPurposes = ["Todos", "Youtube", "Tiktok", "Apostas", "Google Ads", "Contingência", "Web Scraping"];

    const standaloneLocalProxies = useMemo(() => {
      const matchedLocalIds = new Set(apiProxyAsProducts.map(p => p.id));
      const multiplier = Number(userProfile?.proxy_price_multiplier ?? 1) || 1;
      const fixedPrice = userProfile?.proxy_fixed_price ? Number(userProfile.proxy_fixed_price) : null;
      return proxyfbflixLocalProducts
        .filter(p => !matchedLocalIds.has(p.id))
        .map(p => ({ ...p, price: fixedPrice !== null ? fixedPrice : Number(p.price || 0) * multiplier }));
    }, [apiProxyAsProducts, proxyfbflixLocalProducts, userProfile]);

    const allPurposes = useMemo(() => {
      if (activeFilter === "Proxy") return proxyPurposes;
      if (activeFilter === "Bm") return fbPurposes.filter(p => p !== "Marketplace");
      if (activeFilter === "Perfis") return fbPurposes;
      return ["Todos"];
    }, [activeFilter, fbPurposes]);

    const proxyAsProducts = useMemo(() => {
      if (activeFilter === "Perfis" || activeFilter === "Bm") {
        return [];
      }
      
      return [...apiProxyAsProducts, ...standaloneLocalProxies]
    .filter(p => {
      if (activePurpose === "Todos") return true;
      const tags = p.tags || [];
      const searchTerms = activePurpose === "Apostas" ? ["apostas", "casa de apostas"] : [activePurpose.toLowerCase()];
      return tags.some(t => {
        const nt = t.toLowerCase();
        return searchTerms.some(term => nt.includes(term));
      });
    })
     .sort((a, b) => (a.price || 0) - (b.price || 0));
    }, [apiProxyAsProducts, standaloneLocalProxies, activePurpose, activeFilter]);

  console.log("[Loja] proxyCategoryId:", proxyCategoryId, "proxyfbflixLocalProducts:", proxyfbflixLocalProducts.map(p => p.name), "total products:", products.length);

   const filteredProducts = useMemo(() => {
     const proxyMultiplier = Number(userProfile?.proxy_price_multiplier ?? 1) || 1;
     const proxyFixedPrice = userProfile?.proxy_fixed_price ? Number(userProfile.proxy_fixed_price) : null;
     let base = activeFilter === "Todos"
       ? products.filter((p) => p.category_id !== proxyCategoryId || isLocalProxy(p))
       : products.filter((p) => {
           const cat = categories.find((c) => c.name === activeFilter);
           return cat && p.category_id === cat.id;
         });

      if (activePurpose !== "Todos") {
        const searchTerms = activePurpose === "Apostas" ? ["apostas", "casa de apostas"] : [activePurpose.toLowerCase()];
        base = base.filter(p => {
          // Se for White e o produto for BM, mas não tiver a tag "black", tratamos como White por padrão
          const isBM = categories.find(c => c.id === p.category_id)?.slug === "bm";
          const tags = (p.tags || []).map(t => t.toLowerCase());
          
          if (activePurpose === "White" && isBM) {
            return !tags.includes("black");
          }

          return tags.some(t => {
            return searchTerms.some(term => t.includes(term));
          });
        });
      }
     if (proxyFixedPrice !== null || proxyMultiplier !== 1) {
       base = base.map(p => isLocalProxy(p) ? { ...p, price: proxyFixedPrice !== null ? proxyFixedPrice : Number(p.price || 0) * proxyMultiplier } : p);
     }
     return base;
   }, [activeFilter, products, proxyCategoryId, categories, isLocalProxy, activePurpose, userProfile]);

  // Priority order for "Todos": Perfis → BM → Proxy → rest
   const getCategoryPriority = useCallback((product: Product) => {
    const cat = categories.find((c) => c.id === product.category_id);
    const slug = cat?.slug?.toLowerCase() || "";
    const name = cat?.name?.toLowerCase() || "";
    if (slug === "perfis" || name === "perfis") return 0;
    if (slug === "bm" || name === "bm") return 1;
    if (slug === "proxy" || name === "proxy") return 2;
     return 3;
   }, [categories]);

   const allProducts = useMemo(() => {
     const base = (activeFilter === "Todos"
       ? (showProxiesInAll ? [...filteredProducts, ...proxyAsProducts] : filteredProducts)
       : activeFilter === "Proxy"
       ? proxyAsProducts
       : filteredProducts
     );
     const q = searchQuery.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
     const searched = !q ? base : base.filter((p: any) => {
       const cat = categories.find((c) => c.id === p.category_id);
       const haystack = [p.name, p.description, cat?.name, cat?.slug, ...(p.tags || [])]
         .filter(Boolean)
         .join(" ")
         .toLowerCase()
         .normalize("NFD")
         .replace(/[\u0300-\u036f]/g, "");
       return q.split(/\s+/).every((term) => haystack.includes(term));
     });
     return [...searched].sort((a, b) => {
    // Sold out items always go last
    const outA = !a.available || (a.stock || 0) === 0 ? 1 : 0;
    const outB = !b.available || (b.stock || 0) === 0 ? 1 : 0;
    if (outA !== outB) return outA - outB;

    // First by priority if in "Todos"
    if (activeFilter === "Todos") {
      const priorityA = getCategoryPriority(a);
      const priorityB = getCategoryPriority(b);
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
    }
    
    // Then by price ascending (cheapest first)
      return (a.price || 0) - (b.price || 0);
     });
   }, [activeFilter, showProxiesInAll, filteredProducts, proxyAsProducts, getCategoryPriority, searchQuery, categories]);

  const getQuantity = (id: string) => quantities[id] || 1;

  const updateQuantity = (id: string, delta: number, maxStock?: number) => {
    setQuantities((prev) => {
      const newVal = Math.max(1, (prev[id] || 1) + delta);
      return {
        ...prev,
        [id]: maxStock ? Math.min(newVal, maxStock) : newVal,
      };
    });
  };

  const getStockInfo = (product: Product) => {
    if (!product.available || product.stock === 0) {
      return { status: "Sem estoque", statusColor: "text-muted-foreground", percentage: 0, sold: "Avise-me" };
    }
    if (product.stock <= 10) {
      return { status: "Últimas unidades", statusColor: "text-destructive", percentage: 15, sold: `${product.stock} restantes` };
    }
    return { status: "Disponível", statusColor: "text-emerald-500", percentage: Math.min(90, product.stock), sold: `${product.stock} em estoque` };
  };

  const processedBanners = useMemo(() => {
    return heroBanners.map(banner => ({
      ...banner,
      subtitle: applyClientCount(banner.subtitle, totalClients)
    }));
  }, [heroBanners, totalClients]);

  const heroBannerNode = processedBanners.length > 0 ? (
    <section
      className="relative w-full rounded-2xl overflow-hidden glass-card shadow-glass group transition-colors duration-500 h-[280px] md:h-[320px]"
      style={processedBanners[currentBanner]?.background_color ? { backgroundColor: processedBanners[currentBanner].background_color! } : undefined}
    >
      {processedBanners[currentBanner]?.image_style === "cover" && processedBanners[currentBanner]?.image_url && (
        <div
          className="absolute inset-0 transition-transform duration-700 group-hover:scale-105"
          style={{
            backgroundImage: `url('${processedBanners[currentBanner].image_url}')`,
            backgroundRepeat: "no-repeat",
            backgroundSize: `${Number(processedBanners[currentBanner].image_zoom ?? 100)}% auto`,
            backgroundPosition: `${Number(processedBanners[currentBanner].image_pos_x ?? 50)}% ${Number(processedBanners[currentBanner].image_pos_y ?? 50)}%`,
          }}
        />
      )}
      {processedBanners[currentBanner]?.image_style === "cover" && (
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
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
              {bannerCategoryLabels[processedBanners[currentBanner]?.category || ""] || processedBanners[currentBanner]?.category || "Destaque"}
            </span>
          </div>
          <h2 className={`text-3xl md:text-5xl font-bold leading-tight ${processedBanners[currentBanner]?.image_style === "cover" ? "text-white" : "text-foreground"}`}>
            {processedBanners[currentBanner]?.title}
          </h2>
          {processedBanners[currentBanner]?.subtitle && (
            <p className={`text-lg max-w-xl line-clamp-3 ${processedBanners[currentBanner]?.image_style === "cover" ? "text-gray-300" : "text-muted-foreground"}`}>{processedBanners[currentBanner].subtitle}</p>
          )}
          <div className="flex items-center gap-4 pt-2">
            {processedBanners[currentBanner]?.cta_text && (
              <button
                onClick={() => processedBanners[currentBanner]?.link_url && navigate(processedBanners[currentBanner].link_url!)}
                className="btn-primary-glow bg-primary text-primary-foreground font-bold text-sm px-8 py-3.5 rounded-xl transition-all hover:-translate-y-1 flex items-center gap-2"
              >
                {processedBanners[currentBanner].cta_text}
                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </button>
            )}
            {processedBanners.length > 1 && (
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentBanner((p) => (p - 1 + processedBanners.length) % processedBanners.length)} className="p-2 rounded-lg bg-secondary border border-border hover:bg-muted transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                <span className="text-xs text-muted-foreground font-medium">{currentBanner + 1}/{processedBanners.length}</span>
                <button onClick={() => setCurrentBanner((p) => (p + 1) % processedBanners.length)} className="p-2 rounded-lg bg-secondary border border-border hover:bg-muted transition-colors"><ChevronRight className="w-4 h-4" /></button>
              </div>
            )}
          </div>
        </div>
        {processedBanners[currentBanner]?.image_style !== "cover" && processedBanners[currentBanner]?.image_url && (
          <div className="flex-1 w-full max-w-md relative">
            <div className="absolute inset-0 bg-gradient-to-t from-background/50 to-transparent z-10 rounded-xl" />
            <div
              className="rounded-xl overflow-hidden shadow-2xl border border-border aspect-video"
              style={{
                backgroundImage: `url('${processedBanners[currentBanner].image_url}')`,
                backgroundRepeat: "no-repeat",
                backgroundSize: `${Number(processedBanners[currentBanner].image_zoom ?? 100)}% auto`,
                backgroundPosition: `${Number(processedBanners[currentBanner].image_pos_x ?? 50)}% ${Number(processedBanners[currentBanner].image_pos_y ?? 50)}%`,
              }}
            />
          </div>
        )}
      </div>
    </section>
  ) : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 text-primary animate-spin" />
      </div>
    );
  }

  if (layoutV2 && !legacyLayout) {
    return (
      <>
        <LojaLayoutV2
          banner={heroBannerNode}
          headline={headline}
          headlineVisible={headlineVisible}
          products={allProducts as any}
          categoryName={(id) => categories.find((c) => c.id === id)?.name}
          filters={filters}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          purposes={allPurposes}
          activePurpose={activePurpose}
          onPurposeChange={setActivePurpose}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onAddToCart={(p: any, qty: number = 1) => {
            addItem({
              productId: p.id,
              name: p.name,
              price: p.price,
              quantity: qty,
              image: p.image_url || "/placeholder.svg",
              isProxy: p.category_id === proxyCategoryId,
            });
            toast.success(`${p.name} adicionado ao carrinho!`);
          }}
          onBuy={(p: any, qty: number = 1) => navigate(`/checkout?product=${p.id}&qty=${qty}`)}
          onDetail={(p: any) => setDetailProduct(p)}
          onUseLegacy={() => {
            try {
              localStorage.setItem("store_layout_legacy", "1");
              localStorage.setItem("store_layout_legacy_rev", layoutRev);
            } catch { /* noop */ }
            setLegacyLayout(true);
          }}
        />
        <ProductDetailModal
          product={detailProduct}
          open={!!detailProduct}
          onOpenChange={(open) => { if (!open) setDetailProduct(null); }}
          quantity={detailProduct ? getQuantity(detailProduct.id) : 1}
          onQuantityChange={updateQuantity}
        />
      </>
    );
  }

  return (
    <>
    <div className="space-y-10 animate-fade-in">
      {layoutV2 && legacyLayout && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="rounded-full border border-border bg-secondary/40 px-3 py-1 text-[12px] text-muted-foreground backdrop-blur-md">
            Você está na versão antiga da loja
          </span>
          <button
            onClick={() => {
              try {
                localStorage.setItem("store_layout_legacy", "0");
                localStorage.setItem("store_layout_legacy_rev", layoutRev);
              } catch { /* noop */ }
              setLegacyLayout(false);
            }}
            className="rounded-full border border-border bg-secondary/40 px-3 py-1 text-[12px] text-muted-foreground backdrop-blur-md transition-colors hover:border-primary/50 hover:text-foreground"
          >
            Usar nova experiência
          </button>
        </div>
      )}
      {/* Dynamic Hero Banners */}
      {heroBannerNode}

      {/* Filters & Products */}
      {/* Busca de produtos */}
      <section className="space-y-3">
        <div className="relative w-full md:max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por produto ou finalidade: perfil, black, bm, proxy..."
            aria-label="Buscar produtos"
            className="relative z-10 w-full h-12 pl-12 pr-11 rounded-xl glass-panel border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
          />
          <span className="absolute inset-y-0 left-0 z-30 flex w-12 items-center justify-center pointer-events-none" aria-hidden="true">
            <Search className="h-5 w-5 text-primary" strokeWidth={2.75} />
          </span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              aria-label="Limpar busca"
              className="absolute right-3 top-1/2 z-30 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {["Perfil", "BM", "Black", "White", "Proxy"].map((s) => (
            <button
              key={s}
              onClick={() => setSearchQuery(s)}
              className="shrink-0 px-3 py-1 rounded-full text-[11px] font-medium bg-secondary text-muted-foreground border border-border hover:border-primary/50 hover:text-primary transition-all"
            >
              {s}
            </button>
          ))}
        </div>
      </section>

      {/* Sub-banners (ofertas secundárias) */}
      {subBanners.map((sb) => {
        const accent = sb.accent_color || "#00F0FF";
        return (
          <section
            key={sb.id}
            onClick={() => sb.link_url && navigate(sb.link_url)}
            className="relative cursor-pointer rounded-2xl overflow-hidden border border-[#BC13FE]/40 bg-gradient-to-r from-[#0A0A0A] via-[#1a0b2e] to-[#0A0A0A] p-5 md:p-6 hover:scale-[1.005] transition-transform"
            style={sb.background_color ? { backgroundColor: sb.background_color, backgroundImage: "none" } : undefined}
          >
            {sb.image_url && (
              <div
                className="absolute inset-0 bg-cover bg-center opacity-25 pointer-events-none"
                style={{ backgroundImage: `url('${sb.image_url}')` }}
              />
            )}
            <div className="absolute -right-10 -top-10 w-60 h-60 bg-[#BC13FE]/20 rounded-full blur-[80px] pointer-events-none" />
            <div className="absolute -left-10 -bottom-10 w-60 h-60 rounded-full blur-[80px] pointer-events-none" style={{ backgroundColor: `${accent}26` }} />
            <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-2">
                {sb.badge_text && (
                  <span
                    className="inline-block py-1 px-3 rounded-full text-[10px] font-bold tracking-wider border"
                    style={{ color: accent, borderColor: `${accent}4D`, backgroundColor: `${accent}33` }}
                  >
                    {sb.badge_text}
                  </span>
                )}
                <h3 className="text-xl md:text-2xl font-extrabold text-white">{sb.title}</h3>
                {sb.subtitle && <p className="text-sm text-gray-400 max-w-2xl">{sb.subtitle}</p>}
              </div>
              {sb.cta_text && (
                <button
                  className="flex-shrink-0 text-white font-bold text-sm px-6 py-3 rounded-xl shadow-[0_0_24px_rgba(188,19,254,0.4)]"
                  style={{ backgroundImage: `linear-gradient(90deg, #BC13FE, ${accent})` }}
                >
                  {sb.cta_text}
                </button>
              )}
            </div>
          </section>
        );
      })}

      <section className="space-y-6">
        <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {filters.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`shrink-0 font-medium px-6 py-2.5 rounded-lg text-sm transition-all ${
                activeFilter === filter
                  ? "bg-primary text-primary-foreground font-bold shadow-glow"
                  : "glass-panel text-foreground hover:text-primary border border-border hover:border-primary/50"
              }`}
            >
              {filter}
            </button>
          ))}
          <div className="ml-auto shrink-0 flex items-center gap-1 bg-secondary rounded-lg border border-border p-0.5">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded-md transition-all ${
                viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              title="Visualização em grade"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 rounded-md transition-all ${
                viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              title="Visualização em lista"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {(activeFilter === "Proxy" || activeFilter === "Perfis" || activeFilter === "Bm") && allPurposes.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-hide animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2 px-1">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mr-2 shrink-0 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/40"></span>
                Finalidade
              </span>
            </div>
            {allPurposes.map((purpose) => (
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
        )}

        {isProxyFilter ? (
          /* Proxy products from ProxyBR API */
          proxyLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-72 rounded-2xl" />
              ))}
            </div>
          ) : proxyError ? (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-[48px] text-destructive mb-4">error</span>
              <p className="text-destructive font-bold">Erro ao carregar proxies</p>
              <p className="text-muted-foreground text-sm mt-1">{(proxyError as Error).message}</p>
            </div>
          ) : proxyProducts.length === 0 && proxyfbflixLocalProducts.length === 0 ? (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-[48px] text-muted-foreground mb-4">inventory_2</span>
              <p className="text-muted-foreground">Nenhum proxy disponível no momento.</p>
            </div>
          ) : (
            <div key="proxy-content" className={viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" : "flex flex-col gap-3"}>
              {allProducts.map((product: any) => {
                // Find if this is an API product (via original external_id or matching)
                const apiProduct = rawProxyProductsData.find(ap => String(ap.id) === product.id || String(ap.id) === product.external_id);
                
                if (viewMode === "list") {
                  return (
                    <ProductListItem
                      key={`list-${product.id}`}
                      product={product}
                      quantity={apiProduct ? getProxyQty(String(apiProduct.id)) : getQuantity(product.id)}
                      onQuantityChange={(id, delta, max) => apiProduct ? updateProxyQty(String(apiProduct.id), delta) : updateQuantity(product.id, delta, product.stock)}
                      onReadMore={setDetailProduct}
                    />
                  );
                }
                
                if (apiProduct) {
                  return (
                    <ProxyProductCard
                      key={`grid-${apiProduct.id}`}
                      product={apiProduct}
                      proxyImage={getProxyImage(apiProduct.name)}
                      quantity={getProxyQty(String(apiProduct.id))}
                      onQuantityChange={updateProxyQty}
                      localData={getLocalProxyData(apiProduct)}
                      multiplier={Number(userProfile?.proxy_price_multiplier ?? 1) || 1}
                      fixedPrice={userProfile?.proxy_fixed_price ? Number(userProfile.proxy_fixed_price) : null}
                      onReadMore={(info) => { 
                        const variants = apiProduct.variant || apiProduct.variants?.data || apiProduct.variants || []; 
                        const totalApiStock = variants.reduce((sum: number, v: any) => sum + (v.stocks ?? 0), 0); 
                        setDetailProduct({ 
                          id: String(apiProduct.id), 
                          name: info.name, 
                          description: info.description, 
                          price: info.price, 
                          price_label: "mensal", 
                          image_url: info.image_url, 
                          badge_text: null, 
                          badge_color: null, 
                          badge_icon: null, 
                          stock: totalApiStock > 0 ? totalApiStock : 0, 
                          available: true, 
                          category_id: null, 
                          tags: info.tags 
                        } as any); 
                      }}
                    />
                  );
                }
                
                const stockInfo = getStockInfo(product);
                return (
                  <article
                    key={product.id}
                    className={`glass-card rounded-2xl overflow-hidden flex flex-col group h-full relative ${product.tags?.some((t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes("promoc")) ? "ring-1 ring-red-500/30" : ""}`}
                  >
                    {product.tags?.some((t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes("promoc")) && (
                      <div className="absolute top-0 left-0 z-10 overflow-hidden w-24 h-24 pointer-events-none">
                        <div className="absolute top-[10px] left-[-28px] w-[120px] text-center text-[10px] font-extrabold uppercase tracking-wider bg-gradient-to-r from-red-600 to-orange-500 text-white py-1 rotate-[-45deg] shadow-lg shadow-red-500/30">
                          Promoção
                        </div>
                      </div>
                    )}
                    <div className="p-4 flex flex-col flex-1 gap-3">
                      {/* Badge */}
                      {product.badge_text && (
                        <div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${product.badge_color || "bg-muted text-foreground border-border"}`}>
                            {product.badge_icon && <span className="material-symbols-outlined text-[11px]">{product.badge_icon}</span>}
                            {product.badge_text}
                          </span>
                        </div>
                      )}
                      {/* Image + Name + Price */}
                      <div className="flex items-center gap-3">
                        <div className="shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-secondary flex items-center justify-center">
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <span className="material-symbols-outlined text-[22px] text-muted-foreground">dns</span>
                          )}
                        </div>
                        <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors leading-tight truncate flex-1 min-w-0">{product.name}</h3>
                        <p className="text-base font-bold text-foreground shrink-0">R$ {product.price.toFixed(2).replace(".", ",")}</p>
                      </div>
                      {/* Tags */}
                      {product.tags && product.tags.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {product.tags.map((tag) => (
                            <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-foreground text-background font-medium">{tag}</span>
                          ))}
                        </div>
                      )}
                      {/* Stock */}
                      <div className="flex items-center gap-2 text-[11px] font-medium">
                        <span className={`${stockInfo.statusColor} flex items-center gap-1`}>
                          {stockInfo.percentage > 0 && <span className={`w-1.5 h-1.5 rounded-full ${stockInfo.statusColor === "text-emerald-500" ? "bg-emerald-500 animate-pulse" : "bg-destructive"}`} />}
                          {stockInfo.status}
                        </span>
                        <span className="text-muted-foreground">· {stockInfo.sold}</span>
                        <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${stockInfo.statusColor === "text-emerald-500" ? "bg-gradient-to-r from-green-400 to-green-600" : "bg-gradient-to-r from-red-500 to-orange-500"}`} style={{ width: `${stockInfo.percentage}%` }} />
                        </div>
                      </div>
                      {/* Actions */}
                      <div className="mt-auto pt-3 flex items-center gap-2 border-t border-border">
                        <div className="flex items-center bg-secondary rounded-lg border border-border h-8 px-0.5">
                          <button onClick={() => updateQuantity(product.id, -1, product.stock)} className="w-7 h-full flex items-center justify-center text-muted-foreground hover:text-foreground rounded transition"><span className="material-symbols-outlined text-[14px]">remove</span></button>
                          <span className="w-6 text-center text-xs font-medium text-foreground">{getQuantity(product.id)}</span>
                          <button onClick={() => updateQuantity(product.id, 1, product.stock)} className="w-7 h-full flex items-center justify-center text-muted-foreground hover:text-foreground rounded transition"><span className="material-symbols-outlined text-[14px]">add</span></button>
                        </div>
                        <button onClick={() => { addItem({ productId: product.id, name: product.name, price: product.price, quantity: getQuantity(product.id), image: product.image_url || "/placeholder.svg", isProxy: (product as any).icon_type === "proxy" }); toast.success(`${product.name} adicionado ao carrinho!`); }} className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all flex items-center justify-center shrink-0" title="Adicionar ao carrinho"><span className="material-symbols-outlined text-[16px]">shopping_cart</span></button>
                        <button onClick={() => navigate(`/checkout?product=${product.id}&qty=${getQuantity(product.id)}`)} className="flex-1 h-8 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5"><span className="material-symbols-outlined text-[14px]">flash_on</span>Comprar</button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )
        ) : allProducts.length === 0 ? (
          <div className="text-center py-12">
            <span className="material-symbols-outlined text-[48px] text-muted-foreground mb-4">inventory_2</span>
            <p className="text-muted-foreground">Nenhum produto encontrado.</p>
          </div>
        ) : viewMode === "list" ? (
          <div key="all-list" className="flex flex-col gap-3">
            {allProducts.map((product) => (
              <ProductListItem
                key={`list-${product.id}`}
                product={product}
                quantity={getQuantity(product.id)}
                onQuantityChange={updateQuantity}
                onReadMore={setDetailProduct}
              />
            ))}
          </div>
        ) : (
          <div key="all-grid" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {allProducts.map((product) => {
              const stockInfo = getStockInfo(product);
              return (
                <article
                  key={product.id}
                  className={`glass-card rounded-2xl overflow-hidden flex flex-col group h-full relative ${
                    !product.available ? "opacity-70 hover:opacity-100" : ""
                  } ${product.tags?.some(t => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes("promoc")) ? "ring-1 ring-red-500/30" : ""}`}
                >
                  {product.tags?.some(t => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes("promoc")) && (
                    <div className="absolute top-0 left-0 z-10 overflow-hidden w-24 h-24 pointer-events-none">
                      <div className="absolute top-[10px] left-[-28px] w-[120px] text-center text-[10px] font-extrabold uppercase tracking-wider bg-gradient-to-r from-red-600 to-orange-500 text-white py-1 rotate-[-45deg] shadow-lg shadow-red-500/30">
                        Promoção
                      </div>
                    </div>
                  )}
                  {/* Content */}
                  <div className="p-4 flex flex-col flex-1 gap-3">
                    {/* Badge */}
                    {product.badge_text && (
                      <div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${product.badge_color || "bg-muted text-foreground border-border"}`}>
                          {product.badge_icon && <span className="material-symbols-outlined text-[11px]">{product.badge_icon}</span>}
                          {product.badge_text}
                        </span>
                      </div>
                    )}
                    {/* Image + Name + Price */}
                    <div className="flex items-center gap-3">
                      <div className="shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-secondary flex items-center justify-center">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <span className="material-symbols-outlined text-[22px] text-muted-foreground">inventory_2</span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors leading-tight truncate flex-1 min-w-0">{product.name}</h3>
                      <p className="text-base font-bold text-foreground shrink-0">R$ {product.price.toFixed(2).replace(".", ",")}</p>
                    </div>

                    {/* Description */}
                    {product.description && (
                      <p className="text-xs text-muted-foreground">
                        {product.description.length > 150
                          ? <>{product.description.substring(0, 150)}... <button onClick={() => setDetailProduct(product)} className="text-primary hover:underline font-medium">ler mais</button></>
                          : product.description}
                      </p>
                    )}

                    {/* Tags */}
                    {product.tags && product.tags.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {product.tags.map((tag) => (
                          <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-foreground text-background font-medium">{tag}</span>
                        ))}
                      </div>
                    )}

                    {/* Stock */}
                    <div className="flex items-center gap-2 text-[11px] font-medium">
                      <span className={`${stockInfo.statusColor} flex items-center gap-1`}>
                        {stockInfo.percentage > 0 && <span className={`w-1.5 h-1.5 rounded-full ${stockInfo.statusColor === "text-emerald-500" ? "bg-emerald-500 animate-pulse" : "bg-destructive"}`} />}
                        {stockInfo.status}
                      </span>
                      <span className="text-muted-foreground">· {stockInfo.sold}</span>
                      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${stockInfo.statusColor === "text-emerald-500" ? "bg-gradient-to-r from-green-400 to-green-600" : stockInfo.statusColor === "text-destructive" ? "bg-gradient-to-r from-red-500 to-orange-500" : "bg-muted"}`} style={{ width: `${stockInfo.percentage}%` }} />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-auto pt-3 flex items-center gap-2 border-t border-border">
                      {product.available && product.stock > 0 ? (
                        <>
                          <div className="flex items-center bg-secondary rounded-lg border border-border h-8 px-0.5">
                            <button onClick={() => updateQuantity(product.id, -1, product.stock)} className="w-7 h-full flex items-center justify-center text-muted-foreground hover:text-foreground rounded transition"><span className="material-symbols-outlined text-[14px]">remove</span></button>
                            <span className="w-6 text-center text-xs font-medium text-foreground">{getQuantity(product.id)}</span>
                            <button onClick={() => updateQuantity(product.id, 1, product.stock)} disabled={getQuantity(product.id) >= product.stock} className="w-7 h-full flex items-center justify-center text-muted-foreground hover:text-foreground rounded transition disabled:opacity-30"><span className="material-symbols-outlined text-[14px]">add</span></button>
                          </div>
                          <button onClick={() => { addItem({ productId: product.id, name: product.name, price: product.price, quantity: getQuantity(product.id), image: product.image_url || "/placeholder.svg", isProxy: isLocalProxy(product) }); toast.success(`${product.name} adicionado ao carrinho!`); }} className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all flex items-center justify-center shrink-0" title="Adicionar ao carrinho"><span className="material-symbols-outlined text-[16px]">shopping_cart</span></button>
                          <button onClick={() => navigate(`/checkout?product=${product.id}&qty=${getQuantity(product.id)}`)} className="flex-1 h-8 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5"><span className="material-symbols-outlined text-[14px]">flash_on</span>Comprar</button>
                        </>
                      ) : (
                        <button
                          onClick={async () => {
                            const { data: { user } } = await supabase.auth.getUser();
                            if (!user) return;
                            const { error } = await supabase.from("product_waitlist" as any).insert({ user_id: user.id, product_id: product.id } as any);
                            if (error && error.code === '23505') { toast.info("Você já será notificado quando este produto chegar!"); }
                            else if (error) { toast.error("Erro ao registrar interesse"); }
                            else { toast.success("Você será notificado quando este produto estiver disponível!"); }
                          }}
                          className="w-full bg-secondary hover:bg-secondary/80 text-foreground font-bold text-xs h-8 rounded-lg border border-border transition-all flex items-center justify-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-[14px]">notifications_active</span>
                          Avise-me
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
            {/* All items are already included in allProducts above */}
          </div>
        )}
      </section>
    </div>

      <ProductDetailModal
        product={detailProduct}
        open={!!detailProduct}
        onOpenChange={(open) => { if (!open) setDetailProduct(null); }}
        quantity={detailProduct ? getQuantity(detailProduct.id) : 1}
        onQuantityChange={updateQuantity}
      />
    </>
  );
}
