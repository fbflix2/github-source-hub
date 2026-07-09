import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Globe, Plus, X, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  ctClientId: string;
  userId: string;
}

export function AdminScaleProProxies({ ctClientId, userId }: Props) {
  const qc = useQueryClient();
  const [showAssign, setShowAssign] = useState(false);

  const { data: assigned = [], isLoading } = useQuery({
    queryKey: ["admin-ct-proxies", ctClientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ct_client_proxies")
        .select("id, subscription_id, assigned_at, subscriptions(id, name, raw_data, end_date)")
        .eq("ct_client_id", ctClientId)
        .is("released_at", null);
      if (error) throw error;
      return data || [];
    },
  });

  const release = useMutation({
    mutationFn: async (subscriptionId: string) => {
      const now = new Date().toISOString();
      await supabase.from("ct_client_proxies")
        .update({ released_at: now })
        .eq("subscription_id", subscriptionId)
        .eq("ct_client_id", ctClientId)
        .is("released_at", null);
      await supabase.from("subscriptions").update({
        user_id: null, included_in_ct_client_id: null, status: "available", auto_renew: false,
      }).eq("id", subscriptionId);
    },
    onSuccess: () => {
      toast.success("Proxy liberado — voltou ao pool");
      qc.invalidateQueries({ queryKey: ["admin-ct-proxies", ctClientId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="border-t border-white/10 pt-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-white/80 uppercase flex items-center gap-2">
          <Globe className="size-4 text-emerald-400" /> Proxies inclusos ({assigned.length})
        </h4>
        <Button size="sm" variant="outline" onClick={() => setShowAssign(true)}
          className="h-8 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10">
          <Plus className="size-3.5 mr-1" /> Atribuir do pool
        </Button>
      </div>

      {isLoading ? (
        <div className="text-white/40 text-xs">Carregando…</div>
      ) : assigned.length === 0 ? (
        <div className="text-white/40 text-xs">Nenhum proxy vinculado</div>
      ) : (
        <div className="space-y-2">
          {assigned.map((row: any) => {
            const rd = row.subscriptions?.raw_data || {};
            return (
              <div key={row.id} className="bg-white/5 rounded-lg px-3 py-2 flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{row.subscriptions?.name}</div>
                  <div className="font-mono text-white/60 truncate">
                    {rd.proxy_address}:{rd.port} · {rd.username}
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:bg-red-500/10"
                  onClick={() => release.mutate(row.subscription_id)}
                  disabled={release.isPending}>
                  <X className="size-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <AssignDialog
        open={showAssign}
        onClose={() => setShowAssign(false)}
        ctClientId={ctClientId}
        userId={userId}
        onDone={() => qc.invalidateQueries({ queryKey: ["admin-ct-proxies", ctClientId] })}
      />
    </div>
  );
}

function AssignDialog({
  open, onClose, ctClientId, userId, onDone,
}: { open: boolean; onClose: () => void; ctClientId: string; userId: string; onDone: () => void }) {
  const { data: pool = [], isLoading, refetch } = useQuery({
    queryKey: ["scale-pro-pool"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("id, name, raw_data")
        .in("type", ["proxyfbflix"])
        .is("user_id", null)
        .is("included_in_ct_client_id", null)
        .eq("status", "available")
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const [pending, setPending] = useState<string | null>(null);

  const assign = async (subId: string) => {
    setPending(subId);
    try {
      const { error } = await supabase.from("subscriptions").update({
        user_id: userId,
        included_in_ct_client_id: ctClientId,
        auto_renew: false,
        status: "active",
      }).eq("id", subId).is("user_id", null);
      if (error) throw error;
      await supabase.from("ct_client_proxies").insert({
        ct_client_id: ctClientId, subscription_id: subId,
      });
      toast.success("Proxy atribuído");
      onDone();
      refetch();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setPending(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#1a1010] border-white/10 text-white max-w-lg max-h-[70vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Pool Scale Pro — proxies disponíveis</DialogTitle></DialogHeader>
        {isLoading ? (
          <div className="text-white/40 text-sm">Carregando…</div>
        ) : pool.length === 0 ? (
          <div className="text-white/40 text-sm py-6 text-center">
            Pool vazio. Libere proxies via <span className="text-emerald-400">Pool Scale Pro</span> no menu.
          </div>
        ) : (
          <div className="space-y-2">
            {pool.map((p: any) => {
              const rd = p.raw_data || {};
              return (
                <div key={p.id} className="bg-white/5 rounded-lg px-3 py-2 flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="font-mono text-white/60 truncate">
                      {rd.proxy_address}:{rd.port} · {(rd.country_code || "").toUpperCase()}
                    </div>
                  </div>
                  <Button size="sm" onClick={() => assign(p.id)} disabled={pending === p.id}
                    className="h-7 bg-emerald-600 hover:bg-emerald-700">
                    {pending === p.id ? <Loader2 className="size-3 animate-spin" /> : "Atribuir"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}