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
  processing: { label: "Processando", className: "opacity-80 hover:opacity-100", badgeClassName: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
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

      const enriched: Order[] = ordersData.map((order) => ({
        ...order,
        items: (itemsData || []).filter((i) => i.order_id === order.id),
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
    <div className="space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
            <a className="hover:text-foreground transition-colors cursor-pointer">Dashboard</a>
            <span className="material-symbols-outlined text-xs">chevron_right</span>
            <span className="text-foreground">Meus Pedidos</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2 tracking-tight">Histórico de Pedidos</h1>
          <p className="text-muted-foreground">Gerencie suas compras de perfis, BMs e páginas.</p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition whitespace-nowrap ${
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-[600px]">
          {/* Orders List */}
          <div className="lg:col-span-4 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar max-h-[700px]">
            {filteredOrders.map((order) => {
              const st = statusConfig[order.status] || statusConfig.processing;
              const isSelected = selectedOrder?.id === order.id;
              return (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className={`glass-panel p-5 rounded-2xl cursor-pointer group border-l-[3px] hover:bg-muted transition-all relative overflow-hidden ${
                    isSelected ? st.className : "border-l-transparent opacity-80 hover:opacity-100"
                  }`}
                >
                  {isSelected && (
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent pointer-events-none"></div>
                  )}
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-xs text-muted-foreground font-mono mb-1">{order.code}</p>
                        <h3 className="text-foreground font-semibold text-lg">
                          {order.items.length > 0 ? order.items[0].name : "Pedido"}
                          {order.items.length > 1 && ` +${order.items.length - 1}`}
                        </h3>
                      </div>
                      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${st.badgeClassName}`}>
                        {st.label}
                      </span>
                    </div>
                    <div className="flex justify-between items-end">
                      <div className="text-muted-foreground text-sm">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                          {formatDate(order.created_at)}
                        </span>
                      </div>
                      <p className="text-foreground font-bold text-xl">R$ {order.total.toFixed(2).replace(".", ",")}</p>
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

          {/* Order Details */}
          {selectedOrder && status && (
            <div className="lg:col-span-8">
              <div className="glass-panel rounded-3xl min-h-[700px] flex flex-col overflow-hidden relative border border-border shadow-2xl">
                <div className="p-6 md:p-8 border-b border-border flex flex-wrap gap-4 justify-between items-center bg-muted/50">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-2xl font-bold text-foreground">Pedido {selectedOrder.code}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        selectedOrder.status === "completed"
                          ? "bg-primary text-primary-foreground"
                          : selectedOrder.status === "processing"
                          ? "bg-yellow-500 text-background"
                          : "bg-destructive text-destructive-foreground"
                      }`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-sm">Feito em {formatDateFull(selectedOrder.created_at)}</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                  <h4 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">shopping_bag</span> Itens do Pedido
                  </h4>

                  <div className="flex flex-col gap-4 mb-8">
                    {selectedOrder.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-col md:flex-row items-center gap-6 p-4 rounded-xl bg-muted/50 border border-border hover:border-primary/20 transition-colors group"
                      >
                        <div className="w-20 h-20 rounded-lg shrink-0 shadow-lg flex items-center justify-center border bg-blue-500/10 border-blue-500/20">
                          <span className="material-symbols-outlined text-3xl text-blue-400">inventory_2</span>
                        </div>
                        <div className="flex-1 text-center md:text-left w-full md:w-auto">
                          <h5 className="text-foreground font-bold text-lg">{item.name}</h5>
                          <p className="text-muted-foreground text-sm">{item.description || `Qtd: ${item.quantity}`}</p>
                        </div>
                        <div className="flex flex-col items-center md:items-end gap-3 shrink-0 w-full md:w-auto">
                          <span className="text-foreground font-bold text-lg">R$ {(item.price * item.quantity).toFixed(2).replace(".", ",")}</span>
                          {selectedOrder.status === "completed" && (
                            <button
                              onClick={() => navigate(`/item-details/${encodeURIComponent(selectedOrder.code)}/${item.id}`)}
                              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            >
                              <span className="material-symbols-outlined text-[20px]">visibility</span>
                              Ver Detalhes
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Payment & Summary */}
                  <div className="flex flex-col md:flex-row gap-8 pt-8 border-t border-border">
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">Informações de Pagamento</h4>
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-8 rounded bg-muted flex items-center justify-center border border-border">
                          <span className="material-symbols-outlined text-foreground">credit_card</span>
                        </div>
                        <div>
                          <p className="text-foreground text-sm font-medium">
                            {selectedOrder.payment_method || "PIX"} {selectedOrder.payment_last4 && `final ${selectedOrder.payment_last4}`}
                          </p>
                          {selectedOrder.payment_expiry && (
                            <p className="text-muted-foreground text-xs">Expira em {selectedOrder.payment_expiry}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="w-full md:w-80 p-6 rounded-xl bg-muted/50 border border-border">
                      <div className="flex justify-between mb-3 text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="text-foreground">R$ {subtotal.toFixed(2).replace(".", ",")}</span>
                      </div>
                      <div className="flex justify-between mb-3 text-sm">
                        <span className="text-muted-foreground">Desconto</span>
                        <span className="text-primary">- R$ {selectedOrder.discount.toFixed(2).replace(".", ",")}</span>
                      </div>
                      <div className="h-px bg-border my-4"></div>
                      <div className="flex justify-between items-center">
                        <span className="text-foreground font-bold">Total</span>
                        <span className="text-2xl font-bold text-primary">R$ {selectedOrder.total.toFixed(2).replace(".", ",")}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
