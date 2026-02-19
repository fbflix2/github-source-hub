import { useState } from "react";
import { Users, Wallet, CheckCircle, Search, LogIn, KeyRound, Pencil, MoreVertical, ChevronLeft, ChevronRight, UserPlus, TrendingUp, Minus, X, Ban, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ClientStatus = "active" | "inactive" | "pending" | "blocked";

interface Client {
  id: string;
  name: string;
  initials: string;
  email: string;
  phone: string;
  balance: number;
  status: ClientStatus;
  avatar?: string;
}

const mockClients: Client[] = [
  { id: "1", name: "João Silva", initials: "JS", email: "joao.silva@email.com", phone: "(11) 98765-4321", balance: 50.0, status: "active" },
  { id: "2", name: "Maria Oliveira", initials: "MO", email: "maria.oli@outlook.com", phone: "(21) 99888-7777", balance: 0, status: "inactive", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop" },
  { id: "3", name: "Carlos Pereira", initials: "CP", email: "carlos.p@company.com", phone: "(31) 91234-5678", balance: 125.9, status: "active" },
  { id: "4", name: "Ana Souza", initials: "AS", email: "ana.souza@gmail.com", phone: "(41) 95555-4444", balance: 10.0, status: "pending", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop" },
  { id: "5", name: "Rafael F.", initials: "RF", email: "rafael.ferr@uol.com.br", phone: "(51) 98888-2222", balance: 2400.0, status: "active" },
  { id: "6", name: "Lucas Mendes", initials: "LM", email: "lucas.mendes@dev.io", phone: "(61) 97777-6666", balance: 0, status: "blocked", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop" },
];

type FilterType = "all" | "subscribers" | "with-balance" | "blocked";

export default function AdminClientes() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [currentPage, setCurrentPage] = useState(1);

  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  };

  const getStatusBadge = (status: ClientStatus) => {
    switch (status) {
      case "active":
        return (
          <div className="flex items-center gap-1 text-xs text-[#0bda0b] font-medium bg-[#0bda0b]/10 w-fit px-2 py-0.5 rounded-full">
            <CheckCircle className="w-3 h-3" />
            Assinatura Ativa
          </div>
        );
      case "inactive":
        return (
          <div className="flex items-center gap-1 text-xs text-red-400 font-medium bg-red-500/10 w-fit px-2 py-0.5 rounded-full">
            <X className="w-3 h-3" />
            Inativa
          </div>
        );
      case "pending":
        return (
          <div className="flex items-center gap-1 text-xs text-yellow-400 font-medium bg-yellow-400/10 w-fit px-2 py-0.5 rounded-full">
            <Clock className="w-3 h-3" />
            Pendente
          </div>
        );
      case "blocked":
        return (
          <div className="flex items-center gap-1 text-xs text-red-400 font-medium bg-red-500/10 w-fit px-2 py-0.5 rounded-full">
            <Ban className="w-3 h-3" />
            Bloqueado
          </div>
        );
    }
  };

  const filteredClients = mockClients.filter((client) => {
    const matchesSearch =
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email.toLowerCase().includes(searchTerm.toLowerCase());

    switch (activeFilter) {
      case "subscribers":
        return matchesSearch && client.status === "active";
      case "with-balance":
        return matchesSearch && client.balance > 0;
      case "blocked":
        return matchesSearch && client.status === "blocked";
      default:
        return matchesSearch;
    }
  });

  const totalClients = 1240;
  const clientsWithBalance = 345;
  const activeSubscriptions = 890;
  const totalPages = 12;

  return (
    <div className="flex flex-col gap-8 py-6">
      {/* Header */}
      <section className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-2">
              Base de Clientes
            </h1>
            <p className="text-white/60 text-lg">
              Gerencie usuários, saldos e assinaturas de forma centralizada.
            </p>
          </div>
          <Button className="bg-primary hover:bg-primary/80 text-white px-6 py-3 h-auto rounded-xl font-bold flex items-center gap-2 shadow-[0_0_20px_rgba(249,6,6,0.4)] transition-all hover:scale-105">
            <UserPlus className="w-5 h-5" />
            Novo Cliente
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total de Clientes */}
          <div className="bg-[rgba(30,15,15,0.4)] backdrop-blur-xl border border-white/[0.08] p-6 rounded-2xl flex items-center justify-between group shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
            <div className="flex flex-col gap-1">
              <p className="text-white/60 text-sm font-medium uppercase tracking-wider">
                Total de Clientes
              </p>
              <h3 className="text-4xl font-black text-white group-hover:text-primary transition-colors">
                {totalClients.toLocaleString("pt-BR")}
              </h3>
              <div className="flex items-center gap-1 text-[#0bda0b] text-sm font-bold bg-[#0bda0b]/10 w-fit px-2 py-0.5 rounded-md mt-1">
                <TrendingUp className="w-4 h-4" />
                +5% este mês
              </div>
            </div>
            <div className="size-14 rounded-full bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-primary/50 transition-colors">
              <Users className="w-7 h-7 text-white/80 group-hover:text-primary" />
            </div>
          </div>

          {/* Clientes com Saldo */}
          <div className="bg-[rgba(30,15,15,0.4)] backdrop-blur-xl border border-white/[0.08] p-6 rounded-2xl flex items-center justify-between group shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
            <div className="flex flex-col gap-1">
              <p className="text-white/60 text-sm font-medium uppercase tracking-wider">
                Clientes com Saldo
              </p>
              <h3 className="text-4xl font-black text-white group-hover:text-primary transition-colors">
                {clientsWithBalance}
              </h3>
              <div className="flex items-center gap-1 text-[#0bda0b] text-sm font-bold bg-[#0bda0b]/10 w-fit px-2 py-0.5 rounded-md mt-1">
                <TrendingUp className="w-4 h-4" />
                +12% Recente
              </div>
            </div>
            <div className="size-14 rounded-full bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-primary/50 transition-colors">
              <Wallet className="w-7 h-7 text-white/80 group-hover:text-primary" />
            </div>
          </div>

          {/* Assinaturas Ativas */}
          <div className="bg-[rgba(30,15,15,0.4)] backdrop-blur-xl border border-white/[0.08] p-6 rounded-2xl flex items-center justify-between group shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
            <div className="flex flex-col gap-1">
              <p className="text-white/60 text-sm font-medium uppercase tracking-wider">
                Assinaturas Ativas
              </p>
              <h3 className="text-4xl font-black text-white group-hover:text-primary transition-colors">
                {activeSubscriptions}
              </h3>
              <div className="flex items-center gap-1 text-white/40 text-sm font-bold bg-white/5 w-fit px-2 py-0.5 rounded-md mt-1">
                <Minus className="w-4 h-4" />
                Estável
              </div>
            </div>
            <div className="size-14 rounded-full bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-primary/50 transition-colors">
              <CheckCircle className="w-7 h-7 text-white/80 group-hover:text-primary" />
            </div>
          </div>
        </div>
      </section>

      {/* Search and Filters */}
      <section className="sticky top-6 z-40">
        <div className="bg-[rgba(30,15,15,0.4)] backdrop-blur-xl border border-white/[0.08] p-2 rounded-2xl flex flex-col md:flex-row gap-2 shadow-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <Input
              className="w-full h-12 pl-12 pr-4 bg-white/5 border-none rounded-xl text-white placeholder-white/30 focus:ring-2 focus:ring-primary focus:bg-white/10 transition-all text-sm font-medium"
              placeholder="Pesquisar por nome, CPF ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
            <Button
              onClick={() => setActiveFilter("all")}
              className={`h-12 px-6 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${
                activeFilter === "all"
                  ? "bg-primary text-white shadow-lg shadow-primary/20"
                  : "bg-white/5 hover:bg-white/10 text-white border border-white/5"
              }`}
            >
              Todos
            </Button>
            <Button
              onClick={() => setActiveFilter("subscribers")}
              className={`h-12 px-6 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                activeFilter === "subscribers"
                  ? "bg-primary text-white shadow-lg shadow-primary/20"
                  : "bg-white/5 hover:bg-white/10 text-white border border-white/5"
              }`}
            >
              Assinantes
            </Button>
            <Button
              onClick={() => setActiveFilter("with-balance")}
              className={`h-12 px-6 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                activeFilter === "with-balance"
                  ? "bg-primary text-white shadow-lg shadow-primary/20"
                  : "bg-white/5 hover:bg-white/10 text-white border border-white/5"
              }`}
            >
              Com Saldo
            </Button>
            <Button
              onClick={() => setActiveFilter("blocked")}
              className={`h-12 px-6 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                activeFilter === "blocked"
                  ? "bg-primary text-white shadow-lg shadow-primary/20"
                  : "bg-white/5 hover:bg-white/10 text-red-400 border border-white/5"
              }`}
            >
              Bloqueados
            </Button>
          </div>
        </div>
      </section>

      {/* Client Cards Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
        {filteredClients.map((client) => (
          <div
            key={client.id}
            className="bg-[rgba(30,15,15,0.4)] backdrop-blur-xl border border-white/[0.08] p-5 rounded-2xl flex flex-col gap-4 relative overflow-hidden group hover:bg-[rgba(45,20,20,0.6)] hover:border-primary/30 hover:-translate-y-0.5 transition-all shadow-[0_4px_30px_rgba(0,0,0,0.5)]"
          >
            {/* Hover highlight bar */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

            {/* Header */}
            <div className="flex justify-between items-start">
              <div className="flex gap-3">
                {client.avatar ? (
                  <div
                    className="size-12 bg-center bg-no-repeat bg-cover rounded-xl shadow-inner border border-white/10"
                    style={{ backgroundImage: `url(${client.avatar})` }}
                  />
                ) : (
                  <div className="size-12 rounded-xl bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center text-white font-bold text-lg border border-white/10 shadow-inner">
                    {client.initials}
                  </div>
                )}
                <div>
                  <h3 className="text-white font-bold text-lg leading-tight group-hover:text-primary transition-colors cursor-pointer">
                    {client.name}
                  </h3>
                  {getStatusBadge(client.status)}
                </div>
              </div>
              <button className="text-white/40 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>

            {/* Contact Info */}
            <div className="flex flex-col gap-2 py-2 border-y border-white/5">
              <div className="flex items-center gap-2 text-sm text-white/60">
                <span className="text-[18px]">✉</span>
                <span className="truncate">{client.email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-white/60">
                <span className="text-[18px]">📞</span>
                <span>{client.phone}</span>
              </div>
            </div>

            {/* Balance and Actions */}
            <div className="flex items-end justify-between mt-auto">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/40 font-bold mb-1">
                  Saldo Atual
                </p>
                <p className={`text-xl font-black tracking-tight ${client.balance > 0 ? "text-white" : "text-white/50"}`}>
                  R${" "}
                  {client.balance > 0 ? (
                    <span className="text-primary">{formatCurrency(client.balance)}</span>
                  ) : (
                    formatCurrency(client.balance)
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  className="size-9 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-primary border border-white/5 transition-all"
                  title="Acessar Conta"
                >
                  <LogIn className="w-4 h-4" />
                </button>
                <button
                  className="size-9 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-primary border border-white/5 transition-all"
                  title="Resetar Senha"
                >
                  <KeyRound className="w-4 h-4" />
                </button>
                <button
                  className="size-9 flex items-center justify-center rounded-lg bg-primary/20 hover:bg-primary text-primary hover:text-white border border-primary/20 transition-all shadow-[0_0_10px_rgba(249,6,6,0.1)] hover:shadow-[0_0_15px_rgba(249,6,6,0.4)]"
                  title="Editar"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Pagination */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <div className="bg-[rgba(30,15,15,0.4)] backdrop-blur-xl border border-white/[0.08] px-4 py-2 rounded-full flex items-center gap-4 shadow-2xl shadow-black/80">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            className="size-8 flex items-center justify-center rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
            disabled={currentPage === 1}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 text-sm font-medium">
            {[1, 2, 3].map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`${
                  currentPage === page
                    ? "text-white bg-primary size-6 flex items-center justify-center rounded-full shadow-lg shadow-primary/40"
                    : "text-white/50 hover:text-white px-2"
                }`}
              >
                {page}
              </button>
            ))}
            <span className="text-white/30">...</span>
            <button
              onClick={() => setCurrentPage(totalPages)}
              className={`${
                currentPage === totalPages
                  ? "text-white bg-primary size-6 flex items-center justify-center rounded-full shadow-lg shadow-primary/40"
                  : "text-white/50 hover:text-white px-2"
              }`}
            >
              {totalPages}
            </button>
          </div>
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            className="size-8 flex items-center justify-center rounded-full text-white hover:bg-white/10 transition-colors disabled:opacity-50"
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
