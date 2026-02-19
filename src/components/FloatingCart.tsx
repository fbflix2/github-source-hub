import { ShoppingCart } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useNavigate, useLocation } from "react-router-dom";

export function FloatingCart() {
  const { totalItems, totalPrice } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  // Hide on checkout page
  if (location.pathname === "/checkout") return null;

  if (totalItems === 0) return null;

  return (
    <button
      onClick={() => navigate("/checkout")}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-3 rounded-full shadow-lg shadow-primary/30 transition-all hover:scale-105 animate-scale-in"
    >
      <div className="relative">
        <ShoppingCart className="w-5 h-5" />
        <span className="absolute -top-2 -right-2 w-5 h-5 bg-foreground text-background text-[10px] font-bold rounded-full flex items-center justify-center">
          {totalItems}
        </span>
      </div>
      <div className="flex flex-col items-start leading-tight">
        <span className="text-xs opacity-80">Ver carrinho</span>
        <span className="text-sm font-bold">
          R$ {totalPrice.toFixed(2).replace(".", ",")}
        </span>
      </div>
    </button>
  );
}
