import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Wallet, ExternalLink } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

const THRESHOLD = 50;
const DISMISS_KEY = "proxybr_low_balance_dismissed";

export function ProxyBRLowBalanceAlert() {
  const [dismissed, setDismissed] = useState(() => {
    const stored = sessionStorage.getItem(DISMISS_KEY);
    return stored === "true";
  });

  const { data: meData } = useQuery({
    queryKey: ["proxybr-me"],
    queryFn: async () => {
      // Check if user is authenticated before calling
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const { data, error } = await supabase.functions.invoke("proxybr-api", {
        body: { action: "get-me" },
      });
      if (error) {
        // If token expired, try refreshing and retrying once
        if (error.message?.includes("401") || error.message?.includes("Token")) {
          const { error: refreshErr } = await supabase.auth.refreshSession();
          if (refreshErr) return null;
          const retry = await supabase.functions.invoke("proxybr-api", {
            body: { action: "get-me" },
          });
          if (retry.error) return null;
          return retry.data;
        }
        return null;
      }
      return data;
    },
    staleTime: 120_000,
    refetchInterval: 300_000,
    retry: false,
  });

  const balance = meData?.current_balance ?? meData?.data?.current_balance ?? null;
  const isLow = balance !== null && balance < THRESHOLD;
  const showAlert = isLow && !dismissed;

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem(DISMISS_KEY, "true");
  };

  if (!showAlert) return null;

  return (
    <AlertDialog open={showAlert} onOpenChange={(open) => { if (!open) handleDismiss(); }}>
      <AlertDialogContent className="border-destructive/50 bg-card max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center size-12 rounded-full bg-destructive/10">
              <AlertTriangle className="size-6 text-destructive" />
            </div>
            <AlertDialogTitle className="text-lg text-foreground">
              Saldo ProxyBR Baixo!
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-muted-foreground text-sm leading-relaxed">
            Seu saldo na ProxyBR está em{" "}
            <span className="font-bold text-destructive">
              R$ {balance?.toFixed(2)}
            </span>
            , abaixo do limite de R$ {THRESHOLD.toFixed(2)}.
            <br /><br />
            Recarregue sua carteira no painel da ProxyBR para garantir que novas contratações de proxy não sejam interrompidas.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:flex-row">
          <AlertDialogAction
            onClick={() => { window.open("https://painel.proxybr.com.br", "_blank"); handleDismiss(); }}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <ExternalLink className="size-4 mr-2" />
            Recarregar na ProxyBR
          </AlertDialogAction>
          <AlertDialogAction
            onClick={handleDismiss}
            className="bg-muted text-muted-foreground hover:bg-muted/80"
          >
            Fechar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
