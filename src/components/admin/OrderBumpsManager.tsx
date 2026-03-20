import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Save, Star, Layers, Percent, DollarSign, GripVertical } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Product {
  id: string;
  name: string;
  price: number;
  icon_type: string | null;
  image_url: string | null;
}

interface OrderBump {
  id: string;
  product_id: string;
  bump_product_id: string;
  bump_type: string;
  discount_percent: number;
  fixed_price: number | null;
  position: number;
  active: boolean;
  label: string | null;
  bump_product?: Product;
}

interface Props {
  productId: string;
  productName: string;
  open: boolean;
  onClose: () => void;
}

export function OrderBumpsManager({ productId, productName, open, onClose }: Props) {
  const [bumps, setBumps] = useState<OrderBump[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newBumpProductId, setNewBumpProductId] = useState("");
  const [newBumpType, setNewBumpType] = useState<"main" | "secondary">("secondary");
  const [newDiscountPercent, setNewDiscountPercent] = useState(0);
  const [newFixedPrice, setNewFixedPrice] = useState("");
  const [newLabel, setNewLabel] = useState("");

  useEffect(() => {
    if (!open) return;
    fetchData();
  }, [open, productId]);

  const fetchData = async () => {
    setLoading(true);
    const [bumpsRes, productsRes] = await Promise.all([
      supabase
        .from("order_bumps")
        .select("*")
        .eq("product_id", productId)
        .order("position", { ascending: true }),
      supabase
        .from("products")
        .select("id, name, price, icon_type, image_url")
        .neq("id", productId)
        .eq("status", "active"),
    ]);

    const bumpsData = (bumpsRes.data || []) as OrderBump[];
    const productsData = (productsRes.data || []) as Product[];
    setAllProducts(productsData);

    // Enrich bumps with product info
    const enriched = bumpsData.map((b) => ({
      ...b,
      bump_product: productsData.find((p) => p.id === b.bump_product_id),
    }));
    setBumps(enriched);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!newBumpProductId) {
      toast.error("Selecione um produto");
      return;
    }

    const exists = bumps.find((b) => b.bump_product_id === newBumpProductId);
    if (exists) {
      toast.error("Este produto já está configurado como bump");
      return;
    }

    // If adding a 'main' type, check if one already exists
    if (newBumpType === "main") {
      const existingMain = bumps.find((b) => b.bump_type === "main");
      if (existingMain) {
        // Demote existing main to secondary
        await supabase
          .from("order_bumps")
          .update({ bump_type: "secondary" })
          .eq("id", existingMain.id);
      }
    }

    const { error } = await supabase.from("order_bumps").insert({
      product_id: productId,
      bump_product_id: newBumpProductId,
      bump_type: newBumpType,
      discount_percent: newDiscountPercent,
      fixed_price: newFixedPrice ? parseFloat(newFixedPrice) : null,
      position: bumps.length,
      label: newLabel || null,
    });

    if (error) {
      toast.error("Erro ao adicionar bump");
      console.error(error);
      return;
    }

    toast.success("Bump adicionado!");
    setAddModalOpen(false);
    resetNewForm();
    fetchData();
  };

  const resetNewForm = () => {
    setNewBumpProductId("");
    setNewBumpType("secondary");
    setNewDiscountPercent(0);
    setNewFixedPrice("");
    setNewLabel("");
  };

  const handleRemove = async (bumpId: string) => {
    const { error } = await supabase.from("order_bumps").delete().eq("id", bumpId);
    if (error) {
      toast.error("Erro ao remover bump");
      return;
    }
    toast.success("Bump removido");
    fetchData();
  };

  const handleToggleActive = async (bump: OrderBump) => {
    await supabase
      .from("order_bumps")
      .update({ active: !bump.active })
      .eq("id", bump.id);
    fetchData();
  };

  const handleUpdateField = async (bumpId: string, field: string, value: any) => {
    // If setting bump_type to 'main', demote existing main
    if (field === "bump_type" && value === "main") {
      const existingMain = bumps.find((b) => b.bump_type === "main" && b.id !== bumpId);
      if (existingMain) {
        await supabase
          .from("order_bumps")
          .update({ bump_type: "secondary" })
          .eq("id", existingMain.id);
      }
    }
    await supabase.from("order_bumps").update({ [field]: value }).eq("id", bumpId);
    fetchData();
  };

  const getIconColor = (iconType: string | null) => {
    switch (iconType) {
      case "perfil": return "text-blue-400";
      case "bm": return "text-amber-400";
      case "proxy": return "text-emerald-400";
      case "page": return "text-purple-400";
      default: return "text-muted-foreground";
    }
  };

  const getIconLabel = (iconType: string | null) => {
    switch (iconType) {
      case "perfil": return "Perfil";
      case "bm": return "BM";
      case "proxy": return "Proxy";
      case "page": return "Página";
      default: return "Outro";
    }
  };

  const mainBump = bumps.find((b) => b.bump_type === "main");
  const secondaryBumps = bumps.filter((b) => b.bump_type === "secondary");

  const availableProducts = allProducts.filter(
    (p) => !bumps.some((b) => b.bump_product_id === p.id)
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="size-5 text-primary" />
            Order Bumps — {productName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Main Bump */}
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
                <Star className="size-4 text-amber-400" />
                Bump Principal
                <span className="text-[10px] text-muted-foreground font-normal">(destaque no checkout)</span>
              </h3>
              {mainBump ? (
                <BumpCard
                  bump={mainBump}
                  onRemove={handleRemove}
                  onToggleActive={handleToggleActive}
                  onUpdateField={handleUpdateField}
                  getIconColor={getIconColor}
                  getIconLabel={getIconLabel}
                />
              ) : (
                <div className="border border-dashed border-border rounded-xl p-6 text-center">
                  <p className="text-xs text-muted-foreground mb-2">Nenhum bump principal configurado</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setNewBumpType("main");
                      setAddModalOpen(true);
                    }}
                  >
                    <Plus className="size-3 mr-1" />
                    Definir Bump Principal
                  </Button>
                </div>
              )}
            </div>

            {/* Secondary Bumps */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Layers className="size-4 text-primary" />
                  Bumps Secundários
                  <span className="text-[10px] text-muted-foreground font-normal">({secondaryBumps.length} configurados)</span>
                </h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setNewBumpType("secondary");
                    setAddModalOpen(true);
                  }}
                >
                  <Plus className="size-3 mr-1" />
                  Adicionar
                </Button>
              </div>
              {secondaryBumps.length === 0 ? (
                <div className="border border-dashed border-border rounded-xl p-6 text-center">
                  <p className="text-xs text-muted-foreground">
                    Nenhum bump secundário. Quando não houver bumps configurados, o sistema usará a sugestão inteligente automática.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {secondaryBumps.map((bump) => (
                    <BumpCard
                      key={bump.id}
                      bump={bump}
                      onRemove={handleRemove}
                      onToggleActive={handleToggleActive}
                      onUpdateField={handleUpdateField}
                      getIconColor={getIconColor}
                      getIconLabel={getIconLabel}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="bg-muted/30 border border-border rounded-xl p-4">
              <h4 className="text-xs font-bold text-foreground mb-1">💡 Como funciona</h4>
              <ul className="text-[11px] text-muted-foreground space-y-1">
                <li>• <strong>Bump Principal:</strong> Aparece em destaque no topo direito do checkout (card "OPORTUNIDADE ÚNICA")</li>
                <li>• <strong>Bumps Secundários:</strong> Aparecem na lista "85% dos clientes levam junto..."</li>
                <li>• <strong>Desconto %:</strong> Aplica desconto sobre o preço original do produto</li>
                <li>• <strong>Preço Fixo:</strong> Se definido, ignora o desconto % e usa este valor</li>
                <li>• Sem bumps configurados → sistema usa sugestão inteligente automática</li>
              </ul>
            </div>
          </div>
        )}

        {/* Add Bump Modal */}
        <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Adicionar Bump</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Produto</label>
                <Select value={newBumpProductId} onValueChange={setNewBumpProductId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o produto..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProducts.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[9px]">
                            {getIconLabel(p.icon_type)}
                          </Badge>
                          {p.name} — R$ {p.price.toFixed(2).replace(".", ",")}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Tipo</label>
                <Select value={newBumpType} onValueChange={(v) => setNewBumpType(v as "main" | "secondary")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="main">Principal (destaque)</SelectItem>
                    <SelectItem value="secondary">Secundário (lista)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Percent className="size-3" /> Desconto %
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={newDiscountPercent}
                    onChange={(e) => setNewDiscountPercent(Number(e.target.value))}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                    <DollarSign className="size-3" /> Preço Fixo
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newFixedPrice}
                    onChange={(e) => setNewFixedPrice(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Label (opcional)</label>
                <Input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Ex: OPORTUNIDADE ÚNICA"
                />
              </div>

              <Button onClick={handleAdd} className="w-full">
                <Plus className="size-4 mr-1" />
                Adicionar Bump
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

function BumpCard({
  bump,
  onRemove,
  onToggleActive,
  onUpdateField,
  getIconColor,
  getIconLabel,
}: {
  bump: OrderBump;
  onRemove: (id: string) => void;
  onToggleActive: (bump: OrderBump) => void;
  onUpdateField: (id: string, field: string, value: any) => void;
  getIconColor: (t: string | null) => string;
  getIconLabel: (t: string | null) => string;
}) {
  const bumpProduct = bump.bump_product;
  const displayPrice = bump.fixed_price
    ? bump.fixed_price
    : bumpProduct
    ? bumpProduct.price * (1 - bump.discount_percent / 100)
    : 0;
  const originalPrice = bumpProduct?.price || 0;
  const hasDiscount = bump.fixed_price || bump.discount_percent > 0;

  return (
    <div
      className={`rounded-xl border p-3 flex items-start gap-3 transition-all ${
        bump.active
          ? "border-border bg-card"
          : "border-border/50 bg-muted/20 opacity-60"
      }`}
    >
      <div className="flex flex-col items-center gap-1 pt-1">
        <Switch
          checked={bump.active}
          onCheckedChange={() => onToggleActive(bump)}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className={`text-[9px] ${getIconColor(bumpProduct?.icon_type || null)}`}>
            {getIconLabel(bumpProduct?.icon_type || null)}
          </Badge>
          {bump.bump_type === "main" && (
            <Badge className="text-[9px] bg-amber-500/20 text-amber-400 border-amber-500/30">
              <Star className="size-2.5 mr-0.5" />
              Principal
            </Badge>
          )}
          <span className="text-xs font-bold text-foreground truncate">{bumpProduct?.name || "Produto removido"}</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          {hasDiscount ? (
            <>
              <span className="line-through">R$ {originalPrice.toFixed(2).replace(".", ",")}</span>
              <span className="text-primary font-bold">R$ {displayPrice.toFixed(2).replace(".", ",")}</span>
              {bump.discount_percent > 0 && !bump.fixed_price && (
                <span className="text-emerald-400 font-bold">-{bump.discount_percent}%</span>
              )}
            </>
          ) : (
            <span>R$ {originalPrice.toFixed(2).replace(".", ",")}</span>
          )}
        </div>
        {bump.label && (
          <span className="text-[10px] text-amber-400 font-semibold mt-1 block">{bump.label}</span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Select
          value={bump.bump_type}
          onValueChange={(v) => onUpdateField(bump.id, "bump_type", v)}
        >
          <SelectTrigger className="h-7 text-[10px] w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="main">Principal</SelectItem>
            <SelectItem value="secondary">Secundário</SelectItem>
          </SelectContent>
        </Select>
        <button
          onClick={() => onRemove(bump.id)}
          className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
