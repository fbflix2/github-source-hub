import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Wallet, CheckCircle, Search, LogIn, KeyRound, Pencil, ChevronLeft, ChevronRight, UserPlus, TrendingUp, Minus, X, Ban, Clock, Loader2, Mail, Phone, UserRound, DollarSign, Upload, Download, BadgeCheck, LayoutGrid, List, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ClientEditModal from "@/components/admin/ClientEditModal";
import ClientHistoryModal from "@/components/admin/ClientHistoryModal";
import ResetPasswordModal from "@/components/admin/ResetPasswordModal";
import AdjustBalanceModal from "@/components/admin/AdjustBalanceModal";
import ImportClientsModal from "@/components/admin/ImportClientsModal";
import ExportClientsModal from "@/components/admin/ExportClientsModal";
import NewClientModal from "@/components/admin/NewClientModal";

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
  profile_complete: boolean;
}

type FilterType = "all" | "subscribers" | "with-balance" | "blocked";

const ITEMS_PER_PAGE = 12;

export default function AdminClientes() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [impersonating, setImpersonating] = useState<string | null>(null);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [historyClient, setHistoryClient] = useState<Client | null>(null);
  const [resetClient, setResetClient] = useState<Client | null>(null);
  const [balanceClient, setBalanceClient] = useState<Client | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showNewClient, setShowNewClient] = useState(false);

  // Stats
  const [totalClients, setTotalClients] = useState(0);
  const [clientsWithBalance, setClientsWithBalance] = useState(0);
  const [activeSubscriptions, setActiveSubscriptions] = useState(0);
  const [activeClients, setActiveClients] = useState(0);
  const [recentOrders, setRecentOrders] = useState<{user_id: string; total: number}[]>([]);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    setLoading(true);

    // Fetch ALL profiles by paginating (Supabase default limit is 1000)
    let allProfiles: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1);
      if (error || !data || data.length === 0) {
        hasMore = false;
      } else {
        allProfiles = allProfiles.concat(data);
        from += pageSize;
        if (data.length < pageSize) hasMore = false;
      }
    }

    const { data: activeSubs } = await supabase
      .from("subscriptions")
      .select("user_id, status")
      .eq("status", "active");

    const activeSubUserIds = new Set((activeSubs || []).map(s => s.user_id));

    // Fetch emails from auth via edge function
    let emailMap: Record<string, string> = {};
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL || "https://mxnlerkeygfvdnznoxld.supabase.co"}/functions/v1/list-user-emails`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
          }
        );
        if (res.ok) {
          const json = await res.json();
          emailMap = json.emails || {};
        }
      }
    } catch (e) {
      console.error("Failed to fetch emails:", e);
    }

    // Build client list
    const clientList: Client[] = allProfiles.map((p) => {
      const isComplete = !!(
        p.full_name && p.cpf && p.birth_date &&
        p.rua && p.numero && p.bairro && p.cidade && p.estado &&
        p.cep && p.phone
      );
      return {
        id: p.id,
        user_id: p.user_id,
        full_name: p.full_name,
        email: emailMap[p.user_id] || "",
        phone: p.phone,
        balance: p.balance ?? 0,
        status: p.status ?? "active",
        avatar_url: p.avatar_url,
        created_at: p.created_at,
        has_active_subscription: activeSubUserIds.has(p.user_id),
        profile_complete: isComplete,
      };
    });

    setClients(clientList);
    setTotalClients(clientList.length);
    setClientsWithBalance(clientList.filter(c => c.balance > 0).length);
    setActiveSubscriptions((activeSubs || []).length);

    // Fetch orders from last 30 days for active clients metric
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { data: recentOrdData } = await supabase
      .from("orders")
      .select("user_id, total, status")
      .in("status", ["completed", "delivered"])
      .gte("created_at", thirtyDaysAgo.toISOString());

    const recent = recentOrdData || [];
    setRecentOrders(recent.map(o => ({ user_id: o.user_id, total: Number(o.total) })));
    const activeUserIds = new Set(recent.map(o => o.user_id));
    setActiveClients(activeUserIds.size);

    setLoading(false);
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  };

  const handleImpersonate = async (userId: string) => {
    setImpersonating(userId);
    try {
      // Open window BEFORE async call to avoid popup blocker
      const newWindow = window.open("about:blank", "_blank");
      
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/impersonate-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ target_user_id: userId }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Erro ao acessar conta");
      
      if (newWindow) {
        newWindow.location.href = result.url;
      } else {
        window.open(result.url, "_blank");
      }
      toast.success("Link de acesso aberto em nova aba");
    } catch (err: any) {
      toast.error(err.message || "Erro ao acessar conta do cliente");
    } finally {
      setImpersonating(null);
    }
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
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch = !term ||
      (client.full_name || "").toLowerCase().includes(term) ||
      client.email.toLowerCase().includes(term) ||
      (client.phone || "").includes(term) ||
      client.user_id.toLowerCase().includes(term);

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
    <div className="flex flex-col h-[calc(100vh-1.5rem)] pt-4">
      {/* Header */}
      <section className="flex flex-col gap-4 flex-shrink-0">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-2">
              Base de Clientes
            </h1>
            <p className="text-white/60 text-lg">
              Gerencie usuários, saldos e assinaturas de forma centralizada.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowImport(true)} variant="outline" className="border-white/10 text-white/70 hover:text-white hover:bg-white/10 px-4 py-3 h-auto rounded-xl font-bold flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Importar
            </Button>
            <Button onClick={() => setShowExport(true)} variant="outline" className="border-white/10 text-white/70 hover:text-white hover:bg-white/10 px-4 py-3 h-auto rounded-xl font-bold flex items-center gap-2">
              <Download className="w-4 h-4" />
              Exportar
            </Button>
            <Button onClick={() => setShowNewClient(true)} className="bg-primary hover:bg-primary/80 text-white px-6 py-3 h-auto rounded-xl font-bold flex items-center gap-2 shadow-[0_0_20px_rgba(249,6,6,0.4)] transition-all hover:scale-105">
              <UserPlus className="w-5 h-5" />
              Novo Cliente
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="bg-[rgba(30,15,15,0.4)] backdrop-blur-xl border border-white/[0.08] p-4 rounded-2xl flex items-center justify-between group shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
            <div className="flex flex-col gap-1">
              <p className="text-white/60 text-xs font-medium uppercase tracking-wider">Total de Clientes</p>
              <h3 className="text-2xl font-black text-white group-hover:text-primary transition-colors">
                {loading ? "..." : totalClients.toLocaleString("pt-BR")}
              </h3>
            </div>
            <div className="size-11 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
              <Users className="w-5 h-5 text-white/80" />
            </div>
          </div>

          <div className="bg-[rgba(30,15,15,0.4)] backdrop-blur-xl border border-white/[0.08] p-4 rounded-2xl flex items-center justify-between group shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
            <div className="flex flex-col gap-1">
              <p className="text-white/60 text-xs font-medium uppercase tracking-wider">Clientes com Saldo</p>
              <h3 className="text-2xl font-black text-white group-hover:text-primary transition-colors">
                {loading ? "..." : clientsWithBalance}
              </h3>
            </div>
            <div className="size-11 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
              <Wallet className="w-5 h-5 text-white/80" />
            </div>
          </div>

          <div className="bg-[rgba(30,15,15,0.4)] backdrop-blur-xl border border-white/[0.08] p-4 rounded-2xl flex items-center justify-between group shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
            <div className="flex flex-col gap-1">
              <p className="text-white/60 text-xs font-medium uppercase tracking-wider">Assinaturas Ativas</p>
              <h3 className="text-2xl font-black text-white group-hover:text-primary transition-colors">
                {loading ? "..." : activeSubscriptions}
              </h3>
            </div>
            <div className="size-11 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
              <CheckCircle className="w-5 h-5 text-white/80" />
            </div>
          </div>

          <div
            onClick={() => navigate("/admin/clientes/ativos")}
            className="bg-[rgba(30,15,15,0.4)] backdrop-blur-xl border border-white/[0.08] p-4 rounded-2xl flex items-center justify-between group shadow-[0_4px_30px_rgba(0,0,0,0.5)] cursor-pointer hover:border-primary/30 hover:bg-[rgba(45,20,20,0.6)] transition-all"
          >
            <div className="flex flex-col gap-1">
              <p className="text-white/60 text-xs font-medium uppercase tracking-wider">Clientes Ativos</p>
              <h3 className="text-2xl font-black text-white group-hover:text-primary transition-colors">
                {loading ? "..." : activeClients}
              </h3>
            </div>
            <div className="size-11 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
              <Star className="w-5 h-5 text-white/80" />
            </div>
          </div>
        </div>
      </section>

      {/* Search and Filters - Fixed */}
      <section className="flex-shrink-0 mt-4 mb-2">
        <div className="bg-[rgba(30,15,15,0.4)] backdrop-blur-xl border border-white/[0.08] p-2 rounded-2xl flex flex-col md:flex-row gap-2 shadow-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <Input
              className="w-full h-12 pl-12 pr-4 bg-white/5 border-none rounded-xl text-white placeholder-white/30 focus:ring-2 focus:ring-primary focus:bg-white/10 transition-all text-sm font-medium"
              placeholder="Pesquisar por nome, email ou telefone..."
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
          <div className="flex gap-1 ml-auto">
            <button
              onClick={() => setViewMode("grid")}
              className={`h-12 w-12 flex items-center justify-center rounded-xl transition-colors ${viewMode === "grid" ? "bg-primary text-white" : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"}`}
              title="Visualização em grade"
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`h-12 w-12 flex items-center justify-center rounded-xl transition-colors ${viewMode === "list" ? "bg-primary text-white" : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"}`}
              title="Visualização em lista"
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* Client Cards Grid - Scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0">
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : paginated.length === 0 ? (
        <div className="text-center py-20">
          <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">Nenhum cliente encontrado.</p>
        </div>
      ) : viewMode === "grid" ? (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20 pr-1">
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
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-white font-bold text-lg leading-tight group-hover:text-primary transition-colors cursor-pointer">
                        {client.full_name || "Sem nome"}
                      </h3>
                      {client.profile_complete && (
                        <span title="Perfil completo"><BadgeCheck className="w-5 h-5 text-[#0bda0b] flex-shrink-0" /></span>
                      )}
                    </div>
                    {getStatusBadge(client)}
                  </div>
                </div>
                <button
                  onClick={() => setHistoryClient(client)}
                  className="size-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white transition-colors hover:bg-white/10"
                  title="Histórico do Cliente"
                >
                  <UserRound className="w-5 h-5" />
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
                  <p className={`text-xl font-black tracking-tight ${client.balance > 0 ? "text-emerald-400" : "text-white/50"}`}>
                    R$ {formatCurrency(client.balance)}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleImpersonate(client.user_id)}
                    disabled={impersonating === client.user_id}
                    className="size-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-primary border border-white/5 transition-all disabled:opacity-50"
                    title="Acessar Conta"
                  >
                    {impersonating === client.user_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => setResetClient(client)} className="size-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-primary border border-white/5 transition-all" title="Resetar Senha">
                    <KeyRound className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setBalanceClient(client)} className="size-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-green-400 border border-white/5 transition-all" title="Ajustar Saldo">
                    <DollarSign className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setEditClient(client)} className="size-8 flex items-center justify-center rounded-lg bg-primary/20 hover:bg-primary text-primary hover:text-white border border-primary/20 transition-all" title="Editar">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </section>
        ) : (
        <section className="pb-20 pr-1">
          <div className="bg-[rgba(30,15,15,0.4)] backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th className="text-left text-[10px] uppercase tracking-wider text-white/40 font-bold px-4 py-3">Cliente</th>
                  <th className="text-left text-[10px] uppercase tracking-wider text-white/40 font-bold px-4 py-3 hidden md:table-cell">Contato</th>
                  <th className="text-left text-[10px] uppercase tracking-wider text-white/40 font-bold px-4 py-3 hidden lg:table-cell">Status</th>
                  <th className="text-right text-[10px] uppercase tracking-wider text-white/40 font-bold px-4 py-3">Saldo</th>
                  <th className="text-right text-[10px] uppercase tracking-wider text-white/40 font-bold px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((client) => (
                  <tr key={client.id} className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {client.avatar_url ? (
                          <div
                            className="size-9 bg-center bg-no-repeat bg-cover rounded-lg shadow-inner border border-white/10 flex-shrink-0"
                            style={{ backgroundImage: `url(${client.avatar_url})` }}
                          />
                        ) : (
                          <div className="size-9 rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center text-white font-bold text-xs border border-white/10 shadow-inner flex-shrink-0">
                            {getInitials(client.full_name)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-white font-semibold text-sm truncate">{client.full_name || "Sem nome"}</span>
                            {client.profile_complete && <BadgeCheck className="w-4 h-4 text-[#0bda0b] flex-shrink-0" />}
                          </div>
                          <span className="text-white/30 text-xs truncate block">ID: {client.user_id.substring(0, 8)}...</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex flex-col gap-0.5">
                        {client.phone && <span className="text-white/60 text-xs">{client.phone}</span>}
                        {client.email && <span className="text-white/40 text-xs truncate max-w-[180px]">{client.email}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {getStatusBadge(client)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-bold ${client.balance > 0 ? "text-primary" : "text-white/50"}`}>
                        R$ {formatCurrency(client.balance)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => handleImpersonate(client.user_id)}
                          disabled={impersonating === client.user_id}
                          className="size-7 flex items-center justify-center rounded-md bg-white/5 hover:bg-white/10 text-white/70 hover:text-primary border border-white/5 transition-all disabled:opacity-50"
                          title="Acessar Conta"
                        >
                          {impersonating === client.user_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogIn className="w-3 h-3" />}
                        </button>
                        <button onClick={() => setResetClient(client)} className="size-7 flex items-center justify-center rounded-md bg-white/5 hover:bg-white/10 text-white/70 hover:text-primary border border-white/5 transition-all" title="Resetar Senha">
                          <KeyRound className="w-3 h-3" />
                        </button>
                        <button onClick={() => setBalanceClient(client)} className="size-7 flex items-center justify-center rounded-md bg-white/5 hover:bg-white/10 text-white/70 hover:text-green-400 border border-white/5 transition-all" title="Ajustar Saldo">
                          <DollarSign className="w-3 h-3" />
                        </button>
                        <button onClick={() => setEditClient(client)} className="size-7 flex items-center justify-center rounded-md bg-primary/20 hover:bg-primary text-primary hover:text-white border border-primary/20 transition-all" title="Editar">
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button onClick={() => setHistoryClient(client)} className="size-7 flex items-center justify-center rounded-md bg-white/5 hover:bg-white/10 text-white/40 hover:text-white border border-white/5 transition-all" title="Histórico">
                          <UserRound className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      </div>

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

      {/* Modals */}
      <ClientEditModal
        open={!!editClient}
        onClose={() => setEditClient(null)}
        client={editClient}
        onUpdate={fetchClients}
      />
      <ClientHistoryModal
        open={!!historyClient}
        onClose={() => setHistoryClient(null)}
        client={historyClient}
        onBalanceUpdate={fetchClients}
      />
      <ResetPasswordModal
        open={!!resetClient}
        onClose={() => setResetClient(null)}
        client={resetClient}
      />
      <AdjustBalanceModal
        open={!!balanceClient}
        onClose={() => setBalanceClient(null)}
        client={balanceClient}
        onUpdate={fetchClients}
      />
      <ImportClientsModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={fetchClients}
      />
      <ExportClientsModal
        open={showExport}
        onClose={() => setShowExport(false)}
      />
      <NewClientModal
        open={showNewClient}
        onClose={() => setShowNewClient(false)}
        onCreated={fetchClients}
      />
    </div>
  );
}
