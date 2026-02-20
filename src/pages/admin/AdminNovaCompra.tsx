import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { 
  Link as LinkIcon, 
  User, 
  Calendar, 
  Layers, 
  ShoppingCart, 
  DollarSign, 
  Wallet,
  ArrowLeft,
  Trash2,
  Save,
  ChevronDown,
  Store
} from "lucide-react";
import { toast } from "sonner";

const itemTypes = [
  { value: "", label: "Selecione o tipo..." },
  { value: "profiles", label: "Perfis" },
  { value: "bms", label: "BMs (Business Managers)" },
  { value: "pages", label: "Páginas" },
  { value: "combo", label: "Combo" },
  { value: "kit", label: "Kit Completo" }
];

export default function AdminNovaCompra() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    providerLink: "",
    providerName: "",
    purchaseDate: "",
    itemType: "",
    quantity: "",
    unitValue: ""
  });

  const [totalValue, setTotalValue] = useState("R$ 0,00");

  useEffect(() => {
    const qty = parseFloat(formData.quantity) || 0;
    const unit = parseFloat(formData.unitValue) || 0;
    const total = qty * unit;
    setTotalValue(total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
  }, [formData.quantity, formData.unitValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleClear = () => {
    setFormData({
      providerLink: "",
      providerName: "",
      purchaseDate: "",
      itemType: "",
      quantity: "",
      unitValue: ""
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.providerName || !formData.purchaseDate || !formData.itemType || !formData.quantity || !formData.unitValue) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    const qty = parseFloat(formData.quantity) || 0;
    const unit = parseFloat(formData.unitValue) || 0;
    const total = qty * unit;

    const { error } = await supabase.from("purchases").insert({
      provider_name: formData.providerName,
      provider_link: formData.providerLink || null,
      purchase_date: formData.purchaseDate,
      item_type: formData.itemType,
      quantity: qty,
      unit_value: unit,
      total_value: total,
    });

    if (error) {
      console.error(error);
      toast.error("Erro ao registrar compra");
      return;
    }

    toast.success("Compra registrada com sucesso!");
    navigate("/admin/auditoria");
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)] -mx-6 -mt-6 p-6 lg:p-12 gap-8 relative">
      {/* Background Effects */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] mix-blend-screen opacity-40" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px] mix-blend-screen opacity-30" />
      </div>

      <div className="relative z-10 w-full max-w-4xl mx-auto flex flex-col gap-8">
        {/* Header */}
        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-3 mb-2">
            <span className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-xs font-mono text-gray-400">AUDITORIA</span>
            <span className="h-px w-8 bg-white/10" />
            <span className="text-xs font-mono text-primary">NOVA ENTRADA</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white leading-tight">
            Registrar Nova <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-red-400">Compra de Itens</span>
          </h1>
          <p className="text-gray-400 text-sm md:text-base font-light max-w-2xl">
            Insira os detalhes da compra para manter o registro de custos atualizado. Todos os campos são obrigatórios para garantir a precisão do ROI.
          </p>
        </header>

        {/* Form Card */}
        <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl p-6 md:p-10 relative overflow-hidden">
          {/* Decorative gradient */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-white/5 to-transparent rounded-bl-full pointer-events-none opacity-50" />

          <form className="flex flex-col gap-8 relative z-10" onSubmit={handleSubmit}>
            {/* Dados do Fornecedor */}
            <div className="space-y-6">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                <Store className="size-5 text-primary" />
                Dados do Fornecedor
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Link do Fornecedor */}
                <div className="md:col-span-2 space-y-2">
                  <label className="text-sm text-gray-400 font-medium ml-1" htmlFor="providerLink">
                    Link do Fornecedor
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <LinkIcon className="size-5 text-gray-500" />
                    </div>
                    <input
                      type="url"
                      id="providerLink"
                      name="providerLink"
                      value={formData.providerLink}
                      onChange={handleChange}
                      placeholder="https://exemplo.com/loja/item-xyz"
                      className="w-full rounded-lg py-3 pl-10 pr-4 text-sm placeholder-gray-600 bg-black/20 border border-white/10 text-white focus:bg-black/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                    />
                  </div>
                </div>

                {/* Nome do Fornecedor */}
                <div className="space-y-2">
                  <label className="text-sm text-gray-400 font-medium ml-1" htmlFor="providerName">
                    Nome do Fornecedor
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="size-5 text-gray-500" />
                    </div>
                    <input
                      type="text"
                      id="providerName"
                      name="providerName"
                      value={formData.providerName}
                      onChange={handleChange}
                      placeholder="Ex: João Silva ou Loja X"
                      className="w-full rounded-lg py-3 pl-10 pr-4 text-sm placeholder-gray-600 bg-black/20 border border-white/10 text-white focus:bg-black/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                    />
                  </div>
                </div>

                {/* Data da Compra */}
                <div className="space-y-2">
                  <label className="text-sm text-gray-400 font-medium ml-1" htmlFor="purchaseDate">
                    Data da Compra
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Calendar className="size-5 text-gray-500" />
                    </div>
                    <input
                      type="date"
                      id="purchaseDate"
                      name="purchaseDate"
                      value={formData.purchaseDate}
                      onChange={handleChange}
                      className="w-full rounded-lg py-3 pl-10 pr-4 text-sm bg-black/20 border border-white/10 text-gray-300 focus:bg-black/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all [color-scheme:dark]"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px w-full bg-white/5" />

            {/* Detalhes dos Itens */}
            <div className="space-y-6">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                <Layers className="size-5 text-primary" />
                Detalhes dos Itens
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Tipo de Item */}
                <div className="space-y-2">
                  <label className="text-sm text-gray-400 font-medium ml-1" htmlFor="itemType">
                    Tipo de Item
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Layers className="size-5 text-gray-500" />
                    </div>
                    <select
                      id="itemType"
                      name="itemType"
                      value={formData.itemType}
                      onChange={handleChange}
                      className="w-full rounded-lg py-3 pl-10 pr-10 text-sm appearance-none cursor-pointer bg-black/20 border border-white/10 text-white focus:bg-black/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                    >
                      {itemTypes.map((type) => (
                        <option key={type.value} value={type.value} className="bg-gray-900">
                          {type.label}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <ChevronDown className="size-5 text-gray-500" />
                    </div>
                  </div>
                </div>

                {/* Quantidade Total */}
                <div className="space-y-2">
                  <label className="text-sm text-gray-400 font-medium ml-1" htmlFor="quantity">
                    Quantidade Total
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <ShoppingCart className="size-5 text-gray-500" />
                    </div>
                    <input
                      type="number"
                      id="quantity"
                      name="quantity"
                      min="1"
                      value={formData.quantity}
                      onChange={handleChange}
                      placeholder="0"
                      className="w-full rounded-lg py-3 pl-10 pr-4 text-sm placeholder-gray-600 bg-black/20 border border-white/10 text-white focus:bg-black/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                    />
                  </div>
                </div>

                {/* Valor Unitário */}
                <div className="space-y-2">
                  <label className="text-sm text-gray-400 font-medium ml-1" htmlFor="unitValue">
                    Valor Unitário (R$)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <DollarSign className="size-5 text-gray-500" />
                    </div>
                    <input
                      type="number"
                      id="unitValue"
                      name="unitValue"
                      step="0.01"
                      value={formData.unitValue}
                      onChange={handleChange}
                      placeholder="0,00"
                      className="w-full rounded-lg py-3 pl-10 pr-4 text-sm placeholder-gray-600 bg-black/20 border border-white/10 text-white focus:bg-black/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                    />
                  </div>
                </div>

                {/* Valor Total */}
                <div className="space-y-2">
                  <label className="text-sm text-gray-400 font-medium ml-1 flex justify-between" htmlFor="totalValue">
                    <span>Valor Total (R$)</span>
                    <span className="text-xs text-gray-500 italic font-normal">*Calculado automaticamente</span>
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Wallet className="size-5 text-gray-500 group-hover:text-primary transition-colors" />
                    </div>
                    <input
                      type="text"
                      id="totalValue"
                      value={totalValue}
                      disabled
                      className="w-full rounded-lg py-3 pl-10 pr-4 text-sm font-bold bg-white/5 border border-white/5 text-white cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col-reverse md:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t border-white/5">
              <button
                type="button"
                onClick={() => navigate("/admin/auditoria")}
                className="w-full md:w-auto px-6 py-3 rounded-xl text-sm font-medium text-gray-300 hover:text-white flex items-center justify-center gap-2 bg-white/5 backdrop-blur-lg border border-white/10 hover:bg-white/10 transition-all"
              >
                <ArrowLeft className="size-4" />
                Voltar à Auditoria
              </button>

              <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                <button
                  type="button"
                  onClick={handleClear}
                  className="w-full md:w-auto px-6 py-3 rounded-xl text-sm font-medium text-gray-400 hover:text-white flex items-center justify-center gap-2 bg-white/5 backdrop-blur-lg border border-white/10 hover:bg-white/10 transition-all"
                >
                  <Trash2 className="size-4" />
                  Limpar Formulário
                </button>
                <button
                  type="submit"
                  className="w-full md:w-auto bg-primary hover:bg-red-700 text-white px-8 py-3 rounded-xl text-sm font-bold shadow-[0_0_20px_rgba(249,6,6,0.4)] hover:shadow-[0_0_30px_rgba(249,6,6,0.6)] transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
                >
                  <Save className="size-5" />
                  Salvar Compra
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Bottom aesthetic glow */}
      <div className="fixed bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-50 pointer-events-none" />
    </div>
  );
}
