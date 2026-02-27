import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ShoppingCart, PackageCheck, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface AvailableProduct {
  waitlistId: string;
  productId: string;
  productName: string;
  productImage: string | null;
  productPrice: number;
}

export function WaitlistStockAlert() {
  const [product, setProduct] = useState<AvailableProduct | null>(null);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Only fetch entries still "waiting" — once user clicks a button,
      // status changes in DB so it won't appear again
      const { data: waitlist } = await supabase
        .from("product_waitlist")
        .select("id, product_id")
        .eq("user_id", user.id)
        .eq("status", "waiting");

      if (!waitlist || waitlist.length === 0) return;

      const pending = waitlist;
      if (pending.length === 0) return;

      const productIds = pending.map(w => w.product_id);

      // Check which products now have stock > 0
      const { data: products } = await supabase
        .from("products")
        .select("id, name, image_url, price, stock")
        .in("id", productIds)
        .gt("stock", 0);

      if (cancelled || !products || products.length === 0) return;

      const match = products[0];
      const wl = pending.find(w => w.product_id === match.id)!;

      setProduct({
        waitlistId: wl.id,
        productId: match.id,
        productName: match.name,
        productImage: match.image_url,
        productPrice: match.price,
      });
      setOpen(true);
    }

    // Small delay to not block initial render
    const timer = setTimeout(check, 2000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  const handleDismiss = async () => {
    if (product) {
      // Mark as dismissed permanently so it never shows again
      await supabase
        .from("product_waitlist")
        .update({ status: "dismissed" })
        .eq("id", product.waitlistId);
    }
    setOpen(false);
  };

  const handleGoToCheckout = async () => {
    if (!product) return;

    // Mark waitlist entry as notified
    await supabase
      .from("product_waitlist")
      .update({ status: "notified" })
      .eq("id", product.waitlistId);

    setOpen(false);
    navigate(`/checkout?product=${product.productId}`);
  };

  if (!product) return null;

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <AlertDialogContent className="border-green-500/30 bg-card max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center size-12 rounded-full bg-green-500/10">
              <PackageCheck className="size-6 text-green-500" />
            </div>
            <AlertDialogTitle className="text-lg text-foreground">
              Produto disponível!
            </AlertDialogTitle>
          </div>

          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p className="text-muted-foreground text-sm leading-relaxed">
                O produto que você pediu para ser avisado está de volta ao estoque!
              </p>

              {/* Product card */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/40">
                {product.productImage ? (
                  <img
                    src={product.productImage}
                    alt={product.productName}
                    className="size-12 rounded-lg object-cover"
                  />
                ) : (
                  <div className="size-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <PackageCheck className="size-6 text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm truncate">
                    {product.productName}
                  </p>
                  <p className="text-primary font-bold text-sm">
                    R$ {product.productPrice.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="gap-2 sm:flex-row">
          <Button
            onClick={handleGoToCheckout}
            className="bg-green-600 hover:bg-green-700 text-white gap-2"
          >
            <ShoppingCart className="size-4" />
            Comprar agora
          </Button>
          <Button
            variant="ghost"
            onClick={handleDismiss}
            className="text-muted-foreground"
          >
            Depois
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
