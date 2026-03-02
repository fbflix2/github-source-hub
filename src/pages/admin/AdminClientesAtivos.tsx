import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Crown, TrendingUp, ShoppingBag, Star, Loader2, Users } from "lucide-react";
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

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const rankColors: Record<number, string> = {
  1: "from-yellow-500/20 to-yellow-600/5 border-yellow-500/30",
  2: "from-gray-300/15 to-gray-400/5 border-gray-400/25",
  3: "from-amber-700/15 to-amber-800/5 border-amber-600/25",
};

const rankBadgeColors: Record<number, string> = {
  1: "bg-yellow-500 text-black",
  2: "bg-gray-400 text-black",
  3: "bg-amber-700 text-white",
};

export default function AdminClientesAtivos() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [topClients, setTopClients] = useState<TopClient[]>([]);
  const [totalActive, setTotalActive] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Fetch completed orders from last 30 days
    const { data: orders } = await supabase
      .from("orders")
      .select("user_id, total, status")
      .in("status", ["completed", "delivered"])
      .gte("created_at", thirtyDaysAgo.toISOString());

    const allOrders = orders || [];

    // Aggregate by user
    const userMap: Record<string, { total: number; count: number }> = {};
    for (const o of allOrders) {
      if (!userMap[o.user_id]) userMap[o.user_id] = { total: 0, count: 0 };
      userMap[o.user_id].total += Number(o.total);
      userMap[o.user_id].count += 1;
    }

    const sortedUsers = Object.entries(userMap)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10);

    const userIds = sortedUsers.map(([uid]) => uid);

    // Fetch profiles for these users
    let profileMap: Record<string, { name: string; avatar: string | null }> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", userIds);
      for (const p of profiles || []) {
        profileMap[p.user_id] = { name: p.full_name || "Sem nome", avatar: p.avatar_url };
      }
    }

    const top: TopClient[] = sortedUsers.map(([uid, data], idx) => ({
      rank: idx + 1,
      userId: uid,
      name: profileMap[uid]?.name || "Sem nome",
      avatar: profileMap[uid]?.avatar || null,
      totalSpent: data.total,
      orderCount: data.count,
    }));

    setTopClients(top);
    setTotalActive(Object.keys(userMap).length);
    setTotalRevenue(allOrders.reduce((s, o) => s + Number(o.total), 0));
    setLoading(false);
  };

  const getInitials = (name: string) =>
    name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();

  return (
    <div className="flex flex-col gap-6 pt-4 pb-12">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate("/admin/clientes")}
          className="border-white/10 text-white/70 hover:text-white hover:bg-white/10 rounded-xl shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white flex items-center gap-3">
            <Crown className="w-8 h-8 text-yellow-500" />
            Clientes Ativos
          </h1>
          <p className="text-white/50 text-sm mt-1">
            Top consumidores nos últimos 30 dias
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[rgba(30,15,15,0.4)] backdrop-blur-xl border border-white/[0.08] p-5 rounded-2xl flex items-center gap-4 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
          <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-white/50 text-xs uppercase tracking-wider font-medium">Clientes Ativos</p>
            <p className="text-2xl font-black text-white">{loading ? "..." : totalActive}</p>
          </div>
        </div>
        <div className="bg-[rgba(30,15,15,0.4)] backdrop-blur-xl border border-white/[0.08] p-5 rounded-2xl flex items-center gap-4 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
          <div className="size-12 rounded-xl bg-green-500/10 flex items-center justify-center border border-green-500/20">
            <TrendingUp className="w-6 h-6 text-green-500" />
          </div>
          <div>
            <p className="text-white/50 text-xs uppercase tracking-wider font-medium">Receita (30 dias)</p>
            <p className="text-2xl font-black text-white">{loading ? "..." : formatCurrency(totalRevenue)}</p>
          </div>
        </div>
        <div className="bg-[rgba(30,15,15,0.4)] backdrop-blur-xl border border-white/[0.08] p-5 rounded-2xl flex items-center gap-4 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
          <div className="size-12 rounded-xl bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20">
            <Star className="w-6 h-6 text-yellow-500" />
          </div>
          <div>
            <p className="text-white/50 text-xs uppercase tracking-wider font-medium">Ticket Médio</p>
            <p className="text-2xl font-black text-white">
              {loading ? "..." : formatCurrency(totalActive > 0 ? totalRevenue / totalActive : 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Top 10 Ranking */}
      <div className="bg-[rgba(30,15,15,0.4)] backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-[0_4px_30px_rgba(0,0,0,0.5)] overflow-hidden">
        <div className="p-5 border-b border-white/[0.06] flex items-center gap-2">
          <Crown className="w-5 h-5 text-yellow-500" />
          <h2 className="text-lg font-bold text-white">Ranking — Top 10</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : topClients.length === 0 ? (
          <div className="text-center py-20 text-white/40">
            <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>Nenhum cliente ativo nos últimos 30 dias.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {topClients.map((c) => (
              <div
                key={c.userId}
                className={`flex items-center gap-4 p-5 transition-all hover:bg-white/[0.03] ${
                  c.rank <= 3
                    ? `bg-gradient-to-r ${rankColors[c.rank] || ""}`
                    : ""
                }`}
              >
                {/* Rank Badge */}
                <div
                  className={`size-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                    rankBadgeColors[c.rank] || "bg-white/5 text-white/50 border border-white/10"
                  }`}
                >
                  {c.rank}º
                </div>

                {/* Avatar */}
                {c.avatar ? (
                  <div
                    className="size-12 rounded-xl bg-center bg-cover border border-white/10 shrink-0"
                    style={{ backgroundImage: `url(${c.avatar})` }}
                  />
                ) : (
                  <div className="size-12 rounded-xl bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center text-white font-bold text-sm border border-white/10 shrink-0">
                    {getInitials(c.name)}
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-base truncate">{c.name}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-white/40 text-xs flex items-center gap-1">
                      <ShoppingBag className="w-3 h-3" />
                      {c.orderCount} {c.orderCount === 1 ? "pedido" : "pedidos"}
                    </span>
                  </div>
                </div>

                {/* Total Spent */}
                <div className="text-right shrink-0">
                  <p className="text-lg font-black text-green-400">{formatCurrency(c.totalSpent)}</p>
                  <p className="text-[10px] text-white/30 uppercase tracking-wider">gasto total</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
