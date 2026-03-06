import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, Users, DollarSign, TrendingUp, Clock, Check, Link2 } from "lucide-react";

interface Partner {
  id: string;
  slug: string;
  commission_rate: number;
  guarantee_days: number;
  balance: number;
  total_earned: number;
  total_referrals: number;
  status: string;
}

interface Referral {
  id: string;
  order_total: number;
  commission_amount: number;
  status: string;
  created_at: string;
}

export function PartnerDashboard() {
  const [partner, setPartner] = useState<Partner | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadPartnerData();
  }, []);

  const loadPartnerData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: partnerData } = await supabase
      .from("partners")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (partnerData) {
      setPartner(partnerData as Partner);

      const { data: refs } = await supabase
        .from("partner_referrals")
        .select("*")
        .eq("partner_id", partnerData.id)
        .order("created_at", { ascending: false })
        .limit(50);

      setReferrals((refs || []) as Referral[]);
    }
    setLoading(false);
  };

  const copyLink = () => {
    if (!partner) return;
    const url = `${window.location.origin}/parceiro/${partner.slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="material-symbols-outlined animate-spin text-primary text-3xl">progress_activity</span>
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="glass-panel rounded-2xl p-8 text-center">
        <Users className="size-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-bold text-foreground mb-2">Programa de Parceiros</h3>
        <p className="text-muted-foreground text-sm">
          Você ainda não faz parte do programa de parceiros. Entre em contato com o suporte para se tornar um parceiro.
        </p>
      </div>
    );
  }

  const pendingCommissions = referrals
    .filter(r => r.status === "pending")
    .reduce((sum, r) => sum + r.commission_amount, 0);

  const partnerLink = `${window.location.origin}/parceiro/${partner.slug}`;

  return (
    <div className="space-y-6">
      {/* Link de indicação */}
      <div className="glass-panel rounded-2xl p-6">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2 mb-4">
          <Link2 className="size-5 text-primary" />
          Seu Link de Indicação
        </h3>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-secondary rounded-lg px-4 py-3 text-sm text-foreground font-mono truncate border border-border">
            {partnerLink}
          </div>
          <button
            onClick={copyLink}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-3 rounded-lg text-sm font-medium transition-all"
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copiado" : "Copiar"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Comissão: <span className="text-primary font-semibold">{partner.commission_rate}%</span> • 
          Período de garantia: <span className="font-semibold">{partner.guarantee_days} dias</span>
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <DollarSign className="size-5 text-primary" />
            </div>
            <span className="text-sm text-muted-foreground">Saldo Disponível</span>
          </div>
          <p className="text-2xl font-bold text-foreground">R$ {partner.balance.toFixed(2)}</p>
        </div>

        <div className="glass-panel rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-green-500/10">
              <TrendingUp className="size-5 text-green-400" />
            </div>
            <span className="text-sm text-muted-foreground">Total Ganho</span>
          </div>
          <p className="text-2xl font-bold text-foreground">R$ {partner.total_earned.toFixed(2)}</p>
        </div>

        <div className="glass-panel rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Users className="size-5 text-blue-400" />
            </div>
            <span className="text-sm text-muted-foreground">Indicações</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{partner.total_referrals}</p>
        </div>

        <div className="glass-panel rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-yellow-500/10">
              <Clock className="size-5 text-yellow-400" />
            </div>
            <span className="text-sm text-muted-foreground">Comissões Pendentes</span>
          </div>
          <p className="text-2xl font-bold text-foreground">R$ {pendingCommissions.toFixed(2)}</p>
        </div>
      </div>

      {/* Referrals table */}
      <div className="glass-panel rounded-2xl p-6">
        <h3 className="text-lg font-bold text-foreground mb-4">Histórico de Indicações</h3>
        {referrals.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhuma indicação registrada ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">Data</th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">Valor do Pedido</th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">Comissão</th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((ref) => (
                  <tr key={ref.id} className="border-b border-border/50 hover:bg-secondary/30">
                    <td className="py-3 px-2 text-foreground">
                      {new Date(ref.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="py-3 px-2 text-foreground">R$ {ref.order_total.toFixed(2)}</td>
                    <td className="py-3 px-2 text-primary font-semibold">R$ {ref.commission_amount.toFixed(2)}</td>
                    <td className="py-3 px-2">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${
                        ref.status === "credited" 
                          ? "bg-green-500/10 text-green-400 border border-green-500/20"
                          : ref.status === "pending"
                          ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                          : "bg-red-500/10 text-red-400 border border-red-500/20"
                      }`}>
                        {ref.status === "credited" ? "Creditado" : ref.status === "pending" ? "Pendente" : "Cancelado"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
