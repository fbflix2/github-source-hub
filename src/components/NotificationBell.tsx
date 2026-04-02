import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
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
  const soundUrlRef = useRef<string | null>(null);
  const navigate = useNavigate();

  const showNext = useCallback((q: Notification[]) => {
    if (q.length > 0) {
      setCurrent(q[0]);
      setQueue(q.slice(1));
    }
  }, []);

  // Load client notification sound
  useEffect(() => {
    const loadSound = async () => {
      const { data } = await supabase
        .from("notification_sounds")
        .select("sound_url")
        .eq("event_key", "client_notification")
        .eq("active", true)
        .maybeSingle();
      if (data?.sound_url) {
        soundUrlRef.current = data.sound_url;
        try { const a = new Audio(data.sound_url); a.preload = "auto"; a.load(); } catch {}
      }
    };
    loadSound();
  }, []);

  const playSound = useCallback(() => {
    const url = soundUrlRef.current;
    if (!url) return;
    try {
      const audio = new Audio(url);
      audio.volume = 0.7;
      audio.play().catch(() => {});
    } catch {}
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
        .eq("user_id", user.id)
        .eq("read", false)
        .not("type", "in", "(order,wallet,admin,ticket)")
        .order("created_at", { ascending: false })
        .limit(5);

      const unread = (data || []) as Notification[];
      if (unread.length > 0 && mounted) {
        const ids = new Set(unread.map(n => n.id));
        setSeenIds(ids);
        setCurrent(unread[0]);
        setQueue(unread.slice(1));
        playSound();
      }

      // Listen for new notifications in real-time
      const channel = supabase
        .channel("client-notif-popup")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, async (payload) => {
          if (!mounted) return;
          const n = payload.new as Notification;
          // Skip system notifications (orders, wallet, admin)
          if (["order", "wallet", "admin", "ticket"].includes(n.type)) return;
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

  if (!current || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] grid place-items-center overflow-y-auto bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 p-4">
      <div className="relative my-auto w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 max-h-[calc(100dvh-2rem)] overflow-y-auto">
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
        <div className="p-5 space-y-3">
          <h3 className="text-base font-bold text-foreground leading-tight">{current.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{current.message}</p>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={dismiss}
              className="flex-1 h-9 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              Fechar
            </button>
            {(current.link || current.cta_text) && (
              <button
                onClick={handleAction}
                className="flex-1 h-9 rounded-lg text-white text-sm font-bold transition-colors"
                style={{ backgroundColor: (current as any).cta_color || 'hsl(var(--primary))' }}
              >
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
    </div>,
    document.body,
  );
}
