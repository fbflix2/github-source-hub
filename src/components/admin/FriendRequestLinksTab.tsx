import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, ExternalLink, UserPlus, Link2, Plus, Eraser } from "lucide-react";
import { Link as RouterLink } from "react-router-dom";

type Batch = { id: string; supplier_id: string; name: string };
type Supplier = { id: string; name: string };
type Target = {
  id: string;
  batch_id: string | null;
  profile_url: string;
  profile_name: string | null;
  added: boolean;
  added_at: string | null;
  created_at: string;
};

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

export default function FriendRequestLinksTab({
  batches,
  suppliers,
}: {
  batches: Batch[];
  suppliers: Supplier[];
}) {
  const NO_BATCH = "__no_batch__";
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState<string>("");
  const [bulkInput, setBulkInput] = useState("");
  const [filterBatch, setFilterBatch] = useState<string>("all");
  const [loadingLinks, setLoadingLinks] = useState(false);

  const supplierMap = useMemo(
    () => Object.fromEntries(suppliers.map((s) => [s.id, s.name])),
    [suppliers],
  );
  const batchMap = useMemo(
    () => Object.fromEntries(batches.map((b) => [b.id, b])),
    [batches],
  );

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("friend_request_targets")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) {
      toast.error(error.message);
    } else {
      setTargets((data || []) as Target[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // Quando um lote é selecionado, busca os profile_link das contas daquele lote
  // e preenche o textarea automaticamente (apenas se ainda estiver vazio).
  useEffect(() => {
    if (!selectedBatch || selectedBatch === NO_BATCH) return;
    let cancelled = false;
    (async () => {
      setLoadingLinks(true);
      const { data, error } = await supabase
        .from("supplier_accounts")
        .select("profile_link, login, notes")
        .eq("batch_id", selectedBatch)
        .limit(2000);
      setLoadingLinks(false);
      if (cancelled) return;
      if (error) {
        toast.error(error.message);
        return;
      }
      const links = (data || [])
        .map((a: any) => {
          if (a.profile_link) return a.profile_link as string;
          // Fallback: numeric login => monta URL de perfil
          if (a.login && /^\d{6,}$/.test(a.login)) {
            return `https://facebook.com/profile.php?id=${a.login}`;
          }
          // Fallback: extrai do notes "login|pass|...|url..."
          if (a.notes) {
            const m = String(a.notes).match(/https?:\/\/\S+/);
            if (m) return m[0];
          }
          return null;
        })
        .filter(Boolean) as string[];
      const unique = Array.from(new Set(links));
      setBulkInput(unique.join("\n"));
      if (!unique.length) {
        toast.message("Nenhum link encontrado nas contas deste lote.");
      } else {
        toast.success(`${unique.length} link(s) carregados do lote`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedBatch]);

  const addBulk = async () => {
    if (!selectedBatch) {
      toast.error("Selecione um lote (ou 'Sem lote')");
      return;
    }
    const lines = bulkInput
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) {
      toast.error("Cole pelo menos um link");
      return;
    }
    const rows = lines.map((line) => {
      // accept "url" or "name|url" or "url|name"
      const parts = line.split("|").map((p) => p.trim());
      let url = parts.find((p) => /^https?:\/\//i.test(p)) || parts[0];
      const name =
        parts.find((p) => p && !/^https?:\/\//i.test(p)) || extractName(url);
      return {
        batch_id: selectedBatch === NO_BATCH ? null : selectedBatch,
        profile_url: url,
        profile_name: name,
      };
    });
    const { error } = await supabase.from("friend_request_targets").insert(rows);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${rows.length} link(s) adicionados`);
    setBulkInput("");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover este link?")) return;
    const { error } = await supabase
      .from("friend_request_targets")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setTargets((prev) => prev.filter((t) => t.id !== id));
  };

  const clearAll = async () => {
    if (!targets.length) {
      toast.message("Nenhum link para limpar");
      return;
    }
    if (
      !confirm(
        `Tem certeza? Isso irá remover TODOS os ${targets.length} link(s) cadastrados.`,
      )
    )
      return;
    const { error } = await supabase
      .from("friend_request_targets")
      .delete()
      .not("id", "is", null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Todos os links foram removidos");
    setTargets([]);
  };

  const filtered = useMemo(() => {
    return targets.filter((t) =>
      filterBatch === "all"
        ? true
        : filterBatch === NO_BATCH
          ? t.batch_id === null
          : t.batch_id === filterBatch,
    );
  }, [targets, filterBatch]);

  // group by batch
  const grouped = useMemo(() => {
    const map = new Map<string, Target[]>();
    filtered.forEach((t) => {
      const key = t.batch_id ?? NO_BATCH;
      const arr = map.get(key) || [];
      arr.push(t);
      map.set(key, arr);
    });
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Link2 className="size-5 text-primary" /> Links de Perfil para Solicitação de Amizade
          </h2>
          <p className="text-sm text-white/60">
            Organize por lote os perfis que receberão pedidos de amizade.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={clearAll}
            className="gap-2 border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300"
          >
            <Eraser className="size-4" /> Limpar todos
          </Button>
          <Button asChild variant="default" className="gap-2">
            <RouterLink to="/admin/solicitacoes-amizade">
              <UserPlus className="size-4" /> Abrir página de solicitações
            </RouterLink>
          </Button>
        </div>
      </div>

      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="size-4" /> Adicionar links em massa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-[280px_1fr] gap-3">
            <Select value={selectedBatch} onValueChange={setSelectedBatch}>
              <SelectTrigger className="bg-background/60">
                <SelectValue placeholder="Selecione o lote (ou Sem lote)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_BATCH}>Sem lote (link avulso)</SelectItem>
                {batches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {supplierMap[b.supplier_id] || "—"} • {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              placeholder={`Cole 1 link por linha. Aceita "url" ou "nome|url".\nhttps://facebook.com/profile.php?id=100000...\nAlex|https://facebook.com/alex.silva`}
              className="min-h-[110px] bg-background/60 font-mono text-xs"
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={addBulk}>Adicionar</Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Select value={filterBatch} onValueChange={setFilterBatch}>
          <SelectTrigger className="w-[280px] bg-background/60">
            <SelectValue placeholder="Filtrar por lote" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os lotes</SelectItem>
            <SelectItem value={NO_BATCH}>Sem lote (avulsos)</SelectItem>
            {batches.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {supplierMap[b.supplier_id] || "—"} • {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="outline" className="border-white/20 text-white/70">
          {filtered.length} link(s)
        </Badge>
      </div>

      {loading ? (
        <p className="text-sm text-white/60">Carregando…</p>
      ) : grouped.length === 0 ? (
        <p className="text-sm text-white/60">Nenhum link cadastrado ainda.</p>
      ) : (
        <div className="space-y-3">
          {grouped.map(([batchId, items]) => {
            const isNoBatch = batchId === NO_BATCH;
            const batch = isNoBatch ? null : batchMap[batchId];
            const supplierName = batch ? supplierMap[batch.supplier_id] : "—";
            const headerLabel = isNoBatch
              ? "Links avulsos (sem lote)"
              : `${supplierName} • ${batch?.name || "(lote removido)"}`;
            return (
              <Card key={batchId} className="bg-white/5 border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>
                      {headerLabel}
                    </span>
                    <Badge className="bg-primary/15 text-primary border-primary/30">
                      {items.length} perfis
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {items.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-2 py-1.5 border-b border-white/5 last:border-0"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {t.profile_name || extractName(t.profile_url)}
                        </div>
                        <a
                          href={t.profile_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-white/50 hover:text-primary truncate block"
                        >
                          {t.profile_url}
                        </a>
                      </div>
                      {t.added && (
                        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                          Solicitado
                        </Badge>
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
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(t.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}