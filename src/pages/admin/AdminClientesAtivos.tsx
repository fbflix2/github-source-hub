import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Crown, TrendingUp, ShoppingBag, Star, Loader2, Users, ChevronDown, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface TopClient {
  rank: number;
  userId: string;
  name: string;
  avatar: string | null;
  totalSpent: number;
  orderCount: number;
}

interface OrderDetail {
  id: string;
  code: string;
  total: number;
  status: string;
  created_at: string;
  items: { name: string; quantity: number; price: number }[];
}

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const rankBadgeColors: Record<number, string> = {
  1: "bg-yellow-500 text-black",
  2: "bg-gray-400 text-black",
  3: "bg-amber-700 text-white",
};

const rankRowColors: Record<number, string> = {
  1: "bg-gradient-to-r from-yellow-500/15 to-transparent",
  2: "bg-gradient-to-r from-gray-400/10 to-transparent",
  3: "bg-gradient-to-r from-amber-700/10 to-transparent",
};

const PERIOD_OPTIONS = [
  { label: "7 dias", value: 7 },
  { label: "30 dias", value: 30 },
  { label: "60 dias", value: 60 },
  { label: "90 dias", value: 90 },
];

export default function AdminClientesAtivos() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [topClients, setTopClients] = useState<TopClient[]>([]);
  const [otherClients, setOtherClients] = useState<TopClient[]>([]);
  const [totalActive, setTotalActive] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [userOrders, setUserOrders] = useState<OrderDetail[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [days, setDays] = useState(30);

  useEffect(() => { fetchData(); }, [days]);

  const fetchData = async () => {
    setLoading(true);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: orders } = await supabase
      .from("orders")
      .select("user_id, total, status")
      .in("status", ["completed", "delivered"])
      .gte("created_at", thirtyDaysAgo.toISOString());

    const allOrders = orders || [];
    const userMap: Record<string, { total: number; count: number }> = {};
    for (const o of allOrders) {
      if (!userMap[o.user_id]) userMap[o.user_id] = { total: 0, count: 0 };
      userMap[o.user_id].total += Number(o.total);
      userMap[o.user_id].count += 1;
    }

    const sortedUsers = Object.entries(userMap)
      .sort((a, b) => b[1].total - a[1].total);

    const allUserIds = sortedUsers.map(([uid]) => uid);
    let profileMap: Record<string, { name: string; avatar: string | null }> = {};
    
    // Fetch profiles in batches (supabase .in() limit)
    for (let i = 0; i < allUserIds.length; i += 50) {
      const batch = allUserIds.slice(i, i + 50);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", batch);
      for (const p of profiles || []) {
        profileMap[p.user_id] = { name: p.full_name || "Sem nome", avatar: p.avatar_url };
      }
    }

    const allMapped = sortedUsers.map(([uid, data], idx) => ({
      rank: idx + 1,
      userId: uid,
      name: profileMap[uid]?.name || "Sem nome",
      avatar: profileMap[uid]?.avatar || null,
      totalSpent: data.total,
      orderCount: data.count,
    }));

    setTopClients(allMapped.slice(0, 10));
    setOtherClients(allMapped.slice(10));
    setTotalActive(Object.keys(userMap).length);
    setTotalRevenue(allOrders.reduce((s, o) => s + Number(o.total), 0));
    setLoading(false);
  };

  const toggleExpand = async (userId: string) => {
    if (expandedUser === userId) {
      setExpandedUser(null);
      return;
    }
    setExpandedUser(userId);
    setLoadingOrders(true);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: orders } = await supabase
      .from("orders")
      .select("id, code, total, status, created_at")
      .eq("user_id", userId)
      .in("status", ["completed", "delivered"])
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("created_at", { ascending: false });

    const orderList: OrderDetail[] = [];
    for (const o of orders || []) {
      const { data: items } = await supabase
        .from("order_items")
        .select("name, quantity, price")
        .eq("order_id", o.id);
      orderList.push({ ...o, total: Number(o.total), items: (items || []).map(i => ({ ...i, price: Number(i.price) })) });
    }

    setUserOrders(orderList);
    setLoadingOrders(false);
  };

  const getInitials = (name: string) =>
    name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();

  return (
    <div className="flex flex-col gap-4 pt-4 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate("/admin/clientes")}
          className="border-white/10 text-white/70 hover:text-white hover:bg-white/10 rounded-lg shrink-0 size-9"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <Crown className="w-6 h-6 text-yellow-500" />
            Clientes Ativos
          </h1>
          <p className="text-white/40 text-xs">Top consumidores nos últimos 30 dias</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[rgba(30,15,15,0.4)] backdrop-blur-xl border border-white/[0.08] p-3 rounded-xl flex items-center gap-3">
          <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium">Ativos</p>
            <p className="text-lg font-black text-white leading-tight">{loading ? "..." : totalActive}</p>
          </div>
        </div>
        <div className="bg-[rgba(30,15,15,0.4)] backdrop-blur-xl border border-white/[0.08] p-3 rounded-xl flex items-center gap-3">
          <div className="size-9 rounded-lg bg-green-500/10 flex items-center justify-center border border-green-500/20">
            <TrendingUp className="w-4 h-4 text-green-500" />
          </div>
          <div>
            <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium">Receita</p>
            <p className="text-lg font-black text-white leading-tight">{loading ? "..." : formatCurrency(totalRevenue)}</p>
          </div>
        </div>
        <div className="bg-[rgba(30,15,15,0.4)] backdrop-blur-xl border border-white/[0.08] p-3 rounded-xl flex items-center gap-3">
          <div className="size-9 rounded-lg bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20">
            <Star className="w-4 h-4 text-yellow-500" />
          </div>
          <div>
            <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium">Ticket Médio</p>
            <p className="text-lg font-black text-white leading-tight">
              {loading ? "..." : formatCurrency(totalActive > 0 ? totalRevenue / totalActive : 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Top 10 Ranking */}
      <div className="bg-[rgba(30,15,15,0.4)] backdrop-blur-xl border border-white/[0.08] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
          <Crown className="w-4 h-4 text-yellow-500" />
          <h2 className="text-sm font-bold text-white">Ranking — Top 10</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : topClients.length === 0 ? (
          <div className="text-center py-12 text-white/40 text-sm">
            <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Nenhum cliente ativo nos últimos 30 dias.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {topClients.map((c) => (
              <div key={c.userId}>
                {/* Client Row */}
                <div
                  onClick={() => toggleExpand(c.userId)}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-all hover:bg-white/[0.04] ${
                    rankRowColors[c.rank] || ""
                  } ${expandedUser === c.userId ? "bg-white/[0.03]" : ""}`}
                >
                  <div
                    className={`size-7 rounded-lg flex items-center justify-center font-black text-[11px] shrink-0 ${
                      rankBadgeColors[c.rank] || "bg-white/5 text-white/50 border border-white/10"
                    }`}
                  >
                    {c.rank}º
                  </div>

                  {c.avatar ? (
                    <div
                      className="size-8 rounded-lg bg-center bg-cover border border-white/10 shrink-0"
                      style={{ backgroundImage: `url(${c.avatar})` }}
                    />
                  ) : (
                    <div className="size-8 rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center text-white font-bold text-[10px] border border-white/10 shrink-0">
                      {getInitials(c.name)}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm truncate">{c.name}</p>
                    <span className="text-white/30 text-[10px] flex items-center gap-1">
                      <ShoppingBag className="w-2.5 h-2.5" />
                      {c.orderCount} {c.orderCount === 1 ? "pedido" : "pedidos"}
                    </span>
                  </div>

                  <p className="text-sm font-black text-green-400 shrink-0">{formatCurrency(c.totalSpent)}</p>

                  <ChevronDown className={`w-4 h-4 text-white/30 shrink-0 transition-transform ${
                    expandedUser === c.userId ? "rotate-180" : ""
                  }`} />
                </div>

                {/* Expanded Details */}
                {expandedUser === c.userId && (
                  <div className="bg-black/20 border-t border-white/[0.04] px-4 py-3">
                    {loadingOrders ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      </div>
                    ) : userOrders.length === 0 ? (
                      <p className="text-white/30 text-xs text-center py-3">Nenhum pedido encontrado.</p>
                    ) : (
                      <div className="space-y-2">
                        {userOrders.map((order) => (
                          <div key={order.id} className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.06]">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Package className="w-3.5 h-3.5 text-primary" />
                                <span className="text-xs font-bold text-white">{order.code}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 font-medium uppercase">
                                  {order.status === "completed" ? "Concluído" : "Entregue"}
                                </span>
                              </div>
                              <span className="text-xs font-bold text-white">{formatCurrency(order.total)}</span>
                            </div>
                            <div className="space-y-1">
                              {order.items.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between text-[11px]">
                                  <span className="text-white/50">
                                    {item.quantity}x {item.name}
                                  </span>
                                  <span className="text-white/40">{formatCurrency(item.price * item.quantity)}</span>
                                </div>
                              ))}
                            </div>
                            <p className="text-[10px] text-white/20 mt-1.5">
                              {new Date(order.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Other Active Clients */}
      {!loading && otherClients.length > 0 && (
        <div className="bg-[rgba(30,15,15,0.4)] backdrop-blur-xl border border-white/[0.08] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-white/40" />
              <h2 className="text-sm font-bold text-white">Outros Clientes Ativos</h2>
            </div>
            <span className="text-[10px] text-white/30 bg-white/5 px-2 py-0.5 rounded-full">{otherClients.length}</span>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {otherClients.map((c) => (
              <div key={c.userId}>
                <div
                  onClick={() => toggleExpand(c.userId)}
                  className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-all hover:bg-white/[0.04] ${
                    expandedUser === c.userId ? "bg-white/[0.03]" : ""
                  }`}
                >
                  <span className="text-[10px] text-white/25 w-5 text-center shrink-0">{c.rank}º</span>
                  {c.avatar ? (
                    <div className="size-7 rounded-md bg-center bg-cover border border-white/10 shrink-0" style={{ backgroundImage: `url(${c.avatar})` }} />
                  ) : (
                    <div className="size-7 rounded-md bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center text-white font-bold text-[9px] border border-white/10 shrink-0">
                      {getInitials(c.name)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white/80 font-medium text-xs truncate">{c.name}</p>
                  </div>
                  <span className="text-white/30 text-[10px] shrink-0">{c.orderCount}x</span>
                  <p className="text-xs font-bold text-green-400/80 shrink-0">{formatCurrency(c.totalSpent)}</p>
                  <ChevronDown className={`w-3 h-3 text-white/20 shrink-0 transition-transform ${expandedUser === c.userId ? "rotate-180" : ""}`} />
                </div>
                {expandedUser === c.userId && (
                  <div className="bg-black/20 border-t border-white/[0.04] px-4 py-3">
                    {loadingOrders ? (
                      <div className="flex items-center justify-center py-3">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      </div>
                    ) : userOrders.length === 0 ? (
                      <p className="text-white/30 text-xs text-center py-2">Nenhum pedido encontrado.</p>
                    ) : (
                      <div className="space-y-2">
                        {userOrders.map((order) => (
                          <div key={order.id} className="bg-white/[0.03] rounded-lg p-2.5 border border-white/[0.06]">
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <Package className="w-3 h-3 text-primary" />
                                <span className="text-[11px] font-bold text-white">{order.code}</span>
                              </div>
                              <span className="text-[11px] font-bold text-white">{formatCurrency(order.total)}</span>
                            </div>
                            {order.items.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between text-[10px]">
                                <span className="text-white/50">{item.quantity}x {item.name}</span>
                                <span className="text-white/40">{formatCurrency(item.price * item.quantity)}</span>
                              </div>
                            ))}
                            <p className="text-[9px] text-white/20 mt-1">
                              {new Date(order.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
