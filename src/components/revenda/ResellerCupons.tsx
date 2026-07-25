import { useState, useEffect } from "react";
import {
  Plus, Search, Tag, Clock, PiggyBank, Copy, Edit, Pause, Trash2, Play, RotateCcw, Loader2,
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
  product_id: string | null;
  reseller_id: string | null;
}

function getCouponDisplayStatus(coupon: DbCoupon): "active" | "expired" | "paused" | "almostFull" {
  if (coupon.status === "paused") return "paused";
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) return "expired";
  if (coupon.used_count >= coupon.max_uses) return "expired";
  if (coupon.status !== "active") return "expired";
  if (coupon.used_count / coupon.max_uses >= 0.9) return "almostFull";
  return "active";
}

function getDiscountLabel(c: DbCoupon) {
  return c.discount_type === "percent" ? `${c.discount_value}%` : `R$ ${c.discount_value.toFixed(0)}`;
}

function getExpiresLabel(c: DbCoupon) {
  if (!c.expires_at) return { label: "Sem expiração", prefix: "" };
  const date = new Date(c.expires_at);
  const now = new Date();
  if (date < now) return { label: date.toLocaleDateString("pt-BR"), prefix: "Expirou em" };
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / 86400000);
  if (diffDays === 0) return { label: "Hoje", prefix: "Expira" };
  if (diffDays === 1) return { label: "Amanhã", prefix: "Expira" };
  return { label: date.toLocaleDateString("pt-BR"), prefix: "Expira em" };
}

const progressColors = [
  "from-emerald-500 to-teal-400",
  "from-blue-500 to-cyan-400",
  "from-primary to-red-500",
  "from-purple-500 to-pink-500",
];

export default function ResellerCupons({ resellerId }: { resellerId: string }) {
  const [coupons, setCoupons] = useState<DbCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<CouponData | null>(null);

  const fetchCoupons = async () => {
    const { data, error } = await supabase
      .from("coupons")
      .select("*")
      .eq("reseller_id", resellerId)
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar cupons");
    else setCoupons((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchCoupons(); /* eslint-disable-next-line */ }, [resellerId]);

  const handleEdit = (c: DbCoupon) => { setEditingCoupon(c); setIsModalOpen(true); };
  const handleCloseModal = (open: boolean) => { setIsModalOpen(open); if (!open) setEditingCoupon(null); };
  const handleStatusChange = async (id: string, s: string) => {
    const { error } = await supabase.from("coupons").update({ status: s }).eq("id", id).eq("reseller_id", resellerId);
    if (error) return toast.error("Erro ao atualizar");
    toast.success(s === "active" ? "Cupom ativado!" : s === "paused" ? "Cupom pausado!" : "Atualizado!");
    fetchCoupons();
  };
  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("coupons").delete().eq("id", id).eq("reseller_id", resellerId);
    if (error) return toast.error("Erro ao excluir");
    toast.success("Cupom excluído!");
    fetchCoupons();
  };
  const handleCopyCode = (code: string) => { navigator.clipboard.writeText(code); toast.success("Código copiado!"); };

  const activeCount = coupons.filter(c => ["active", "almostFull"].includes(getCouponDisplayStatus(c))).length;
  const expiredCount = coupons.filter(c => getCouponDisplayStatus(c) === "expired").length;

  const filtered = coupons.filter((c) => {
    const s = getCouponDisplayStatus(c);
    const match = c.code.toLowerCase().includes(searchTerm.toLowerCase()) || (c.description || "").toLowerCase().includes(searchTerm.toLowerCase());
    if (activeFilter === "active") return match && (s === "active" || s === "almostFull");
    if (activeFilter === "expired") return match && s === "expired";
    if (activeFilter === "exhausted") return match && c.used_count >= c.max_uses;
    return match;
  });

  const filters: { key: FilterType; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "active", label: "Ativos" },
    { key: "expired", label: "Expirados" },
    { key: "exhausted", label: "Esgotados" },
  ];

  const getStatusBadge = (s: ReturnType<typeof getCouponDisplayStatus>) => {
    if (s === "active") return <span className="text-xs text-emerald-400 font-medium mt-1 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Ativo</span>;
    if (s === "almostFull") return <span className="text-xs text-orange-400 font-medium mt-1 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-orange-400" />Últimas vagas</span>;
    if (s === "paused") return <span className="text-xs text-yellow-500 font-medium mt-1 flex items-center gap-1"><Pause className="w-3 h-3" />Pausado</span>;
    return <span className="text-xs text-white/40 font-medium mt-1 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-white/20" />Expirado</span>;
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="size-8 text-primary animate-spin" /></div>;

  return (
    <div className="flex flex-col gap-8 py-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white mb-1">Cupons de Desconto</h1>
          <p className="text-white/40 text-sm font-medium">Crie e gerencie cupons exclusivos para os seus clientes</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-primary hover:bg-primary/80 text-primary-foreground px-6 py-3 h-auto rounded-xl font-bold">
          <Plus className="w-5 h-5" /><span>Novo Cupom</span>
        </Button>
      </header>

      <NovoCupomModal open={isModalOpen} onOpenChange={handleCloseModal} onCreated={fetchCoupons} editCoupon={editingCoupon} resellerId={resellerId} />

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 flex items-start justify-between">
          <div><p className="text-white/60 text-sm font-medium mb-1">Cupons Ativos</p><h3 className="text-3xl font-bold text-white">{activeCount}</h3></div>
          <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center"><Tag className="w-5 h-5 text-white/80" /></div>
        </div>
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 flex items-start justify-between">
          <div><p className="text-white/60 text-sm font-medium mb-1">Expirados / Esgotados</p><h3 className="text-3xl font-bold text-white">{expiredCount}</h3></div>
          <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center"><Clock className="w-5 h-5 text-white/80" /></div>
        </div>
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 flex items-start justify-between">
          <div><p className="text-white/60 text-sm font-medium mb-1">Total de Cupons</p><h3 className="text-3xl font-bold text-white">{coupons.length}</h3></div>
          <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center"><PiggyBank className="w-5 h-5 text-white/80" /></div>
        </div>
      </section>

      <section className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] p-2 rounded-2xl">
        <div className="relative w-full lg:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
          <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Pesquisar cupom..." className="w-full pl-10 bg-transparent border-transparent focus-visible:ring-0 text-white placeholder:text-white/30 text-sm" />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto px-2">
          {filters.map((f) => (
            <button key={f.key} onClick={() => setActiveFilter(f.key)} className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${activeFilter === f.key ? "bg-primary text-primary-foreground" : "text-white/60 hover:text-white hover:bg-white/5"}`}>{f.label}</button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {filtered.length === 0 ? (
          <div className="col-span-full text-center py-16">
            <Tag className="w-10 h-10 text-white/20 mx-auto mb-3" />
            <p className="text-white/40 text-sm">Nenhum cupom encontrado. Crie o primeiro!</p>
          </div>
        ) : filtered.map((c, i) => {
          const s = getCouponDisplayStatus(c);
          const pct = Math.round((c.used_count / c.max_uses) * 100);
          const isExpired = s === "expired"; const isPaused = s === "paused";
          const exp = getExpiresLabel(c); const color = progressColors[i % progressColors.length];
          return (
            <div key={c.id} className={`bg-gradient-to-br from-white/5 to-white/[0.01] backdrop-blur-xl border border-white/5 rounded-2xl p-5 flex flex-col gap-4 relative group transition-all hover:border-primary/30 hover:-translate-y-0.5 ${isExpired ? "opacity-70 hover:opacity-100" : ""}`}>
              <div className="flex justify-between items-start">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className={`font-mono font-bold text-lg tracking-wider ${isExpired ? "text-white/60 line-through" : "text-white"}`}>{c.code}</span>
                    {!isExpired && <button onClick={() => handleCopyCode(c.code)} className="text-white/30 hover:text-white"><Copy className="w-4 h-4" /></button>}
                  </div>
                  {getStatusBadge(s)}
                </div>
                <div className="w-10 h-10 rounded-full bg-white/5 border border-white/5 flex items-center justify-center"><Tag className="w-5 h-5 text-white/60" /></div>
              </div>
              <div className="py-2">
                <span className={`block text-4xl font-black ${isExpired ? "text-white/50" : "text-white"}`}>{getDiscountLabel(c)} <span className={isExpired ? "text-white/30" : "text-primary"}>OFF</span></span>
                <span className={`text-xs font-medium uppercase tracking-wide ${isExpired ? "text-white/20" : "text-white/40"}`}>{c.description || "Sem descrição"}</span>
              </div>
              <div className="flex flex-col gap-2">
                <div className={`flex justify-between text-xs mb-1 ${isExpired ? "text-white/30" : "text-white/60"}`}>
                  <span>Usos: {c.used_count}/{c.max_uses}</span><span>{pct}%</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                  <div className={`h-1.5 rounded-full ${isExpired ? "bg-white/20" : isPaused ? "bg-yellow-600/50" : `bg-gradient-to-r ${color}`}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className="pt-4 mt-auto border-t border-white/5 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className={`text-[10px] uppercase font-bold tracking-wider ${isExpired ? "text-white/20" : "text-white/40"}`}>{exp.prefix}</span>
                  <span className={`text-xs font-medium ${isExpired ? "text-white/40" : "text-white"}`}>{exp.label}</span>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleEdit(c)} className="p-2 rounded-lg bg-white/5 hover:bg-blue-500/20 text-white/60 hover:text-blue-400" title="Editar"><Edit className="w-5 h-5" /></button>
                  {isExpired ? (
                    <button onClick={() => handleStatusChange(c.id, "active")} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white" title="Reativar"><RotateCcw className="w-5 h-5" /></button>
                  ) : isPaused ? (
                    <button onClick={() => handleStatusChange(c.id, "active")} className="p-2 rounded-lg bg-white/5 hover:bg-emerald-500/20 text-white/60 hover:text-emerald-400" title="Ativar"><Play className="w-5 h-5" /></button>
                  ) : (
                    <button onClick={() => handleStatusChange(c.id, "paused")} className="p-2 rounded-lg bg-white/5 hover:bg-yellow-500/20 text-white/60 hover:text-yellow-400" title="Pausar"><Pause className="w-5 h-5" /></button>
                  )}
                  <button onClick={() => handleDelete(c.id)} className="p-2 rounded-lg hover:bg-primary/20 text-white/60 hover:text-primary" title="Excluir"><Trash2 className="w-5 h-5" /></button>
                </div>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}