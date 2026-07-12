import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Users, Wifi, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface Props {
  resellerId: string;
}

interface Row {
  id: string;
  user_id: string | null;
  name: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  raw_data: any;
  product_id: string | null;
  client_name: string | null;
  product_name: string | null;
}

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("pt-BR");
  } catch {
    return "—";
  }
};

const statusColor = (s: string, endDate: string | null) => {
  const now = Date.now();
  const end = endDate ? new Date(endDate).getTime() : 0;
  const active = s === "active" || s === "ativo" || (end && end > now);
  if (s === "cancelled" || s === "cancelado") return "bg-red-500/15 text-red-300 border-red-500/30";
  if (s === "expired" || s === "expirado" || (end && end < now)) return "bg-orange-500/15 text-orange-300 border-orange-500/30";
  if (active) return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  return "bg-muted text-muted-foreground border-border/40";
};

const statusLabel = (s: string, endDate: string | null) => {
  const end = endDate ? new Date(endDate).getTime() : 0;
  const now = Date.now();
  if (s === "cancelled" || s === "cancelado") return "Cancelado";
  if (s === "expired" || s === "expirado") return "Expirado";
  if (end && end < now) return "Expirado";
  if (s === "active" || s === "ativo") return "Ativo";
  return s || "—";
};

export default function ResellerAssinaturas({ resellerId }: Props) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: subs, error } = await supabase
        .from("subscriptions")
        .select("id,user_id,name,status,start_date,end_date,raw_data,product_id")
        .eq("reseller_id", resellerId)
        .order("end_date", { ascending: true });

      if (error) {
        toast.error("Erro ao carregar assinaturas");
        setLoading(false);
        return;
      }

      const userIds = Array.from(new Set((subs || []).map((s) => s.user_id).filter(Boolean))) as string[];
      const productIds = Array.from(new Set((subs || []).map((s) => s.product_id).filter(Boolean))) as string[];

      const [profilesRes, productsRes] = await Promise.all([
        userIds.length
          ? supabase.from("profiles").select("user_id,full_name").in("user_id", userIds)
          : Promise.resolve({ data: [] as any[] }),
        productIds.length
          ? supabase.from("products").select("id,name").in("id", productIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const nameByUser = new Map<string, string>();
      (profilesRes.data || []).forEach((p: any) => nameByUser.set(p.user_id, p.full_name));
      const nameByProduct = new Map<string, string>();
      (productsRes.data || []).forEach((p: any) => nameByProduct.set(p.id, p.name));

      const mapped: Row[] = (subs || []).map((s: any) => ({
        ...s,
        client_name: s.user_id ? nameByUser.get(s.user_id) || null : null,
        product_name: s.product_id ? nameByProduct.get(s.product_id) || s.name : s.name,
      }));

      setRows(mapped);
      setLoading(false);
    })();
  }, [resellerId]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => {
      const ipPort = `${r.raw_data?.host || r.raw_data?.ip || ""}:${r.raw_data?.port || ""}`;
      return (
        (r.client_name || "").toLowerCase().includes(term) ||
        (r.product_name || "").toLowerCase().includes(term) ||
        ipPort.toLowerCase().includes(term) ||
        (r.raw_data?.external_id || "").toString().toLowerCase().includes(term)
      );
    });
  }, [rows, q]);

  const active = rows.filter((r) => {
    const end = r.end_date ? new Date(r.end_date).getTime() : 0;
    return (r.status === "active" || r.status === "ativo") && end > Date.now();
  }).length;

  const expiringSoon = rows.filter((r) => {
    if (!r.end_date) return false;
    const days = (new Date(r.end_date).getTime() - Date.now()) / 86400000;
    return days >= 0 && days <= 5;
  }).length;

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success("Copiado");
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header + KPIs */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
            <Wifi className="size-3.5" /> Assinaturas
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Proxies Alocados <span className="text-muted-foreground font-normal">({rows.length})</span></h1>
          <p className="text-sm text-muted-foreground mt-1">Lista completa dos proxies ativos vinculados aos seus clientes.</p>
        </div>
        <div className="grid grid-cols-3 gap-3 md:min-w-[420px]">
          <Card className="bg-card/60 border-border/40 p-3">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Total</div>
            <div className="text-2xl font-bold mt-1">{rows.length}</div>
          </Card>
          <Card className="bg-emerald-500/5 border-emerald-500/20 p-3">
            <div className="text-[10px] uppercase tracking-widest text-emerald-400">Ativos</div>
            <div className="text-2xl font-bold mt-1 text-emerald-300">{active}</div>
          </Card>
          <Card className="bg-orange-500/5 border-orange-500/20 p-3">
            <div className="text-[10px] uppercase tracking-widest text-orange-400">Vence ≤ 5d</div>
            <div className="text-2xl font-bold mt-1 text-orange-300">{expiringSoon}</div>
          </Card>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por cliente, IP, produto ou ID…"
          className="pl-9 bg-card/60 border-border/40"
        />
      </div>

      {/* Table */}
      <Card className="bg-card/60 border-border/40 overflow-hidden">
        {loading ? (
          <div className="p-16 flex items-center justify-center">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center text-muted-foreground">
            <Users className="size-8 mx-auto mb-3 opacity-50" />
            {rows.length === 0 ? "Você ainda não tem clientes com proxies ativos." : "Nenhum resultado para essa busca."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Cliente</th>
                  <th className="text-left px-4 py-3 font-medium">Proxy IP:Porta</th>
                  <th className="text-left px-4 py-3 font-medium">ID Proxy</th>
                  <th className="text-left px-4 py-3 font-medium">Produto</th>
                  <th className="text-center px-4 py-3 font-medium">Status</th>
                  <th className="text-center px-4 py-3 font-medium">Início</th>
                  <th className="text-center px-4 py-3 font-medium">Vencimento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filtered.map((r) => {
                  const host = r.raw_data?.host || r.raw_data?.ip || r.raw_data?.proxy_address || "—";
                  const port = r.raw_data?.port || r.raw_data?.proxy_port || "";
                  const ipPort = port ? `${host}:${port}` : host;
                  const externalId = r.raw_data?.external_id || r.raw_data?.proxy_id || "—";
                  return (
                    <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium">{r.client_name || <span className="text-muted-foreground italic">Sem cliente</span>}</td>
                      <td className="px-4 py-3 font-mono text-xs">
                        <button
                          onClick={() => copy(ipPort, r.id + "ip")}
                          className="inline-flex items-center gap-1.5 hover:text-primary transition-colors"
                          title="Copiar"
                        >
                          {ipPort}
                          {copied === r.id + "ip" ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3 opacity-40" />}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">#{externalId}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.product_name || "—"}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="outline" className={statusColor(r.status, r.end_date)}>
                          {statusLabel(r.status, r.end_date)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{fmtDate(r.start_date)}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{fmtDate(r.end_date)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}