import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Globe, Search, ArrowLeft, ArrowRight } from "lucide-react";

export default function AdminScaleProPool() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  // Pool disponível (sem user_id, sem vínculo, status=available)
  const { data: pool = [], isLoading: loadingPool } = useQuery({
    queryKey: ["scale-pro-pool-all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("id, name, type, raw_data, created_at")
        .in("type", ["proxyfbflix"])
        .is("user_id", null)
        .is("included_in_ct_client_id", null)
        .eq("status", "available")
        .order("created_at", { ascending: false })
        .limit(500);
      return data || [];
    },
  });

  // Candidatos para mover ao pool: proxies sem cliente mas fora do pool (status != available)
  const { data: candidates = [], isLoading: loadingCand } = useQuery({
    queryKey: ["scale-pro-candidates"],
    queryFn: async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("id, name, type, raw_data, status, created_at")
        .in("type", ["proxyfbflix"])
        .is("user_id", null)
        .is("included_in_ct_client_id", null)
        .neq("status", "available")
        .order("created_at", { ascending: false })
        .limit(500);
      return data || [];
    },
  });

  const filteredPool = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pool;
    return pool.filter((p: any) => {
      const rd = p.raw_data || {};
      return (
        p.name?.toLowerCase().includes(q) ||
        rd.proxy_address?.toLowerCase().includes(q) ||
        rd.username?.toLowerCase().includes(q) ||
        rd.country_code?.toLowerCase().includes(q)
      );
    });
  }, [pool, search]);

  const addToPool = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("subscriptions")
        .update({ status: "available", user_id: null, included_in_ct_client_id: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Adicionado ao pool");
      qc.invalidateQueries({ queryKey: ["scale-pro-pool-all"] });
      qc.invalidateQueries({ queryKey: ["scale-pro-candidates"] });
    },
  });

  const removeFromPool = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("subscriptions")
        .update({ status: "cancelled" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removido do pool");
      qc.invalidateQueries({ queryKey: ["scale-pro-pool-all"] });
      qc.invalidateQueries({ queryKey: ["scale-pro-candidates"] });
    },
  });

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <Globe className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Pool Scale Pro</h1>
          <p className="text-sm text-muted-foreground">
            Proxies disponíveis para atribuição automática nas assinaturas Scale Pro
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pool disponível */}
        <div className="rounded-xl border border-border/60 bg-card/40 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Disponíveis no pool ({pool.length})</h2>
            <div className="relative w-48">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="pl-7 h-8 text-xs"
              />
            </div>
          </div>
          <div className="space-y-2 max-h-[560px] overflow-y-auto">
            {loadingPool && <div className="text-xs text-muted-foreground">Carregando…</div>}
            {!loadingPool && filteredPool.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-8">Pool vazio</div>
            )}
            {filteredPool.map((p: any) => {
              const rd = p.raw_data || {};
              return (
                <div key={p.id} className="rounded-lg border border-border/40 px-3 py-2 flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="font-mono text-muted-foreground truncate">
                      {rd.proxy_address}:{rd.port} · {(rd.country_code || "").toUpperCase()}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 text-red-400"
                    onClick={() => removeFromPool.mutate(p.id)} disabled={removeFromPool.isPending}>
                    <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Candidatos para adicionar */}
        <div className="rounded-xl border border-border/60 bg-card/40 p-5 space-y-4">
          <h2 className="text-sm font-semibold">Fora do pool ({candidates.length})</h2>
          <div className="space-y-2 max-h-[560px] overflow-y-auto">
            {loadingCand && <div className="text-xs text-muted-foreground">Carregando…</div>}
            {!loadingCand && candidates.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-8">Nenhum candidato</div>
            )}
            {candidates.map((p: any) => {
              const rd = p.raw_data || {};
              return (
                <div key={p.id} className="rounded-lg border border-border/40 px-3 py-2 flex items-center justify-between gap-2 text-xs">
                  <Button size="sm" variant="ghost" className="h-7 text-emerald-400"
                    onClick={() => addToPool.mutate(p.id)} disabled={addToPool.isPending}>
                    <ArrowLeft className="size-3.5" />
                  </Button>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="font-mono text-muted-foreground truncate">
                      {rd.proxy_address}:{rd.port} · status: {p.status}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}