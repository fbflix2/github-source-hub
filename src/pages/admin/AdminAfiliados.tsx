import { useState } from "react";
import { TrendingUp, Search, Download, CreditCard, Plus, MoreVertical, ChevronLeft, ChevronRight, BarChart3, Wallet, ShoppingCart, Users, Calendar, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type AffiliateStatus = "active" | "pending" | "blocked";
type FilterType = "all" | "active" | "pending" | "top" | "new";

interface Affiliate {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  commission: number;
  totalSales: number;
  pending: number;
  status: AffiliateStatus;
  lastLogin: string;
}

interface TopPerformer {
  name: string;
  value: number;
  height: number;
  isHighlight: boolean;
}

const mockAffiliates: Affiliate[] = [
  {
    id: "1",
    name: "João Silva",
    email: "joao.silva@fbflix.com",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
    commission: 15,
    totalSales: 15420,
    pending: 2313,
    status: "active",
    lastLogin: "2 horas atrás",
  },
  {
    id: "2",
    name: "Maria Oliveira",
    email: "maria.oli@fbflix.com",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
    commission: 10,
    totalSales: 8200,
    pending: 0,
    status: "pending",
    lastLogin: "1 dia atrás",
  },
  {
    id: "3",
    name: "Carlos Souza",
    email: "carlos.s@fbflix.com",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop",
    commission: 20,
    totalSales: 45100,
    pending: 9020,
    status: "active",
    lastLogin: "5 min atrás",
  },
  {
    id: "4",
    name: "Ana Pereira",
    email: "ana.p@fbflix.com",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop",
    commission: 12,
    totalSales: 3500,
    pending: 420,
    status: "blocked",
    lastLogin: "1 mês atrás",
  },
  {
    id: "5",
    name: "Pedro Santos",
    email: "pedro.s@fbflix.com",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop",
    commission: 15,
    totalSales: 12000,
    pending: 1800,
    status: "active",
    lastLogin: "3 dias atrás",
  },
];

const topPerformers: TopPerformer[] = [
  { name: "Ana S.", value: 0, height: 96, isHighlight: false },
  { name: "Carlos E.", value: 0, height: 128, isHighlight: false },
  { name: "Marcos V.", value: 42000, height: 192, isHighlight: true },
  { name: "Julia R.", value: 0, height: 80, isHighlight: false },
  { name: "Pedro H.", value: 0, height: 112, isHighlight: false },
];

export default function AdminAfiliados() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedAffiliates, setSelectedAffiliates] = useState<string[]>([]);

  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  };

  const getStatusBadge = (status: AffiliateStatus) => {
    switch (status) {
      case "active":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Ativo
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
            Pendente
          </span>
        );
      case "blocked":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
            Bloqueado
          </span>
        );
    }
  };

  const filteredAffiliates = mockAffiliates.filter((aff) => {
    const matchesSearch =
      aff.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      aff.email.toLowerCase().includes(searchTerm.toLowerCase());

    switch (activeFilter) {
      case "active":
        return matchesSearch && aff.status === "active";
      case "pending":
        return matchesSearch && aff.status === "pending";
      case "top":
        return matchesSearch && aff.totalSales > 10000;
      case "new":
        return matchesSearch;
      default:
        return matchesSearch;
    }
  });

  const toggleSelectAll = () => {
    if (selectedAffiliates.length === filteredAffiliates.length) {
      setSelectedAffiliates([]);
    } else {
      setSelectedAffiliates(filteredAffiliates.map((a) => a.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedAffiliates((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const totalAffiliates = 1248;
  const totalPages = 24;

  return (
    <div className="flex flex-col gap-6 py-6">
      {/* Header */}
      <h1 className="text-3xl font-black tracking-tight text-white mb-2">
        Controle de Afiliados
      </h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Comissões a Pagar */}
        <div className="bg-[rgba(20,20,20,0.6)] backdrop-blur-xl border border-white/[0.08] rounded-xl p-5 relative overflow-hidden group">
          <div className="absolute bottom-0 left-0 w-2/3 h-[2px] bg-gradient-to-r from-primary to-transparent opacity-80" />
          <div className="absolute top-1/2 -translate-y-1/2 right-2 opacity-15 text-neutral-500">
            <Wallet className="w-16 h-16" />
          </div>
          <div className="flex justify-between items-start mb-4">
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
              Comissões a Pagar
            </span>
            <span className="bg-[#3d1818] text-red-200 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-900/30">
              Pendente
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-3xl font-bold text-white">R$ 12.450,00</span>
            <div className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
              <TrendingUp className="w-4 h-4" />
              <span>+5.2% vs mês anterior</span>
            </div>
          </div>
        </div>

        {/* Vendas no Mês */}
        <div className="bg-[rgba(20,20,20,0.6)] backdrop-blur-xl border border-white/[0.08] rounded-xl p-5 relative overflow-hidden group">
          <div className="absolute top-1/2 -translate-y-1/2 right-2 opacity-15 text-neutral-500">
            <ShoppingCart className="w-16 h-16" />
          </div>
          <div className="flex justify-between items-start mb-4">
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
              Vendas no Mês
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-3xl font-bold text-white">R$ 145.200,00</span>
            <div className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
              <TrendingUp className="w-4 h-4" />
              <span>+12.0% meta batida</span>
            </div>
          </div>
        </div>

        {/* Afiliados Ativos */}
        <div className="bg-[rgba(20,20,20,0.6)] backdrop-blur-xl border border-white/[0.08] rounded-xl p-5 relative overflow-hidden group">
          <div className="absolute top-1/2 -translate-y-1/2 right-2 opacity-15 text-neutral-500">
            <Users className="w-16 h-16" />
          </div>
          <div className="flex justify-between items-start mb-4">
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
              Afiliados Ativos
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-3xl font-bold text-white">42</span>
            <div className="flex items-center gap-1 text-xs text-neutral-500 font-medium">
              <span>Total de 156 cadastrados</span>
            </div>
          </div>
        </div>

        {/* Próximo Pagamento */}
        <div className="bg-[rgba(20,20,20,0.6)] backdrop-blur-xl border border-white/[0.08] rounded-xl p-5 relative overflow-hidden group border-r-4 border-r-primary/20">
          <div className="absolute top-1/2 -translate-y-1/2 right-2 opacity-15 text-neutral-500">
            <Calendar className="w-16 h-16" />
          </div>
          <div className="absolute top-3 right-3">
            <Info className="w-4 h-4 text-neutral-600 cursor-help" />
          </div>
          <div className="flex justify-between items-start mb-4">
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
              Próximo Pagamento
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-3xl font-bold text-white">15 Nov</span>
            <div className="flex items-center gap-1 text-xs text-neutral-500 font-medium">
              <span>Restam 5 dias</span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts and Filters Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Performance Chart */}
        <div className="lg:col-span-2 bg-[rgba(20,20,20,0.6)] backdrop-blur-xl border border-white/[0.08] rounded-xl p-6 flex flex-col min-h-[300px]">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-bold text-white">Top Performance (Top 5)</h3>
            </div>
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-1.5 flex items-center gap-2 cursor-pointer hover:border-neutral-600 transition-colors">
              <span className="text-xs text-neutral-300">Este Mês</span>
              <ChevronRight className="w-4 h-4 text-neutral-500 rotate-90" />
            </div>
          </div>
          <div className="flex items-end justify-between h-full gap-4 px-4 pb-2">
            {topPerformers.map((performer, index) => (
              <div key={index} className="flex flex-col items-center gap-2 w-full group cursor-pointer">
                {performer.isHighlight && (
                  <span className="text-xs font-bold text-white mb-1">R$ 42k</span>
                )}
                <div
                  className={`w-full max-w-[40px] rounded-t-sm transition-all ${
                    performer.isHighlight
                      ? "bg-gradient-to-b from-primary to-[#8a0000] shadow-[0_0_15px_rgba(249,6,6,0.3)]"
                      : "bg-gradient-to-b from-[#333] to-[#1a1a1a] group-hover:from-neutral-600"
                  }`}
                  style={{ height: `${performer.height}px` }}
                />
                <span
                  className={`text-[10px] font-medium ${
                    performer.isHighlight ? "text-white font-bold" : "text-neutral-500"
                  }`}
                >
                  {performer.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Filters */}
        <div className="bg-[rgba(20,20,20,0.6)] backdrop-blur-xl border border-white/[0.08] rounded-xl p-6 flex flex-col">
          <h3 className="text-lg font-bold text-white mb-6">Filtros Rápidos</h3>
          <div className="flex flex-wrap gap-3 mb-auto">
            <Button
              onClick={() => setActiveFilter("all")}
              className={`px-4 py-2 rounded-full text-sm transition-all ${
                activeFilter === "all"
                  ? "bg-primary hover:bg-primary/80 text-white font-semibold shadow-[0_0_15px_rgba(249,6,6,0.3)]"
                  : "bg-neutral-900/50 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-600 text-neutral-400 hover:text-white font-medium"
              }`}
            >
              Todos
            </Button>
            <Button
              onClick={() => setActiveFilter("active")}
              className={`px-4 py-2 rounded-full text-sm transition-all ${
                activeFilter === "active"
                  ? "bg-primary hover:bg-primary/80 text-white font-semibold shadow-[0_0_15px_rgba(249,6,6,0.3)]"
                  : "bg-neutral-900/50 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-600 text-neutral-400 hover:text-white font-medium"
              }`}
            >
              Ativos
            </Button>
            <Button
              onClick={() => setActiveFilter("pending")}
              className={`px-4 py-2 rounded-full text-sm transition-all ${
                activeFilter === "pending"
                  ? "bg-primary hover:bg-primary/80 text-white font-semibold shadow-[0_0_15px_rgba(249,6,6,0.3)]"
                  : "bg-neutral-900/50 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-600 text-neutral-400 hover:text-white font-medium"
              }`}
            >
              Pendentes
            </Button>
            <Button
              onClick={() => setActiveFilter("top")}
              className={`px-4 py-2 rounded-full text-sm transition-all ${
                activeFilter === "top"
                  ? "bg-primary hover:bg-primary/80 text-white font-semibold shadow-[0_0_15px_rgba(249,6,6,0.3)]"
                  : "bg-neutral-900/50 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-600 text-neutral-400 hover:text-white font-medium"
              }`}
            >
              Top Performance
            </Button>
            <Button
              onClick={() => setActiveFilter("new")}
              className={`px-4 py-2 rounded-full text-sm transition-all ${
                activeFilter === "new"
                  ? "bg-primary hover:bg-primary/80 text-white font-semibold shadow-[0_0_15px_rgba(249,6,6,0.3)]"
                  : "bg-neutral-900/50 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-600 text-neutral-400 hover:text-white font-medium"
              }`}
            >
              Novos
            </Button>
          </div>

          {/* Monthly Goal Progress */}
          <div className="mt-8 pt-6 border-t border-neutral-800">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold text-neutral-500 uppercase">
                Progresso da Meta Mensal
              </span>
            </div>
            <div className="w-full bg-neutral-900 rounded-full h-2 mb-2 overflow-hidden">
              <div className="bg-primary h-2 rounded-full" style={{ width: "78%" }} />
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-white">78%</span>
              <span className="text-neutral-500">Meta: R$ 180k</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Actions Bar */}
      <div className="bg-[rgba(20,20,20,0.6)] backdrop-blur-xl border border-white/[0.08] rounded-xl p-4 flex flex-col md:flex-row justify-between items-center gap-4 sticky top-4 z-20 shadow-2xl shadow-black/50">
        <div className="relative w-full md:w-96 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500 group-focus-within:text-white transition-colors" />
          <Input
            className="w-full rounded-lg border border-neutral-800 bg-neutral-900/50 py-2.5 pl-10 pr-4 text-sm text-white placeholder-neutral-500 focus:border-primary focus:ring-1 focus:ring-primary transition-all h-11"
            placeholder="Buscar por nome, email ou ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          <Button
            variant="outline"
            className="h-10 px-4 bg-transparent border border-neutral-700 hover:border-white text-neutral-300 hover:text-white transition-all text-sm font-semibold gap-2"
          >
            <Download className="w-5 h-5" />
            <span className="hidden sm:inline">Exportar</span>
          </Button>
          <Button className="h-10 px-4 bg-[#2a1212] border border-[#4a2121] hover:bg-[#3d1818] text-red-200 transition-all text-sm font-semibold gap-2">
            <CreditCard className="w-5 h-5" />
            <span>Pagar Comissões</span>
          </Button>
          <Button className="h-10 px-5 bg-primary hover:bg-primary/80 text-white shadow-[0_0_15px_rgba(249,6,6,0.4)] hover:shadow-[0_0_25px_rgba(249,6,6,0.6)] transition-all text-sm font-bold gap-2">
            <Plus className="w-5 h-5" />
            <span>Cadastrar Novo</span>
          </Button>
        </div>
      </div>

      {/* Affiliates Table */}
      <div className="bg-[rgba(20,20,20,0.6)] backdrop-blur-xl border border-white/[0.08] rounded-xl overflow-hidden flex flex-col flex-1 min-h-[500px]">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-neutral-800 bg-neutral-900/40 hover:bg-neutral-900/40">
                <TableHead className="w-12 text-center">
                  <Checkbox
                    checked={selectedAffiliates.length === filteredAffiliates.length && filteredAffiliates.length > 0}
                    onCheckedChange={toggleSelectAll}
                    className="border-neutral-700 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                </TableHead>
                <TableHead className="text-xs font-semibold tracking-wide text-neutral-400 uppercase w-16">
                  Perfil
                </TableHead>
                <TableHead className="text-xs font-semibold tracking-wide text-neutral-400 uppercase">
                  Nome
                </TableHead>
                <TableHead className="text-xs font-semibold tracking-wide text-neutral-400 uppercase hidden md:table-cell">
                  Email
                </TableHead>
                <TableHead className="text-xs font-semibold tracking-wide text-neutral-400 uppercase text-right">
                  Comissão
                </TableHead>
                <TableHead className="text-xs font-semibold tracking-wide text-neutral-400 uppercase text-right">
                  Vendas Totais
                </TableHead>
                <TableHead className="text-xs font-semibold tracking-wide text-neutral-400 uppercase text-right">
                  Pendente
                </TableHead>
                <TableHead className="text-xs font-semibold tracking-wide text-neutral-400 uppercase text-center">
                  Status
                </TableHead>
                <TableHead className="text-xs font-semibold tracking-wide text-neutral-400 uppercase hidden lg:table-cell">
                  Último Login
                </TableHead>
                <TableHead className="text-xs font-semibold tracking-wide text-neutral-400 uppercase w-16 text-center">
                  Ações
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-neutral-800/50 text-sm">
              {filteredAffiliates.map((affiliate, index) => (
                <TableRow
                  key={affiliate.id}
                  className={`group hover:bg-white/[0.02] transition-colors ${
                    index % 2 === 1 ? "bg-white/[0.005]" : ""
                  }`}
                >
                  <TableCell className="text-center">
                    <Checkbox
                      checked={selectedAffiliates.includes(affiliate.id)}
                      onCheckedChange={() => toggleSelect(affiliate.id)}
                      className="border-neutral-700 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                  </TableCell>
                  <TableCell>
                    <div
                      className="h-10 w-10 rounded-full bg-neutral-800 bg-cover bg-center ring-2 ring-transparent group-hover:ring-neutral-700 transition-all"
                      style={{ backgroundImage: `url(${affiliate.avatar})` }}
                    />
                  </TableCell>
                  <TableCell
                    className={`font-medium ${
                      affiliate.status === "blocked" ? "text-neutral-400 line-through" : "text-white"
                    }`}
                  >
                    {affiliate.name}
                  </TableCell>
                  <TableCell
                    className={`hidden md:table-cell ${
                      affiliate.status === "blocked" ? "text-neutral-500" : "text-neutral-400"
                    }`}
                  >
                    {affiliate.email}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums ${
                      affiliate.status === "blocked" ? "text-neutral-500" : "text-neutral-300"
                    }`}
                  >
                    {affiliate.commission}%
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium tabular-nums ${
                      affiliate.status === "blocked" ? "text-neutral-500" : "text-white"
                    }`}
                  >
                    R$ {formatCurrency(affiliate.totalSales)}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums ${
                      affiliate.status === "blocked"
                        ? "text-neutral-500"
                        : affiliate.pending > 0
                        ? "text-primary font-bold"
                        : "text-neutral-400"
                    }`}
                  >
                    R$ {formatCurrency(affiliate.pending)}
                  </TableCell>
                  <TableCell className="text-center">
                    {getStatusBadge(affiliate.status)}
                  </TableCell>
                  <TableCell
                    className={`hidden lg:table-cell text-xs ${
                      affiliate.status === "blocked" ? "text-neutral-600" : "text-neutral-500"
                    }`}
                  >
                    {affiliate.lastLogin}
                  </TableCell>
                  <TableCell className="text-center">
                    <button className="text-neutral-500 hover:text-white transition-colors p-1 rounded hover:bg-neutral-800">
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="border-t border-neutral-800 bg-neutral-900/30 p-4 flex items-center justify-between mt-auto">
          <div className="text-xs text-neutral-500 hidden sm:block">
            Mostrando <span className="font-medium text-white">1-{filteredAffiliates.length}</span> de{" "}
            <span className="font-medium text-white">{totalAffiliates}</span> afiliados
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              className="flex items-center justify-center h-8 w-8 rounded-lg border border-neutral-800 bg-transparent text-neutral-400 hover:text-white hover:border-neutral-600 disabled:opacity-50 transition-colors"
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {[1, 2, 3].map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`flex items-center justify-center h-8 w-8 rounded-lg text-xs transition-colors ${
                  currentPage === page
                    ? "bg-primary text-white font-bold shadow-lg shadow-red-900/50"
                    : "border border-transparent hover:bg-neutral-800 text-neutral-400"
                }`}
              >
                {page}
              </button>
            ))}
            <span className="text-neutral-600 text-xs px-1">...</span>
            <button
              onClick={() => setCurrentPage(totalPages)}
              className={`flex items-center justify-center h-8 w-8 rounded-lg text-xs transition-colors ${
                currentPage === totalPages
                  ? "bg-primary text-white font-bold shadow-lg shadow-red-900/50"
                  : "border border-transparent hover:bg-neutral-800 text-neutral-400"
              }`}
            >
              {totalPages}
            </button>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              className="flex items-center justify-center h-8 w-8 rounded-lg border border-neutral-800 bg-transparent text-neutral-400 hover:text-white hover:border-neutral-600 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-8 text-center text-xs text-neutral-600 pb-4">
        <p>FBFLIX Admin Dashboard • Versão 3.1.2 build 892</p>
      </footer>
    </div>
  );
}
