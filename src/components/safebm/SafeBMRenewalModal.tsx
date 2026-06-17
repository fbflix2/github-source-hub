import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MaterialIcon } from "./SecurityMonitor";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SafeBmVault {
  id: string;
  bm_name: string;
  next_billing_at?: string;
  last_billing_at?: string;
  protection_start: string;
  subscription_price: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function getVaultProtectionWindow(v: Pick<SafeBmVault, "protection_start" | "last_billing_at" | "next_billing_at">) {
  const anchor = new Date(v.last_billing_at || v.protection_start);
  const monthlyExpiry = addMonths(anchor, 1);
  const storedExpiry = v.next_billing_at ? new Date(v.next_billing_at) : null;
  const expiry = storedExpiry && storedExpiry.getTime() > monthlyExpiry.getTime() ? storedExpiry : monthlyExpiry;
  const remainingMs = expiry.getTime() - Date.now();
  const expired = remainingMs <= 0;
  const daysRemaining = expired ? 0 : Math.max(1, Math.ceil(remainingMs / DAY_MS));

  return { expiry, expired, daysRemaining };
}

interface SafeBMRenewalModalProps {
  open: boolean;
  onClose: () => void;
  vaults: SafeBmVault[];
  initialSelectedId?: string | null;
}

export default function SafeBMRenewalModal({ open, onClose, vaults, initialSelectedId }: SafeBMRenewalModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedId ? [initialSelectedId] : []);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const expiredOrExpiring = useMemo(() => {
    return vaults.filter(v => {
      const protection = getVaultProtectionWindow(v);
      return protection.daysRemaining <= 5;
    });
  }, [vaults]);

  const totalAmount = useMemo(() => {
    return expiredOrExpiring
      .filter(v => selectedIds.includes(v.id))
      .reduce((sum, v) => sum + (v.subscription_price || 9.99), 0);
  }, [expiredOrExpiring, selectedIds]);

  const toggleVault = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleRenew = async () => {
    if (selectedIds.length === 0) {
      toast.error("Selecione pelo menos um cofre para renovar");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Evita duplicar: se já existir renovação pendente p/ o cofre, reaproveita
      const { data: existingPending } = await supabase
        .from("safe_bm_renewals")
        .select("id, vault_id")
        .in("vault_id", selectedIds)
        .eq("status", "pending");

      const existingByVault = new Map<string, string>(
        (existingPending || []).map((r: any) => [r.vault_id, r.id])
      );

      const toCreate = selectedIds.filter(id => !existingByVault.has(id));

      // Create renewal records (apenas para cofres sem pendência)
      const renewals = toCreate.map(id => {
        const v = expiredOrExpiring.find(x => x.id === id);
        return {
          vault_id: id,
          user_id: user.id,
          amount: v?.subscription_price || 9.99,
          status: 'pending'
        };
      });

      let createdIds: string[] = [];
      if (renewals.length > 0) {
        const { data, error } = await supabase
          .from("safe_bm_renewals")
          .insert(renewals)
          .select();
        if (error) throw error;
        createdIds = (data || []).map((r: any) => r.id);
      }

      const allRenewalIds = [
        ...createdIds,
        ...Array.from(existingByVault.values()),
      ];

      toast.success("Solicitação de renovação criada! Redirecionando para o pagamento...");
      
      // Store renewal IDs in session storage for checkout to know what we're paying for
      sessionStorage.setItem("pending_safe_bm_renewals", JSON.stringify(allRenewalIds));

      // Redirect to checkout
      // We'll use a virtual product ID or just a generic one. 
      // For now, let's redirect to checkout with a generic "Safe BM Renewal" item info
      // But we need a real product ID to use the standard checkout page easily.
      // I'll check if there's a generic "Serviço" product.
      
      const { data: products } = await supabase
        .from("products")
        .select("id")
        .eq("name", "Saldo FBX") // Example of a generic product
        .limit(1)
        .single();

      // If we don't have a specific product, we'll just go to wallet or something.
      // But the user wants checkout.
      // Let's assume there's a product with id 'safe-bm-renewal' or something we can use.
      // For now, I'll just use a search param to tell checkout it's a renewal.
      
      navigate(`/checkout?type=safe_bm_renewal&amount=${totalAmount}`);
      onClose();
    } catch (err: any) {
      toast.error("Erro ao processar renovação: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#1c2025] border-[#5d3f3b]/15 text-[#e0e2ea] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold font-space">Renovar Cofres Safe BM</DialogTitle>
          <p className="text-xs text-[#c6c6c7]/60">Selecione os cofres que deseja renovar agora.</p>
        </DialogHeader>

        <ScrollArea className="max-h-[300px] my-4 pr-4">
          <div className="space-y-3">
            {expiredOrExpiring.length === 0 ? (
              <p className="text-center py-8 text-sm text-[#c6c6c7]/40">Nenhum cofre precisando de renovação imediata.</p>
            ) : (
              expiredOrExpiring.map(v => (
                <div 
                  key={v.id} 
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                    selectedIds.includes(v.id) 
                      ? 'bg-[#ffb4aa]/10 border-[#ffb4aa]/30' 
                      : 'bg-[#0a0e13]/40 border-[#ffb4aa]/10 hover:border-[#ffb4aa]/20'
                  }`}
                  onClick={() => toggleVault(v.id)}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox 
                      checked={selectedIds.includes(v.id)}
                      onCheckedChange={() => toggleVault(v.id)}
                      className="border-[#ffb4aa]/40 data-[state=checked]:bg-[#ffb4aa] data-[state=checked]:text-[#410001]"
                    />
                    <div>
                      <p className="text-sm font-bold">{v.bm_name}</p>
                      <p className="text-[10px] text-[#c6c6c7]/60">
                        Expiração: {format(getVaultProtectionWindow(v).expiry, "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-[#ffb4aa]">R$ {v.subscription_price.toFixed(2)}</p>
                    <p className="text-[9px] text-[#c6c6c7]/40">Mensal</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="pt-4 border-t border-[#ffb4aa]/10 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-[#c6c6c7]">Total a pagar:</span>
            <span className="text-xl font-black text-[#ffb4aa]">R$ {totalAmount.toFixed(2)}</span>
          </div>

          <Button 
            className="w-full h-12 bg-[#ffb4aa] hover:bg-[#ff8a7a] text-[#410001] font-bold text-sm rounded-xl gap-2"
            onClick={handleRenew}
            disabled={loading || selectedIds.length === 0}
          >
            {loading ? (
              <span className="animate-spin h-4 w-4 border-2 border-[#410001] border-t-transparent rounded-full" />
            ) : (
              <>
                <MaterialIcon name="shopping_cart_checkout" className="!text-sm" />
                Ir para o Checkout
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
