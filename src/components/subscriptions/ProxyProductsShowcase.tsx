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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-72 rounded-2xl" />
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

      {/* Products Grid - Same design as Loja grid cards */}
      {!isLoading && !error && products.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((product: any) => {
            const variants = product.variants?.data || product.variants || [];
            const cheapestVariant = variants.length
              ? variants.reduce((min: any, v: any) =>
                  (v.price || 0) < (min.price || 0) ? v : min, variants[0])
              : null;
            const price = cheapestVariant?.price || product.price || 0;
            const formattedPrice = `R$ ${Number(price).toFixed(2).replace(".", ",")}`;

            const typeIcon = product.type === "RESIDENTIAL" ? "home" : product.type === "MOBILE" ? "smartphone" : "dns";
            const typeLabel = product.type || "Proxy";

            return (
              <article
                key={product.id}
                className="glass-card rounded-2xl overflow-hidden flex flex-col group h-full"
              >
                <div className="p-5 flex flex-col flex-1 gap-4">
                  {/* Header: icon + name + price */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-secondary flex items-center justify-center">
                        <span className="material-symbols-outlined text-[20px] text-muted-foreground">{typeIcon}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors truncate">
                          {product.name}
                        </h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 shrink-0 bg-primary/10 text-primary border-primary/20">
                          <span className="material-symbols-outlined text-[11px]">bolt</span>
                          {typeLabel}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 whitespace-nowrap">
                      <p className="text-xl font-bold text-foreground">{formattedPrice}</p>
                      <p className="text-[10px] text-muted-foreground">mensal</p>
                    </div>
                  </div>

                  {/* Description */}
                  {product.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{product.description}</p>
                  )}

                  {/* Variants info as tags */}
                  {variants.length > 1 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-foreground text-background font-medium">
                        {variants.length} planos
                      </span>
                    </div>
                  )}

                  {/* Availability Bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-primary flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        Disponível
                      </span>
                      {variants.length > 0 && (
                        <span className="text-muted-foreground">A partir de {formattedPrice}</span>
                      )}
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-600 w-[80%]" />
                    </div>
                  </div>

                  {/* Actions - Same layout as Loja */}
                  <div className="mt-auto pt-4 flex flex-col gap-3 border-t border-border">
                    <a
                      href="/loja"
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm h-10 rounded-lg transition-all flex items-center justify-center gap-2 shadow-[0_0_10px_rgba(220,38,38,0.2)]"
                    >
                      <span className="material-symbols-outlined text-[18px]">flash_on</span>
                      Comprar agora
                    </a>
                  </div>
                </div>
              </article>
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
