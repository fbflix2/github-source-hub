import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, AlertTriangle, Link2, Copy, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const ADMIN_LABEL = "Admin (não vinculado)";
const PER_PAGE = 15;

interface UnlinkedSub {
  id: string;
  code: string;
  status: string;
  product_name: string;
  end_date: string;
  proxy_ip?: string;
  proxy_port?: number;
  notes?: string;
}

export default function ProxyUnlinkedList() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [linkModal, setLinkModal] = useState<UnlinkedSub | null>(null);
  const [linkSearch, setLinkSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Get admin user_id
  const { data: adminUserId } = useQuery({
    queryKey: ["admin-user-id"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id || null;
    },
  });

  // Fetch unlinked subscriptions (still owned by admin)
  const { data: unlinked, isLoading } = useQuery({
    queryKey: ["unlinked-subscriptions", adminUserId],
    queryFn: async () => {
      if (!adminUserId) return [];
      let all: any[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data } = await supabase
          .from("subscriptions")
          .select("id, name, status, end_date, raw_data, type")
          .eq("user_id", adminUserId)
          .eq("type", "proxybr")
          .order("created_at", { ascending: false })
          .range(from, from + pageSize - 1);
        if (!data?.length) break;
        all = [...all, ...data];
        if (data.length < pageSize) break;
        from += pageSize;
      }

      return all.map((s: any): UnlinkedSub => {
        const raw = s.raw_data || {};
        const proxies = raw.proxies?.data;
        let proxy_ip: string | undefined;
        let proxy_port: number | undefined;
        if (proxies?.length > 0) {
          const p = proxies[0];
          if (p.parsed) {
            proxy_ip = p.parsed.ip;
            proxy_port = p.parsed.port;
          } else if (p.code && typeof p.code === "string") {
            const parts = p.code.split(":");
            if (parts.length >= 2) {
              proxy_ip = parts[0];
              proxy_port = parseInt(parts[1], 10);
            }
          }
        }
        return {
          id: s.id,
          code: s.name,
          status: s.status,
          product_name: raw.product?.name || s.name,
          end_date: s.end_date || "",
          proxy_ip,
          proxy_port,
          notes: raw.notes || "",
        };
      });
    },
    enabled: !!adminUserId,
  });

  // Profiles for manual linking
  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles-link"],
    queryFn: async () => {
      let all: any[] = [];
      let from = 0;
      while (true) {
        const { data } = await supabase.from("profiles").select("user_id, full_name").range(from, from + 999);
        if (!data?.length) break;
        all = [...all, ...data];
        if (data.length < 1000) break;
        from += 1000;
      }
      return all;
    },
  });

  const filtered = useMemo(() => {
    if (!unlinked) return [];
    if (!search.trim()) return unlinked;
    const term = search.toLowerCase();
    return unlinked.filter(s =>
      s.code.toLowerCase().includes(term) ||
      s.product_name.toLowerCase().includes(term) ||
      (s.proxy_ip || "").includes(term) ||
      (s.notes || "").toLowerCase().includes(term)
    );
  }, [unlinked, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(code);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleLink = async (sub: UnlinkedSub, userId: string) => {
    try {
      await supabase.from("subscriptions").update({ user_id: userId }).eq("id", sub.id);
      toast.success(`Proxy ${sub.code} vinculada!`);
      queryClient.invalidateQueries({ queryKey: ["unlinked-subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-subscriptions-cached"] });
      setLinkModal(null);
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    }
  };

  const filteredProfiles = useMemo(() => {
    if (!profiles || !linkSearch.trim()) return profiles || [];
    const term = linkSearch.toLowerCase();
    return profiles.filter((p: any) => p.full_name?.toLowerCase().includes(term));
  }, [profiles, linkSearch]);

  if (!unlinked?.length && !isLoading) {
    return (
      <div className="flex flex-col items-center gap-3 p-8 rounded-xl border border-dashed border-border bg-muted/20">
        <Check className="w-8 h-8 text-green-400" />
        <p className="text-sm text-foreground font-medium">Todas as assinaturas estão vinculadas!</p>
        <p className="text-xs text-muted-foreground">Nenhuma proxy sem cliente identificado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-400" />
          <div>
            <h3 className="text-sm font-bold text-foreground">{unlinked?.length || 0} Proxies sem Cliente</h3>
            <p className="text-xs text-muted-foreground">Assinaturas que não foram vinculadas automaticamente</p>
          </div>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar código, produto, IP..."
            className="pl-9 h-9 text-sm bg-card border-border"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden bg-card/50">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground text-xs bg-muted/30">
              <th className="text-left p-3">Código</th>
              <th className="text-left p-3">Produto</th>
              <th className="text-left p-3">IP</th>
              <th className="text-left p-3">Vencimento</th>
              <th className="text-left p-3">Notas (API)</th>
              <th className="text-left p-3 w-24">Ação</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="p-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : paginated.map(sub => (
              <tr key={sub.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="p-3">
                  <button
                    onClick={() => handleCopyCode(sub.code)}
                    className="flex items-center gap-1.5 font-mono text-xs text-foreground hover:text-primary transition-colors"
                  >
                    {copiedId === sub.code ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
                    {sub.code}
                  </button>
                </td>
                <td className="p-3 text-foreground">{sub.product_name}</td>
                <td className="p-3 font-mono text-xs text-muted-foreground">
                  {sub.proxy_ip ? `${sub.proxy_ip}:${sub.proxy_port}` : "—"}
                </td>
                <td className="p-3 text-xs text-muted-foreground">
                  {sub.end_date ? format(parseISO(sub.end_date), "dd/MM/yy", { locale: ptBR }) : "—"}
                </td>
                <td className="p-3 text-xs text-muted-foreground max-w-[200px] truncate" title={sub.notes}>
                  {sub.notes || "—"}
                </td>
                <td className="p-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() => { setLinkModal(sub); setLinkSearch(""); }}
                  >
                    <Link2 className="w-3 h-3" />
                    Vincular
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{filtered.length} resultados</p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs text-muted-foreground">{page}/{totalPages}</span>
            <Button size="sm" variant="ghost" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Link Modal */}
      <Dialog open={!!linkModal} onOpenChange={() => setLinkModal(null)}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Vincular {linkModal?.code}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Produto: {linkModal?.product_name} · IP: {linkModal?.proxy_ip || "N/A"}
            </p>
            {linkModal?.notes && (
              <p className="text-xs text-yellow-400 bg-yellow-500/10 rounded-lg p-2">
                Notas da API: {linkModal.notes}
              </p>
            )}
            <Input
              value={linkSearch}
              onChange={e => setLinkSearch(e.target.value)}
              placeholder="Buscar cliente por nome..."
              className="h-9 text-sm"
            />
            <div className="max-h-60 overflow-y-auto space-y-1">
              {filteredProfiles.slice(0, 30).map((p: any) => (
                <button
                  key={p.user_id}
                  onClick={() => linkModal && handleLink(linkModal, p.user_id)}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-muted/50 transition-colors text-foreground"
                >
                  {p.full_name || "Sem nome"}
                </button>
              ))}
              {filteredProfiles.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhum cliente encontrado</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
