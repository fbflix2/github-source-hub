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

  const variants = product.variants?.data || product.variants || [];
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
  const tags = localData?.tags || [];
  const imageUrl = localData?.image_url || proxyImage;
  const stockCount = localData?.stock ?? 999;
  const stockLabel = `${stockCount} em estoque`;

  return (
    <article className="glass-card rounded-2xl overflow-hidden flex flex-col group h-full">
      <div className="p-5 flex flex-col flex-1 gap-4">
        {/* Header: image + name + price */}
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-secondary flex items-center justify-center mt-0.5">
            {imageUrl ? (
              <img src={imageUrl} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span className="material-symbols-outlined text-[20px] text-muted-foreground">dns</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-tight">
                {displayName}
              </h3>
              <div className="text-right shrink-0 whitespace-nowrap">
                <p className="text-xl font-bold text-foreground">{formattedPrice}</p>
                <p className="text-[10px] text-muted-foreground">mensal</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full border bg-primary/10 text-primary border-primary/20">
              <span className="material-symbols-outlined text-[11px]">bolt</span>
              {typeLabel}
            </span>
          </div>
        </div>

        {/* Description */}
        {description && (
          <p className="text-sm text-muted-foreground">
            {description.length > 50
              ? <>{description.substring(0, 50)}... <button onClick={() => onReadMore?.({ name: displayName, description, tags, image_url: imageUrl, price: Number(price) })} className="text-primary hover:underline font-medium text-xs">saiba mais</button></>
              : description}
          </p>
        )}

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
            <span className="text-primary flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Em estoque
            </span>
            <span className="text-muted-foreground">{stockLabel}</span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-600 w-[80%]" />
          </div>
        </div>

        {/* Actions */}
        <div className="mt-auto pt-4 flex flex-col gap-3 border-t border-border">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center bg-secondary rounded-lg border border-border h-10 px-1">
              <button
                onClick={() => onQuantityChange(productId, -1)}
                className="w-8 h-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded transition"
              >
                <span className="material-symbols-outlined text-[16px]">remove</span>
              </button>
              <input
                type="text"
                readOnly
                value={quantity}
                className="w-8 bg-transparent text-center text-sm font-medium border-0 focus:ring-0 text-foreground"
              />
              <button
                onClick={() => onQuantityChange(productId, 1)}
                className="w-8 h-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded transition"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
              </button>
            </div>
            <button
              onClick={() => {
                const localId = localData?.id;
                addItem({
                  productId: localId || productId,
                  name: displayName,
                  price: Number(price),
                  quantity,
                  image: imageUrl || "/placeholder.svg",
                });
                toast.success(`${displayName} adicionado ao carrinho!`);
              }}
              className="h-10 px-3 rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all flex items-center justify-center"
              title="Adicionar ao carrinho"
            >
              <span className="material-symbols-outlined text-[20px]">shopping_cart</span>
            </button>
          </div>
          <button
            onClick={() => {
              const localId = localData?.id;
              if (localId) {
                navigate(`/checkout?product=${localId}&qty=${quantity}`);
              } else {
                // No local product, add to cart and go to checkout
                addItem({
                  productId,
                  name: displayName,
                  price: Number(price),
                  quantity,
                  image: imageUrl || "/placeholder.svg",
                });
                navigate(`/checkout`);
              }
            }}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm h-10 rounded-lg transition-all flex items-center justify-center gap-2 shadow-[0_0_10px_rgba(220,38,38,0.2)]"
          >
            <span className="material-symbols-outlined text-[18px]">flash_on</span>
            Comprar agora
          </button>
        </div>
      </div>
    </article>
  );
}
