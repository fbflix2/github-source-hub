import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, ArrowRight, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PendingVault {
  id: string;
  client_name: string | null;
  bm_name: string;
  bm_link: string;
  created_at: string;
}

const GENERIC_BM_LINK = "https://business.facebook.com";

export function PendingSafeBMPopup() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pendingVaults, setPendingVaults] = useState<PendingVault[]>([]);
  const dismissedKey = "safebm_popup_dismissed_at";

  const fetchPending = useCallback(async () => {
    const { data } = await supabase
      .from("safe_bm_vaults")
      .select("id, client_name, bm_name, bm_link, created_at")
      .eq("status", "active")
      .eq("bm_link", GENERIC_BM_LINK)
      .order("created_at", { ascending: false });

    if (data && data.length > 0) {
      // Don't show if dismissed in the last 30 min
      const dismissedAt = sessionStorage.getItem(dismissedKey);
      if (dismissedAt) {
        const elapsed = Date.now() - parseInt(dismissedAt, 10);
        if (elapsed < 30 * 60 * 1000) return;
      }
      setPendingVaults(data as PendingVault[]);
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    // Check on mount and listen for new notifications
    fetchPending();

    const channel = supabase
      .channel("safebm-pending-popup")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "safe_bm_vaults",
      }, () => {
        fetchPending();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchPending]);

  const handleDismiss = () => {
    sessionStorage.setItem(dismissedKey, Date.now().toString());
    setOpen(false);
  };

  const handleGoToSafeBM = () => {
    setOpen(false);
    navigate("/admin/safe-bm");
  };

  if (pendingVaults.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
              <Shield className="size-4 text-orange-400" />
            </div>
            <div>
              <DialogTitle className="text-base">Safe BM — Configuração Pendente</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                {pendingVaults.length === 1
                  ? "1 cofre precisa ser configurado"
                  : `${pendingVaults.length} cofres precisam ser configurados`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-2 max-h-[240px] overflow-y-auto">
          {pendingVaults.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {v.client_name || "Cliente sem nome"}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-orange-500/40 text-orange-400">
                    {v.bm_name}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                    <Clock className="size-2.5" />
                    {formatDistanceToNow(new Date(v.created_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="flex-row gap-2 sm:justify-between">
          <Button variant="ghost" size="sm" onClick={handleDismiss}>
            Depois
          </Button>
          <Button size="sm" onClick={handleGoToSafeBM} className="gap-1.5">
            Configurar Agora
            <ArrowRight className="size-3.5" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
