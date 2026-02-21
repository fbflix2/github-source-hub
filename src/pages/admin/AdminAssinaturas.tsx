import { useState, useMemo, useCallback } from "react";
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Search,
  Globe,
  Eye,
  ChevronRight,
  ChevronLeft,
  Link2,
  Loader2,
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
import { Button } from "@/components/ui/button";
import { useProxyBRAllSubscriptions, useRenewSubscription } from "@/hooks/useProxyBR";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

type MappedStatus = "active" | "expiring" | "expired" | "cancelled";

interface ParsedProxy {
  id: number;
  ip: string;
  port: number;
  username: string;
  password: string;
  status?: string;
}

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
  proxy?: ParsedProxy;
  clientName?: string;
  clientEmail?: string;
  userId?: string;
  rawApiStatus?: string;
  [key: string]: unknown;
}

function mapStatus(sub: { status: string; end_date: string }): MappedStatus {
  const now = new Date();
  const endDate = parseISO(sub.end_date);
  const daysLeft = differenceInDays(endDate, now);
  const s = sub.status.toUpperCase();
  if (s === "CANCELLED") return "cancelled";
  if (daysLeft < 0) return "expired";
  if (daysLeft <= 3) return "expiring";
  return "active";
}

function enrichSub(
  apiSub: Record<string, unknown>,
  localSubsMap: Map<string, { userId: string; clientName: string; clientEmail: string }>
): EnrichedSubscription {
  const sub = apiSub as any;
  const now = new Date();

  // Normalize API fields: due_date -> end_date, auto_renew_active -> auto_renew
  const endDateStr = sub.due_date || sub.end_date || sub.start_date || new Date().toISOString();
  const startDateStr = sub.created_at || sub.start_date || new Date().toISOString();
  const code = sub.code || "";
  const rawApiStatus = sub.status || "UNKNOWN";

  const endDate = parseISO(endDateStr);
  const startDate = parseISO(startDateStr);
  const daysLeft = differenceInDays(endDate, now);
  const mapped = mapStatus({ status: rawApiStatus, end_date: endDateStr });

  let daysLabel = "";
  if (mapped === "expired") daysLabel = "Expirado";
  else if (mapped === "cancelled") daysLabel = "Cancelado";
  else if (mapped === "expiring") daysLabel = daysLeft === 0 ? "Vence hoje" : `${daysLeft} dia${daysLeft !== 1 ? "s" : ""} restante${daysLeft !== 1 ? "s" : ""}`;
  else if (mapped === "active") daysLabel = daysLeft > 30 ? "30+ dias" : `${daysLeft} dia${daysLeft !== 1 ? "s" : ""} restante${daysLeft !== 1 ? "s" : ""}`;

  // Parse proxy from proxies.data[0]
  let proxy: ParsedProxy | undefined;
  if (sub.proxies?.data?.length > 0) {
    const p = sub.proxies.data[0];
    if (p.parsed) {
      proxy = { id: p.id, ip: p.parsed.ip, port: p.parsed.port, username: p.parsed.username, password: p.parsed.password, status: p.status };
    } else if (p.code && typeof p.code === "string") {
      const parts = p.code.split(":");
      if (parts.length >= 4) {
        proxy = { id: p.id, ip: parts[0], port: parseInt(parts[1], 10), username: parts[2], password: parts[3], status: p.status };
      }
    }
  }

  // Check local linking
  const linked = localSubsMap.get(code);

  return {
    ...sub,
    code,
    name: sub.product?.name || code,
    product_name: sub.product?.name,
    status: rawApiStatus,
    rawApiStatus,
    mappedStatus: mapped,
    start_date: startDateStr,
    end_date: endDateStr,
    daysRemaining: Math.max(0, daysLeft),
    daysExpired: daysLeft < 0 ? Math.abs(daysLeft) : 0,
    formattedStart: format(startDate, "dd MMM yyyy", { locale: ptBR }),
    formattedEnd: format(endDate, "dd MMM yyyy", { locale: ptBR }),
    daysLabel,
    auto_renew: sub.auto_renew_active ?? sub.auto_renew ?? false,
    quantity: sub.proxies?.total || 1,
    proxy,
    clientName: linked?.clientName,
    clientEmail: linked?.clientEmail,
    userId: linked?.userId,
  };
}

const PER_PAGE = 10;

export default function AdminAssinaturas() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [renewalFilter, setRenewalFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSub, setSelectedSub] = useState<EnrichedSubscription | null>(null);
  const [linkModalSub, setLinkModalSub] = useState<EnrichedSubscription | null>(null);
  const [linkSearch, setLinkSearch] = useState("");
  const [syncing, setSyncing] = useState(false);

  const queryClient = useQueryClient();
  const { data: rawSubs, isLoading, refetch } = useProxyBRAllSubscriptions();
  const renewMutation = useRenewSubscription();

  // Fetch local subscriptions with linked profiles
  const { data: localSubs } = useQuery({
    queryKey: ["admin-subscriptions-local"],
    queryFn: async () => {
      // No FK between subscriptions and profiles, so join manually
      const { data: subs } = await supabase
        .from("subscriptions")
        .select("name, user_id, type")
        .eq("type", "proxybr");
      if (!subs?.length) return [];
      
      const userIds = [...new Set(subs.map(s => s.user_id))];
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      
      const profMap = new Map((profs || []).map(p => [p.user_id, p.full_name]));
      return subs.map(s => ({
        ...s,
        profiles: { full_name: profMap.get(s.user_id) || "Cliente" },
      }));
    },
  });

  // Fetch all profiles for linking
  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles-for-subs"],
    queryFn: async () => {
      // Paginate to get all
      let all: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data } = await supabase.from("profiles").select("user_id, full_name").range(from, from + pageSize - 1);
        if (!data || data.length < pageSize) { all = [...all, ...(data || [])]; hasMore = false; }
        else { all = [...all, ...data]; from += pageSize; }
      }
      return all;
    },
  });

  // Also fetch auth users emails for linking
  // We'll get emails from profiles query or use a separate approach
  // Since we can't query auth.users, we'll match by profile full_name

  // Build local subs map: code -> { userId, clientName }
  const localSubsMap = useMemo(() => {
    const map = new Map<string, { userId: string; clientName: string; clientEmail: string }>();
    if (!localSubs) return map;
    for (const ls of localSubs as any[]) {
      const profile = ls.profiles as any;
      map.set(ls.name, {
        userId: ls.user_id,
        clientName: profile?.full_name || "Cliente",
        clientEmail: "",
      });
    }
    return map;
  }, [localSubs]);

  const subscriptions: EnrichedSubscription[] = useMemo(() => {
    const arr = Array.isArray(rawSubs?.data) ? rawSubs.data : Array.isArray(rawSubs) ? rawSubs : [];
    return arr.map((s: Record<string, unknown>) => enrichSub(s, localSubsMap));
  }, [rawSubs, localSubsMap]);

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

  // Sync all ProxyBR subscriptions to local DB with auto-linking
  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      // Refresh session to avoid expired JWT errors
      await supabase.auth.refreshSession();
      
      const { data, error } = await supabase.functions.invoke("proxybr-api", {
        body: { action: "sync-subscriptions" },
      });
      if (error) throw new Error(error.message || "Erro ao sincronizar");
      if (data?.error) throw new Error(data.error);
      
      toast.success(`${data.synced} assinaturas sincronizadas, ${data.linked} vinculadas automaticamente!`);
      queryClient.invalidateQueries({ queryKey: ["admin-subscriptions-local"] });
      refetch();
    } catch (err: any) {
      toast.error(`Erro ao sincronizar: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  }, [queryClient, refetch]);

  // Link subscription to a client (also pushes email to ProxyBR notes)
  const handleLinkClient = useCallback(async (subCode: string, userId: string) => {
    try {
      const { data: existing } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("name", subCode)
        .eq("type", "proxybr")
        .maybeSingle();

      if (existing) {
        await supabase.from("subscriptions").update({ user_id: userId }).eq("id", existing.id);
      } else {
        const sub = subscriptions.find(s => s.code === subCode);
        await supabase.from("subscriptions").insert({
          name: subCode,
          type: "proxybr",
          status: sub?.mappedStatus || "active",
          start_date: sub?.start_date || new Date().toISOString(),
          end_date: sub?.end_date || new Date().toISOString(),
          auto_renew: sub?.auto_renew || false,
          user_id: userId,
        });
      }

      // Get client email from profiles to push to ProxyBR notes
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", userId)
        .maybeSingle();

      // Try to get email via edge function (uses service role)
      const clientLabel = profileData?.full_name || userId;
      try {
        await supabase.functions.invoke("proxybr-api", {
          body: { action: "update-subscription-notes", subscriptionCode: subCode, notes: clientLabel },
        });
      } catch (e) {
        console.error("Failed to update ProxyBR notes:", e);
      }

      toast.success("Cliente vinculado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["admin-subscriptions-local"] });
      setLinkModalSub(null);
    } catch (err: any) {
      toast.error(`Erro ao vincular: ${err.message}`);
    }
  }, [subscriptions, queryClient]);

  const filteredProfiles = useMemo(() => {
    if (!profiles || !linkSearch.trim()) return profiles || [];
    const term = linkSearch.toLowerCase();
    return profiles.filter((p: any) => p.full_name?.toLowerCase().includes(term));
  }, [profiles, linkSearch]);

  const stats = [
    { label: "Ativas", value: counts.active.toString(), icon: CheckCircle, iconColor: "text-green-400", glowColor: "bg-primary/10" },
    { label: "Vencendo", value: counts.expiring.toString(), icon: AlertTriangle, iconColor: "text-orange-400", glowColor: "bg-orange-500/10" },
    { label: "Canceladas", value: counts.cancelled.toString(), icon: XCircle, iconColor: "text-red-500", glowColor: "bg-red-500/10" },
    { label: "Expiradas", value: counts.expired.toString(), icon: RefreshCw, iconColor: "text-blue-400", glowColor: "bg-blue-500/10" },
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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
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
    if (status === "expired" || status === "cancelled") return "text-muted-foreground";
    if (label === "Vence hoje") return "text-orange-400";
    return "text-green-400";
  };

  return (
    <div className="flex flex-col gap-6 py-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="hover:text-primary transition-colors cursor-pointer">Painel</span>
        <ChevronRight className="w-4 h-4" />
        <span className="text-foreground font-medium">Gerenciamento de Assinaturas Proxy</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-black text-foreground tracking-tight mb-2">
            Assinaturas Proxy
          </h2>
          <p className="text-muted-foreground max-w-2xl text-sm">
            Todas as assinaturas da ProxyBR ({subscriptions.length} total). Sincronize e vincule clientes.
          </p>
        </div>
        <Button
          onClick={handleSync}
          disabled={syncing || isLoading || !subscriptions.length}
          className="gap-2"
        >
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Sincronizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div key={index} className="glass-card rounded-xl p-5 relative overflow-hidden">
            <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full ${stat.glowColor} blur-xl`} />
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="p-2 bg-muted rounded-lg border border-border">
                <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
              </div>
            </div>
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-1">{stat.label}</p>
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input
              type="text"
              placeholder="Buscar por código, nome, cliente ou IP..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full bg-muted border-border text-foreground text-sm rounded-lg pl-10"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="bg-muted border-border text-foreground text-sm rounded-lg min-w-[140px]">
                <SelectValue placeholder="Status: Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="expiring">Vencendo</SelectItem>
                <SelectItem value="expired">Expirado</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={renewalFilter} onValueChange={(v) => { setRenewalFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="bg-muted border-border text-foreground text-sm rounded-lg min-w-[160px]">
                <SelectValue placeholder="Renovação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="auto">Automática</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="p-2.5 text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-lg border border-border transition-colors"
          title="Atualizar"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="glass-card rounded-xl p-8">
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        </div>
      )}

      {/* Empty */}
      {!isLoading && subscriptions.length === 0 && (
        <div className="glass-card rounded-xl p-12 text-center">
          <p className="text-muted-foreground">Nenhuma assinatura encontrada na ProxyBR.</p>
        </div>
      )}

      {/* Table */}
      {!isLoading && subscriptions.length > 0 && (
        <div className="glass-card rounded-xl overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-4 py-4 font-medium">Código</th>
                  <th className="px-4 py-4 font-medium">Proxy</th>
                  <th className="px-4 py-4 font-medium">Cliente</th>
                  <th className="px-4 py-4 font-medium">Status</th>
                  <th className="px-4 py-4 font-medium">Vencimento</th>
                  <th className="px-4 py-4 font-medium">Renovação</th>
                  <th className="px-4 py-4 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginated.map((sub) => (
                  <tr key={sub.code} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-4 py-4">
                      <span className="font-medium text-primary">{sub.code}</span>
                      <div className="text-xs text-muted-foreground">{sub.product_name}</div>
                    </td>
                    <td className="px-4 py-4">
                      {sub.proxy ? (
                        <div>
                          <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-foreground">
                            {sub.proxy.ip}:{sub.proxy.port}
                          </span>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {sub.proxy.username} / {sub.proxy.password}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {sub.clientName ? (
                        <span className="text-foreground font-medium">{sub.clientName}</span>
                      ) : (
                        <button
                          onClick={() => { setLinkModalSub(sub); setLinkSearch(""); }}
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          <Link2 className="w-3 h-3" /> Vincular
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-4">{getStatusBadge(sub.mappedStatus)}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col">
                        <span className={sub.mappedStatus === "cancelled" ? "text-muted-foreground line-through" : "text-foreground"}>
                          {sub.formattedEnd}
                        </span>
                        <span className={`text-xs ${getDaysStyle(sub.mappedStatus, sub.daysLabel)}`}>
                          {sub.daysLabel}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-xs border border-border px-2 py-1 rounded-md text-muted-foreground">
                        {sub.auto_renew ? "Automática" : "Manual"}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setSelectedSub(sub)} className="text-muted-foreground hover:text-foreground p-1" title="Detalhes">
                          <Eye className="w-5 h-5" />
                        </button>
                        {(sub.mappedStatus === "expiring" || sub.mappedStatus === "expired") && (
                          <button
                            onClick={() => renewMutation.mutate(sub.code)}
                            disabled={renewMutation.isPending}
                            className="text-muted-foreground hover:text-primary p-1 disabled:opacity-50"
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
            <span className="text-xs text-muted-foreground">
              Mostrando <span className="text-foreground">{(currentPage - 1) * PER_PAGE + 1}-{Math.min(currentPage * PER_PAGE, filtered.length)}</span> de{" "}
              <span className="text-foreground">{filtered.length}</span>
            </span>
            <div className="flex items-center gap-1">
              <button
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30"
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
                      : "hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {page}
                </button>
              ))}
              {totalPages > 5 && <span className="text-muted-foreground px-1">...</span>}
              <button
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30"
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
          <DialogContent className="glass-card border-border max-w-md">
            <DialogHeader>
              <DialogTitle className="text-foreground">{selectedSub.product_name || selectedSub.code}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Código</span>
                <span className="text-foreground font-mono">{selectedSub.code}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status API</span>
                <span className="text-foreground">{selectedSub.rawApiStatus}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                {getStatusBadge(selectedSub.mappedStatus)}
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Período</span>
                <span className="text-foreground">{selectedSub.formattedStart} → {selectedSub.formattedEnd}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Renovação</span>
                <span className="text-foreground">{selectedSub.auto_renew ? "Automática" : "Manual"}</span>
              </div>
              {selectedSub.clientName && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cliente</span>
                  <span className="text-foreground">{selectedSub.clientName}</span>
                </div>
              )}
              {selectedSub.proxy && (
                <div className="space-y-2 p-3 rounded-lg bg-muted/50 border border-border">
                  <h4 className="text-foreground font-bold text-sm">Dados do Proxy</h4>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">IP:Porta</span>
                    <span className="text-foreground font-mono">{selectedSub.proxy.ip}:{selectedSub.proxy.port}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Usuário</span>
                    <span className="text-foreground font-mono">{selectedSub.proxy.username}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Senha</span>
                    <span className="text-foreground font-mono">{selectedSub.proxy.password}</span>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Link Client Modal */}
      {linkModalSub && (
        <Dialog open={!!linkModalSub} onOpenChange={(v) => !v && setLinkModalSub(null)}>
          <DialogContent className="glass-card border-border max-w-md">
            <DialogHeader>
              <DialogTitle className="text-foreground">Vincular Cliente</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Vincular assinatura <span className="text-primary font-mono">{linkModalSub.code}</span> a um cliente.
            </p>
            <Input
              placeholder="Buscar cliente por nome..."
              value={linkSearch}
              onChange={(e) => setLinkSearch(e.target.value)}
              className="bg-muted border-border"
            />
            <div className="max-h-60 overflow-y-auto space-y-1">
              {filteredProfiles.slice(0, 50).map((p: any) => (
                <button
                  key={p.user_id}
                  onClick={() => handleLinkClient(linkModalSub.code, p.user_id)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted text-sm text-foreground transition-colors"
                >
                  {p.full_name || "Sem nome"}
                </button>
              ))}
              {filteredProfiles.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhum cliente encontrado.</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
