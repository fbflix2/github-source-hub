import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowRightLeft, Search, Loader2, Package, AlertTriangle } from "lucide-react";

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
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    if (open) {
      fetchProducts();
      setSelectedProduct(null);
      setReason("");
      setSearch("");
    }
  }, [open]);

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

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) &&
    p.id !== orderItem?.product_id
  );

  const priceDiff = selectedProduct && orderItem
    ? selectedProduct.price - orderItem.price
    : 0;

  async function handleExchange() {
    if (!orderItem || !selectedProduct) return;
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      // 1. Return original stock_item to inventory (if exists)
      if (orderItem.stock_item_id) {
        await supabase.from("stock_items").update({
          order_item_id: null,
          status: "revisado",
        }).eq("id", orderItem.stock_item_id);
      }

      // 2. Fulfill new product: find available stock_item
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

      // Build delivery_data from new stock_item
      const deliveryData: Record<string, any> = { ...(newStockItem.data as Record<string, any> || {}) };
      if (newStockItem.identification) deliveryData.idPerfil = newStockItem.identification;
      if (newStockItem.identification_link) deliveryData.linkPerfil = newStockItem.identification_link;

      // 3. Update order_item with new product info
      await supabase.from("order_items").update({
        product_id: selectedProduct.id,
        name: selectedProduct.name,
        price: selectedProduct.price,
        delivery_data: Object.keys(deliveryData).length > 0 ? deliveryData : null,
      }).eq("id", orderItem.order_item_id);

      // 4. Link new stock_item to order_item
      await supabase.from("stock_items").update({
        order_item_id: orderItem.order_item_id,
        status: "vendido",
      }).eq("id", newStockItem.id);

      // 5. Adjust wallet if price difference
      if (priceDiff !== 0) {
        // Get current balance
        const { data: profile } = await supabase
          .from("profiles")
          .select("balance")
          .eq("user_id", clientUserId)
          .single();

        const currentBalance = profile?.balance || 0;

        if (priceDiff > 0) {
          // New product costs more → debit from client wallet
          const newBalance = currentBalance - priceDiff;
          await supabase.from("profiles").update({ balance: newBalance }).eq("user_id", clientUserId);
          await supabase.from("wallet_transactions").insert({
            user_id: clientUserId,
            type: "debit",
            amount: priceDiff,
            title: `[Troca] Diferença de produto — ${orderItem.product_name} → ${selectedProduct.name}`,
            balance_after: newBalance,
          });
        } else {
          // New product costs less → credit to client wallet
          const credit = Math.abs(priceDiff);
          const newBalance = currentBalance + credit;
          await supabase.from("profiles").update({ balance: newBalance }).eq("user_id", clientUserId);
          await supabase.from("wallet_transactions").insert({
            user_id: clientUserId,
            type: "credit",
            amount: credit,
            title: `[Troca] Crédito de diferença — ${orderItem.product_name} → ${selectedProduct.name}`,
            balance_after: newBalance,
          });
        }
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

      // 7. Record exchange for audit
      await supabase.from("product_exchanges" as any).insert({
        order_id: orderId,
        order_item_id: orderItem.order_item_id,
        original_product_id: orderItem.product_id,
        original_product_name: orderItem.product_name,
        original_stock_item_id: orderItem.stock_item_id,
        new_product_id: selectedProduct.id,
        new_product_name: selectedProduct.name,
        new_stock_item_id: newStockItem.id,
        price_difference: priceDiff,
        wallet_adjusted: priceDiff !== 0,
        reason: reason || null,
        performed_by: user.id,
        client_user_id: clientUserId,
        client_name: clientName,
      } as any);

      toast.success("Troca realizada com sucesso!");
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="size-5 text-primary" />
            Trocar Produto
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Current item */}
          <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-3">
            <p className="text-xs text-muted-foreground font-semibold uppercase mb-1">Produto Atual</p>
            <p className="font-bold text-foreground">{orderItem.product_name}</p>
            <p className="text-sm text-primary font-bold">R$ {orderItem.price.toFixed(2).replace(".", ",")}</p>
          </div>

          {/* Search new product */}
          <div>
            <p className="text-xs text-muted-foreground font-semibold uppercase mb-2">Novo Produto</p>
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
                ) : filtered.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProduct(p)}
                    className={`w-full text-left flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
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
          </div>

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
            disabled={!selectedProduct || loading}
            onClick={handleExchange}
          >
            {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : <ArrowRightLeft className="size-4 mr-2" />}
            Confirmar Troca
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
