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
  FileText,
  Package,
  Copy,
  QrCode,
  Loader2,
  CheckCircle,
  XCircle,
  Clock
} from "lucide-react";
import { toast } from "sonner";

const paymentMethods = [
  { value: "", label: "Selecione..." },
  { value: "pix", label: "PIX" },
  { value: "saldo", label: "Saldo em Carteira" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "transferencia", label: "Transferência" },
  { value: "cortesia", label: "🎁 Cortesia (Grátis)" },
  { value: "outro", label: "Outro" },
];

const deliveryMethods = [
  { value: "manual", label: "Entrega Manual" },
  { value: "automatica", label: "Entrega Automática (Estoque)" },
  { value: "proxy", label: "Proxy / Assinatura" },
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
  const [deliveryMethod, setDeliveryMethod] = useState("manual");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<SaleItem[]>([
    { id: crypto.randomUUID(), name: "", quantity: 1, price: 0, productId: null },
  ]);
  const [products, setProducts] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  
  // PIX generation state
  const [pixQrCode, setPixQrCode] = useState<string | null>(null);
  const [pixCopyPaste, setPixCopyPaste] = useState<string | null>(null);
  const [generatingPix, setGeneratingPix] = useState(false);
  const [pixGenerated, setPixGenerated] = useState(false);
  const [pixPaymentId, setPixPaymentId] = useState<string | null>(null);
  const [pixOrderId, setPixOrderId] = useState<string | null>(null);
  const [pixStatus, setPixStatus] = useState<string | null>(null);
  const [pollingPix, setPollingPix] = useState(false);

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

  // Poll for PIX payment status
  useEffect(() => {
    if (!pixPaymentId || pixStatus === "completed") return;
    setPollingPix(true);
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("payments")
        .select("status")
        .eq("id", pixPaymentId)
        .single();
      if (data?.status === "completed") {
        setPixStatus("completed");
        setPollingPix(false);
        clearInterval(interval);
        toast.success("Pagamento PIX confirmado! Venda registrada automaticamente.");
      } else if (data?.status === "failed" || data?.status === "expired") {
        setPixStatus(data.status);
        setPollingPix(false);
        clearInterval(interval);
        toast.error("Pagamento PIX " + (data.status === "failed" ? "recusado" : "expirado"));
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [pixPaymentId, pixStatus]);

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

  const handleGeneratePix = async () => {
    if (!selectedClient) {
      toast.error("Selecione um cliente primeiro");
      return;
    }
    if (totalValue < 1) {
      toast.error("O valor mínimo para PIX é R$ 1,00");
      return;
    }
    if (items.some((i) => !i.name || i.price <= 0)) {
      toast.error("Preencha todos os itens corretamente");
      return;
    }

    setGeneratingPix(true);
    try {
      // 1. Create order with pending_payment status
      const code = generateCode();
      const subtotal = totalValue;

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          code,
          user_id: selectedClient.user_id,
          subtotal,
          total: subtotal,
          discount: 0,
          status: "pending_payment",
          payment_method: "pix",
        })
        .select("id")
        .single();

      if (orderError) throw orderError;

      // 2. Create order items
      const orderItemsData = items.map((item) => ({
        order_id: order.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        product_id: item.productId || null,
        description: `${notes ? notes + " | " : ""}Entrega: ${deliveryMethods.find(d => d.value === deliveryMethod)?.label || deliveryMethod}`,
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItemsData);

      if (itemsError) throw itemsError;

      // 3. Generate PIX payment linked to the order
      const { data, error } = await supabase.functions.invoke("create-pix-payment", {
        body: { amount: subtotal, order_id: order.id },
      });

      if (error) throw new Error(error.message || "Erro ao gerar PIX");
      if (data?.error) throw new Error(data.error);

      setPixCopyPaste(data.qr_code || null);
      setPixQrCode(data.qr_code_base64 || null);
      setPixPaymentId(data.payment_id || null);
      setPixOrderId(order.id);
      setPixStatus("pending");
      setPixGenerated(true);
      toast.success("Código PIX gerado! Aguardando pagamento...");
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao gerar PIX: " + (err.message || ""));
    } finally {
      setGeneratingPix(false);
    }
  };

  const handleCopyPix = () => {
    if (pixCopyPaste) {
      navigator.clipboard.writeText(pixCopyPaste);
      toast.success("Código PIX copiado!");
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

    const isCourtesy = paymentMethod === "cortesia";

    try {
      const code = generateCode();
      const subtotal = totalValue;

      // Create order — courtesy: total=0, discount=subtotal (tracks market value)
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          code,
          user_id: selectedClient.user_id,
          subtotal,
          total: isCourtesy ? 0 : subtotal,
          discount: isCourtesy ? subtotal : 0,
          status: "completed",
          payment_method: isCourtesy ? "courtesy" : paymentMethod,
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
        description: `${isCourtesy ? "[Cortesia] " : ""}${notes ? notes + " | " : ""}Entrega: ${deliveryMethods.find(d => d.value === deliveryMethod)?.label || deliveryMethod}`,
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Register wallet transaction for client history (no balance impact for courtesy)
      const { data: profile } = await supabase
        .from("profiles")
        .select("balance")
        .eq("user_id", selectedClient.user_id)
        .single();

      const currentBalance = profile?.balance || 0;

      await supabase.from("wallet_transactions").insert({
        user_id: selectedClient.user_id,
        type: isCourtesy ? "info" : "debit",
        amount: isCourtesy ? 0 : -subtotal,
        title: isCourtesy
          ? `🎁 Cortesia — ${code} (valor: R$ ${subtotal.toFixed(2)})`
          : `Compra via ${paymentMethods.find(m => m.value === paymentMethod)?.label || paymentMethod} — ${code}`,
        reference_id: order.id,
        balance_after: currentBalance,
      });

      toast.success(isCourtesy
        ? `🎁 Cortesia ${code} registrada! Valor estimado: R$ ${subtotal.toFixed(2)}`
        : `Venda ${code} registrada com sucesso!`
      );
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
    setDeliveryMethod("manual");
    setNotes("");
    setItems([{ id: crypto.randomUUID(), name: "", quantity: 1, price: 0, productId: null }]);
    setPixQrCode(null);
    setPixCopyPaste(null);
    setPixGenerated(false);
    setPixPaymentId(null);
    setPixOrderId(null);
    setPixStatus(null);
    setPollingPix(false);
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
                {/* Delivery Method */}
                <div className="space-y-2">
                  <label className="text-sm text-gray-400 font-medium ml-1">Forma de Entrega</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Package className="size-5 text-gray-500" />
                    </div>
                    <select
                      value={deliveryMethod}
                      onChange={(e) => setDeliveryMethod(e.target.value)}
                      className="w-full rounded-lg py-3 pl-10 pr-10 text-sm appearance-none cursor-pointer bg-black/20 border border-white/10 text-white focus:bg-black/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                    >
                      {deliveryMethods.map((d) => (
                        <option key={d.value} value={d.value} className="bg-gray-900">{d.label}</option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <ChevronDown className="size-5 text-gray-500" />
                    </div>
                  </div>
                </div>

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
                <span className="text-sm text-gray-400 font-medium">
                  {paymentMethod === "cortesia" ? "Valor de Mercado:" : "Total da Venda:"}
                </span>
                <div className="text-right">
                  {paymentMethod === "cortesia" && (
                    <span className="text-xs text-amber-400 block mb-1">🎁 Cortesia — R$ 0,00 cobrado</span>
                  )}
                  <span className={`text-2xl font-black ${paymentMethod === "cortesia" ? "text-gray-500 line-through" : "text-white"}`}>
                    {totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </div>
              </div>
            </div>

            {/* PIX Generation Section */}
            {paymentMethod === "pix" && totalValue >= 1 && (
              <>
                <div className="h-px w-full bg-white/5" />
                <div className="space-y-4">
                  <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                    <QrCode className="size-5 text-primary" />
                    Cobrança PIX
                  </h2>

                  {!pixGenerated ? (
                    <button
                      type="button"
                      onClick={handleGeneratePix}
                      disabled={generatingPix}
                      className="flex items-center gap-2 px-5 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold disabled:opacity-50 transition-all w-full justify-center"
                    >
                      {generatingPix ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <QrCode className="size-4" />
                      )}
                      {generatingPix ? "Gerando..." : `Gerar Código PIX — ${totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`}
                    </button>
                  ) : (
                    <div className="space-y-4 p-4 rounded-xl bg-white/[0.03] border border-white/10">
                      {pixQrCode && (
                        <div className="flex justify-center">
                          <img
                            src={`data:image/png;base64,${pixQrCode}`}
                            alt="QR Code PIX"
                            className="w-48 h-48 rounded-lg bg-white p-2"
                          />
                        </div>
                      )}
                      {pixCopyPaste && (
                        <div className="space-y-2">
                          <label className="text-xs text-gray-400 font-medium">Código Copia e Cola</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              readOnly
                              value={pixCopyPaste}
                              className="flex-1 rounded-lg py-2.5 px-3 text-xs bg-black/30 border border-white/10 text-gray-300 font-mono truncate"
                            />
                            <button
                              type="button"
                              onClick={handleCopyPix}
                              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-bold transition-all whitespace-nowrap"
                            >
                              <Copy className="size-3.5" />
                              Copiar
                            </button>
                          </div>
                        </div>
                      )}
                      {/* Payment status indicator */}
                      {pixStatus === "completed" ? (
                        <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                          <CheckCircle className="size-5 text-emerald-400" />
                          <span className="text-sm font-bold text-emerald-400">Pagamento confirmado! Venda registrada.</span>
                        </div>
                      ) : pixStatus === "failed" || pixStatus === "expired" ? (
                        <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                          <XCircle className="size-5 text-red-400" />
                          <span className="text-sm font-bold text-red-400">Pagamento {pixStatus === "failed" ? "recusado" : "expirado"}.</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                          <Loader2 className="size-4 animate-spin text-yellow-400" />
                          <span className="text-sm font-medium text-yellow-400">Aguardando pagamento...</span>
                        </div>
                      )}
                      <p className="text-xs text-gray-500 text-center">Envie o QR Code ou código acima para o cliente efetuar o pagamento.</p>
                    </div>
                  )}
                </div>
              </>
            )}

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
                  {pixStatus === "completed" ? "Voltar à Auditoria" : "Cancelar"}
                </button>
                {/* Hide submit when PIX flow is active */}
                {!(paymentMethod === "pix" && pixGenerated) && (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-white text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 transition-all"
                  >
                    <Save className="size-4" />
                    {submitting ? "Salvando..." : "Registrar Venda"}
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
