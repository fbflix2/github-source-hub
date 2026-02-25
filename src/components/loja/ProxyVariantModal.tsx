import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";

interface Variant {
  id: number;
  location: string;
  price: number;
  stocks: number;
}

interface ProxyVariantModalProps {
  open: boolean;
  onClose: () => void;
  product: any;
  localData?: {
    id?: string;
    name?: string | null;
    description?: string | null;
    image_url?: string | null;
    price?: number;
  } | null;
  proxyImage: string | null;
}

export function ProxyVariantModal({ open, onClose, product, localData, proxyImage }: ProxyVariantModalProps) {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [quantity, setQuantity] = useState(1);

  const variants: Variant[] = product?.variants?.data || product?.variants || [];
  const displayName = localData?.name || product?.name || "Proxy";
  const imageUrl = localData?.image_url || proxyImage;
  const typeLabel = product?.type || "Proxy";

  const handleBuy = () => {
    if (!selectedVariant) {
      toast.error("Selecione uma localização");
      return;
    }

    const price = (localData?.price != null && localData.price > 0) ? localData.price : selectedVariant.price;
    const productId = localData?.id || String(product.id);

    // Store variant info in sessionStorage for checkout to use
    sessionStorage.setItem("proxy_purchase", JSON.stringify({
      product_variant_id: selectedVariant.id,
      api_product_id: product.id,
      variant_location: selectedVariant.location,
      quantity,
      interval: "monthly",
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
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="glass-card border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-3">
            {imageUrl && (
              <div className="shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-secondary flex items-center justify-center">
                <img src={imageUrl} alt={displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
            )}
            <div>
              <p className="text-base font-bold">{displayName}</p>
              <span className="text-xs text-muted-foreground font-normal">{typeLabel}</span>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Variant selection */}
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-foreground">Escolha a localização</h4>
            <div className="grid grid-cols-1 gap-2">
              {variants.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVariant(v)}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all text-left ${
                    selectedVariant?.id === v.id
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "border-border bg-secondary/50 hover:border-muted-foreground"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[20px] text-primary">location_on</span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{v.location}</p>
                      <p className="text-xs text-muted-foreground">{v.stocks} disponíveis</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-foreground">
                      R$ {Number((localData?.price != null && localData.price > 0) ? localData.price : v.price).toFixed(2).replace(".", ",")}
                    </p>
                    <p className="text-[10px] text-muted-foreground">mensal</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Quantity */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Quantidade</span>
            <div className="flex items-center bg-secondary rounded-lg border border-border h-10 px-1">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-8 h-full flex items-center justify-center text-muted-foreground hover:text-foreground rounded transition"
              >
                <span className="material-symbols-outlined text-[16px]">remove</span>
              </button>
              <span className="w-8 text-center text-sm font-medium text-foreground">{quantity}</span>
              <button
                onClick={() => setQuantity((q) => q + 1)}
                className="w-8 h-full flex items-center justify-center text-muted-foreground hover:text-foreground rounded transition"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
              </button>
            </div>
          </div>

          {/* Buy button */}
          <button
            onClick={handleBuy}
            disabled={!selectedVariant}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm h-12 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[18px]">flash_on</span>
            Comprar agora
            {selectedVariant && (
              <span className="ml-1">
                — R$ {(Number((localData?.price != null && localData.price > 0) ? localData.price : selectedVariant.price) * quantity).toFixed(2).replace(".", ",")}
              </span>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
