import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, CheckCircle2, RotateCcw, ExternalLink, Search, Users } from "lucide-react";

type Target = {
  id: string;
  batch_id: string;
  profile_url: string;
  profile_name: string | null;
  added: boolean;
  added_at: string | null;
  created_at: string;
};
type Batch = { id: string; name: string; supplier_id: string };
type Supplier = { id: string; name: string };

function extractName(url: string): string {
  try {
    const u = new URL(url);
    const idParam = u.searchParams.get("id");
    if (idParam) return `fb:${idParam}`;
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[0] || url;
  } catch {
    return url;
  }
}

export default function AdminSolicitacoesAmizade() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "added">("pending");
  const [filterBatch, setFilterBatch] = useState<string>("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const [t, b, s] = await Promise.all([
      supabase
        .from("friend_request_targets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(2000),
      supabase.from("supplier_batches").select("id,name,supplier_id"),
      supabase.from("suppliers").select("id,name"),
    ]);
    if (t.error) toast.error(t.error.message);
    setTargets((t.data || []) as Target[]);
    setBatches((b.data || []) as Batch[]);
    setSuppliers((s.data || []) as Supplier[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const supplierMap = useMemo(
    () => Object.fromEntries(suppliers.map((s) => [s.id, s.name])),
    [suppliers],
  );
  const batchMap = useMemo(
    () => Object.fromEntries(batches.map((b) => [b.id, b])),
    [batches],
  );

  // Marcadores locais: quem já teve o perfil aberto (passo 1) nesta sessão
  const [opened, setOpened] = useState<Record<string, boolean>>({});

  const openProfile = (t: Target) => {
    window.open(t.profile_url, "_blank", "noopener,noreferrer");
    setOpened((prev) => ({ ...prev, [t.id]: true }));
  };

  const setAdded = async (t: Target, value: boolean) => {
    const patch = {
      added: value,
      added_at: value ? new Date().toISOString() : null,
    };
    setTargets((prev) =>
      prev.map((x) => (x.id === t.id ? { ...x, ...patch } : x)),
    );
    const { error } = await supabase
      .from("friend_request_targets")
      .update(patch)
      .eq("id", t.id);
    if (error) {
      toast.error(error.message);
      load();
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return targets.filter((t) => {
      if (filterStatus === "pending" && t.added) return false;
      if (filterStatus === "added" && !t.added) return false;
      if (filterBatch !== "all" && t.batch_id !== filterBatch) return false;
      if (q) {
        const text = `${t.profile_name || ""} ${t.profile_url}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [targets, filterStatus, filterBatch, search]);

  const stats = useMemo(() => {
    const total = targets.length;
    const added = targets.filter((t) => t.added).length;
    return { total, added, pending: total - added };
  }, [targets]);

  return (
    <div className="space-y-5 py-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <UserPlus className="size-6 text-primary" /> Solicitações de Amizade
        </h1>
        <p className="text-sm text-white/60">
          Lista de perfis do Facebook que devem receber pedidos de amizade.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <div className="text-xs text-white/60 flex items-center gap-1">
              <Users className="size-3" /> Total
            </div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <div className="text-xs text-amber-400">Pendentes</div>
            <div className="text-2xl font-bold text-amber-400">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <div className="text-xs text-emerald-400">Solicitados</div>
            <div className="text-2xl font-bold text-emerald-400">{stats.added}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/40" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou URL"
            className="pl-9 bg-background/60"
          />
        </div>
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
          <SelectTrigger className="w-[180px] bg-background/60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Apenas pendentes</SelectItem>
            <SelectItem value="added">Apenas solicitados</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterBatch} onValueChange={setFilterBatch}>
          <SelectTrigger className="w-[260px] bg-background/60">
            <SelectValue placeholder="Lote" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os lotes</SelectItem>
            {batches.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {supplierMap[b.supplier_id] || "—"} • {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-sm text-white/60">Carregando…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-white/60">
          Nenhum perfil encontrado. Adicione links em{" "}
          <span className="text-primary">Compras Fornecedor → Links Perfil</span>.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((t) => {
            const batch = batchMap[t.batch_id];
            const supplierName = batch ? supplierMap[batch.supplier_id] : "—";
            return (
              <Card
                key={t.id}
                className={`bg-white/5 border ${
                  t.added ? "border-emerald-500/30" : "border-white/10"
                }`}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {t.profile_name || extractName(t.profile_url)}
                      </div>
                      <div className="text-[11px] text-white/50 truncate">
                        {supplierName} • {batch?.name || "—"}
                      </div>
                    </div>
                    {t.added ? (
                      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                        Solicitado
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30">
                        Pendente
                      </Badge>
                    )}
                  </div>

                  <a
                    href={t.profile_url}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-xs text-white/60 hover:text-primary break-all"
                  >
                    {t.profile_url}
                  </a>

                  <div className="flex items-center gap-2">
                    {t.added ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1.5"
                        onClick={() => toggleAdded(t, false)}
                      >
                        <RotateCcw className="size-4" /> Refazer
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="flex-1 gap-1.5 bg-primary hover:bg-primary/90"
                        onClick={() => toggleAdded(t, true)}
                      >
                        <UserPlus className="size-4" /> Adicionar aos amigos
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      asChild
                      className="text-white/60 hover:text-white"
                    >
                      <a href={t.profile_url} target="_blank" rel="noreferrer">
                        <ExternalLink className="size-4" />
                      </a>
                    </Button>
                  </div>

                  {t.added && t.added_at && (
                    <div className="text-[11px] text-emerald-400/80 flex items-center gap-1">
                      <CheckCircle2 className="size-3" />
                      {new Date(t.added_at).toLocaleString("pt-BR")}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}