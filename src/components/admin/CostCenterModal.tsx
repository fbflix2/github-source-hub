import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Plus, Trash2, Pencil, Loader2, Building2, ArrowUpDown } from "lucide-react";
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

interface CostCenterModalProps {
  open: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

const recurrenceLabels: Record<string, string> = {
  monthly: "Mensal",
  weekly: "Semanal",
  yearly: "Anual",
  one_time: "Única",
};

export default function CostCenterModal({ open, onClose, onUpdate }: CostCenterModalProps) {
  const [items, setItems] = useState<CostItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
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
    if (open) fetchItems();
  }, [open]);

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
    onUpdate?.();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este custo?")) return;
    await supabase.from("cost_center").delete().eq("id", id);
    toast.success("Custo removido.");
    fetchItems();
    onUpdate?.();
  };

  const fixedItems = items.filter(i => i.type === "fixed");
  const variableItems = items.filter(i => i.type === "variable");

  const totalFixed = fixedItems.filter(i => i.active).reduce((s, i) => s + i.amount, 0);
  const totalVariable = variableItems.filter(i => i.active).reduce((s, i) => s + i.amount, 0);

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const renderGroup = (title: string, groupItems: CostItem[], color: string) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className={`text-xs font-semibold uppercase tracking-wider ${color}`}>{title}</h4>
        <span className="text-xs text-muted-foreground">
          {formatCurrency(groupItems.filter(i => i.active).reduce((s, i) => s + i.amount, 0))}
        </span>
      </div>
      {groupItems.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">Nenhum custo registrado.</p>
      ) : (
        groupItems.map(item => (
          <div
            key={item.id}
            className={`rounded-lg border p-3 flex items-center justify-between gap-3 transition-colors ${
              item.active ? "border-border bg-muted/30" : "border-border/50 bg-muted/10 opacity-50"
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
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm font-bold text-foreground">{formatCurrency(item.amount)}</span>
              <button onClick={() => startEdit(item)} className="p-1 hover:text-primary transition-colors">
                <Pencil className="size-3.5" />
              </button>
              <button onClick={() => handleDelete(item.id)} className="p-1 hover:text-destructive transition-colors">
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { resetForm(); onClose(); } }}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="size-5 text-primary" />
            Centro de Custos
          </DialogTitle>
        </DialogHeader>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase font-medium">Fixos</p>
            <p className="text-sm font-bold text-foreground">{formatCurrency(totalFixed)}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase font-medium">Variáveis</p>
            <p className="text-sm font-bold text-foreground">{formatCurrency(totalVariable)}</p>
          </div>
          <div className="rounded-lg bg-primary/10 border border-primary/20 p-3 text-center">
            <p className="text-[10px] text-primary uppercase font-medium">Total Mensal</p>
            <p className="text-sm font-bold text-primary">{formatCurrency(totalFixed + totalVariable)}</p>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 -mx-6 px-6 space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {renderGroup("Custos Fixos", fixedItems, "text-blue-400")}
              {renderGroup("Custos Variáveis", variableItems, "text-orange-400")}
            </>
          )}

          {/* Form */}
          {showForm && (
            <div className="rounded-xl border border-primary/20 bg-muted/30 p-4 space-y-3">
              <h4 className="text-sm font-semibold text-foreground">
                {editingId ? "Editar Custo" : "Novo Custo"}
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="Nome do custo"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Valor (R$)"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
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
              <Textarea
                placeholder="Descrição (opcional)"
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch checked={active} onCheckedChange={setActive} />
                  <span className="text-xs text-muted-foreground">Ativo</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={resetForm}>Cancelar</Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="size-4 animate-spin" /> : editingId ? "Salvar" : "Adicionar"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {!showForm && (
          <Button variant="outline" className="w-full" onClick={() => setShowForm(true)}>
            <Plus className="size-4 mr-2" />
            Novo Custo
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
