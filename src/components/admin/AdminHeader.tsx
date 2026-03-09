import { useState, useEffect, useCallback, useRef } from "react";
import { Bell, ChevronDown, LogOut, UserCog, Store, Check, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { AdminProfileModal } from "./AdminProfileModal";

interface AdminNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
}

export function AdminHeader() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("Carregando...");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);

  const seenIdsRef = useRef<Set<string>>(new Set());
  const initialLoadDoneRef = useRef(false);

  // Cash register sound for money-related notifications
  // Notification sounds from DB
  const soundCacheRef = useRef<Record<string, string>>({});

  // Load sound URLs from DB once
  useEffect(() => {
    const loadSounds = async () => {
      const { data } = await supabase
        .from("notification_sounds")
        .select("event_key, sound_url, active")
        .eq("active", true);
      if (data) {
        const cache: Record<string, string> = {};
        data.forEach((row: { event_key: string; sound_url: string | null }) => {
          if (row.sound_url) cache[row.event_key] = row.sound_url;
        });
        soundCacheRef.current = cache;
        console.log("[NotifSounds] Loaded sound cache:", Object.keys(cache));
      }
    };
    loadSounds();
  }, []);

  // Map notification type to event_key
  const getEventKey = useCallback((type: string): string | null => {
    const map: Record<string, string> = {
      order: "order_completed",
      wallet: "wallet_deposit",
      pix: "wallet_deposit",
      ticket: "new_ticket",
    };
    return map[type] || null;
  }, []);

  const playNotificationSound = useCallback((eventKey: string) => {
    const url = soundCacheRef.current[eventKey];
    console.log("[NotifSounds] Playing sound for", eventKey, "url:", url ? "found" : "NOT FOUND", "cache keys:", Object.keys(soundCacheRef.current));
    if (url) {
      try {
        const audio = new Audio(url);
        audio.volume = 0.7;
        audio.play().catch((e) => console.warn("[NotifSounds] Play failed:", e));
      } catch (e) {
        console.warn("[NotifSounds] Audio error:", e);
      }
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("global", true)
      .eq("read", false)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) {
      const typedData = data as AdminNotification[];
      setNotifications(typedData);

      // Play sound for new notifications detected via polling (not on first load)
      if (initialLoadDoneRef.current) {
        for (const n of typedData) {
          if (!seenIdsRef.current.has(n.id)) {
            console.log("[NotifSounds] New notification via polling:", n.type, n.title);
            const eventKey = getEventKey(n.type);
            if (eventKey) {
              playNotificationSound(eventKey);
            }
          }
        }
      }
      // Update seen IDs
      seenIdsRef.current = new Set(typedData.map(n => n.id));
      initialLoadDoneRef.current = true;
    }
  }, [getEventKey, playNotificationSound]);

  // Realtime + polling for notifications
  useEffect(() => {
    // Poll every 10s to catch notifications from edge functions faster
    const interval = setInterval(fetchNotifications, 5000);
    const channel = supabase
      .channel("admin-notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (payload) => {
        const notif = payload.new as AdminNotification;
        console.log("[NotifSounds] Realtime INSERT:", notif.type, notif.title);
        // Mark as seen immediately so polling doesn't double-play
        seenIdsRef.current.add(notif.id);
        const eventKey = getEventKey(notif.type);
        if (eventKey) {
          playNotificationSound(eventKey);
        }
        fetchNotifications();
      })
      .subscribe();
    return () => { clearInterval(interval); supabase.removeChannel(channel); };
  }, [fetchNotifications, getEventKey, playNotificationSound]);

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const markAllRead = async () => {
    const ids = notifications.map(n => n.id);
    if (ids.length === 0) return;
    await supabase.from("notifications").update({ read: true }).in("id", ids);
    setNotifications([]);
  };

  const handleLogout = async () => {
    sessionStorage.clear();
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  const formatTime = (d: string) =>
    new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  const unreadCount = notifications.length;

  return (
    <>
      <header className="flex-none px-6 py-4 flex items-center justify-end z-20">
        <div className="flex items-center gap-3">
          {/* Notification Bell */}
          <Popover open={notifOpen} onOpenChange={setNotifOpen}>
            <PopoverTrigger asChild>
              <div className="glass-panel rounded-full p-1.5 relative cursor-pointer hover:bg-white/10 transition-colors">
                <Bell className="size-4 text-white/70" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-primary rounded-full border border-[#0a0505] flex items-center justify-center text-[9px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </div>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0 max-h-[400px] overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                <span className="text-xs font-bold text-foreground">Notificações</span>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-[10px] text-primary hover:underline">
                    Marcar todas como lidas
                  </button>
                )}
              </div>
              <div className="max-h-[340px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    Nenhuma notificação pendente
                  </div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      className={`px-3 py-2.5 border-b border-border/50 hover:bg-muted/30 transition-colors ${
                        n.type === "success" ? "border-l-2 border-l-green-500" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            {n.type === "success" && (
                              <Check className="size-3.5 text-green-500 shrink-0" />
                            )}
                            <span className={`text-xs font-bold truncate ${
                              n.type === "success" ? "text-green-500" : "text-foreground"
                            }`}>
                              {n.title}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground line-clamp-2">{n.message}</p>
                          <span className="text-[9px] text-muted-foreground/60 mt-0.5 block">{formatTime(n.created_at)}</span>
                        </div>
                        <button
                          onClick={() => markAsRead(n.id)}
                          className="p-1 rounded hover:bg-muted transition-colors shrink-0"
                          title="Marcar como lida"
                        >
                          <X className="size-3 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center gap-2 glass-panel pl-1.5 pr-3 py-1 rounded-full cursor-pointer hover:bg-white/10 transition-colors">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover border border-white/10" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 border border-white/10 flex items-center justify-center text-[10px] font-bold text-white/70">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-medium text-white/90 max-w-[120px] truncate">{userName}</span>
                <ChevronDown className="size-3 text-white/50" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => setShowProfile(true)} className="cursor-pointer text-sm">
                <UserCog className="mr-2 size-3.5" />
                Editar Perfil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.open("/loja", "_blank")} className="cursor-pointer text-sm">
                <Store className="mr-2 size-3.5" />
                Visitar Loja
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-sm">
                <LogOut className="mr-2 size-3.5" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <AdminProfileModal
        open={showProfile}
        onOpenChange={setShowProfile}
        onProfileUpdated={(name, avatar) => {
          setUserName(name);
          setAvatarUrl(avatar);
        }}
      />
    </>
  );
}
