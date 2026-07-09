import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Globe, Search, Plus, X, User, ChevronDown, ChevronUp } from "lucide-react";

export default function AdminScaleProPool() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [candidatesOpen, setCandidatesOpen] = useState(false);

  // Todos proxies do escopo Scale Pro: no pool (available/sem cliente) OU vinculados a um ct_client
  const { data: rows = [], isLoading: loadingRows } = useQuery({
    queryKey: ["scale-pro-proxies-all"],
    queryFn: async () => {
      const { data: subs } = await supabase
        .from("subscriptions")
        .select("id, name, type, raw_data, status, user_id, included_in_ct_client_id, created_at")
        .eq("type", "proxyfbflix")
        .or("included_in_ct_client_id.not.is.null,and(user_id.is.null,status.eq.available)")
        .order("created_at", { ascending: false })
        .limit(1000);

      const ctIds = Array.from(
        new Set((subs || []).map((s: any) => s.included_in_ct_client_id).filter(Boolean))
      );
      let clientMap: Record<string, { fullName: string; ctId: string }> = {};
      if (ctIds.length) {
        const { data: ctClients } = await supabase
          .from("ct_clients")
          .select("id, user_id")
          .in("id", ctIds);
        const userIds = Array.from(new Set((ctClients || []).map((c: any) => c.user_id)));
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
        const nameByUser: Record<string, string> = {};
        (profiles || []).forEach((p: any) => { nameByUser[p.user_id] = p.full_name || ""; });
        (ctClients || []).forEach((c: any) => {
          clientMap[c.id] = { fullName: nameByUser[c.user_id] || "Cliente", ctId: c.id };
        });
      }

      return (subs || []).map((s: any) => ({
        ...s,
        client: s.included_in_ct_client_id ? clientMap[s.included_in_ct_client_id] : null,
      }));
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

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((p: any) => {
      const rd = p.raw_data || {};
      return (
        p.name?.toLowerCase().includes(q) ||
        rd.proxy_address?.toLowerCase().includes(q) ||
        rd.username?.toLowerCase().includes(q) ||
        rd.country_code?.toLowerCase().includes(q) ||
        p.client?.fullName?.toLowerCase().includes(q)
      );
    });
  }, [rows, search]);

  const poolCount = rows.filter((p: any) => !p.client).length;
  const linkedCount = rows.filter((p: any) => p.client).length;

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
      qc.invalidateQueries({ queryKey: ["scale-pro-proxies-all"] });
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
      qc.invalidateQueries({ queryKey: ["scale-pro-proxies-all"] });
      qc.invalidateQueries({ queryKey: ["scale-pro-candidates"] });
    },
  });

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Globe className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Pool Scale Pro</h1>
            <p className="text-sm text-muted-foreground">
              Proxies dedicados dos clientes Scale Pro e disponíveis no pool
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">
            {linkedCount} vinculados
          </Badge>
          <Badge variant="outline" className="border-border">
            {poolCount} no pool
          </Badge>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente, IP, nome..."
            className="pl-9 h-9"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setCandidatesOpen((v) => !v)}
          className="gap-2"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar ao pool ({candidates.length})
          {candidatesOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {candidatesOpen && (
        <div className="glass-card rounded-xl p-4 space-y-2 max-h-72 overflow-y-auto">
          <p className="text-xs text-muted-foreground">
            Proxies sem cliente e fora do pool. Clique em "Mover" para disponibilizar no pool.
          </p>
          {loadingCand && <div className="text-xs text-muted-foreground">Carregando…</div>}
          {!loadingCand && candidates.length === 0 && (
            <div className="text-xs text-muted-foreground text-center py-6">Nenhum candidato</div>
          )}
          {candidates.map((p: any) => {
            const rd = p.raw_data || {};
            return (
              <div key={p.id} className="rounded-lg border border-border/40 bg-card/30 px-3 py-2 flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{p.name}</div>
                  <div className="font-mono text-muted-foreground truncate">
                    {rd.proxy_address}:{rd.port} · status: {p.status}
                  </div>
                </div>
                <Button size="sm" variant="ghost" className="h-7 text-emerald-400 gap-1"
                  onClick={() => addToPool.mutate(p.id)} disabled={addToPool.isPending}>
                  <Plus className="h-3.5 w-3.5" /> Mover
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Table */}
      <div className="glass-card rounded-xl overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b border-border">
              <tr>
                <th className="px-4 py-4 font-medium">Nome</th>
                <th className="px-4 py-4 font-medium">Proxy</th>
                <th className="px-4 py-4 font-medium">Cliente Scale Pro</th>
                <th className="px-4 py-4 font-medium">Status</th>
                <th className="px-4 py-4 font-medium">Criado</th>
                <th className="px-4 py-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loadingRows && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">Carregando…</td></tr>
              )}
              {!loadingRows && filteredRows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">
                  {search ? "Nenhum proxy encontrado com esse filtro." : "Nenhum proxy no escopo Scale Pro."}
                </td></tr>
              )}
              {filteredRows.map((p: any) => {
                const rd = p.raw_data || {};
                const isLinked = !!p.client;
                return (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-4 py-3.5">
                      <span className="font-medium text-foreground">{p.name}</span>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">
                        {(rd.country_code || "BR").toUpperCase()} · Dedicado
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-foreground">
                        {rd.proxy_address}:{rd.port}
                      </span>
                      <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                        {rd.username} / {rd.password}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      {isLinked ? (
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                            <User className="h-3.5 w-3.5 text-emerald-400" />
                          </div>
                          <span className="font-medium text-foreground">{p.client.fullName}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">— Sem cliente —</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {isLinked ? (
                        <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">
                          Vinculado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-sky-500/30 text-sky-400">
                          Disponível
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-muted-foreground">
                      {p.created_at ? new Date(p.created_at).toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {!isLinked && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity gap-1"
                          onClick={() => removeFromPool.mutate(p.id)}
                          disabled={removeFromPool.isPending}
                        >
                          <X className="h-3.5 w-3.5" /> Remover
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}