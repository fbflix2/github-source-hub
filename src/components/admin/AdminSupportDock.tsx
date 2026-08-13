import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Headphones, X, Search, Loader2, Inbox, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { normalizeAdminAllowedPaths } from "@/lib/admin-permissions";
import AdminTicketModal from "@/components/admin/AdminTicketModal";

interface TicketRow {
  id: string;
  code: string;
  title: string;
  status: string;
  priority: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface Conversation extends TicketRow {
  clientName: string;
  avatarUrl: string | null;
  lastMessage: string;
  lastAt: string;
  unread: number;
}

let cachedSoundUrl: string | null | undefined;
async function loadSound() {
  if (cachedSoundUrl !== undefined) return;
  try {
    const { data } = await supabase
      .from("notification_sounds")
      .select("sound_url")
      .eq("event_key", "new_ticket")
      .eq("active", true)
      .maybeSingle();
    cachedSoundUrl = data?.sound_url || null;
  } catch {
    cachedSoundUrl = null;
  }
}

function playPing() {
  loadSound();
  if (cachedSoundUrl) {
    try {
      const audio = new Audio(cachedSoundUrl);
      audio.volume = 0.7;
      audio.play().catch(() => {});
    } catch { /* ignore */ }
    return;
  }
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
    osc.onended = () => ctx.close();
  } catch { /* ignore */ }
}

const timeAgo = (dateStr: string) => {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};

const initials = (name: string) =>
  name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase() || "??";

export function AdminSupportDock() {
  const { isAdmin, role, loading: authLoading } = useAdminAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<TicketRow | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(false);
  useEffect(() => { openRef.current = open; }, [open]);

  // Permission: admins always, moderators only with /admin/suporte
  useEffect(() => {
    let cancelled = false;
    if (authLoading || !isAdmin) return;
    if (role === "admin") { setAllowed(true); return; }
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (!cancelled) setAllowed(false); return; }
      const { data: perms } = await supabase
        .from("moderator_permissions")
        .select("allowed_paths")
        .eq("user_id", user.id)
        .maybeSingle();
      const paths = normalizeAdminAllowedPaths((perms?.allowed_paths as string[] | null) ?? []);
      if (!cancelled) setAllowed(paths.has("/admin/suporte"));
    })();
    return () => { cancelled = true; };
  }, [authLoading, isAdmin, role]);

  const load = useCallback(async () => {
    const { data: ticketData } = await supabase
      .from("tickets")
      .select("id, code, title, status, priority, user_id, created_at, updated_at")
      .not("status", "in", "(resolved,closed)")
      .order("updated_at", { ascending: false })
      .limit(60);

    const tickets = (ticketData ?? []) as TicketRow[];
    if (!tickets.length) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const ids = tickets.map((t) => t.id);
    const userIds = Array.from(new Set(tickets.map((t) => t.user_id).filter(Boolean)));

    const nameMap: Record<string, { name: string; avatar: string | null }> = {};
    for (let i = 0; i < userIds.length; i += 75) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", userIds.slice(i, i + 75));
      (profs ?? []).forEach((p: any) => {
        nameMap[p.user_id] = { name: p.full_name || "Cliente", avatar: p.avatar_url ?? null };
      });
    }

    const lastMap: Record<string, { content: string; at: string; sender: string }> = {};
    const unreadMap: Record<string, number> = {};
    for (let i = 0; i < ids.length; i += 75) {
      const { data: msgs } = await supabase
        .from("ticket_messages")
        .select("ticket_id, content, sender, created_at, read")
        .in("ticket_id", ids.slice(i, i + 75))
        .order("created_at", { ascending: false });
      (msgs ?? []).forEach((m: any) => {
        if (!lastMap[m.ticket_id]) {
          lastMap[m.ticket_id] = { content: m.content || "Anexo", at: m.created_at, sender: m.sender };
        }
        if (m.sender === "user" && m.read === false) {
          unreadMap[m.ticket_id] = (unreadMap[m.ticket_id] || 0) + 1;
        }
      });
    }

    const list: Conversation[] = tickets.map((t) => ({
      ...t,
      clientName: nameMap[t.user_id]?.name ?? "Cliente",
      avatarUrl: nameMap[t.user_id]?.avatar ?? null,
      lastMessage: lastMap[t.id]?.content ?? t.title,
      lastAt: lastMap[t.id]?.at ?? t.updated_at,
      unread: unreadMap[t.id] ?? 0,
    }));

    list.sort((a, b) => {
      if ((b.unread > 0 ? 1 : 0) !== (a.unread > 0 ? 1 : 0)) return (b.unread > 0 ? 1 : 0) - (a.unread > 0 ? 1 : 0);
      return new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime();
    });

    setConversations(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!allowed) return;
    load();
  }, [allowed, load]);

  // Realtime: new client messages / new tickets
  useEffect(() => {
    if (!allowed) return;
    const channel = supabase
      .channel("admin-support-dock")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ticket_messages" }, (payload) => {
        const msg = payload.new as any;
        if (msg?.sender === "user") playPing();
        load();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, (payload) => {
        if (payload.eventType === "INSERT") playPing();
        load();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [allowed, load]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + c.unread, 0),
    [conversations],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        c.clientName.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.code?.toLowerCase().includes(q),
    );
  }, [conversations, search]);

  const openConversation = async (c: Conversation) => {
    setSelected(c);
    setOpen(false);
    if (c.unread > 0) {
      await supabase
        .from("ticket_messages")
        .update({ read: true })
        .eq("ticket_id", c.id)
        .eq("sender", "user")
        .eq("read", false);
      setConversations((prev) => prev.map((x) => (x.id === c.id ? { ...x, unread: 0 } : x)));
    }
  };

  if (!allowed) return null;

  return createPortal(
    <>
      <div className="fixed bottom-6 right-6 z-[120] flex flex-col items-end gap-3" ref={panelRef}>
        {open && (
          <div className="w-[380px] max-w-[calc(100vw-3rem)] max-h-[70vh] flex flex-col rounded-3xl overflow-hidden border border-white/10 bg-[#140b0b]/95 backdrop-blur-2xl shadow-2xl shadow-black/60 animate-fade-in">
            {/* Header */}
            <div className="relative px-5 pt-5 pb-4 bg-gradient-to-br from-primary to-red-900">
              <button
                onClick={() => setOpen(false)}
                className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
                aria-label="Fechar"
              >
                <X className="size-4" />
              </button>
              <p className="text-white/70 text-xs font-medium uppercase tracking-wider">Atendimento ao vivo</p>
              <h3 className="text-white text-xl font-bold leading-tight mt-0.5">Conversas dos clientes</h3>
              <p className="text-white/70 text-xs mt-1">
                {conversations.length} em aberto · {totalUnread} sem resposta
              </p>
            </div>

            {/* Search */}
            <div className="p-3 border-b border-white/5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/30" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar cliente, assunto ou código..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2">
              {loading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="size-5 animate-spin text-primary" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-10">
                  <Inbox className="size-8 text-white/20 mx-auto mb-2" />
                  <p className="text-xs text-white/40">Nenhuma conversa em aberto.</p>
                </div>
              ) : (
                filtered.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => openConversation(c)}
                    className={`w-full text-left flex gap-3 p-3 rounded-2xl transition-colors ${
                      c.unread > 0 ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-white/5"
                    }`}
                  >
                    {c.avatarUrl ? (
                      <img src={c.avatarUrl} alt="" className="size-9 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="size-9 rounded-full shrink-0 bg-gradient-to-tr from-zinc-600 to-zinc-800 flex items-center justify-center text-[11px] font-bold text-white">
                        {initials(c.clientName)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white truncate">{c.clientName}</span>
                        <span className="text-[10px] text-white/30 ml-auto shrink-0">{timeAgo(c.lastAt)}</span>
                      </div>
                      <p className="text-[11px] text-white/50 truncate">{c.title}</p>
                      <p className="text-xs text-white/70 truncate mt-0.5">{c.lastMessage}</p>
                    </div>
                    {c.unread > 0 && (
                      <span className="self-center shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">
                        {c.unread}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>

            <div className="px-4 py-2.5 border-t border-white/5 flex items-center gap-2 text-[10px] text-white/30">
              <MessageSquare className="size-3" />
              Visível apenas para a equipe com permissão de Suporte
            </div>
          </div>
        )}

        {/* Launcher */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="relative size-14 rounded-full bg-gradient-to-br from-primary to-red-900 shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-105 transition-transform"
          aria-label="Conversas de suporte"
        >
          <Headphones className="size-6 text-white" />
          {totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1.5 rounded-full bg-white text-primary text-[10px] font-bold flex items-center justify-center border-2 border-[#0a0505]">
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          )}
        </button>
      </div>

      {selected && (
        <AdminTicketModal
          ticket={selected}
          profileName={conversations.find((c) => c.id === selected.id)?.clientName ?? "Cliente"}
          mode="respond"
          onClose={() => { setSelected(null); load(); }}
          onStatusChange={load}
        />
      )}
    </>,
    document.body,
  );
}
