import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useProxyBRProducts } from "@/hooks/useProxyBR";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { ProxyProductCard } from "@/components/loja/ProxyProductCard";

export default function ProxyProductsShowcase() {
  const { data: productsData, isLoading, error } = useProxyBRProducts();
  const navigate = useNavigate();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [proxyImages, setProxyImages] = useState<{ name: string; url: string }[]>([]);

  useEffect(() => {
    supabase
      .from("product_images")
      .select("name, url")
      .eq("category", "proxy")
      .then(({ data }) => {
        if (data) setProxyImages(data);
      });
  }, []);

  const products: any[] = Array.isArray(productsData?.data)
    ? productsData.data
    : Array.isArray(productsData)
    ? productsData
    : [];

  const getQuantity = (id: string) => quantities[id] || 1;

  const getProxyImage = (productName: string): string | null => {
    const match = proxyImages.find(
      (img) => img.name.toLowerCase().trim() === productName.toLowerCase().trim()
    );
    return match?.url || null;
  };

  const updateQuantity = (id: string, delta: number) => {
    setQuantities((prev) => ({
      ...prev,
      [id]: Math.max(1, (prev[id] || 1) + delta),
    }));
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-3 text-center max-w-2xl mx-auto">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-2">
          <span className="material-symbols-outlined text-primary text-[32px]">vpn_lock</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight">
          Escolha seu Plano de Proxy
        </h1>
        <p className="text-muted-foreground text-base md:text-lg">
          Você ainda não possui nenhuma assinatura. Conheça nossos planos de proxy residencial e comece agora!
        </p>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-72 rounded-2xl" />
          ))}
        </div>
      )}

      {error && (
        <div className="text-center py-12">
          <span className="material-symbols-outlined text-[48px] text-destructive mb-4">error</span>
          <p className="text-destructive font-bold">Erro ao carregar produtos</p>
          <p className="text-muted-foreground text-sm mt-1">{(error as Error).message}</p>
        </div>
      )}

      {!isLoading && !error && products.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((product: any) => (
            <ProxyProductCard
              key={product.id}
              product={product}
              proxyImage={getProxyImage(product.name)}
              quantity={getQuantity(String(product.id))}
              onQuantityChange={updateQuantity}
            />
          ))}
        </div>
      )}

      {!isLoading && !error && products.length === 0 && (
        <div className="text-center py-12">
          <span className="material-symbols-outlined text-[48px] text-muted-foreground mb-4">inventory_2</span>
          <p className="text-muted-foreground">Nenhum produto disponível no momento.</p>
          <button
            onClick={() => navigate("/loja")}
            className="inline-flex items-center gap-2 mt-4 bg-primary hover:bg-primary/90 text-primary-foreground h-10 px-6 rounded-lg text-sm font-bold transition-all"
          >
            Visitar a Loja
          </button>
        </div>
      )}
    </div>
  );
}
