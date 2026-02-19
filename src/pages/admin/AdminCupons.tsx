import { useState } from "react";
import {
  Plus,
  Search,
  TrendingUp,
  ArrowUp,
  Tag,
  Clock,
  PiggyBank,
  Copy,
  Star,
  Zap,
  CalendarX,
  Handshake,
  Diamond,
  Edit,
  Pause,
  Trash2,
  Play,
  RotateCcw,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NovoCupomModal } from "@/components/admin/NovoCupomModal";

type CouponStatus = "active" | "expired" | "paused" | "almostFull";
type FilterType = "all" | "active" | "expired" | "exhausted";

interface Coupon {
  id: string;
  code: string;
  discount: string;
  discountType: "percent" | "fixed" | "free";
  description: string;
  usedCount: number;
  maxUses: number;
  status: CouponStatus;
  expiresAt: string;
  expiresLabel: string;
  icon: "tag" | "star" | "bolt" | "calendar" | "handshake" | "diamond";
  progressColor: string;
}

const mockCoupons: Coupon[] = [
  {
    id: "1",
    code: "SUMMER2024",
    discount: "20%",
    discountType: "percent",
    description: "Desconto em Assinaturas",
    usedCount: 45,
    maxUses: 100,
    status: "active",
    expiresAt: "20 Dez 2024",
    expiresLabel: "Expira em",
    icon: "tag",
    progressColor: "from-primary to-orange-500",
  },
  {
    id: "2",
    code: "WELCOME50",
    discount: "R$ 50",
    discountType: "fixed",
    description: "Primeira Compra",
    usedCount: 890,
    maxUses: 1000,
    status: "active",
    expiresAt: "01 Jan 2025",
    expiresLabel: "Expira em",
    icon: "star",
    progressColor: "from-emerald-500 to-teal-400",
  },
  {
    id: "3",
    code: "BLACKFRIDAY",
    discount: "50%",
    discountType: "percent",
    description: "Plano Anual",
    usedCount: 48,
    maxUses: 50,
    status: "almostFull",
    expiresAt: "Amanhã",
    expiresLabel: "Expira em",
    icon: "bolt",
    progressColor: "from-orange-500 to-primary",
  },
  {
    id: "4",
    code: "TESTE2023",
    discount: "10%",
    discountType: "percent",
    description: "Qualquer plano",
    usedCount: 120,
    maxUses: 120,
    status: "expired",
    expiresAt: "10 Out 2023",
    expiresLabel: "Expirou em",
    icon: "calendar",
    progressColor: "bg-white/20",
  },
  {
    id: "5",
    code: "PARTNER15",
    discount: "15%",
    discountType: "percent",
    description: "Parceiros",
    usedCount: 12,
    maxUses: 500,
    status: "paused",
    expiresAt: "30 Jun 2025",
    expiresLabel: "Expira em",
    icon: "handshake",
    progressColor: "bg-yellow-600/50",
  },
  {
    id: "6",
    code: "VIPSECRET",
    discount: "100%",
    discountType: "free",
    description: "1 Mês Grátis",
    usedCount: 5,
    maxUses: 10,
    status: "active",
    expiresAt: "31 Dez 2024",
    expiresLabel: "Expira em",
    icon: "diamond",
    progressColor: "from-purple-500 to-pink-500",
  },
];

const getIconComponent = (iconType: Coupon["icon"]) => {
  switch (iconType) {
    case "tag":
      return Tag;
    case "star":
      return Star;
    case "bolt":
      return Zap;
    case "calendar":
      return CalendarX;
    case "handshake":
      return Handshake;
    case "diamond":
      return Diamond;
    default:
      return Tag;
  }
};

export default function AdminCupons() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const getStatusBadge = (status: CouponStatus) => {
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

  const filteredCoupons = mockCoupons.filter((coupon) => {
    const matchesSearch = coupon.code
      .toLowerCase()
      .includes(searchTerm.toLowerCase());

    switch (activeFilter) {
      case "active":
        return matchesSearch && (coupon.status === "active" || coupon.status === "almostFull");
      case "expired":
        return matchesSearch && coupon.status === "expired";
      case "exhausted":
        return matchesSearch && coupon.usedCount >= coupon.maxUses;
      default:
        return matchesSearch;
    }
  });

  const filters: { key: FilterType; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "active", label: "Ativos" },
    { key: "expired", label: "Expirados" },
    { key: "exhausted", label: "Esgotados" },
  ];

  return (
    <div className="flex flex-col gap-8 py-6">
      {/* Header Section */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white mb-1">
            Dashboard de Cupons
          </h1>
          <p className="text-white/40 text-sm font-medium">
            Gerencie suas campanhas de desconto
          </p>
        </div>
        <Button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-primary hover:bg-red-600 text-white px-6 py-3 h-auto rounded-xl font-bold shadow-[0_0_20px_rgba(249,6,6,0.3)] hover:shadow-[0_0_30px_rgba(249,6,6,0.5)]"
        >
          <Plus className="w-5 h-5" />
          <span>Novo Cupom</span>
        </Button>
      </header>

      {/* Modal Novo Cupom */}
      <NovoCupomModal open={isModalOpen} onOpenChange={setIsModalOpen} />

      {/* Metrics Section */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {/* Card 1 - Cupons Ativos */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 flex items-start justify-between relative overflow-hidden group">
          <div className="relative z-10">
            <p className="text-white/60 text-sm font-medium mb-1">Cupons Ativos</p>
            <h3 className="text-3xl font-bold tracking-tight text-white">12</h3>
            <div className="flex items-center gap-1 mt-2 text-emerald-400 text-xs font-semibold bg-emerald-400/10 w-fit px-2 py-1 rounded-lg">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+2 novos hoje</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-white/80 group-hover:bg-primary group-hover:text-white transition-colors duration-300">
            <Tag className="w-5 h-5" />
          </div>
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-gradient-to-br from-emerald-500/20 to-transparent blur-2xl rounded-full" />
        </div>

        {/* Card 2 - Cupons Expirados */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 flex items-start justify-between relative overflow-hidden group">
          <div className="relative z-10">
            <p className="text-white/60 text-sm font-medium mb-1">Cupons Expirados</p>
            <h3 className="text-3xl font-bold tracking-tight text-white">45</h3>
            <div className="flex items-center gap-1 mt-2 text-white/40 text-xs font-semibold bg-white/5 w-fit px-2 py-1 rounded-lg">
              <span>Arquivo histórico</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-white/80 group-hover:bg-white/20 transition-colors duration-300">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3 - Total de Descontos */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 flex items-start justify-between relative overflow-hidden group">
          <div className="relative z-10">
            <p className="text-white/60 text-sm font-medium mb-1">Total de Descontos</p>
            <h3 className="text-3xl font-bold tracking-tight text-white">R$ 12.500</h3>
            <div className="flex items-center gap-1 mt-2 text-primary text-xs font-semibold bg-primary/10 w-fit px-2 py-1 rounded-lg">
              <ArrowUp className="w-3.5 h-3.5" />
              <span>15% esse mês</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-white/80 group-hover:bg-primary group-hover:text-white transition-colors duration-300">
            <PiggyBank className="w-5 h-5" />
          </div>
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-gradient-to-br from-primary/20 to-transparent blur-2xl rounded-full" />
        </div>
      </section>

      {/* Filters & Search */}
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
          <div className="h-6 w-px bg-white/10 mx-2" />
          <button className="whitespace-nowrap flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors">
            <Filter className="w-4 h-4" />
            <span>Filtros</span>
          </button>
        </div>
      </section>

      {/* Coupon Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {filteredCoupons.map((coupon) => {
          const IconComponent = getIconComponent(coupon.icon);
          const percentage = Math.round((coupon.usedCount / coupon.maxUses) * 100);
          const isExpired = coupon.status === "expired";
          const isPaused = coupon.status === "paused";

          return (
            <div
              key={coupon.id}
              className={`bg-gradient-to-br from-white/5 to-white/[0.01] backdrop-blur-xl border border-white/5 rounded-2xl p-5 flex flex-col gap-4 relative group transition-all hover:from-white/[0.08] hover:to-white/[0.02] hover:border-primary/30 hover:-translate-y-0.5 hover:shadow-[0_10px_40px_-10px_rgba(249,6,6,0.1)] ${
                isExpired ? "opacity-70 hover:opacity-100" : ""
              }`}
            >
              {/* Glow effect */}
              {!isExpired && (
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-full -mr-4 -mt-4 blur-xl transition-opacity opacity-50 group-hover:opacity-100" />
              )}

              {/* Header */}
              <div className="flex justify-between items-start z-10">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono font-bold text-lg tracking-wider ${
                        isExpired
                          ? "text-white/60 line-through decoration-primary decoration-2"
                          : "text-white"
                      }`}
                    >
                      {coupon.code}
                    </span>
                    {!isExpired && (
                      <button
                        className="text-white/30 hover:text-white transition-colors"
                        title="Copiar"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {getStatusBadge(coupon.status)}
                </div>
                <div className="w-10 h-10 rounded-full bg-white/5 border border-white/5 flex items-center justify-center">
                  <IconComponent
                    className={`w-5 h-5 ${isExpired ? "text-white/30" : "text-white/60"}`}
                  />
                </div>
              </div>

              {/* Discount */}
              <div className={`py-2 ${isExpired ? "grayscale" : ""}`}>
                <span
                  className={`block text-4xl font-black ${
                    isExpired ? "text-white/50" : "text-white"
                  } drop-shadow-[0_0_10px_rgba(0,0,0,0.5)]`}
                >
                  {coupon.discount}{" "}
                  <span
                    className={`${
                      isExpired
                        ? "text-white/30"
                        : coupon.discountType === "free"
                        ? "text-primary text-2xl font-bold align-top"
                        : "text-primary"
                    }`}
                  >
                    {coupon.discountType === "free" ? "FREE" : "OFF"}
                  </span>
                </span>
                <span
                  className={`text-xs font-medium uppercase tracking-wide ${
                    isExpired ? "text-white/20" : "text-white/40"
                  }`}
                >
                  {coupon.description}
                </span>
              </div>

              {/* Progress */}
              <div className="flex flex-col gap-2">
                <div
                  className={`flex justify-between text-xs mb-1 ${
                    isExpired ? "text-white/30" : "text-white/60"
                  }`}
                >
                  <span>
                    Usos: {coupon.usedCount}/{coupon.maxUses}
                  </span>
                  <span
                    className={
                      coupon.status === "almostFull"
                        ? "text-orange-400 font-bold"
                        : ""
                    }
                  >
                    {percentage}%
                  </span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full ${
                      isExpired
                        ? "bg-white/20"
                        : isPaused
                        ? "bg-yellow-600/50"
                        : `bg-gradient-to-r ${coupon.progressColor}`
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="pt-4 mt-auto border-t border-white/5 flex items-center justify-between">
                <div className="flex flex-col">
                  <span
                    className={`text-[10px] uppercase font-bold tracking-wider ${
                      isExpired ? "text-white/20" : "text-white/40"
                    }`}
                  >
                    {coupon.expiresLabel}
                  </span>
                  <span
                    className={`text-xs font-medium ${
                      isExpired ? "text-white/40" : "text-white"
                    }`}
                  >
                    {coupon.expiresAt}
                  </span>
                </div>
                <div className="flex gap-1">
                  {isExpired ? (
                    <>
                      <button
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                        title="Reativar"
                      >
                        <RotateCcw className="w-5 h-5" />
                      </button>
                      <button className="p-2 rounded-lg hover:bg-primary/20 text-white/60 hover:text-primary transition-colors">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </>
                  ) : isPaused ? (
                    <>
                      <button className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors">
                        <Edit className="w-5 h-5" />
                      </button>
                      <button className="p-2 rounded-lg bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 transition-colors">
                        <Play className="w-5 h-5" />
                      </button>
                      <button className="p-2 rounded-lg hover:bg-primary/20 text-white/60 hover:text-primary transition-colors">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors">
                        <Edit className="w-5 h-5" />
                      </button>
                      <button className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors">
                        <Pause className="w-5 h-5" />
                      </button>
                      <button className="p-2 rounded-lg hover:bg-primary/20 text-white/60 hover:text-primary transition-colors">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
