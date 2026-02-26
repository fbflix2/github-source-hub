import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLocation } from "react-router-dom";

function playAlertSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(523, ctx.currentTime);
    osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
    osc.frequency.setValueAtTime(784, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
    osc.onended = () => ctx.close();
  } catch {
    // Audio not available
  }
}

export function useTeamChatNotifications() {
  const [unreadCount, setUnreadCount] = useState(0);
  const location = useLocation();
  const isOnChatPage = location.pathname === "/admin/chat";

  // Clear when on chat page
  useEffect(() => {
    if (isOnChatPage) {
      setUnreadCount(0);
    }
  }, [isOnChatPage]);

  useEffect(() => {
    let userId: string | null = null;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) userId = user.id;
    });

    const channel = supabase
      .channel("team-chat-sidebar-notif")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "team_messages" },
        (payload) => {
          const msg = payload.new as { user_id: string };
          if (msg.user_id !== userId && !window.location.pathname.includes("/admin/chat")) {
            setUnreadCount(prev => prev + 1);
            playAlertSound();
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return { hasUnread: unreadCount > 0, unreadCount };
}
