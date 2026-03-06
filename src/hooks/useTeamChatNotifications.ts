import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLocation } from "react-router-dom";

// Cache for team chat sound URL
let teamChatSoundUrl: string | null | undefined = undefined;

async function loadTeamChatSound() {
  if (teamChatSoundUrl !== undefined) return;
  try {
    const { data } = await supabase
      .from("notification_sounds")
      .select("sound_url")
      .eq("event_key", "team_chat")
      .eq("active", true)
      .maybeSingle();
    teamChatSoundUrl = data?.sound_url || null;
  } catch {
    teamChatSoundUrl = null;
  }
}

function playAlertSound() {
  loadTeamChatSound();
  if (teamChatSoundUrl) {
    try {
      const audio = new Audio(teamChatSoundUrl);
      audio.volume = 0.7;
      audio.play().catch(() => {});
    } catch {}
    return;
  }
  // Fallback: synthesized beep
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

// Team chat notification hook with looping alert sound
export function useTeamChatNotifications() {
  const [unreadCount, setUnreadCount] = useState(0);
  const location = useLocation();
  const isOnChatPage = location.pathname === "/admin/chat";
  const loopIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stop loop sound
  const stopLoop = useCallback(() => {
    if (loopIntervalRef.current) {
      clearInterval(loopIntervalRef.current);
      loopIntervalRef.current = null;
    }
  }, []);

  // Start loop sound (every 8s)
  const startLoop = useCallback(() => {
    stopLoop();
    playAlertSound();
    loopIntervalRef.current = setInterval(() => {
      if (window.location.pathname.includes("/admin/chat")) {
        stopLoop();
        return;
      }
      playAlertSound();
    }, 8000);
  }, [stopLoop]);

  // Clear when on chat page
  useEffect(() => {
    if (isOnChatPage) {
      setUnreadCount(0);
      stopLoop();
    }
  }, [isOnChatPage, stopLoop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopLoop();
  }, [stopLoop]);

  // When unreadCount changes, manage loop
  useEffect(() => {
    if (unreadCount > 0 && !isOnChatPage) {
      if (!loopIntervalRef.current) {
        startLoop();
      }
    } else {
      stopLoop();
    }
  }, [unreadCount, isOnChatPage, startLoop, stopLoop]);

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
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return { hasUnread: unreadCount > 0, unreadCount };
}
