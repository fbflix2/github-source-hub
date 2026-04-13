import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Wifi, WifiOff } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

const DISMISS_KEY = "wapi_disconnected_dismissed";

export function WapiDisconnectedAlert() {
  const [dismissed, setDismissed] = useState(() => {
    const ts = sessionStorage.getItem(DISMISS_KEY);
    if (!ts) return false;
    // Auto-reset dismiss after 10 minutes so it alerts again
    return Date.now() - Number(ts) < 10 * 60 * 1000;
  });

  const { data: isAdmin } = useQuery({
    queryKey: ["wapi-alert-is-admin"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      return !!data;
    },
    staleTime: 600_000,
  });

  const { data: statusData } = useQuery({
    queryKey: ["wapi-connection-status"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      const { data, error } = await supabase.functions.invoke("wapi-send", {
        body: { action: "check-status" },
      });
      if (error) return null;
      return data;
    },
    enabled: !!isAdmin,
    refetchInterval: 2 * 60 * 1000, // Check every 2 minutes
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: true,
  });

  // Determine if disconnected
  const isConnected = statusData?.status?.connected === true ||
    statusData?.status?.state === "CONNECTED" ||
    statusData?.status?.status === "CONNECTED";
  const isDisconnected = statusData && !isConnected;

  const instanceId = statusData?.instance_id || "—";
  const showAlert = isAdmin && isDisconnected && !dismissed;

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem(DISMISS_KEY, String(Date.now()));
  };

  if (!showAlert) return null;

  return (
    <AlertDialog open={showAlert} onOpenChange={(open) => { if (!open) handleDismiss(); }}>
      <AlertDialogContent className="border-destructive/50 bg-card max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center size-12 rounded-full bg-destructive/10 animate-pulse">
              <WifiOff className="size-6 text-destructive" />
            </div>
            <AlertDialogTitle className="text-lg text-foreground">
              WhatsApp Desconectado!
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-muted-foreground text-sm leading-relaxed">
            A instância W-API <span className="font-mono font-bold text-foreground">{instanceId}</span> está <span className="font-bold text-destructive">desconectada</span>.
            <br /><br />
            Enquanto desconectada, nenhuma mensagem automática (avisos de vencimento, reposições, etc.) será enviada aos clientes.
            <br /><br />
            Reconecte o WhatsApp no painel da W-API o quanto antes.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:flex-row">
          <AlertDialogAction
            onClick={() => { window.open("https://app.w-api.app", "_blank"); handleDismiss(); }}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Wifi className="size-4 mr-2" />
            Abrir W-API
          </AlertDialogAction>
          <AlertDialogAction
            onClick={handleDismiss}
            className="bg-muted text-muted-foreground hover:bg-muted/80"
          >
            Fechar (lembrar em 10min)
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
