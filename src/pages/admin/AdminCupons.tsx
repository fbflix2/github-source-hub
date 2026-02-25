import { useState, useEffect } from "react";
import {
  Plus,
  Search,
  TrendingUp,
  ArrowUp,
  Tag,
  Clock,
  PiggyBank,
  Copy,
  Edit,
  Pause,
  Trash2,
  Play,
  RotateCcw,
  Filter,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NovoCupomModal, type CouponData } from "@/components/admin/NovoCupomModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type FilterType = "all" | "active" | "expired" | "exhausted";

interface DbCoupon {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  description: string | null;
  max_uses: number;
  used_count: number;
  status: string;
  expires_at: string | null;
  created_at: string;
}

function getCouponDisplayStatus(coupon: DbCoupon): "active" | "expired" | "paused" | "almostFull" {
  if (coupon.status === "paused") return "paused";
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) return "expired";
  if (coupon.used_count >= coupon.max_uses) return "expired";
  if (coupon.status !== "active") return "expired";
  if (coupon.used_count / coupon.max_uses >= 0.9) return "almostFull";
  return "active";
}

function getDiscountLabel(coupon: DbCoupon) {
  if (coupon.discount_type === "percent") return `${coupon.discount_value}%`;
  return `R$ ${coupon.discount_value.toFixed(0)}`;
}

function getExpiresLabel(coupon: DbCoupon) {
  if (!coupon.expires_at) return { label: "Sem expiração", prefix: "" };
  const date = new Date(coupon.expires_at);
  const now = new Date();
  if (date < now) {
    return {
      label: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }),
      prefix: "Expirou em",
    };
  }
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return { label: "Hoje", prefix: "Expira" };
  if (diffDays === 1) return { label: "Amanhã", prefix: "Expira" };
  return {
    label: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }),
    prefix: "Expira em",
  };
}

const progressColors = [
  "from-primary to-orange-500",
  "from-emerald-500 to-teal-400",
  "from-orange-500 to-primary",
  "from-blue-500 to-cyan-400",
  "from-purple-500 to-pink-500",
  "from-yellow-500 to-amber-400",
];

export default function AdminCupons() {
  const [coupons, setCoupons] = useState<DbCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<CouponData | null>(null);

  const handleEdit = (coupon: DbCoupon) => {
    setEditingCoupon(coupon);
    setIsModalOpen(true);
  };

  const handleCloseModal = (open: boolean) => {
    setIsModalOpen(open);
    if (!open) setEditingCoupon(null);
  };

  const fetchCoupons = async () => {
    const { data, error } = await supabase
      .from("coupons")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching coupons:", error);
      toast.error("Erro ao carregar cupons");
    } else {
      setCoupons(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchCoupons(); }, []);

  const handleStatusChange = async (couponId: string, newStatus: string) => {
    const { error } = await supabase.from("coupons").update({ status: newStatus }).eq("id", couponId);
    if (error) { toast.error("Erro ao atualizar cupom"); return; }
    toast.success(newStatus === "active" ? "Cupom ativado!" : newStatus === "paused" ? "Cupom pausado!" : "Status atualizado!");
    fetchCoupons();
  };

  const handleDelete = async (couponId: string) => {
    const { error } = await supabase.from("coupons").delete().eq("id", couponId);
    if (error) { toast.error("Erro ao excluir cupom"); return; }
    toast.success("Cupom excluído!");
    fetchCoupons();
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Código copiado!");
  };

  // Stats
  const activeCoupons = coupons.filter(c => getCouponDisplayStatus(c) === "active" || getCouponDisplayStatus(c) === "almostFull").length;
  const expiredCoupons = coupons.filter(c => getCouponDisplayStatus(c) === "expired").length;

  // Filter
  const filteredCoupons = coupons.filter((coupon) => {
    const matchesSearch = coupon.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (coupon.description || "").toLowerCase().includes(searchTerm.toLowerCase());
    const displayStatus = getCouponDisplayStatus(coupon);

    switch (activeFilter) {
      case "active": return matchesSearch && (displayStatus === "active" || displayStatus === "almostFull");
      case "expired": return matchesSearch && displayStatus === "expired";
      case "exhausted": return matchesSearch && coupon.used_count >= coupon.max_uses;
      default: return matchesSearch;
    }
  });

  const filters: { key: FilterType; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "active", label: "Ativos" },
    { key: "expired", label: "Expirados" },
    { key: "exhausted", label: "Esgotados" },
  ];

  const getStatusBadge = (status: ReturnType<typeof getCouponDisplayStatus>) => {
    switch (status) {
      case "active":
        return (
          <span className="text-xs text-emerald-400 font-medium mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Ativo
          </span>
        );
      case "almostFull":
        return (
          <span className="text-xs text-orange-400 font-medium mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
            Últimas vagas
          </span>
        );
      case "paused":
        return (
          <span className="text-xs text-yellow-500 font-medium mt-1 flex items-center gap-1">
            <Pause className="w-3 h-3" />
            Pausado
          </span>
        );
      case "expired":
        return (
          <span className="text-xs text-white/40 font-medium mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
            Expirado
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 py-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white mb-1">Dashboard de Cupons</h1>
          <p className="text-white/40 text-sm font-medium">Gerencie suas campanhas de desconto</p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-primary hover:bg-red-600 text-white px-6 py-3 h-auto rounded-xl font-bold shadow-[0_0_20px_rgba(249,6,6,0.3)] hover:shadow-[0_0_30px_rgba(249,6,6,0.5)]"
        >
          <Plus className="w-5 h-5" />
          <span>Novo Cupom</span>
        </Button>
      </header>

      <NovoCupomModal open={isModalOpen} onOpenChange={handleCloseModal} onCreated={fetchCoupons} editCoupon={editingCoupon} />

      {/* Metrics */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 flex items-start justify-between relative overflow-hidden group">
          <div className="relative z-10">
            <p className="text-white/60 text-sm font-medium mb-1">Cupons Ativos</p>
            <h3 className="text-3xl font-bold tracking-tight text-white">{activeCoupons}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-white/80">
            <Tag className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 flex items-start justify-between relative overflow-hidden group">
          <div className="relative z-10">
            <p className="text-white/60 text-sm font-medium mb-1">Expirados / Esgotados</p>
            <h3 className="text-3xl font-bold tracking-tight text-white">{expiredCoupons}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-white/80">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 flex items-start justify-between relative overflow-hidden group">
          <div className="relative z-10">
            <p className="text-white/60 text-sm font-medium mb-1">Total de Cupons</p>
            <h3 className="text-3xl font-bold tracking-tight text-white">{coupons.length}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-white/80">
            <PiggyBank className="w-5 h-5" />
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] p-2 rounded-2xl">
        <div className="relative w-full lg:max-w-md group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="w-5 h-5 text-white/40 group-focus-within:text-primary transition-colors" />
          </div>
          <Input
            type="text"
            placeholder="Pesquisar por nome ou código do cupom..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3 py-3 bg-transparent border-transparent focus:border-transparent focus-visible:ring-0 text-white placeholder:text-white/30 text-sm font-medium"
          />
        </div>
        <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0 px-2">
          {filters.map((filter) => (
            <button
              key={filter.key}
              onClick={() => setActiveFilter(filter.key)}
              className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                activeFilter === filter.key
                  ? "bg-primary text-white shadow-lg shadow-primary/20"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </section>

      {/* Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {filteredCoupons.length === 0 ? (
          <div className="col-span-full text-center py-16">
            <Tag className="w-10 h-10 text-white/20 mx-auto mb-3" />
            <p className="text-white/40 text-sm">Nenhum cupom encontrado.</p>
          </div>
        ) : (
          filteredCoupons.map((coupon, index) => {
            const displayStatus = getCouponDisplayStatus(coupon);
            const percentage = Math.round((coupon.used_count / coupon.max_uses) * 100);
            const isExpired = displayStatus === "expired";
            const isPaused = displayStatus === "paused";
            const expiresInfo = getExpiresLabel(coupon);
            const colorClass = progressColors[index % progressColors.length];

            return (
              <div
                key={coupon.id}
                className={`bg-gradient-to-br from-white/5 to-white/[0.01] backdrop-blur-xl border border-white/5 rounded-2xl p-5 flex flex-col gap-4 relative group transition-all hover:from-white/[0.08] hover:to-white/[0.02] hover:border-primary/30 hover:-translate-y-0.5 hover:shadow-[0_10px_40px_-10px_rgba(249,6,6,0.1)] ${
                  isExpired ? "opacity-70 hover:opacity-100" : ""
                }`}
              >
                {!isExpired && (
                  <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-full -mr-4 -mt-4 blur-xl transition-opacity opacity-50 group-hover:opacity-100" />
                )}

                {/* Header */}
                <div className="flex justify-between items-start z-10">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className={`font-mono font-bold text-lg tracking-wider ${isExpired ? "text-white/60 line-through decoration-primary decoration-2" : "text-white"}`}>
                        {coupon.code}
                      </span>
                      {!isExpired && (
                        <button onClick={() => handleCopyCode(coupon.code)} className="text-white/30 hover:text-white transition-colors" title="Copiar">
                          <Copy className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {getStatusBadge(displayStatus)}
                  </div>
                  <div className="w-10 h-10 rounded-full bg-white/5 border border-white/5 flex items-center justify-center">
                    <Tag className={`w-5 h-5 ${isExpired ? "text-white/30" : "text-white/60"}`} />
                  </div>
                </div>

                {/* Discount */}
                <div className={`py-2 ${isExpired ? "grayscale" : ""}`}>
                  <span className={`block text-4xl font-black ${isExpired ? "text-white/50" : "text-white"}`}>
                    {getDiscountLabel(coupon)}{" "}
                    <span className={isExpired ? "text-white/30" : "text-primary"}>OFF</span>
                  </span>
                  <span className={`text-xs font-medium uppercase tracking-wide ${isExpired ? "text-white/20" : "text-white/40"}`}>
                    {coupon.description || "Sem descrição"}
                  </span>
                </div>

                {/* Progress */}
                <div className="flex flex-col gap-2">
                  <div className={`flex justify-between text-xs mb-1 ${isExpired ? "text-white/30" : "text-white/60"}`}>
                    <span>Usos: {coupon.used_count}/{coupon.max_uses}</span>
                    <span className={displayStatus === "almostFull" ? "text-orange-400 font-bold" : ""}>{percentage}%</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-1.5 rounded-full ${isExpired ? "bg-white/20" : isPaused ? "bg-yellow-600/50" : `bg-gradient-to-r ${colorClass}`}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="pt-4 mt-auto border-t border-white/5 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className={`text-[10px] uppercase font-bold tracking-wider ${isExpired ? "text-white/20" : "text-white/40"}`}>
                      {expiresInfo.prefix}
                    </span>
                    <span className={`text-xs font-medium ${isExpired ? "text-white/40" : "text-white"}`}>
                      {expiresInfo.label}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {isExpired ? (
                      <>
                        <button onClick={() => handleStatusChange(coupon.id, "active")} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors" title="Reativar">
                          <RotateCcw className="w-5 h-5" />
                        </button>
                        <button onClick={() => handleDelete(coupon.id)} className="p-2 rounded-lg hover:bg-primary/20 text-white/60 hover:text-primary transition-colors" title="Excluir">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </>
                    ) : isPaused ? (
                      <>
                        <button onClick={() => handleStatusChange(coupon.id, "active")} className="p-2 rounded-lg bg-white/5 hover:bg-emerald-500/20 text-white/60 hover:text-emerald-400 transition-colors" title="Ativar">
                          <Play className="w-5 h-5" />
                        </button>
                        <button onClick={() => handleDelete(coupon.id)} className="p-2 rounded-lg hover:bg-primary/20 text-white/60 hover:text-primary transition-colors" title="Excluir">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleEdit(coupon)} className="p-2 rounded-lg bg-white/5 hover:bg-blue-500/20 text-white/60 hover:text-blue-400 transition-colors" title="Editar">
                          <Edit className="w-5 h-5" />
                        </button>
                        <button onClick={() => handleStatusChange(coupon.id, "paused")} className="p-2 rounded-lg bg-white/5 hover:bg-yellow-500/20 text-white/60 hover:text-yellow-400 transition-colors" title="Pausar">
                          <Pause className="w-5 h-5" />
                        </button>
                        <button onClick={() => handleDelete(coupon.id)} className="p-2 rounded-lg hover:bg-primary/20 text-white/60 hover:text-primary transition-colors" title="Excluir">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
