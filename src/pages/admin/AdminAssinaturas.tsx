import { useState, useMemo } from "react";
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Search,
  Download,
  Globe,
  Eye,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useProxyBRSubscriptions, useRenewSubscription } from "@/hooks/useProxyBR";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type MappedStatus = "active" | "expiring" | "expired" | "cancelled";

interface EnrichedSubscription {
  code: string;
  name: string;
  product_name?: string;
  status: string;
  mappedStatus: MappedStatus;
  start_date: string;
  end_date: string;
  daysRemaining: number;
  daysExpired: number;
  formattedStart: string;
  formattedEnd: string;
  daysLabel: string;
  auto_renew?: boolean;
  quantity?: number;
  proxy?: {
    id: number;
    ip: string;
    port: number;
    username?: string;
    password?: string;
    protocol?: string;
    country?: string;
  };
  // linked client
  clientName?: string;
  clientEmail?: string;
  userId?: string;
  [key: string]: unknown;
}

function mapStatus(sub: { status: string; end_date: string }): MappedStatus {
  const now = new Date();
  const endDate = parseISO(sub.end_date);
  const daysLeft = differenceInDays(endDate, now);
  if (sub.status === "cancelled") return "cancelled";
  if (daysLeft < 0) return "expired";
  if (daysLeft <= 3) return "expiring";
  return "active";
}

function enrichSub(sub: Record<string, unknown>): EnrichedSubscription {
  const s = sub as { code: string; name: string; product_name?: string; status: string; start_date: string; end_date: string; auto_renew?: boolean; quantity?: number; proxy?: EnrichedSubscription["proxy"] };
  const now = new Date();
  const endDate = parseISO(s.end_date);
  const startDate = parseISO(s.start_date);
  const daysLeft = differenceInDays(endDate, now);
  const mapped = mapStatus(s);

  let daysLabel = "";
  if (mapped === "expired") daysLabel = "Expirado";
  else if (mapped === "expiring") daysLabel = daysLeft === 0 ? "Vence hoje" : `${daysLeft} dia${daysLeft !== 1 ? "s" : ""} restante${daysLeft !== 1 ? "s" : ""}`;
  else if (mapped === "active") daysLabel = daysLeft > 30 ? "30+ dias" : `${daysLeft} dia${daysLeft !== 1 ? "s" : ""} restante${daysLeft !== 1 ? "s" : ""}`;

  return {
    ...s,
    mappedStatus: mapped,
    daysRemaining: Math.max(0, daysLeft),
    daysExpired: daysLeft < 0 ? Math.abs(daysLeft) : 0,
    formattedStart: format(startDate, "dd MMM yyyy", { locale: ptBR }),
    formattedEnd: format(endDate, "dd MMM yyyy", { locale: ptBR }),
    daysLabel,
  };
}

const PER_PAGE = 10;

export default function AdminAssinaturas() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [renewalFilter, setRenewalFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSub, setSelectedSub] = useState<EnrichedSubscription | null>(null);

  const { data: rawSubs, isLoading, refetch } = useProxyBRSubscriptions();
  const renewMutation = useRenewSubscription();

  // Fetch local subscriptions with user links
  const { data: localSubs } = useQuery({
    queryKey: ["admin-subscriptions-local"],
    queryFn: async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("*, profiles!subscriptions_user_id_fkey(full_name, user_id)")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Fetch profiles for linking
  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles-for-subs"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name");
      return data || [];
    },
  });

  const subscriptions: EnrichedSubscription[] = useMemo(() => {
    const arr = Array.isArray(rawSubs?.data) ? rawSubs.data : Array.isArray(rawSubs) ? rawSubs : [];
    return arr.map((s: Record<string, unknown>) => enrichSub(s));
  }, [rawSubs]);

  const counts = useMemo(() => ({
    active: subscriptions.filter((s) => s.mappedStatus === "active").length,
    expiring: subscriptions.filter((s) => s.mappedStatus === "expiring").length,
    cancelled: subscriptions.filter((s) => s.mappedStatus === "cancelled").length,
    expired: subscriptions.filter((s) => s.mappedStatus === "expired").length,
  }), [subscriptions]);

  const filtered = useMemo(() => {
    return subscriptions.filter((sub) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch = !term ||
        sub.code?.toLowerCase().includes(term) ||
        sub.name?.toLowerCase().includes(term) ||
        sub.clientName?.toLowerCase().includes(term) ||
        sub.clientEmail?.toLowerCase().includes(term) ||
        sub.proxy?.ip?.includes(term);
      const matchesStatus = statusFilter === "all" || sub.mappedStatus === statusFilter;
      const matchesRenewal = renewalFilter === "all" ||
        (renewalFilter === "auto" && sub.auto_renew) ||
        (renewalFilter === "manual" && !sub.auto_renew);
      return matchesSearch && matchesStatus && matchesRenewal;
    });
  }, [subscriptions, searchTerm, statusFilter, renewalFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  const stats = [
    {
      label: "Assinaturas Ativas",
      value: counts.active.toString(),
      icon: CheckCircle,
      iconColor: "text-green-400",
      glowColor: "bg-primary/10",
    },
    {
      label: "Vencendo em Breve",
      value: counts.expiring.toString(),
      icon: AlertTriangle,
      iconColor: "text-orange-400",
      glowColor: "bg-orange-500/10",
    },
    {
      label: "Canceladas",
      value: counts.cancelled.toString(),
      icon: XCircle,
      iconColor: "text-red-500",
      glowColor: "bg-red-500/10",
    },
    {
      label: "Expiradas",
      value: counts.expired.toString(),
      icon: RefreshCw,
      iconColor: "text-blue-400",
      glowColor: "bg-blue-500/10",
    },
  ];

  const getStatusBadge = (status: MappedStatus) => {
    switch (status) {
      case "active":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Ativo
          </span>
        );
      case "expiring":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
            Vencendo
          </span>
        );
      case "expired":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-text-secondary border border-border">
            Expirado
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
            Cancelado
          </span>
        );
    }
  };

  const getDaysStyle = (status: MappedStatus, label: string) => {
    if (status === "expired" || status === "cancelled") return "text-text-secondary";
    if (label === "Vence hoje") return "text-orange-400";
    return "text-green-400";
  };

  return (
    <div className="flex flex-col gap-6 py-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <span className="hover:text-primary transition-colors cursor-pointer">Painel</span>
        <ChevronRight className="w-4 h-4" />
        <span className="text-foreground font-medium">Gerenciamento de Assinaturas Proxy</span>
      </div>

      {/* Header */}
      <div>
        <h2 className="text-3xl font-black text-foreground tracking-tight mb-2">
          Gerenciamento de Assinaturas Proxy
        </h2>
        <p className="text-text-secondary max-w-2xl text-sm">
          Gerencie o ciclo de vida das assinaturas, monitore status de renovação e controle o
          acesso dos clientes aos serviços de proxy.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="glass-card rounded-xl p-5 relative overflow-hidden group"
          >
            <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full ${stat.glowColor} transition-all blur-xl`} />
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="p-2 bg-muted rounded-lg border border-border">
                <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
              </div>
            </div>
            <p className="text-text-secondary text-xs font-medium uppercase tracking-wider mb-1">
              {stat.label}
            </p>
            <p className="text-2xl font-bold text-foreground">
              {isLoading ? <Skeleton className="h-8 w-16" /> : stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="glass-card p-4 rounded-xl flex flex-col lg:flex-row gap-4 justify-between items-end lg:items-center">
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto flex-1">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary w-5 h-5" />
            <Input
              type="text"
              placeholder="Buscar por código, nome, email ou IP..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full bg-muted border-border text-foreground text-sm rounded-lg pl-10 placeholder-text-secondary"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="bg-muted border-border text-foreground text-sm rounded-lg min-w-[140px]">
                <SelectValue placeholder="Status: Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Status: Todos</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="expiring">Vencendo</SelectItem>
                <SelectItem value="expired">Expirado</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={renewalFilter} onValueChange={(v) => { setRenewalFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="bg-muted border-border text-foreground text-sm rounded-lg min-w-[160px]">
                <SelectValue placeholder="Renovação: Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Renovação: Todas</SelectItem>
                <SelectItem value="auto">Automática</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            className="p-2.5 text-text-secondary hover:text-foreground bg-muted hover:bg-muted/80 rounded-lg border border-border transition-colors"
            title="Atualizar"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="glass-card rounded-xl p-8">
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        </div>
      )}

      {/* Error / Empty */}
      {!isLoading && subscriptions.length === 0 && (
        <div className="glass-card rounded-xl p-12 text-center">
          <span className="material-symbols-outlined text-[48px] text-text-secondary mb-4">inbox</span>
          <p className="text-text-secondary">Nenhuma assinatura encontrada na ProxyBR.</p>
        </div>
      )}

      {/* Table */}
      {!isLoading && subscriptions.length > 0 && (
        <div className="glass-card rounded-xl overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-text-secondary uppercase bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-4 py-4 font-medium">Código</th>
                  <th className="px-4 py-4 font-medium">Proxy</th>
                  <th className="px-4 py-4 font-medium text-center">Qtd</th>
                  <th className="px-4 py-4 font-medium">Cliente</th>
                  <th className="px-4 py-4 font-medium">Status</th>
                  <th className="px-4 py-4 font-medium">Início</th>
                  <th className="px-4 py-4 font-medium">Vencimento</th>
                  <th className="px-4 py-4 font-medium">Renovação</th>
                  <th className="px-4 py-4 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginated.map((sub) => (
                  <tr key={sub.code} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-4 py-4 font-medium text-primary">{sub.code}</td>
                    <td className="px-4 py-4">
                      {sub.proxy ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-foreground">
                            {sub.proxy.ip}:{sub.proxy.port}
                          </span>
                          {sub.proxy.country && (
                            <div className="flex items-center gap-1 text-xs text-text-secondary">
                              <Globe className="w-3.5 h-3.5" /> {sub.proxy.country}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-text-secondary text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="bg-muted px-2 py-1 rounded text-xs font-bold text-foreground">
                        {sub.quantity || 1}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {sub.clientName ? (
                        <div className="flex flex-col">
                          <span className="text-foreground font-medium">{sub.clientName}</span>
                          <span className="text-text-secondary text-xs">{sub.clientEmail}</span>
                        </div>
                      ) : (
                        <span className="text-text-secondary text-xs italic">Não vinculado</span>
                      )}
                    </td>
                    <td className="px-4 py-4">{getStatusBadge(sub.mappedStatus)}</td>
                    <td className="px-4 py-4 text-foreground">{sub.formattedStart}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col">
                        <span className={sub.mappedStatus === "cancelled" ? "text-text-secondary line-through" : "text-foreground"}>
                          {sub.formattedEnd}
                        </span>
                        <span className={`text-xs ${getDaysStyle(sub.mappedStatus, sub.daysLabel)}`}>
                          {sub.daysLabel}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-xs border border-border px-2 py-1 rounded-md text-text-secondary">
                        {sub.auto_renew ? "Automática" : "Manual"}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setSelectedSub(sub)}
                          className="text-text-secondary hover:text-foreground p-1"
                          title="Ver Detalhes"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        {(sub.mappedStatus === "expiring" || sub.mappedStatus === "expired") && (
                          <button
                            onClick={() => renewMutation.mutate(sub.code)}
                            disabled={renewMutation.isPending}
                            className="text-text-secondary hover:text-primary p-1 disabled:opacity-50"
                            title="Renovar"
                          >
                            <RefreshCw className={`w-5 h-5 ${renewMutation.isPending ? "animate-spin" : ""}`} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="border-t border-border bg-muted/30 p-4 flex items-center justify-between">
            <span className="text-xs text-text-secondary">
              Mostrando <span className="text-foreground">{(currentPage - 1) * PER_PAGE + 1}-{Math.min(currentPage * PER_PAGE, filtered.length)}</span> de{" "}
              <span className="text-foreground">{filtered.length}</span>
            </span>
            <div className="flex items-center gap-1">
              <button
                className="p-1 rounded hover:bg-muted text-text-secondary hover:text-foreground disabled:opacity-30"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1 rounded text-xs ${
                    currentPage === page
                      ? "bg-primary text-primary-foreground font-bold"
                      : "hover:bg-muted text-text-secondary hover:text-foreground"
                  }`}
                >
                  {page}
                </button>
              ))}
              {totalPages > 5 && <span className="text-text-secondary px-1">...</span>}
              <button
                className="p-1 rounded hover:bg-muted text-text-secondary hover:text-foreground disabled:opacity-30"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedSub && (
        <Dialog open={!!selectedSub} onOpenChange={(v) => !v && setSelectedSub(null)}>
          <DialogContent className="glass-card border-glass-border max-w-md">
            <DialogHeader>
              <DialogTitle className="text-foreground">{selectedSub.name || selectedSub.code}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Código</span>
                <span className="text-foreground font-mono">{selectedSub.code}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Status</span>
                {getStatusBadge(selectedSub.mappedStatus)}
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Período</span>
                <span className="text-foreground">{selectedSub.formattedStart} → {selectedSub.formattedEnd}</span>
              </div>
              {selectedSub.proxy && (
                <div className="space-y-2 p-3 rounded-lg bg-muted/50 border border-border">
                  <h4 className="text-foreground font-bold text-sm">Dados do Proxy</h4>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">IP:Porta</span>
                    <span className="text-foreground font-mono">{selectedSub.proxy.ip}:{selectedSub.proxy.port}</span>
                  </div>
                  {selectedSub.proxy.username && (
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary">Usuário</span>
                      <span className="text-foreground font-mono">{selectedSub.proxy.username}</span>
                    </div>
                  )}
                  {selectedSub.proxy.password && (
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary">Senha</span>
                      <span className="text-foreground font-mono">{selectedSub.proxy.password}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
