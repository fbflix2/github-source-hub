import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, CheckCircle2, RotateCcw, ExternalLink, Search, Users, FolderOpen, Bookmark, RefreshCw, Target } from "lucide-react";

type Target = {
  id: string;
  batch_id: string;
  profile_url: string;
  profile_name: string | null;
  added: boolean;
  added_at: string | null;
  created_at: string;
  friends_count: number | null;
  friends_updated_at: string | null;
  friends_goal: number | null;
};
type Batch = { id: string; name: string; supplier_id: string; friends_goal?: number | null };
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
  const [photos, setPhotos] = useState<Record<string, string | null>>({});
  const [fbNames, setFbNames] = useState<Record<string, string | null>>({});
  const [fbFriends, setFbFriends] = useState<Record<string, number | null>>({});

  const load = async () => {
    setLoading(true);
    const [t, b, s] = await Promise.all([
      supabase
        .from("friend_request_targets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(2000),
      supabase.from("supplier_batches").select("id,name,supplier_id,friends_goal"),
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

  // Bloqueia indexação por buscadores (página restrita a operadores)
  useEffect(() => {
    const tag = document.createElement("meta");
    tag.name = "robots";
    tag.content = "noindex, nofollow, noarchive";
    document.head.appendChild(tag);
    return () => {
      document.head.removeChild(tag);
    };
  }, []);

  // Busca foto do FB (via edge function fb-photo) para perfis visíveis ainda sem cache
  useEffect(() => {
    const missing = targets.filter((t) => photos[t.id] === undefined).slice(0, 30);
    if (!missing.length) return;
    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        missing.map(async (t) => {
          try {
            const url = `https://mxnlerkeygfvdnznoxld.supabase.co/functions/v1/fb-photo?url=${encodeURIComponent(t.profile_url)}`;
            const r = await fetch(url);
            const j = await r.json();
            return [
              t.id,
              j?.ok ? (j.photoUrl as string) : null,
              j?.ok ? ((j.name as string) || null) : null,
              j?.ok ? ((j.friendsCount as number) ?? null) : null,
            ] as const;
          } catch {
            return [t.id, null, null, null] as const;
          }
        }),
      );
      if (cancelled) return;
      setPhotos((prev) => {
        const next = { ...prev };
        for (const [id, url] of results) next[id] = url as string | null;
        return next;
      });
      setFbNames((prev) => {
        const next = { ...prev };
        for (const [id, , nm] of results) next[id] = nm as string | null;
        return next;
      });
      setFbFriends((prev) => {
        const next = { ...prev };
        for (const [id, , , fc] of results) next[id] = (fc as number | null) ?? null;
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targets]);

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

  // Bookmarklet: rodando no facebook.com, lê "X amigos" da página e envia para o edge function
  const bookmarkletCode = useMemo(() => {
    const url = "https://mxnlerkeygfvdnznoxld.supabase.co/functions/v1/fb-friends-update";
    const body = `(function(){try{var u=location.href;var t=(document.body&&document.body.innerText)||'';var m=t.match(/([\\d.,]+)\\s*(?:mil)?\\s*amigos/i)||t.match(/([\\d.,]+)\\s*(?:mil)?\\s*friends/i);if(!m){alert('FBFlix: não encontrei a contagem de amigos nesta página. Abra a aba principal do perfil.');return;}var raw=m[1].replace(/[\\.,]/g,'');var n=parseInt(raw,10);if(/mil/i.test(m[0])&&n<10000)n=n*1000;var name=(document.querySelector('h1')||{}).innerText||null;fetch('${url}',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({profile_url:u,friends_count:n,name:name})}).then(function(r){return r.json()}).then(function(j){if(j&&j.ok){alert('✓ FBFlix: '+n+' amigos salvos ('+j.updated+' registro(s))');}else{alert('✗ FBFlix: '+(j&&j.error||'erro desconhecido'));}}).catch(function(e){alert('✗ FBFlix: '+e.message);});}catch(e){alert('✗ FBFlix: '+e.message);}})();`;
    return "javascript:" + encodeURIComponent(body);
  }, []);

  const updateGoal = async (t: Target, goal: number) => {
    setTargets((prev) => prev.map((x) => (x.id === t.id ? { ...x, friends_goal: goal } : x)));
    const { error } = await supabase
      .from("friend_request_targets")
      .update({ friends_goal: goal })
      .eq("id", t.id);
    if (error) toast.error(error.message);
  };

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

      {/* Bookmarklet — captura quantidade de amigos */}
      <Card className="bg-primary/5 border-primary/30">
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[260px]">
            <div className="font-medium flex items-center gap-2">
              <Bookmark className="size-4 text-primary" /> Capturar amigos automaticamente
            </div>
            <p className="text-xs text-white/60 mt-1">
              1) Arraste o botão verde para a barra de favoritos do navegador.
              2) Depois, estando logado e na página do perfil no Facebook, clique no
              favorito — a contagem de amigos é salva aqui na hora.
            </p>
          </div>
          <a
            href={bookmarkletCode}
            onClick={(e) => e.preventDefault()}
            draggable
            className="px-4 py-2 rounded-md bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm cursor-grab active:cursor-grabbing select-none whitespace-nowrap"
            title="Arraste-me para a barra de favoritos"
          >
            📊 FBFlix · Capturar amigos
          </a>
          <Button
            variant="outline"
            size="sm"
            onClick={() => load()}
            className="gap-1.5"
          >
            <RefreshCw className="size-4" /> Atualizar
          </Button>
        </CardContent>
      </Card>

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
        <Button
          variant="outline"
          className="gap-2 border-primary/40 text-primary hover:bg-primary/10"
          onClick={() => {
            const pending = filtered.filter((t) => !t.added).slice(0, 10);
            if (!pending.length) {
              toast.message("Nenhum perfil pendente para abrir.");
              return;
            }
            pending.forEach((t) =>
              window.open(t.profile_url, "_blank", "noopener,noreferrer"),
            );
            toast.success(`${pending.length} perfis abertos em novas abas`);
          }}
        >
          <FolderOpen className="size-4" /> Abrir próximos 10
        </Button>
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
                  <div className="flex items-start gap-3">
                    <div className="size-14 rounded-full bg-white/10 overflow-hidden flex-shrink-0 border border-white/10">
                      {photos[t.id] ? (
                        <img
                          src={photos[t.id] as string}
                          alt={t.profile_name || ""}
                          className="size-full object-cover"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="size-full flex items-center justify-center text-white/30">
                          <UserPlus className="size-5" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">
                        {fbNames[t.id] || t.profile_name || extractName(t.profile_url)}
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

                  {/* Progresso de amigos */}
                  {(() => {
                    const goal = t.friends_goal || 100;
                    const count = t.friends_count ?? 0;
                    const pct = Math.min(100, Math.round((count / goal) * 100));
                    const hit = count >= goal;
                    return (
                      <div className="rounded-lg bg-white/5 border border-white/10 p-2.5 space-y-1.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="flex items-baseline gap-1.5">
                            <span className={`text-2xl font-bold ${hit ? "text-emerald-400" : "text-primary"}`}>
                              {t.friends_count != null ? count.toLocaleString("pt-BR") : "—"}
                            </span>
                            <span className="text-xs text-white/50">/ </span>
                            <input
                              type="number"
                              min={1}
                              value={goal}
                              onChange={(e) => {
                                const v = Math.max(1, parseInt(e.target.value || "1", 10));
                                updateGoal(t, v);
                              }}
                              className="w-14 bg-transparent text-sm text-white/70 border-b border-white/20 focus:border-primary outline-none text-center"
                              title="Meta de amigos"
                            />
                            <span className="text-xs text-white/50">amigos</span>
                          </div>
                          {t.friends_count != null && (
                            <span className={`text-xs font-semibold ${hit ? "text-emerald-400" : "text-amber-400"}`}>
                              {pct}%
                            </span>
                          )}
                        </div>
                        <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                          <div
                            className={`h-full transition-all ${hit ? "bg-emerald-500" : "bg-primary"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {t.friends_count == null ? (
                          <div className="text-[11px] text-white/40 flex items-center gap-1">
                            <Target className="size-3" /> Sem dados — abra o perfil e clique no bookmarklet
                          </div>
                        ) : (
                          <div className="text-[11px] text-white/40 flex items-center justify-between gap-1">
                            <span>
                              {hit ? "✓ Meta atingida" : `Faltam ${Math.max(0, goal - count)} amigos`}
                            </span>
                            {t.friends_updated_at && (
                              <span>
                                {new Date(t.friends_updated_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <a
                    href={t.profile_url}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-xs text-white/60 hover:text-primary break-all"
                  >
                    {t.profile_url}
                  </a>

                  <div className="flex flex-col gap-2">
                    {t.added ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-1.5"
                        onClick={() => setAdded(t, false)}
                      >
                        <RotateCcw className="size-4" /> Refazer (desmarcar)
                      </Button>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          className="w-full gap-1.5 bg-primary hover:bg-primary/90"
                          onClick={() => openProfile(t)}
                        >
                          <ExternalLink className="size-4" />
                          {opened[t.id] ? "Abrir perfil novamente" : "Abrir perfil no Facebook"}
                        </Button>
                        {opened[t.id] && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full gap-1.5 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                            onClick={() => setAdded(t, true)}
                          >
                            <CheckCircle2 className="size-4" /> Marcar como solicitado
                          </Button>
                        )}
                      </>
                    )}
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