import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Users,
  Search,
  LogIn,
  Wallet,
  CheckCircle,
  Star,
  Ban,
  Loader2,
  Mail,
  Phone,
  UserRound,
  LayoutGrid,
  List,
  BadgeCheck,
  Clock,
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  first_login_at: string | null;
  has_active_subscription: boolean;
  profile_complete: boolean;
}

interface Stats {
  total: number;
  withBalance: number;
  activeSubs: number;
  active30d: number;
}

type FilterType = "all" | "subscribers" | "with-balance" | "blocked";

const ITEMS_PER_PAGE = 12;

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ResellerClientes() {
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, withBalance: 0, activeSubs: 0, active30d: 0 });
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [page, setPage] = useState(1);
  const [impersonating, setImpersonating] = useState<string | null>(null);
  const [walletTarget, setWalletTarget] = useState<Client | null>(null);
  const [walletOp, setWalletOp] = useState<"credit" | "debit">("credit");
  const [walletAmount, setWalletAmount] = useState("");
  const [walletNote, setWalletNote] = useState("");
  const [walletSubmitting, setWalletSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || "https://mxnlerkeygfvdnznoxld.supabase.co"}/functions/v1/reseller-clients`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: "{}",
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao carregar clientes");
      setClients(json.clients || []);
      setStats(json.stats || { total: 0, withBalance: 0, activeSubs: 0, active30d: 0 });
    } catch (e: any) {
      toast.error(e.message || "Erro ao carregar clientes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return clients.filter((c) => {
      if (filter === "subscribers" && !c.has_active_subscription) return false;
      if (filter === "with-balance" && c.balance <= 0) return false;
      if (filter === "blocked" && c.status !== "blocked") return false;
      if (!term) return true;
      return (
        (c.full_name || "").toLowerCase().includes(term) ||
        (c.email || "").toLowerCase().includes(term) ||
        (c.phone || "").toLowerCase().includes(term) ||
        c.user_id.toLowerCase().includes(term)
      );
    });
  }, [clients, q, filter]);

  const paginated = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, page]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));

  useEffect(() => setPage(1), [q, filter]);

  const impersonate = async (userId: string) => {
    setImpersonating(userId);
    try {
      const newWin = window.open("about:blank", "_blank");
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
          body: JSON.stringify({ target_user_id: userId, admin_origin: window.location.origin }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Erro ao acessar conta");
      if (newWin) newWin.location.href = result.url;
      else window.open(result.url, "_blank");
      toast.success("Conta do cliente aberta em nova aba");
    } catch (e: any) {
      toast.error(e.message || "Erro ao acessar conta");
    } finally {
      setImpersonating(null);
    }
  };

  const openWallet = (c: Client, op: "credit" | "debit") => {
    setWalletTarget(c);
    setWalletOp(op);
    setWalletAmount("");
    setWalletNote("");
  };

  const submitWallet = async () => {
    if (!walletTarget) return;
    const amount = Number(walletAmount.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    setWalletSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || "https://mxnlerkeygfvdnznoxld.supabase.co"}/functions/v1/reseller-adjust-client-balance`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            target_user_id: walletTarget.user_id,
            operation: walletOp,
            amount,
            note: walletNote,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao ajustar saldo");
      toast.success(
        walletOp === "credit"
          ? `R$ ${brl(amount)} creditado ao cliente`
          : `R$ ${brl(amount)} debitado do cliente`
      );
      setWalletTarget(null);
      load();
    } catch (e: any) {
      toast.error(e.message || "Erro ao ajustar saldo");
    } finally {
      setWalletSubmitting(false);
    }
  };

  const initials = (name: string | null) => {
    if (!name) return "??";
    return name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();
  };

  const StatusBadge = ({ c }: { c: Client }) => {
    if (c.status === "blocked") {
      return (
        <div className="flex items-center gap-1 text-xs text-primary font-medium bg-primary/10 w-fit px-2 py-0.5 rounded-full">
          <Ban className="w-3 h-3" /> Bloqueado
        </div>
      );
    }
    if (c.has_active_subscription) {
      return (
        <div className="flex items-center gap-1 text-xs text-emerald-400 font-medium bg-emerald-500/10 w-fit px-2 py-0.5 rounded-full">
          <BadgeCheck className="w-3 h-3" /> Assinante
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium bg-muted/40 w-fit px-2 py-0.5 rounded-full">
        <Clock className="w-3 h-3" /> Sem Assinatura
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight">
            Base de <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Clientes</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie os clientes da sua revenda de forma centralizada.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total de clientes" value={stats.total} icon={Users} />
        <StatCard label="Com saldo" value={stats.withBalance} icon={Wallet} />
        <StatCard label="Assinaturas ativas" value={stats.activeSubs} icon={CheckCircle} />
        <StatCard label="Ativos (30d)" value={stats.active30d} icon={Star} />
      </div>

      {/* Search + filters */}
      <Card className="p-3 bg-card/60 border-border/40 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por nome, email, telefone ou ID…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
            Todos
          </FilterChip>
          <FilterChip active={filter === "subscribers"} onClick={() => setFilter("subscribers")}>
            Assinantes
          </FilterChip>
          <FilterChip active={filter === "with-balance"} onClick={() => setFilter("with-balance")}>
            Com Saldo
          </FilterChip>
          <FilterChip active={filter === "blocked"} onClick={() => setFilter("blocked")}>
            Bloqueados
          </FilterChip>
          <div className="w-px h-6 bg-border/50 mx-1" />
          <button
            onClick={() => setViewMode("grid")}
            className={cn(
              "size-9 rounded-lg flex items-center justify-center border transition",
              viewMode === "grid"
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border/50 text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutGrid className="size-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={cn(
              "size-9 rounded-lg flex items-center justify-center border transition",
              viewMode === "list"
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border/50 text-muted-foreground hover:text-foreground"
            )}
          >
            <List className="size-4" />
          </button>
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center bg-card/60 border-border/40">
          <Users className="size-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-bold text-foreground">Nenhum cliente encontrado</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Seus clientes aparecem aqui após a primeira compra na sua loja de revenda.
          </p>
        </Card>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {paginated.map((c) => (
            <Card key={c.id} className="p-4 bg-card/60 border-border/40 hover:border-primary/40 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center font-bold overflow-hidden shrink-0">
                    {c.avatar_url ? (
                      <img src={c.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      initials(c.full_name)
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-foreground truncate">
                      {c.full_name || "Sem nome"}
                    </p>
                    <div className="mt-1">
                      <StatusBadge c={c} />
                    </div>
                  </div>
                </div>
                <UserRound className="size-4 text-muted-foreground shrink-0" />
              </div>

              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                {c.phone && (
                  <p className="flex items-center gap-1.5">
                    <Phone className="size-3" /> {c.phone}
                  </p>
                )}
                {c.email ? (
                  <p className="flex items-center gap-1.5 truncate">
                    <Mail className="size-3 shrink-0" /> <span className="truncate">{c.email}</span>
                  </p>
                ) : (
                  <p className="flex items-center gap-1.5 truncate">
                    <Mail className="size-3 shrink-0" /> ID: {c.user_id.slice(0, 8)}…
                  </p>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Saldo atual</p>
                  <p className={cn("font-black text-lg", c.balance > 0 ? "text-emerald-400" : "text-foreground")}>
                    R$ {brl(c.balance)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openWallet(c, "credit")}
                    className="gap-1 px-2"
                    title="Adicionar saldo"
                  >
                    <Plus className="size-3.5" />
                    <Wallet className="size-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => impersonate(c.user_id)}
                    disabled={impersonating === c.user_id}
                    className="gap-1.5"
                    title="Acessar conta do cliente"
                  >
                    {impersonating === c.user_id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <LogIn className="size-3.5" />
                    )}
                    Acessar
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-card/60 border-border/40 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-muted-foreground text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-3">Cliente</th>
                  <th className="text-left px-4 py-3">Contato</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Saldo</th>
                  <th className="text-right px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((c) => (
                  <tr key={c.id} className="border-t border-border/30 hover:bg-muted/10">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center font-bold text-xs overflow-hidden">
                          {c.avatar_url ? (
                            <img src={c.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            initials(c.full_name)
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{c.full_name || "Sem nome"}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {c.user_id.slice(0, 8)}…
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {c.email || "—"}
                      {c.phone && <div>{c.phone}</div>}
                    </td>
                    <td className="px-4 py-3"><StatusBadge c={c} /></td>
                    <td className="px-4 py-3 text-right font-mono font-bold">
                      <span className={c.balance > 0 ? "text-emerald-400" : ""}>R$ {brl(c.balance)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openWallet(c, "credit")}
                          className="gap-1"
                          title="Ajustar saldo"
                        >
                          <Wallet className="size-3.5" />
                          Saldo
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => impersonate(c.user_id)}
                          disabled={impersonating === c.user_id}
                          className="gap-1.5"
                        >
                          {impersonating === c.user_id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <LogIn className="size-3.5" />
                          )}
                          Acessar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}

      <Dialog open={!!walletTarget} onOpenChange={(o) => !o && setWalletTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajustar saldo do cliente</DialogTitle>
            <DialogDescription>
              {walletTarget?.full_name || walletTarget?.email || "Cliente"} — saldo atual:{" "}
              <span className="font-semibold text-foreground">
                R$ {brl(walletTarget?.balance ?? 0)}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setWalletOp("credit")}
                className={cn(
                  "flex items-center justify-center gap-2 h-10 rounded-lg border text-sm font-semibold transition",
                  walletOp === "credit"
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                    : "border-border/50 text-muted-foreground hover:text-foreground"
                )}
              >
                <Plus className="size-4" /> Creditar
              </button>
              <button
                type="button"
                onClick={() => setWalletOp("debit")}
                className={cn(
                  "flex items-center justify-center gap-2 h-10 rounded-lg border text-sm font-semibold transition",
                  walletOp === "debit"
                    ? "bg-destructive/15 border-destructive/40 text-destructive"
                    : "border-border/50 text-muted-foreground hover:text-foreground"
                )}
              >
                <Minus className="size-4" /> Debitar
              </button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wallet-amount">Valor (R$)</Label>
              <Input
                id="wallet-amount"
                inputMode="decimal"
                placeholder="0,00"
                value={walletAmount}
                onChange={(e) => setWalletAmount(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wallet-note">Observação (opcional)</Label>
              <Textarea
                id="wallet-note"
                rows={2}
                placeholder="Motivo do ajuste"
                value={walletNote}
                onChange={(e) => setWalletNote(e.target.value)}
                maxLength={200}
              />
            </div>

            {walletOp === "credit" && (
              <p className="text-xs text-muted-foreground">
                O valor será debitado do saldo da sua carteira de revenda.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setWalletTarget(null)} disabled={walletSubmitting}>
              Cancelar
            </Button>
            <Button onClick={submitWallet} disabled={walletSubmitting}>
              {walletSubmitting && <Loader2 className="size-4 animate-spin mr-2" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: any }) {
  return (
    <Card className="p-4 bg-card/60 border-border/40 flex items-center justify-between">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
          {label}
        </p>
        <p className="text-2xl font-black text-foreground mt-1">{value}</p>
      </div>
      <div className="size-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
        <Icon className="size-4 text-primary" />
      </div>
    </Card>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-9 px-3 rounded-lg text-xs font-semibold transition border",
        active
          ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
          : "border-border/50 text-muted-foreground hover:text-foreground bg-transparent"
      )}
    >
      {children}
    </button>
  );
}