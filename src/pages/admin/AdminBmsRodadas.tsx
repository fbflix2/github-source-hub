import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Trash2, Save, RefreshCw, Phone, ExternalLink } from "lucide-react";

type Lead = {
  id: string;
  seller_name: string;
  seller_whatsapp: string;
  bm_name: string;
  country: string | null;
  verification: string | null;
  limit_daily: string | null;
  accounts: number | null;
  created_year: string | null;
  risk: string | null;
  method: string | null;
  gasto_total: number | null;
  asking_price: number;
  notes: string | null;
  status: string;
  created_at: string;
};

type MktBm = {
  id: string;
  name: string;
  country: string;
  code: string;
  verification: string;
  limit_daily: string;
  accounts: number;
  created_year: string;
  risk: string;
  method: string;
  gasto_total: number;
  price: number;
  is_active: boolean;
  sort_order: number;
  cost?: number;
  tax_percent?: number;
  details?: string[];
};

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function AdminBmsRodadas() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [bms, setBms] = useState<MktBm[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: l }, { data: b }, { data: f }] = await Promise.all([
      supabase.from("marketplace_bm_leads").select("*").order("created_at", { ascending: false }),
      supabase.from("marketplace_bms").select("*").order("sort_order", { ascending: true }),
      supabase.from("marketplace_bm_finance").select("*"),
    ]);
    const finMap = new Map<string, { cost: number; tax_percent: number }>();
    (f || []).forEach((row: any) => finMap.set(row.bm_id, { cost: Number(row.cost) || 0, tax_percent: Number(row.tax_percent) || 0 }));
    setLeads((l as Lead[]) || []);
    setBms(((b as MktBm[]) || []).map(bm => ({
      ...bm,
      cost: finMap.get(bm.id)?.cost ?? 0,
      tax_percent: finMap.get(bm.id)?.tax_percent ?? 0,
      details: Array.isArray((bm as any).details) ? (bm as any).details : [],
    })));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const updateBmField = (id: string, key: keyof MktBm, value: any) => {
    setBms(prev => prev.map(b => b.id === id ? { ...b, [key]: value } : b));
  };

  const saveBm = async (bm: MktBm) => {
    const { error } = await supabase.from("marketplace_bms").update({
      name: bm.name,
      price: Number(bm.price) || 0,
      limit_daily: bm.limit_daily,
      accounts: Number(bm.accounts) || 0,
      created_year: bm.created_year,
      risk: bm.risk,
      method: bm.method,
      verification: bm.verification,
      gasto_total: Number(bm.gasto_total) || 0,
      is_active: bm.is_active,
      sort_order: Number(bm.sort_order) || 0,
      details: (bm.details || []).map(s => s.trim()).filter(Boolean),
    }).eq("id", bm.id);
    if (error) toast.error("Erro ao salvar: " + error.message);
    else {
      const { error: fErr } = await supabase.from("marketplace_bm_finance").upsert({
        bm_id: bm.id,
        cost: Number(bm.cost) || 0,
        tax_percent: Number(bm.tax_percent) || 0,
      });
      if (fErr) toast.error("Erro ao salvar financeiro: " + fErr.message);
      else toast.success("BM atualizada");
    }
  };

  const deleteBm = async (id: string) => {
    if (!confirm("Remover esta BM do marketplace?")) return;
    const { error } = await supabase.from("marketplace_bms").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setBms(prev => prev.filter(b => b.id !== id));
    toast.success("Removida");
  };

  const addBm = async () => {
    const { data, error } = await supabase.from("marketplace_bms").insert({
      name: "Nova BM",
      price: 0,
      sort_order: (bms[bms.length - 1]?.sort_order ?? 0) + 1,
    }).select().single();
    if (error) return toast.error(error.message);
    setBms(prev => [...prev, data as MktBm]);
  };

  const updateLeadStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("marketplace_bm_leads").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l));
  };

  const deleteLead = async (id: string) => {
    if (!confirm("Excluir este formulário?")) return;
    const { error } = await supabase.from("marketplace_bm_leads").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setLeads(prev => prev.filter(l => l.id !== id));
  };

  const openWA = (phone: string) => {
    const clean = phone.replace(/\D/g, "");
    window.open(`https://wa.me/${clean.startsWith("55") ? clean : "55" + clean}`, "_blank");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">BMs Rodadas</h1>
          <p className="text-sm text-muted-foreground">Formulários de venda recebidos e catálogo do marketplace</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      <Tabs defaultValue="leads">
        <TabsList>
          <TabsTrigger value="leads">
            Formulários {leads.filter(l => l.status === "novo").length > 0 && (
              <Badge className="ml-2" variant="destructive">{leads.filter(l => l.status === "novo").length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="catalog">Catálogo & Preços ({bms.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="space-y-3 mt-4">
          {leads.length === 0 && <Card className="p-8 text-center text-muted-foreground">Nenhum formulário recebido ainda.</Card>}
          {leads.map(l => (
            <Card key={l.id} className="p-4">
              <div className="flex justify-between items-start gap-4 flex-wrap">
                <div className="flex-1 min-w-[280px]">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold">{l.bm_name}</h3>
                    <Badge variant={l.status === "novo" ? "destructive" : l.status === "aprovado" ? "default" : "secondary"}>
                      {l.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1">
                    <div><b>Vendedor:</b> {l.seller_name}</div>
                    <div><b>WhatsApp:</b> {l.seller_whatsapp}</div>
                    <div><b>País:</b> {l.country}</div>
                    <div><b>Verificação:</b> {l.verification}</div>
                    <div><b>Limite:</b> {l.limit_daily || "-"}</div>
                    <div><b>Contas:</b> {l.accounts ?? "-"}</div>
                    <div><b>Criada em:</b> {l.created_year}</div>
                    <div><b>Risco:</b> {l.risk}</div>
                    <div><b>Método:</b> {l.method}</div>
                    <div><b>Gasto total:</b> {l.gasto_total ? fmtBRL(l.gasto_total) : "-"}</div>
                    <div className="col-span-2 md:col-span-3"><b>Preço pedido:</b> <span className="text-primary font-semibold">{fmtBRL(l.asking_price)}</span></div>
                    {l.notes && <div className="col-span-2 md:col-span-3"><b>Obs.:</b> {l.notes}</div>}
                    <div className="col-span-2 md:col-span-3 text-xs opacity-60">Recebido em {new Date(l.created_at).toLocaleString("pt-BR")}</div>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Button size="sm" variant="outline" onClick={() => openWA(l.seller_whatsapp)}>
                    <Phone className="h-3 w-3 mr-1" /> WhatsApp
                  </Button>
                  <select
                    className="text-xs bg-background border rounded px-2 py-1"
                    value={l.status}
                    onChange={e => updateLeadStatus(l.id, e.target.value)}
                  >
                    <option value="novo">Novo</option>
                    <option value="em_analise">Em análise</option>
                    <option value="aprovado">Aprovado</option>
                    <option value="recusado">Recusado</option>
                    <option value="concluido">Concluído</option>
                  </select>
                  <Button size="sm" variant="ghost" onClick={() => deleteLead(l.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="catalog" className="space-y-3 mt-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">Edite os preços e informações das BMs exibidas em <a href="/marketplace" target="_blank" className="text-primary underline">/marketplace</a></p>
            <Button size="sm" onClick={addBm}>+ Nova BM</Button>
          </div>
          <div className="space-y-2">
            {bms.map(bm => (
              <Card key={bm.id} className="p-3">
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
                  <div className="col-span-2">
                    <label className="text-xs text-muted-foreground">Nome</label>
                    <Input value={bm.name} onChange={e => updateBmField(bm.id, "name", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Preço</label>
                    <Input type="number" step="0.01" value={bm.price} onChange={e => updateBmField(bm.id, "price", Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Limite/dia</label>
                    <Input value={bm.limit_daily} onChange={e => updateBmField(bm.id, "limit_daily", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Ano</label>
                    <Input value={bm.created_year} onChange={e => updateBmField(bm.id, "created_year", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Contas</label>
                    <Input type="number" value={bm.accounts} onChange={e => updateBmField(bm.id, "accounts", Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Verificação</label>
                    <Input value={bm.verification} onChange={e => updateBmField(bm.id, "verification", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Risco</label>
                    <Input value={bm.risk} onChange={e => updateBmField(bm.id, "risk", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Método</label>
                    <Input value={bm.method} onChange={e => updateBmField(bm.id, "method", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Gasto total</label>
                    <Input type="number" step="0.01" value={bm.gasto_total} onChange={e => updateBmField(bm.id, "gasto_total", Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Ordem</label>
                    <Input type="number" value={bm.sort_order} onChange={e => updateBmField(bm.id, "sort_order", Number(e.target.value))} />
                  </div>
                  <div className="flex items-end gap-2">
                    <label className="flex items-center gap-2 text-xs">
                      <input type="checkbox" checked={bm.is_active} onChange={e => updateBmField(bm.id, "is_active", e.target.checked)} />
                      Ativa
                    </label>
                  </div>
                  <div className="col-span-2 md:col-span-6">
                    <label className="text-xs text-muted-foreground">Observações / Detalhes extras (1 por linha — aparecem no botão "Ver mais" do marketplace)</label>
                    <textarea
                      className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[90px]"
                      placeholder={"Ex:\nCAs abertas\nBM isenta de imposto\nFuso: America/New_York"}
                      value={(bm.details || []).join("\n")}
                      onChange={e => updateBmField(bm.id, "details" as any, e.target.value.split("\n"))}
                    />
                  </div>
                  <div className="col-span-2 md:col-span-6 mt-2 pt-3 border-t border-border/50">
                    <div className="text-[10px] uppercase tracking-wider text-amber-500 mb-2 font-semibold">🔒 Financeiro (somente admin)</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground">Custo (R$)</label>
                        <Input type="number" step="0.01" value={bm.cost ?? 0} onChange={e => updateBmField(bm.id, "cost" as any, Number(e.target.value))} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Imposto (%)</label>
                        <Input type="number" step="0.01" value={bm.tax_percent ?? 0} onChange={e => updateBmField(bm.id, "tax_percent" as any, Number(e.target.value))} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Imposto (R$)</label>
                        <Input readOnly value={fmtBRL((Number(bm.price) || 0) * ((Number(bm.tax_percent) || 0) / 100))} className="bg-muted/40" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Lucro líquido</label>
                        {(() => {
                          const price = Number(bm.price) || 0;
                          const cost = Number(bm.cost) || 0;
                          const tax = price * ((Number(bm.tax_percent) || 0) / 100);
                          const profit = price - cost - tax;
                          return (
                            <Input readOnly value={fmtBRL(profit)} className={`bg-muted/40 font-semibold ${profit >= 0 ? "text-emerald-500" : "text-red-500"}`} />
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 col-span-2 md:col-span-1 justify-end">
                    <Button size="sm" onClick={() => saveBm(bm)}><Save className="h-3 w-3 mr-1" />Salvar</Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteBm(bm.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}