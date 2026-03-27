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

    const setupPresence = async (userId: string | null) => {
      if (!userId) {
        if (channelInstance) {
          supabase.removeChannel(channelInstance);
          channelInstance = null;
        }
        channelUserId = null;
        globalOnlineIds = new Set();
        notifyAll();
        return;
      }

      refCount++;

      if (channelInstance && channelUserId === userId) {
        return;
      }

      if (channelInstance) {
        supabase.removeChannel(channelInstance);
        channelInstance = null;
      }

      channelUserId = userId;
      const channel = supabase.channel(CHANNEL_NAME, {
        config: { presence: { key: userId } },
      });

      channel
        .on("presence", { event: "sync" }, () => {
          globalOnlineIds = new Set(Object.keys(channel.presenceState()));
          notifyAll();
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED" && !cancelled) {
            await channel.track({ user_id: userId, online_at: new Date().toISOString() });
          }
        });

      channelInstance = channel;
    };

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!cancelled) void setupPresence(user?.id ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) void setupPresence(session?.user?.id ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
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
