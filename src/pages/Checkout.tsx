import { useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Wallet, QrCode, CreditCard, Lock, ChevronLeft, User, Calendar, Flame } from "lucide-react";

// Product types
interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  image: string;
  category: "perfil" | "bm" | "proxy" | "pagina" | "combo" | "vps";
}

interface OrderBump {
  id: string;
  name: string;
  description: string;
  price: number;
  category: "bm" | "proxy" | "pagina";
}

// Products data (same as Loja)
const productsData: Product[] = [
  { id: 1, name: "Proxy Residencial USA", description: "Alta velocidade e anonimato garantido.", price: 45.9, image: "https://lh3.googleusercontent.com/aida-public/AB6AXuAMSqMkFMWm7q_5x82E3XACzHyq9898Go9Hug-9lMLd1sQVyiK58rk7OF3poyqvp7DBJJfNlOr-O2E37t0qXTmDcQWookAfKKjxE9D-5HN6lH1NrbcNrXQC7T2CfKjtOXOtLT6gYkTdr9m91V20LNOCyEep9xXZYTAupDK6zVw6KXIyBNgTjdRpJw2SGcxKmWhTAg1wWnY9KYRHIy8mIKjt6OsdH34WRlu8GLD2aX3EzI6eHHc_hCd-vNAOmuisFfwqCY0vSsEp8DA", category: "proxy" },
  { id: 2, name: "Perfil Facebook Verificado", description: "Com identidade confirmada (2FA).", price: 120.0, image: "https://lh3.googleusercontent.com/aida-public/AB6AXuD5eYHpual39JFzdVfIUveRKwEpvktDT2Wzqqma0ra3ujTEYArUee-k27oLLShRngjVdkjMvF9x49oLvq83jRy0VQqyuOv_gw4dDu4rDhQdFafPk4H9UL7g9mR7QobSkBKuVL9ce2mgX0XauOFV6ejkTqrCYsNWm2N8d5IDl7oxO8W5A0eWFxd3GbeE7rsftgwLE35jJWJx1HnnftEAy7cFD5_QM16nesA3Wl0fFa8TUlLiBNfHWeaZaQEOJM3TaDgf_TI1Jtmf-gk", category: "perfil" },
  { id: 3, name: "BM Ilimitada (Business Manager)", description: "Pronta para escalar campanhas.", price: 89.9, image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCp-U1UhcdViYGvkknFNIrYbhmDzIumsVmVzLpBjbCDQiFXZtBOGzl5z0p1CdhWQOTSCpzG_NRNJZJLWBn-eGkcHzMoAEUs3fcdPIXCuvVur22cnPQ_PTMBLk_PMKrKqg1a2ZYeAxVLdQhDMFdvZDSFF-eHmFzJVX2A46K6C9jBpq_vh2r-M5OMwQoq8Du_08hO7aXMgmTMIFzHlWS-LKa89F_jiyfxgwzxE1M4hrZ5bGCG2iVdQbEyT8Olf_WCFs_foLU40j9BUvM", category: "bm" },
  { id: 4, name: "Proxy 4G Brasil", description: "IP rotativo por requisição.", price: 150.0, image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCCa2hNG160-dnA_L73Yf0ci9TD2-LHfghTZppJ3xpt3VSAUsp6F5JxME5E9JPECXeP8zvRxfH1A9uCNRH4Bzg8nHtfXxGJUa4V2Op4VruhEBUVG2Jw_-1FDveBVGUk-ks7yiHCOq8wTHzPvdmtP_eW41Jyjb_UPvk2VPE6XIcAcwA0w3EQBLMA4DA84KIi5vHg6N2nsFkxnFNhwMcxkP6V3zTy17yJHMuVN36NFK3PFjKvprCJK8x_MpYQP_odvz8Lx0NawzichUY", category: "proxy" },
  { id: 5, name: "Combo Contingência", description: "3 Perfis + 1 BM + 1 Proxy.", price: 299.0, image: "https://lh3.googleusercontent.com/aida-public/AB6AXuAnFEZY5cpPq1l1BVqS6wl2I7NPfMkxaKu1dn7OJ0eXDk2r71Veo6By9kTYl-rwJRsIRAcb1_mI9qnu9R1DPBkTg0B_rB_7LBCJZkSFvEhSPKCtjYFHEHoC1X7IvZ7wzt2ALyJNhILMQhX5NJgqGCijeYISQl2nyBWNjk5bycU3tYxm3t9pdo3r7pIg2nw8NygCaBGjVzeZh5ped8_1lAH0_lKS_B1899KDKSRq9smLesywT0PEZ6DIRWIYyggz3HSanRb8ioMCogA", category: "combo" },
  { id: 6, name: "VPS High Performance", description: "Servidores dedicados para automação.", price: 0, image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBP1k9GUEWnGsXtIp1PCAzOpWL4FQOnE11OE7R_LdXWio5rNf35CSbfjyz5CX3EpAvWv8q5ieDqgZI-8V7jY4rpGjBkjFsPe4vRsGYGj_h_BP9RLr-DiJaMyE2xr039-jDlBJCfzAy4ZVEzbvbfJ6LBoxLdbT84Rt6LBalxtI3g80YRMFq50ldR_ZBy1iFx7kI6jzFV-aEXK4lyAOX-Y0jZKV3tCGlGGHjtIT5_xL-bP28ilLosV61LF-tV6QRtvrWbG1l05IVjy44", category: "vps" },
];

// Order bumps available
const availableOrderBumps: OrderBump[] = [
  { id: "bm", name: "Adicionar BM Verificada", description: "Conta de anúncios pronta para escalar sem bloqueios imediatos.", price: 50.0, category: "bm" },
  { id: "proxy", name: "Proxy Residencial 4G", description: "Navegue com IP limpo e evite checkpoint na conta.", price: 30.0, category: "proxy" },
  { id: "pagina", name: "Página de Anúncios Ativa", description: "Fanpage pronta para veicular campanhas imediatamente.", price: 40.0, category: "pagina" },
];

// Upsell offer (combo)
const upsellOffer = {
  title: "Complete sua compra!",
  description: "Leve BM + Proxy com 20% de desconto!",
  originalPrice: 100.0,
  discountedPrice: 80.0,
  items: ["bm", "proxy"],
};

export default function Checkout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const productId = parseInt(searchParams.get("product") || "2");
  const quantity = parseInt(searchParams.get("qty") || "1");
  
  const product = productsData.find((p) => p.id === productId) || productsData[1];

  const [paymentMethod, setPaymentMethod] = useState<"saldo" | "pix" | "cartao">("saldo");
  const [selectedBumps, setSelectedBumps] = useState<string[]>([]);
  const [upsellAdded, setUpsellAdded] = useState(false);
  const [coupon, setCoupon] = useState("");
  const [discount, setDiscount] = useState(0);

  // Card form states
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");

  // Determine which order bumps to show based on what the product is missing
  const relevantBumps = useMemo(() => {
    const productCategory = product.category;
    const bumps: OrderBump[] = [];

    // If buying just a profile, offer BM, Proxy, and Page
    if (productCategory === "perfil") {
      bumps.push(...availableOrderBumps);
    }
    // If buying just a BM, offer Proxy and Page
    else if (productCategory === "bm") {
      bumps.push(...availableOrderBumps.filter((b) => b.category !== "bm"));
    }
    // If buying just a Proxy, offer BM and Page
    else if (productCategory === "proxy") {
      bumps.push(...availableOrderBumps.filter((b) => b.category !== "proxy"));
    }
    // Combo already has everything, no bumps
    else if (productCategory === "combo") {
      return [];
    }

    return bumps;
  }, [product.category]);

  // Show upsell only if customer is buying a profile and hasn't already added both BM and Proxy
  const showUpsell = useMemo(() => {
    if (product.category !== "perfil") return false;
    const hasBothItems = selectedBumps.includes("bm") && selectedBumps.includes("proxy");
    return !hasBothItems && !upsellAdded;
  }, [product.category, selectedBumps, upsellAdded]);

  const toggleBump = (bumpId: string) => {
    setSelectedBumps((prev) =>
      prev.includes(bumpId) ? prev.filter((id) => id !== bumpId) : [...prev, bumpId]
    );
  };

  const handleAddUpsell = () => {
    setUpsellAdded(true);
    // Remove individual bumps if any were selected
    setSelectedBumps((prev) => prev.filter((id) => !upsellOffer.items.includes(id)));
  };

  const applyCoupon = () => {
    if (coupon.toLowerCase() === "desconto10") {
      setDiscount(10);
    } else {
      setDiscount(0);
    }
  };

  // Calculate totals
  const subtotal = useMemo(() => {
    let total = product.price * quantity;

    // Add individual bumps (only if upsell not added)
    if (!upsellAdded) {
      selectedBumps.forEach((bumpId) => {
        const bump = availableOrderBumps.find((b) => b.id === bumpId);
        if (bump) total += bump.price;
      });
    } else {
      // Add upsell price
      total += upsellOffer.discountedPrice;
    }

    return total;
  }, [product.price, quantity, selectedBumps, upsellAdded]);

  const total = subtotal - discount;

  return (
    <div className="min-h-screen animate-fade-in pb-20">
      {/* Background decorations */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-primary/5 rounded-full blur-[100px]" />
      </div>

      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ChevronLeft className="w-5 h-5" />
        <span>Voltar à loja</span>
      </button>

      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column - Payment & Order Bumps */}
        <div className="lg:col-span-8 flex flex-col gap-6 order-2 lg:order-1">
          {/* Payment Section */}
          <section className="glass-panel rounded-2xl p-6 md:p-8 flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
                <CreditCard className="w-5 h-5 text-primary" />
                Pagamento
              </h2>
              <p className="text-sm text-muted-foreground">Selecione como você deseja pagar.</p>
            </div>

            {/* Payment Methods */}
            <div className="grid grid-cols-3 gap-3">
              <label className="cursor-pointer group">
                <input
                  type="radio"
                  name="payment_method"
                  checked={paymentMethod === "saldo"}
                  onChange={() => setPaymentMethod("saldo")}
                  className="peer sr-only"
                />
                <div className="h-full flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-transparent p-4 text-center transition-all peer-checked:border-primary peer-checked:bg-primary/20 peer-checked:shadow-glow hover:bg-muted/50 hover:border-border">
                  <Wallet className="w-8 h-8 text-muted-foreground peer-checked:text-primary" />
                  <span className="font-medium text-sm text-foreground">Saldo</span>
                </div>
              </label>
              <label className="cursor-pointer group">
                <input
                  type="radio"
                  name="payment_method"
                  checked={paymentMethod === "pix"}
                  onChange={() => setPaymentMethod("pix")}
                  className="peer sr-only"
                />
                <div className="h-full flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-transparent p-4 text-center transition-all peer-checked:border-primary peer-checked:bg-primary/20 peer-checked:shadow-glow hover:bg-muted/50 hover:border-border">
                  <QrCode className="w-8 h-8 text-muted-foreground" />
                  <span className="font-medium text-sm text-foreground">Pix</span>
                </div>
              </label>
              <label className="cursor-pointer group">
                <input
                  type="radio"
                  name="payment_method"
                  checked={paymentMethod === "cartao"}
                  onChange={() => setPaymentMethod("cartao")}
                  className="peer sr-only"
                />
                <div className="h-full flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-transparent p-4 text-center transition-all peer-checked:border-primary peer-checked:bg-primary/20 peer-checked:shadow-glow hover:bg-muted/50 hover:border-border">
                  <CreditCard className="w-8 h-8 text-muted-foreground" />
                  <span className="font-medium text-sm text-foreground">Cartão</span>
                </div>
              </label>
            </div>

            {/* Card Form (show only when card is selected) */}
            {paymentMethod === "cartao" && (
              <div className="mt-2 pt-6 border-t border-border">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="col-span-1 md:col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Número do Cartão
                    </label>
                    <div className="relative">
                      <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <input
                        type="text"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        placeholder="0000 0000 0000 0000"
                        className="glass-input w-full rounded-xl py-3 pl-11 pr-4 text-foreground placeholder-muted-foreground outline-none focus:ring-1 focus:ring-primary bg-black/30 border border-border"
                      />
                    </div>
                  </div>
                  <div className="col-span-1 md:col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Nome no Cartão
                    </label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <input
                        type="text"
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value)}
                        placeholder="Como impresso no cartão"
                        className="glass-input w-full rounded-xl py-3 pl-11 pr-4 text-foreground placeholder-muted-foreground outline-none focus:ring-1 focus:ring-primary bg-black/30 border border-border"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Validade
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <input
                        type="text"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        placeholder="MM/AA"
                        className="glass-input w-full rounded-xl py-3 pl-11 pr-4 text-foreground placeholder-muted-foreground outline-none focus:ring-1 focus:ring-primary bg-black/30 border border-border"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      CVV
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <input
                        type="text"
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                        placeholder="123"
                        className="glass-input w-full rounded-xl py-3 pl-11 pr-4 text-foreground placeholder-muted-foreground outline-none focus:ring-1 focus:ring-primary bg-black/30 border border-border"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Order Bumps Section */}
          {relevantBumps.length > 0 && !upsellAdded && (
            <section className="glass-panel rounded-2xl p-6 md:p-8 flex flex-col gap-6 relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
              <div className="flex flex-col gap-1 z-10">
                <h2 className="text-lg font-bold flex items-center gap-2 text-foreground">
                  <Flame className="w-5 h-5 text-yellow-500" />
                  85% dos clientes levam junto...
                </h2>
                <p className="text-sm text-muted-foreground">Ofertas exclusivas apenas nesta página.</p>
              </div>
              <div className="space-y-3 z-10">
                {relevantBumps.map((bump) => (
                  <label
                    key={bump.id}
                    className={`flex items-start gap-4 p-4 rounded-xl border border-dashed cursor-pointer transition-colors ${
                      selectedBumps.includes(bump.id)
                        ? "border-primary/50 bg-primary/10"
                        : "border-border bg-black/20 hover:bg-muted/20"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedBumps.includes(bump.id)}
                      onChange={() => toggleBump(bump.id)}
                      className="mt-1 h-5 w-5 rounded border-2 border-border bg-transparent text-primary checked:border-primary focus:ring-0 focus:ring-offset-0"
                    />
                    <div className="flex flex-col gap-1 flex-1">
                      <div className="flex justify-between items-center w-full">
                        <p className="font-bold text-foreground text-sm">{bump.name}</p>
                        <span className="text-primary font-bold text-sm">+ R$ {bump.price.toFixed(2).replace(".", ",")}</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{bump.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right Column - Upsell & Order Summary */}
        <div className="lg:col-span-4 relative order-1 lg:order-2">
          <div className="sticky top-8 flex flex-col gap-4">
            {/* Upsell Card - Order Bump Destacado */}
            {showUpsell && (
              <div className="rounded-2xl p-5 relative overflow-hidden border-2 border-primary/60 bg-gradient-to-b from-[#1a0a0a] via-surface to-surface shadow-[0_0_30px_rgba(220,38,38,0.15)]">
                {/* Glow effect no topo */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-20 bg-primary/20 blur-3xl pointer-events-none" />
                
                <div className="relative z-10 flex flex-col gap-3">
                  {/* Badge */}
                  <div className="bg-green-500 text-white text-[10px] font-bold px-3 py-1 rounded-full w-fit flex items-center gap-1.5 shadow-lg">
                    <Flame className="w-3 h-3" />
                    OPORTUNIDADE ÚNICA
                  </div>
                  
                  {/* Título e descrição */}
                  <div className="mt-1">
                    <h3 className="text-lg font-bold text-foreground leading-tight">{upsellOffer.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Leve <span className="text-foreground font-semibold">BM + Proxy</span> com{" "}
                      <span className="text-primary font-semibold">20% de desconto!</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1.5">Melhore seus resultados agora.</p>
                  </div>
                  
                  {/* Área de preço e botão */}
                  <div className="bg-black/40 backdrop-blur-sm rounded-lg p-3 border border-border/50 flex items-center justify-between gap-4 mt-2">
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground line-through">
                        De R$ {upsellOffer.originalPrice.toFixed(2).replace(".", ",")}
                      </span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xs text-muted-foreground">Por R$</span>
                        <span className="text-2xl font-black text-foreground">
                          {upsellOffer.discountedPrice.toFixed(2).replace(".", ",")}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={handleAddUpsell}
                      className="bg-foreground text-background hover:bg-muted-foreground font-bold text-xs py-2.5 px-4 rounded-lg whitespace-nowrap transition-colors shadow-lg"
                    >
                      Adicionar e Economizar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Order Summary */}
            <div className="glass-panel rounded-2xl p-6 flex flex-col gap-6">
              <h3 className="text-lg font-bold text-foreground">Resumo do Pedido</h3>
              
              {/* Main Product */}
              <div className="flex flex-col gap-4">
                <div className="flex gap-4 items-start">
                  <div
                    className="w-16 h-16 rounded-lg bg-surface border border-border flex items-center justify-center shrink-0 bg-cover bg-center"
                    style={{ backgroundImage: `url('${product.image}')` }}
                  />
                  <div className="flex flex-col gap-1 flex-1">
                    <p className="text-sm font-semibold text-foreground leading-tight">
                      {product.name} {quantity > 1 && `(x${quantity})`}
                    </p>
                    <p className="text-xs text-muted-foreground">Entrega Automática</p>
                    <p className="text-sm font-medium text-muted-foreground">
                      R$ {(product.price * quantity).toFixed(2).replace(".", ",")}
                    </p>
                  </div>
                </div>

                {/* Added Bumps */}
                {!upsellAdded &&
                  selectedBumps.map((bumpId) => {
                    const bump = availableOrderBumps.find((b) => b.id === bumpId);
                    if (!bump) return null;
                    return (
                      <div key={bumpId} className="flex gap-4 items-start border-t border-border pt-3">
                        <div className="w-16 h-16 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                          <Flame className="w-6 h-6 text-primary/50" />
                        </div>
                        <div className="flex flex-col gap-1 flex-1">
                          <p className="text-sm font-semibold text-foreground leading-tight">{bump.name}</p>
                          <p className="text-xs text-muted-foreground">Order Bump</p>
                          <p className="text-sm font-medium text-muted-foreground">
                            R$ {bump.price.toFixed(2).replace(".", ",")}
                          </p>
                        </div>
                      </div>
                    );
                  })}

                {/* Upsell Added */}
                {upsellAdded && (
                  <div className="flex gap-4 items-start border-t border-border pt-3">
                    <div className="w-16 h-16 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
                      <Flame className="w-6 h-6 text-green-500/50" />
                    </div>
                    <div className="flex flex-col gap-1 flex-1">
                      <p className="text-sm font-semibold text-foreground leading-tight">BM + Proxy (Combo)</p>
                      <p className="text-xs text-green-400">20% de desconto aplicado</p>
                      <p className="text-sm font-medium text-muted-foreground">
                        R$ {upsellOffer.discountedPrice.toFixed(2).replace(".", ",")}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Coupon */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value)}
                  placeholder="Cupom de desconto"
                  className="glass-input flex-1 rounded-lg py-2 px-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:ring-1 focus:ring-primary bg-black/30 border border-border"
                />
                <button
                  onClick={applyCoupon}
                  className="bg-muted hover:bg-muted/80 text-foreground text-xs font-bold rounded-lg px-3 transition-colors"
                >
                  APLICAR
                </button>
              </div>

              <div className="h-px w-full bg-border" />

              {/* Totals */}
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>R$ {subtotal.toFixed(2).replace(".", ",")}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Descontos</span>
                  <span>- R$ {discount.toFixed(2).replace(".", ",")}</span>
                </div>
                <div className="flex justify-between items-center pt-2 mt-2 border-t border-border">
                  <span className="font-bold text-foreground text-lg">Total</span>
                  <div className="flex flex-col items-end">
                    <span className="font-black text-2xl text-foreground tracking-tight">
                      R$ {total.toFixed(2).replace(".", ",")}
                    </span>
                    <span className="text-[10px] text-muted-foreground">em até 12x no cartão</span>
                  </div>
                </div>
              </div>

              {/* Pay Button */}
              <button className="w-full bg-primary hover:bg-primary/90 shadow-glow text-primary-foreground font-bold text-base py-4 rounded-xl flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] active:scale-[0.98]">
                <Lock className="w-5 h-5" />
                PAGAR AGORA
              </button>

              {/* Payment Icons */}
              <div className="flex justify-center gap-4 opacity-50 grayscale hover:grayscale-0 transition-all duration-300">
                <CreditCard className="w-6 h-6" />
                <Wallet className="w-6 h-6" />
                <QrCode className="w-6 h-6" />
              </div>
            </div>

            {/* Footer Links */}
            <div className="flex justify-center gap-4 text-xs text-muted-foreground">
              <a className="hover:text-foreground transition-colors" href="#">
                Termos de Uso
              </a>
              <span>•</span>
              <a className="hover:text-foreground transition-colors" href="#">
                Política de Privacidade
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
