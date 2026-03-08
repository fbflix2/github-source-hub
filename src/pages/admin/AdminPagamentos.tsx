import { useState, useEffect } from "react";
import { Search, Download, ChevronLeft, ChevronRight, Eye, Receipt, TrendingUp, TrendingDown, QrCode, CreditCard, Wallet, Calendar, Loader2 } from "lucide-react";
import { useProxyRevenue } from "@/hooks/useProxyRevenue";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { supabase } from "@/integrations/supabase/client";

interface Payment {
  id: string;
  code: string;
  status: string;
  gateway: string;
  gateway_reference: string | null;
  amount: number;
  created_at: string;
  user_id: string;
  metadata: any;
  client_name: string | null;
  client_cpf: string | null;
}

const statusMap: Record<string, string> = {
  completed: "Aprovado",
  pending: "Pendente",
  failed: "Cancelado",
  cancelled: "Cancelado",
};

const statusFilterMap: Record<string, string[]> = {
  todos: [],
  aprovado: ["completed"],
  pendente: ["pending"],
  cancelado: ["failed", "cancelled"],
};

const getStatusBadge = (status: string) => {
  const label = statusMap[status] || status;
  const styles: Record<string, string> = {
    Aprovado: "bg-green-500/10 text-green-400 ring-green-500/20",
    Pendente: "bg-yellow-500/10 text-yellow-400 ring-yellow-500/20",
    Cancelado: "bg-red-500/10 text-red-400 ring-red-500/20",
  };
  const dotStyles: Record<string, string> = {
    Aprovado: "bg-green-400",
    Pendente: "bg-yellow-400 animate-pulse",
    Cancelado: "bg-red-400",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${styles[label] || "bg-white/10 text-white/60 ring-white/20"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotStyles[label] || "bg-white/40"}`}></span>
      {label}
    </span>
  );
};

const getGatewayDisplay = (gateway: string) => {
  switch (gateway) {
    case "mercadopago":
      return { icon: <CreditCard className="size-4 text-blue-300" />, label: "Mercado Pago" };
    case "saldo":
      return { icon: <Wallet className="size-4 text-purple-400" />, label: "Saldo" };
    default:
      return { icon: <QrCode className="size-4 text-blue-400" />, label: gateway };
  }
};

const maskCpf = (cpf: string | null) => {
  if (!cpf) return "—";
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11) return cpf;
  return `***.${clean.slice(3, 6)}.${clean.slice(6, 9)}-**`;
};

const ITEMS_PER_PAGE = 10;

export default function AdminPagamentos() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [gatewayFilter, setGatewayFilter] = useState("todos");
  const [currentPage, setCurrentPage] = useState(1);
  const { totalRevenue: proxyRevenue } = useProxyRevenue();

  useEffect(() => {
    async function fetchPayments() {
      const { data: paymentsData, error } = await supabase
        .from("payments")
        .select("id, code, status, gateway, amount, created_at, user_id, metadata, gateway_reference")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching payments:", error);
        setLoading(false);
        return;
      }

      const userIds = [...new Set((paymentsData ?? []).map(p => p.user_id))];
      
      let profileMap: Record<string, { full_name: string | null; cpf: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, cpf")
          .in("user_id", userIds);
        (profiles ?? []).forEach(p => {
          profileMap[p.user_id] = { full_name: p.full_name, cpf: p.cpf };
        });
      }

      setPayments(
        (paymentsData ?? []).map(p => ({
          ...p,
          client_name: profileMap[p.user_id]?.full_name || null,
          client_cpf: profileMap[p.user_id]?.cpf || null,
        }))
      );
      setLoading(false);
    }
    fetchPayments();
  }, []);

  // Stats
  const totalAll = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalReceived = payments
    .filter(p => p.status === "completed")
    .reduce((sum, p) => sum + p.amount, 0) + proxyRevenue;
  const approvedCount = payments.filter(p => p.status === "completed").length;
  const pendingCount = payments.filter(p => p.status === "pending").length;

  // Filter
  const filtered = payments.filter(p => {
    if (statusFilter !== "todos") {
      const allowed = statusFilterMap[statusFilter] || [];
      if (!allowed.includes(p.status)) return false;
    }
    if (gatewayFilter !== "todos" && p.gateway !== gatewayFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        p.code.toLowerCase().includes(term) ||
        (p.client_name || "").toLowerCase().includes(term) ||
        p.gateway.toLowerCase().includes(term) ||
        (p.client_cpf || "").includes(term)
      );
    }
    return true;
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
            Histórico de Pagamentos
          </h1>
          <p className="text-base font-light text-gray-400">
            Gerencie transações, verifique status e emita comprovantes em tempo real.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <div className="glass-panel relative overflow-hidden rounded-2xl p-6 transition-transform hover:-translate-y-1">
          <div className="absolute -right-4 -top-4 rounded-full bg-primary/10 p-8 blur-2xl"></div>
          <div className="relative z-10 flex flex-col gap-1">
            <p className="text-sm font-medium text-gray-400">Total Processado</p>
            <h2 className="text-3xl font-bold text-white">{formatCurrency(totalAll)}</h2>
          </div>
        </div>

        <div className="glass-panel relative overflow-hidden rounded-2xl p-6 transition-transform hover:-translate-y-1">
          <div className="absolute -right-4 -top-4 rounded-full bg-emerald-500/10 p-8 blur-2xl"></div>
          <div className="relative z-10 flex flex-col gap-1">
            <p className="text-sm font-medium text-gray-400">Total Recebido</p>
            <h2 className="text-3xl font-bold text-emerald-400">{formatCurrency(totalReceived)}</h2>
          </div>
        </div>

        <div className="glass-panel relative overflow-hidden rounded-2xl p-6 transition-transform hover:-translate-y-1">
          <div className="absolute -right-4 -top-4 rounded-full bg-green-500/5 p-8 blur-2xl"></div>
          <div className="relative z-10 flex flex-col gap-1">
            <p className="text-sm font-medium text-gray-400">Transações Aprovadas</p>
            <h2 className="text-3xl font-bold text-white">{approvedCount}</h2>
          </div>
        </div>

        <div className="glass-panel relative overflow-hidden rounded-2xl p-6 transition-transform hover:-translate-y-1">
          <div className="absolute -right-4 -top-4 rounded-full bg-yellow-500/5 p-8 blur-2xl"></div>
          <div className="relative z-10 flex flex-col gap-1">
            <p className="text-sm font-medium text-gray-400">Pagamentos Pendentes</p>
            <h2 className="text-3xl font-bold text-white">{pendingCount}</h2>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-panel flex flex-col justify-between gap-4 rounded-2xl p-4 lg:flex-row lg:items-center">
        <div className="relative flex w-full max-w-lg items-center">
          <Search className="absolute left-4 size-4 text-gray-500" />
          <Input
            className="h-12 w-full rounded-xl border-white/10 bg-[#150a0a] pl-12 pr-4 text-sm text-white placeholder:text-gray-500 focus:border-primary focus:ring-1 focus:ring-primary"
            placeholder="Buscar por código, nome ou gateway..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="h-10 w-[140px] rounded-lg border-white/10 bg-[#150a0a] text-sm font-medium text-gray-300 hover:border-white/20">
              <SelectValue placeholder="Status: Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Status: Todos</SelectItem>
              <SelectItem value="aprovado">Aprovado</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>

          <Select value={gatewayFilter} onValueChange={(v) => { setGatewayFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="h-10 w-[150px] rounded-lg border-white/10 bg-[#150a0a] text-sm font-medium text-gray-300 hover:border-white/20">
              <SelectValue placeholder="Gateway: Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Gateway: Todos</SelectItem>
              <SelectItem value="mercadopago">Mercado Pago</SelectItem>
              <SelectItem value="saldo">Saldo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <Table className="w-full min-w-[900px]">
            <TableHeader>
              <TableRow className="border-b border-white/10 bg-white/5 hover:bg-white/5">
                <TableHead className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-400">Código</TableHead>
                <TableHead className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-400">Nº Mercado Pago</TableHead>
                <TableHead className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-400">Status</TableHead>
                <TableHead className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-400">Gateway</TableHead>
                <TableHead className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-400">Cliente</TableHead>
                <TableHead className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-400">Data e Hora</TableHead>
                <TableHead className="whitespace-nowrap px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-white/5 text-sm text-gray-300">
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-gray-500">
                    Nenhum pagamento encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((payment) => {
                  const gw = getGatewayDisplay(payment.gateway);
                  return (
                    <TableRow key={payment.id} className="group transition-colors hover:bg-white/5">
                      <TableCell className="whitespace-nowrap px-6 py-4 font-medium text-white">
                        {payment.code}
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        {getStatusBadge(payment.status)}
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {gw.icon}
                          {gw.label}
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-white">{payment.client_name || "Sem nome"}</span>
                          {payment.client_cpf && (
                            <span className="text-xs text-gray-600">CPF: {maskCpf(payment.client_cpf)}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-6 py-4 text-gray-400">
                        {formatDate(payment.created_at)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-6 py-4 text-right font-bold text-white">
                        {formatCurrency(payment.amount)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {filtered.length > ITEMS_PER_PAGE && (
          <div className="flex items-center justify-between border-t border-white/10 bg-white/5 px-6 py-4">
            <span className="text-xs text-gray-400">
              Mostrando <span className="text-white">{(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)}</span> de <span className="text-white">{filtered.length}</span> transações
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
