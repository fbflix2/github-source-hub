import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, CheckCircle2, RotateCcw, ExternalLink, Search, Users, FolderOpen, Bookmark, RefreshCw, Target, Download, Ban, ShieldAlert } from "lucide-react";

const OP_SLUG = "amizades-7k9mpx2qvnxp";
const FN_BASE = "https://mxnlerkeygfvdnznoxld.supabase.co/functions/v1";

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
  is_blocked?: boolean | null;
  blocked_at?: string | null;
  blocked_reason?: string | null;
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

async function api(method: "GET" | "POST", body?: unknown) {
  const r = await fetch(`${FN_BASE}/fb-amizades-public`, {
    method,
    headers: { "content-type": "application/json", "x-op-slug": OP_SLUG },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.json();
}

export default function PublicAmizades() {
  const { slug } = useParams();
  const allowed = slug === OP_SLUG;

  const [targets, setTargets] = useState<Target[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "added" | "blocked">("pending");
  const [filterBatch, setFilterBatch] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [photos, setPhotos] = useState<Record<string, string | null>>({});
  const [fbNames, setFbNames] = useState<Record<string, string | null>>({});
  const [opened, setOpened] = useState<Record<string, boolean>>({});

  // Bloqueia indexação
  useEffect(() => {
    const tag = document.createElement("meta");
    tag.name = "robots";
    tag.content = "noindex, nofollow, noarchive";
    document.head.appendChild(tag);
    document.title = "FBFlix · Aquecimento";
    return () => {
      document.head.removeChild(tag);
    };
  }, []);

  const load = async (opts?: { silent?: boolean }) => {
    if (!allowed) return;
    if (!opts?.silent) setLoading(true);
    const j = await api("GET");
    if (!j.ok) {
      if (!opts?.silent) toast.error(j.error || "Erro");
      if (!opts?.silent) setLoading(false);
      return;
    }
    const incoming = (j.targets || []) as Target[];
    // Merge preservando estado otimista local (added marcado há <10s ainda não persistido no servidor)
    setTargets((prev) => {
      const prevMap = new Map(prev.map((p) => [p.id, p]));
      return incoming.map((t) => {
        const p = prevMap.get(t.id);
        if (!p) return t;
        // Se localmente está added=true e o servidor ainda não refletiu, mantém local
        if (p.added && !t.added) return { ...t, added: true, added_at: p.added_at };
        return t;
      });
    });
    setBatches((j.batches || []) as Batch[]);
    setSuppliers((j.suppliers || []) as Supplier[]);
    if (!opts?.silent) setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed]);

  // Atualiza em background (silencioso) a cada 30s para refletir mudanças do bookmarklet
  // sem causar "piscar" da tela.
  useEffect(() => {
    if (!allowed) return;
    const i = setInterval(() => load({ silent: true }), 30000);
    return () => clearInterval(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed]);

  // Foto + nome do FB via fb-photo
  useEffect(() => {
    const missing = targets.filter((t) => photos[t.id] === undefined).slice(0, 30);
    if (!missing.length) return;
    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        missing.map(async (t) => {
          try {
            const url = `${FN_BASE}/fb-photo?url=${encodeURIComponent(t.profile_url)}`;
            const r = await fetch(url);
            const j = await r.json();
            return [t.id, j?.ok ? (j.photoUrl as string) : null, j?.ok ? ((j.name as string) || null) : null] as const;
          } catch {
            return [t.id, null, null] as const;
          }
        }),
      );
      if (cancelled) return;
      setPhotos((prev) => { const n = { ...prev }; for (const [id, url] of results) n[id] = url; return n; });
      setFbNames((prev) => { const n = { ...prev }; for (const [id, , nm] of results) n[id] = nm; return n; });
    })();
    return () => { cancelled = true; };
  }, [targets, photos]);

  const supplierMap = useMemo(() => Object.fromEntries(suppliers.map((s) => [s.id, s.name])), [suppliers]);
  const batchMap = useMemo(() => Object.fromEntries(batches.map((b) => [b.id, b])), [batches]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return targets.filter((t) => {
      const goal = t.friends_goal || 100;
      const count = t.friends_count ?? 0;
      const goalHit = count >= goal;
      if (filterStatus === "pending" && (goalHit || t.is_blocked)) return false;
      if (filterStatus === "added" && !goalHit) return false;
      if (filterStatus === "blocked" && !t.is_blocked) return false;
      // "all" inclui bloqueados; demais filtros ocultam por padrão
      if (filterStatus !== "all" && filterStatus !== "blocked" && t.is_blocked) return false;
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
    const blocked = targets.filter((t) => t.is_blocked).length;
    const completed = targets.filter((t) => {
      const goal = t.friends_goal || 100;
      const count = t.friends_count ?? 0;
      return count >= goal;
    }).length;
    return { total, added: completed, blocked, pending: total - completed - blocked };
  }, [targets]);

  const bookmarkletCode = useMemo(() => {
    const url = `${FN_BASE}/fb-friends-update`;
    const body = `(function(){try{var u=location.href;var t=(document.body&&document.body.innerText)||'';var m=t.match(/([\\d.,]+)\\s*(?:mil)?\\s*amigos/i)||t.match(/([\\d.,]+)\\s*(?:mil)?\\s*friends/i);if(!m){alert('FBFlix: não encontrei a contagem de amigos.');return;}var raw=m[1].replace(/[\\.,]/g,'');var n=parseInt(raw,10);if(/mil/i.test(m[0])&&n<10000)n=n*1000;var name=(document.querySelector('h1')||{}).innerText||null;fetch('${url}',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({profile_url:u,friends_count:n,name:name})}).then(function(r){return r.json()}).then(function(j){if(j&&j.ok){alert('✓ '+n+' amigos salvos');}else{alert('✗ '+(j&&j.error||'erro'));}}).catch(function(e){alert('✗ '+e.message);});}catch(e){alert('✗ '+e.message);}})();`;
    return "javascript:" + encodeURIComponent(body);
  }, []);

  const setAdded = async (t: Target, value: boolean) => {
    setTargets((prev) => prev.map((x) => (x.id === t.id ? { ...x, added: value, added_at: value ? new Date().toISOString() : null } : x)));
    const j = await api("POST", { action: "set_added", id: t.id, value });
    if (!j.ok) { toast.error(j.error || "Erro"); load(); }
  };

  const updateGoal = async (t: Target, goal: number) => {
    setTargets((prev) => prev.map((x) => (x.id === t.id ? { ...x, friends_goal: goal } : x)));
    const j = await api("POST", { action: "set_goal", id: t.id, goal });
    if (!j.ok) toast.error(j.error || "Erro");
  };

  const setBlocked = async (t: Target, value: boolean) => {
    setTargets((prev) => prev.map((x) => (x.id === t.id ? { ...x, is_blocked: value, blocked_at: value ? new Date().toISOString() : null } : x)));
    const j = await api("POST", { action: "set_blocked", id: t.id, value, reason: "manual" });
    if (!j.ok) { toast.error(j.error || "Erro"); load(); }
  };

  const openProfile = (t: Target) => {
    if (t.is_blocked) {
      toast.error("Perfil marcado como bloqueado/checkpoint.");
      return;
    }
    window.open(t.profile_url, "_blank", "noopener,noreferrer");
    setOpened((p) => ({ ...p, [t.id]: true }));
    // Marca automaticamente como solicitado ao abrir o perfil (fluxo: abrir → adicionar amigo no FB).
    // Caso o operador não tenha enviado a solicitação, basta clicar em "Refazer (desmarcar)".
    if (!t.added) setAdded(t, true);
  };

  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-white p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Acesso negado</h1>
          <p className="text-white/60 text-sm">URL inválida.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-white px-4 sm:px-6 py-6">
      <div className="max-w-7xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <UserPlus className="size-6 text-primary" /> Aquecimento · Solicitações de Amizade
          </h1>
          <p className="text-sm text-white/60">Painel do operador — sem necessidade de login.</p>
        </div>

        <Card className="bg-primary/5 border-primary/30">
          <CardContent className="p-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[260px]">
              <div className="font-medium flex items-center gap-2"><Download className="size-4 text-primary" /> Extensão FBFlix (recomendado)</div>
              <p className="text-xs text-white/60 mt-1">
                Instale uma vez e a contagem de amigos é capturada <b>automaticamente</b> ao abrir qualquer perfil do Facebook — sem cliques.
              </p>
              <ol className="text-[11px] text-white/50 mt-2 list-decimal pl-4 space-y-0.5">
                <li>Baixe e descompacte o arquivo .zip</li>
                <li>Abra <code className="text-white/70">chrome://extensions</code> e ative o <b>Modo desenvolvedor</b></li>
                <li>Clique em <b>Carregar sem compactação</b> e selecione a pasta descompactada</li>
              </ol>
            </div>
            <Button
              onClick={() => {
                fetch("/fbflix-extension.zip")
                  .then((r) => { if (!r.ok) throw new Error("Falha no download"); return r.blob(); })
                  .then((blob) => {
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = "fbflix-extension.zip";
                    a.click();
                    URL.revokeObjectURL(a.href);
                  })
                  .catch((e) => toast.error(e.message));
              }}
              className="bg-primary hover:bg-primary/90 text-black font-semibold gap-2"
            >
              <Download className="size-4" /> Baixar Extensão
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[260px]">
              <div className="font-medium flex items-center gap-2 text-sm"><Bookmark className="size-4 text-white/60" /> Alternativa: Bookmarklet</div>
              <p className="text-xs text-white/50 mt-1">
                Arraste para a barra de favoritos e clique no perfil aberto para capturar manualmente.
              </p>
            </div>
            <a
              href={bookmarkletCode}
              onClick={(e) => e.preventDefault()}
              draggable
              className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white font-medium text-xs cursor-grab active:cursor-grabbing select-none whitespace-nowrap"
              title="Arraste-me para a barra de favoritos"
            >
              📊 FBFlix · Capturar amigos
            </a>
            <Button variant="outline" size="sm" onClick={() => load()} className="gap-1.5">
              <RefreshCw className="size-4" /> Atualizar
            </Button>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="bg-white/5 border-white/10"><CardContent className="p-4"><div className="text-xs text-white/60 flex items-center gap-1"><Users className="size-3" /> Total</div><div className="text-2xl font-bold">{stats.total}</div></CardContent></Card>
          <Card className="bg-white/5 border-white/10"><CardContent className="p-4"><div className="text-xs text-amber-400">Pendentes</div><div className="text-2xl font-bold text-amber-400">{stats.pending}</div></CardContent></Card>
          <Card className="bg-white/5 border-white/10"><CardContent className="p-4"><div className="text-xs text-emerald-400">Solicitados</div><div className="text-2xl font-bold text-emerald-400">{stats.added}</div></CardContent></Card>
          <Card className="bg-white/5 border-white/10"><CardContent className="p-4"><div className="text-xs text-red-400 flex items-center gap-1"><Ban className="size-3" /> Bloqueados</div><div className="text-2xl font-bold text-red-400">{stats.blocked}</div></CardContent></Card>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/40" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou URL" className="pl-9 bg-background/60" />
          </div>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as "all" | "pending" | "added" | "blocked")}>
            <SelectTrigger className="w-[180px] bg-background/60"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Apenas pendentes</SelectItem>
              <SelectItem value="added">Apenas solicitados</SelectItem>
              <SelectItem value="blocked">Apenas bloqueados</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterBatch} onValueChange={setFilterBatch}>
            <SelectTrigger className="w-[260px] bg-background/60"><SelectValue placeholder="Lote" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os lotes</SelectItem>
              {batches.map((b) => (
                <SelectItem key={b.id} value={b.id}>{supplierMap[b.supplier_id] || "—"} • {b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            className="gap-2 border-primary/40 text-primary hover:bg-primary/10"
            onClick={() => {
              const pending = filtered.filter((t) => {
                const goal = t.friends_goal || 100;
                const count = t.friends_count ?? 0;
                return count < goal && !t.is_blocked;
              }).slice(0, 10);
              if (!pending.length) { toast.message("Nenhum perfil pendente."); return; }
              pending.forEach((t) => openProfile(t));
              toast.success(`${pending.length} perfis abertos e marcados como solicitados`);
            }}
          >
            <FolderOpen className="size-4" /> Abrir próximos 10
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-white/60">Carregando…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-white/60">Nenhum perfil encontrado.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((t) => {
              const batch = batchMap[t.batch_id];
              const supplierName = batch ? supplierMap[batch.supplier_id] : "—";
              const goal = t.friends_goal || 100;
              const count = t.friends_count ?? 0;
              const pct = Math.min(100, Math.round((count / goal) * 100));
              const hit = count >= goal;
              return (
                <Card key={t.id} className={`bg-white/5 border ${t.is_blocked ? "border-red-500/40 opacity-80" : hit ? "border-emerald-500/30" : "border-white/10"}`}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className={`size-14 rounded-full bg-white/10 overflow-hidden flex-shrink-0 border ${t.is_blocked ? "border-red-500/40 grayscale" : "border-white/10"}`}>
                        {photos[t.id] ? (
                          <img src={photos[t.id] as string} alt={t.profile_name || ""} className="size-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="size-full flex items-center justify-center text-white/30"><UserPlus className="size-5" /></div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{fbNames[t.id] || t.profile_name || extractName(t.profile_url)}</div>
                        <div className="text-[11px] text-white/50 truncate">{supplierName} • {batch?.name || "—"}</div>
                      </div>
                      {t.is_blocked ? (
                        <Badge className="bg-red-500/15 text-red-400 border-red-500/40 gap-1"><Ban className="size-3" /> Bloqueado</Badge>
                      ) : hit ? (
                        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Meta atingida</Badge>
                      ) : t.added ? (
                        <Badge className="bg-sky-500/15 text-sky-400 border-sky-500/30">Solicitado</Badge>
                      ) : (
                        <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30">Pendente</Badge>
                      )}
                    </div>

                    {t.is_blocked && (
                      <div className="rounded-md bg-red-500/10 border border-red-500/30 px-2.5 py-2 text-[11px] text-red-300 flex items-start gap-1.5">
                        <ShieldAlert className="size-3.5 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          Perfil em checkpoint ou desativado — não abra.
                          {t.blocked_at && <span className="block text-red-300/60">Detectado em {new Date(t.blocked_at).toLocaleString("pt-BR")}</span>}
                        </div>
                      </div>
                    )}

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
                            onChange={(e) => updateGoal(t, Math.max(1, parseInt(e.target.value || "1", 10)))}
                            className="w-14 bg-transparent text-sm text-white/70 border-b border-white/20 focus:border-primary outline-none text-center"
                          />
                          <span className="text-xs text-white/50">amigos</span>
                        </div>
                        {t.friends_count != null && (
                          <span className={`text-xs font-semibold ${hit ? "text-emerald-400" : "text-amber-400"}`}>{pct}%</span>
                        )}
                      </div>
                      <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                        <div className={`h-full transition-all ${hit ? "bg-emerald-500" : "bg-primary"}`} style={{ width: `${pct}%` }} />
                      </div>
                      {t.friends_count == null ? (
                        <div className="text-[11px] text-white/40 flex items-center gap-1"><Target className="size-3" /> Sem dados — clique no bookmarklet no perfil</div>
                      ) : (
                        <div className="text-[11px] text-white/40 flex items-center justify-between gap-1">
                          <span>{hit ? "✓ Meta atingida" : `Faltam ${Math.max(0, goal - count)}`}</span>
                          {t.friends_updated_at && (<span>{new Date(t.friends_updated_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>)}
                        </div>
                      )}
                    </div>

                    <a href={t.profile_url} target="_blank" rel="noreferrer" className="block text-xs text-white/60 hover:text-primary break-all">{t.profile_url}</a>

                    <div className="flex flex-col gap-2">
                      {t.is_blocked ? (
                        <Button variant="outline" size="sm" className="w-full gap-1.5 border-red-500/40 text-red-300 hover:bg-red-500/10" onClick={() => setBlocked(t, false)}>
                          <RotateCcw className="size-4" /> Desmarcar bloqueio
                        </Button>
                      ) : t.added ? (
                        <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={() => setAdded(t, false)}>
                          <RotateCcw className="size-4" /> Refazer (desmarcar)
                        </Button>
                      ) : (
                        <>
                          <Button size="sm" className="w-full gap-1.5 bg-primary hover:bg-primary/90" onClick={() => openProfile(t)}>
                            <ExternalLink className="size-4" /> {opened[t.id] ? "Abrir novamente" : "Abrir perfil no Facebook"}
                          </Button>
                          {opened[t.id] && (
                            <Button size="sm" variant="outline" className="w-full gap-1.5 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10" onClick={() => setAdded(t, true)}>
                              <CheckCircle2 className="size-4" /> Marcar como solicitado
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="w-full gap-1.5 text-red-400/80 hover:text-red-300 hover:bg-red-500/10" onClick={() => setBlocked(t, true)}>
                            <Ban className="size-4" /> Marcar como bloqueado
                          </Button>
                        </>
                      )}
                    </div>

                    {t.added && t.added_at && (
                      <div className="text-[11px] text-emerald-400/80 flex items-center gap-1">
                        <CheckCircle2 className="size-3" /> {new Date(t.added_at).toLocaleString("pt-BR")}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}