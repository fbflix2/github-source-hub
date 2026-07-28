import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coins, Loader2, Search, Save } from "lucide-react";

interface ProxyProduct {
  id: string;
  name: string;
  price: number | null;
  reseller_cost: number | null;
  icon_type: string | null;
}

export default function AdminRevendaProxyCusto() {
  const [rows, setRows] = useState<ProxyProduct[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("id,name,price,reseller_cost,icon_type")
      .eq("icon_type", "proxy")
      .order("name", { ascending: true });
    if (error) toast.error(error.message);
    // Proxy Rotativo é uso interno — nunca disponível para revenda
    const list = ((data as ProxyProduct[]) || []).filter(
      (p) => !/rotativ/i.test(p.name || "")
    );
    setRows(list);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => r.name?.toLowerCase().includes(term));
  }, [rows, q]);

  const save = async (row: ProxyProduct) => {
    const raw = drafts[row.id];
    if (raw === undefined) return;
    const value = Number(raw.replace(",", "."));
    if (Number.isNaN(value) || value < 0) {
      toast.error("Valor inválido");
      return;
    }
    setSavingId(row.id);
    const { error } = await supabase
      .from("products")
      .update({ reseller_cost: value })
      .eq("id", row.id);
    setSavingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Custo atualizado");
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, reseller_cost: value } : r)));
    setDrafts((d) => {
      const c = { ...d };
      delete c[row.id];
      return c;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center size-10 rounded-xl bg-gradient-to-br from-primary to-red-900 shadow-lg shadow-primary/20">
          <Coins className="text-primary-foreground size-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Custo de revenda por proxy</h1>
          <p className="text-xs text-muted-foreground">
            Defina o custo FBFlix cobrado do saldo do revendedor a cada venda/renovação de cada proxy.
          </p>
        </div>
      </div>

      <Card className="p-4 bg-card/60 border-border/40">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar proxy pelo nome…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center bg-card/60 border-border/40">
          <Coins className="size-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-bold text-foreground">Nenhum proxy encontrado</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastre produtos com o ícone "proxy" para configurá-los aqui.
          </p>
        </Card>
      ) : (
        <Card className="bg-card/60 border-border/40 overflow-hidden">
          <div className="grid grid-cols-[1fr_140px_200px_120px] gap-3 px-4 py-3 border-b border-border/40 bg-muted/30 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <div>Produto</div>
            <div>Preço público</div>
            <div>Custo revenda (R$)</div>
            <div className="text-right">Ação</div>
          </div>
          {filtered.map((row) => {
            const draft = drafts[row.id];
            const current = draft ?? String(row.reseller_cost ?? 0);
            const dirty = draft !== undefined && Number(draft.replace(",", ".")) !== Number(row.reseller_cost ?? 0);
            const margin = Number(row.price || 0) - Number(row.reseller_cost ?? 0);
            return (
              <div
                key={row.id}
                className="grid grid-cols-[1fr_140px_200px_120px] gap-3 px-4 py-3 border-b border-border/30 last:border-b-0 items-center"
              >
                <div className="min-w-0">
                  <div className="font-medium text-foreground truncate">{row.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Margem estimada:{" "}
                    <span className={margin >= 0 ? "text-emerald-400" : "text-red-400"}>
                      R$ {margin.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div>
                  <Badge variant="outline" className="border-border/60 text-foreground">
                    R$ {Number(row.price || 0).toFixed(2)}
                  </Badge>
                </div>
                <div>
                  <Input
                    inputMode="decimal"
                    value={current}
                    onChange={(e) => setDrafts((d) => ({ ...d, [row.id]: e.target.value }))}
                    className={dirty ? "border-primary" : ""}
                  />
                </div>
                <div className="text-right">
                  <Button
                    size="sm"
                    onClick={() => save(row)}
                    disabled={!dirty || savingId === row.id}
                    className="gap-1.5"
                  >
                    {savingId === row.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Save className="size-3.5" />
                    )}
                    Salvar
                  </Button>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
