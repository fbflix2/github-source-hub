import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
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

interface AdPosition {
  id: number;
  name: string;
  description: string;
  price: number;
  icon: string;
  thumbnail: string;
}

const adPositions: AdPosition[] = [
  {
    id: 1,
    name: "Banner principal",
    description: "Exibido no topo da página inicial com máxima visibilidade para todos os usuários.",
    price: 300,
    icon: "home",
    thumbnail: "https://lh3.googleusercontent.com/aida-public/AB6AXuDiFDEWh1Iy2gk2vMZmFUskkMPqSIqiEbIV5FeBhvcb6OHa-E8-XlYLkPhv8AaYqTgedSJW-NlQkPFeeSbSnvSw70t4iBmRshbE1qqVSF-B7IHo7BXnMwe_sslxKMTY4hYeDFVmHSEFqhG_B8Kcnr-Hq-7VkxDBNdQ-dOPhsujgC6tp1mZF0Pvx5_I5VO1Bj-w__oC4gEwrNCE8fC47tqYZmz-ZwyVD9liIORA_7jYoJamXWtaYvzQ37pXrr25aM_TiQSITmz4bAv0",
  },
  {
    id: 2,
    name: "Página de checkout",
    description: "Exibido antes do botão de finalizar compra, alta taxa de conversão.",
    price: 250,
    icon: "credit_card",
    thumbnail: "https://lh3.googleusercontent.com/aida-public/AB6AXuAW-i7P4C6ReYAYym6_iMCSLLXc1iFq8qHMLof4rSmy-P7weoHeS-C_3Fuk6FOA6HWhqlUIqEzwqBx2NLRCqqRSxL2f4OoaqkQacfU65c1qI9cXWqgsUxlcAAlI6novJCn55UvCswWSFiL2lNH6r-dYULlvSAQMM4bPg0UF33CuchAQFUpxdUEjqad6vh2_XBMjA8Cr5uX-papFKhssKyEwvetu5ZFaNg1sz-fMxbNSzcnDg9zsB8Eq57ACztX5ChQrGENeIsNc6DI",
  },
  {
    id: 3,
    name: "Pop-up",
    description: "Exibido quando o usuário entra na plataforma, impossível de ignorar.",
    price: 200,
    icon: "info",
    thumbnail: "https://lh3.googleusercontent.com/aida-public/AB6AXuDxxUnAEQ5fa2Kh0jJuIWToo0iWBH2PcC3kdhwD4AogwVXr-fE2VZTxFROu0_A2P6jAkK8VCaIZ62Z9v7qJbN9_-DA-b4a-79LFSRo8amq2u2wxqipC5h2kUMpMGEt7yYGEMh41-QD3euRR6PXmqptHorqP9XBCcQyK9HiQmutKx72fXaXc1fQ7saOV9t49LVgpnZtHCZWhTomfJTVSjNccuNL5eKiZHvvPFRbgJ798qWcBL5ZG4rHJxq3Q2luCgJIIUYm2GUABlWQ",
  },
  {
    id: 4,
    name: "Entre produtos",
    description: "Exibido na listagem de produtos da página inicial, integração natural.",
    price: 150,
    icon: "inbox",
    thumbnail: "https://lh3.googleusercontent.com/aida-public/AB6AXuCYgJCmOb5oOkAnZnRkrPRfiiDqqAbmtQa5hxiJd43Z8717eMwkjlX_kjvuSpMou_DOm_3n6zpi-WuAXWZkGI6VGh9ZwTlRCVk31lIWCwHoLux071qrEkOMYWl4Yk7gJhFd5qw5M6XRsDGIEq0yORCb0KUN741RtrymB0aRXrQfXiliB0VF8axKV_pB8vN7ipzuCFnn_8tCRgMZgBCtBgiFDksoTvvBU_s1BmiSIwFTl9FZ1P-ZuIhgjJ9oLZgeeslGMcclIk0ejyc",
  },
  {
    id: 5,
    name: "Página dedicada",
    description: "Exibido na página de anúncios especiais, ideal para conteúdo detalhado.",
    price: 100,
    icon: "article",
    thumbnail: "https://lh3.googleusercontent.com/aida-public/AB6AXuBC3qUeAvLOo9SRKBpUHFb4xhTymhvj5UouWJZ2lLizk7JM7UrdVBeGZiI38lb3U1McVr_n7sF2cQ_CIXDh2FrTonKqHarUcpx62tFDO4UYSbt5YKRUR-Gw-kIY_nybKDDjwWInAbjTwSiiw8aknrUPtxjLOP1QPFrtuzeaeWJnYXFZOWCrEHLaScn6JTyv_Uq0sNEjQqR3blDqsdUIRA0Ppczo9_kTBN0wcI8DbKa6XLd7QzGcDlqL-scgUo2KERzjThELjnanPUk",
  },
];

export default function Advertise() {
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  const [clientCount, setClientCount] = useState(0);
  const [userAds, setUserAds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  // Purchase modal state
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<AdPosition | null>(null);
  const [adName, setAdName] = useState("");
  const [adUrl, setAdUrl] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser();

    // Fetch client count
    const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true });
    setClientCount(count || 0);

    if (user) {
      // Fetch balance
      const { data: profile } = await supabase.from("profiles").select("balance").eq("user_id", user.id).maybeSingle();
      if (profile) setBalance(profile.balance);

      // Fetch user ads
      const { data: ads } = await supabase.from("ads").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      setUserAds(ads || []);
    }

    setLoading(false);
  }

  const handleSelectPosition = (position: AdPosition) => {
    setSelectedPosition(position);
    setAdName("");
    setAdUrl("");
    setShowPurchaseModal(true);
  };

  const handlePurchase = async () => {
    if (!selectedPosition || !adName.trim()) {
      toast.error("Preencha o nome do anúncio.");
      return;
    }

    if (balance < selectedPosition.price) {
      toast.error("Saldo insuficiente. Adicione saldo na carteira.");
      return;
    }

    setPurchasing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      // Debit balance
      const newBalance = balance - selectedPosition.price;
      await supabase.from("profiles").update({ balance: newBalance }).eq("user_id", user.id);

      // Record wallet transaction
      await supabase.from("wallet_transactions").insert({
        user_id: user.id,
        amount: -selectedPosition.price,
        type: "debit",
        title: `Anúncio: ${selectedPosition.name}`,
        balance_after: newBalance,
      });

      // Create ad
      await supabase.from("ads").insert({
        user_id: user.id,
        position_name: selectedPosition.name,
        position_price: selectedPosition.price,
        name: adName.trim(),
        url: adUrl.trim() || null,
        status: "pending",
      });

      setBalance(newBalance);
      toast.success("Anúncio contratado com sucesso! Aguardando aprovação.");
      setShowPurchaseModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao contratar anúncio.");
    } finally {
      setPurchasing(false);
    }
  };

  const formatClientCount = (count: number) => {
    return count.toLocaleString("pt-BR");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-fade-in">
      {/* Alert Banner */}
      <div className="w-full bg-gradient-to-r from-orange-600 to-destructive rounded-lg p-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3 text-destructive-foreground">
          <span className="material-symbols-outlined">local_fire_department</span>
          <span className="font-medium text-sm sm:text-base">
            Espaço limitado! Reserve seu anúncio agora e alcance mais de {formatClientCount(clientCount)} clientes ativos.
          </span>
        </div>
        <button className="hidden sm:block bg-background text-destructive text-xs font-bold px-3 py-1.5 rounded hover:bg-muted transition-colors">
          Premium
        </button>
      </div>

      {/* Page Header */}
      <div className="text-center space-y-3 max-w-3xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground">Anuncie em nosso site</h1>
        <p className="text-muted-foreground text-lg">
          Promova seu negócio dentro da plataforma usando o saldo disponível. Escolha onde quer aparecer para ganhar mais visibilidade.
        </p>
      </div>

      {/* Balance Card */}
      <div className="glass-card rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground mb-1">Seu saldo disponível</p>
          <div className={`text-3xl font-bold tracking-tight ${balance > 0 ? "text-emerald-400" : "text-destructive"}`}>
            R$ {balance.toFixed(2).replace(".", ",")}
          </div>
        </div>
        <button
          onClick={() => navigate("/wallet")}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2.5 px-6 rounded-lg transition-all shadow-glow hover:-translate-y-0.5 flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-xl">add_circle</span>
          Adicionar saldo
        </button>
      </div>

      {/* Ad Positions */}
      <section>
        <div className="flex items-center gap-2 mb-6">
          <h2 className="text-xl font-bold text-foreground">Escolha onde seu anúncio vai aparecer</h2>
          <span className="material-symbols-outlined text-muted-foreground text-sm cursor-help" title="Saiba mais sobre os posicionamentos">
            info
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {adPositions.map((position) => (
            <div
              key={position.id}
              className="glass-card rounded-xl overflow-hidden group hover:border-primary/20 transition-all duration-300 flex flex-col"
            >
              <div className="h-32 bg-background relative overflow-hidden">
                <img
                  alt={position.name}
                  className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-500"
                  src={position.thumbnail}
                />
                <div className="absolute bottom-0 left-0 w-full p-3 bg-gradient-to-t from-black/80 to-transparent">
                  <span className="text-white font-bold text-sm">{position.name}</span>
                </div>
              </div>
              <div className="p-4 flex flex-col flex-grow">
                <div className="flex justify-between items-center mb-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <span className="material-symbols-outlined text-muted-foreground text-sm">{position.icon}</span>
                  </div>
                  <span className="text-primary font-bold">R$ {position.price}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-4 flex-grow leading-relaxed">
                  {position.description}
                </p>
                <button
                  onClick={() => handleSelectPosition(position)}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium py-2 rounded transition-colors"
                >
                  Selecionar
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* User Ads Table */}
      <section className="pb-12">
        <h2 className="text-xl font-bold text-foreground mb-6">Seus anúncios</h2>
        <div className="glass-card rounded-xl overflow-hidden">
          {userAds.length === 0 ? (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-[48px] text-muted-foreground mb-2">campaign</span>
              <p className="text-muted-foreground">Você ainda não contratou nenhum anúncio.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="p-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nome</th>
                    <th className="p-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Posição</th>
                    <th className="p-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground text-center">Status</th>
                    <th className="p-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Data</th>
                    <th className="p-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {userAds.map((ad) => (
                    <tr key={ad.id} className={`hover:bg-muted transition-colors ${ad.status === "finished" ? "opacity-75" : ""}`}>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded flex items-center justify-center bg-primary/10 text-primary shadow-md">
                            <span className="material-symbols-outlined text-sm">campaign</span>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-foreground">{ad.name}</div>
                            {ad.url && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{ad.url}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">{ad.position_name}</td>
                      <td className="p-4 text-center">
                        {ad.status === "active" ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                            Ativo
                          </span>
                        ) : ad.status === "pending" ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">
                            Pendente
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                            Finalizado
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {new Date(ad.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="p-4 text-sm text-foreground font-medium text-right">
                        R$ {Number(ad.position_price).toFixed(2).replace(".", ",")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Purchase Modal */}
      <AlertDialog open={showPurchaseModal} onOpenChange={setShowPurchaseModal}>
        <AlertDialogContent className="glass-panel border-border max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground text-lg">Contratar Anúncio</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Posição: <strong className="text-foreground">{selectedPosition?.name}</strong> — R$ {selectedPosition?.price.toFixed(2).replace(".", ",")}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nome do anúncio *</label>
              <input
                type="text"
                value={adName}
                onChange={(e) => setAdName(e.target.value)}
                placeholder="Ex: Promoção de Verão"
                className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">URL de destino (opcional)</label>
              <input
                type="url"
                value={adUrl}
                onChange={(e) => setAdUrl(e.target.value)}
                placeholder="https://exemplo.com"
                className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {selectedPosition && balance < selectedPosition.price && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-destructive text-xs">
                Saldo insuficiente. Você precisa de R$ {(selectedPosition.price - balance).toFixed(2).replace(".", ",")} a mais.
              </div>
            )}

            <div className="bg-muted/50 rounded-lg p-3 border border-border">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Seu saldo</span>
                <span className="text-foreground">R$ {balance.toFixed(2).replace(".", ",")}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Após contratação</span>
                <span className={`font-bold ${selectedPosition && balance >= selectedPosition.price ? "text-green-400" : "text-destructive"}`}>
                  R$ {selectedPosition ? Math.max(0, balance - selectedPosition.price).toFixed(2).replace(".", ",") : "0,00"}
                </span>
              </div>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel className="border-border text-muted-foreground hover:bg-muted">Cancelar</AlertDialogCancel>
            <button
              onClick={handlePurchase}
              disabled={purchasing || !adName.trim() || (selectedPosition ? balance < selectedPosition.price : true)}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {purchasing && <Loader2 className="size-4 animate-spin" />}
              Confirmar Compra
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
