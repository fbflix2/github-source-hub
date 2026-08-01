import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2, Send } from "lucide-react";
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

export function AdminPushToggle() {
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
    if (!endpoint || !p256dh || !auth) throw new Error("Inscrição deste aparelho incompleta. Desative e ative os alertas novamente.");

    const { error } = await supabase.from("push_subscriptions").upsert({
      user_id: userId,
      endpoint,
      p256dh,
      auth,
      user_agent: navigator.userAgent,
      scope: "admin",
      updated_at: new Date().toISOString(),
    }, { onConflict: "endpoint" });
    if (error) throw error;
    return endpoint;
  };

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return;
    }
    let active = true;
    const restoreCurrentDevice = async () => {
      try {
        const sub = await getCurrentSubscription();
        if (!sub) return;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        await saveSubscription(sub, user.id);
        if (active) setEnabled(true);
      } catch {
        if (active) setEnabled(false);
      }
    };
    void restoreCurrentDevice();
    return () => { active = false; };
  }, []);

  const enable = async () => {
    setLoading(true);
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        toast.error(
          isIOS
            ? "No iPhone: toque em Compartilhar → 'Adicionar à Tela de Início' e abra o app por lá para ativar os alertas"
            : "Este navegador não suporta notificações push. Use Chrome ou Safari atualizado."
        );
        return;
      }
      const inIframe = window.self !== window.top;
      if (inIframe) {
        toast.error("Abra o painel em uma aba própria (fora do preview) para ativar os alertas");
        return;
      }
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches ||
        ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true);
      if (isIOS && !isStandalone) {
        toast.error("No iPhone, remova o atalho antigo, adicione o painel novamente à Tela de Início e abra pelo novo ícone");
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        toast.error(
          Notification.permission === "denied"
            ? "Notificações bloqueadas: toque no cadeado 🔒 ao lado do endereço → Notificações → Permitir, e tente de novo"
            : "Permissão não concedida. Tente novamente e escolha 'Permitir'."
        );
        return;
      }
      const reg = await getPushRegistration();
      const existingSub = await reg.pushManager.getSubscription();
      const sub = existingSub ?? await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Faça login"); return; }
      await saveSubscription(sub, user.id);
      setEnabled(true);
      toast.success("🔔 Alertas ativados neste dispositivo (funciona com o site fechado)");
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
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
      }
      setEnabled(false);
      toast.success("Alertas desativados");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const sendTest = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Faça login"); return; }
      const sub = await getCurrentSubscription();
      if (!sub) {
        setEnabled(false);
        toast.error("Este aparelho não está inscrito. Ative os alertas novamente.");
        return;
      }
      const endpoint = await saveSubscription(sub, user.id);
      const registration = await getPushRegistration();
      await registration.showNotification("🔔 Teste local FBFLIX", {
        body: "Este aparelho permitiu a exibição dos alertas.",
        icon: "/favicon.png",
        badge: "/favicon.png",
        tag: `admin-local-test-${Date.now()}`,
        data: { url: "/admin" },
      });
      const { data, error } = await supabase.functions.invoke("send-admin-push", {
        body: {
          user_id: user.id,
          endpoint,
          title: "🔔 Teste de alerta admin",
          body: "Se você recebeu isso, os alertas estão funcionando.",
          url: "/admin",
          tag: `admin-remote-test-${Date.now()}`,
        },
      });
      if (error) throw error;
      if ((data as any)?.sent > 0 && (data as any)?.attempted === 1) toast.success("Teste local exibido e envio remoto aceito pelo serviço do aparelho");
      else toast.error((data as any)?.reason || "O servidor não conseguiu entregar ao aparelho atual. Reative os alertas.");
    } catch (e: any) {
      toast.error(e.message || "Falha ao enviar teste");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={enabled ? disable : enable}
        disabled={loading}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
          enabled
            ? "border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20"
            : "border-border bg-card hover:bg-muted text-foreground"
        } disabled:opacity-50`}
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : enabled ? <Bell className="size-4" /> : <BellOff className="size-4" />}
        {enabled ? "Alertas no celular ativos" : "Ativar alertas no celular"}
      </button>
      {enabled && (
        <button
          onClick={sendTest}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Testar
        </button>
      )}
    </div>
  );
}
