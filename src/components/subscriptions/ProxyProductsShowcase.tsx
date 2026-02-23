import { useProxyBRProducts } from "@/hooks/useProxyBR";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProxyProductsShowcase() {
  const { data: productsData, isLoading, error } = useProxyBRProducts();

  const products: any[] = Array.isArray(productsData?.data)
    ? productsData.data
    : Array.isArray(productsData)
    ? productsData
    : [];

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

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-center py-12">
          <span className="material-symbols-outlined text-[48px] text-destructive mb-4">error</span>
          <p className="text-destructive font-bold">Erro ao carregar produtos</p>
          <p className="text-muted-foreground text-sm mt-1">{(error as Error).message}</p>
        </div>
      )}

      {/* Products Grid */}
      {!isLoading && !error && products.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product: any) => {
            const variants = product.variants?.data || product.variants || [];
            const cheapestVariant = variants.length
              ? variants.reduce((min: any, v: any) =>
                  (v.price || 0) < (min.price || 0) ? v : min, variants[0])
              : null;
            const price = cheapestVariant?.price || product.price || 0;
            const formattedPrice = new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
            }).format(price);

            return (
              <div
                key={product.id}
                className="glass-panel rounded-2xl p-6 flex flex-col gap-4 border border-border hover:border-primary/40 transition-all group hover:shadow-lg hover:shadow-primary/5"
              >
                {/* Icon + Type */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <span className="material-symbols-outlined">
                      {product.type === "RESIDENTIAL" ? "home" : product.type === "MOBILE" ? "smartphone" : "dns"}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-foreground font-bold text-base truncate">{product.name}</h3>
                    {product.type && (
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">{product.type}</span>
                    )}
                  </div>
                </div>

                {/* Description */}
                {product.description && (
                  <p className="text-muted-foreground text-sm line-clamp-2">{product.description}</p>
                )}

                {/* Variants count */}
                {variants.length > 1 && (
                  <p className="text-xs text-muted-foreground">
                    {variants.length} variações disponíveis
                  </p>
                )}

                {/* Price + CTA */}
                <div className="mt-auto pt-4 border-t border-border flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">A partir de</p>
                    <p className="text-2xl font-black text-foreground">{formattedPrice}</p>
                    <p className="text-xs text-muted-foreground">/mês</p>
                  </div>
                  <a
                    href="/loja"
                    className="bg-primary hover:bg-primary/90 text-primary-foreground h-10 px-5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shrink-0"
                  >
                    <span className="material-symbols-outlined text-[18px]">shopping_cart</span>
                    Assinar
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* No products fallback */}
      {!isLoading && !error && products.length === 0 && (
        <div className="text-center py-12">
          <span className="material-symbols-outlined text-[48px] text-muted-foreground mb-4">inventory_2</span>
          <p className="text-muted-foreground">Nenhum produto disponível no momento.</p>
          <a
            href="/loja"
            className="inline-flex items-center gap-2 mt-4 bg-primary hover:bg-primary/90 text-primary-foreground h-10 px-6 rounded-lg text-sm font-bold transition-all"
          >
            Visitar a Loja
          </a>
        </div>
      )}
    </div>
  );
}
