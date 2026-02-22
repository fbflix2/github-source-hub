import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

type OrderStatus = "completed" | "processing" | "cancelled";

interface OrderItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  quantity: number;
  isBlocked?: boolean;
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
  completed: { label: "Concluído", className: "border-l-primary bg-muted/50", badgeClassName: "bg-primary/20 text-primary border-primary/20" },
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

  useEffect(() => {
    async function fetchOrders() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: ordersData, error } = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error || !ordersData) { setLoading(false); return; }

      const orderIds = ordersData.map((o) => o.id);
      const { data: itemsData } = await supabase
        .from("order_items")
        .select("*")
        .in("order_id", orderIds.length > 0 ? orderIds : ["__none__"]);

      // Fetch stock_items to check blocked status
      const itemIds = (itemsData || []).map((i) => i.id);
      const { data: stockItems } = await supabase
        .from("stock_items")
        .select("order_item_id, status")
        .in("order_item_id", itemIds.length > 0 ? itemIds : ["__none__"]);

      const blockedItemIds = new Set(
        (stockItems || []).filter((s) => s.status === "bloqueado").map((s) => s.order_item_id)
      );

      const enriched: Order[] = ordersData.map((order) => ({
        ...order,
        items: (itemsData || []).filter((i) => i.order_id === order.id).map((i) => ({
          ...i,
          isBlocked: blockedItemIds.has(i.id),
        })),
      }));

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
    <div className="flex flex-col h-[calc(100vh-80px)] animate-fade-in overflow-hidden">
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
          {/* Orders List - scrollable */}
          <div className="lg:col-span-4 flex flex-col gap-2 overflow-y-auto pr-1 custom-scrollbar">
            {filteredOrders.map((order) => {
              const st = statusConfig[order.status] || statusConfig.processing;
              const isSelected = selectedOrder?.id === order.id;
              return (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className={`glass-panel p-3 rounded-xl cursor-pointer group border-l-[3px] hover:bg-muted transition-all relative overflow-hidden ${
                    isSelected ? st.className : "border-l-transparent opacity-80 hover:opacity-100"
                  }`}
                >
                  {isSelected && (
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent pointer-events-none"></div>
                  )}
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-1.5">
                      <div>
                        <p className="text-[10px] text-muted-foreground font-mono">{order.code}</p>
                        <h3 className="text-foreground font-semibold text-sm">
                          {order.items.length > 0 ? order.items[0].name : "Pedido"}
                          {order.items.length > 1 && ` +${order.items.length - 1}`}
                        </h3>
                        {order.items.some((i) => i.isBlocked) && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-destructive/20 text-destructive border border-destructive/30 text-[9px] font-bold uppercase w-fit">
                            <span className="material-symbols-outlined text-[10px]">block</span>
                            Bloqueado
                          </span>
                        )}
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${st.badgeClassName}`}>
                        {st.label}
                      </span>
                    </div>
                    <div className="flex justify-between items-end">
                      <div className="text-muted-foreground text-xs">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">calendar_today</span>
                          {formatDate(order.created_at)}
                        </span>
                      </div>
                      <p className="text-foreground font-bold text-base">R$ {order.total.toFixed(2).replace(".", ",")}</p>
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
            <div className="lg:col-span-8 overflow-hidden">
              <div className="glass-panel rounded-xl flex flex-col overflow-hidden border border-border">
                <div className="px-4 py-3 border-b border-border flex flex-wrap gap-3 justify-between items-center bg-muted/50">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-bold text-foreground">Pedido {selectedOrder.code}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        selectedOrder.status === "completed"
                          ? "bg-primary text-primary-foreground"
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
                    {selectedOrder.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border hover:border-primary/20 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center border bg-blue-500/10 border-blue-500/20">
                          <span className="material-symbols-outlined text-lg text-blue-400">inventory_2</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h5 className="text-foreground font-bold text-sm truncate">{item.name}</h5>
                            {item.isBlocked && (
                              <span className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-destructive/20 text-destructive border border-destructive/30 text-[8px] font-bold uppercase">
                                <span className="material-symbols-outlined text-[9px]">block</span>
                                Bloqueado
                              </span>
                            )}
                          </div>
                          <p className="text-muted-foreground text-xs">{item.description || `Qtd: ${item.quantity}`}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-foreground font-bold text-sm">R$ {(item.price * item.quantity).toFixed(2).replace(".", ",")}</span>
                          {selectedOrder.status === "completed" && (
                            <button
                              onClick={() => navigate(`/item-details/${encodeURIComponent(selectedOrder.code)}/${item.id}`)}
                              className="flex items-center gap-1 px-2 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-xs"
                            >
                              <span className="material-symbols-outlined text-[14px]">visibility</span>
                              Detalhes
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
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
