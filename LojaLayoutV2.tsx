import { ReactNode, useState } from "react";
import { ArrowUpRight, BellRing, ChevronDown, Minus, Plus, Search, ShoppingCart, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

async function notifyMe(productId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    toast.error("Faça login para ser avisado");
    return;
  }
  const { error } = await supabase.from("product_waitlist" as any).insert({ user_id: user.id, product_id: productId } as any);
  if (error && (error as any).code === "23505") {
    toast.info("Você já será notificado quando este produto chegar!");
  } else if (error) {
    toast.error("Erro ao registrar interesse");
  } else {
    toast.success("Você será notificado quando este produto estiver disponível!");
  }
}

interface V2Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  stock: number;
  available: boolean;
  category_id: string | null;
  tags: string[] | null;
  badge_text?: string | null;
  badge_color?: string | null;
  badge_icon?: string | null;
}

interface Props {
  banner?: ReactNode;
  headline?: string;
  headlineVisible?: boolean;
  products: V2Product[];
  categoryName: (id: string | null) => string | undefined;
  filters: string[];
  activeFilter: string;
  onFilterChange: (f: string) => void;
  purposes?: string[];
  activePurpose?: string;
  onPurposeChange?: (p: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onAddToCart: (p: V2Product, quantity: number) => void;
  onBuy: (p: V2Product, quantity: number) => void;
  onDetail: (p: V2Product) => void;
  onUseLegacy?: () => void;
}

export function LojaLayoutV2({
  banner,
  headline = "Ativos prontos para escalar",
  headlineVisible = true,
  products,
  categoryName,
  filters,
  activeFilter,
  onFilterChange,
  purposes = [],
  activePurpose = "Todos",
  onPurposeChange,
  searchQuery,
  onSearchChange,
  onAddToCart,
  onBuy,
  onDetail,
  onUseLegacy,
}: Props) {
  const [showAll, setShowAll] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const qtyOf = (id: string) => quantities[id] ?? 1;
  const setQty = (id: string, next: number) =>
    setQuantities((prev) => ({ ...prev, [id]: Math.max(1, next) }));
  const wordLabel = activeFilter === "Todos" ? "Loja" : activeFilter;
  const visible = showAll ? products : products.slice(0, 6);

  return (
    <div className="relative overflow-hidden pb-24 pt-2">
      <div className="relative z-10 mx-auto max-w-[1240px]">
        {banner && <div className="mb-10">{banner}</div>}
        {/* header + busca */}
        <div className="flex flex-col items-center text-center">
          {headlineVisible && headline?.trim() && (
            <h1 className="mt-5 text-[34px] font-semibold leading-[1.05] tracking-[-0.035em] text-foreground md:text-[46px]">
              {headline}
            </h1>
          )}
          <div className="lp-glass-search mt-8 flex w-full max-w-xl items-center gap-3 rounded-full px-5 py-3.5">
            <Search className="size-[17px] shrink-0 text-white/45" />
            <input
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar por produto ou finalidade: perfil, black, bm, proxy..."
              aria-label="Buscar produtos"
              className="w-full bg-transparent text-[14px] tracking-[-0.015em] text-white outline-none placeholder:text-white/35"
            />
            {searchQuery && (
              <button onClick={() => onSearchChange("")} aria-label="Limpar busca" className="text-white/40 hover:text-white">
                <X className="size-[15px]" />
              </button>
            )}
          </div>

          {/* filtros */}
          <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => onFilterChange(f)}
                className={`rounded-lg border px-4 py-2 text-[13px] font-medium tracking-[-0.015em] transition-colors duration-300 ${
                  activeFilter === f
                    ? "border-[#e50914]/45 bg-[#e50914]/12 text-white"
                    : "border-white/[0.09] bg-white/[0.02] text-white/70 hover:border-[#e50914]/35 hover:text-white"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {purposes.length > 1 && onPurposeChange && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              {purposes.map((p) => (
                <button
                  key={p}
                  onClick={() => onPurposeChange(p)}
                  className={`rounded-full border px-3.5 py-1.5 text-[11.5px] transition-colors ${
                    activePurpose === p
                      ? "border-white/30 bg-white/[0.08] text-white"
                      : "border-white/[0.08] text-white/50 hover:text-white"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* vitrine */}
        <div className="relative mt-16">
          <div className="pointer-events-none absolute inset-x-0 -top-6 flex justify-center overflow-visible">
            <span className="lp-word select-none whitespace-nowrap text-[22vw] sm:text-[20vw] md:text-[15.5vw] lg:text-[200px]">
              {wordLabel}
            </span>
          </div>

          <div className="relative pt-[11vw] md:pt-[120px]">
            {products.length === 0 ? (
              <div className="lp-shop-card rounded-2xl px-6 py-14 text-center text-[14px] text-white/50">
                Nenhum ativo encontrado nessa categoria.
              </div>
            ) : (
              <>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {visible.map((p) => {
                    const soldOut = !p.available || p.stock === 0;
                    return (
                      <article key={p.id} className="lp-shop-card flex flex-col rounded-2xl p-6">
                        <div className="flex items-center gap-3">
                          {p.image_url && (
                            <img
                              src={p.image_url}
                              alt={p.name}
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              className="size-9 shrink-0 rounded-lg object-cover"
                            />
                          )}
                          <span className="inline-flex w-fit rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium tracking-[-0.01em] text-white/60">
                            {categoryName(p.category_id) || wordLabel}
                          </span>
                        </div>

                        <h3 className="mt-4 flex flex-wrap items-center gap-2 text-[19px] font-medium leading-tight tracking-[-0.025em] text-white">
                          <span>{p.name}</span>
                          {p.badge_text && (
                            <span
                              className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-[1px] text-[8.5px] font-bold leading-none ${
                                p.badge_color || "border-white/15 bg-white/[0.06] text-white"
                              }`}
                            >
                              {p.badge_icon && (
                                <span className="material-symbols-outlined text-[9px] leading-none">{p.badge_icon}</span>
                              )}
                              {p.badge_text}
                            </span>
                          )}
                        </h3>

                        {p.description && (
                          <p className="mt-3 line-clamp-3 text-[13.5px] leading-relaxed text-white/45">
                            {p.description}
                          </p>
                        )}

                        <button
                          onClick={() => onDetail(p)}
                          className="mt-4 w-fit rounded-lg border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-[12.5px] font-medium text-white/85 transition-colors hover:border-white/30 hover:bg-white/[0.1] hover:text-white"
                        >
                          Ver detalhes
                        </button>

                        <p className="mt-4 text-[11.5px] tracking-[-0.01em] text-white/40">
                          {soldOut ? "Sem estoque" : `${p.stock} em estoque`}
                        </p>

                        {!soldOut && (
                          <div className="mt-4 flex items-center gap-3">
                            <span className="text-[11.5px] text-white/40">Quantidade</span>
                            <div className="flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.03] px-1 py-1">
                              <button
                                onClick={() => setQty(p.id, qtyOf(p.id) - 1)}
                                aria-label="Diminuir quantidade"
                                className="grid size-6 place-items-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                              >
                                <Minus className="size-[13px]" />
                              </button>
                              <span className="w-6 text-center text-[13px] font-medium text-white">{qtyOf(p.id)}</span>
                              <button
                                onClick={() => setQty(p.id, qtyOf(p.id) + 1)}
                                aria-label="Aumentar quantidade"
                                className="grid size-6 place-items-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                              >
                                <Plus className="size-[13px]" />
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="mt-5 flex flex-1 items-end justify-between gap-3 border-t border-white/[0.07] pt-5">
                          <p className="text-[26px] font-semibold tracking-[-0.03em] text-white">
                            R$ {Number(p.price || 0).toFixed(2).replace(".", ",")}
                          </p>
                          <div className="flex items-center gap-2">
                            {!soldOut && (
                              <button
                                onClick={() => onAddToCart(p, qtyOf(p.id))}
                                title="Adicionar ao carrinho"
                                className="grid size-9 place-items-center rounded-full border border-white/12 bg-white/[0.04] text-white/70 transition-colors hover:border-[#e50914]/40 hover:text-white"
                              >
                                <ShoppingCart className="size-[15px]" />
                              </button>
                            )}
                            {soldOut && (
                              <button
                                onClick={() => notifyMe(p.id)}
                                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-[12.5px] font-medium tracking-[-0.01em] text-white/85 transition-colors hover:border-white/30 hover:bg-white/[0.1] hover:text-white"
                              >
                                <BellRing className="size-[14px]" />
                                Avise-me
                              </button>
                            )}
                            <button
                              onClick={() => onBuy(p, qtyOf(p.id))}
                              disabled={soldOut}
                              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[12.5px] font-medium tracking-[-0.01em] text-black transition-transform duration-300 hover:scale-[1.04] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
                            >
                              {soldOut ? "Esgotado" : "Comprar"}
                              {!soldOut && <ArrowUpRight className="size-[14px]" />}
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {products.length > 6 && (
                  <div className="mt-10 flex justify-center">
                    <button
                      onClick={() => setShowAll((v) => !v)}
                      className="lp-glass-search inline-flex items-center gap-2 rounded-full px-6 py-3 text-[13px] font-medium tracking-[-0.015em] text-white/85 transition-colors hover:text-white"
                    >
                      {showAll ? "Ver menos" : `Ver mais (${products.length - 6})`}
                      <ChevronDown className={`size-[15px] transition-transform duration-300 ${showAll ? "rotate-180" : ""}`} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
