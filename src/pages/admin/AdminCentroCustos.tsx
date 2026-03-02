import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Loader2, Building2, ArrowLeft, DollarSign, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CostItem {
  id: string;
  name: string;
  type: "fixed" | "variable";
  amount: number;
  recurrence: string;
  description: string | null;
  active: boolean;
  created_at: string;
}

const recurrenceLabels: Record<string, string> = {
  monthly: "Mensal",
  weekly: "Semanal",
  yearly: "Anual",
  one_time: "Única",
};

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function AdminCentroCustos() {
  const navigate = useNavigate();
  const [items, setItems] = useState<CostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [type, setType] = useState<"fixed" | "variable">("fixed");
  const [amount, setAmount] = useState("");
  const [recurrence, setRecurrence] = useState("monthly");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);

  const fetchItems = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("cost_center")
      .select("*")
      .order("type", { ascending: true })
      .order("name", { ascending: true });
    setItems((data as CostItem[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const resetForm = () => {
    setName("");
    setType("fixed");
    setAmount("");
    setRecurrence("monthly");
    setDescription("");
    setActive(true);
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (item: CostItem) => {
    setName(item.name);
    setType(item.type);
    setAmount(item.amount.toString());
    setRecurrence(item.recurrence);
    setDescription(item.description || "");
    setActive(item.active);
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !amount) {
      toast.error("Preencha nome e valor.");
      return;
    }
    setSaving(true);
    const payload = {
      name: name.trim(),
      type,
      amount: parseFloat(amount),
      recurrence,
      description: description.trim() || null,
      active,
    };

    if (editingId) {
      const { error } = await supabase.from("cost_center").update(payload).eq("id", editingId);
      if (error) toast.error("Erro ao atualizar.");
      else toast.success("Custo atualizado!");
    } else {
      const { error } = await supabase.from("cost_center").insert(payload);
      if (error) toast.error("Erro ao criar custo.");
      else toast.success("Custo adicionado!");
    }

    setSaving(false);
    resetForm();
    fetchItems();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este custo?")) return;
    await supabase.from("cost_center").delete().eq("id", id);
    toast.success("Custo removido.");
    fetchItems();
  };

  const fixedItems = items.filter(i => i.type === "fixed");
  const variableItems = items.filter(i => i.type === "variable");
  const totalFixed = fixedItems.filter(i => i.active).reduce((s, i) => s + i.amount, 0);
  const totalVariable = variableItems.filter(i => i.active).reduce((s, i) => s + i.amount, 0);
  const totalAll = totalFixed + totalVariable;

  const renderGroup = (title: string, groupItems: CostItem[], color: string) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className={`text-sm font-semibold uppercase tracking-wider ${color}`}>{title}</h3>
        <span className="text-sm font-bold text-foreground">
          {formatCurrency(groupItems.filter(i => i.active).reduce((s, i) => s + i.amount, 0))}
        </span>
      </div>
      {groupItems.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Nenhum custo registrado.</p>
      ) : (
        <div className="space-y-2">
          {groupItems.map(item => (
            <div
              key={item.id}
              className={`rounded-xl border p-4 flex items-center justify-between gap-3 transition-all hover:border-primary/30 ${
                item.active ? "border-border bg-white/[0.03] backdrop-blur-xl" : "border-border/50 bg-muted/10 opacity-50"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground truncate">{item.name}</span>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {recurrenceLabels[item.recurrence] || item.recurrence}
                  </Badge>
                  {!item.active && (
                    <Badge variant="secondary" className="text-[10px] shrink-0">Inativo</Badge>
                  )}
                </div>
                {item.description && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">{item.description}</p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-bold text-foreground">{formatCurrency(item.amount)}</span>
                <button onClick={() => startEdit(item)} className="p-1.5 rounded-lg hover:bg-white/10 hover:text-primary transition-colors">
                  <Pencil className="size-4" />
                </button>
                <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 hover:text-destructive transition-colors">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)] -mx-6 -mt-6 p-6 lg:p-12 gap-8 relative">
      {/* Background */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] mix-blend-screen opacity-40" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px] mix-blend-screen opacity-30" />
      </div>

      <div className="relative z-10 w-full max-w-5xl mx-auto flex flex-col gap-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="flex flex-col gap-2">
            <button
              onClick={() => navigate("/admin/auditoria")}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit mb-2"
            >
              <ArrowLeft className="size-4" />
              Voltar para Auditoria
            </button>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white leading-tight flex items-center gap-3">
              <Building2 className="size-8 text-amber-400" />
              Centro de Custos
            </h1>
            <p className="text-muted-foreground text-base font-light max-w-lg">
              Gerencie os custos fixos e variáveis operacionais da FBFlix.
            </p>
          </div>

          <Button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-4 mr-2" />
            Novo Custo
          </Button>
        </header>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl p-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <DollarSign className="size-5 text-blue-400" />
              <p className="text-xs text-muted-foreground uppercase font-medium tracking-wider">Custos Fixos</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(totalFixed)}</p>
          </div>
          <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl p-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <TrendingDown className="size-5 text-orange-400" />
              <p className="text-xs text-muted-foreground uppercase font-medium tracking-wider">Custos Variáveis</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(totalVariable)}</p>
          </div>
          <div className="bg-white/[0.03] backdrop-blur-2xl border border-primary/30 rounded-2xl p-6 text-center shadow-[0_0_30px_-10px_rgba(249,6,6,0.15)]">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Building2 className="size-5 text-primary" />
              <p className="text-xs text-primary uppercase font-medium tracking-wider">Total Mensal</p>
            </div>
            <p className="text-2xl font-bold text-primary">{formatCurrency(totalAll)}</p>
          </div>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-white/[0.03] backdrop-blur-2xl border border-primary/20 rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-semibold text-foreground">
              {editingId ? "Editar Custo" : "Novo Custo"}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input placeholder="Nome do custo" value={name} onChange={e => setName(e.target.value)} />
              <Input type="number" placeholder="Valor (R$)" value={amount} onChange={e => setAmount(e.target.value)} min="0" step="0.01" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select value={type} onValueChange={(v: "fixed" | "variable") => setType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Custo Fixo</SelectItem>
                  <SelectItem value="variable">Custo Variável</SelectItem>
                </SelectContent>
              </Select>
              <Select value={recurrence} onValueChange={setRecurrence}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="yearly">Anual</SelectItem>
                  <SelectItem value="one_time">Única</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Textarea placeholder="Descrição (opcional)" value={description} onChange={e => setDescription(e.target.value)} rows={2} />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch checked={active} onCheckedChange={setActive} />
                <span className="text-sm text-muted-foreground">Ativo</span>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={resetForm}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="size-4 animate-spin" /> : editingId ? "Salvar" : "Adicionar"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Lists */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-8">
            {renderGroup("Custos Fixos", fixedItems, "text-blue-400")}
            {renderGroup("Custos Variáveis", variableItems, "text-orange-400")}
          </div>
        )}
      </div>
    </div>
  );
}
