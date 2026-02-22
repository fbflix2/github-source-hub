import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search, CheckCircle, XCircle, Clock, Eye } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

interface Ad {
  id: string;
  user_id: string;
  position_name: string;
  position_price: number;
  name: string;
  url: string | null;
  image_url: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  profile?: { full_name: string | null; cpf: string | null } | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "Pendente", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: Clock },
  active: { label: "Ativo", color: "bg-green-500/20 text-green-400 border-green-500/30", icon: CheckCircle },
  rejected: { label: "Rejeitado", color: "bg-destructive/20 text-destructive border-destructive/30", icon: XCircle },
  finished: { label: "Finalizado", color: "bg-muted text-muted-foreground border-border", icon: Clock },
};

export default function AdminAnuncios() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingAd, setRejectingAd] = useState<Ad | null>(null);

  useEffect(() => {
    fetchAds();
  }, []);

  async function fetchAds() {
    const { data: adsData } = await supabase
      .from("ads")
      .select("*")
      .order("created_at", { ascending: false });

    if (!adsData) { setLoading(false); return; }

    // Fetch profiles for all user_ids
    const userIds = [...new Set(adsData.map(a => a.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, cpf")
      .in("user_id", userIds.length > 0 ? userIds : ["__none__"]);

    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

    const enriched = adsData.map(ad => ({
      ...ad,
      profile: profileMap.get(ad.user_id) || null,
    }));

    setAds(enriched);
    setLoading(false);
  }

  const handleApprove = async (ad: Ad) => {
    await supabase.from("ads").update({ status: "active", start_date: new Date().toISOString() }).eq("id", ad.id);
    toast.success(`Anúncio "${ad.name}" aprovado.`);
    fetchAds();
  };

  const handleReject = async () => {
    if (!rejectingAd) return;
    // Reject ad and refund balance
    await supabase.from("ads").update({ status: "rejected" }).eq("id", rejectingAd.id);

    // Refund
    const { data: profile } = await supabase
      .from("profiles")
      .select("balance")
      .eq("user_id", rejectingAd.user_id)
      .single();

    if (profile) {
      const newBalance = profile.balance + Number(rejectingAd.position_price);
      await supabase.from("profiles").update({ balance: newBalance }).eq("user_id", rejectingAd.user_id);
      await supabase.from("wallet_transactions").insert({
        user_id: rejectingAd.user_id,
        amount: Number(rejectingAd.position_price),
        type: "credit",
        title: `[Admin] Reembolso: Anúncio "${rejectingAd.name}" rejeitado`,
        balance_after: newBalance,
      });
    }

    toast.success(`Anúncio "${rejectingAd.name}" rejeitado e saldo reembolsado.`);
    setShowRejectModal(false);
    setRejectingAd(null);
    fetchAds();
  };

  const handleFinish = async (ad: Ad) => {
    await supabase.from("ads").update({ status: "finished", end_date: new Date().toISOString() }).eq("id", ad.id);
    toast.success(`Anúncio "${ad.name}" finalizado.`);
    fetchAds();
  };

  const filtered = ads.filter(ad => {
    if (filterStatus !== "all" && ad.status !== filterStatus) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        ad.name.toLowerCase().includes(s) ||
        ad.position_name.toLowerCase().includes(s) ||
        (ad.profile?.full_name || "").toLowerCase().includes(s)
      );
    }
    return true;
  });

  const stats = {
    total: ads.length,
    pending: ads.filter(a => a.status === "pending").length,
    active: ads.filter(a => a.status === "active").length,
    revenue: ads.reduce((sum, a) => a.status !== "rejected" ? sum + Number(a.position_price) : sum, 0),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, icon: "campaign", color: "text-primary" },
          { label: "Pendentes", value: stats.pending, icon: "schedule", color: "text-yellow-400" },
          { label: "Ativos", value: stats.active, icon: "check_circle", color: "text-green-400" },
          { label: "Receita", value: `R$ ${stats.revenue.toFixed(2).replace(".", ",")}`, icon: "payments", color: "text-primary" },
        ].map((s, i) => (
          <div key={i} className="glass-panel rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
              <span className={`material-symbols-outlined text-lg ${s.color}`}>{s.icon}</span>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
              <p className="text-lg font-bold text-foreground">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, posição ou cliente..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        {["all", "pending", "active", "rejected", "finished"].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              filterStatus === s
                ? "bg-primary text-primary-foreground"
                : "glass-panel text-muted-foreground hover:text-foreground"
            }`}
          >
            {s === "all" ? "Todos" : statusConfig[s]?.label || s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="glass-panel rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <span className="material-symbols-outlined text-[48px] text-muted-foreground mb-2">campaign</span>
            <p className="text-muted-foreground">Nenhum anúncio encontrado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="p-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Cliente</th>
                  <th className="p-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Anúncio</th>
                  <th className="p-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Posição</th>
                  <th className="p-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground text-center">Status</th>
                  <th className="p-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Data</th>
                  <th className="p-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground text-right">Valor</th>
                  <th className="p-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((ad) => {
                  const st = statusConfig[ad.status] || statusConfig.pending;
                  return (
                    <tr key={ad.id} className="hover:bg-muted/50 transition-colors">
                      <td className="p-3">
                        <p className="text-sm font-medium text-foreground">{ad.profile?.full_name || "—"}</p>
                      </td>
                      <td className="p-3">
                        <p className="text-sm text-foreground font-medium">{ad.name}</p>
                        {ad.url && <p className="text-[10px] text-muted-foreground truncate max-w-[180px]">{ad.url}</p>}
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">{ad.position_name}</td>
                      <td className="p-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${st.color}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {new Date(ad.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="p-3 text-sm text-foreground font-medium text-right">
                        R$ {Number(ad.position_price).toFixed(2).replace(".", ",")}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {ad.status === "pending" && (
                            <>
                              <button
                                onClick={() => handleApprove(ad)}
                                className="p-1.5 rounded-md bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                                title="Aprovar"
                              >
                                <CheckCircle className="size-4" />
                              </button>
                              <button
                                onClick={() => { setRejectingAd(ad); setShowRejectModal(true); }}
                                className="p-1.5 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                                title="Rejeitar"
                              >
                                <XCircle className="size-4" />
                              </button>
                            </>
                          )}
                          {ad.status === "active" && (
                            <button
                              onClick={() => handleFinish(ad)}
                              className="px-2 py-1 rounded-md text-[10px] font-medium bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            >
                              Finalizar
                            </button>
                          )}
                          {ad.url && (
                            <a
                              href={ad.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-md bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              title="Ver URL"
                            >
                              <Eye className="size-4" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reject Confirmation Modal */}
      <AlertDialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <AlertDialogContent className="glass-panel border-border max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Rejeitar Anúncio</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              O anúncio <strong className="text-foreground">"{rejectingAd?.name}"</strong> será rejeitado e o valor de{" "}
              <strong className="text-primary">R$ {Number(rejectingAd?.position_price || 0).toFixed(2).replace(".", ",")}</strong>{" "}
              será reembolsado ao saldo do cliente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border text-muted-foreground">Cancelar</AlertDialogCancel>
            <button
              onClick={handleReject}
              className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground font-bold text-sm hover:bg-destructive/90 transition-colors"
            >
              Rejeitar e Reembolsar
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
