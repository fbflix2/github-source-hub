import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const CHANNEL_NAME = "team-presence";

let globalChannel: ReturnType<typeof supabase.channel> | null = null;
let globalOnlineIds = new Set<string>();
let listeners = new Set<(ids: Set<string>) => void>();
let trackedUserId: string | null = null;

function notifyAll() {
  listeners.forEach((fn) => fn(new Set(globalOnlineIds)));
}

function ensureChannel(userId: string) {
  if (globalChannel && trackedUserId === userId) return;
  if (globalChannel) {
    supabase.removeChannel(globalChannel);
  }
  trackedUserId = userId;
  globalChannel = supabase.channel(CHANNEL_NAME, {
    config: { presence: { key: userId } },
  });

  globalChannel
    .on("presence", { event: "sync" }, () => {
      globalOnlineIds = new Set(Object.keys(globalChannel!.presenceState()));
      notifyAll();
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await globalChannel!.track({ user_id: userId, online_at: new Date().toISOString() });
      }
    });
}

/**
 * Hook that tracks team presence globally.
 * Call from AdminLayout so presence is active on every admin page.
 */
export function useTeamPresenceTracker() {
  useEffect(() => {
    let userId: string | null = null;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        userId = user.id;
        ensureChannel(user.id);
      }
    });
    return () => {
      // Don't destroy channel on unmount — it's global
    };
  }, []);
}

/**
 * Hook to consume online user IDs from any component.
 */
export function useOnlineUsers(): Set<string> {
  const [online, setOnline] = useState<Set<string>>(globalOnlineIds);

  useEffect(() => {
    const handler = (ids: Set<string>) => setOnline(ids);
    listeners.add(handler);
    // Sync immediately
    setOnline(new Set(globalOnlineIds));
    return () => { listeners.delete(handler); };
  }, []);

  return online;
}
