import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  User,
  Calendar,
  Layers,
  ShoppingCart,
  DollarSign,
  Wallet,
  Trash2,
  Save,
  ChevronDown,
  Tag,
  Search,
  Plus,
  X,
  FileText
} from "lucide-react";
import { toast } from "sonner";

const paymentMethods = [
  { value: "", label: "Selecione..." },
  { value: "pix", label: "PIX" },
  { value: "saldo", label: "Saldo em Carteira" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "transferencia", label: "Transferência" },
  { value: "outro", label: "Outro" },
];

interface SaleItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  productId: string | null;
}

export default function AdminNovaVenda() {
  const navigate = useNavigate();
  const [clientSearch, setClientSearch] = useState("");
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<SaleItem[]>([
    { id: crypto.randomUUID(), name: "", quantity: 1, price: 0, productId: null },
  ]);
  const [products, setProducts] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Load products for selection
  useEffect(() => {
    supabase
      .from("products")
      .select("id, name, price")
      .eq("status", "active")
      .order("name")
      .then(({ data }) => setProducts(data || []));
  }, []);

  // Search clients
  useEffect(() => {
    if (clientSearch.length < 2) {
      setClients([]);
      return;
    }
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone, cpf")
        .or(`full_name.ilike.%${clientSearch}%,phone.ilike.%${clientSearch}%,cpf.ilike.%${clientSearch}%`)
        .limit(8);
      setClients(data || []);
      setShowClientDropdown(true);
    }, 300);
    return () => clearTimeout(timeout);
  }, [clientSearch]);

  const totalValue = items.reduce((sum, item) => sum + item.quantity * item.price, 0);

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: "", quantity: 1, price: 0, productId: null },
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateItem = (id: string, field: keyof SaleItem, value: any) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, [field]: value } : i))
    );
  };

  const selectProduct = (itemId: string, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId
            ? { ...i, productId: product.id, name: product.name, price: product.price }
            : i
        )
      );
    }
  };

  const generateCode = () => {
    const now = new Date();
    return `VND-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedClient) {
      toast.error("Selecione um cliente");
      return;
    }
    if (!paymentMethod) {
      toast.error("Selecione o método de pagamento");
      return;
    }
    if (items.some((i) => !i.name || i.price <= 0)) {
      toast.error("Preencha todos os itens corretamente");
      return;
    }

    setSubmitting(true);

    try {
      const code = generateCode();
      const subtotal = totalValue;

      // Create order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          code,
          user_id: selectedClient.user_id,
          subtotal,
          total: subtotal,
          discount: 0,
          status: "completed",
          payment_method: paymentMethod,
        })
        .select("id")
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = items.map((item) => ({
        order_id: order.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        product_id: item.productId || null,
        description: notes || null,
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) throw itemsError;

      toast.success(`Venda ${code} registrada com sucesso!`);
      navigate("/admin/auditoria");
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao registrar venda: " + (err.message || ""));
    } finally {
      setSubmitting(false);
    }
  };

  const handleClear = () => {
    setSelectedClient(null);
    setClientSearch("");
    setSaleDate(new Date().toISOString().slice(0, 10));
    setPaymentMethod("");
    setNotes("");
    setItems([{ id: crypto.randomUUID(), name: "", quantity: 1, price: 0, productId: null }]);
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
            <span className="text-xs font-mono text-primary">NOVA VENDA</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white leading-tight">
            Registrar Nova <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-red-400">Venda Manual</span>
          </h1>
          <p className="text-gray-400 text-sm md:text-base font-light max-w-2xl">
            Lance uma venda manualmente para manter o histórico financeiro atualizado.
          </p>
        </header>

        {/* Form Card */}
        <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl p-6 md:p-10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-white/5 to-transparent rounded-bl-full pointer-events-none opacity-50" />

          <form className="flex flex-col gap-8 relative z-10" onSubmit={handleSubmit}>
            {/* Cliente */}
            <div className="space-y-6">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                <User className="size-5 text-primary" />
                Cliente
              </h2>

              <div className="relative">
                {selectedClient ? (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                    <User className="size-5 text-primary" />
                    <div className="flex-1">
                      <p className="text-sm text-white font-medium">{selectedClient.full_name || "Sem nome"}</p>
                      <p className="text-xs text-gray-400">{selectedClient.phone || "Sem telefone"}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSelectedClient(null); setClientSearch(""); }}
                      className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="size-5 text-gray-500" />
                    </div>
                    <input
                      type="text"
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      onFocus={() => clients.length > 0 && setShowClientDropdown(true)}
                      placeholder="Buscar cliente por nome, telefone ou CPF..."
                      className="w-full rounded-lg py-3 pl-10 pr-4 text-sm placeholder-gray-600 bg-black/20 border border-white/10 text-white focus:bg-black/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                    />
                    {showClientDropdown && clients.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-white/10 rounded-lg shadow-2xl z-50 max-h-48 overflow-y-auto">
                        {clients.map((c) => (
                          <button
                            key={c.user_id}
                            type="button"
                            onClick={() => {
                              setSelectedClient(c);
                              setClientSearch(c.full_name || "");
                              setShowClientDropdown(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 text-left transition-colors"
                          >
                            <User className="size-4 text-gray-500" />
                            <div>
                              <p className="text-sm text-white">{c.full_name || "Sem nome"}</p>
                              <p className="text-xs text-gray-500">{c.phone || c.cpf || ""}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="h-px w-full bg-white/5" />

            {/* Detalhes */}
            <div className="space-y-6">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                <FileText className="size-5 text-primary" />
                Detalhes da Venda
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Data */}
                <div className="space-y-2">
                  <label className="text-sm text-gray-400 font-medium ml-1">Data da Venda</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Calendar className="size-5 text-gray-500" />
                    </div>
                    <input
                      type="date"
                      value={saleDate}
                      onChange={(e) => setSaleDate(e.target.value)}
                      className="w-full rounded-lg py-3 pl-10 pr-4 text-sm bg-black/20 border border-white/10 text-gray-300 focus:bg-black/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all [color-scheme:dark]"
                    />
                  </div>
                </div>

                {/* Payment Method */}
                <div className="space-y-2">
                  <label className="text-sm text-gray-400 font-medium ml-1">Método de Pagamento</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Wallet className="size-5 text-gray-500" />
                    </div>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full rounded-lg py-3 pl-10 pr-10 text-sm appearance-none cursor-pointer bg-black/20 border border-white/10 text-white focus:bg-black/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                    >
                      {paymentMethods.map((m) => (
                        <option key={m.value} value={m.value} className="bg-gray-900">{m.label}</option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <ChevronDown className="size-5 text-gray-500" />
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="md:col-span-2 space-y-2">
                  <label className="text-sm text-gray-400 font-medium ml-1">Observações</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Observações sobre a venda..."
                    rows={2}
                    className="w-full rounded-lg py-3 px-4 text-sm placeholder-gray-600 bg-black/20 border border-white/10 text-white focus:bg-black/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px w-full bg-white/5" />

            {/* Items */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                  <Layers className="size-5 text-primary" />
                  Itens da Venda
                </h2>
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  <Plus className="size-4" />
                  Adicionar Item
                </button>
              </div>

              <div className="space-y-4">
                {items.map((item, idx) => (
                  <div key={item.id} className="grid grid-cols-12 gap-3 items-end p-4 rounded-xl bg-white/[0.02] border border-white/5">
                    {/* Product / Name */}
                    <div className="col-span-12 md:col-span-5 space-y-1.5">
                      <label className="text-xs text-gray-500 font-medium">Produto / Nome</label>
                      <select
                        value={item.productId || ""}
                        onChange={(e) => {
                          if (e.target.value === "custom") {
                            updateItem(item.id, "productId", null);
                            updateItem(item.id, "name", "");
                          } else {
                            selectProduct(item.id, e.target.value);
                          }
                        }}
                        className="w-full rounded-lg py-2.5 px-3 text-sm bg-black/20 border border-white/10 text-white focus:border-primary focus:outline-none transition-all appearance-none"
                      >
                        <option value="" className="bg-gray-900">Selecione um produto...</option>
                        <option value="custom" className="bg-gray-900">✏️ Digitar manualmente</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id} className="bg-gray-900">{p.name} — R$ {Number(p.price).toFixed(2)}</option>
                        ))}
                      </select>
                      {item.productId === null && (
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => updateItem(item.id, "name", e.target.value)}
                          placeholder="Nome do item..."
                          className="w-full rounded-lg py-2.5 px-3 text-sm bg-black/20 border border-white/10 text-white focus:border-primary focus:outline-none transition-all mt-1.5"
                        />
                      )}
                    </div>

                    {/* Quantity */}
                    <div className="col-span-4 md:col-span-2 space-y-1.5">
                      <label className="text-xs text-gray-500 font-medium">Qtd</label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, "quantity", parseInt(e.target.value) || 1)}
                        className="w-full rounded-lg py-2.5 px-3 text-sm bg-black/20 border border-white/10 text-white focus:border-primary focus:outline-none transition-all"
                      />
                    </div>

                    {/* Price */}
                    <div className="col-span-5 md:col-span-3 space-y-1.5">
                      <label className="text-xs text-gray-500 font-medium">Preço Unit. (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.price}
                        onChange={(e) => updateItem(item.id, "price", parseFloat(e.target.value) || 0)}
                        className="w-full rounded-lg py-2.5 px-3 text-sm bg-black/20 border border-white/10 text-white focus:border-primary focus:outline-none transition-all"
                      />
                    </div>

                    {/* Subtotal + Remove */}
                    <div className="col-span-3 md:col-span-2 flex items-end gap-2">
                      <div className="flex-1 text-right">
                        <p className="text-xs text-gray-500 mb-1.5">Subtotal</p>
                        <p className="text-sm font-bold text-white">
                          {(item.quantity * item.price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </p>
                      </div>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="p-2 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors"
                        >
                          <X className="size-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="flex justify-end items-center gap-4 pt-2">
                <span className="text-sm text-gray-400 font-medium">Total da Venda:</span>
                <span className="text-2xl font-black text-white">
                  {totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px w-full bg-white/5" />

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <button
                type="button"
                onClick={handleClear}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/10 transition-all"
              >
                <Trash2 className="size-4" />
                Limpar Campos
              </button>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/admin/auditoria")}
                  className="px-5 py-2.5 rounded-lg bg-white/5 border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/10 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-white text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 transition-all"
                >
                  <Save className="size-4" />
                  {submitting ? "Salvando..." : "Registrar Venda"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
