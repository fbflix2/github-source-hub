import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const VAPID_PUBLIC_KEY = "BGs64kSa3Nzozj8W-a_2ktyG5ISAn4duE71LBvGKmuMTGN2YriBSYJeQDODIgXymjay4EX6H4zLpTK0wAfeWRLw";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function PushNotificationToggle() {
  const [supported, setSupported] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setSupported(false);
      return;
    }
    navigator.serviceWorker.getRegistration("/push-sw.js").then(async (reg) => {
      if (!reg) return;
      const sub = await reg.pushManager.getSubscription();
      setEnabled(!!sub);
    });
  }, []);

  const enable = async () => {
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        toast.error("Permissão negada");
        return;
      }
      const reg = await navigator.serviceWorker.register("/push-sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      const json: any = sub.toJSON();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Faça login"); return; }
      const { error } = await supabase.from("push_subscriptions").upsert({
        user_id: user.id,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        user_agent: navigator.userAgent,
        scope: "partner",
      }, { onConflict: "endpoint" });
      if (error) throw error;
      setEnabled(true);
      toast.success("🔔 Notificações ativadas! Você receberá um ding em cada nova venda.");
    } catch (e: any) {
      toast.error(e.message || "Falha ao ativar");
    } finally {
      setLoading(false);
    }
  };

  const disable = async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
      }
      setEnabled(false);
      toast.success("Notificações desativadas");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!supported) {
    return (
      <div className="text-xs text-muted-foreground p-3 rounded-lg border border-border bg-card/40">
        Seu navegador não suporta notificações push.
      </div>
    );
  }

  return (
    <button
      onClick={enabled ? disable : enable}
      disabled={loading}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
        enabled
          ? "border-green-500/30 bg-green-500/10 text-green-500 hover:bg-green-500/20"
          : "border-border bg-card hover:bg-muted text-foreground"
      } disabled:opacity-50`}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : enabled ? <Bell className="size-4" /> : <BellOff className="size-4" />}
      {enabled ? "Notificações ativadas" : "Ativar notificações de venda"}
    </button>
  );
}