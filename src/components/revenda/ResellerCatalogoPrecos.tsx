import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Package,
  Server,
  Save,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Eye,
  EyeOff,
  TrendingUp,
  Coins,
  Tag,
  X,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  resellerId: string;
  model: "percentage" | "credit";
  proxyUnitCost: number;
  commissionRate: number;
  proxyPriceMultiplier?: number | null;
  proxyFixedPrice?: number | null;
  proxyPriceMode?: string | null;
}

interface ProxyProduct {
  id: string;
  name: string;
  price: number;
  status: string;
  available: boolean;
  image_url: string | null;
  reseller_cost: number | null;
  tags: string[] | null;
}

interface Override {
  id: string;
  product_id: string;
  custom_price: number;
  enabled: boolean;
}

const BRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const MAX_TAGS = 5;
const SUGGESTED_TAGS = [
  "Facebook",
  "Web Scraping",
  "Tráfego Pago",
  "Automação",
  "Redes Sociais",
  "Alta Velocidade",
  "IP Dedicado",
  "Residencial",
  "Promoção",
];

export default function ResellerCatalogoPrecos({
  resellerId,
  model,
  proxyUnitCost,
  commissionRate,
  proxyPriceMultiplier,
  proxyFixedPrice,
  proxyPriceMode,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [products, setProducts] = useState<ProxyProduct[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [tagOverrides, setTagOverrides] = useState<Record<string, string[]>>({});
  const [tagEditing, setTagEditing] = useState<ProxyProduct | null>(null);
  const [tagDraft, setTagDraft] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [tagSaving, setTagSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: prods }, { data: ovs }, { data: tagRows }] = await Promise.all([
      supabase
        .from("products")
        .select("id, name, price, status, available, image_url, reseller_cost, tags, product_categories!inner(slug)")
        .eq("status", "active")
        .eq("product_categories.slug", "proxy")
        .order("name", { ascending: true }),
      supabase.from("reseller_price_overrides").select("*").eq("reseller_id", resellerId),
      supabase.from("reseller_product_tags").select("product_id, tags").eq("reseller_id", resellerId),
    ]);
    // Proxy Rotativo é uso interno — nunca disponível para revenda
    setProducts((((prods as any[]) || []).filter((p) => !/rotativ/i.test(p.name || "")) as any));
    const oMap: Record<string, Override> = {};
    const dMap: Record<string, string> = {};
    ((ovs as Override[]) || []).forEach((o) => {
      oMap[o.product_id] = o;
      dMap[o.product_id] = Number(o.custom_price).toFixed(2);
    });
    setOverrides(oMap);
    setDrafts(dMap);
    const tMap: Record<string, string[]> = {};
    ((tagRows as any[]) || []).forEach((r) => {
      tMap[r.product_id] = (r.tags as string[]) || [];
    });
    setTagOverrides(tMap);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resellerId]);

  const suggestedPrice = (p: ProxyProduct) => {
    if (proxyPriceMode === "fixed" && proxyFixedPrice != null) return Number(proxyFixedPrice);
    const mult = Number(proxyPriceMultiplier ?? 1.5) || 1.5;
    return Number(p.price || 0) * mult;
  };

  const costFor = (p: ProxyProduct) => {
    const perProduct = Number(p.reseller_cost ?? 0);
    if (perProduct > 0) return perProduct;
    if (model === "credit") return Number(proxyUnitCost || 0);
    return Number(p.price || 0) * (1 - Number(commissionRate || 0) / 100);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, search]);

  const totals = useMemo(() => {
    let totalMargin = 0;
    let counted = 0;
    let active = 0;
    products.forEach((p) => {
      const price = Number(overrides[p.id]?.custom_price ?? suggestedPrice(p));
      const c = costFor(p);
      if (price > 0) {
        totalMargin += ((price - c) / price) * 100;
        counted++;
      }
      const o = overrides[p.id];
      if (!o || o.enabled) active++;
    });
    return {
      avgMargin: counted ? totalMargin / counted : 0,
      active,
      total: products.length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, overrides]);

  const upsertOverride = async (product: ProxyProduct, patch: Partial<Override>) => {
    const existing = overrides[product.id];
    setSaving(product.id);
    try {
      if (existing) {
        const { error } = await supabase
          .from("reseller_price_overrides")
          .update(patch)
          .eq("id", existing.id);
        if (error) throw error;
        setOverrides((m) => ({ ...m, [product.id]: { ...existing, ...patch } as Override }));
      } else {
        const payload = {
          reseller_id: resellerId,
          product_id: product.id,
          custom_price: patch.custom_price ?? suggestedPrice(product),
          enabled: patch.enabled ?? true,
        };
        const { data, error } = await supabase
          .from("reseller_price_overrides")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        setOverrides((m) => ({ ...m, [product.id]: data as Override }));
      }
    } catch (e: any) {
      toast.error("Erro ao salvar: " + (e?.message ?? "desconhecido"));
    } finally {
      setSaving(null);
    }
  };

  const savePrice = async (p: ProxyProduct) => {
    const raw = drafts[p.id];
    const value = Number((raw ?? "").toString().replace(",", "."));
    if (!Number.isFinite(value) || value < 0) {
      toast.error("Preço inválido");
      return;
    }
    await upsertOverride(p, { custom_price: value, enabled: overrides[p.id]?.enabled ?? true });
    toast.success("Preço atualizado");
  };

  const toggleActive = async (p: ProxyProduct, next: boolean) => {
    await upsertOverride(p, { enabled: next });
    toast.success(next ? "Item ativado na loja" : "Item ocultado da loja");
  };

  const effectiveTags = (p: ProxyProduct): string[] =>
    tagOverrides[p.id] ?? ((p.tags || []).filter((t) => t.toLowerCase() !== "proxyfbflix"));

  const openTagEditor = (p: ProxyProduct) => {
    setTagEditing(p);
    setTagDraft(effectiveTags(p).slice(0, MAX_TAGS));
    setTagInput("");
  };

  const addTag = (raw: string) => {
    const tag = raw.trim();
    if (!tag) return;
    if (tagDraft.length >= MAX_TAGS) {
      toast.error(`Máximo de ${MAX_TAGS} tags por produto`);
      return;
    }
    if (tagDraft.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      toast.error("Tag já adicionada");
      return;
    }
    setTagDraft((d) => [...d, tag]);
    setTagInput("");
  };

  const saveTags = async () => {
    if (!tagEditing) return;
    setTagSaving(true);
    try {
      const { error } = await supabase
        .from("reseller_product_tags")
        .upsert(
          { reseller_id: resellerId, product_id: tagEditing.id, tags: tagDraft },
          { onConflict: "reseller_id,product_id" }
        );
      if (error) throw error;
      setTagOverrides((m) => ({ ...m, [tagEditing.id]: tagDraft }));
      toast.success("Tags atualizadas na sua loja");
      setTagEditing(null);
    } catch (e: any) {
      toast.error("Erro ao salvar tags: " + (e?.message ?? "desconhecido"));
    } finally {
      setTagSaving(false);
    }
  };

  const resetTags = async () => {
    if (!tagEditing) return;
    setTagSaving(true);
    try {
      const { error } = await supabase
        .from("reseller_product_tags")
        .delete()
        .eq("reseller_id", resellerId)
        .eq("product_id", tagEditing.id);
      if (error) throw error;
      setTagOverrides((m) => {
        const next = { ...m };
        delete next[tagEditing.id];
        return next;
      });
      toast.success("Tags padrão restauradas");
      setTagEditing(null);
    } catch (e: any) {
      toast.error("Erro ao restaurar: " + (e?.message ?? "desconhecido"));
    } finally {
      setTagSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Package className="size-6 text-primary" /> Catálogo & Preços
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Defina o preço de venda de cada proxy e escolha quais aparecem na sua loja pública.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4 bg-card/60 border-border/40 flex items-center gap-3">
          <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Package className="size-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Produtos no catálogo</p>
            <p className="text-xl font-bold">{totals.total}</p>
          </div>
        </Card>
        <Card className="p-4 bg-card/60 border-border/40 flex items-center gap-3">
          <div className="size-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Eye className="size-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Ativos na loja</p>
            <p className="text-xl font-bold">{totals.active}</p>
          </div>
        </Card>
        <Card className="p-4 bg-card/60 border-border/40 flex items-center gap-3">
          <div className="size-10 rounded-lg bg-sky-500/10 flex items-center justify-center">
            <TrendingUp className="size-5 text-sky-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Margem média</p>
            <p className="text-xl font-bold">{totals.avgMargin.toFixed(1)}%</p>
          </div>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar proxy..."
          className="pl-9 bg-background/60"
        />
      </div>

      {/* Table */}
      <Card className="bg-card/60 border-border/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/20 text-muted-foreground text-[11px] uppercase tracking-wider">
              <tr>
                <th className="text-left px-5 py-3">Proxy</th>
                <th className="text-left px-4 py-3">Tags na sua loja</th>
                <th className="text-right px-4 py-3">
                  <span className="inline-flex items-center gap-1">
                    <Coins className="size-3" /> Custo
                  </span>
                </th>
                <th className="text-right px-4 py-3">Preço de venda</th>
                <th className="text-right px-4 py-3">Lucro / Margem</th>
                <th className="text-center px-4 py-3">Ativo na loja</th>
                <th className="text-right px-5 py-3">Ação</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    Nenhum proxy encontrado.
                  </td>
                </tr>
              )}
              {filtered.map((p) => {
                const o = overrides[p.id];
                const cost = costFor(p);
                const current = Number(o?.custom_price ?? suggestedPrice(p));
                const draftStr = drafts[p.id] ?? current.toFixed(2);
                const draft = Number(draftStr.toString().replace(",", "."));
                const price = Number.isFinite(draft) ? draft : current;
                const profit = price - cost;
                const margin = price > 0 ? (profit / price) * 100 : 0;
                const enabled = o ? o.enabled : true;
                const isDirty =
                  Math.abs((o?.custom_price ?? suggestedPrice(p)) - price) > 0.001;
                return (
                  <tr
                    key={p.id}
                    className={cn(
                      "border-t border-border/30 hover:bg-muted/10 transition-colors",
                      !enabled && "opacity-60"
                    )}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {p.image_url ? (
                          <img
                            src={p.image_url}
                            alt=""
                            className="size-9 rounded-lg object-cover ring-1 ring-border/40"
                          />
                        ) : (
                          <div className="size-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                            <Server className="size-4 text-primary" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-foreground">{p.name}</p>
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                            {enabled ? (
                              <>
                                <Eye className="size-3 text-emerald-500" /> visível
                              </>
                            ) : (
                              <>
                                <EyeOff className="size-3" /> oculto
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-[240px]">
                      <button
                        type="button"
                        onClick={() => openTagEditor(p)}
                        className="group flex flex-wrap items-center gap-1.5 text-left"
                      >
                        {effectiveTags(p).length === 0 ? (
                          <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                            <Plus className="size-3" /> adicionar tags
                          </span>
                        ) : (
                          effectiveTags(p).slice(0, MAX_TAGS).map((t) => (
                            <Badge
                              key={t}
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 border-primary/30 text-primary bg-primary/5"
                            >
                              {t}
                            </Badge>
                          ))
                        )}
                        <Tag className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    </td>
                    <td className="text-right px-4 py-3 font-mono text-muted-foreground">
                      {BRL(cost)}
                    </td>
                    <td className="text-right px-4 py-3">
                      <div className="flex justify-end">
                        <div className="relative w-32">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
                            R$
                          </span>
                          <Input
                            value={drafts[p.id] ?? current.toFixed(2)}
                            onChange={(e) =>
                              setDrafts((d) => ({ ...d, [p.id]: e.target.value }))
                            }
                            className="h-9 pl-7 text-right font-mono bg-background/60"
                            inputMode="decimal"
                          />
                        </div>
                      </div>
                    </td>
                    <td className="text-right px-4 py-3">
                      <div className="flex flex-col items-end">
                        <span
                          className={cn(
                            "font-bold font-mono",
                            profit >= 0 ? "text-emerald-400" : "text-primary"
                          )}
                        >
                          {profit >= 0 ? (
                            <ArrowUpRight className="inline size-3 mr-0.5" />
                          ) : (
                            <ArrowDownRight className="inline size-3 mr-0.5" />
                          )}
                          {BRL(profit)}
                        </span>
                        <span
                          className={cn(
                            "text-[11px]",
                            margin >= 30
                              ? "text-emerald-400/70"
                              : margin >= 10
                                ? "text-amber-400/70"
                                : "text-primary"
                          )}
                        >
                          {margin.toFixed(1)}% margem
                        </span>
                      </div>
                    </td>
                    <td className="text-center px-4 py-3">
                      <div className="flex justify-center">
                        <Switch
                          checked={enabled}
                          onCheckedChange={(v) => toggleActive(p, v)}
                          disabled={saving === p.id}
                        />
                      </div>
                    </td>
                    <td className="text-right px-5 py-3">
                      <Button
                        size="sm"
                        onClick={() => savePrice(p)}
                        disabled={saving === p.id || !isDirty}
                        className="gap-1.5"
                      >
                        {saving === p.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Save className="size-3.5" />
                        )}
                        Salvar
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-[11px] text-muted-foreground">
        Dica: use o botão de <span className="text-foreground font-medium">Ativo na loja</span> para
        controlar quais proxies seus clientes podem comprar no seu domínio. Itens desativados ficam
        ocultos automaticamente.
      </p>

      {/* Tag editor */}
      <Dialog open={!!tagEditing} onOpenChange={(o) => !o && setTagEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="size-4 text-primary" /> Tags · {tagEditing?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Estas tags aparecem apenas na <span className="text-foreground font-medium">sua loja</span>.
              Máximo de {MAX_TAGS} tags por produto.
            </p>
            <div className="flex flex-wrap gap-2 min-h-8">
              {tagDraft.length === 0 && (
                <span className="text-xs text-muted-foreground">Nenhuma tag</span>
              )}
              {tagDraft.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-medium"
                >
                  {t}
                  <button onClick={() => setTagDraft((d) => d.filter((x) => x !== t))}>
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag(tagInput);
                  }
                }}
                placeholder="Nova tag e Enter..."
                maxLength={24}
                className="bg-background/60"
              />
              <Button type="button" variant="outline" onClick={() => addTag(tagInput)}>
                <Plus className="size-4" />
              </Button>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground mb-2">Sugestões</p>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_TAGS.filter(
                  (s) => !tagDraft.some((t) => t.toLowerCase() === s.toLowerCase())
                ).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addTag(s)}
                    className="px-2 py-1 rounded-md text-[11px] bg-muted/30 hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    + {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={resetTags} disabled={tagSaving}>
              Restaurar padrão
            </Button>
            <Button onClick={saveTags} disabled={tagSaving} className="gap-1.5">
              {tagSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}