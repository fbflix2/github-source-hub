import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Store, Plus, Pencil, Trash2, Globe, Percent, Coins, Loader2, Copy, Check, LogIn } from "lucide-react";

interface Reseller {
  id: string;
  user_id: string;
  slug: string;
  company_name: string;
  brand_name: string | null;
  status: string;
  model: "percentage" | "credit";
  commission_rate: number;
  balance_credits: number;
  min_proxies_per_month: number;
  min_monthly_recharge: number;
  proxy_unit_cost: number;
  logo_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  support_email: string | null;
  support_whatsapp: string | null;
  custom_domain: string | null;
  domain_status: string | null;
  openpix_pix_key: string | null;
  openpix_pix_key_type: string | null;
  total_gmv: number;
  total_commissions_earned: number;
  total_referrals: number;
  created_at: string;
}

type ResellerFormData = Partial<Reseller> & { user_email?: string };

const emptyForm: ResellerFormData = {
  slug: "",
  company_name: "",
  brand_name: "",
  model: "percentage",
  status: "active",
  commission_rate: 25,
  min_proxies_per_month: 5,
  min_monthly_recharge: 100,
  proxy_unit_cost: 10,
  primary_color: "#22c55e",
  accent_color: "#0ea5e9",
  user_email: "",
};

export default function AdminRevendedores() {
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [editing, setEditing] = useState<Reseller | null>(null);
  const [form, setForm] = useState<ResellerFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [impersonating, setImpersonating] = useState<string | null>(null);

  useEffect(() => {
    fetchResellers();
  }, []);

  const fetchResellers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("resellers")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar revendedores: " + error.message);
    } else {
      setResellers((data || []) as Reseller[]);
    }
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpenModal(true);
  };

  const openEdit = (r: Reseller) => {
    setEditing(r);
    setForm({ ...r });
    setOpenModal(true);
  };

  const handleSave = async () => {
    if (!form.company_name || !form.slug) {
      toast.error("Nome da empresa e slug são obrigatórios");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const { user_email, id, user_id, created_at, ...updates } = form as any;
        const { error } = await supabase
          .from("resellers")
          .update(updates)
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Revendedor atualizado");
      } else {
        // Buscar user_id pelo email
        if (!form.user_email) {
          toast.error("Email do usuário é obrigatório");
          setSaving(false);
          return;
        }
        const { data: userId, error: uidError } = await supabase.rpc(
          "get_user_id_by_email",
          { target_email: form.user_email }
        );
        if (uidError || !userId) {
          toast.error("Usuário não encontrado. Peça para ele criar conta primeiro em /auth");
          setSaving(false);
          return;
        }
        const { user_email, ...rest } = form as any;
        const { error } = await supabase.from("resellers").insert({
          ...rest,
          user_id: userId,
        });
        if (error) throw error;
        toast.success("Revendedor cadastrado");
      }
      setOpenModal(false);
      fetchResellers();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (r: Reseller) => {
    if (!confirm(`Excluir revendedor "${r.company_name}"? Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from("resellers").delete().eq("id", r.id);
    if (error) {
      toast.error("Erro: " + error.message);
    } else {
      toast.success("Revendedor excluído");
      fetchResellers();
    }
  };

  const toggleStatus = async (r: Reseller) => {
    const newStatus = r.status === "active" ? "suspended" : "active";
    const { error } = await supabase.from("resellers").update({ status: newStatus }).eq("id", r.id);
    if (error) toast.error("Erro: " + error.message);
    else {
      toast.success(`Painel ${newStatus === "active" ? "reativado" : "suspenso"}`);
      fetchResellers();
    }
  };

  const copySlug = (slug: string, id: string) => {
    const url = `${window.location.origin}/revenda/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success("Link copiado");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleImpersonate = async (userId: string) => {
    setImpersonating(userId);
    try {
      const newWindow = window.open("about:blank", "_blank");
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/impersonate-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ target_user_id: userId, admin_origin: window.location.origin }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Erro ao acessar conta");
      if (newWindow) newWindow.location.href = result.url;
      else window.open(result.url, "_blank");
      toast.success("Link de acesso aberto em nova aba");
    } catch (err: any) {
      toast.error(err.message || "Erro ao acessar conta");
    } finally {
      setImpersonating(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-10 rounded-xl bg-gradient-to-br from-primary to-red-900 shadow-lg shadow-primary/20">
            <Store className="text-primary-foreground size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Revendedores</h1>
            <p className="text-xs text-muted-foreground">Painéis white-label de revenda de proxies</p>
          </div>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="size-4" /> Novo revendedor
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total" value={resellers.length} />
        <StatCard label="Ativos" value={resellers.filter((r) => r.status === "active").length} />
        <StatCard label="Modelo %" value={resellers.filter((r) => r.model === "percentage").length} />
        <StatCard label="Modelo Crédito" value={resellers.filter((r) => r.model === "credit").length} />
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : resellers.length === 0 ? (
        <Card className="p-12 text-center bg-card/60 border-border/40">
          <Store className="size-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-bold text-foreground">Nenhum revendedor cadastrado</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastre um revendedor para gerar um painel white-label.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {resellers.map((r) => (
            <Card key={r.id} className="p-5 bg-card/60 border-border/40 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {r.logo_url ? (
                    <img
                      src={r.logo_url}
                      alt={r.company_name}
                      className="size-12 rounded-lg object-cover border border-border/40"
                    />
                  ) : (
                    <div
                      className="size-12 rounded-lg flex items-center justify-center font-bold text-white"
                      style={{ background: r.primary_color || "#22c55e" }}
                    >
                      {r.company_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-foreground truncate">{r.company_name}</p>
                    <p className="text-xs text-muted-foreground truncate">/{r.slug}</p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={
                    r.status === "active"
                      ? "border-green-500/40 text-green-400 bg-green-500/10"
                      : r.status === "warning"
                      ? "border-yellow-500/40 text-yellow-400 bg-yellow-500/10"
                      : "border-red-500/40 text-red-400 bg-red-500/10"
                  }
                >
                  {r.status}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                {r.model === "percentage" ? (
                  <Badge variant="outline" className="gap-1">
                    <Percent className="size-3" /> {r.commission_rate}% comissão
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1">
                    <Coins className="size-3" /> R$ {r.proxy_unit_cost}/proxy · Saldo R$ {r.balance_credits.toFixed(2)}
                  </Badge>
                )}
                {r.custom_domain && (
                  <Badge variant="outline" className="gap-1">
                    <Globe className="size-3" /> {r.custom_domain}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/40 text-center">
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">GMV</p>
                  <p className="font-bold text-sm">R$ {r.total_gmv.toFixed(0)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Vendas</p>
                  <p className="font-bold text-sm">{r.total_referrals}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Ganho</p>
                  <p className="font-bold text-sm text-primary">R$ {r.total_commissions_earned.toFixed(0)}</p>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1"
                  onClick={() => copySlug(r.slug, r.id)}
                >
                  {copiedId === r.id ? <Check className="size-3" /> : <Copy className="size-3" />}
                  Link
                </Button>
                <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => openEdit(r)}>
                  <Pencil className="size-3" /> Editar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() => handleImpersonate(r.user_id)}
                  disabled={impersonating === r.user_id}
                  title="Acessar conta do revendedor"
                >
                  {impersonating === r.user_id ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <LogIn className="size-3" />
                  )}
                </Button>
                <Button size="sm" variant="outline" onClick={() => toggleStatus(r)}>
                  {r.status === "active" ? "Suspender" : "Reativar"}
                </Button>
                <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => handleDelete(r)}>
                  <Trash2 className="size-3" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal */}
      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar revendedor" : "Novo revendedor"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {!editing && (
              <div className="md:col-span-2">
                <Label>Email do usuário (deve ter conta em /auth)</Label>
                <Input
                  type="email"
                  value={form.user_email || ""}
                  onChange={(e) => setForm({ ...form, user_email: e.target.value })}
                  placeholder="revendedor@email.com"
                />
              </div>
            )}

            <div>
              <Label>Nome da empresa *</Label>
              <Input
                value={form.company_name || ""}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                placeholder="Proxys da Silva"
              />
            </div>
            <div>
              <Label>Slug (URL) *</Label>
              <Input
                value={form.slug || ""}
                onChange={(e) =>
                  setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })
                }
                placeholder="proxys-silva"
                disabled={!!editing}
              />
            </div>

            <div>
              <Label>Nome de marca (opcional)</Label>
              <Input
                value={form.brand_name || ""}
                onChange={(e) => setForm({ ...form, brand_name: e.target.value })}
                placeholder="Aparece no painel do cliente"
              />
            </div>
            <div>
              <Label>Domínio próprio (CNAME)</Label>
              <Input
                value={form.custom_domain || ""}
                onChange={(e) => setForm({ ...form, custom_domain: e.target.value })}
                placeholder="painel.dominio.com.br"
              />
            </div>

            <div>
              <Label>Modelo de negócio *</Label>
              <Select
                value={form.model}
                onValueChange={(v: any) => setForm({ ...form, model: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Parceria (%) — 25% líquido</SelectItem>
                  <SelectItem value="credit">Revenda (crédito) — R$10/proxy</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v: any) => setForm({ ...form, status: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="warning">Aviso</SelectItem>
                  <SelectItem value="suspended">Suspenso</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.model === "percentage" ? (
              <>
                <div>
                  <Label>% de comissão</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={form.commission_rate ?? 25}
                    onChange={(e) => setForm({ ...form, commission_rate: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Mín. proxies ativos / mês</Label>
                  <Input
                    type="number"
                    value={form.min_proxies_per_month ?? 5}
                    onChange={(e) => setForm({ ...form, min_proxies_per_month: Number(e.target.value) })}
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label>Custo por proxy (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.proxy_unit_cost ?? 10}
                    onChange={(e) => setForm({ ...form, proxy_unit_cost: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Recarga mín. mensal (R$)</Label>
                  <Input
                    type="number"
                    value={form.min_monthly_recharge ?? 100}
                    onChange={(e) => setForm({ ...form, min_monthly_recharge: Number(e.target.value) })}
                  />
                </div>
                {editing && (
                  <div className="md:col-span-2">
                    <Label>Saldo de créditos (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.balance_credits ?? 0}
                      onChange={(e) => setForm({ ...form, balance_credits: Number(e.target.value) })}
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Ajuste manual do saldo. Para recargas registradas, use o extrato.
                    </p>
                  </div>
                )}
              </>
            )}

            <div className="md:col-span-2 border-t border-border/40 pt-3">
              <p className="text-xs font-bold text-muted-foreground mb-2">BRANDING</p>
            </div>

            <div>
              <Label>Logo (URL)</Label>
              <Input
                value={form.logo_url || ""}
                onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Cor primária</Label>
                <Input
                  type="color"
                  value={form.primary_color || "#22c55e"}
                  onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                />
              </div>
              <div>
                <Label>Cor de destaque</Label>
                <Input
                  type="color"
                  value={form.accent_color || "#0ea5e9"}
                  onChange={(e) => setForm({ ...form, accent_color: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Email de suporte</Label>
              <Input
                type="email"
                value={form.support_email || ""}
                onChange={(e) => setForm({ ...form, support_email: e.target.value })}
              />
            </div>
            <div>
              <Label>WhatsApp de suporte</Label>
              <Input
                value={form.support_whatsapp || ""}
                onChange={(e) => setForm({ ...form, support_whatsapp: e.target.value })}
                placeholder="55119..."
              />
            </div>

            <div className="md:col-span-2 border-t border-border/40 pt-3">
              <p className="text-xs font-bold text-muted-foreground mb-2">OPENPIX / SPLIT</p>
            </div>

            <div>
              <Label>Tipo da chave PIX</Label>
              <Select
                value={form.openpix_pix_key_type || ""}
                onValueChange={(v: any) => setForm({ ...form, openpix_pix_key_type: v })}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpf">CPF</SelectItem>
                  <SelectItem value="cnpj">CNPJ</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="phone">Telefone</SelectItem>
                  <SelectItem value="random">Aleatória</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Chave PIX (recebe split)</Label>
              <Input
                value={form.openpix_pix_key || ""}
                onChange={(e) => setForm({ ...form, openpix_pix_key: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenModal(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin mr-2" />}
              {editing ? "Salvar alterações" : "Cadastrar revendedor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4 bg-card/60 border-border/40">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
    </Card>
  );
}