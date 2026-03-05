import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";
import { Loader2, ShoppingCart, Zap, Share2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [copied, setCopied] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  useEffect(() => {
    if (!slug) return;
    (supabase
      .from("products")
      .select("*") as any)
      .eq("slug", slug)
      .eq("status", "active")
      .maybeSingle()
      .then(({ data }: any) => {
        if (data) setProduct(data);
        setLoading(false);
      });
  }, [slug]);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: product?.name, text: `Confira ${product?.name} na FBFLIX!`, url });
      } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleBuyNow = () => {
    if (!user) {
      // Save intent and redirect to auth
      sessionStorage.setItem("product_redirect", `/produto/${slug}`);
      navigate("/auth");
      return;
    }
    navigate(`/checkout?product=${product.id}&qty=${quantity}`);
  };

  const handleAddToCart = () => {
    if (!user) {
      sessionStorage.setItem("product_redirect", `/produto/${slug}`);
      navigate("/auth");
      return;
    }
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity,
      image: product.image_url || "/placeholder.svg",
    });
    toast.success(`${product.name} adicionado ao carrinho!`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <h1 className="text-2xl font-bold text-foreground">Produto não encontrado</h1>
        <p className="text-muted-foreground">Este produto não existe ou foi removido.</p>
        <Button onClick={() => navigate(user ? "/loja" : "/auth")} variant="outline">
          Voltar à loja
        </Button>
      </div>
    );
  }

  const inStock = product.available && product.stock > 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
        {/* Header */}
        <div className="flex items-start gap-4">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-20 h-20 rounded-xl object-cover shrink-0 border border-border"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-20 h-20 rounded-xl bg-secondary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[32px] text-muted-foreground">inventory_2</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-foreground">{product.name}</h1>
            {product.badge_text && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 mt-1 ${product.badge_color || "bg-muted text-foreground border-border"}`}>
                {product.badge_text}
              </span>
            )}
          </div>
          <button
            onClick={handleShare}
            className="shrink-0 p-2 rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/50 transition-all"
            title="Compartilhar produto"
          >
            {copied ? <Check className="size-5" /> : <Share2 className="size-5" />}
          </button>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">Descrição</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {product.description || "Sem descrição disponível."}
          </p>
        </div>

        {/* Tags */}
        {product.tags?.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {product.tags.map((tag: string) => (
              <span key={tag} className="text-xs px-3 py-1 rounded-full bg-foreground text-background font-medium">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Stock info */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-medium">
            <span className={inStock ? (product.stock <= 10 ? "text-destructive" : "text-emerald-500") : "text-muted-foreground"}>
              {!inStock ? "Sem estoque" : product.stock <= 10 ? "Últimas unidades" : "Disponível"}
            </span>
            <span className="text-muted-foreground">
              {inStock ? `${product.stock} em estoque` : "Avise-me"}
            </span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${inStock ? (product.stock <= 10 ? "bg-gradient-to-r from-red-500 to-orange-500" : "bg-gradient-to-r from-green-400 to-green-600") : "bg-muted"}`}
              style={{ width: `${inStock ? Math.min(90, product.stock <= 10 ? 15 : product.stock) : 0}%` }}
            />
          </div>
        </div>

        {/* Price + Actions */}
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-border">
          <div>
            <p className="text-3xl font-bold text-foreground">
              R$ {product.price.toFixed(2).replace(".", ",")}
            </p>
            {product.price_label && (
              <p className="text-xs text-muted-foreground">{product.price_label}</p>
            )}
          </div>

          {inStock ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-secondary rounded-lg border border-border h-10 px-1">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-8 h-full flex items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  −
                </button>
                <span className="w-8 text-center text-sm font-medium text-foreground">{quantity}</span>
                <button
                  onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                  disabled={quantity >= product.stock}
                  className="w-8 h-full flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  +
                </button>
              </div>
              <button
                onClick={handleAddToCart}
                className="h-10 w-10 rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all flex items-center justify-center"
                title="Adicionar ao carrinho"
              >
                <ShoppingCart className="size-5" />
              </button>
              <button
                onClick={handleBuyNow}
                className="h-10 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm rounded-lg transition-all flex items-center gap-2 whitespace-nowrap"
              >
                <Zap className="size-4" />
                Comprar agora
              </button>
            </div>
          ) : (
            <button
              onClick={async () => {
                if (!user) { navigate("/auth"); return; }
                const { error } = await supabase.from("product_waitlist").insert({ user_id: user.id, product_id: product.id } as any);
                if (error?.code === '23505') toast.info("Você já será notificado!");
                else if (error) toast.error("Erro ao registrar");
                else toast.success("Você será notificado quando disponível!");
              }}
              className="h-10 px-6 bg-secondary hover:bg-secondary/80 text-foreground font-bold text-sm rounded-lg border border-border transition-all flex items-center gap-2"
            >
              Avise-me quando chegar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
