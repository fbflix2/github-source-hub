import { useState, useEffect } from "react";
import { X, Loader2, Pencil, Save, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Purchase {
  id: string;
  provider_name: string;
  provider_link: string | null;
  purchase_date: string;
  item_type: string;
  quantity: number;
  unit_value: number;
  total_value: number;
  created_at: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

const itemTypeLabels: Record<string, string> = {
  profiles: "Perfis",
  bms: "BMs",
  pages: "Páginas",
  combo: "Combo",
  kit: "Kit Completo",
};

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function PurchasesListModal({ open, onClose, onUpdate }: Props) {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ provider_name: "", quantity: 0, unit_value: 0, item_type: "" });
  const [saving, setSaving] = useState(false);

  const fetchPurchases = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("purchases")
      .select("*")
      .order("purchase_date", { ascending: false });
    setPurchases((data ?? []) as Purchase[]);
    setLoading(false);
  };

  useEffect(() => {
    if (open) fetchPurchases();
  }, [open]);

  const startEdit = (p: Purchase) => {
    setEditingId(p.id);
    setEditData({ provider_name: p.provider_name, quantity: p.quantity, unit_value: p.unit_value, item_type: p.item_type });
  };

  const handleSave = async (id: string) => {
    setSaving(true);
    const total = editData.quantity * editData.unit_value;
    const { error } = await supabase.from("purchases").update({
      provider_name: editData.provider_name,
      quantity: editData.quantity,
      unit_value: editData.unit_value,
      total_value: total,
      item_type: editData.item_type,
    }).eq("id", id);

    if (error) {
      toast.error("Erro ao salvar");
    } else {
      toast.success("Compra atualizada!");
      setEditingId(null);
      fetchPurchases();
      onUpdate();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("purchases").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir");
    } else {
      toast.success("Compra excluída!");
      fetchPurchases();
      onUpdate();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl max-h-[80vh] bg-[#120a0a] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h3 className="text-lg font-bold text-white">Compras Registradas</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X className="size-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : purchases.length === 0 ? (
            <p className="text-center text-white/40 py-10">Nenhuma compra registrada.</p>
          ) : (
            <div className="space-y-3">
              {purchases.map((p) => (
                <div key={p.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                  {editingId === p.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          value={editData.provider_name}
                          onChange={(e) => setEditData(d => ({ ...d, provider_name: e.target.value }))}
                          placeholder="Fornecedor"
                          className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                        />
                        <select
                          value={editData.item_type}
                          onChange={(e) => setEditData(d => ({ ...d, item_type: e.target.value }))}
                          className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                        >
                          {Object.entries(itemTypeLabels).map(([k, v]) => (
                            <option key={k} value={k} className="bg-[#1a1a1a]">{v}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          value={editData.quantity}
                          onChange={(e) => setEditData(d => ({ ...d, quantity: Number(e.target.value) }))}
                          placeholder="Qtd"
                          className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={editData.unit_value}
                          onChange={(e) => setEditData(d => ({ ...d, unit_value: Number(e.target.value) }))}
                          placeholder="Valor unit."
                          className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                        />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-white/50">
                          Total: {formatCurrency(editData.quantity * editData.unit_value)}
                        </span>
                        <div className="flex gap-2">
                          <button onClick={() => setEditingId(null)} className="px-3 py-1.5 text-xs text-white/50 hover:text-white">
                            Cancelar
                          </button>
                          <button
                            onClick={() => handleSave(p.id)}
                            disabled={saving}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-white hover:bg-red-700 transition-colors"
                          >
                            {saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
                            Salvar
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-white">{p.provider_name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/50">
                            {itemTypeLabels[p.item_type] || p.item_type}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-white/40">
                          <span>{p.quantity}x {formatCurrency(p.unit_value)}</span>
                          <span className="font-semibold text-white/70">{formatCurrency(p.total_value)}</span>
                          <span>{new Date(p.purchase_date).toLocaleDateString("pt-BR")}</span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => startEdit(p)}
                          className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-2 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
