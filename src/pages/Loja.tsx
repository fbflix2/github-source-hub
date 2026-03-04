import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, LayoutGrid, List } from "lucide-react";
import { ProductListItem } from "@/components/loja/ProductListItem";
import { ProductDetailModal } from "@/components/loja/ProductDetailModal";
import { ProxyProductCard } from "@/components/loja/ProxyProductCard";
import { useProxyBRProducts } from "@/hooks/useProxyBR";
import { Skeleton } from "@/components/ui/skeleton";

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
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const { data: proxyProductsData, isLoading: proxyLoading, error: proxyError } = useProxyBRProducts();
  const [proxyQuantities, setProxyQuantities] = useState<Record<string, number>>({});
  const [proxyImages, setProxyImages] = useState<ProxyImage[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [productsRes, categoriesRes, proxyImagesRes] = await Promise.all([
      supabase.from("products").select("*").eq("status", "active").order("created_at", { ascending: false }),
      supabase.from("product_categories").select("*"),
      supabase.from("product_images").select("name, url").eq("category", "proxy"),
    ]);

    if (productsRes.data) setProducts(productsRes.data);
    if (categoriesRes.data) setCategories(categoriesRes.data);
    if (proxyImagesRes.data) setProxyImages(proxyImagesRes.data);
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

  const proxyProducts: any[] = Array.isArray(proxyProductsData?.data)
    ? proxyProductsData.data
    : Array.isArray(proxyProductsData)
    ? proxyProductsData
    : [];

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
  const showProxiesInAll = activeFilter === "Todos" && !proxyLoading && !proxyError && proxyProducts.length > 0;

  const proxyCategoryId = categories.find((c) => c.slug === "proxy")?.id;
  const localProxyProducts = proxyCategoryId ? products.filter((p) => p.category_id === proxyCategoryId) : [];
  const normalizeStr = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const getLocalProxyData = (apiProduct: any) => {
    const apiId = String(apiProduct.id);
    const apiName = apiProduct.name || "";
    // Match by external_id first, then fallback to normalized name
    const match = localProxyProducts.find(
      (p) => p.external_id === apiId
    ) || localProxyProducts.find(
      (p) => normalizeStr(p.name) === normalizeStr(apiName)
    );
    if (match) {
      console.log(`[ProxyMatch] API id=${apiId} → local id=${match.id}, price=${match.price}, tags=${JSON.stringify(match.tags)}, desc=${match.description?.substring(0, 30)}`);
    } else {
      console.log(`[ProxyMatch] API id=${apiId} name="${apiName}" → NO MATCH. localProxyProducts:`, localProxyProducts.map(p => ({ id: p.id, ext: p.external_id, name: p.name })));
    }
    return match || null;
  };
  const filters = ["Todos", ...categories.filter((c) => c.slug !== "proxy").map((c) => c.name), "Proxy"];

  const proxyAsProducts: Product[] = proxyProducts.map((p: any) => {
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
      price: Number(price),
      price_label: "mensal",
      image_url: local?.image_url || getProxyImage(p.name),
      badge_text: local?.badge_text || null,
      badge_color: local?.badge_color || null,
      badge_icon: local?.badge_icon || null,
      stock: totalApiStock > 0 ? totalApiStock : (local?.stock ?? 0),
      available: true,
      category_id: proxyCategoryId || null,
      tags: local?.tags || null,
    };
  });

  // Local proxy products with 'webshare' tag should show alongside regular products
  const isWebshareLocal = (p: Product) => p.category_id === proxyCategoryId && p.tags?.includes("webshare");

  const filteredProducts = activeFilter === "Todos"
    ? products.filter((p) => p.category_id !== proxyCategoryId || isWebshareLocal(p))
    : products.filter((p) => {
        const cat = categories.find((c) => c.name === activeFilter);
        if (activeFilter === "Proxy") return p.category_id === proxyCategoryId && isWebshareLocal(p);
        return cat && p.category_id === cat.id;
      });

  const allProducts = showProxiesInAll
    ? [...filteredProducts, ...proxyAsProducts]
    : filteredProducts;

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <>
    <div className="space-y-10 animate-fade-in">
      {/* Hero Section */}
      <section className="relative w-full rounded-2xl overflow-hidden glass-card shadow-glass group">
        <div className="absolute -right-20 -top-20 w-96 h-96 bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between p-8 md:p-12 gap-8">
          <div className="flex-1 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-primary/20 to-transparent border border-primary/20">
              <span className="animate-pulse w-2 h-2 rounded-full bg-primary" />
              <span className="text-xs font-bold text-primary uppercase tracking-wider">Promoção Limitada</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold leading-tight text-foreground">
              Recarregue acima de R$200 e <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-700">
                ganhe 15% de bônus
              </span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-xl">
              Aproveite nossa campanha de recarga para maximizar seu saldo e adquirir mais perfis e proxies com desconto exclusivo.
            </p>
            <div className="flex items-center gap-4 pt-2">
              <button className="btn-primary-glow bg-primary text-primary-foreground font-bold text-sm px-8 py-3.5 rounded-xl transition-all hover:-translate-y-1 flex items-center gap-2">
                Aproveitar agora
                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </button>
              <button className="bg-secondary hover:bg-secondary/80 text-foreground font-medium text-sm px-6 py-3.5 rounded-xl border border-border transition-all hover:border-border">
                Ver regulamento
              </button>
            </div>
          </div>
          <div className="flex-1 w-full max-w-md relative">
            <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D0D]/50 to-transparent z-10" />
            <div
              className="rounded-xl overflow-hidden shadow-2xl border border-white/10 aspect-video bg-cover bg-center"
              style={{
                backgroundImage:
                  "url('https://lh3.googleusercontent.com/aida-public/AB6AXuC5nn24ArvW43GzGEjp9Z41AJ6ltA2i2-VmQs8CHMkuo6-8hWz3ognn25PEibRPofOucMtC0MOkISQN6DPlpxA8U_iT2mz9ENwE1-zZbX8A3LDY8EhqtrcrioGGyWujTw6HOwqSAOXKVEMCiaKfAdzyChDMC6XyGSGRCGDgMNuTp2AK3KAu8plItjJxJZ0dLbGttf92tgqYfF8MapFxEjmR7NvOwm25vVAFVv8ZwqXroY4rH0GWmZggdkmDG-KpvWQfVqri9RXO2jw')",
              }}
            />
          </div>
        </div>
      </section>

      {/* Filters & Products */}
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
          ) : proxyProducts.length === 0 ? (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-[48px] text-muted-foreground mb-4">inventory_2</span>
              <p className="text-muted-foreground">Nenhum proxy disponível no momento.</p>
            </div>
          ) : viewMode === "list" ? (
            <div className="flex flex-col gap-3">
              {proxyProducts.map((product: any) => {
                const local = getLocalProxyData(product);
                const variants = product.variant || product.variants?.data || product.variants || [];
                const cheapestVariant = variants.length
                  ? variants.reduce((min: any, v: any) => ((v.price || 0) < (min.price || 0) ? v : min), variants[0])
                  : null;
                const price = (local?.price != null && local.price > 0) ? local.price : (cheapestVariant?.price || product.price || 0);
                const totalApiStock = variants.reduce((sum: number, v: any) => sum + (v.stocks ?? 0), 0);
                const asProduct: Product = {
                  id: local?.id || String(product.id),
                  name: local?.name || product.name,
                  description: local?.description || product.description || null,
                  price: Number(price),
                  price_label: "mensal",
                  image_url: local?.image_url || getProxyImage(product.name),
                  badge_text: local?.badge_text || null,
                  badge_color: local?.badge_color || null,
                  badge_icon: local?.badge_icon || null,
                  stock: totalApiStock > 0 ? totalApiStock : (local?.stock ?? 0),
                  available: true,
                  category_id: null,
                  tags: local?.tags || null,
                };
                return (
                  <ProductListItem
                    key={product.id}
                    product={asProduct}
                    quantity={getProxyQty(String(product.id))}
                    onQuantityChange={(id, delta, max) => updateProxyQty(String(product.id), delta)}
                    onReadMore={setDetailProduct}
                  />
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {proxyProducts.map((product: any) => (
                <ProxyProductCard
                  key={product.id}
                  product={product}
                  proxyImage={getProxyImage(product.name)}
                  quantity={getProxyQty(String(product.id))}
                  onQuantityChange={updateProxyQty}
                  localData={getLocalProxyData(product)}
                  onReadMore={(info) => { const variants = product.variant || product.variants?.data || product.variants || []; const totalApiStock = variants.reduce((sum: number, v: any) => sum + (v.stocks ?? 0), 0); setDetailProduct({ id: String(product.id), name: info.name, description: info.description, price: info.price, price_label: "mensal", image_url: info.image_url, badge_text: null, badge_color: null, badge_icon: null, stock: totalApiStock > 0 ? totalApiStock : 0, available: true, category_id: null, tags: info.tags } as any); }}
                />
              ))}
            </div>
          )
        ) : allProducts.length === 0 ? (
          <div className="text-center py-12">
            <span className="material-symbols-outlined text-[48px] text-muted-foreground mb-4">inventory_2</span>
            <p className="text-muted-foreground">Nenhum produto encontrado.</p>
          </div>
        ) : viewMode === "list" ? (
          <div className="flex flex-col gap-3">
            {allProducts.map((product) => (
              <ProductListItem
                key={product.id}
                product={product}
                quantity={getQuantity(product.id)}
                onQuantityChange={updateQuantity}
                onReadMore={setDetailProduct}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {allProducts.map((product) => {
              const stockInfo = getStockInfo(product);
              return (
                <article
                  key={product.id}
                  className={`glass-card rounded-2xl overflow-hidden flex flex-col group h-full ${
                    !product.available ? "opacity-70 hover:opacity-100" : ""
                  }`}
                >
                  {/* Content */}
                  <div className="p-5 flex flex-col flex-1 gap-4">
                    {/* Header: image + name + price */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-secondary flex items-center justify-center">
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <span className="material-symbols-outlined text-[20px] text-muted-foreground">inventory_2</span>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 min-w-0">
                          <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-tight">
                            {product.name}
                          </h3>
                          {product.badge_text && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 shrink-0 ${product.badge_color || "bg-muted text-foreground border-border"}`}>
                              {product.badge_icon && <span className="material-symbols-outlined text-[11px]">{product.badge_icon}</span>}
                              {product.badge_text}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0 whitespace-nowrap">
                        <p className="text-xl font-bold text-foreground">
                          R$ {product.price.toFixed(2).replace(".", ",")}
                        </p>
                        {product.price_label && (
                          <p className="text-[10px] text-muted-foreground">{product.price_label}</p>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-muted-foreground">
                      {product.description && product.description.length > 150
                        ? <>{product.description.substring(0, 150)}... <button onClick={() => setDetailProduct(product)} className="text-primary hover:underline font-medium text-xs">ler mais</button></>
                        : product.description}
                    </p>

                    {/* Tags */}
                    {product.tags && product.tags.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {product.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-foreground text-background font-medium"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Availability Bar */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-medium">
                        <span className={`${stockInfo.statusColor} flex items-center gap-1`}>
                          {stockInfo.percentage > 0 && (
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                stockInfo.statusColor === "text-emerald-500" ? "bg-emerald-500 animate-pulse" : "bg-destructive"
                              }`}
                            />
                          )}
                          {stockInfo.status}
                        </span>
                        <span className="text-muted-foreground">{stockInfo.sold}</span>
                      </div>
                      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            stockInfo.statusColor === "text-emerald-500"
                              ? "bg-gradient-to-r from-green-400 to-green-600"
                              : stockInfo.statusColor === "text-destructive"
                              ? "bg-gradient-to-r from-red-500 to-orange-500"
                              : "bg-muted"
                          }`}
                          style={{ width: `${stockInfo.percentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-auto pt-4 flex flex-col gap-3 border-t border-border">
                      {product.available && product.stock > 0 ? (
                        <>
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center bg-secondary rounded-lg border border-border h-10 px-1">
                              <button
                                onClick={() => updateQuantity(product.id, -1, product.stock)}
                                className="w-8 h-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded transition"
                              >
                                <span className="material-symbols-outlined text-[16px]">remove</span>
                              </button>
                              <input
                                type="text"
                                readOnly
                                value={getQuantity(product.id)}
                                className="w-8 bg-transparent text-center text-sm font-medium border-0 focus:ring-0 text-foreground"
                              />
                              <button
                                onClick={() => updateQuantity(product.id, 1, product.stock)}
                                disabled={getQuantity(product.id) >= product.stock}
                                className="w-8 h-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded transition disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                <span className="material-symbols-outlined text-[16px]">add</span>
                              </button>
                            </div>
                            <button
                              onClick={() => {
                                addItem({
                                  productId: product.id,
                                  name: product.name,
                                  price: product.price,
                                  quantity: getQuantity(product.id),
                                  image: product.image_url || "/placeholder.svg",
                                });
                                toast.success(`${product.name} adicionado ao carrinho!`);
                              }}
                              className="h-10 px-3 rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all flex items-center justify-center"
                              title="Adicionar ao carrinho"
                            >
                              <span className="material-symbols-outlined text-[20px]">shopping_cart</span>
                            </button>
                          </div>
                          <button
                            onClick={() => navigate(`/checkout?product=${product.id}&qty=${getQuantity(product.id)}`)}
                            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm h-10 rounded-lg transition-all flex items-center justify-center gap-2 shadow-[0_0_10px_rgba(220,38,38,0.2)]"
                          >
                            <span className="material-symbols-outlined text-[18px]">flash_on</span>
                            Comprar agora
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={async () => {
                            const { data: { user } } = await supabase.auth.getUser();
                            if (!user) return;
                            const { error } = await supabase.from("product_waitlist" as any).insert({ user_id: user.id, product_id: product.id } as any);
                            if (error && error.code === '23505') {
                              toast.info("Você já será notificado quando este produto chegar!");
                            } else if (error) {
                              toast.error("Erro ao registrar interesse");
                            } else {
                              toast.success("Você será notificado quando este produto estiver disponível!");
                            }
                          }}
                          className="w-full bg-secondary hover:bg-secondary/80 text-foreground font-bold text-sm h-10 rounded-lg border border-border transition-all flex items-center justify-center gap-2"
                        >
                          <span className="material-symbols-outlined text-[18px]">notifications_active</span>
                          Avise-me quando chegar
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
            {/* Proxy products from API in "Todos" view */}
            {activeFilter === "Todos" && proxyProducts.map((product: any) => (
              <ProxyProductCard
                key={`proxy-${product.id}`}
                product={product}
                proxyImage={getProxyImage(product.name)}
                quantity={getProxyQty(String(product.id))}
                onQuantityChange={updateProxyQty}
                localData={getLocalProxyData(product)}
                onReadMore={(info) => setDetailProduct({ id: String(product.id), name: info.name, description: info.description, price: info.price, price_label: "mensal", image_url: info.image_url, badge_text: null, badge_color: null, badge_icon: null, stock: 999, available: true, category_id: null, tags: info.tags } as any)}
              />
            ))}
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
