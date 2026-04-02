import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Search, ShieldCheck, Tag, CreditCard, Star, HeartHandshake, ShoppingBag, CheckCircle2, Globe, MessageSquare, Share2, ArrowRight } from "lucide-react";
import heroBanner from "@/assets/socialsafe/hero-banner.jpg";
import nicheLifestyle from "@/assets/socialsafe/niche-lifestyle.jpg";
import nicheTech from "@/assets/socialsafe/niche-tech.jpg";
import nicheFitness from "@/assets/socialsafe/niche-fitness.jpg";
import nicheEntertainment from "@/assets/socialsafe/niche-entertainment.jpg";

const MOCK_ACCOUNTS = [
  { id: "1", initials: "LS", name: "@lifesty***", niche: "Beleza & Estilo", followers: "124k", engagement: "4.8%", price: "R$ 4.200", color: "text-[#00dce5]" },
  { id: "2", initials: "DEV", name: "@codema***", niche: "Tecnologia", followers: "45k", engagement: "12.2%", price: "R$ 1.850", color: "text-[#c9bfff]" },
  { id: "3", initials: "FT", name: "@fitnes***", niche: "Saúde & Bem-estar", followers: "210k", engagement: "3.1%", price: "R$ 8.900", color: "text-[#2ae500]" },
  { id: "4", initials: "TR", name: "@travel***", niche: "Viagens & Explorar", followers: "88k", engagement: "5.5%", price: "R$ 3.500", color: "text-[#00dce5]" },
];

const NICHES = [
  { name: "Lifestyle & Luxo", img: nicheLifestyle },
  { name: "Tecnologia", img: nicheTech },
  { name: "Fitness", img: nicheFitness },
  { name: "Entretenimento", img: nicheEntertainment },
];

interface Listing {
  id: string;
  title: string;
  platform: string;
  price: number;
  followers: number;
  engagement_rate: number | null;
  niche: string | null;
  is_verified: boolean;
  screenshots: string[];
}

export default function SocialSafeHome() {
  const navigate = useNavigate();
  const [listings, setListings] = useState<Listing[]>([]);
  const [search, setSearch] = useState("");
  const [activePlatform, setActivePlatform] = useState("Instagram");

  useEffect(() => {
    fetchListings();
  }, []);

  async function fetchListings() {
    const { data } = await supabase
      .from("ss_listings")
      .select("*")
      .eq("status", "published")
      .order("featured", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(8);
    setListings((data as any[]) || []);
  }

  function formatFollowers(n: number) {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
    return String(n);
  }

  const platforms = ["Instagram", "YouTube", "Facebook", "TikTok"];

  return (
    <div className="min-h-screen bg-[#000000] text-[#dae2fd] overflow-x-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* ===== HEADER ===== */}
      <header className="fixed top-0 w-full z-50 bg-black/60 backdrop-blur-xl shadow-2xl shadow-black/40">
        <div className="flex justify-between items-center w-full px-6 h-16 max-w-[1920px] mx-auto">
          <button onClick={() => navigate("/socialsafe")} className="text-2xl font-black tracking-tighter text-[#00dce5]" style={{ fontFamily: "'Manrope', sans-serif" }}>
            Social Safe
          </button>

          <div className="hidden md:flex flex-1 max-w-xl mx-8">
            <div className="relative w-full">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-[#1a1a1a] border-none rounded-lg py-2 px-4 text-sm focus:ring-2 focus:ring-[#00dce5]/20 text-[#cbc3d9] placeholder-[#948da2]"
                placeholder="Buscar contas de Instagram, YouTube..."
                type="text"
              />
              <button className="absolute right-3 top-1/2 -translate-y-1/2 text-[#00dce5]">
                <Search className="w-5 h-5" />
              </button>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-6 tracking-wide text-sm font-medium" style={{ fontFamily: "'Manrope', sans-serif" }}>
            {platforms.map(p => (
              <button
                key={p}
                onClick={() => setActivePlatform(p)}
                className={`transition-colors ${activePlatform === p ? "text-[#00dce5] border-b-2 border-[#00dce5] pb-1" : "text-slate-400 hover:text-slate-100"}`}
              >
                {p}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-4 ml-6">
            <button
              onClick={() => navigate("/socialsafe/criar-anuncio")}
              className="hidden sm:block bg-[#00dce5] px-4 py-1.5 rounded-lg text-[#003739] font-bold text-sm active:scale-95 duration-150"
            >
              Vender
            </button>
            <button
              onClick={() => navigate("/socialsafe/minha-conta")}
              className="w-8 h-8 rounded-full overflow-hidden border border-[#00dce5]/20 bg-[#1a1a1a] flex items-center justify-center text-xs font-bold text-[#00dce5]"
            >
              SS
            </button>
          </div>
        </div>
      </header>

      <main className="pt-16">
        {/* ===== HERO BANNER ===== */}
        <section className="relative w-full h-[480px] overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-black via-transparent to-transparent z-10" />
          <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent z-10" />
          <img src={heroBanner} alt="Social Safe Hero" className="w-full h-full object-cover" width={1920} height={1080} />
          <div className="absolute inset-0 z-20 flex flex-col justify-center px-6 lg:px-20 max-w-[1920px] mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#4720ca] text-[#baaeff] rounded-full text-xs font-bold w-fit mb-6 uppercase tracking-widest">
              <ShieldCheck className="w-3.5 h-3.5" />
              Oportunidade Premium
            </div>
            <h1 className="text-5xl lg:text-7xl font-black tracking-tighter max-w-2xl leading-[0.95]" style={{ fontFamily: "'Manrope', sans-serif" }}>
              ELEVE SEU <span className="text-[#00dce5]">ALCANCE</span> HOJE.
            </h1>
            <p className="mt-6 text-lg text-[#cbc3d9] max-w-lg leading-relaxed">
              Contas verificadas do Instagram e canais monetizados do YouTube com garantia de transferência Social Safe.
            </p>
            <div className="mt-10 flex gap-4">
              <button className="bg-gradient-to-r from-[#00dce5] to-[#005d62] text-[#003739] font-bold px-8 py-4 rounded-xl text-lg shadow-lg shadow-[#00dce5]/20 hover:scale-105 transition-transform">
                Ver Ofertas
              </button>
              <button className="bg-white/5 backdrop-blur-md border border-white/10 font-bold px-8 py-4 rounded-xl text-lg hover:bg-white/10 transition-all">
                Como Funciona
              </button>
            </div>
          </div>
        </section>

        {/* ===== QUICK LINKS ===== */}
        <section className="max-w-[1200px] mx-auto -mt-16 relative z-30 px-6">
          <div className="bg-[#131b2e] rounded-2xl p-6 shadow-2xl grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { icon: <ShieldCheck className="w-6 h-6 text-[#00dce5]" />, label: "Contas Verificadas", bg: "bg-[#00dce5]/10" },
              { icon: <Tag className="w-6 h-6 text-[#2ae500]" />, label: "Venda sua Conta", bg: "bg-[#2ae500]/10" },
              { icon: <CreditCard className="w-6 h-6 text-[#c9bfff]" />, label: "Meios Seguros", bg: "bg-[#c9bfff]/10" },
              { icon: <Star className="w-6 h-6 text-[#00dce5]" />, label: "Melhores do Mês", bg: "bg-[#00dce5]/10" },
              { icon: <HeartHandshake className="w-6 h-6 text-[#2ae500]" />, label: "Garantia Social Safe", bg: "bg-[#2ae500]/10", hideOnMobile: true },
            ].map((item, i) => (
              <div
                key={i}
                className={`flex flex-col items-center text-center p-4 rounded-xl hover:bg-white/5 cursor-pointer transition-all group ${item.hideOnMobile ? "hidden md:flex" : ""}`}
              >
                <div className={`w-12 h-12 ${item.bg} rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                  {item.icon}
                </div>
                <span className="text-xs font-semibold leading-tight">{item.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ===== NICHOS EM ALTA ===== */}
        <section className="max-w-[1200px] mx-auto py-24 px-6">
          <div className="flex items-end justify-between mb-12">
            <div>
              <h2 className="text-3xl font-black tracking-tighter" style={{ fontFamily: "'Manrope', sans-serif" }}>
                NICHOS <span className="text-[#00dce5]">EM ALTA</span>
              </h2>
              <p className="text-[#cbc3d9]">Explore audiências prontas para converter</p>
            </div>
            <button className="text-[#00dce5] font-bold flex items-center gap-2 hover:underline">
              Ver tudo <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {NICHES.map(niche => (
              <div key={niche.name} className="relative group overflow-hidden rounded-2xl aspect-square cursor-pointer">
                <img
                  src={niche.img}
                  alt={niche.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  loading="lazy"
                  width={800}
                  height={800}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-6">
                  <h3 className="text-xl font-bold" style={{ fontFamily: "'Manrope', sans-serif" }}>{niche.name}</h3>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ===== MAIS VENDIDOS ===== */}
        <section className="bg-black py-24 px-6">
          <div className="max-w-[1200px] mx-auto">
            <div className="mb-12">
              <h2 className="text-3xl font-black tracking-tighter" style={{ fontFamily: "'Manrope', sans-serif" }}>
                MAIS <span className="text-[#2ae500]">VENDIDOS</span>
              </h2>
              <p className="text-[#cbc3d9]">As contas com maior taxa de engajamento da semana</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {/* Show real listings if available, otherwise mock data */}
              {(listings.length > 0 ? listings.slice(0, 4) : []).map(listing => (
                <div
                  key={listing.id}
                  onClick={() => navigate(`/socialsafe/anuncio/${listing.id}`)}
                  className="bg-[#0d0d0d] rounded-2xl overflow-hidden hover:shadow-[0_0_40px_rgba(0,220,229,0.15)] transition-all group border border-[#494456]/10 cursor-pointer"
                >
                  <div className="relative h-48">
                    {listing.screenshots?.[0] ? (
                      <img src={listing.screenshots[0]} alt={listing.title} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full bg-[#171f33] flex items-center justify-center text-4xl">📸</div>
                    )}
                    {listing.is_verified && (
                      <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md p-1.5 rounded-lg">
                        <ShieldCheck className="w-4 h-4 text-[#00dce5]" />
                      </div>
                    )}
                  </div>
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-[#1a1a1a] flex items-center justify-center font-bold text-[#00dce5] text-xs">
                        {listing.title.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm">{listing.title}</h4>
                        <p className="text-xs text-[#cbc3d9]">{listing.niche || listing.platform}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-[#948da2]">Seguidores</p>
                        <p className="font-black">{formatFollowers(listing.followers)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-[#948da2]">Engajamento</p>
                        <p className="font-black text-[#2ae500]">{listing.engagement_rate?.toFixed(1) || "0"}%</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-[#494456]/10">
                      <p className="text-2xl font-black">R$ {listing.price.toLocaleString("pt-BR")}</p>
                      <div className="w-10 h-10 bg-[#00dce5] text-[#003739] rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                        <ShoppingBag className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Mock cards when no real listings */}
              {listings.length === 0 && MOCK_ACCOUNTS.map(acc => (
                <div
                  key={acc.id}
                  className="bg-[#0d0d0d] rounded-2xl overflow-hidden hover:shadow-[0_0_40px_rgba(0,220,229,0.15)] transition-all group border border-[#494456]/10 cursor-pointer"
                >
                  <div className="relative h-48 bg-[#171f33] flex items-center justify-center">
                    <span className="text-5xl opacity-30">📸</span>
                    <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md p-1.5 rounded-lg">
                      <ShieldCheck className="w-4 h-4 text-[#00dce5]" />
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-10 h-10 rounded-full bg-[#1a1a1a] flex items-center justify-center font-bold ${acc.color} text-xs`}>
                        {acc.initials}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm">{acc.name}</h4>
                        <p className="text-xs text-[#cbc3d9]">{acc.niche}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-[#948da2]">Seguidores</p>
                        <p className="font-black">{acc.followers}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-[#948da2]">Engajamento</p>
                        <p className="font-black text-[#2ae500]">{acc.engagement}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-[#494456]/10">
                      <p className="text-2xl font-black">{acc.price}</p>
                      <div className="w-10 h-10 bg-[#00dce5] text-[#003739] rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                        <ShoppingBag className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== ESCROW SECTION ===== */}
        <section className="max-w-[1200px] mx-auto py-24 px-6">
          <div className="bg-gradient-to-br from-[#171f33] to-[#131b2e] rounded-[2.5rem] p-8 lg:p-16 relative overflow-hidden">
            <div className="absolute -right-20 -top-20 w-96 h-96 bg-[#00dce5]/10 blur-[120px] rounded-full" />
            <div className="absolute -left-20 -bottom-20 w-96 h-96 bg-[#c9bfff]/10 blur-[120px] rounded-full" />
            <div className="flex flex-col lg:flex-row items-center gap-12 relative z-10">
              <div className="flex-1 text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#00dce5]/10 text-[#00dce5] rounded-full text-sm font-bold mb-6">
                  <ShieldCheck className="w-4 h-4" />
                  SEGURANÇA EM PRIMEIRO LUGAR
                </div>
                <h2 className="text-4xl lg:text-5xl font-black tracking-tighter mb-6 leading-tight" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  Transações Protegidas por <span className="text-[#00dce5]">Escrow</span>
                </h2>
                <p className="text-[#cbc3d9] text-lg mb-8 leading-relaxed max-w-xl">
                  Seu dinheiro só é liberado ao vendedor após você confirmar a posse total da conta. Sem fraudes, sem riscos. O Social Safe atua como o mediador confiável da sua negociação.
                </p>
                <div className="flex flex-wrap justify-center lg:justify-start gap-8">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-[#2ae500]" />
                    <span className="font-bold">Verificação de CPF/CNPJ</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-[#2ae500]" />
                    <span className="font-bold">Análise de Procedência</span>
                  </div>
                </div>
              </div>
              <div className="flex-shrink-0">
                <div className="relative">
                  <div className="w-64 h-64 bg-[#222a3d] rounded-full flex items-center justify-center border-4 border-[#00dce5]/20 shadow-[0_0_80px_rgba(0,220,229,0.2)]">
                    <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="#00dce5" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><rect x="9" y="10" width="6" height="6" rx="1"/><path d="M12 10v-2a2 2 0 0 1 4 0"/></svg>
                  </div>
                  <div className="absolute -bottom-4 -right-4 bg-[#2ae500] text-[#053900] px-6 py-3 rounded-2xl font-black text-sm shadow-xl" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    ESCROW PROTECTED
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ===== FOOTER ===== */}
      <footer className="bg-black border-t border-[#494456]/10 pt-20 pb-10">
        <div className="max-w-[1200px] mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12 mb-20">
          <div>
            <div className="text-2xl font-black tracking-tighter text-[#00dce5] mb-6" style={{ fontFamily: "'Manrope', sans-serif" }}>
              Social Safe
            </div>
            <p className="text-[#cbc3d9] text-sm leading-relaxed mb-6">
              O maior marketplace de ativos digitais da América Latina. Segurança absoluta para compradores e vendedores de contas sociais.
            </p>
            <div className="flex gap-4">
              {[Globe, MessageSquare, Share2].map((Icon, i) => (
                <div key={i} className="w-10 h-10 bg-[#0d0d0d] flex items-center justify-center rounded-lg hover:text-[#00dce5] cursor-pointer transition-colors text-[#cbc3d9]">
                  <Icon className="w-5 h-5" />
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-bold mb-6">Marketplace</h4>
            <ul className="space-y-4 text-sm text-[#cbc3d9]">
              {["Instagram", "YouTube", "TikTok", "Twitter / X"].map(p => (
                <li key={p}><button className="hover:text-[#00dce5] transition-colors">{p}</button></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-6">Suporte</h4>
            <ul className="space-y-4 text-sm text-[#cbc3d9]">
              {["Central de Ajuda", "Taxas & Prazos", "Como Comprar", "Política de Reembolso"].map(s => (
                <li key={s}><button className="hover:text-[#00dce5] transition-colors">{s}</button></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-6">Newsletter</h4>
            <p className="text-sm text-[#cbc3d9] mb-4">Receba as melhores ofertas de contas diretamente no seu e-mail.</p>
            <div className="relative">
              <input
                className="w-full bg-[#0d0d0d] border-none rounded-lg py-3 px-4 text-sm focus:ring-2 focus:ring-[#00dce5]/20 text-[#dae2fd]"
                placeholder="Seu melhor e-mail"
                type="email"
              />
              <button className="absolute right-2 top-1.5 bg-[#00dce5] text-[#003739] px-3 py-1.5 rounded-md text-xs font-bold">
                Assinar
              </button>
            </div>
          </div>
        </div>
        <div className="max-w-[1200px] mx-auto px-6 pt-10 border-t border-[#494456]/10 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-xs text-[#948da2]">© 2026 Social Safe Marketplace. Todos os direitos reservados.</p>
          <div className="flex gap-8 text-xs text-[#948da2]">
            <button className="hover:text-[#dae2fd]">Termos de Uso</button>
            <button className="hover:text-[#dae2fd]">Privacidade</button>
          </div>
        </div>
      </footer>

      {/* ===== MOBILE BOTTOM NAV ===== */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-[#0d0d0d]/80 backdrop-blur-xl border-t border-white/5 z-50">
        <div className="flex justify-around items-center h-16">
          {[
            { icon: "🏠", label: "Home", active: true },
            { icon: "🔍", label: "Explorar", active: false },
            { icon: "➕", label: "Vender", active: false },
            { icon: "🛒", label: "Pedidos", active: false },
            { icon: "👤", label: "Perfil", active: false },
          ].map(item => (
            <button key={item.label} className={`flex flex-col items-center gap-1 ${item.active ? "text-[#00dce5]" : "text-slate-400"}`}>
              <span className="text-lg">{item.icon}</span>
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
