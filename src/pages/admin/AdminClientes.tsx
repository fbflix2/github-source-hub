import { useState, useEffect } from "react";
import { Users, Wallet, CheckCircle, Search, LogIn, KeyRound, Pencil, MoreVertical, ChevronLeft, ChevronRight, UserPlus, TrendingUp, Minus, X, Ban, Clock, Loader2, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

type ClientStatus = "active" | "inactive" | "blocked";

interface Client {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  balance: number;
  status: string;
  avatar_url: string | null;
  created_at: string;
  has_active_subscription: boolean;
}

type FilterType = "all" | "subscribers" | "with-balance" | "blocked";

const ITEMS_PER_PAGE = 12;

export default function AdminClientes() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  // Stats
  const [totalClients, setTotalClients] = useState(0);
  const [clientsWithBalance, setClientsWithBalance] = useState(0);
  const [activeSubscriptions, setActiveSubscriptions] = useState(0);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    setLoading(true);

    // Fetch profiles with auth emails
    const [profilesRes, subsRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("subscriptions").select("user_id, status").eq("status", "active"),
    ]);

    const profiles = profilesRes.data || [];
    const activeSubs = subsRes.data || [];
    const activeSubUserIds = new Set(activeSubs.map(s => s.user_id));

    // Build client list
    const clientList: Client[] = profiles.map((p) => ({
      id: p.id,
      user_id: p.user_id,
      full_name: p.full_name,
      email: "", // Will be populated if possible
      phone: p.phone,
      balance: p.balance ?? 0,
      status: p.status ?? "active",
      avatar_url: p.avatar_url,
      created_at: p.created_at,
      has_active_subscription: activeSubUserIds.has(p.user_id),
    }));

    setClients(clientList);
    setTotalClients(clientList.length);
    setClientsWithBalance(clientList.filter(c => c.balance > 0).length);
    setActiveSubscriptions(activeSubs.length);
    setLoading(false);
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  };

  const getInitials = (name: string | null) => {
    if (!name) return "??";
    return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
  };

  const getStatusBadge = (client: Client) => {
    if (client.status === "blocked") {
      return (
        <div className="flex items-center gap-1 text-xs text-red-400 font-medium bg-red-500/10 w-fit px-2 py-0.5 rounded-full">
          <Ban className="w-3 h-3" />
          Bloqueado
        </div>
      );
    }
    if (client.has_active_subscription) {
      return (
        <div className="flex items-center gap-1 text-xs text-[#0bda0b] font-medium bg-[#0bda0b]/10 w-fit px-2 py-0.5 rounded-full">
          <CheckCircle className="w-3 h-3" />
          Assinatura Ativa
        </div>
      );
    }
    if (client.status === "active") {
      return (
        <div className="flex items-center gap-1 text-xs text-gray-400 font-medium bg-white/5 w-fit px-2 py-0.5 rounded-full">
          <Clock className="w-3 h-3" />
          Sem Assinatura
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1 text-xs text-red-400 font-medium bg-red-500/10 w-fit px-2 py-0.5 rounded-full">
        <X className="w-3 h-3" />
        Inativo
      </div>
    );
  };

  // Filtering
  const filteredClients = clients.filter((client) => {
    const matchesSearch =
      (client.full_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (client.phone || "").includes(searchTerm);

    switch (activeFilter) {
      case "subscribers":
        return matchesSearch && client.has_active_subscription;
      case "with-balance":
        return matchesSearch && client.balance > 0;
      case "blocked":
        return matchesSearch && client.status === "blocked";
      default:
        return matchesSearch;
    }
  });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredClients.length / ITEMS_PER_PAGE));
  const paginated = filteredClients.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeFilter]);

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
          <div className="bg-[rgba(30,15,15,0.4)] backdrop-blur-xl border border-white/[0.08] p-6 rounded-2xl flex items-center justify-between group shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
            <div className="flex flex-col gap-1">
              <p className="text-white/60 text-sm font-medium uppercase tracking-wider">Total de Clientes</p>
              <h3 className="text-4xl font-black text-white group-hover:text-primary transition-colors">
                {loading ? "..." : totalClients.toLocaleString("pt-BR")}
              </h3>
            </div>
            <div className="size-14 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
              <Users className="w-7 h-7 text-white/80" />
            </div>
          </div>

          <div className="bg-[rgba(30,15,15,0.4)] backdrop-blur-xl border border-white/[0.08] p-6 rounded-2xl flex items-center justify-between group shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
            <div className="flex flex-col gap-1">
              <p className="text-white/60 text-sm font-medium uppercase tracking-wider">Clientes com Saldo</p>
              <h3 className="text-4xl font-black text-white group-hover:text-primary transition-colors">
                {loading ? "..." : clientsWithBalance}
              </h3>
            </div>
            <div className="size-14 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
              <Wallet className="w-7 h-7 text-white/80" />
            </div>
          </div>

          <div className="bg-[rgba(30,15,15,0.4)] backdrop-blur-xl border border-white/[0.08] p-6 rounded-2xl flex items-center justify-between group shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
            <div className="flex flex-col gap-1">
              <p className="text-white/60 text-sm font-medium uppercase tracking-wider">Assinaturas Ativas</p>
              <h3 className="text-4xl font-black text-white group-hover:text-primary transition-colors">
                {loading ? "..." : activeSubscriptions}
              </h3>
            </div>
            <div className="size-14 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
              <CheckCircle className="w-7 h-7 text-white/80" />
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
              placeholder="Pesquisar por nome ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
            {[
              { key: "all" as FilterType, label: "Todos" },
              { key: "subscribers" as FilterType, label: "Assinantes" },
              { key: "with-balance" as FilterType, label: "Com Saldo" },
              { key: "blocked" as FilterType, label: "Bloqueados" },
            ].map((filter) => (
              <Button
                key={filter.key}
                onClick={() => setActiveFilter(filter.key)}
                className={`h-12 px-6 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${
                  activeFilter === filter.key
                    ? "bg-primary text-white shadow-lg shadow-primary/20"
                    : filter.key === "blocked"
                      ? "bg-white/5 hover:bg-white/10 text-red-400 border border-white/5"
                      : "bg-white/5 hover:bg-white/10 text-white border border-white/5"
                }`}
              >
                {filter.label}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* Client Cards Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : paginated.length === 0 ? (
        <div className="text-center py-20">
          <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">Nenhum cliente encontrado.</p>
        </div>
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
          {paginated.map((client) => (
            <div
              key={client.id}
              className="bg-[rgba(30,15,15,0.4)] backdrop-blur-xl border border-white/[0.08] p-5 rounded-2xl flex flex-col gap-4 relative overflow-hidden group hover:bg-[rgba(45,20,20,0.6)] hover:border-primary/30 hover:-translate-y-0.5 transition-all shadow-[0_4px_30px_rgba(0,0,0,0.5)]"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              {/* Header */}
              <div className="flex justify-between items-start">
                <div className="flex gap-3">
                  {client.avatar_url ? (
                    <div
                      className="size-12 bg-center bg-no-repeat bg-cover rounded-xl shadow-inner border border-white/10"
                      style={{ backgroundImage: `url(${client.avatar_url})` }}
                    />
                  ) : (
                    <div className="size-12 rounded-xl bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center text-white font-bold text-lg border border-white/10 shadow-inner">
                      {getInitials(client.full_name)}
                    </div>
                  )}
                  <div>
                    <h3 className="text-white font-bold text-lg leading-tight group-hover:text-primary transition-colors cursor-pointer">
                      {client.full_name || "Sem nome"}
                    </h3>
                    {getStatusBadge(client)}
                  </div>
                </div>
                <button className="text-white/40 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>

              {/* Contact Info */}
              <div className="flex flex-col gap-2 py-2 border-y border-white/5">
                {client.phone && (
                  <div className="flex items-center gap-2 text-sm text-white/60">
                    <Phone className="w-4 h-4 text-white/40" />
                    <span>{client.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <Mail className="w-4 h-4 text-white/40" />
                  <span className="truncate text-white/40 text-xs">ID: {client.user_id.substring(0, 8)}...</span>
                </div>
              </div>

              {/* Balance and Actions */}
              <div className="flex items-end justify-between mt-auto">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/40 font-bold mb-1">Saldo Atual</p>
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
                  <button className="size-9 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-primary border border-white/5 transition-all" title="Acessar Conta">
                    <LogIn className="w-4 h-4" />
                  </button>
                  <button className="size-9 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-primary border border-white/5 transition-all" title="Resetar Senha">
                    <KeyRound className="w-4 h-4" />
                  </button>
                  <button className="size-9 flex items-center justify-center rounded-lg bg-primary/20 hover:bg-primary text-primary hover:text-white border border-primary/20 transition-all" title="Editar">
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
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
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((page) => (
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
              {totalPages > 5 && (
                <>
                  <span className="text-white/30">...</span>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    className={`${
                      currentPage === totalPages
                        ? "text-white bg-primary size-6 flex items-center justify-center rounded-full"
                        : "text-white/50 hover:text-white px-2"
                    }`}
                  >
                    {totalPages}
                  </button>
                </>
              )}
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
      )}
    </div>
  );
}
