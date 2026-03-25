import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowRightLeft, Search, Loader2, Package, AlertTriangle, ShieldCheck, Lock, X, Plus, Minus } from "lucide-react";

interface ExchangeItem {
  order_item_id: string;
  product_id: string | null;
  product_name: string;
  price: number;
  stock_item_id: string | null;
}

interface ProductOption {
  id: string;
  name: string;
  price: number;
  stock: number;
  image_url: string | null;
}

interface SelectedEntry {
  product: ProductOption;
  qty: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderItem: ExchangeItem | null;
  orderId: string;
  clientUserId: string;
  clientName: string;
  onExchangeComplete: () => void;
}

export default function ProductExchangeModal({ open, onOpenChange, orderItem, orderId, clientUserId, clientName, onExchangeComplete }: Props) {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SelectedEntry[]>([]);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [showPasswordStep, setShowPasswordStep] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (open) {
      fetchProducts();
      checkAdmin();
      setSelected([]);
      setReason("");
      setSearch("");
      setAdminPassword("");
      setShowPasswordStep(false);
    }
  }, [open]);

  async function checkAdmin() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setIsAdmin(false); return; }
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    setIsAdmin(!!data);
  }

  async function fetchProducts() {
    setLoadingProducts(true);
    const { data } = await supabase
      .from("products")
      .select("id, name, price, stock, image_url")
      .eq("status", "active")
      .gt("stock", 0)
      .order("name");
    setProducts(data || []);
    setLoadingProducts(false);
  }

  // How many units of a product are already selected
  function getSelectedQty(productId: string) {
    return selected.find(s => s.product.id === productId)?.qty || 0;
  }

  // Available stock considering selections
  function availableStock(p: ProductOption) {
    return p.stock - getSelectedQty(p.id);
  }

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) &&
    p.id !== orderItem?.product_id
  );

  function addProduct(p: ProductOption) {
    setSelected(prev => {
      const existing = prev.find(s => s.product.id === p.id);
      if (existing) {
        if (existing.qty >= p.stock) return prev;
        return prev.map(s => s.product.id === p.id ? { ...s, qty: s.qty + 1 } : s);
      }
      return [...prev, { product: p, qty: 1 }];
    });
  }

  function removeProduct(productId: string) {
    setSelected(prev => {
      const existing = prev.find(s => s.product.id === productId);
      if (!existing) return prev;
      if (existing.qty <= 1) return prev.filter(s => s.product.id !== productId);
      return prev.map(s => s.product.id === productId ? { ...s, qty: s.qty - 1 } : s);
    });
  }

  function removeProductEntirely(productId: string) {
    setSelected(prev => prev.filter(s => s.product.id !== productId));
  }

  const totalNewPrice = selected.reduce((sum, s) => sum + s.product.price * s.qty, 0);
  const totalNewItems = selected.reduce((sum, s) => sum + s.qty, 0);
  const priceDiff = orderItem ? totalNewPrice - orderItem.price : 0;

  function handleConfirmClick() {
    if (selected.length === 0) return;
    setShowPasswordStep(true);
  }

  async function handleExchange() {
    if (!orderItem || selected.length === 0 || !adminPassword) return;
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("Não autenticado");

      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: adminPassword,
      });
      if (signInErr) {
        toast.error("Senha incorreta");
        setLoading(false);
        return;
      }

      // 1. Check if client accessed credentials before returning to stock
      if (orderItem.stock_item_id) {
        // Fetch delivery_data to check if credentials were accessed
        const { data: originalItem } = await supabase
          .from("order_items")
          .select("delivery_data")
          .eq("id", orderItem.order_item_id)
          .single();
        
        const credentialsAccessed = !!(originalItem?.delivery_data as any)?._credentials_accessed_at;
        
        if (credentialsAccessed) {
          // Item was compromised — mark as such, do NOT return to stock
          await supabase.from("stock_items").update({
            order_item_id: null,
            status: "comprometido",
          }).eq("id", orderItem.stock_item_id);
          toast.info("Item original marcado como comprometido (cliente já acessou credenciais)");
        } else {
          // Item not accessed — safe to return to stock
          await supabase.from("stock_items").update({
            order_item_id: null,
            status: "revisado",
          }).eq("id", orderItem.stock_item_id);
        }
      }

      // Flatten selected into individual units
      const units: ProductOption[] = [];
      for (const s of selected) {
        for (let i = 0; i < s.qty; i++) units.push(s.product);
      }

      // 2. For each unit, find a stock item and link it
      const linkedItems: { product: ProductOption; stockItemId: string; deliveryData: Record<string, any> }[] = [];
      
      for (const prod of units) {
        const alreadyUsed = linkedItems.filter(l => l.product.id === prod.id).map(l => l.stockItemId);
        
        let query = supabase
          .from("stock_items")
          .select("id, data, identification, identification_link")
          .eq("product_id", prod.id)
          .eq("status", "revisado")
          .is("order_item_id", null)
          .is("deleted_at", null)
          .order("created_at", { ascending: true })
          .limit(alreadyUsed.length + 1);

        const { data: stockItems, error: stockErr } = await query;
        if (stockErr) throw stockErr;

        // Find one not already used
        const available = (stockItems || []).find(si => !alreadyUsed.includes(si.id));
        if (!available) {
          toast.error(`Sem estoque suficiente para "${prod.name}"`);
          setLoading(false);
          return;
        }

        const deliveryData: Record<string, any> = { ...(available.data as Record<string, any> || {}) };
        if (available.identification) deliveryData.idPerfil = available.identification;
        if (available.identification_link) deliveryData.linkPerfil = available.identification_link;

        linkedItems.push({ product: prod, stockItemId: available.id, deliveryData });
      }

      // Build pending payment flag if client owes money
      const exchangeTimestamp = new Date().toISOString();
      const pendingPaymentData = priceDiff > 0 ? {
        _exchange_pending_payment: {
          amount: priceDiff,
          original_product: orderItem.product_name,
          created_at: exchangeTimestamp,
        }
      } : {};
      // For additional items: just lock them (no separate payment needed)
      const lockedData = priceDiff > 0 ? {
        _exchange_locked: exchangeTimestamp,
      } : {};

      // 3. Update the FIRST unit on the existing order_item (WITHOUT payment flag first)
      const first = linkedItems[0];
      const firstDelivery = { ...first.deliveryData };
      await supabase.from("order_items").update({
        product_id: first.product.id,
        name: first.product.name,
        price: first.product.price,
        quantity: 1,
        delivery_data: Object.keys(firstDelivery).length > 0 ? firstDelivery : null,
      }).eq("id", orderItem.order_item_id);

      await supabase.from("stock_items").update({
        order_item_id: orderItem.order_item_id,
        status: "vendido",
      }).eq("id", first.stockItemId);

      // Collect all new order item IDs for lock step
      const allNewOrderItemIds: string[] = [];

      // 4. Create NEW order_items for remaining units
      for (let i = 1; i < linkedItems.length; i++) {
        const item = linkedItems[i];
        const itemDelivery = { ...item.deliveryData };
        const { data: newOI, error: oiErr } = await supabase.from("order_items").insert({
          order_id: orderId,
          product_id: item.product.id,
          name: item.product.name,
          price: item.product.price,
          quantity: 1,
          delivery_data: Object.keys(itemDelivery).length > 0 ? itemDelivery : null,
        }).select("id").single();

        if (oiErr) throw oiErr;
        allNewOrderItemIds.push(newOI.id);

        await supabase.from("stock_items").update({
          order_item_id: newOI.id,
          status: "vendido",
        }).eq("id", item.stockItemId);
      }

      // 4b. FINAL STEP: Apply payment flag / lock AFTER all stock operations
      // This ensures no trigger or side-effect can overwrite the flag
      if (priceDiff > 0) {
        // Re-read current delivery_data to merge safely
        const { data: freshItem } = await supabase
          .from("order_items")
          .select("delivery_data")
          .eq("id", orderItem.order_item_id)
          .single();

        const freshDD = (freshItem?.delivery_data && typeof freshItem.delivery_data === "object")
          ? { ...(freshItem.delivery_data as Record<string, any>) }
          : { ...first.deliveryData };

        freshDD._exchange_pending_payment = {
          amount: priceDiff,
          original_product: orderItem.product_name,
          created_at: exchangeTimestamp,
        };

        const { error: flagErr } = await supabase.from("order_items").update({
          delivery_data: freshDD,
        }).eq("id", orderItem.order_item_id);

        if (flagErr) {
          console.error("Failed to set exchange payment flag:", flagErr);
          throw new Error("Erro ao definir flag de pagamento pendente");
        }

        // Lock sibling items
        for (const sibId of allNewOrderItemIds) {
          const { data: sibItem } = await supabase
            .from("order_items")
            .select("delivery_data")
            .eq("id", sibId)
            .single();

          const sibDD = (sibItem?.delivery_data && typeof sibItem.delivery_data === "object")
            ? { ...(sibItem.delivery_data as Record<string, any>) }
            : {};

          sibDD._exchange_locked = exchangeTimestamp;

          await supabase.from("order_items").update({
            delivery_data: sibDD,
          }).eq("id", sibId);
        }
      }

      // 5. Adjust wallet (only credit for cheaper items; debit is handled by client payment)
      if (priceDiff < 0) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("balance")
          .eq("user_id", clientUserId)
          .single();

        const currentBalance = profile?.balance || 0;
        const newNames = selected.map(s => s.qty > 1 ? `${s.qty}x ${s.product.name}` : s.product.name).join(", ");

        const credit = Math.abs(priceDiff);
        const newBalance = currentBalance + credit;
        await supabase.from("profiles").update({ balance: newBalance }).eq("user_id", clientUserId);
        await supabase.from("wallet_transactions").insert({
          user_id: clientUserId,
          type: "credit",
          amount: credit,
          title: `[Troca] Crédito — ${orderItem.product_name} → ${newNames}`,
          balance_after: newBalance,
        });
      }

      // 6. Update order total
      const { data: allItems } = await supabase
        .from("order_items")
        .select("price, quantity")
        .eq("order_id", orderId);

      const newTotal = (allItems || []).reduce((s, i) => s + i.price * i.quantity, 0);
      await supabase.from("orders").update({
        subtotal: newTotal,
        total: newTotal,
      }).eq("id", orderId);

      // 7. Record exchange(s) for audit
      for (const item of linkedItems) {
        await supabase.from("product_exchanges" as any).insert({
          order_id: orderId,
          order_item_id: orderItem.order_item_id,
          original_product_id: orderItem.product_id,
          original_product_name: orderItem.product_name,
          original_stock_item_id: orderItem.stock_item_id,
          new_product_id: item.product.id,
          new_product_name: item.product.name,
          new_stock_item_id: item.stockItemId,
          price_difference: priceDiff / linkedItems.length,
          wallet_adjusted: priceDiff !== 0,
          reason: reason || null,
          performed_by: user.id,
          client_user_id: clientUserId,
          client_name: clientName,
        } as any);
      }

      const successMsg = priceDiff > 0
        ? `Troca realizada! Cliente precisa pagar R$ ${priceDiff.toFixed(2).replace(".", ",")} para acessar o item.`
        : `Troca realizada! ${totalNewItems} item(ns) vinculado(s).`;
      toast.success(successMsg);
      onExchangeComplete();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Exchange error:", err);
      toast.error(err.message || "Erro ao realizar troca");
    } finally {
      setLoading(false);
    }
  }

  if (!orderItem) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="size-5 text-primary" />
            Trocar Produto
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {isAdmin === false && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4 text-center">
              <ShieldCheck className="size-6 mx-auto mb-2 text-destructive" />
              <p className="text-sm font-medium text-destructive">Apenas administradores podem realizar trocas.</p>
            </div>
          )}

          {isAdmin !== false && !showPasswordStep && (
            <>
              {/* Current item */}
              <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-3">
                <p className="text-xs text-muted-foreground font-semibold uppercase mb-1">Produto Atual</p>
                <p className="font-bold text-foreground">{orderItem.product_name}</p>
                <p className="text-sm text-primary font-bold">R$ {orderItem.price.toFixed(2).replace(".", ",")}</p>
              </div>

              {/* Selected products */}
              {selected.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground font-semibold uppercase">Selecionados ({totalNewItems} item{totalNewItems > 1 ? "s" : ""})</p>
                  {selected.map(s => (
                    <div key={s.product.id} className="flex items-center justify-between rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <button onClick={() => removeProductEntirely(s.product.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                          <X className="size-3.5" />
                        </button>
                        <span className="text-sm font-medium text-foreground">{s.product.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => removeProduct(s.product.id)}
                          className="size-6 rounded-md bg-muted flex items-center justify-center hover:bg-muted-foreground/20 transition-colors"
                        >
                          <Minus className="size-3" />
                        </button>
                        <span className="text-sm font-bold text-foreground w-5 text-center">{s.qty}</span>
                        <button
                          onClick={() => addProduct(s.product)}
                          disabled={s.qty >= s.product.stock}
                          className="size-6 rounded-md bg-muted flex items-center justify-center hover:bg-muted-foreground/20 transition-colors disabled:opacity-30"
                        >
                          <Plus className="size-3" />
                        </button>
                        <span className="text-sm font-bold text-primary ml-1 w-20 text-right">
                          R$ {(s.product.price * s.qty).toFixed(2).replace(".", ",")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Search new product */}
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase mb-2">
                  {selected.length > 0 ? "Adicionar Produto" : "Novo Produto"}
                </p>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produto..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {loadingProducts ? (
                  <div className="flex justify-center py-4"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded-lg p-1">
                    {filtered.length === 0 ? (
                      <p className="text-center text-sm text-muted-foreground py-4">Nenhum produto disponível</p>
                    ) : filtered.map(p => {
                      const selQty = getSelectedQty(p.id);
                      const remaining = p.stock - selQty;
                      return (
                        <button
                          key={p.id}
                          onClick={() => addProduct(p)}
                          disabled={remaining <= 0}
                          className={`w-full text-left flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors disabled:opacity-40 ${
                            selQty > 0
                              ? "bg-primary/10 border border-primary/30"
                              : "hover:bg-muted/50"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{p.name}</span>
                            <span className="text-xs text-muted-foreground">({remaining} disponível{remaining !== 1 ? "is" : ""})</span>
                            {selQty > 0 && <Badge variant="outline" className="text-xs px-1.5 py-0">{selQty}x</Badge>}
                          </div>
                          <span className="font-bold text-primary text-sm">R$ {p.price.toFixed(2).replace(".", ",")}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Price difference */}
              {selected.length > 0 && (
                <div className={`rounded-xl p-3 border ${
                  priceDiff > 0 ? "bg-orange-500/5 border-orange-500/20" :
                  priceDiff < 0 ? "bg-green-500/5 border-green-500/20" :
                  "bg-muted/50 border-border"
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {priceDiff !== 0 && <AlertTriangle className="size-4 text-orange-400" />}
                      <Package className="size-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">
                        {priceDiff > 0
                          ? `Cliente pagará R$ ${priceDiff.toFixed(2).replace(".", ",")} (PIX ou Saldo) para acessar`
                          : priceDiff < 0
                          ? `Crédito de R$ ${Math.abs(priceDiff).toFixed(2).replace(".", ",")} na carteira`
                          : "Mesmo valor — sem ajuste"}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      R$ {orderItem.price.toFixed(2).replace(".", ",")} → R$ {totalNewPrice.toFixed(2).replace(".", ",")}
                    </span>
                  </div>
                </div>
              )}

              {/* Reason */}
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase mb-1">Motivo (opcional)</p>
                <Textarea
                  placeholder="Ex: Cliente comprou produto errado..."
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={2}
                />
              </div>

              <Button
                className="w-full"
                disabled={selected.length === 0 || isAdmin === null}
                onClick={handleConfirmClick}
              >
                <ArrowRightLeft className="size-4 mr-2" />
                Prosseguir com Troca ({totalNewItems} item{totalNewItems > 1 ? "s" : ""})
              </Button>
            </>
          )}

          {isAdmin && showPasswordStep && (
            <div className="space-y-4">
              <div className="rounded-xl bg-muted/50 border border-border p-4 text-center">
                <Lock className="size-8 mx-auto mb-2 text-primary" />
                <p className="font-bold text-foreground">Confirmação de Segurança</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Trocar <span className="font-semibold text-foreground">{orderItem.product_name}</span> → {" "}
                  <span className="font-semibold text-primary">
                    {selected.map(s => s.qty > 1 ? `${s.qty}x ${s.product.name}` : s.product.name).join(", ")}
                  </span>
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase mb-1">Senha do Admin</p>
                <Input
                  type="password"
                  placeholder="Digite sua senha para confirmar..."
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
