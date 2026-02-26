import { useState, useEffect } from "react";
import { Search, ChevronLeft, ChevronRight, Eye, Trash2, Loader2, ShoppingCart, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface OrderWithDetails {
  id: string;
  code: string;
  status: string;
  total: number;
  subtotal: number;
  discount: number;
  payment_method: string | null;
  created_at: string;
  user_id: string;
  items: { id: string; name: string; description: string | null; price: number; quantity: number; product_id: string | null }[];
  feedbackOk: boolean;
  profile: { full_name: string | null; } | null;
  email: string;
}

const ITEMS_PER_PAGE = 15;

const statusConfig: Record<string, { label: string; dot: string; badge: string }> = {
  completed: { label: "Concluído", dot: "bg-green-400", badge: "bg-green-500/10 text-green-400 ring-green-500/20" },
  processing: { label: "Processando", dot: "bg-yellow-400 animate-pulse", badge: "bg-yellow-500/10 text-yellow-400 ring-yellow-500/20" },
  cancelled: { label: "Cancelado", dot: "bg-red-400", badge: "bg-red-500/10 text-red-400 ring-red-500/20" },
  abandoned: { label: "Expirado", dot: "bg-orange-400", badge: "bg-orange-500/10 text-orange-400 ring-orange-500/20" },
};

const formatDate = (d: string) => {
  const date = new Date(d);
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

export default function AdminPedidos() {
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  async function fetchOrders() {
    setLoading(true);

    const { data: ordersData, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error || !ordersData) {
      toast.error("Erro ao carregar pedidos");
      setLoading(false);
      return;
    }

    const orderIds = ordersData.map((o) => o.id);
    const userIds = [...new Set(ordersData.map((o) => o.user_id))];

    const [itemsRes, profilesRes] = await Promise.all([
      supabase.from("order_items").select("*").in("order_id", orderIds.length > 0 ? orderIds : ["__none__"]),
      supabase.from("profiles").select("user_id, full_name").in("user_id", userIds.length > 0 ? userIds : ["__none__"]),
    ]);

    // Fetch stock items with 'ok' status to know which orders got positive feedback
    const orderItemIds = (itemsRes.data || []).map(i => i.id);
    const { data: okStockItems } = await supabase
      .from("stock_items")
      .select("order_item_id")
      .in("order_item_id", orderItemIds.length > 0 ? orderItemIds : ["__none__"])
      .eq("status", "ok");

    const okOrderItemIds = new Set((okStockItems || []).map(s => s.order_item_id));

    // Fetch emails from auth via a simple approach - use user_id mapping
    const profileMap = new Map((profilesRes.data || []).map((p) => [p.user_id, p]));

    const enriched: OrderWithDetails[] = ordersData.map((order) => {
      const items = (itemsRes.data || []).filter((i) => i.order_id === order.id);
      const feedbackOk = items.some(i => okOrderItemIds.has(i.id));
      return {
        ...order,
        items,
        feedbackOk,
        profile: profileMap.get(order.user_id) || null,
        email: "",
      };
    });

    setOrders(enriched);
    setLoading(false);
  }

  const filtered = orders.filter((o) => {
    const matchesStatus = statusFilter === "todos" || o.status === statusFilter;
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      !term ||
      o.code.toLowerCase().includes(term) ||
      (o.profile?.full_name || "").toLowerCase().includes(term) ||
      o.items.some((i) => i.name.toLowerCase().includes(term));
    return matchesStatus && matchesSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const getPageNumbers = () => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  const getStatusBadge = (status: string) => {
    const cfg = statusConfig[status] || statusConfig.processing;
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${cfg.badge}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
        {cfg.label}
      </span>
    );
  };

  const totalItemsCount = (order: OrderWithDetails) =>
    order.items.reduce((sum, i) => sum + i.quantity, 0);

  const productSummary = (order: OrderWithDetails) => {
    if (order.items.length === 0) return { name: "Sem itens", type: "" };
    const first = order.items[0];
    return {
      name: first.name + (order.items.length > 1 ? ` +${order.items.length - 1}` : ""),
      type: "profile",
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 py-2">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-black tracking-tight text-foreground lg:text-5xl">
            Pedidos
          </h1>
          <p className="text-base font-light text-muted-foreground">
            Visualize e gerencie todos os pedidos realizados na plataforma.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <ShoppingCart className="size-5 text-primary" />
          <span className="font-bold text-foreground text-lg">{orders.length}</span> pedidos no total
        </div>
      </div>

      {/* Filters */}
      <div className="glass-panel flex flex-col justify-between gap-4 rounded-2xl p-4 lg:flex-row lg:items-center">
        <div className="relative flex w-full max-w-lg items-center">
          <Search className="absolute left-4 size-4 text-muted-foreground" />
          <Input
            className="h-12 w-full rounded-xl border-border bg-background pl-12 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
            placeholder="Pesquisar por código, cliente ou produto..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="h-10 w-[160px] rounded-lg border-border bg-background text-sm font-medium text-muted-foreground hover:border-primary/50">
              <SelectValue placeholder="Status: Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Status: Todos</SelectItem>
              <SelectItem value="completed">Concluído</SelectItem>
              <SelectItem value="processing">Processando</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
              <SelectItem value="abandoned">Expirado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <Table className="w-full min-w-[900px]">
            <TableHeader>
              <TableRow className="border-b border-border bg-muted/50 hover:bg-muted/50">
                <TableHead className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fatura</TableHead>
                <TableHead className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Qtd</TableHead>
                <TableHead className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Preço Total</TableHead>
                <TableHead className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Produto</TableHead>
                <TableHead className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Usuário</TableHead>
                <TableHead className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                <TableHead className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data</TableHead>
                <TableHead className="whitespace-nowrap px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border text-sm">
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-16 text-center text-muted-foreground">
                    <Package className="mx-auto size-10 mb-2 opacity-40" />
                    Nenhum pedido encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((order) => {
                  const summary = productSummary(order);
                  return (
                    <TableRow key={order.id} className="group transition-colors hover:bg-muted/30">
                      <TableCell className="whitespace-nowrap px-6 py-4 font-mono text-sm text-foreground">
                        {order.code}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-center">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                          {totalItemsCount(order)}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-6 py-4 font-bold text-primary">
                        R$ {order.total.toFixed(2).replace(".", ",")}
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{summary.name}</span>
                          <span className="text-xs text-muted-foreground">{summary.type}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{order.profile?.full_name || "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        {getStatusBadge(order.status)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-6 py-4 text-muted-foreground">
                        {formatDate(order.created_at)}
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors hover:bg-primary/20"
                            title="Ver Detalhes"
                          >
                            <Eye className="size-4" />
                          </button>
                          <button
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive transition-colors hover:bg-destructive/20"
                            title="Excluir"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-border bg-muted/30 px-6 py-4">
          <span className="text-xs text-muted-foreground">
            Mostrando <span className="text-foreground font-medium">{((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)}</span> de <span className="text-foreground font-medium">{filtered.length}</span> pedidos
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <ChevronLeft className="size-4" />
            </button>
            {getPageNumbers().map((page, i) =>
              page === "..." ? (
                <span key={`e${i}`} className="px-1 text-muted-foreground">...</span>
              ) : (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page as number)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold ${
                    currentPage === page
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                      : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {page}
                </button>
              )
            )}
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Order Detail Modal */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <ShoppingCart className="size-5 text-primary" />
              Pedido {selectedOrder?.code}
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-6 mt-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Cliente</p>
                  <p className="font-medium text-foreground">{selectedOrder.profile?.full_name || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    {getStatusBadge(selectedOrder.status)}
                    {selectedOrder.feedbackOk && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase">
                        <Package className="size-3" />
                        Funcionando
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground">Data</p>
                  <p className="font-medium text-foreground">{formatDate(selectedOrder.created_at)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Pagamento</p>
                  <p className="font-medium text-foreground">{selectedOrder.payment_method || "PIX"}</p>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Itens do Pedido</h4>
                <div className="space-y-3">
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-xl bg-muted/50 p-4 border border-border">
                      <div>
                        <p className="font-medium text-foreground">{item.name}</p>
                        <p className="text-xs text-muted-foreground">Qtd: {item.quantity}</p>
                      </div>
                      <p className="font-bold text-primary">R$ {(item.price * item.quantity).toFixed(2).replace(".", ",")}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-border pt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="text-foreground">R$ {selectedOrder.subtotal.toFixed(2).replace(".", ",")}</span>
                </div>
                {selectedOrder.discount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Desconto</span>
                    <span className="text-primary">- R$ {selectedOrder.discount.toFixed(2).replace(".", ",")}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-2">
                  <span className="font-bold text-foreground">Total</span>
                  <span className="font-bold text-xl text-primary">R$ {selectedOrder.total.toFixed(2).replace(".", ",")}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
