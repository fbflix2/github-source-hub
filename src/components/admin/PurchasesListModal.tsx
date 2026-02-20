import { useState, useEffect } from "react";
import { X, Loader2, Pencil, Save, Trash2, LinkIcon, User, Calendar, Layers, ShoppingCart, DollarSign, Wallet, ChevronDown, Store } from "lucide-react";
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
  sale_price: number;
  tax_rate: number;
  created_at: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

const itemTypes = [
  { value: "profiles", label: "Perfis" },
  { value: "bms", label: "BMs (Business Managers)" },
  { value: "pages", label: "Páginas" },
  { value: "combo", label: "Combo" },
  { value: "kit", label: "Kit Completo" },
];

const itemTypeLabels: Record<string, string> = Object.fromEntries(itemTypes.map(t => [t.value, t.label]));

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function PurchasesListModal({ open, onClose, onUpdate }: Props) {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ provider_name: "", provider_link: "", purchase_date: "", quantity: 0, unit_value: 0, item_type: "", sale_price: 0, tax_rate: 0 });
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
    setEditData({ provider_name: p.provider_name, provider_link: p.provider_link || "", purchase_date: p.purchase_date, quantity: p.quantity, unit_value: p.unit_value, item_type: p.item_type, sale_price: p.sale_price || 0, tax_rate: p.tax_rate || 0 });
  };

  const handleSave = async (id: string) => {
    setSaving(true);
    const total = editData.quantity * editData.unit_value;
    const { error } = await supabase.from("purchases").update({
      provider_name: editData.provider_name,
      provider_link: editData.provider_link || null,
      purchase_date: editData.purchase_date,
      quantity: editData.quantity,
      unit_value: editData.unit_value,
      total_value: total,
      item_type: editData.item_type,
      sale_price: editData.sale_price,
      tax_rate: editData.tax_rate,
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
                    <div className="space-y-4">
                      {/* Fornecedor section */}
                      <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider flex items-center gap-2">
                        <Store className="size-4 text-primary" /> Dados do Fornecedor
                      </h3>
                      <div className="space-y-3">
                        {/* Link */}
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><LinkIcon className="size-4 text-white/30" /></div>
                          <input
                            value={editData.provider_link}
                            onChange={(e) => setEditData(d => ({ ...d, provider_link: e.target.value }))}
                            placeholder="Link do fornecedor (opcional)"
                            className="w-full bg-black/30 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {/* Nome */}
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><User className="size-4 text-white/30" /></div>
                            <input
                              value={editData.provider_name}
                              onChange={(e) => setEditData(d => ({ ...d, provider_name: e.target.value }))}
                              placeholder="Nome do fornecedor"
                              className="w-full bg-black/30 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                            />
                          </div>
                          {/* Data */}
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Calendar className="size-4 text-white/30" /></div>
                            <input
                              type="date"
                              value={editData.purchase_date}
                              onChange={(e) => setEditData(d => ({ ...d, purchase_date: e.target.value }))}
                              className="w-full bg-black/30 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white/80 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all [color-scheme:dark]"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Itens section */}
                      <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider flex items-center gap-2 pt-2">
                        <Layers className="size-4 text-primary" /> Detalhes dos Itens
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        {/* Tipo */}
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Layers className="size-4 text-white/30" /></div>
                          <select
                            value={editData.item_type}
                            onChange={(e) => setEditData(d => ({ ...d, item_type: e.target.value }))}
                            className="w-full bg-black/30 border border-white/10 rounded-lg pl-10 pr-8 py-2.5 text-sm text-white appearance-none cursor-pointer focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                          >
                            {itemTypes.map((t) => (
                              <option key={t.value} value={t.value} className="bg-[#1a1a1a]">{t.label}</option>
                            ))}
                          </select>
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none"><ChevronDown className="size-4 text-white/30" /></div>
                        </div>
                        {/* Quantidade */}
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><ShoppingCart className="size-4 text-white/30" /></div>
                          <input
                            type="number"
                            min="1"
                            value={editData.quantity}
                            onChange={(e) => setEditData(d => ({ ...d, quantity: Number(e.target.value) }))}
                            placeholder="Quantidade"
                            className="w-full bg-black/30 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                          />
                        </div>
                        {/* Valor unitário */}
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><DollarSign className="size-4 text-white/30" /></div>
                          <input
                            type="number"
                            step="0.01"
                            value={editData.unit_value}
                            onChange={(e) => setEditData(d => ({ ...d, unit_value: Number(e.target.value) }))}
                            placeholder="Valor unitário"
                            className="w-full bg-black/30 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                          />
                        </div>
                        {/* Valor total (readonly) */}
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Wallet className="size-4 text-white/30" /></div>
                          <input
                            type="text"
                            value={formatCurrency(editData.quantity * editData.unit_value)}
                            disabled
                            className="w-full bg-white/5 border border-white/5 rounded-lg pl-10 pr-4 py-2.5 text-sm font-bold text-white cursor-not-allowed"
                          />
                        </div>
                      </div>

                      {/* Previsão de Lucro */}
                      <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider flex items-center gap-2 pt-2">
                        <DollarSign className="size-4 text-primary" /> Previsão de Lucro
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        {/* Preço de Venda */}
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><DollarSign className="size-4 text-white/30" /></div>
                          <input
                            type="number"
                            step="0.01"
                            value={editData.sale_price}
                            onChange={(e) => setEditData(d => ({ ...d, sale_price: Number(e.target.value) }))}
                            placeholder="Preço de venda un."
                            className="w-full bg-black/30 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                          />
                        </div>
                        {/* Taxa de Imposto */}
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Layers className="size-4 text-white/30" /></div>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            value={editData.tax_rate}
                            onChange={(e) => setEditData(d => ({ ...d, tax_rate: Number(e.target.value) }))}
                            placeholder="Imposto %"
                            className="w-full bg-black/30 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                          />
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex justify-end items-center gap-2 pt-2">
                        <button onClick={() => setEditingId(null)} className="px-4 py-2 text-xs text-white/50 hover:text-white transition-colors">
                          Cancelar
                        </button>
                        <button
                          onClick={() => handleSave(p.id)}
                          disabled={saving}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                          {saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
                          Salvar
                        </button>
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
