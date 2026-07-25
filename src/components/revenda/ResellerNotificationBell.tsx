import { useEffect, useRef, useState, useCallback } from "react";
import { Bell, ShoppingBag, Wallet, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface NotifItem {
  id: string;
  kind: "sale" | "recharge";
  title: string;
  subtitle: string;
  amount: number;
  created_at: string;
  read: boolean;
}

interface Props { resellerId: string }

const STORAGE_KEY = (rid: string) => `reseller_notif_read_${rid}`;

export default function ResellerNotificationBell({ resellerId }: Props) {
  const [items, setItems] = useState<NotifItem[]>([]);
  const [open, setOpen] = useState(false);
  const soundsRef = useRef<{ sale?: string; recharge?: string }>({});
  const clientIdsRef = useRef<Set<string>>(new Set());
  const readIdsRef = useRef<Set<string>>(new Set());
  const mountedAtRef = useRef<number>(Date.now());

  // Load persisted read ids
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY(resellerId));
      if (raw) readIdsRef.current = new Set(JSON.parse(raw));
    } catch {}
  }, [resellerId]);

  const persistRead = () => {
    try {
      localStorage.setItem(STORAGE_KEY(resellerId), JSON.stringify([...readIdsRef.current].slice(-500)));
    } catch {}
  };

  const playSound = useCallback((kind: "sale" | "recharge") => {
    const url = kind === "sale" ? soundsRef.current.sale : soundsRef.current.recharge;
    if (!url) return;
    try {
      const a = new Audio(url);
      a.volume = 0.7;
      a.play().catch(() => {});
    } catch {}
  }, []);

  // Load sounds + client ids + recent history
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Sounds
      const { data: snd } = await supabase
        .from("notification_sounds")
        .select("event_key, sound_url, active")
        .in("event_key", ["order_completed", "wallet_deposit"]);
      if (snd && !cancelled) {
        for (const s of snd as any[]) {
          if (!s.active || !s.sound_url) continue;
          if (s.event_key === "order_completed") soundsRef.current.sale = s.sound_url;
          if (s.event_key === "wallet_deposit") soundsRef.current.recharge = s.sound_url;
          try { const a = new Audio(s.sound_url); a.preload = "auto"; a.load(); } catch {}
        }
      }

      // Client user_ids for this reseller
      const { data: clients } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("reseller_id", resellerId);
      const ids = new Set<string>((clients || []).map((c: any) => c.user_id).filter(Boolean));
      clientIdsRef.current = ids;

      // Recent sales (last 20 completed orders for this reseller)
      const { data: orders } = await supabase
        .from("orders")
        .select("id, code, total, status, created_at, user_id")
        .eq("reseller_id", resellerId)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(20);

      // Recent recharges from those clients
      let recharges: any[] = [];
      if (ids.size > 0) {
        const { data: tx } = await supabase
          .from("wallet_transactions")
          .select("id, user_id, type, title, amount, created_at")
          .in("user_id", [...ids])
          .eq("type", "credit")
          .order("created_at", { ascending: false })
          .limit(30);
        recharges = (tx || []).filter((t: any) => {
          const title = String(t.title || "").toLowerCase();
          // Only real deposits — exclude system credits like refunds/commissions
          return title.includes("recarga") || title.includes("depósito") || title.includes("deposito") || title.includes("pix");
        }).slice(0, 20);
      }

      // Fetch item summary per order (product names)
      const itemMap: Record<string, string> = {};
      const orderIds = (orders || []).map((o: any) => o.id);
      if (orderIds.length > 0) {
        const { data: items } = await supabase
          .from("order_items")
          .select("order_id, name, quantity")
          .in("order_id", orderIds);
        for (const it of (items || []) as any[]) {
          const label = `${it.quantity > 1 ? `${it.quantity}x ` : ""}${it.name}`;
          itemMap[it.order_id] = itemMap[it.order_id]
            ? `${itemMap[it.order_id]}, ${label}`
            : label;
        }
      }

      // Fetch names
      const userIds = Array.from(new Set([...(orders || []).map((o: any) => o.user_id), ...recharges.map((r) => r.user_id)].filter(Boolean)));
      const nameMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
        for (const p of (profs || []) as any[]) nameMap[p.user_id] = p.full_name || "Cliente";
      }

      const merged: NotifItem[] = [
        ...(orders || []).map((o: any) => ({
          id: `sale:${o.id}`,
          kind: "sale" as const,
          title: `Nova venda • ${o.code || o.id.slice(0, 6)}`,
          subtitle: `${nameMap[o.user_id] || "Cliente"}${itemMap[o.id] ? ` — ${itemMap[o.id]}` : ""}`,
          amount: Number(o.total || 0),
          created_at: o.created_at,
          read: readIdsRef.current.has(`sale:${o.id}`),
        })),
        ...recharges.map((t) => ({
          id: `recharge:${t.id}`,
          kind: "recharge" as const,
          title: "Recarga de saldo",
          subtitle: nameMap[t.user_id] || "Cliente",
          amount: Number(t.amount || 0),
          created_at: t.created_at,
          read: readIdsRef.current.has(`recharge:${t.id}`),
        })),
      ].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 30);

      if (!cancelled) setItems(merged);
    })();
    return () => { cancelled = true; };
  }, [resellerId]);

  // Realtime: new orders for this reseller
  useEffect(() => {
    const chOrders = supabase
      .channel(`reseller-notif-orders-${resellerId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `reseller_id=eq.${resellerId}` },
        async (payload) => {
          const row: any = payload.new;
          if (!row || row.status !== "completed") return;
          const prev: any = (payload as any).old;
          if (prev && prev.status === "completed") return; // avoid duplicates
          const id = `sale:${row.id}`;
          if (items.find((i) => i.id === id)) return;
          let name = "Cliente";
          if (row.user_id) {
            const { data: p } = await supabase.from("profiles").select("full_name").eq("user_id", row.user_id).maybeSingle();
            name = (p as any)?.full_name || name;
          }
          // Fetch items detail for this order
          const { data: oiRows } = await supabase
            .from("order_items")
            .select("name, quantity")
            .eq("order_id", row.id);
          const itemsLabel = (oiRows || [])
            .map((it: any) => `${it.quantity > 1 ? `${it.quantity}x ` : ""}${it.name}`)
            .join(", ");
          const item: NotifItem = {
            id, kind: "sale",
            title: `Nova venda • ${row.code || row.id.slice(0, 6)}`,
            subtitle: `${name}${itemsLabel ? ` — ${itemsLabel}` : ""}`,
            amount: Number(row.total || 0),
            created_at: row.created_at || new Date().toISOString(),
            read: false,
          };
          setItems((prevItems) => [item, ...prevItems].slice(0, 30));
          if (+new Date(item.created_at) >= mountedAtRef.current - 5000) playSound("sale");
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(chOrders); };
  }, [resellerId, playSound, items]);

  // Realtime: wallet recharges from reseller's clients
  useEffect(() => {
    const ch = supabase
      .channel(`reseller-notif-wallet-${resellerId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "wallet_transactions" },
        async (payload) => {
          const row: any = payload.new;
          if (!row || row.type !== "credit") return;
          if (!clientIdsRef.current.has(row.user_id)) return;
          const title = String(row.title || "").toLowerCase();
          if (!(title.includes("recarga") || title.includes("depósito") || title.includes("deposito") || title.includes("pix"))) return;
          const id = `recharge:${row.id}`;
          let name = "Cliente";
          const { data: p } = await supabase.from("profiles").select("full_name").eq("user_id", row.user_id).maybeSingle();
          name = (p as any)?.full_name || name;
          const item: NotifItem = {
            id, kind: "recharge",
            title: "Recarga de saldo",
            subtitle: name,
            amount: Number(row.amount || 0),
            created_at: row.created_at || new Date().toISOString(),
            read: false,
          };
          setItems((prev) => (prev.find((i) => i.id === id) ? prev : [item, ...prev].slice(0, 30)));
          playSound("recharge");
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [resellerId, playSound]);

  const unreadCount = items.filter((i) => !i.read).length;

  const markAllRead = () => {
    setItems((prev) => prev.map((i) => {
      readIdsRef.current.add(i.id);
      return { ...i, read: true };
    }));
    persistRead();
  };

  const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return "agora";
    if (diff < 3600) return `${Math.floor(diff / 60)}min`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return d.toLocaleDateString("pt-BR");
  };

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen((o) => !o); if (!open) markAllRead(); }}
        className="relative flex items-center justify-center size-9 rounded-full bg-card border border-border/60 hover:border-primary/50 hover:bg-primary/10 transition-all group"
        title="Notificações"
      >
        <Bell className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-[340px] max-h-[70vh] bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-bold text-foreground">Notificações</h3>
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-muted">
                <X className="size-4 text-muted-foreground" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {items.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Nenhuma notificação ainda.
                </div>
              ) : (
                items.map((it) => (
                  <div key={it.id} className={cn(
                    "flex items-start gap-3 px-4 py-3 border-b border-border/50 hover:bg-muted/30 transition-colors",
                    !it.read && "bg-primary/5"
                  )}>
                    <div className={cn(
                      "shrink-0 size-9 rounded-full flex items-center justify-center",
                      it.kind === "sale" ? "bg-green-500/15 text-green-500" : "bg-yellow-500/15 text-yellow-500"
                    )}>
                      {it.kind === "sale" ? <ShoppingBag className="size-4" /> : <Wallet className="size-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground truncate">{it.title}</p>
                        <span className="text-[10px] text-muted-foreground shrink-0">{fmtTime(it.created_at)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{it.subtitle}</p>
                      <p className={cn(
                        "text-sm font-bold mt-0.5",
                        it.kind === "sale" ? "text-green-500" : "text-yellow-500"
                      )}>
                        {it.kind === "recharge" ? "+" : ""}{fmtBRL(it.amount)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}