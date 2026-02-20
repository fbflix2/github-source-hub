import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";

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
}

interface Props {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quantity: number;
  onQuantityChange: (id: string, delta: number, maxStock?: number) => void;
}

function getStockInfo(product: Product) {
  if (!product.available || product.stock === 0) {
    return { status: "Sem estoque", statusColor: "text-muted-foreground", percentage: 0, sold: "Avise-me" };
  }
  if (product.stock <= 10) {
    return { status: "Últimas unidades", statusColor: "text-destructive", percentage: 15, sold: `${product.stock} restantes` };
  }
  return { status: "Em estoque", statusColor: "text-primary", percentage: Math.min(90, product.stock), sold: `${product.stock} em estoque` };
}

export function ProductDetailModal({ product, open, onOpenChange, quantity, onQuantityChange }: Props) {
  const navigate = useNavigate();
  const { addItem } = useCart();

  if (!product) return null;

  const stockInfo = getStockInfo(product);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-12 h-12 rounded-lg object-cover shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[24px] text-muted-foreground">inventory_2</span>
              </div>
            )}
            <div>
              <span className="text-lg">{product.name}</span>
              {product.badge_text && (
                <span
                  className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${
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
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Description */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">Descrição</h4>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {product.description || "Sem descrição disponível."}
            </p>
          </div>

          {/* Tags */}
          {product.tags && product.tags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {product.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-3 py-1 rounded-full bg-secondary text-muted-foreground border border-border"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Stock */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-medium">
              <span className={`${stockInfo.statusColor} flex items-center gap-1`}>
                {stockInfo.percentage > 0 && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      stockInfo.statusColor === "text-primary" ? "bg-primary animate-pulse" : "bg-destructive"
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
                  stockInfo.statusColor === "text-primary"
                    ? "bg-gradient-to-r from-green-400 to-green-600"
                    : stockInfo.statusColor === "text-destructive"
                    ? "bg-gradient-to-r from-red-500 to-orange-500"
                    : "bg-muted"
                }`}
                style={{ width: `${stockInfo.percentage}%` }}
              />
            </div>
          </div>

          {/* Price + Actions */}
          <div className="flex items-center justify-between gap-4 pt-3 border-t border-border">
            <div>
              <p className="text-2xl font-bold text-foreground">
                {product.available ? `R$ ${product.price.toFixed(2).replace(".", ",")}` : "---"}
              </p>
              {product.price_label && (
                <p className="text-xs text-muted-foreground">{product.price_label}</p>
              )}
            </div>

            {product.available ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center bg-secondary rounded-lg border border-border h-10 px-1">
                  <button
                    onClick={() => onQuantityChange(product.id, -1, product.stock)}
                    className="w-8 h-full flex items-center justify-center text-muted-foreground hover:text-foreground rounded transition"
                  >
                    <span className="material-symbols-outlined text-[16px]">remove</span>
                  </button>
                  <span className="w-8 text-center text-sm font-medium text-foreground">{quantity}</span>
                  <button
                    onClick={() => onQuantityChange(product.id, 1, product.stock)}
                    disabled={quantity >= product.stock}
                    className="w-8 h-full flex items-center justify-center text-muted-foreground hover:text-foreground rounded transition disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                  </button>
                </div>
                <button
                  onClick={() => {
                    addItem({
                      productId: Number(product.id.substring(0, 8)),
                      name: product.name,
                      price: product.price,
                      quantity,
                      image: product.image_url || "/placeholder.svg",
                    });
                    toast.success(`${product.name} adicionado ao carrinho!`);
                  }}
                  className="h-10 w-10 rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all flex items-center justify-center"
                  title="Adicionar ao carrinho"
                >
                  <span className="material-symbols-outlined text-[20px]">shopping_cart</span>
                </button>
                <button
                  onClick={() => {
                    onOpenChange(false);
                    navigate(`/checkout?product=${product.id}&qty=${quantity}`);
                  }}
                  className="h-10 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm rounded-lg transition-all flex items-center gap-2 whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-[18px]">flash_on</span>
                  Comprar agora
                </button>
              </div>
            ) : (
              <button className="h-10 px-6 bg-secondary hover:bg-secondary/80 text-foreground font-bold text-sm rounded-lg border border-border transition-all flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">notifications_active</span>
                Avise-me quando chegar
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
