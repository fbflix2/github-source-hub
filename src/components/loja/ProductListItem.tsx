import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";
import { Share2, Check } from "lucide-react";

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

interface Props {
  product: Product;
  quantity: number;
  onQuantityChange: (id: string, delta: number, maxStock?: number) => void;
  onReadMore: (product: Product) => void;
}

function getStockInfo(product: Product) {
  if (!product.available || product.stock === 0) {
    return { status: "Sem estoque", statusColor: "text-muted-foreground", percentage: 0, sold: "Avise-me" };
  }
  if (product.stock <= 10) {
    return { status: "Últimas unidades", statusColor: "text-destructive", percentage: 15, sold: `${product.stock} restantes` };
  }
  return { status: "Disponível", statusColor: "text-emerald-500", percentage: Math.min(90, product.stock), sold: `${product.stock} em estoque` };
}

export function ProductListItem({ product, quantity, onQuantityChange, onReadMore }: Props) {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const stockInfo = getStockInfo(product);
  const [linkCopied, setLinkCopied] = useState(false);

  const productUrl = product.slug ? `${window.location.origin}/produto/${product.slug}` : null;

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!productUrl) return;
    if (navigator.share) {
      try { await navigator.share({ title: product.name, text: `Confira ${product.name} na FBFLIX!`, url: productUrl }); } catch {}
    } else {
      await navigator.clipboard.writeText(productUrl);
      setLinkCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };
  const isPromo = product.tags?.some(t => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes("promoc") || t.toLowerCase().includes("promoção") || t.toLowerCase().includes("promocao")) ?? false;

  return (
    <article
      className={`glass-card rounded-xl overflow-hidden flex flex-row items-center gap-0 group relative ${
        !product.available ? "opacity-70 hover:opacity-100" : ""
      } ${isPromo ? "ring-1 ring-red-500/30" : ""}`}
    >
      {isPromo && (
        <div className="absolute top-0 left-0 z-10 overflow-hidden w-24 h-24 pointer-events-none">
          <div className="absolute top-[10px] left-[-28px] w-[120px] text-center text-[10px] font-extrabold uppercase tracking-wider bg-gradient-to-r from-red-600 to-orange-500 text-white py-1 rotate-[-45deg] shadow-lg shadow-red-500/30">
            Promoção
          </div>
        </div>
      )}
      {/* Left: Icon / Image */}
      <div className="shrink-0 w-16 h-16 m-3 rounded-lg overflow-hidden bg-secondary/50 flex items-center justify-center">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="material-symbols-outlined text-[28px] text-muted-foreground">
            inventory_2
          </span>
        )}
      </div>

      {/* Center: Info */}
      <div className="flex-1 p-4 flex flex-col gap-2 min-w-0">
        <div className="flex items-start gap-3 justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-foreground line-clamp-2 leading-tight">{product.name}</h3>
              {product.badge_text && (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 shrink-0 ${
                    product.badge_color || "bg-muted text-foreground border-border"
                  }`}
                >
                  {product.badge_icon && (
                    <span className="material-symbols-outlined text-[11px]">{product.badge_icon}</span>
                  )}
                  {product.badge_text}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {product.description && product.description.length > 150
                ? <>{product.description.substring(0, 150)}... <button onClick={() => onReadMore(product)} className="text-primary hover:underline font-medium">ler mais</button></>
                : product.description}
            </p>
          </div>
        </div>

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

        {/* Stock bar */}
        <div className="flex items-center gap-3 mt-auto">
          <div className="flex items-center gap-3 flex-1 max-w-xs">
            <div className="flex items-center gap-1.5 text-[11px] font-medium whitespace-nowrap">
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
              <span className="text-muted-foreground">· {stockInfo.sold}</span>
            </div>
            <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden min-w-[40px]">
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
        </div>
      </div>

      {/* Right: Price + Actions */}
      <div className="shrink-0 p-4 flex items-center gap-3 border-t sm:border-t-0 sm:border-l border-border bg-secondary/30">
        <div className="text-right mr-2 whitespace-nowrap">
          <p className="text-base font-bold text-foreground">
            R$ {product.price.toFixed(2).replace(".", ",")}
          </p>
          {product.price_label && (
            <p className="text-[10px] text-muted-foreground">{product.price_label}</p>
          )}
        </div>

        {product.available && product.stock > 0 ? (
          <div className="flex items-center gap-2">
            {/* Quantity */}
            <div className="flex items-center bg-secondary rounded-lg border border-border h-8 px-0.5">
              <button
                onClick={() => onQuantityChange(product.id, -1, product.stock)}
                className="w-7 h-full flex items-center justify-center text-muted-foreground hover:text-foreground rounded transition"
              >
                <span className="material-symbols-outlined text-[14px]">remove</span>
              </button>
              <span className="w-6 text-center text-xs font-medium text-foreground">{quantity}</span>
              <button
                onClick={() => onQuantityChange(product.id, 1, product.stock)}
                disabled={quantity >= product.stock}
                className="w-7 h-full flex items-center justify-center text-muted-foreground hover:text-foreground rounded transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[14px]">add</span>
              </button>
            </div>

            {/* Share */}
            {productUrl && (
              <button
                onClick={handleShare}
                className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all flex items-center justify-center"
                title="Compartilhar produto"
              >
                {linkCopied ? <Check className="size-3.5" /> : <Share2 className="size-3.5" />}
              </button>
            )}

            {/* Cart */}
            <button
              onClick={() => {
                addItem({
                  productId: product.id,
                  name: product.name,
                  price: product.price,
                  quantity,
                  image: product.image_url || "/placeholder.svg",
                });
                toast.success(`${product.name} adicionado ao carrinho!`);
              }}
              className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all flex items-center justify-center"
              title="Adicionar ao carrinho"
            >
              <span className="material-symbols-outlined text-[16px]">shopping_cart</span>
            </button>

            {/* Buy */}
            <button
              onClick={() => navigate(`/checkout?product=${product.id}&qty=${quantity}`)}
              className="h-8 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-[14px]">flash_on</span>
              Comprar
            </button>
          </div>
        ) : (
          <button className="h-8 px-4 bg-secondary hover:bg-secondary/80 text-foreground font-medium text-xs rounded-lg border border-border transition-all flex items-center gap-1.5 whitespace-nowrap">
            <span className="material-symbols-outlined text-[14px]">notifications_active</span>
            Avise-me
          </button>
        )}
      </div>
    </article>
  );
}
