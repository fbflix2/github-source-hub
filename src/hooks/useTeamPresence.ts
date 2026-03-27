import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const CHANNEL_NAME = "team-presence-v2";

// Global state shared across hook instances
let globalOnlineIds = new Set<string>();
const listeners = new Set<(ids: Set<string>) => void>();
let channelInstance: ReturnType<typeof supabase.channel> | null = null;
let channelUserId: string | null = null;
let refCount = 0;

function notifyAll() {
  const snapshot = new Set(globalOnlineIds);
  listeners.forEach((fn) => fn(snapshot));
}

/**
 * Hook that tracks team presence globally.
 * Call from AdminLayout so presence is active on every admin page.
 */
export function useTeamPresenceTracker() {
  useEffect(() => {
    let cancelled = false;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || !user) return;

      refCount++;

      // If channel already active for this user, skip
      if (channelInstance && channelUserId === user.id) return;

      // Remove old channel if user changed
      if (channelInstance) {
        supabase.removeChannel(channelInstance);
        channelInstance = null;
      }

      channelUserId = user.id;
      const channel = supabase.channel(CHANNEL_NAME, {
        config: { presence: { key: user.id } },
      });

      channel
        .on("presence", { event: "sync" }, () => {
          globalOnlineIds = new Set(Object.keys(channel.presenceState()));
          notifyAll();
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED" && !cancelled) {
            await channel.track({
              user_id: user.id,
              online_at: new Date().toISOString(),
            });
          }
        });

      channelInstance = channel;
    });

    return () => {
      cancelled = true;
      refCount--;
      if (refCount <= 0 && channelInstance) {
        supabase.removeChannel(channelInstance);
        channelInstance = null;
        channelUserId = null;
        globalOnlineIds = new Set();
        notifyAll();
      }
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
    setOnline(new Set(globalOnlineIds));
    return () => { listeners.delete(handler); };
  }, []);

  return online;
}
