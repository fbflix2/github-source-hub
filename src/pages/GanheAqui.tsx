import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Copy, Check, Users, DollarSign, TrendingUp, Percent,
  Link2, Share2, ArrowRight, Handshake, ShoppingCart, Wallet,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

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

export default function GanheAqui() {
  const [partner, setPartner] = useState<Partner | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    loadPartnerData();
  }, []);

  const loadPartnerData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

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
        .limit(100);
      setReferrals((refs || []) as Referral[]);
    }
    setLoading(false);
  };

  const copyLink = () => {
    if (!partner) return;
    const url = `https://fbflix.com.br/parceiro/${partner.slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const filteredReferrals = useMemo(() => {
    if (statusFilter === "all") return referrals;
    return referrals.filter(r => r.status === statusFilter);
  }, [referrals, statusFilter]);

  const pendingCommissions = referrals
    .filter(r => r.status === "pending")
    .reduce((sum, r) => sum + r.commission_amount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="material-symbols-outlined animate-spin text-primary text-3xl">progress_activity</span>
      </div>
    );
  }

  // Non-partner view
  if (!partner) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <div className="rounded-2xl border border-border bg-card p-10 text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Handshake className="size-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Programa de Parceiros</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Indique clientes e ganhe comissão em cada venda. Entre em contato com o suporte para se tornar um parceiro.
          </p>

          {/* Como funciona preview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6">
            {howItWorksSteps.map((step, i) => (
              <div key={i} className="rounded-xl border border-border bg-background p-4 text-center space-y-2">
                <div className="mx-auto w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <step.icon className="size-5 text-primary" />
                </div>
                <p className="text-xs font-semibold text-foreground">{step.title}</p>
                <p className="text-[11px] text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const partnerLink = `fbflix.com.br/parceiro/${partner.slug}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Handshake className="size-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Painel do Parceiro</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                partner.status === "active"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-red-500/10 text-red-400 border border-red-500/20"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${partner.status === "active" ? "bg-emerald-400" : "bg-red-400"}`} />
                {partner.status === "active" ? "Ativo" : "Inativo"}
              </span>
              <span className="text-xs text-muted-foreground">
                Garantia: {partner.guarantee_days} dias
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Link de indicação */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Link2 className="size-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Seu link de indicação</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-background rounded-lg px-4 py-2.5 text-sm text-muted-foreground font-mono truncate border border-border">
            {partnerLink}
          </div>
          <Button
            size="sm"
            onClick={copyLink}
            className="shrink-0 gap-2"
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copiado" : "Copiar"}
          </Button>
        </div>
      </div>

      {/* Métricas 2x2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          icon={<Wallet className="size-5 text-primary" />}
          iconBg="bg-primary/10"
          label="Saldo Disponível"
          value={`R$ ${partner.balance.toFixed(2)}`}
          valueClass={partner.balance > 0 ? "text-emerald-400" : "text-foreground"}
          action={
            partner.balance > 0 ? (
              <button
                onClick={() => toast.info("Entre em contato com o suporte para solicitar o saque.")}
                className="text-[11px] text-primary font-medium hover:underline mt-1"
              >
                Solicitar saque →
              </button>
            ) : undefined
          }
        />
        <MetricCard
          icon={<TrendingUp className="size-5 text-emerald-400" />}
          iconBg="bg-emerald-500/10"
          label="Total Ganho"
          value={`R$ ${partner.total_earned.toFixed(2)}`}
        />
        <MetricCard
          icon={<Users className="size-5 text-blue-400" />}
          iconBg="bg-blue-500/10"
          label="Indicações"
          value={String(partner.total_referrals)}
        />
        <MetricCard
          icon={<Percent className="size-5 text-amber-400" />}
          iconBg="bg-amber-500/10"
          label="Comissão"
          value={`${partner.commission_rate}%`}
          subtitle={pendingCommissions > 0 ? `R$ ${pendingCommissions.toFixed(2)} pendente` : undefined}
        />
      </div>

      {/* Minhas Indicações */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-sm font-bold text-foreground">Minhas Indicações</h3>
          <div className="flex items-center gap-2">
            <Filter className="size-3.5 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-[130px] text-xs bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="credited">Creditados</SelectItem>
                <SelectItem value="cancelled">Cancelados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {filteredReferrals.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="size-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {statusFilter === "all"
                ? "Nenhuma indicação registrada ainda."
                : "Nenhuma indicação com este status."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30">
                  <th className="text-left py-2.5 px-4 text-xs text-muted-foreground font-medium">Data</th>
                  <th className="text-left py-2.5 px-4 text-xs text-muted-foreground font-medium">Valor do Pedido</th>
                  <th className="text-left py-2.5 px-4 text-xs text-muted-foreground font-medium">Comissão</th>
                  <th className="text-left py-2.5 px-4 text-xs text-muted-foreground font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredReferrals.map((ref) => (
                  <tr key={ref.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-2.5 px-4 text-foreground">
                      {new Date(ref.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="py-2.5 px-4 text-foreground">
                      R$ {ref.order_total.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4 text-primary font-semibold">
                      R$ {ref.commission_amount.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4">
                      <StatusBadge status={ref.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Como Funciona */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-sm font-bold text-foreground mb-4">Como funciona</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {howItWorksSteps.map((step, i) => (
            <div key={i} className="relative flex flex-col items-center text-center p-4 rounded-xl bg-background border border-border/50">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <step.icon className="size-5 text-primary" />
              </div>
              <span className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">
                Passo {i + 1}
              </span>
              <p className="text-sm font-semibold text-foreground">{step.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{step.desc}</p>
              {i < 2 && (
                <ArrowRight className="hidden sm:block absolute -right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/30" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Sub-components ---

const howItWorksSteps = [
  {
    icon: Share2,
    title: "Compartilhe seu link",
    desc: "Envie seu link exclusivo para amigos e seguidores.",
  },
  {
    icon: ShoppingCart,
    title: "Cliente compra",
    desc: "Quando alguém compra pelo seu link, a venda é rastreada.",
  },
  {
    icon: DollarSign,
    title: "Você ganha comissão",
    desc: "Receba sua comissão automaticamente após o período de garantia.",
  },
];

function MetricCard({
  icon, iconBg, label, value, valueClass, subtitle, action,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  valueClass?: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-lg ${iconBg}`}>{icon}</div>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={`text-xl font-bold ${valueClass || "text-foreground"}`}>{value}</p>
      {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
      {action}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    credited: { bg: "bg-emerald-500/10 border-emerald-500/20", text: "text-emerald-400", label: "Creditado" },
    pending: { bg: "bg-amber-500/10 border-amber-500/20", text: "text-amber-400", label: "Pendente" },
    cancelled: { bg: "bg-red-500/10 border-red-500/20", text: "text-red-400", label: "Cancelado" },
  };
  const c = config[status] || config.pending;
  return (
    <span className={`inline-flex items-center text-[11px] px-2 py-0.5 rounded-full font-medium border ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}
