import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const HEARTBEAT_INTERVAL = 30_000; // 30 seconds
const ONLINE_THRESHOLD = 90_000; // 90 seconds — if no heartbeat within this, consider offline

// Global state
let globalOnlineIds = new Set<string>();
const listeners = new Set<(ids: Set<string>) => void>();

function notifyAll() {
  const snapshot = new Set(globalOnlineIds);
  listeners.forEach((fn) => fn(snapshot));
}

/**
 * Sends a heartbeat to the user_presence table so other users know we're online.
 * Uses upsert — creates the row on first call, updates on subsequent calls.
 */
async function sendHeartbeat(userId: string) {
  try {
    await supabase
      .from("user_presence")
      .upsert(
        {
          user_id: userId,
          is_online: true,
          last_seen_at: new Date().toISOString(),
          last_path: typeof window !== "undefined" ? window.location.pathname : null,
        },
        { onConflict: "user_id" }
      );
  } catch (err) {
    console.warn("[presence] heartbeat failed:", err);
  }
}

/**
 * Marks the user as offline in the database.
 */
async function markOffline(userId: string) {
  try {
    await supabase
      .from("user_presence")
      .update({ is_online: false, last_seen_at: new Date().toISOString() })
      .eq("user_id", userId);
  } catch {
    // best-effort
  }
}

/**
 * Hook that sends heartbeats to the user_presence table.
 * Call from App component so it runs for every logged-in user.
 */
export function useTeamPresenceTracker() {
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let userId: string | null = null;
    let cancelled = false;

    const start = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled || !user) return;
      userId = user.id;

      // Send first heartbeat immediately
      await sendHeartbeat(userId);

      // Then send every 30s
      intervalId = setInterval(() => {
        if (userId) sendHeartbeat(userId);
      }, HEARTBEAT_INTERVAL);
    };

    start();

    // Mark offline when tab is closed
    const handleBeforeUnload = () => {
      if (userId) {
        // Use sendBeacon for reliability on tab close
        const url = `${import.meta.env.VITE_SUPABASE_URL || "https://mxnlerkeygfvdnznoxld.supabase.co"}/rest/v1/user_presence?user_id=eq.${userId}`;
        const body = JSON.stringify({ is_online: false, last_seen_at: new Date().toISOString() });
        navigator.sendBeacon?.(url, new Blob([body], { type: "application/json" }));
      }
    };

    // Also handle visibility changes — keep heartbeat alive even when minimized
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && userId) {
        sendHeartbeat(userId);
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", handleBeforeUnload);
      document.addEventListener("visibilitychange", handleVisibility);
    }

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      if (typeof window !== "undefined") {
        window.removeEventListener("beforeunload", handleBeforeUnload);
        document.removeEventListener("visibilitychange", handleVisibility);
      }
      if (userId) markOffline(userId);
    };
  }, []);
}

/**
 * Hook to get online team member IDs.
 * Polls the user_presence table for staff members who sent a heartbeat recently.
 */
export function useOnlineUsers(): Set<string> {
  const [online, setOnline] = useState<Set<string>>(() => new Set(globalOnlineIds));

  useEffect(() => {
    const handler = (ids: Set<string>) => setOnline(ids);
    listeners.add(handler);

    // Fetch immediately + poll every 15s
    const fetchOnline = async () => {
      try {
        // Get all staff user IDs
        const { data: roles } = await supabase
          .from("user_roles")
          .select("user_id")
          .in("role", ["admin", "moderator"]);

        if (!roles || roles.length === 0) return;
        const staffIds = roles.map((r) => r.user_id);

        // Get their presence
        const threshold = new Date(Date.now() - ONLINE_THRESHOLD).toISOString();
        const { data: presences } = await supabase
          .from("user_presence")
          .select("user_id")
          .in("user_id", staffIds)
          .eq("is_online", true)
          .gte("last_seen_at", threshold);

        const newOnline = new Set((presences || []).map((p: any) => p.user_id));
        globalOnlineIds = newOnline;
        notifyAll();
      } catch (err) {
        console.warn("[presence] fetch failed:", err);
      }
    };

    fetchOnline();
    const pollId = setInterval(fetchOnline, 15_000);

    return () => {
      listeners.delete(handler);
      clearInterval(pollId);
    };
  }, []);

  return online;
}
