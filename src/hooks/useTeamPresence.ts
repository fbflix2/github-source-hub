import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Global state shared across hook instances
let globalOnlineIds = new Set<string>();
const listeners = new Set<(ids: Set<string>) => void>();
let activeTrackerCount = 0;
let presenceChannel: ReturnType<typeof supabase.channel> | null = null;

function notifyAll() {
  const snapshot = new Set(globalOnlineIds);
  listeners.forEach((fn) => fn(snapshot));
}

/**
 * Hook that tracks team presence globally.
 * Call from AdminLayout so presence is active on every admin page.
 */
export function useTeamPresenceTracker() {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || !user) return;

      // Use a unique channel name per mount to avoid conflicts
      const channelName = `team-presence-${Date.now()}`;
      const channel = supabase.channel(channelName, {
        config: { presence: { key: user.id } },
      });

      channel
        .on("presence", { event: "sync" }, () => {
          globalOnlineIds = new Set(Object.keys(channel.presenceState()));
          notifyAll();
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED" && !cancelled) {
            await channel.track({ user_id: user.id, online_at: new Date().toISOString() });
          }
        });

      channelRef.current = channel;

      // Clean up old global channel if exists
      if (presenceChannel && presenceChannel !== channel) {
        supabase.removeChannel(presenceChannel);
      }
      presenceChannel = channel;
    });

    return () => {
      cancelled = true;
      // Don't remove on normal navigation — only on full unmount
      // The channel persists as long as the admin layout is mounted
    };
  }, []);
}

/**
 * Hook to consume online user IDs from any component.
 */
export function useOnlineUsers(): Set<string> {
  const [online, setOnline] = useState<Set<string>>(() => new Set(globalOnlineIds));

  useEffect(() => {
    const handler = (ids: Set<string>) => setOnline(ids);
    listeners.add(handler);
    // Sync immediately in case data arrived before subscription
    setOnline(new Set(globalOnlineIds));
    return () => { listeners.delete(handler); };
  }, []);

  return online;
}
