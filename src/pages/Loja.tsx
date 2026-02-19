import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";
interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  priceLabel: string;
  image: string;
  badge: { text: string; color: string; icon: string };
  stock: { status: string; statusColor: string; sold: string; percentage: number };
  available: boolean;
}

const products: Product[] = [
  {
    id: 1,
    name: "Proxy Residencial USA",
    description: "Alta velocidade e anonimato garantido.",
    price: 45.9,
    priceLabel: "por unidade",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuAMSqMkFMWm7q_5x82E3XACzHyq9898Go9Hug-9lMLd1sQVyiK58rk7OF3poyqvp7DBJJfNlOr-O2E37t0qXTmDcQWookAfKKjxE9D-5HN6lH1NrbcNrXQC7T2CfKjtOXOtLT6gYkTdr9m91V20LNOCyEep9xXZYTAupDK6zVw6KXIyBNgTjdRpJw2SGcxKmWhTAg1wWnY9KYRHIy8mIKjt6OsdH34WRlu8GLD2aX3EzI6eHHc_hCd-vNAOmuisFfwqCY0vSsEp8DA",
    badge: { text: "Mais popular", color: "bg-black/60 text-white border-white/10", icon: "local_fire_department" },
    stock: { status: "Em estoque", statusColor: "text-primary", sold: "234 vendidos hoje", percentage: 75 },
    available: true,
  },
  {
    id: 2,
    name: "Perfil Facebook Verificado",
    description: "Com identidade confirmada (2FA).",
    price: 120.0,
    priceLabel: "por unidade",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuD5eYHpual39JFzdVfIUveRKwEpvktDT2Wzqqma0ra3ujTEYArUee-k27oLLShRngjVdkjMvF9x49oLvq83jRy0VQqyuOv_gw4dDu4rDhQdFafPk4H9UL7g9mR7QobSkBKuVL9ce2mgX0XauOFV6ejkTqrCYsNWm2N8d5IDl7oxO8W5A0eWFxd3GbeE7rsftgwLE35jJWJx1HnnftEAy7cFD5_QM16nesA3Wl0fFa8TUlLiBNfHWeaZaQEOJM3TaDgf_TI1Jtmf-gk",
    badge: { text: "Acabando rápido", color: "bg-danger/20 text-danger border-danger/20", icon: "bolt" },
    stock: { status: "Últimas unidades", statusColor: "text-danger", sold: "8 restantes", percentage: 15 },
    available: true,
  },
  {
    id: 3,
    name: "BM Ilimitada (Business Manager)",
    description: "Pronta para escalar campanhas.",
    price: 89.9,
    priceLabel: "por unidade",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCp-U1UhcdViYGvkknFNIrYbhmDzIumsVmVzLpBjbCDQiFXZtBOGzl5z0p1CdhWQOTSCpzG_NRNJZJLWBn-eGkcHzMoAEUs3fcdPIXCuvVur22cnPQ_PTMBLk_PMKrKqg1a2ZYeAxVLdQhDMFdvZDSFF-eHmFzJVX2A46K6C9jBpq_vh2r-M5OMwQoq8Du_08hO7aXMgmTMIFzHlWS-LKa89F_jiyfxgwzxE1M4hrZ5bGCG2iVdQbEyT8Olf_WCFs_foLU40j9BUvM",
    badge: { text: "Novo Lote", color: "bg-blue-500/20 text-blue-300 border-blue-500/20", icon: "new_releases" },
    stock: { status: "Disponível", statusColor: "text-primary", sold: "45 vendidos hoje", percentage: 60 },
    available: true,
  },
  {
    id: 4,
    name: "Proxy 4G Brasil",
    description: "IP rotativo por requisição.",
    price: 150.0,
    priceLabel: "mensal",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCCa2hNG160-dnA_L73Yf0ci9TD2-LHfghTZppJ3xpt3VSAUsp6F5JxME5E9JPECXeP8zvRxfH1A9uCNRH4Bzg8nHtfXxGJUa4V2Op4VruhEBUVG2Jw_-1FDveBVGUk-ks7yiHCOq8wTHzPvdmtP_eW41Jyjb_UPvk2VPE6XIcAcwA0w3EQBLMA4DA84KIi5vHg6N2nsFkxnFNhwMcxkP6V3zTy17yJHMuVN36NFK3PFjKvprCJK8x_MpYQP_odvz8Lx0NawzichUY",
    badge: { text: "Alta Velocidade", color: "bg-purple-500/20 text-purple-300 border-purple-500/20", icon: "speed" },
    stock: { status: "Disponível", statusColor: "text-primary", sold: "12 vendidos hoje", percentage: 90 },
    available: true,
  },
  {
    id: 5,
    name: "Combo Contingência",
    description: "3 Perfis + 1 BM + 1 Proxy.",
    price: 299.0,
    priceLabel: "kit completo",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuAnFEZY5cpPq1l1BVqS6wl2I7NPfMkxaKu1dn7OJ0eXDk2r71Veo6By9kTYl-rwJRsIRAcb1_mI9qnu9R1DPBkTg0B_rB_7LBCJZkSFvEhSPKCtjYFHEHoC1X7IvZ7wzt2ALyJNhILMQhX5NJgqGCijeYISQl2nyBWNjk5bycU3tYxm3t9pdo3r7pIg2nw8NygCaBGjVzeZh5ped8_1lAH0_lKS_B1899KDKSRq9smLesywT0PEZ6DIRWIYyggz3HSanRb8ioMCogA",
    badge: { text: "Kit Iniciante", color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/20", icon: "star" },
    stock: { status: "Em estoque", statusColor: "text-primary", sold: "88 vendidos hoje", percentage: 50 },
    available: true,
  },
  {
    id: 6,
    name: "VPS High Performance",
    description: "Servidores dedicados para automação.",
    price: 0,
    priceLabel: "",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBP1k9GUEWnGsXtIp1PCAzOpWL4FQOnE11OE7R_LdXWio5rNf35CSbfjyz5CX3EpAvWv8q5ieDqgZI-8V7jY4rpGjBkjFsPe4vRsGYGj_h_BP9RLr-DiJaMyE2xr039-jDlBJCfzAy4ZVEzbvbfJ6LBoxLdbT84Rt6LBalxtI3g80YRMFq50ldR_ZBy1iFx7kI6jzFV-aEXK4lyAOX-Y0jZKV3tCGlGGHjtIT5_xL-bP28ilLosV61LF-tV6QRtvrWbG1l05IVjy44",
    badge: { text: "Em breve", color: "bg-white/10 text-white border-white/20", icon: "schedule" },
    stock: { status: "Sem estoque", statusColor: "text-text-secondary", sold: "Avise-me", percentage: 0 },
    available: false,
  },
];

const filters = ["Todos", "Proxy Residencial", "Perfis Facebook", "Business Managers", "Contingência"];

export default function Dashboard() {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [activeFilter, setActiveFilter] = useState("Todos");
  const [quantities, setQuantities] = useState<Record<number, number>>({});

  const getQuantity = (id: number) => quantities[id] || 1;

  const updateQuantity = (id: number, delta: number) => {
    setQuantities((prev) => ({
      ...prev,
      [id]: Math.max(1, (prev[id] || 1) + delta),
    }));
  };

  return (
    <div className="space-y-10 animate-fade-in">
      {/* Hero Section */}
      <section className="relative w-full rounded-2xl overflow-hidden glass-card shadow-glass group">
        {/* Decorative Background Glow */}
        <div className="absolute -right-20 -top-20 w-96 h-96 bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between p-8 md:p-12 gap-8">
          <div className="flex-1 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-primary/20 to-transparent border border-primary/20">
              <span className="animate-pulse w-2 h-2 rounded-full bg-primary" />
              <span className="text-xs font-bold text-primary uppercase tracking-wider">Promoção Limitada</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold leading-tight text-foreground">
              Recarregue acima de R$200 e <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-700">
                ganhe 15% de bônus
              </span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-xl">
              Aproveite nossa campanha de recarga para maximizar seu saldo e adquirir mais perfis e proxies com desconto exclusivo.
            </p>
            <div className="flex items-center gap-4 pt-2">
              <button className="btn-primary-glow bg-primary text-primary-foreground font-bold text-sm px-8 py-3.5 rounded-xl transition-all hover:-translate-y-1 flex items-center gap-2">
                Aproveitar agora
                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </button>
              <button className="bg-secondary hover:bg-secondary/80 text-foreground font-medium text-sm px-6 py-3.5 rounded-xl border border-border transition-all hover:border-border">
                Ver regulamento
              </button>
            </div>
          </div>
          <div className="flex-1 w-full max-w-md relative">
            <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D0D]/50 to-transparent z-10" />
            <div
              className="rounded-xl overflow-hidden shadow-2xl border border-white/10 aspect-video bg-cover bg-center"
              style={{
                backgroundImage:
                  "url('https://lh3.googleusercontent.com/aida-public/AB6AXuC5nn24ArvW43GzGEjp9Z41AJ6ltA2i2-VmQs8CHMkuo6-8hWz3ognn25PEibRPofOucMtC0MOkISQN6DPlpxA8U_iT2mz9ENwE1-zZbX8A3LDY8EhqtrcrioGGyWujTw6HOwqSAOXKVEMCiaKfAdzyChDMC6XyGSGRCGDgMNuTp2AK3KAu8plItjJxJZ0dLbGttf92tgqYfF8MapFxEjmR7NvOwm25vVAFVv8ZwqXroY4rH0GWmZggdkmDG-KpvWQfVqri9RXO2jw')",
              }}
            />
          </div>
        </div>
      </section>

      {/* Filters & Products */}
      <section className="space-y-6">
        {/* Filter Chips */}
        <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {filters.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`shrink-0 font-medium px-6 py-2.5 rounded-lg text-sm transition-all ${
                activeFilter === filter
                  ? "bg-primary text-primary-foreground font-bold shadow-glow"
                  : "glass-panel text-foreground hover:text-primary border border-border hover:border-primary/50"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <article
              key={product.id}
              className={`glass-card rounded-2xl overflow-hidden flex flex-col group h-full ${
                !product.available ? "opacity-70 hover:opacity-100" : ""
              }`}
            >
              {/* Image */}
              <div
                className={`relative h-48 w-full overflow-hidden ${
                  !product.available ? "grayscale group-hover:grayscale-0 transition-all duration-500" : ""
                }`}
              >
                <div
                  className={`absolute top-3 left-3 z-10 backdrop-blur-md text-xs font-bold px-3 py-1.5 rounded-full border flex items-center gap-1 ${product.badge.color}`}
                >
                  <span className="material-symbols-outlined text-[14px]">{product.badge.icon}</span>
                  {product.badge.text}
                </div>
                <div
                  className="w-full h-full bg-cover bg-center transform group-hover:scale-110 transition-transform duration-700"
                  style={{ backgroundImage: `url('${product.image}')` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F14] via-transparent to-transparent opacity-80" />
              </div>

              {/* Content */}
              <div className="p-5 flex flex-col flex-1 gap-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                      {product.name}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">{product.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-foreground">
                      {product.available ? `R$ ${product.price.toFixed(2).replace(".", ",")}` : "---"}
                    </p>
                    {product.priceLabel && (
                      <p className="text-[10px] text-muted-foreground">{product.priceLabel}</p>
                    )}
                  </div>
                </div>

                {/* Availability Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className={`${product.stock.statusColor} flex items-center gap-1`}>
                      {product.stock.percentage > 0 && (
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            product.stock.statusColor === "text-primary" ? "bg-primary" : "bg-danger"
                          } ${product.stock.statusColor === "text-primary" ? "animate-pulse" : ""}`}
                        />
                      )}
                      {product.stock.status}
                    </span>
                    <span className="text-muted-foreground">{product.stock.sold}</span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        product.stock.statusColor === "text-primary"
                          ? "bg-gradient-to-r from-green-400 to-green-600"
                          : product.stock.statusColor === "text-danger"
                          ? "bg-gradient-to-r from-danger to-orange-500"
                          : "bg-muted"
                      }`}
                      style={{ width: `${product.stock.percentage}%` }}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-auto pt-4 flex flex-col gap-3 border-t border-border">
                  {product.available ? (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        {/* Stepper */}
                        <div className="flex items-center bg-secondary rounded-lg border border-border h-10 px-1">
                          <button
                            onClick={() => updateQuantity(product.id, -1)}
                            className="w-8 h-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded transition"
                          >
                            <span className="material-symbols-outlined text-[16px]">remove</span>
                          </button>
                          <input
                            type="text"
                            readOnly
                            value={getQuantity(product.id)}
                            className="w-8 bg-transparent text-center text-sm font-medium border-0 focus:ring-0 text-foreground"
                          />
                          <button
                            onClick={() => updateQuantity(product.id, 1)}
                            className="w-8 h-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded transition"
                          >
                            <span className="material-symbols-outlined text-[16px]">add</span>
                          </button>
                        </div>
                        {/* Add to Cart */}
                        <button
                          onClick={() => {
                            addItem({
                              productId: product.id,
                              name: product.name,
                              price: product.price,
                              quantity: getQuantity(product.id),
                              image: product.image,
                            });
                            toast.success(`${product.name} adicionado ao carrinho!`);
                          }}
                          className="h-10 px-3 rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all flex items-center justify-center"
                          title="Adicionar ao carrinho"
                        >
                          <span className="material-symbols-outlined text-[20px]">shopping_cart</span>
                        </button>
                      </div>
                      {/* Buy Now */}
                      <button 
                        onClick={() => navigate(`/checkout?product=${product.id}&qty=${getQuantity(product.id)}`)}
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm h-10 rounded-lg transition-all flex items-center justify-center gap-2 shadow-[0_0_10px_rgba(220,38,38,0.2)]"
                      >
                        <span className="material-symbols-outlined text-[18px]">flash_on</span>
                        Comprar agora
                      </button>
                    </>
                  ) : (
                    <button className="w-full bg-secondary hover:bg-secondary/80 text-foreground font-bold text-sm h-10 rounded-lg border border-border transition-all flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-[18px]">notifications_active</span>
                      Avise-me quando chegar
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
