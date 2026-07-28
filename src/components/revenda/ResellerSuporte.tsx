import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  LifeBuoy, Search, Loader2, MessageSquare, Clock, CheckCircle2, AlertCircle, Inbox, RefreshCw,
} from "lucide-react";
import ResellerTicketModal from "./ResellerTicketModal";

interface Ticket {
  id: string;
  code: string;
  title: string;
  status: string;
  priority: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface Props {
  resellerId: string;
  brandName: string;
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  open: { label: "Aberto", cls: "bg-amber-500/15 text-amber-400 border-amber-500/25" },
  in_progress: { label: "Em Andamento", cls: "bg-sky-500/15 text-sky-400 border-sky-500/25" },
  resolved: { label: "Resolvido", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" },
  closed: { label: "Fechado", cls: "bg-white/5 text-white/40 border-white/10" },
};

const PRIORITY_META: Record<string, { label: string; cls: string }> = {
  high: { label: "Alta", cls: "text-red-400" },
  medium: { label: "Média", cls: "text-amber-400" },
  low: { label: "Baixa", cls: "text-white/40" },
};

export default function ResellerSuporte({ resellerId, brandName }: Props) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Ticket | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("tickets")
      .select("*")
      .eq("reseller_id", resellerId)
      .order("updated_at", { ascending: false })
      .limit(500);

    const list = (data ?? []) as Ticket[];
    setTickets(list);

    const userIds = Array.from(new Set(list.map((t) => t.user_id).filter(Boolean)));
    if (userIds.length) {
      const map: Record<string, string> = {};
      for (let i = 0; i < userIds.length; i += 75) {
        const chunk = userIds.slice(i, i + 75);
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", chunk);
        (profs ?? []).forEach((p: any) => { map[p.user_id] = p.full_name || "Cliente"; });
      }
      setNames(map);
    } else {
      setNames({});
    }

    const ticketIds = list.map((t) => t.id);
    if (ticketIds.length) {
      const counts: Record<string, number> = {};
      for (let i = 0; i < ticketIds.length; i += 75) {
        const chunk = ticketIds.slice(i, i + 75);
        const { data: msgs } = await supabase
          .from("ticket_messages")
          .select("ticket_id")
          .in("ticket_id", chunk)
          .eq("sender", "user")
          .eq("read", false);
        (msgs ?? []).forEach((m: any) => { counts[m.ticket_id] = (counts[m.ticket_id] || 0) + 1; });
      }
      setUnread(counts);
    } else {
      setUnread({});
    }

    setLoading(false);
  }, [resellerId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`reseller-tickets-${resellerId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ticket_messages" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [resellerId, load]);

  const stats = useMemo(() => ({
    total: tickets.length,
    open: tickets.filter((t) => t.status === "open").length,
    progress: tickets.filter((t) => t.status === "in_progress").length,
    resolved: tickets.filter((t) => t.status === "resolved" || t.status === "closed").length,
  }), [tickets]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (statusFilter !== "all") {
        if (statusFilter === "resolved") {
          if (t.status !== "resolved" && t.status !== "closed") return false;
        } else if (t.status !== statusFilter) return false;
      }
      if (!q) return true;
      return (
        t.code?.toLowerCase().includes(q) ||
        t.title?.toLowerCase().includes(q) ||
        (names[t.user_id] || "").toLowerCase().includes(q)
      );
    });
  }, [tickets, statusFilter, search, names]);

  const openTicket = async (t: Ticket) => {
    setSelected(t);
    await supabase
      .from("ticket_messages")
      .update({ read: true })
      .eq("ticket_id", t.id)
      .eq("sender", "user")
      .eq("read", false);
    setUnread((prev) => ({ ...prev, [t.id]: 0 }));
  };

  const statCards = [
    { label: "Total", value: stats.total, icon: Inbox, color: "text-white/70" },
    { label: "Abertos", value: stats.open, icon: AlertCircle, color: "text-amber-400" },
    { label: "Em Andamento", value: stats.progress, icon: Clock, color: "text-sky-400" },
    { label: "Resolvidos", value: stats.resolved, icon: CheckCircle2, color: "text-emerald-400" },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <LifeBuoy className="size-6 text-primary" />
            Suporte
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Atenda os chamados abertos pelos seus clientes.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
        >
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-2xl bg-card/60 border border-border/40 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</span>
              <s.icon className={`size-4 ${s.color}`} />
            </div>
            <p className="text-2xl font-bold text-foreground mt-2">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código, assunto ou cliente..."
            className="w-full bg-card/60 border border-border/40 rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            { id: "all", label: "Todos" },
            { id: "open", label: "Abertos" },
            { id: "in_progress", label: "Em Andamento" },
            { id: "resolved", label: "Resolvidos" },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                statusFilter === f.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card/60 border-border/40 text-muted-foreground hover:text-foreground hover:bg-white/5"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="rounded-2xl bg-card/60 border border-border/40 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 px-6">
            <LifeBuoy className="size-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum ticket encontrado.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {filtered.map((t) => {
              const st = STATUS_META[t.status] ?? STATUS_META.open;
              const pr = PRIORITY_META[t.priority] ?? PRIORITY_META.low;
              const nUnread = unread[t.id] || 0;
              return (
                <button
                  key={t.id}
                  onClick={() => openTicket(t)}
                  className="w-full text-left px-4 py-4 hover:bg-white/5 transition-colors flex items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-muted-foreground">#{t.code}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${st.cls}`}>
                        {st.label}
                      </span>
                      <span className={`text-[10px] font-semibold ${pr.cls}`}>● {pr.label}</span>
                      {nUnread > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-bold">
                          {nUnread} nova{nUnread > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-foreground mt-1 truncate">{t.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {names[t.user_id] || "Cliente"} • {new Date(t.updated_at || t.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <MessageSquare className="size-4 text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selected && (
        <ResellerTicketModal
          ticket={selected}
          profileName={names[selected.user_id] || "Cliente"}
          brandName={brandName}
          mode="respond"
          onClose={() => setSelected(null)}
          onStatusChange={load}
        />
      )}
    </div>
  );
}
