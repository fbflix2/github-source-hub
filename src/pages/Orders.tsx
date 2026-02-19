import { useState } from "react";
import { useNavigate } from "react-router-dom";

type OrderStatus = "completed" | "processing" | "cancelled";

interface OrderItem {
  id: number;
  name: string;
  description: string;
  price: number;
  icon: string;
  iconBg: string;
  iconColor: string;
}

interface Order {
  id: string;
  title: string;
  date: string;
  dateFormatted: string;
  value: number;
  status: OrderStatus;
  items: OrderItem[];
  paymentMethod: string;
  paymentLast4: string;
  paymentExpiry: string;
  customerName: string;
  customerEmail: string;
}

const orders: Order[] = [
  {
    id: "#ORD-2023-882",
    title: "Kit Perfis Farmados + BM",
    date: "20 Out 2023",
    dateFormatted: "20 de Outubro de 2023 às 14:30",
    value: 299.90,
    status: "completed",
    items: [
      { id: 1, name: "Perfil Farmado (Alta Qualidade)", description: "Conta com cookies • Verificada", price: 149.90, icon: "person", iconBg: "bg-blue-500/10 border-blue-500/20", iconColor: "text-blue-400" },
      { id: 2, name: "BM Ilimitada (Business Manager)", description: "Compartilhamento via Link • Com Garantia", price: 100.00, icon: "business_center", iconBg: "bg-purple-500/10 border-purple-500/20", iconColor: "text-purple-400" },
      { id: 3, name: "Página Restabelecida", description: "Score Alto • Pronta para Anunciar", price: 50.00, icon: "pages", iconBg: "bg-orange-500/10 border-orange-500/20", iconColor: "text-orange-400" },
    ],
    paymentMethod: "Mastercard",
    paymentLast4: "8829",
    paymentExpiry: "12/25",
    customerName: "João Silva",
    customerEmail: "joao.silva@email.com",
  },
  {
    id: "#ORD-2023-879",
    title: "BM Ilimitada Verificada",
    date: "18 Out 2023",
    dateFormatted: "18 de Outubro de 2023 às 10:15",
    value: 150.00,
    status: "processing",
    items: [
      { id: 1, name: "BM Ilimitada Verificada", description: "Verificação completa • Sem limites", price: 150.00, icon: "business_center", iconBg: "bg-purple-500/10 border-purple-500/20", iconColor: "text-purple-400" },
    ],
    paymentMethod: "PIX",
    paymentLast4: "",
    paymentExpiry: "",
    customerName: "João Silva",
    customerEmail: "joao.silva@email.com",
  },
  {
    id: "#ORD-2023-850",
    title: "Página com 10k Seguidores",
    date: "10 Set 2023",
    dateFormatted: "10 de Setembro de 2023 às 09:00",
    value: 120.00,
    status: "completed",
    items: [
      { id: 1, name: "Página com 10k Seguidores", description: "Página ativa • Engajamento real", price: 120.00, icon: "pages", iconBg: "bg-orange-500/10 border-orange-500/20", iconColor: "text-orange-400" },
    ],
    paymentMethod: "Mastercard",
    paymentLast4: "8829",
    paymentExpiry: "12/25",
    customerName: "João Silva",
    customerEmail: "joao.silva@email.com",
  },
  {
    id: "#ORD-2023-810",
    title: "Perfil Facebook Antigo (2015)",
    date: "05 Set 2023",
    dateFormatted: "05 de Setembro de 2023 às 16:45",
    value: 65.00,
    status: "completed",
    items: [
      { id: 1, name: "Perfil Facebook Antigo (2015)", description: "Conta antiga • Alta confiabilidade", price: 65.00, icon: "person", iconBg: "bg-blue-500/10 border-blue-500/20", iconColor: "text-blue-400" },
    ],
    paymentMethod: "PIX",
    paymentLast4: "",
    paymentExpiry: "",
    customerName: "João Silva",
    customerEmail: "joao.silva@email.com",
  },
];

const filters = [
  { key: "all", label: "Todos" },
  { key: "completed", label: "Concluídos" },
  { key: "processing", label: "Processando" },
];

const statusConfig: Record<OrderStatus, { label: string; className: string; badgeClassName: string }> = {
  completed: { label: "Concluído", className: "border-l-primary bg-muted/50", badgeClassName: "bg-primary/20 text-primary border-primary/20" },
  processing: { label: "Processando", className: "opacity-80 hover:opacity-100", badgeClassName: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  cancelled: { label: "Cancelado", className: "opacity-60", badgeClassName: "bg-danger/10 text-danger border-danger/20" },
};

export default function Orders() {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<Order>(orders[0]);

  const filteredOrders = orders.filter((order) => {
    if (activeFilter === "all") return true;
    return order.status === activeFilter;
  });

  const subtotal = selectedOrder.items.reduce((acc, item) => acc + item.price, 0);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-text-secondary text-sm mb-2">
            <a className="hover:text-foreground transition-colors cursor-pointer">Dashboard</a>
            <span className="material-symbols-outlined text-xs text-muted-foreground">chevron_right</span>
            <span className="text-foreground">Meus Pedidos</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2 tracking-tight">Histórico de Pedidos</h1>
          <p className="text-text-secondary">Gerencie suas compras de perfis, BMs e páginas.</p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition whitespace-nowrap ${
                activeFilter === f.key
                  ? "bg-primary text-background font-bold shadow-glow"
                  : "glass-panel text-text-secondary hover:text-foreground hover:bg-muted border border-transparent hover:border-border"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content - Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-[600px]">
        {/* Orders List */}
        <div className="lg:col-span-4 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar max-h-[700px]">
          {filteredOrders.map((order) => {
            const status = statusConfig[order.status];
            const isSelected = selectedOrder.id === order.id;
            return (
              <div
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className={`glass-panel p-5 rounded-2xl cursor-pointer group border-l-[3px] hover:bg-muted transition-all relative overflow-hidden ${
                  isSelected ? status.className : "border-l-transparent opacity-80 hover:opacity-100"
                }`}
              >
                {isSelected && (
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent pointer-events-none"></div>
                )}
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-xs text-text-secondary font-mono mb-1">{order.id}</p>
                      <h3 className="text-foreground font-semibold text-lg">{order.title}</h3>
                    </div>
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${status.badgeClassName}`}>
                      {status.label}
                    </span>
                  </div>
                  <div className="flex justify-between items-end">
                    <div className="text-text-secondary text-sm">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                        {order.date}
                      </span>
                    </div>
                    <p className="text-foreground font-bold text-xl">R$ {order.value.toFixed(2).replace(".", ",")}</p>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredOrders.length === 0 && (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-[48px] text-text-secondary mb-4">inbox</span>
              <p className="text-text-secondary">Nenhum pedido encontrado.</p>
            </div>
          )}
        </div>

        {/* Order Details */}
        <div className="lg:col-span-8">
          <div className="glass-panel rounded-3xl min-h-[700px] flex flex-col overflow-hidden relative border border-border shadow-2xl">
            {/* Header */}
            <div className="p-6 md:p-8 border-b border-border flex flex-wrap gap-4 justify-between items-center bg-muted/50">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="text-2xl font-bold text-foreground">Pedido {selectedOrder.id}</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    selectedOrder.status === "completed" 
                      ? "bg-primary text-background" 
                      : selectedOrder.status === "processing"
                      ? "bg-yellow-500 text-background"
                      : "bg-danger text-danger-foreground"
                  }`}>
                    {statusConfig[selectedOrder.status].label}
                  </span>
                </div>
                <p className="text-text-secondary text-sm">Feito em {selectedOrder.dateFormatted}</p>
              </div>
              <div className="flex gap-3">
                <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-danger/30 text-danger hover:bg-danger/10 transition-colors text-sm font-medium">
                  <span className="material-symbols-outlined text-[18px]">help</span>
                  <span className="hidden sm:inline">Ajuda</span>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
              <h4 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">shopping_bag</span> Itens do Pedido
              </h4>

              {/* Items */}
              <div className="flex flex-col gap-4 mb-8">
                {selectedOrder.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col md:flex-row items-center gap-6 p-4 rounded-xl bg-muted/50 border border-border hover:border-primary/20 transition-colors group"
                  >
                    <div className={`w-20 h-20 rounded-lg shrink-0 shadow-lg group-hover:scale-105 transition-transform duration-300 flex items-center justify-center border ${item.iconBg}`}>
                      <span className={`material-symbols-outlined text-3xl ${item.iconColor}`}>{item.icon}</span>
                    </div>
                    <div className="flex-1 text-center md:text-left w-full md:w-auto">
                      <h5 className="text-foreground font-bold text-lg">{item.name}</h5>
                      <p className="text-text-secondary text-sm">{item.description}</p>
                    </div>
                    <div className="flex flex-col items-center md:items-end gap-3 shrink-0 w-full md:w-auto">
                      <span className="text-foreground font-bold text-lg">R$ {item.price.toFixed(2).replace(".", ",")}</span>
                      {selectedOrder.status === "completed" && (
                        <div className="flex gap-2 w-full md:w-auto">
                          <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-primary text-background font-bold text-sm hover:brightness-110 shadow-glow hover:shadow-glow-lg transition-all">
                            <span className="material-symbols-outlined text-[20px]">cloud_download</span>
                            Baixar Item
                          </button>
                          <button 
                            onClick={() => navigate(`/item-details/${encodeURIComponent(selectedOrder.id)}/${item.id}`)}
                            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-border text-text-secondary hover:text-foreground hover:bg-muted transition-colors"
                            title="Ver Detalhes"
                          >
                            <span className="material-symbols-outlined text-[20px]">visibility</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Payment & Summary */}
              <div className="flex flex-col md:flex-row gap-8 pt-8 border-t border-border">
                {/* Payment Info */}
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Informações de Pagamento</h4>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-8 rounded bg-muted flex items-center justify-center border border-border">
                      <span className="material-symbols-outlined text-foreground">credit_card</span>
                    </div>
                    <div>
                      <p className="text-foreground text-sm font-medium">
                        {selectedOrder.paymentMethod} {selectedOrder.paymentLast4 && `final ${selectedOrder.paymentLast4}`}
                      </p>
                      {selectedOrder.paymentExpiry && (
                        <p className="text-text-secondary text-xs">Expira em {selectedOrder.paymentExpiry}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-8 rounded bg-muted flex items-center justify-center border border-border">
                      <span className="material-symbols-outlined text-foreground">person</span>
                    </div>
                    <div>
                      <p className="text-foreground text-sm font-medium">{selectedOrder.customerName}</p>
                      <p className="text-text-secondary text-xs">{selectedOrder.customerEmail}</p>
                    </div>
                  </div>
                </div>

                {/* Order Summary */}
                <div className="w-full md:w-80 p-6 rounded-xl bg-muted/50 border border-border">
                  <div className="flex justify-between mb-3 text-sm">
                    <span className="text-text-secondary">Subtotal</span>
                    <span className="text-foreground">R$ {subtotal.toFixed(2).replace(".", ",")}</span>
                  </div>
                  <div className="flex justify-between mb-3 text-sm">
                    <span className="text-text-secondary">Desconto</span>
                    <span className="text-primary">- R$ 0,00</span>
                  </div>
                  <div className="flex justify-between mb-3 text-sm">
                    <span className="text-text-secondary">Taxas</span>
                    <span className="text-foreground">R$ 0,00</span>
                  </div>
                  <div className="h-px bg-border my-4"></div>
                  <div className="flex justify-between items-center">
                    <span className="text-foreground font-bold">Total</span>
                    <span className="text-2xl font-bold text-primary">R$ {selectedOrder.value.toFixed(2).replace(".", ",")}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
