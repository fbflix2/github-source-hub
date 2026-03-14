import { useState, useEffect, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

type OrderStatus = "completed" | "processing" | "cancelled";

interface ComboProfile {
  id: string;
  name: string;
  identification: string | null;
  identificationLink: string | null;
}

interface OrderItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  quantity: number;
  isBlocked?: boolean;
  iconType?: string;
  isReplaced?: boolean;
  replacedAt?: string;
  comboProfiles?: ComboProfile[];
}

interface Order {
  id: string;
  code: string;
  status: string;
  total: number;
  subtotal: number;
  discount: number;
  payment_method: string | null;
  payment_last4: string | null;
  payment_expiry: string | null;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
}

const filters = [
  { key: "all", label: "Todos" },
  { key: "completed", label: "Concluídos" },
  { key: "processing", label: "Processando" },
];

const statusConfig: Record<string, { label: string; className: string; badgeClassName: string }> = {
  completed: { label: "Concluído", className: "border-l-emerald-500 bg-muted/50", badgeClassName: "bg-emerald-500/20 text-emerald-400 border-emerald-500/20" },
  processing: { label: "Pendente", className: "opacity-80 hover:opacity-100", badgeClassName: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  cancelled: { label: "Cancelado", className: "opacity-60", badgeClassName: "bg-destructive/10 text-destructive border-destructive/20" },
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
};

const formatDateFull = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

export default function Orders() {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  // Lock parent overflow to prevent page scroll - only left cards scroll
  useLayoutEffect(() => {
    const main = document.querySelector('main');
    if (main) {
      main.style.overflow = 'hidden';
      main.style.height = 'calc(100vh - 7rem)';
      main.style.paddingBottom = '0';
    }
    return () => {
      if (main) {
        main.style.overflow = '';
        main.style.height = '';
        main.style.paddingBottom = '';
      }
    };
  }, []);

  useEffect(() => {
    async function fetchOrders() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: ordersData, error } = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", user.id)
        .not("status", "in", '("abandoned","cancelled")')
        .order("created_at", { ascending: false });

      if (error || !ordersData) { setLoading(false); return; }

      const orderIds = ordersData.map((o) => o.id);
      const { data: itemsData } = await supabase
        .from("order_items")
        .select("*, products:product_id(icon_type)")
        .in("order_id", orderIds.length > 0 ? orderIds : ["__none__"]);

      // Fetch ALL stock_items linked to order_items
      const itemIds = (itemsData || []).map((i) => i.id);
      const { data: allStockItems } = await supabase
        .from("stock_items")
        .select("id, order_item_id, status, type, parent_id, name, identification, identification_link")
        .in("order_item_id", itemIds.length > 0 ? itemIds : ["__none__"]);

      // Separate parents (no parent_id) and children (have parent_id)
      const parentStockItems = (allStockItems || []).filter((s: any) => !s.parent_id);
      const childStockItems = (allStockItems || []).filter((s: any) => !!s.parent_id);

      // Also fetch children by parent_id if not already found via order_item_id
      const comboParentIds = parentStockItems
        .filter((s: any) => s.type === 'combo')
        .map((s: any) => s.id);
      
      let extraChildren: any[] = [];
      if (comboParentIds.length > 0) {
        const existingChildParentIds = new Set(childStockItems.map((c: any) => c.parent_id));
        const missingParentIds = comboParentIds.filter((id: string) => !existingChildParentIds.has(id));
        if (missingParentIds.length > 0) {
          const { data: extra } = await supabase
            .from("stock_items")
            .select("id, parent_id, name, identification, identification_link, order_item_id")
            .in("parent_id", missingParentIds);
          extraChildren = extra || [];
        }
      }

      const allChildren = [...childStockItems, ...extraChildren];

      const blockedItemIds = new Set(
        parentStockItems
          .filter((s: any) => s.status === "bloqueado")
          .map((s: any) => s.order_item_id)
          .filter(Boolean)
      );

      const comboProfilesByOrderItemId = new Map<string, ComboProfile[]>();
      parentStockItems.forEach((parent: any) => {
        if (!parent.order_item_id) return;

        const children = allChildren
          .filter((child: any) => child.parent_id === parent.id)
          .map((child: any) => ({
            id: child.id,
            name: child.name || "Perfil",
            identification: child.identification || null,
            identificationLink: child.identification_link || null,
          }));

        if (children.length > 0 || parent.type === "combo") {
          comboProfilesByOrderItemId.set(parent.order_item_id, children);
        }
      });

      // Filter out proxy-only orders
      const nonProxyOrders = ordersData.filter((order) => {
        const items = (itemsData || []).filter((i: any) => i.order_id === order.id);
        const allProxy = items.length > 0 && items.every((i: any) => i.products?.icon_type === 'proxy');
        return !allProxy;
      });

      const enriched: Order[] = nonProxyOrders.map((order) => ({
        ...order,
        items: (itemsData || [])
          .filter((i: any) => i.order_id === order.id)
          .map((i: any) => ({
            ...i,
            isBlocked: blockedItemIds.has(i.id),
            iconType: i.products?.icon_type,
            isReplaced: !!(i.delivery_data as any)?._replaced,
            replacedAt: (i.delivery_data as any)?._replaced_at || null,
            comboProfiles: comboProfilesByOrderItemId.get(i.id) || [],
          })),
      })).filter(o => o.items.length > 0);

      setOrders(enriched);
      if (enriched.length > 0) setSelectedOrder(enriched[0]);
      setLoading(false);
    }
    fetchOrders();
  }, []);

  const filteredOrders = orders.filter((order) => {
    if (activeFilter === "all") return true;
    return order.status === activeFilter;
  });

  const status = selectedOrder ? (statusConfig[selectedOrder.status] || statusConfig.processing) : null;
  const subtotal = selectedOrder ? selectedOrder.items.reduce((acc, item) => acc + item.price * item.quantity, 0) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full animate-fade-in overflow-hidden">
      {/* Page Header - compact */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-3 shrink-0">
        <div>
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
            <a className="hover:text-foreground transition-colors cursor-pointer">Dashboard</a>
            <span className="material-symbols-outlined text-[10px]">chevron_right</span>
            <span className="text-foreground">Meus Pedidos</span>
          </div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Histórico de Pedidos</h1>
        </div>
        <div className="flex gap-1.5">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg font-medium text-xs transition whitespace-nowrap ${
                activeFilter === f.key
                  ? "bg-primary text-primary-foreground font-bold shadow-glow"
                  : "glass-panel text-muted-foreground hover:text-foreground hover:bg-muted border border-transparent hover:border-border"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-20">
          <span className="material-symbols-outlined text-[48px] text-muted-foreground mb-4">inbox</span>
          <p className="text-muted-foreground text-lg">Você ainda não tem pedidos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 flex-1 min-h-0">
          {/* Orders List - scrollable */}
          <div className="flex flex-col gap-2 overflow-y-auto pr-1 custom-scrollbar min-w-0">
            {filteredOrders.map((order) => {
              const st = statusConfig[order.status] || statusConfig.processing;
              const isSelected = selectedOrder?.id === order.id;
              return (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className={`glass-panel p-4 pb-5 rounded-xl cursor-pointer group border-l-[3px] hover:bg-muted transition-all relative ${
                    isSelected ? st.className : "border-l-transparent opacity-80 hover:opacity-100"
                  }`}
                >
                  {isSelected && (
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/5 to-transparent pointer-events-none"></div>
                  )}
                  <div className="relative z-10 flex flex-col gap-3 min-h-[72px]">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[10px] text-muted-foreground font-mono leading-normal">{order.code}</p>
                        <h3 className="text-foreground font-semibold text-sm leading-tight">
                          {order.items.length > 0 ? order.items[0].name : "Pedido"}
                          {order.items.length > 1 && ` +${order.items.length - 1}`}
                        </h3>
                        {order.items.some((i) => i.isReplaced) && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-bold uppercase w-fit mt-0.5">
                            <span className="material-symbols-outlined text-[10px]">swap_horiz</span>
                            Reposto
                          </span>
                        )}
                        {order.items.some((i) => i.isBlocked) && !order.items.some((i) => i.isReplaced) && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-destructive/20 text-destructive border border-destructive/30 text-[9px] font-bold uppercase w-fit mt-0.5">
                            <span className="material-symbols-outlined text-[10px]">block</span>
                            Bloqueado
                          </span>
                        )}
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border shrink-0 ${st.badgeClassName}`}>
                        {st.label}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-auto">
                      <span className="flex items-center gap-1 text-muted-foreground text-xs leading-normal">
                        <span className="material-symbols-outlined text-[13px]">calendar_today</span>
                        {formatDate(order.created_at)}
                      </span>
                      <p className="text-foreground font-bold text-base leading-normal">R$ {order.total.toFixed(2).replace(".", ",")}</p>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredOrders.length === 0 && (
              <div className="text-center py-12">
                <span className="material-symbols-outlined text-[48px] text-muted-foreground mb-4">inbox</span>
                <p className="text-muted-foreground">Nenhum pedido encontrado.</p>
              </div>
            )}
          </div>

          {/* Order Details - fixed, no scroll */}
          {selectedOrder && status && (
            <div className="min-w-0 overflow-y-auto">
              <div className="glass-panel rounded-xl flex flex-col overflow-hidden border border-border">
                <div className="px-4 py-3 border-b border-border flex flex-wrap gap-3 justify-between items-center bg-muted/50">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-bold text-foreground">Pedido {selectedOrder.code}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        selectedOrder.status === "completed"
                          ? "bg-emerald-500 text-white"
                          : selectedOrder.status === "processing"
                          ? "bg-yellow-500 text-background"
                          : "bg-destructive text-destructive-foreground"
                      }`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-xs">{formatDateFull(selectedOrder.created_at)}</p>
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-[16px]">shopping_bag</span> Itens do Pedido
                  </h4>

                    <div className="flex flex-col gap-2">
                      {(() => {
                        // Group BM and Page items into single rows, expand others individually
                        const bmItems = selectedOrder.items.filter(i => i.iconType === 'bm' && !(i.comboProfiles?.length));
                        const pageItems = selectedOrder.items.filter(i => i.iconType === 'page' && !(i.comboProfiles?.length));
                        const proxyItems = selectedOrder.items.filter(i => i.iconType === 'proxy' && !(i.comboProfiles?.length));
                        const otherItems = selectedOrder.items.filter(i => (
                          i.iconType !== 'bm' && i.iconType !== 'page' && i.iconType !== 'proxy'
                        ) || !!i.comboProfiles?.length);
                        const rows: { key: string; name: string; subtitle: string; price: number; totalPrice: number; itemId: string; isBlocked: boolean; isReplaced: boolean; replacedAt: string | null; isBm: boolean; isPage: boolean; isProxy: boolean; hidePrice?: boolean; comboStockItemId?: string }[] = [];

                        // BM: single grouped row
                        if (bmItems.length > 0) {
                          const totalBmPrice = bmItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
                          const totalBmQty = bmItems.reduce((sum, i) => sum + i.quantity, 0);
                          rows.push({
                            key: 'bm-group',
                            name: bmItems[0].name,
                            subtitle: totalBmQty > 1 ? `${totalBmQty} BMs neste pedido` : 'Unidade 1 de 1',
                            price: totalBmPrice,
                            totalPrice: totalBmPrice,
                            itemId: bmItems[0].id,
                            isBlocked: bmItems.some(i => i.isBlocked),
                            isReplaced: bmItems.some(i => i.isReplaced),
                            replacedAt: bmItems.find(i => i.replacedAt)?.replacedAt || null,
                            isBm: true,
                            isPage: false,
                            isProxy: false,
                          });
                        }

                        // Page: single grouped row
                        if (pageItems.length > 0) {
                          const totalPageQty = pageItems.reduce((sum, i) => sum + i.quantity, 0);
                          const totalPagePrice = pageItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
                          rows.push({
                            key: 'page-group',
                            name: pageItems[0].name,
                            subtitle: totalPageQty > 1 ? `${totalPageQty} páginas neste pedido` : 'Unidade 1 de 1',
                            price: totalPagePrice,
                            totalPrice: totalPagePrice,
                            itemId: pageItems[0].id,
                            isBlocked: pageItems.some(i => i.isBlocked),
                            isReplaced: pageItems.some(i => i.isReplaced),
                            replacedAt: pageItems.find(i => i.replacedAt)?.replacedAt || null,
                            isBm: false,
                            isPage: true,
                            isProxy: false,
                          });
                        }

                        // Proxy: grouped row linking to subscriptions
                        if (proxyItems.length > 0) {
                          const totalProxyPrice = proxyItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
                          const totalProxyQty = proxyItems.reduce((sum, i) => sum + i.quantity, 0);
                          rows.push({
                            key: 'proxy-group',
                            name: proxyItems[0].name,
                            subtitle: totalProxyQty > 1 ? `${totalProxyQty} proxies — ver em Assinaturas` : 'Gerenciar em Assinaturas',
                            price: totalProxyPrice,
                            totalPrice: totalProxyPrice,
                            itemId: proxyItems[0].id,
                            isBlocked: false,
                            isReplaced: false,
                            replacedAt: null,
                            isBm: false,
                            isPage: false,
                            isProxy: true,
                          });
                        }

                        // Others: expand as before (with combo profiles as separate rows)
                        otherItems.forEach(item => {
                          const comboProfiles = item.comboProfiles || [];

                          if (comboProfiles.length > 0) {
                            const unitPrice = item.price / comboProfiles.length;
                            comboProfiles.forEach((profile, idx) => {
                              rows.push({
                                key: `${item.id}-combo-${profile.id}`,
                                name: `${item.name} • Item ${idx + 1}`,
                                subtitle: profile.identificationLink || profile.identification || profile.name,
                                price: unitPrice,
                                totalPrice: unitPrice,
                                hidePrice: true,
                                itemId: item.id,
                                comboStockItemId: profile.id,
                                isBlocked: !!item.isBlocked,
                                isReplaced: !!item.isReplaced,
                                replacedAt: item.replacedAt || null,
                                isBm: false,
                                isPage: false,
                                isProxy: false,
                              });
                            });
                            return;
                          }

                          const count = item.quantity > 1 ? item.quantity : 1;
                          for (let idx = 0; idx < count; idx++) {
                            rows.push({
                              key: `${item.id}-${idx}`,
                              name: item.name,
                              subtitle: item.description || `Unidade ${idx + 1} de ${count}`,
                              price: item.price,
                              totalPrice: item.price,
                              itemId: item.id,
                              isBlocked: !!item.isBlocked,
                              isReplaced: !!item.isReplaced,
                              replacedAt: item.replacedAt || null,
                              isBm: false,
                              isPage: false,
                              isProxy: false,
                            });
                          }
                        });

                        return rows.map(row => (
                          <div
                            key={row.key}
                            className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border hover:border-primary/20 transition-colors"
                          >
                            <div className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center border bg-blue-500/10 border-blue-500/20">
                              <span className="material-symbols-outlined text-lg text-blue-400">inventory_2</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <h5 className="text-foreground font-bold text-sm truncate">{row.name}</h5>
                                {row.isReplaced && (
                                  <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[8px] font-bold uppercase">
                                    <span className="material-symbols-outlined text-[9px]">swap_horiz</span>
                                    Reposto
                                  </span>
                                )}
                                {row.isBlocked && !row.isReplaced && (
                                  <span className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-destructive/20 text-destructive border border-destructive/30 text-[8px] font-bold uppercase">
                                    <span className="material-symbols-outlined text-[9px]">block</span>
                                    Bloqueado
                                  </span>
                                )}
                              </div>
                              <p className="text-muted-foreground text-xs">
                                {row.isReplaced ? "Item reposto — verifique os novos dados em Detalhes" : row.subtitle}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-foreground font-bold text-sm">{row.hidePrice ? '' : `R$ ${row.price.toFixed(2).replace(".", ",")}`}</span>
                              {selectedOrder.status === "completed" && (
                                row.isProxy ? (
                                  <button
                                    onClick={() => navigate("/subscriptions")}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition-colors text-xs shadow-sm"
                                  >
                                    <span className="material-symbols-outlined text-[14px]">wifi</span>
                                    Ver Assinatura
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => navigate(`/item-details/${encodeURIComponent(selectedOrder.code)}/${row.itemId}${row.comboStockItemId ? `?profile=${row.comboStockItemId}` : ''}`)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white text-black font-semibold hover:bg-white/90 transition-colors text-xs shadow-sm"
                                  >
                                    <span className="material-symbols-outlined text-[14px]">visibility</span>
                                    Detalhes
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>

                  {/* Payment & Summary */}
                  <div className="flex flex-col md:flex-row gap-4 pt-3 border-t border-border">
                    <div className="flex-1">
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Pagamento</h4>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-6 rounded bg-muted flex items-center justify-center border border-border">
                          <span className="material-symbols-outlined text-foreground text-[14px]">credit_card</span>
                        </div>
                        <p className="text-foreground text-xs font-medium">
                          {selectedOrder.payment_method || "PIX"} {selectedOrder.payment_last4 && `final ${selectedOrder.payment_last4}`}
                        </p>
                      </div>
                    </div>

                    <div className="w-full md:w-64 p-3 rounded-lg bg-muted/50 border border-border">
                      <div className="flex justify-between mb-1.5 text-xs">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="text-foreground">R$ {subtotal.toFixed(2).replace(".", ",")}</span>
                      </div>
                      <div className="flex justify-between mb-1.5 text-xs">
                        <span className="text-muted-foreground">Desconto</span>
                        <span className="text-primary">- R$ {selectedOrder.discount.toFixed(2).replace(".", ",")}</span>
                      </div>
                      <div className="h-px bg-border my-2"></div>
                      <div className="flex justify-between items-center">
                        <span className="text-foreground font-bold text-sm">Total</span>
                        <span className="text-lg font-bold text-primary">R$ {selectedOrder.total.toFixed(2).replace(".", ",")}</span>
                      </div>
                    </div>
                  </div>

                  {/* Finalizar Pedido button for pending orders */}
                  {selectedOrder.status === "processing" && (
                    <div className="pt-3 border-t border-border">
                      <button
                        onClick={() => navigate(`/checkout?order=${selectedOrder.id}`)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm transition-all shadow-glow hover:scale-[1.02] active:scale-[0.98]"
                      >
                        <span className="material-symbols-outlined text-[18px]">shopping_cart_checkout</span>
                        Finalizar Pedido
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
