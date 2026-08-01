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

interface ClientPushToggleProps {
  compact?: boolean;
}

export function ClientPushToggle({ compact = false }: ClientPushToggleProps) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  const getCurrentSubscription = async () => {
    const registration = await navigator.serviceWorker.getRegistration("/");
    return registration?.pushManager.getSubscription() ?? null;
  };

  const getPushRegistration = async () => {
    const registration = await navigator.serviceWorker.register("/push-sw.js?v=2", {
      scope: "/",
      updateViaCache: "none",
    });
    await registration.update();
    await navigator.serviceWorker.ready;
    return registration;
  };

  const saveSubscription = async (sub: PushSubscription, userId: string) => {
    const json = sub.toJSON();
    const endpoint = json.endpoint;
    const p256dh = json.keys?.p256dh;
    const auth = json.keys?.auth;
    if (!endpoint || !p256dh || !auth) throw new Error("Inscrição deste aparelho incompleta. Tente novamente.");

    const { error } = await supabase.from("push_subscriptions").upsert({
      user_id: userId,
      endpoint,
      p256dh,
      auth,
      user_agent: navigator.userAgent,
      scope: "client",
      updated_at: new Date().toISOString(),
    }, { onConflict: "endpoint" });
    if (error) throw error;
  };

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    let active = true;
    (async () => {
      try {
        const sub = await getCurrentSubscription();
        if (!sub) return;
        const { data } = await supabase
          .from("push_subscriptions")
          .select("id")
          .eq("endpoint", sub.endpoint)
          .eq("scope", "client")
          .maybeSingle();
        if (active) setEnabled(!!data);
      } catch {
        if (active) setEnabled(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const enable = async () => {
    setLoading(true);
    try {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        toast.error(
          isIOS
            ? "No iPhone: toque em Compartilhar → 'Adicionar à Tela de Início' e abra por lá para ativar os avisos"
            : "Este navegador não suporta avisos. Use Chrome ou Safari atualizado."
        );
        return;
      }
      if (window.self !== window.top) {
        toast.error("Abra o site em uma aba própria para ativar os avisos");
        return;
      }
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches ||
        ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true);
      if (isIOS && !isStandalone) {
        toast.error("No iPhone, adicione o site à Tela de Início e abra pelo ícone para ativar os avisos");
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        toast.error(
          Notification.permission === "denied"
            ? "Avisos bloqueados: toque no cadeado 🔒 ao lado do endereço → Notificações → Permitir"
            : "Permissão não concedida."
        );
        return;
      }
      const reg = await getPushRegistration();
      const existing = await reg.pushManager.getSubscription();
      const sub = existing ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Faça login"); return; }
      await saveSubscription(sub, user.id);
      setEnabled(true);
      toast.success("🔔 Avisos ativados — você será notificado mesmo com o site fechado");
    } catch (e: any) {
      toast.error(e.message || "Falha ao ativar");
    } finally {
      setLoading(false);
    }
  };

  const disable = async () => {
    setLoading(true);
    try {
      const sub = await getCurrentSubscription();
      if (sub) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint).eq("scope", "client");
        await sub.unsubscribe();
      }
      setEnabled(false);
      toast.success("Avisos desativados");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={enabled ? disable : enable}
      disabled={loading}
      title={enabled ? "Avisos no celular ativos" : "Ativar avisos no celular"}
      className={`flex items-center gap-2 rounded-lg border text-xs font-medium transition-colors disabled:opacity-50 ${
        compact ? "p-2" : "px-3 py-2"
      } ${
        enabled
          ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
          : "border-border bg-card hover:bg-muted text-foreground"
      }`}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : enabled ? <Bell className="size-4" /> : <BellOff className="size-4" />}
      {!compact && (enabled ? "Avisos ativos" : "Ativar avisos")}
    </button>
  );
}
