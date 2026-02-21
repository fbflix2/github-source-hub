import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useExchangeProxy } from "@/hooks/useProxyBR";
import { Input } from "@/components/ui/input";
import type { ProxySubscription } from "@/pages/Subscriptions";

interface SubscriptionDetailModalProps {
  subscription: ProxySubscription;
  open: boolean;
  onClose: () => void;
}

export default function SubscriptionDetailModal({ subscription: sub, open, onClose }: SubscriptionDetailModalProps) {
  const [newProxyId, setNewProxyId] = useState("");
  const exchangeMutation = useExchangeProxy();

  const handleExchange = () => {
    const id = parseInt(newProxyId);
    if (isNaN(id)) return;
    exchangeMutation.mutate(
      { subscriptionCode: sub.code, proxy_id: id },
      { onSuccess: () => { setNewProxyId(""); onClose(); } }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="glass-card border-glass-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">{sub.name || sub.code}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Subscription Info */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Código</span>
              <span className="text-foreground font-mono">{sub.code}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Status</span>
              <span className="text-foreground">{sub.status}</span>
            </div>
            {sub.product_name && (
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Produto</span>
                <span className="text-foreground">{sub.product_name}</span>
              </div>
            )}
          </div>

          {/* Proxy Details */}
          {sub.proxy && (
            <div className="space-y-2 p-4 rounded-lg bg-muted/50 border border-border">
              <h4 className="text-foreground font-bold text-sm">Dados do Proxy</h4>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">IP:Porta</span>
                <span className="text-foreground font-mono">{sub.proxy.ip}:{sub.proxy.port}</span>
              </div>
              {sub.proxy.username && (
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Usuário</span>
                  <span className="text-foreground font-mono">{sub.proxy.username}</span>
                </div>
              )}
              {sub.proxy.password && (
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Senha</span>
                  <span className="text-foreground font-mono">{sub.proxy.password}</span>
                </div>
              )}
              {sub.proxy.protocol && (
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Protocolo</span>
                  <span className="text-foreground">{sub.proxy.protocol}</span>
                </div>
              )}
            </div>
          )}

          {/* Exchange Proxy */}
          <div className="space-y-3 pt-2 border-t border-glass-border">
            <h4 className="text-foreground font-bold text-sm">Trocar Proxy</h4>
            <div className="flex gap-2">
              <Input
                placeholder="ID do novo proxy"
                value={newProxyId}
                onChange={(e) => setNewProxyId(e.target.value)}
                className="bg-muted border-border text-foreground"
              />
              <button
                onClick={handleExchange}
                disabled={!newProxyId || exchangeMutation.isPending}
                className="bg-primary hover:bg-[#00c968] text-background px-4 rounded-lg text-sm font-bold transition-all disabled:opacity-50 whitespace-nowrap"
              >
                {exchangeMutation.isPending ? "Trocando..." : "Trocar"}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
