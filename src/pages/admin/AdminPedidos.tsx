import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ChevronLeft, ChevronRight, Eye, Trash2, Loader2, ShoppingCart, Package, BarChart3, ArrowRightLeft, Undo2 } from "lucide-react";
import ProductExchangeModal from "@/components/admin/ProductExchangeModal";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SalesBalanceTab from "@/components/admin/SalesBalanceTab";
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
import { extractBmNameFromInput } from "@/lib/bm-link";

function extractBmNamesFromDelivery(data: any): string[] {
  if (!data || typeof data !== "object") return [];
  const names: string[] = [];
  const push = (raw: any) => {
    if (!raw) return;
    if (typeof raw === "string") {
      const n = extractBmNameFromInput(raw);
      if (n) names.push(n);
    } else if (typeof raw === "object") {
      const candidate = raw.rawBmInput || raw.raw_input || raw.identification_link || raw.identificationLink || raw.link || raw.name;
      const n = extractBmNameFromInput(typeof candidate === "string" ? candidate : "") || (typeof raw.name === "string" ? raw.name : "");
      if (n) names.push(n);
    }
  };
  if (Array.isArray(data.bmLinks)) data.bmLinks.forEach(push);
  if (data.rawBmInput) push(data.rawBmInput);
  // de-dup
  return Array.from(new Set(names.filter(Boolean)));
}

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
  items: { id: string; name: string; description: string | null; price: number; quantity: number; product_id: string | null; delivery_data: any; stock_item_id?: string | null }[];
  feedbackOk: boolean;
  profile: { full_name: string | null; } | null;
  email: string;
}

const ITEMS_PER_PAGE = 15;

const statusConfig: Record<string, { label: string; dot: string; badge: string }> = {
  completed: { label: "Concluído", dot: "bg-green-400", badge: "bg-green-500/10 text-green-400 ring-green-500/20" },
  processing: { label: "Processando", dot: "bg-yellow-400 animate-pulse", badge: "bg-yellow-500/10 text-yellow-400 ring-yellow-500/20" },
  cancelled: { label: "Cancelado", dot: "bg-red-400", badge: "bg-red-500/10 text-red-400 ring-red-500/20" },
  refunded: { label: "Estornado", dot: "bg-purple-400", badge: "bg-purple-500/10 text-purple-300 ring-purple-500/20" },
  abandoned: { label: "Expirado", dot: "bg-orange-400", badge: "bg-orange-500/10 text-orange-400 ring-orange-500/20" },
};

const formatDate = (d: string) => {
  const date = new Date(d);
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

export default function AdminPedidos() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);
  const [exchangeOpen, setExchangeOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundCreditWallet, setRefundCreditWallet] = useState(true);
  const [refundLoading, setRefundLoading] = useState(false);
  const [exchangeItem, setExchangeItem] = useState<{ order_item_id: string; product_id: string | null; product_name: string; price: number; stock_item_id: string | null } | null>(null);

  useEffect(() => {
    fetchOrders();

    // Realtime: auto-refresh when orders change
    const channel = supabase
      .channel("admin-orders-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        fetchOrders();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function handleRefundOrder() {
    if (!selectedOrder) return;
    setRefundLoading(true);
    try {
      const { data, error } = await supabase.rpc("admin_refund_and_restock_order" as any, {
        _order_id: selectedOrder.id,
        _credit_wallet: refundCreditWallet,
      });
      if (error) throw error;
      const r = (data ?? {}) as any;
      toast.success(
        `Estornado. ${r.stock_items_restocked || 0} itens devolvidos ao estoque` +
          (r.wallet_credited ? " · carteira creditada" : ""),
      );
      setRefundOpen(false);
      setSelectedOrder(null);
      fetchOrders();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao estornar pedido");
    } finally {
      setRefundLoading(false);
    }
  }

  async function fetchOrders() {
    setLoading(true);
    // (function body continues below)

    // Paginate orders fetch to avoid the 1000 row default limit
    const PAGE_SIZE = 1000;
    let allOrders: any[] = [];
    let page = 0;
    while (true) {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) {
        toast.error("Erro ao carregar pedidos");
        setLoading(false);
        return;
      }
      if (!data || data.length === 0) break;
      allOrders = allOrders.concat(data);
      if (data.length < PAGE_SIZE) break;
      page++;
    }
    const ordersData = allOrders;

    const orderIds = ordersData.map((o) => o.id);
    const userIds = [...new Set(ordersData.map((o) => o.user_id))];

    // Chunk IN() queries to avoid 1000 row limit and URL length issues
    const CHUNK = 200;
    const chunks = <T,>(arr: T[]) => {
      const out: T[][] = [];
      for (let i = 0; i < arr.length; i += CHUNK) out.push(arr.slice(i, i + CHUNK));
      return out;
    };

    // Fetch order_items in chunks with internal pagination
    const itemsAll: any[] = [];
    for (const chunk of chunks(orderIds)) {
      let p = 0;
      while (true) {
        const { data } = await supabase
          .from("order_items")
          .select("*")
          .in("order_id", chunk)
          .range(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE - 1);
        if (!data || data.length === 0) break;
        itemsAll.push(...data);
        if (data.length < PAGE_SIZE) break;
        p++;
      }
    }

    // Fetch profiles in chunks
    const profilesAll: any[] = [];
    for (const chunk of chunks(userIds)) {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", chunk);
      if (data) profilesAll.push(...data);
    }

    const itemsRes = { data: itemsAll };
    const profilesRes = { data: profilesAll };

    // Fetch stock items with 'ok' status to know which orders got positive feedback
    const orderItemIds = itemsAll.map(i => i.id);
    const okStockAll: any[] = [];
    const stockLinksAll: any[] = [];
    for (const chunk of chunks(orderItemIds)) {
      const [okRes, linkRes] = await Promise.all([
        supabase.from("stock_items").select("order_item_id").in("order_item_id", chunk).eq("status", "ok"),
        supabase.from("stock_items").select("id, order_item_id").in("order_item_id", chunk).in("status", ["vendido", "ok"]),
      ]);
      if (okRes.data) okStockAll.push(...okRes.data);
      if (linkRes.data) stockLinksAll.push(...linkRes.data);
    }
    const okStockRes = { data: okStockAll };
    const stockLinksRes = { data: stockLinksAll };

    const okOrderItemIds = new Set((okStockRes.data || []).map(s => s.order_item_id));
    const stockItemMap = new Map((stockLinksRes.data || []).map(s => [s.order_item_id, s.id]));

    // Fetch emails from auth via a simple approach - use user_id mapping
    const profileMap = new Map((profilesRes.data || []).map((p) => [p.user_id, p]));

    const enriched: OrderWithDetails[] = ordersData.map((order) => {
      const items = (itemsRes.data || []).filter((i) => i.order_id === order.id).map(i => ({
        ...i,
        stock_item_id: stockItemMap.get(i.id) || null,
      }));
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
    const hasItems = o.items.length > 0;
    // Hide orphan orders without items from the admin grid
    if (!hasItems) return false;

    // Hide "processing" orders from the default "todos" view — they are PIX awaiting payment
    const matchesStatus = statusFilter === "todos" 
      ? o.status !== "processing" 
      : o.status === statusFilter;
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
        <div className="flex items-center gap-3">
          <Button onClick={() => navigate("/admin/auditoria/nova-venda")} className="gap-2">
            <ShoppingCart className="size-4" />
            Nova Venda
          </Button>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <ShoppingCart className="size-5 text-primary" />
          <span className="font-bold text-foreground text-lg">{orders.length}</span> pedidos no total
          </div>
        </div>
      </div>

      <Tabs defaultValue="pedidos" className="w-full">
        <TabsList className="bg-muted/50 border border-border">
          <TabsTrigger value="pedidos" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <ShoppingCart className="size-4" />
            Pedidos
          </TabsTrigger>
          <TabsTrigger value="balanco" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <BarChart3 className="size-4" />
            Balanço de Vendas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pedidos" className="mt-6 space-y-6">
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
              <SelectItem value="refunded">Estornado</SelectItem>
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

        </TabsContent>

        <TabsContent value="balanco" className="mt-6">
          <SalesBalanceTab />
        </TabsContent>
      </Tabs>

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
                  {selectedOrder.items.map((item) => {
                    const subCode = item.delivery_data?.subscription_code;
                    return (
                      <div key={item.id} className="flex items-center justify-between rounded-xl bg-muted/50 p-4 border border-border">
                        <div>
                          <p className="font-medium text-foreground">{item.name}</p>
                          <p className="text-xs text-muted-foreground">Qtd: {item.quantity}</p>
                          {(() => {
                            const bmNames = extractBmNamesFromDelivery(item.delivery_data);
                            if (bmNames.length === 0) return null;
                            return (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {bmNames.map((n, i) => (
                                  <span
                                    key={`${item.id}-bm-${i}`}
                                    className="inline-flex items-center gap-1 rounded-md border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-300"
                                  >
                                    <Package className="size-2.5" />
                                    {n}
                                  </span>
                                ))}
                              </div>
                            );
                          })()}
                          {subCode && (
                            <p className="text-xs text-primary/80 mt-1 font-mono">
                              Assinatura: {subCode}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="font-bold text-primary">R$ {(item.price * item.quantity).toFixed(2).replace(".", ",")}</p>
                          {item.product_id && !subCode && (
                            <button
                              onClick={() => {
                                setExchangeItem({
                                  order_item_id: item.id,
                                  product_id: item.product_id,
                                  product_name: item.name,
                                  price: item.price,
                                  stock_item_id: item.stock_item_id || null,
                                });
                                setExchangeOpen(true);
                              }}
                              className="flex h-7 items-center gap-1 rounded-lg bg-primary/10 px-2 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                              title="Trocar Produto"
                            >
                              <ArrowRightLeft className="size-3" />
                              Trocar
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
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

              {!["refunded", "cancelled"].includes(selectedOrder.status) && (
                <div className="border-t border-border pt-4">
                  <Button
                    variant="outline"
                    className="w-full border-purple-500/40 text-purple-300 hover:bg-purple-500/10"
                    onClick={() => {
                      setRefundCreditWallet(true);
                      setRefundOpen(true);
                    }}
                  >
                    <Undo2 className="w-4 h-4 mr-2" />
                    Estornar e devolver ao estoque
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Refund Confirmation Modal */}
      <Dialog open={refundOpen} onOpenChange={(o) => !refundLoading && setRefundOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Estornar pedido {selectedOrder?.code}?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              Todos os itens deste pedido voltarão automaticamente ao estoque e ficarão disponíveis
              para nova venda (perfis, BMs, proxies e combos). O pedido será marcado como
              <span className="font-semibold text-purple-300"> Estornado</span> e sumirá das telas de
              gestão de BMs, perfis e proxies.
            </p>
            <div className="rounded-lg border border-border/60 bg-card/40 p-3 space-y-2">
              <div className="text-xs text-muted-foreground">Itens do pedido</div>
              {selectedOrder?.items.map((it) => (
                <div key={it.id} className="text-foreground">
                  {it.quantity}× {it.name}
                </div>
              ))}
            </div>
            <label className="flex items-start gap-2 cursor-pointer">
              <Checkbox
                checked={refundCreditWallet}
                onCheckedChange={(v) => setRefundCreditWallet(v === true)}
                disabled={refundLoading}
              />
              <span>
                Creditar R$ {selectedOrder?.total.toFixed(2).replace(".", ",")} na carteira do cliente
                <span className="block text-xs text-muted-foreground">
                  Desmarque se for pagar o estorno por fora (PIX/cartão).
                </span>
              </span>
            </label>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="ghost" onClick={() => setRefundOpen(false)} disabled={refundLoading}>
                Cancelar
              </Button>
              <Button
                onClick={handleRefundOrder}
                disabled={refundLoading}
                className="bg-purple-600 hover:bg-purple-500 text-white"
              >
                {refundLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Estornando…
                  </>
                ) : (
                  <>
                    <Undo2 className="w-4 h-4 mr-2" /> Confirmar estorno
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Exchange Modal */}
      <ProductExchangeModal
        open={exchangeOpen}
        onOpenChange={setExchangeOpen}
        orderItem={exchangeItem}
        orderId={selectedOrder?.id || ""}
        clientUserId={selectedOrder?.user_id || ""}
        clientName={selectedOrder?.profile?.full_name || "—"}
        onExchangeComplete={() => {
          setSelectedOrder(null);
          fetchOrders();
        }}
      />
    </div>
  );
}
