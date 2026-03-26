import { useNavigate } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";

interface LocalProductData {
  id?: string;
  name?: string | null;
  description?: string | null;
  tags?: string[] | null;
  image_url?: string | null;
  price?: number;
  stock?: number;
  badge_text?: string | null;
  badge_color?: string | null;
  badge_icon?: string | null;
}

interface ProxyProductCardProps {
  product: any;
  proxyImage: string | null;
  quantity: number;
  onQuantityChange: (id: string, delta: number) => void;
  localData?: LocalProductData | null;
  onReadMore?: (info: { name: string; description: string | null; tags: string[] | null; image_url: string | null; price: number }) => void;
}

export function ProxyProductCard({ product, proxyImage, quantity, onQuantityChange, localData, onReadMore }: ProxyProductCardProps) {
  const navigate = useNavigate();
  const { addItem } = useCart();
  

  const variants = product.variant || product.variants?.data || product.variants || [];
  const cheapestVariant = variants.length
    ? variants.reduce((min: any, v: any) =>
        (v.price || 0) < (min.price || 0) ? v : min, variants[0])
    : null;
  const price = (localData?.price != null && localData.price > 0) ? localData.price : (cheapestVariant?.price || product.price || 0);
  const formattedPrice = `R$ ${Number(price).toFixed(2).replace(".", ",")}`;
  const productId = String(product.id);
  const typeLabel = product.type || "Proxy";
  const displayName = localData?.name || product.name;
  const description = localData?.description || product.description;
  const tags = (localData?.tags || []).filter((t) => t.toLowerCase() !== "webshare");
  const imageUrl = localData?.image_url || proxyImage;
  // Use real stock from API variants instead of local DB
  const totalApiStock = variants.reduce((sum: number, v: any) => sum + (v.stocks ?? 0), 0);
  const stockCount = totalApiStock > 0 ? totalApiStock : (localData?.stock ?? 0);
  const stockLabel = `${stockCount} em estoque`;
  const stockPercent = Math.min(100, Math.max(5, (stockCount / (stockCount + 50)) * 100));

  const isPromo = tags.some(t => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes("promoc") || t.toLowerCase().includes("promoção") || t.toLowerCase().includes("promocao"));

  return (
    <article className={`glass-card rounded-2xl overflow-hidden flex flex-col group h-full relative ${isPromo ? "ring-1 ring-red-500/30" : ""}`}>
      {isPromo && (
        <div className="absolute top-0 left-0 z-10 overflow-hidden w-24 h-24 pointer-events-none">
          <div className="absolute top-[10px] left-[-28px] w-[120px] text-center text-[10px] font-extrabold uppercase tracking-wider bg-gradient-to-r from-red-600 to-orange-500 text-white py-1 rotate-[-45deg] shadow-lg shadow-red-500/30">
            Promoção
          </div>
        </div>
      )}
      <div className="p-5 flex flex-col flex-1 gap-3">
        {/* Type badge */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border bg-primary/10 text-primary border-primary/20">
            <span className="material-symbols-outlined text-[11px]">bolt</span>
            {typeLabel}
          </span>
          {localData?.badge_text && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${localData.badge_color || "bg-muted text-foreground border-border"}`}>
              {localData.badge_icon && <span className="material-symbols-outlined text-[11px]">{localData.badge_icon}</span>}
              {localData.badge_text}
            </span>
          )}
        </div>

        {/* Image + Name + Price */}
        <div className="flex items-center gap-3">
          <div className="shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-secondary flex items-center justify-center">
            {imageUrl ? (
              <img src={imageUrl} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span className="material-symbols-outlined text-[22px] text-muted-foreground">dns</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors leading-tight truncate">
              {displayName}
            </h3>
          </div>
          <div className="text-right shrink-0">
            <p className="text-base font-bold text-foreground">{formattedPrice}</p>
          </div>
        </div>

        {/* Description - hidden in grid for compactness */}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {tags.map((tag) => (
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
            <span className="text-emerald-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Disponível
            </span>
            <span className="text-muted-foreground">{stockLabel}</span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-600" style={{ width: `${stockPercent}%` }} />
          </div>
        </div>

        {/* Actions */}
        <div className="mt-auto pt-3 flex items-center gap-2 border-t border-border">
          <div className="flex items-center bg-secondary rounded-lg border border-border h-8 px-0.5">
            <button onClick={() => onQuantityChange(productId, -1)} className="w-7 h-full flex items-center justify-center text-muted-foreground hover:text-foreground rounded transition">
              <span className="material-symbols-outlined text-[14px]">remove</span>
            </button>
            <span className="w-6 text-center text-xs font-medium text-foreground">{quantity}</span>
            <button onClick={() => onQuantityChange(productId, 1)} className="w-7 h-full flex items-center justify-center text-muted-foreground hover:text-foreground rounded transition">
              <span className="material-symbols-outlined text-[14px]">add</span>
            </button>
          </div>
          <button
            onClick={() => {
              const localId = localData?.id;
              addItem({ productId: localId || productId, name: displayName, price: Number(price), quantity, image: imageUrl || "/placeholder.svg" });
              toast.success(`${displayName} adicionado ao carrinho!`);
            }}
            className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all flex items-center justify-center shrink-0"
            title="Adicionar ao carrinho"
          >
            <span className="material-symbols-outlined text-[16px]">shopping_cart</span>
          </button>
          <button
            onClick={() => {
              // Auto-select cheapest variant and go straight to checkout
              const variant = cheapestVariant || variants[0];
              const desc = description ? `${description}${variant?.location ? ` Localização: ${variant.location}` : ""}` : `Localização: ${variant?.location || "N/A"} Protocolo: ${typeLabel}`;
              sessionStorage.setItem("proxy_purchase", JSON.stringify({
                product_variant_id: variant?.id,
                api_product_id: product.id,
                variant_location: variant?.location,
                quantity,
                interval: "monthly",
                description: desc,
                tags,
              }));
              if (localData?.id) {
                navigate(`/checkout?product=${localData.id}&qty=${quantity}`);
              } else {
                addItem({
                  productId,
                  name: displayName,
                  price: Number(price),
                  quantity,
                  image: imageUrl || "/placeholder.svg",
                });
                navigate("/checkout");
              }
            }}
            className="flex-1 h-8 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[14px]">flash_on</span>
            Comprar
          </button>
        </div>
      </div>
    </article>
  );
}