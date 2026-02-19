import { useState } from "react";
import { Search, Download, ChevronLeft, ChevronRight, Eye, Receipt, TrendingUp, TrendingDown, QrCode, CreditCard, Wallet, Calendar } from "lucide-react";
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

const mockPayments = [
  {
    id: "#TRX-9821",
    status: "Aprovado",
    gateway: "OpenPix",
    gatewayIcon: "qr",
    client: {
      name: "Carlos Mendes",
      email: "carlos.m@gmail.com",
      cpf: "***.452.190-**",
    },
    date: "24/10/2023 - 14:32",
    value: "R$ 29,90",
  },
  {
    id: "#TRX-9820",
    status: "Pendente",
    gateway: "Mercado Pago",
    gatewayIcon: "card",
    client: {
      name: "Ana Souza",
      email: "ana.s@outlook.com",
      cpf: "***.882.111-**",
    },
    date: "24/10/2023 - 14:15",
    value: "R$ 59,90",
  },
  {
    id: "#TRX-9819",
    status: "Cancelado",
    gateway: "Saldo",
    gatewayIcon: "wallet",
    client: {
      name: "Roberto Lima",
      email: "r.lima@uol.com.br",
      cpf: "***.002.391-**",
    },
    date: "24/10/2023 - 13:50",
    value: "R$ 29,90",
  },
  {
    id: "#TRX-9818",
    status: "Aprovado",
    gateway: "OpenPix",
    gatewayIcon: "qr",
    client: {
      name: "Fernanda Costa",
      email: "nanda.c@yahoo.com",
      cpf: "***.123.567-**",
    },
    date: "24/10/2023 - 13:10",
    value: "R$ 149,90",
  },
  {
    id: "#TRX-9817",
    status: "Aprovado",
    gateway: "Mercado Pago",
    gatewayIcon: "card",
    client: {
      name: "Lucas Pereira",
      email: "lucas.p@gmail.com",
      cpf: "***.999.001-**",
    },
    date: "24/10/2023 - 12:45",
    value: "R$ 29,90",
  },
];

const getStatusBadge = (status: string) => {
  const styles = {
    Aprovado: "bg-green-500/10 text-green-400 ring-green-500/20",
    Pendente: "bg-yellow-500/10 text-yellow-400 ring-yellow-500/20",
    Cancelado: "bg-red-500/10 text-primary ring-primary/20",
  };

  const dotStyles = {
    Aprovado: "bg-green-400",
    Pendente: "bg-yellow-400 animate-pulse",
    Cancelado: "bg-primary",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${styles[status as keyof typeof styles]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotStyles[status as keyof typeof dotStyles]}`}></span>
      {status}
    </span>
  );
};

const getGatewayIcon = (iconType: string) => {
  switch (iconType) {
    case "qr":
      return <QrCode className="size-4 text-blue-400" />;
    case "card":
      return <CreditCard className="size-4 text-blue-300" />;
    case "wallet":
      return <Wallet className="size-4 text-purple-400" />;
    default:
      return null;
  }
};

export default function AdminPagamentos() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [gatewayFilter, setGatewayFilter] = useState("todos");
  const [currentPage, setCurrentPage] = useState(1);

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
        <Button className="h-12 gap-2 rounded-xl bg-primary px-6 font-bold text-white shadow-[0_0_20px_rgba(249,6,6,0.3)] hover:bg-red-600 hover:shadow-[0_0_30px_rgba(249,6,6,0.5)]">
          <Download className="size-5" />
          Exportar Relatório
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="glass-panel relative overflow-hidden rounded-2xl p-6 transition-transform hover:-translate-y-1">
          <div className="absolute -right-4 -top-4 rounded-full bg-primary/10 p-8 blur-2xl"></div>
          <div className="relative z-10 flex flex-col gap-1">
            <p className="text-sm font-medium text-gray-400">Total Processado</p>
            <div className="flex items-baseline gap-2">
              <h2 className="text-3xl font-bold text-white">R$ 1.250.000</h2>
              <span className="flex items-center text-xs font-bold text-green-400">
                <TrendingUp className="size-3" />
                +12%
              </span>
            </div>
          </div>
        </div>

        <div className="glass-panel relative overflow-hidden rounded-2xl p-6 transition-transform hover:-translate-y-1">
          <div className="absolute -right-4 -top-4 rounded-full bg-green-500/5 p-8 blur-2xl"></div>
          <div className="relative z-10 flex flex-col gap-1">
            <p className="text-sm font-medium text-gray-400">Transações Aprovadas</p>
            <div className="flex items-baseline gap-2">
              <h2 className="text-3xl font-bold text-white">1.240</h2>
              <span className="flex items-center text-xs font-bold text-green-400">
                <TrendingUp className="size-3" />
                +5%
              </span>
            </div>
          </div>
        </div>

        <div className="glass-panel relative overflow-hidden rounded-2xl p-6 transition-transform hover:-translate-y-1">
          <div className="absolute -right-4 -top-4 rounded-full bg-yellow-500/5 p-8 blur-2xl"></div>
          <div className="relative z-10 flex flex-col gap-1">
            <p className="text-sm font-medium text-gray-400">Pagamentos Pendentes</p>
            <div className="flex items-baseline gap-2">
              <h2 className="text-3xl font-bold text-white">45</h2>
              <span className="flex items-center text-xs font-bold text-primary">
                <TrendingDown className="size-3" />
                -2%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-panel flex flex-col justify-between gap-4 rounded-2xl p-4 lg:flex-row lg:items-center">
        <div className="relative flex w-full max-w-lg items-center">
          <Search className="absolute left-4 size-4 text-gray-500" />
          <Input
            className="h-12 w-full rounded-xl border-white/10 bg-[#150a0a] pl-12 pr-4 text-sm text-white placeholder:text-gray-500 focus:border-primary focus:ring-1 focus:ring-primary"
            placeholder="Buscar por ID, Nome, CPF ou Gateway..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
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

          <Select value={gatewayFilter} onValueChange={setGatewayFilter}>
            <SelectTrigger className="h-10 w-[150px] rounded-lg border-white/10 bg-[#150a0a] text-sm font-medium text-gray-300 hover:border-white/20">
              <SelectValue placeholder="Gateway: Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Gateway: Todos</SelectItem>
              <SelectItem value="openpix">OpenPix</SelectItem>
              <SelectItem value="mercadopago">Mercado Pago</SelectItem>
              <SelectItem value="saldo">Saldo</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" className="h-10 gap-2 rounded-lg border-white/10 bg-[#150a0a] px-4 text-sm font-medium text-gray-300 hover:bg-white/5">
            <Calendar className="size-4" />
            Últimos 30 dias
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <Table className="w-full min-w-[1000px]">
            <TableHeader>
              <TableRow className="border-b border-white/10 bg-white/5 hover:bg-white/5">
                <TableHead className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  ID Transação
                </TableHead>
                <TableHead className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Status
                </TableHead>
                <TableHead className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Gateway
                </TableHead>
                <TableHead className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Cliente
                </TableHead>
                <TableHead className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Data e Hora
                </TableHead>
                <TableHead className="whitespace-nowrap px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Valor Total
                </TableHead>
                <TableHead className="whitespace-nowrap px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Ações
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-white/5 text-sm text-gray-300">
              {mockPayments.map((payment) => (
                <TableRow key={payment.id} className="group transition-colors hover:bg-white/5">
                  <TableCell className="whitespace-nowrap px-6 py-4 font-medium text-white">
                    {payment.id}
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    {getStatusBadge(payment.status)}
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {getGatewayIcon(payment.gatewayIcon)}
                      {payment.gateway}
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-medium text-white">{payment.client.name}</span>
                      <span className="text-xs text-gray-500">{payment.client.email}</span>
                      <span className="text-xs text-gray-600">CPF: {payment.client.cpf}</span>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-6 py-4 text-gray-400">
                    {payment.date}
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-6 py-4 text-right font-bold text-white">
                    {payment.value}
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <div className="flex justify-center gap-2">
                      <button
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-primary/20 hover:text-primary"
                        title="Ver Detalhes"
                      >
                        <Eye className="size-4" />
                      </button>
                      <button
                        className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                          payment.status === "Cancelado"
                            ? "cursor-not-allowed text-gray-600 opacity-50"
                            : "text-gray-400 hover:bg-primary/20 hover:text-primary"
                        }`}
                        title={payment.status === "Cancelado" ? "Indisponível" : "Emitir Comprovante"}
                        disabled={payment.status === "Cancelado"}
                      >
                        <Receipt className="size-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-white/10 bg-white/5 px-6 py-4">
          <span className="text-xs text-gray-400">
            Mostrando <span className="text-white">1-5</span> de <span className="text-white">1,285</span> transações
          </span>
          <div className="flex items-center gap-2">
            <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-50">
              <ChevronLeft className="size-4" />
            </button>
            {[1, 2, 3].map((page) => (
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
            <span className="px-1 text-gray-600">...</span>
            <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-gray-400 hover:bg-white/5 hover:text-white">
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
