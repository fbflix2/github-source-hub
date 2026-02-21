import { useState, useEffect } from "react";
import { Search, ShoppingCart, ChevronLeft, ChevronRight, Loader2, User, Calendar, CreditCard, Package, RefreshCw, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AbandonedCart {
  id: string;
  code: string;
  total: number;
  created_at: string;
  user_id: string;
  payment_method: string | null;
  client_name: string | null;
  client_email: string | null;
  items: { name: string; price: number; quantity: number }[];
}

const ITEMS_PER_PAGE = 10;

export default function AdminCarrinhosAbandonados() {
  const [carts, setCarts] = useState<AbandonedCart[]>([]);
  const [loading, setLoading] = useState(true);
  const [expiring, setExpiring] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const fetchAbandonedCarts = async () => {
    setLoading(true);

    // Fetch abandoned orders + processing orders with expired pending payments
    const { data: orders, error } = await supabase
      .from("orders")
      .select("id, code, total, created_at, user_id, payment_method, status")
      .in("status", ["abandoned", "processing"])
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching abandoned carts:", error);
      setLoading(false);
      return;
    }

    // For "processing" orders, check if their payments are pending/cancelled
    const processingIds = (orders ?? []).filter(o => o.status === "processing").map(o => o.id);
    let validProcessingIds = new Set<string>();

    if (processingIds.length > 0) {
      const { data: payments } = await supabase
        .from("payments")
        .select("order_id, status")
        .in("order_id", processingIds)
        .in("status", ["pending", "cancelled"]);

      (payments ?? []).forEach(p => {
        if (p.order_id) validProcessingIds.add(p.order_id);
      });
    }

    // Filter: abandoned status OR processing with pending/cancelled payment
    const filteredOrders = (orders ?? []).filter(o =>
      o.status === "abandoned" || validProcessingIds.has(o.id)
    );

    if (filteredOrders.length === 0) {
      setCarts([]);
      setLoading(false);
      return;
    }

    // Get user profiles
    const userIds = [...new Set(filteredOrders.map(o => o.user_id))];
    let profileMap: Record<string, { full_name: string | null; email?: string }> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      (profiles ?? []).forEach(p => {
        profileMap[p.user_id] = { full_name: p.full_name };
      });
    }

    // Get order items
    const orderIds = filteredOrders.map(o => o.id);
    const { data: orderItems } = await supabase
      .from("order_items")
      .select("order_id, name, price, quantity")
      .in("order_id", orderIds);

    const itemsMap: Record<string, { name: string; price: number; quantity: number }[]> = {};
    (orderItems ?? []).forEach(oi => {
      if (!itemsMap[oi.order_id]) itemsMap[oi.order_id] = [];
      itemsMap[oi.order_id].push({ name: oi.name, price: oi.price, quantity: oi.quantity });
    });

    setCarts(
      filteredOrders.map(o => ({
        id: o.id,
        code: o.code,
        total: o.total,
        created_at: o.created_at,
        user_id: o.user_id,
        payment_method: o.payment_method,
        client_name: profileMap[o.user_id]?.full_name || null,
        client_email: null,
        items: itemsMap[o.id] || [],
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchAbandonedCarts();
  }, []);

  const handleExpirePayments = async () => {
    setExpiring(true);
    try {
      const { data, error } = await supabase.functions.invoke("expire-payments");
      if (error) throw error;
      toast.success(`${data?.cancelled || 0} pagamentos expirados, ${data?.abandoned || 0} carrinhos abandonados`);
      fetchAbandonedCarts();
    } catch (err) {
      console.error("Error expiring payments:", err);
      toast.error("Erro ao processar pagamentos expirados");
    } finally {
      setExpiring(false);
    }
  };

  // Stats
  const totalValue = carts.reduce((sum, c) => sum + c.total, 0);

  // Filter
  const filtered = carts.filter(c => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      c.code.toLowerCase().includes(term) ||
      (c.client_name || "").toLowerCase().includes(term)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const formatCurrency = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) +
      " - " + date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
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
          <h1 className="text-4xl font-black tracking-tight text-white lg:text-5xl">
            Carrinhos Abandonados
          </h1>
          <p className="text-base font-light text-gray-400">
            Pedidos com pagamento pendente ou expirado. Recupere vendas perdidas.
          </p>
        </div>
        <Button
          onClick={handleExpirePayments}
          disabled={expiring}
          className="gap-2"
          variant="outline"
        >
          {expiring ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Processar Expirados
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="glass-panel relative overflow-hidden rounded-2xl p-6 transition-transform hover:-translate-y-1">
          <div className="absolute -right-4 -top-4 rounded-full bg-yellow-500/10 p-8 blur-2xl"></div>
          <div className="relative z-10 flex flex-col gap-1">
            <p className="text-sm font-medium text-gray-400">Total Abandonado</p>
            <h2 className="text-3xl font-bold text-white">{formatCurrency(totalValue)}</h2>
          </div>
        </div>

        <div className="glass-panel relative overflow-hidden rounded-2xl p-6 transition-transform hover:-translate-y-1">
          <div className="absolute -right-4 -top-4 rounded-full bg-red-500/5 p-8 blur-2xl"></div>
          <div className="relative z-10 flex flex-col gap-1">
            <p className="text-sm font-medium text-gray-400">Carrinhos</p>
            <h2 className="text-3xl font-bold text-white">{carts.length}</h2>
          </div>
        </div>

        <div className="glass-panel relative overflow-hidden rounded-2xl p-6 transition-transform hover:-translate-y-1">
          <div className="absolute -right-4 -top-4 rounded-full bg-primary/10 p-8 blur-2xl"></div>
          <div className="relative z-10 flex flex-col gap-1">
            <p className="text-sm font-medium text-gray-400">Ticket Médio</p>
            <h2 className="text-3xl font-bold text-white">
              {carts.length > 0 ? formatCurrency(totalValue / carts.length) : "R$ 0,00"}
            </h2>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="glass-panel flex flex-col justify-between gap-4 rounded-2xl p-4 lg:flex-row lg:items-center">
        <div className="relative flex w-full max-w-lg items-center">
          <Search className="absolute left-4 size-4 text-gray-500" />
          <Input
            className="h-12 w-full rounded-xl border-white/10 bg-[#150a0a] pl-12 pr-4 text-sm text-white placeholder:text-gray-500 focus:border-primary focus:ring-1 focus:ring-primary"
            placeholder="Buscar por código ou nome do cliente..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <Table className="w-full min-w-[800px]">
            <TableHeader>
              <TableRow className="border-b border-white/10 bg-white/5 hover:bg-white/5">
                <TableHead className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-400">Pedido</TableHead>
                <TableHead className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-400">Cliente</TableHead>
                <TableHead className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-400">Itens</TableHead>
                <TableHead className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-400">Método</TableHead>
                <TableHead className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-400">Data</TableHead>
                <TableHead className="whitespace-nowrap px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-white/5 text-sm text-gray-300">
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <ShoppingCart className="size-8 text-gray-600" />
                      <span>Nenhum carrinho abandonado encontrado.</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((cart) => (
                  <TableRow key={cart.id} className="group transition-colors hover:bg-white/5">
                    <TableCell className="whitespace-nowrap px-6 py-4 font-medium text-white">
                      <div className="flex items-center gap-2">
                        <ShoppingCart className="size-4 text-yellow-400" />
                        {cart.code}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <User className="size-4 text-gray-500" />
                        <span className="font-medium text-white">{cart.client_name || "Sem nome"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="flex flex-col gap-0.5">
                        {cart.items.map((item, i) => (
                          <span key={i} className="text-xs text-gray-400">
                            {item.quantity}x {item.name}
                          </span>
                        ))}
                        {cart.items.length === 0 && <span className="text-xs text-gray-600">—</span>}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-500/10 px-2.5 py-1 text-xs font-semibold text-yellow-400 ring-1 ring-inset ring-yellow-500/20">
                        <span className="h-1.5 w-1.5 rounded-full bg-yellow-400"></span>
                        {cart.payment_method === "pix" ? "PIX" : cart.payment_method || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-6 py-4 text-gray-400">
                      {formatDate(cart.created_at)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-6 py-4 text-right font-bold text-yellow-400">
                      {formatCurrency(cart.total)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {filtered.length > ITEMS_PER_PAGE && (
          <div className="flex items-center justify-between border-t border-white/10 bg-white/5 px-6 py-4">
            <span className="text-xs text-gray-400">
              Mostrando <span className="text-white">{(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)}</span> de <span className="text-white">{filtered.length}</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-50"
              >
                <ChevronLeft className="size-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold ${
                    currentPage === page
                      ? "bg-primary text-white shadow-lg shadow-primary/30"
                      : "border border-white/10 text-gray-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-50"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
