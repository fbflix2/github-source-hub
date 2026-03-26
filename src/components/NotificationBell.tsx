import { useState, useEffect, useCallback } from "react";
import { X, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  global: boolean;
  user_id: string | null;
  created_at: string;
  link?: string | null;
  image_url?: string | null;
  cta_text?: string | null;
}

export function NotificationPopup() {
  const [current, setCurrent] = useState<Notification | null>(null);
  const [queue, setQueue] = useState<Notification[]>([]);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  const showNext = useCallback((q: Notification[]) => {
    if (q.length > 0) {
      setCurrent(q[0]);
      setQueue(q.slice(1));
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted) return;

      // Fetch recent unread notifications
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .or(`user_id.eq.${user.id},global.eq.true`)
        .eq("read", false)
        .order("created_at", { ascending: false })
        .limit(5);

      const unread = (data || []) as Notification[];
      if (unread.length > 0 && mounted) {
        const ids = new Set(unread.map(n => n.id));
        setSeenIds(ids);
        setCurrent(unread[0]);
        setQueue(unread.slice(1));
      }

      // Listen for new notifications in real-time
      const channel = supabase
        .channel("client-notif-popup")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, async (payload) => {
          if (!mounted) return;
          const n = payload.new as Notification;
          // Check if it's for this user or global
          if (n.user_id && n.user_id !== user.id && !n.global) return;
          
          setSeenIds(prev => {
            if (prev.has(n.id)) return prev;
            const next = new Set(prev);
            next.add(n.id);
            return next;
          });

          setCurrent(prev => {
            if (!prev) return n;
            setQueue(q => [...q, n]);
            return prev;
          });
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    };

    init();
    return () => { mounted = false; };
  }, []);

  const dismiss = async () => {
    if (current) {
      await supabase.from("notifications").update({ read: true }).eq("id", current.id);
    }
    setCurrent(null);
    // Show next in queue after small delay
    setTimeout(() => {
      setQueue(q => {
        if (q.length > 0) {
          setCurrent(q[0]);
          return q.slice(1);
        }
        return q;
      });
    }, 300);
  };

  const handleAction = async () => {
    if (!current) return;
    await supabase.from("notifications").update({ read: true }).eq("id", current.id);
    const link = current.link;
    if (link) {
      if (link.startsWith("http")) {
        window.open(link, "_blank");
      } else {
        navigate(link);
      }
    }
    dismiss();
  };

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 p-4">
      <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-background/80 hover:bg-muted border border-border transition-colors"
        >
          <X className="size-4 text-muted-foreground" />
        </button>

        {/* Image */}
        {current.image_url && (
          <div className="w-full h-48 overflow-hidden bg-muted">
            <img
              src={current.image_url}
              alt={current.title}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
            />
          </div>
        )}

        {/* Content */}
        <div className="p-6 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-lg">
                {current.type === "promo" ? "🎉" : current.type === "warning" ? "⚠️" : current.type === "success" ? "✅" : "🔔"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-foreground leading-tight">{current.title}</h3>
            </div>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">{current.message}</p>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={dismiss}
              className="flex-1 h-10 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              Fechar
            </button>
            {current.link && (
              <button
                onClick={handleAction}
                className="flex-1 h-10 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold transition-colors flex items-center justify-center gap-2"
              >
                <ExternalLink className="size-4" />
                {current.cta_text || "Ver mais"}
              </button>
            )}
          </div>
        </div>

        {/* Queue indicator */}
        {queue.length > 0 && (
          <div className="px-6 pb-4 pt-0">
            <p className="text-[11px] text-muted-foreground text-center">
              +{queue.length} {queue.length === 1 ? "notificação" : "notificações"} pendente{queue.length > 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
