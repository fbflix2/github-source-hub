import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Eye, EyeOff, Globe, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface Props {
  ctClientId: string;
}

export function ClientScaleProProxies({ ctClientId }: Props) {
  const [reveal, setReveal] = useState<Record<string, boolean>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["ct-proxies-self", ctClientId],
    enabled: !!ctClientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ct_client_proxies")
        .select("id, assigned_at, subscription_id, subscriptions(id, name, type, raw_data, end_date)")
        .eq("ct_client_id", ctClientId)
        .is("released_at", null);
      if (error) throw error;
      return data || [];
    },
  });

  const copy = (v: string, label: string) => {
    navigator.clipboard.writeText(v);
    toast.success(`${label} copiado`);
  };

  if (isLoading) return null;
  if (!data || data.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
          <Globe className="h-4 w-4 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">Proxies inclusos no plano</h3>
          <p className="text-xs text-muted-foreground">Sem cobrança extra — inclusos na sua assinatura Scale Pro</p>
        </div>
      </div>

      <div className="space-y-2.5">
        {data.map((row: any) => {
          const sub = row.subscriptions;
          const rd = sub?.raw_data || {};
          const host = rd.proxy_address || "—";
          const port = rd.port || "—";
          const user = rd.username || "—";
          const pass = rd.password || "";
          const country = (rd.country_code || "").toUpperCase();
          const isRevealed = reveal[row.id];
          const full = `${host}:${port}:${user}:${pass}`;

          return (
            <div key={row.id} className="rounded-lg border border-border/60 bg-background/40 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span className="text-sm font-medium truncate">{sub?.name || "Proxy"}</span>
                  {country && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium">
                      {country}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => copy(full, "Proxy")}
                  className="text-xs px-2.5 py-1 rounded-md border border-border/60 hover:border-emerald-500/40 hover:text-emerald-400 transition-colors inline-flex items-center gap-1.5"
                >
                  <Copy className="h-3 w-3" /> Copiar tudo
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Field label="Host" value={host} onCopy={() => copy(host, "Host")} />
                <Field label="Porta" value={String(port)} onCopy={() => copy(String(port), "Porta")} />
                <Field label="Usuário" value={user} onCopy={() => copy(user, "Usuário")} />
                <Field
                  label="Senha"
                  value={isRevealed ? pass : "••••••••"}
                  onCopy={() => copy(pass, "Senha")}
                  extra={
                    <button
                      onClick={() => setReveal((r) => ({ ...r, [row.id]: !r[row.id] }))}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {isRevealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </button>
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onCopy,
  extra,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border/40 bg-card/30 px-2.5 py-1.5 flex items-center justify-between gap-2">
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="font-mono text-xs truncate">{value}</div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {extra}
        <button onClick={onCopy} className="text-muted-foreground hover:text-foreground">
          <Copy className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}