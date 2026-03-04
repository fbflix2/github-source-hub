import { useState } from "react";
import { ArrowRightLeft, Search, Loader2, Package, AlertTriangle, ShieldCheck, Lock, CheckCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface OrderItemInfo {
  order_item_id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  price: number;
  quantity: number;
  stock_item_id: string | null;
  order_code: string;
  client_name: string;
  client_user_id: string;
  order_date: string;
}

interface ProductOption {
  id: string;
  name: string;
  price: number;
  stock: number;
}

interface ExchangeRecord {
  id: string;
  original_product_name: string;
  new_product_name: string;
  price_difference: number;
  client_name: string;
  reason: string | null;
  created_at: string;
}

export default function AdminTrocas() {
  const [orderCode, setOrderCode] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [orderItems, setOrderItems] = useState<OrderItemInfo[]>([]);
  const [selectedItem, setSelectedItem] = useState<OrderItemInfo | null>(null);
  const [lookupDone, setLookupDone] = useState(false);

  // Product selection
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const [reason, setReason] = useState("");

  // Password step
  const [showPasswordStep, setShowPasswordStep] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [exchangeDone, setExchangeDone] = useState(false);

  // History
  const [history, setHistory] = useState<ExchangeRecord[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  async function lookupOrder() {
    if (!orderCode.trim()) return;
    setLookupLoading(true);
    setOrderItems([]);
    setSelectedItem(null);
    setSelectedProduct(null);
    setLookupDone(false);
    setExchangeDone(false);
    setShowPasswordStep(false);

    const code = orderCode.trim().toUpperCase();

    // Find order by code
    const { data: order, error } = await supabase
      .from("orders")
      .select("id, code, user_id, created_at")
      .eq("code", code)
      .maybeSingle();

    if (error || !order) {
      toast.error("Pedido não encontrado");
      setLookupLoading(false);
      setLookupDone(true);
      return;
    }

    // Get order items
    const { data: items } = await supabase
      .from("order_items")
      .select("id, name, price, quantity, product_id")
      .eq("order_id", order.id);

    if (!items || items.length === 0) {
      toast.error("Pedido sem itens");
      setLookupLoading(false);
      setLookupDone(true);
      return;
    }

    // Get client profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", order.user_id)
      .maybeSingle();

    // Get stock_item links
    const itemIds = items.map(i => i.id);
    const { data: stockLinks } = await supabase
      .from("stock_items")
      .select("id, order_item_id")
      .in("order_item_id", itemIds)
      .in("status", ["vendido", "ok"]);

    const stockMap = new Map((stockLinks || []).map(s => [s.order_item_id, s.id]));

    const enriched: OrderItemInfo[] = items.map(i => ({
      order_item_id: i.id,
      order_id: order.id,
      product_id: i.product_id,
      product_name: i.name,
      price: i.price,
      quantity: i.quantity,
      stock_item_id: stockMap.get(i.id) || null,
      order_code: order.code,
      client_name: profile?.full_name || "—",
      client_user_id: order.user_id,
      order_date: new Date(order.created_at).toLocaleDateString("pt-BR"),
    }));

    setOrderItems(enriched);
    setLookupDone(true);
    setLookupLoading(false);

    // Auto-select if single item
    if (enriched.length === 1) {
      setSelectedItem(enriched[0]);
      fetchProducts();
    }
  }

  async function fetchProducts() {
    setLoadingProducts(true);
    const { data } = await supabase
      .from("products")
      .select("id, name, price, stock")
      .eq("status", "active")
      .gt("stock", 0)
      .order("name");
    setProducts(data || []);
    setLoadingProducts(false);
  }

  function handleSelectItem(item: OrderItemInfo) {
    setSelectedItem(item);
    setSelectedProduct(null);
    setProductSearch("");
    setShowPasswordStep(false);
    if (products.length === 0) fetchProducts();
  }

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) &&
    p.id !== selectedItem?.product_id
  );

  const priceDiff = selectedProduct && selectedItem
    ? selectedProduct.price - selectedItem.price
    : 0;

  function handleProceed() {
    if (!selectedProduct || !selectedItem) return;
    setShowPasswordStep(true);
    setAdminPassword("");
  }

  async function handleExchange() {
    if (!selectedItem || !selectedProduct || !adminPassword) return;
    setLoading(true);

    try {
      // Verify admin identity
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("Não autenticado");

      // Verify admin role
      const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      if (!roleData) {
        toast.error("Apenas administradores podem realizar trocas");
        setLoading(false);
        return;
      }

      // Re-authenticate with password
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: adminPassword,
      });
      if (signInErr) {
        toast.error("Senha incorreta");
        setLoading(false);
        return;
      }

      // 1. Return original stock_item to inventory
      if (selectedItem.stock_item_id) {
        await supabase.from("stock_items").update({
          order_item_id: null,
          status: "revisado",
        }).eq("id", selectedItem.stock_item_id);
      }

      // 2. Find available stock_item for new product
      const { data: newStockItem, error: stockErr } = await supabase
        .from("stock_items")
        .select("id, data, identification, identification_link")
        .eq("product_id", selectedProduct.id)
        .eq("status", "revisado")
        .is("order_item_id", null)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .single();

      if (stockErr || !newStockItem) {
        toast.error("Sem estoque disponível para o novo produto");
        setLoading(false);
        return;
      }

      // Build delivery_data
      const deliveryData: Record<string, any> = { ...(newStockItem.data as Record<string, any> || {}) };
      if (newStockItem.identification) deliveryData.idPerfil = newStockItem.identification;
      if (newStockItem.identification_link) deliveryData.linkPerfil = newStockItem.identification_link;

      // 3. Update order_item
      await supabase.from("order_items").update({
        product_id: selectedProduct.id,
        name: selectedProduct.name,
        price: selectedProduct.price,
        delivery_data: Object.keys(deliveryData).length > 0 ? deliveryData : null,
      }).eq("id", selectedItem.order_item_id);

      // 4. Link new stock_item
      await supabase.from("stock_items").update({
        order_item_id: selectedItem.order_item_id,
        status: "vendido",
      }).eq("id", newStockItem.id);

      // 5. Adjust wallet
      if (priceDiff !== 0) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("balance")
          .eq("user_id", selectedItem.client_user_id)
          .single();

        const currentBalance = profile?.balance || 0;

        if (priceDiff > 0) {
          const newBalance = currentBalance - priceDiff;
          await supabase.from("profiles").update({ balance: newBalance }).eq("user_id", selectedItem.client_user_id);
          await supabase.from("wallet_transactions").insert({
            user_id: selectedItem.client_user_id,
            type: "debit",
            amount: priceDiff,
            title: `[Troca] Diferença — ${selectedItem.product_name} → ${selectedProduct.name}`,
            balance_after: newBalance,
          });
        } else {
          const credit = Math.abs(priceDiff);
          const newBalance = currentBalance + credit;
          await supabase.from("profiles").update({ balance: newBalance }).eq("user_id", selectedItem.client_user_id);
          await supabase.from("wallet_transactions").insert({
            user_id: selectedItem.client_user_id,
            type: "credit",
            amount: credit,
            title: `[Troca] Crédito — ${selectedItem.product_name} → ${selectedProduct.name}`,
            balance_after: newBalance,
          });
        }
      }

      // 6. Update order total
      const { data: allItems } = await supabase
        .from("order_items")
        .select("price, quantity")
        .eq("order_id", selectedItem.order_id);

      const newTotal = (allItems || []).reduce((s, i) => s + i.price * i.quantity, 0);
      await supabase.from("orders").update({ subtotal: newTotal, total: newTotal }).eq("id", selectedItem.order_id);

      // 7. Record exchange
      await supabase.from("product_exchanges" as any).insert({
        order_id: selectedItem.order_id,
        order_item_id: selectedItem.order_item_id,
        original_product_id: selectedItem.product_id,
        original_product_name: selectedItem.product_name,
        original_stock_item_id: selectedItem.stock_item_id,
        new_product_id: selectedProduct.id,
        new_product_name: selectedProduct.name,
        new_stock_item_id: newStockItem.id,
        price_difference: priceDiff,
        wallet_adjusted: priceDiff !== 0,
        reason: reason || null,
        performed_by: user.id,
        client_user_id: selectedItem.client_user_id,
        client_name: selectedItem.client_name,
      } as any);

      toast.success("Troca realizada com sucesso!");
      setExchangeDone(true);
      setShowPasswordStep(false);
    } catch (err: any) {
      console.error("Exchange error:", err);
      toast.error(err.message || "Erro ao realizar troca");
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory() {
    const { data } = await supabase
      .from("product_exchanges" as any)
      .select("id, original_product_name, new_product_name, price_difference, client_name, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    setHistory((data as any) || []);
    setHistoryLoaded(true);
  }

  function resetForm() {
    setOrderCode("");
    setOrderItems([]);
    setSelectedItem(null);
    setSelectedProduct(null);
    setReason("");
    setShowPasswordStep(false);
    setAdminPassword("");
    setExchangeDone(false);
    setLookupDone(false);
  }

  return (
    <div className="space-y-6 py-2">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-black tracking-tight text-foreground lg:text-5xl">Trocas</h1>
        <p className="text-base font-light text-muted-foreground mt-1">Realize trocas de produtos em pedidos existentes.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Main Form */}
        <div className="lg:col-span-3 space-y-4">
          {/* Step 1: Order Lookup */}
          <div className="glass-panel rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">1. Buscar Pedido</h2>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Código do pedido (ex: ORD-MMCBIMQC)"
                  value={orderCode}
                  onChange={e => setOrderCode(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && lookupOrder()}
                  className="pl-10"
                />
              </div>
              <Button onClick={lookupOrder} disabled={lookupLoading || !orderCode.trim()}>
                {lookupLoading ? <Loader2 className="size-4 animate-spin" /> : "Buscar"}
              </Button>
            </div>

            {lookupDone && orderItems.length === 0 && (
              <p className="text-sm text-destructive">Pedido não encontrado ou sem itens.</p>
            )}

            {orderItems.length > 0 && (
              <div className="space-y-3">
                {/* Client info */}
                <div className="rounded-xl bg-muted/50 border border-border p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Cliente</p>
                    <p className="font-bold text-foreground">{orderItems[0].client_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Pedido</p>
                    <p className="font-mono font-bold text-foreground">{orderItems[0].order_code}</p>
                  </div>
                </div>

                {/* Items */}
                <p className="text-xs text-muted-foreground font-semibold uppercase">Selecione o item para trocar:</p>
                {orderItems.map(item => (
                  <button
                    key={item.order_item_id}
                    onClick={() => handleSelectItem(item)}
                    disabled={exchangeDone}
                    className={`w-full text-left rounded-xl p-3 border transition-colors ${
                      selectedItem?.order_item_id === item.order_item_id
                        ? "bg-primary/10 border-primary/30"
                        : "bg-muted/30 border-border hover:bg-muted/50"
                    } ${exchangeDone ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">{item.product_name}</p>
                        <p className="text-xs text-muted-foreground">Qtd: {item.quantity} • {item.order_date}</p>
                      </div>
                      <p className="font-bold text-primary">R$ {item.price.toFixed(2).replace(".", ",")}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Step 2: Select New Product */}
          {selectedItem && !exchangeDone && !showPasswordStep && (
            <div className="glass-panel rounded-2xl p-5 space-y-4">
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">2. Novo Produto</h2>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar produto..."
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              {loadingProducts ? (
                <div className="flex justify-center py-4"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
              ) : (
                <div className="max-h-52 overflow-y-auto space-y-1 border border-border rounded-xl p-1">
                  {filteredProducts.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-4">Nenhum produto disponível</p>
                  ) : filteredProducts.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedProduct(p)}
                      className={`w-full text-left flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors ${
                        selectedProduct?.id === p.id
                          ? "bg-primary/10 border border-primary/30"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <div>
                        <span className="font-medium text-foreground">{p.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">({p.stock} em estoque)</span>
                      </div>
                      <span className="font-bold text-primary text-sm">R$ {p.price.toFixed(2).replace(".", ",")}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Price difference */}
              {selectedProduct && (
                <div className={`rounded-xl p-3 border ${
                  priceDiff > 0 ? "bg-orange-500/5 border-orange-500/20" :
                  priceDiff < 0 ? "bg-green-500/5 border-green-500/20" :
                  "bg-muted/50 border-border"
                }`}>
                  <div className="flex items-center gap-2">
                    {priceDiff !== 0 && <AlertTriangle className="size-4 text-orange-400" />}
                    <Package className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">
                      {priceDiff > 0
                        ? `Débito de R$ ${priceDiff.toFixed(2).replace(".", ",")} na carteira do cliente`
                        : priceDiff < 0
                        ? `Crédito de R$ ${Math.abs(priceDiff).toFixed(2).replace(".", ",")} na carteira do cliente`
                        : "Mesmo valor — sem ajuste na carteira"}
                    </span>
                  </div>
                </div>
              )}

              {/* Reason */}
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase mb-1">Motivo da troca</p>
                <Textarea
                  placeholder="Ex: Cliente comprou produto errado..."
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={2}
                />
              </div>

              <Button className="w-full" disabled={!selectedProduct} onClick={handleProceed}>
                <ArrowRightLeft className="size-4 mr-2" />
                Prosseguir com Troca
              </Button>
            </div>
          )}

          {/* Step 3: Password confirmation */}
          {showPasswordStep && !exchangeDone && (
            <div className="glass-panel rounded-2xl p-5 space-y-4">
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">3. Confirmação de Segurança</h2>

              <div className="rounded-xl bg-muted/50 border border-border p-4 text-center">
                <Lock className="size-8 mx-auto mb-2 text-primary" />
                <p className="font-bold text-foreground">Confirme sua identidade</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Trocar <span className="font-semibold text-foreground">{selectedItem?.product_name}</span> → <span className="font-semibold text-primary">{selectedProduct?.name}</span>
                </p>
                <p className="text-xs text-muted-foreground">Cliente: <span className="font-semibold text-foreground">{selectedItem?.client_name}</span></p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase mb-1">Senha do Admin</p>
                <Input
                  type="password"
                  placeholder="Digite sua senha..."
                  value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && adminPassword && handleExchange()}
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowPasswordStep(false)} disabled={loading}>
                  Voltar
                </Button>
                <Button className="flex-1" disabled={!adminPassword || loading} onClick={handleExchange}>
                  {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : <ShieldCheck className="size-4 mr-2" />}
                  Confirmar Troca
                </Button>
              </div>
            </div>
          )}

          {/* Success */}
          {exchangeDone && (
            <div className="glass-panel rounded-2xl p-6 text-center space-y-3">
              <CheckCircle className="size-12 mx-auto text-green-400" />
              <h3 className="text-lg font-bold text-foreground">Troca Realizada!</h3>
              <p className="text-sm text-muted-foreground">
                O produto foi trocado e o estoque atualizado automaticamente.
                {priceDiff !== 0 && " A carteira do cliente foi ajustada."}
              </p>
              <Button variant="outline" onClick={resetForm}>
                Nova Troca
              </Button>
            </div>
          )}
        </div>

        {/* Sidebar: History */}
        <div className="lg:col-span-2">
          <div className="glass-panel rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Histórico de Trocas</h2>
              {!historyLoaded && (
                <Button variant="ghost" size="sm" onClick={loadHistory}>Carregar</Button>
              )}
            </div>

            {historyLoaded && history.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma troca realizada ainda.</p>
            )}

            {history.map(h => (
              <div key={h.id} className="rounded-xl bg-muted/30 border border-border p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-foreground">{h.client_name || "—"}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(h.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {h.original_product_name} → <span className="text-primary font-medium">{h.new_product_name}</span>
                </p>
                {h.price_difference !== 0 && (
                  <p className={`text-xs font-bold ${h.price_difference > 0 ? "text-orange-400" : "text-green-400"}`}>
                    {h.price_difference > 0 ? "+" : ""}R$ {h.price_difference.toFixed(2).replace(".", ",")}
                  </p>
                )}
                {h.reason && <p className="text-[11px] text-muted-foreground italic">{h.reason}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
