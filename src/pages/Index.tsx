import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import logoFbflix from "@/assets/logo-fbflix.webp";
import { supabase } from "@/integrations/supabase/client";

/* ---------- DEFAULT constants (fallback) ---------- */
const DEFAULTS = {
  hero: {
    title: "CONTINGÊNCIA QUE", titleHighlight: "ESCALA",
    subtitle: "Perfis Premium • Proxies Residenciais • BM • Escala real sem banimento",
    ctaText: "COMPRAR AGORA", ctaSecondary: "VER PACOTES",
    liveCounter: "+4.872 contas rodando agora",
    backgroundImage: "https://lh3.googleusercontent.com/aida-public/AB6AXuA6mgEPPp3A8WfZQmpvovGnq8PM9WQg_VkbqFOpX5utcy7JW7eYKsAV9pckAiLW4HXkTuCnkbHEzSZ3XgxxuKvKwpUukxRYguy3lK19izWDcioO08gGeV0zOD1FeiHJuxT3A2T4eviHN7giUTucvUtz0X1X_fv8_p0lyBhXQVoaXqw_kB8a3XkhmnWhIp7aJXlzHp8a8L3FttZWD1Bx6gMZA2n-sMXVQZ-CsESvtzVWY7V9EgAY2K_iL9-Ydu2XDyUc2mCIhqxA_Pc3",
    whatsappUrl: "https://wa.me/55000000000", whatsappLabel: "Fale com um Especialista",
  },
  partners: ["Natália Torres", "Conta Simples", "Utmify", "Lauth", "Alan Benites"],
  steps: [
    { icon: "shopping_cart", title: "Escolha o produto", desc: "Selecione entre Perfis, Proxies ou BM de acordo com sua estratégia de tráfego." },
    { icon: "bolt", title: "Receba instantaneamente", desc: "Entrega automatizada via e-mail e painel em menos de 60 segundos após o PIX." },
    { icon: "rocket_launch", title: "Escala sem banimento", desc: "Aqueça, suba suas campanhas e escale seu ROI com a segurança de IPs residenciais." },
  ],
  stepsTitle: "Sua contingência em", stepsTitleHighlight: "3 passos",
  stepsSubtitle: "Engenharia de alta precisão para afiliados e gestores que buscam o topo.",
  products: [
    { title: "Perfis Premium", sub: "Instagram + TikTok", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuAe_KntvbU6rPvrronnRaNIEbxUcs-Cqtn_k_YUtg0ShQP1F9xKhw4BFxwRf1SLq070qar43LIP4nMrRD9wVXI4oBANGXhzCUxMI_sTgvR1I9IL8l7CsZTSjp26FnkK6QjptSZ-1PnAAKhCIPFs9RbwHFRc1a1SceBcQUwQIdostfeDpOSIYuvSlBG025IsoFowEKrAI9SvmTC6oS9MUxLGnUEnigAqj19030Q7e2PHwUOA7k84A15dkY65Py4mdLeV2tq7poVAi1ow", features: ["Aquecidos 15+ dias", "Foto e Bio reais", "Cookies inclusos"], price: "47", unit: "/unid", featured: false },
    { title: "Proxies Residencial", sub: "4G / 5G Mobile", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuD5ZhArplK1PvXPuC1gMxXEKC7jFymbwp-YmIOYu3WvhhVoIDT4fG8sfpe7bx8kynpzQuBckd3DBWaEayUg4cKCCgwLfOfVf-mQN-35VXRB9z--uH9xfmrlffr7LP3EODJAVFTesuTOg_ur1kYusUW3-1wGQzEDwyBhLicfkMzJsc8TRynBjlQSnufDpsLaHQKzbDt6rrhlgWzTNH5xSkNxY4qJCxJQ23ONSnLY8ISY0KprLLjWz2mnXGBcB6pRnAk8WIQL-FXWgDCs", features: ["IPs de operadoras reais", "Rotação automática", "Zero blacklist"], price: "129", unit: "/mês", featured: false },
    { title: "Bulk Messaging", sub: "WhatsApp / BM", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuDuOpsfJ57lH1sDAzKnHxnS1tmHsCcYVtAMnp3Q6dM5YKrP713ZmmmRMPrIniVJG2OyFiUqsXW4OEE-pKwSpBIi0kTCoQ7y3BWgDhvOtDKEAYGWAPs-ZzMMILSgZMB41E_23Thwtn6juVyQjxpQRoFh1hmG5mG3tg_oAHtAdnIMjmH4GYjyZXlUMKGp8HZRmOSdB45pdcpiLPPgfnbglucGgrlDKjrXkppUlmepJt_jHBNsTbOwSc9LazMZZvxK3yJKcjopvAbikrhs", features: ["API de alta performance", "Delay anti-ban", "Suporte a variáveis"], price: "197", unit: "/camp", featured: false },
    { title: "Pacote Completo", sub: "Estratégia Full", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuDBHtsx0N9hlnapvr_eARhpwUGeQHuJenA6V139WpurnDdc5yh9kvaBUSB1NdXvPKr3Zau62tmkJh3vlBc1KYODu46oD9VhPpbVTb0QfLMMYNdnF6KILOHesHzC5d51amprFa-JVV7Ohlf0_XoPfF5rJRwzgfEn2sFtg1Hh66Sy2JsNdTuUusO2fdZgANaKzwgEEM6Y09DLFQd4c5cxlJ7uT4gtfV8-m5HIEO8KR0VQsoI3X4pg02bYGwy0x5LL8lwpSGItXGlLGFfx", features: ["10 Perfis Premium", "Proxy 5G Ilimitado", "Consultoria de Setup"], price: "497", unit: "/setup", featured: true },
  ],
  productsTitle: "Escolha sua arma de", productsTitleHighlight: "contingência",
  benefits: [
    { icon: "location_on", title: "IP Residencial Real", desc: "Conexões autênticas que o Facebook confia." },
    { icon: "timer", title: "Entrega < 60s", desc: "Processamento automático instantâneo." },
    { icon: "support_agent", title: "Suporte 24h", desc: "Especialistas prontos para te ajudar a escalar." },
    { icon: "verified_user", title: "Garantia Total", desc: "Reposição imediata em caso de falha técnica." },
  ],
  benefitsTitle: "Por que milhares de usuários escolhem a", benefitsTitleHighlight: "FBFLIX",
  testimonials: [
    { name: "Ricardo Mendes", role: "Afiliado Black", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuCUsS26R4V-9ieauNjiLBM58xWx7-XK2lqjxaxaObILCHd1PajMPL_Cq7wPRVsIJJJ1qIXjqiOV0Vr7bluMSj_Pfk2W7gZCR2X0QqnAIzmvMk3WQuPw7oBw1NR8ypQZW153UeiAGmw7zlR2WZeiM8zEzPv2x1V7LvrTT0U8BYyTQpc3JilicYnzTuWuCafui8WXpJ4JEZoUDfSbYZI-FDJSD8GWv3M2U7xbiE3HXra8HIvyF-p9lo4NSthSn-5EJBDCZ3TEDH2gqQ7X", text: '"Depois que migrei para os proxies da FBFLIX, parei de tomar checkpoint em cascata. Escala garantida."' },
    { name: "Amanda Souza", role: "Gestora de Tráfego", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuA5QWtGBu4iTXnpf_eDSnru2VV8RlEWYG7CAspTvbPqafRUit1JuHkR4yIVG7sOVenAa06Mj9etc-mh2uoamzDEOVdpHZlbaNn4u9e2aDbGGxcFedGYJXLyTIo-sf4Gp8HbkJmXf5pk1KxzTSpGLzcTkge1OC4e_bXE5D1zlJSXQc7f_OoQ-fbijzEUC4lagZ2rjkT48sRgyHC-F5NCrn145azBcrtMdjaga0c76Ps5w19LUA_VGL9TSr7H1kTKv9qZmARHwF3P-JBs", text: '"A entrega é surreal de rápida. Em 1 minuto já estava com os perfis logados e subindo campanha."' },
  ],
  simulator: {
    title: "Monte seu pacote e veja o preço na hora",
    items: [
      { label: "Quantidade de Perfis", key: "profiles", price: 47, min: 1, max: 50, default: 10 },
      { label: "Proxies Residenciais", key: "proxies", price: 129, min: 0, max: 10, default: 2 },
      { label: "Quantidade de Páginas", key: "pages", price: 15, min: 1, max: 20, default: 5 },
      { label: "Campanhas Bulk BM", key: "bm", price: 197, min: 0, max: 10, default: 1 },
    ],
  },
  footer: {
    cnpj: "40.122.096/0001-85",
    description: "© 2026 FBFLIX. Todos os direitos reservados. Engenharia de precisão para contingência e escala profissional no mercado de tráfego pago.",
  },
};

/* ---------- Scroll reveal hook ---------- */
function useReveal() {
  useEffect(() => {
    const handler = () => {
      document.querySelectorAll(".lp-reveal").forEach((el) => {
        const top = el.getBoundingClientRect().top;
        if (top < window.innerHeight - 150) el.classList.add("lp-active");
      });
    };
    window.addEventListener("scroll", handler, { passive: true });
    handler();
    return () => window.removeEventListener("scroll", handler);
  }, []);
}

/* ---------- Component ---------- */
const Index = () => {
  const navigate = useNavigate();
  useReveal();

  // Load config from DB
  const [cfg, setCfg] = useState(DEFAULTS);
  useEffect(() => {
    supabase
      .from("site_settings")
      .select("value")
      .eq("key", "landing_page_config")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) {
          try { setCfg({ ...DEFAULTS, ...JSON.parse(data.value) }); } catch {}
        }
      });
  }, []);

  // Simulator state
  const [simValues, setSimValues] = useState<Record<string, number>>({});
  useEffect(() => {
    const init: Record<string, number> = {};
    cfg.simulator.items.forEach((item) => { init[item.key] = item.default; });
    setSimValues(init);
  }, [cfg.simulator.items]);

  const total = cfg.simulator.items.reduce((sum, item) => sum + (simValues[item.key] || 0) * item.price, 0);

  const goAuth = () => navigate("/auth");

  return (
    <div className="bg-[#050505] text-[#f5f5f5] font-['Inter'] selection:bg-[#ff3131] selection:text-white min-h-screen">
      {/* ===== NAV ===== */}
      <nav className="fixed top-0 w-full z-50 bg-[#050505]/80 backdrop-blur-3xl border-b border-[#ff3131]/10 shadow-[0_0_40px_rgba(255,49,49,0.05)]">
        <div className="flex justify-between items-center px-8 py-4 max-w-7xl mx-auto">
          <img src={logoFbflix} alt="FBFLIX" width={32} height={32} className="h-8 object-contain cursor-pointer transition-all duration-300 hover:scale-105" />
          <div className="hidden md:flex gap-8 items-center font-['Space_Grotesk'] tracking-tighter text-sm uppercase font-bold">
            <a href="#home" className="text-[#ff3131] border-b-2 border-[#ff3131] pb-1 cursor-pointer transition-all duration-300">Home</a>
            <a href="#como-funciona" className="text-white/70 hover:text-white transition-colors cursor-pointer">Como Funciona</a>
            <a href="#produtos" className="text-white/70 hover:text-white transition-colors cursor-pointer">Produtos</a>
            <a href="#simulador" className="text-white/70 hover:text-white transition-colors cursor-pointer">Simulador</a>
          </div>
          <button onClick={goAuth} className="bg-[#ff3131] text-white px-6 py-2 font-['Space_Grotesk'] font-bold uppercase tracking-widest text-xs hover:scale-105 transition-transform duration-300 ease-out hover:shadow-[0_0_25px_rgba(255,49,49,0.6)]">
            Comprar Agora
          </button>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <section id="home" className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#050505] z-10" />
          <img
            alt="Digital Network"
            className="w-full h-full object-cover opacity-20 grayscale contrast-125"
            src={cfg.hero.backgroundImage}
            width={1920}
            height={1080}
            loading="eager"
            fetchPriority="low"
          />
        </div>

        <div className="relative z-20 max-w-7xl mx-auto px-8 w-full text-center">
          {/* Shield icon */}
          <div className="mb-6 flex justify-center lp-reveal">
            <img src={logoFbflix} alt="FBFLIX" width={80} height={80} className="w-20 h-20 object-contain drop-shadow-[0_0_30px_rgba(255,49,49,0.3)]" fetchPriority="high" />
          </div>

          <h1 className="font-['Space_Grotesk'] text-6xl md:text-8xl font-black tracking-tighter text-white uppercase leading-[0.9] mb-6 lp-reveal" style={{ transitionDelay: "100ms" }}>
            {cfg.hero.title} <span className="text-[#ff3131] italic">{cfg.hero.titleHighlight}</span>
          </h1>
          <p className="font-['Space_Grotesk'] text-lg md:text-2xl text-[#ebbbb4] max-w-3xl mx-auto mb-10 tracking-tight whitespace-nowrap lp-reveal" style={{ transitionDelay: "200ms" }}>
            {cfg.hero.subtitle}
          </p>

          <div className="flex flex-col md:flex-row gap-4 justify-center items-center mb-16 lp-reveal" style={{ transitionDelay: "300ms" }}>
            <button onClick={goAuth} className="bg-[#ff3131] text-white px-10 py-5 font-['Space_Grotesk'] font-bold text-lg uppercase tracking-wider hover:shadow-[0_0_25px_rgba(255,49,49,0.6)] transition-all duration-300">
              {cfg.hero.ctaText}
            </button>
            <button onClick={() => document.getElementById("produtos")?.scrollIntoView({ behavior: "smooth" })} className="border-2 border-white/20 text-white px-10 py-5 font-['Space_Grotesk'] font-bold text-lg uppercase tracking-wider hover:bg-white hover:text-black transition-all duration-300">
              {cfg.hero.ctaSecondary}
            </button>
          </div>

          {/* Pulse */}
          <div className="flex items-center justify-center gap-3 lp-reveal" style={{ transitionDelay: "400ms" }}>
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
            </div>
            <span className="font-['Space_Grotesk'] font-bold text-[#ff3131] tracking-widest text-sm uppercase">{cfg.hero.liveCounter}</span>
          </div>

          {/* Partners */}
          <div className="mt-24 pb-12 lp-reveal" style={{ transitionDelay: "500ms" }}>
            <p className="text-[10px] font-['Space_Grotesk'] font-bold uppercase tracking-[0.4em] text-white/30 text-center mb-10 italic">Parceiros e Clientes que Confiam</p>
            <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-8 opacity-50 grayscale hover:grayscale-0 transition-all duration-700">
              {cfg.partners.map((p) => (
                <div key={p} className="group cursor-pointer">
                  <span className="font-['Space_Grotesk'] font-bold text-xl md:text-2xl text-white/50 group-hover:text-white group-hover:drop-shadow-[0_0_10px_rgba(255,49,49,0.5)] transition-all duration-300">{p}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== COMO FUNCIONA ===== */}
      <section id="como-funciona" className="py-24 bg-[#030303]">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-4 lp-reveal">
            <h2 className="font-['Space_Grotesk'] text-4xl md:text-6xl font-bold tracking-tighter text-white max-w-xl">
              {cfg.stepsTitle} <span className="text-[#ff3131]">{cfg.stepsTitleHighlight}</span>
            </h2>
            <p className="text-[#ebbbb4] font-medium max-w-xs mb-2">{cfg.stepsSubtitle}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {cfg.steps.map((s, i) => (
              <div key={i} className="group bg-[#0a0a0a] p-10 relative overflow-hidden transition-all duration-500 hover:-translate-y-2 border border-white/5 hover:border-[#ff3131]/20 lp-reveal" style={{ transitionDelay: `${(i + 1) * 100}ms` }}>
                <div className="absolute top-0 right-0 p-4 text-8xl font-black text-white/5 font-['Space_Grotesk']">{String(i + 1).padStart(2, "0")}</div>
                <span className="material-symbols-outlined text-[#ff3131] text-5xl mb-6 group-hover:scale-110 transition-transform duration-300">{s.icon}</span>
                <h3 className="font-['Space_Grotesk'] text-2xl font-bold text-white mb-4">{s.title}</h3>
                <p className="text-[#ebbbb4]">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PRODUCTS ===== */}
      <section id="produtos" className="py-24">
        <div className="max-w-7xl mx-auto px-8">
          <h2 className="font-['Space_Grotesk'] text-4xl md:text-5xl font-bold tracking-tighter text-white mb-16 text-center lp-reveal">
            {cfg.productsTitle} <span className="text-[#ff3131] italic">{cfg.productsTitleHighlight}</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {cfg.products.map((p, i) => (
              <div
                key={p.title}
                className={`${p.featured ? "bg-[#ff3131] shadow-[0_0_40px_rgba(255,49,49,0.15)]" : "bg-[#0d0d0d] border border-white/5 hover:border-[#ff3131]/30"} p-8 flex flex-col h-full relative overflow-hidden transition-all duration-300 group lp-reveal`}
                style={{ transitionDelay: `${(i + 1) * 100}ms` }}
              >
                {p.featured && (
                  <div className="absolute top-0 right-0 bg-white text-[#ff3131] px-3 py-1 font-bold text-[10px] uppercase tracking-tighter">MAIS VENDIDO</div>
                )}
                <h3 className="font-['Space_Grotesk'] font-bold text-white text-xl mb-2">{p.title}</h3>
                <p className={`text-xs ${p.featured ? "text-white/80" : "text-[#ff3131]"} font-bold uppercase tracking-widest mb-6`}>{p.sub}</p>
                <div className="mb-8">
                  <img alt={p.title} className={`w-full h-32 object-cover ${p.featured ? "brightness-110" : "grayscale group-hover:grayscale-0"} transition-all duration-500`} src={p.img} width={400} height={128} loading="lazy" />
                </div>
                <ul className={`text-sm ${p.featured ? "text-white font-medium" : "text-[#ebbbb4]"} space-y-3 mb-8 flex-grow`}>
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <span className={`material-symbols-outlined ${p.featured ? "text-white" : "text-[#ff3131]"} text-sm`}>{p.featured ? "verified" : "check_circle"}</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <div className={`pt-6 border-t ${p.featured ? "border-white/20" : "border-white/5"}`}>
                  <p className="text-2xl font-black text-white mb-4">R$ {p.price}<span className={`text-sm font-normal ${p.featured ? "text-white/70" : "text-[#ebbbb4]"}`}>{p.unit}</span></p>
                  <button
                    onClick={goAuth}
                    className={`w-full py-3 font-['Space_Grotesk'] font-bold text-xs uppercase tracking-widest transition-all duration-300 ${
                      p.featured
                        ? "bg-white text-[#ff3131] hover:scale-105"
                        : "bg-[#111111] text-white hover:bg-[#ff3131] hover:text-white"
                    }`}
                  >
                    {p.featured ? "COMPRAR AGORA" : "COMPRAR"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== SOCIAL PROOF ===== */}
      <section className="py-24 bg-[#030303] overflow-hidden">
        <div className="max-w-7xl mx-auto px-8">
          <div className="grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr] gap-16 items-center">
            <div className="lp-reveal">
              <h2 className="font-['Space_Grotesk'] text-4xl md:text-5xl font-bold tracking-tighter text-white mb-8 leading-tight">
                {cfg.benefitsTitle} <span className="text-[#ff3131] italic">{cfg.benefitsTitleHighlight}</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                {cfg.benefits.map((b) => (
                  <div key={b.title} className="flex gap-4">
                    <span className="material-symbols-outlined text-[#ff3131] text-3xl shrink-0">{b.icon}</span>
                    <div>
                      <h3 className="text-white font-bold mb-1">{b.title}</h3>
                      <p className="text-sm text-[#ebbbb4]">{b.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative lp-reveal" style={{ transitionDelay: "200ms" }}>
              <div className="absolute -inset-4 bg-[#ff3131]/10 blur-3xl rounded-full" />
              <div className="relative space-y-4">
                {cfg.testimonials.map((t, i) => (
                  <div key={t.name} className={`bg-[#0d0d0d]/70 backdrop-blur-[24px] p-6 border border-white/5 hover:border-[#ff3131]/30 transition-colors duration-300 ${i === 1 ? "translate-x-4" : ""}`}>
                    <div className="flex items-center gap-4 mb-3">
                      <img alt={t.name} className="w-12 h-12 rounded-full grayscale hover:grayscale-0 transition-all" src={t.img} width={48} height={48} loading="lazy" />
                      <div>
                        <p className="text-white font-bold text-sm">{t.name}</p>
                        <p className="text-[#ff3131] text-[10px] uppercase font-bold tracking-widest">{t.role}</p>
                      </div>
                    </div>
                    <p className="text-[#ebbbb4] text-sm italic">{t.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== SIMULATOR ===== */}
      <section id="simulador" className="py-24 bg-[#0a0a0a]">
        <div className="max-w-4xl mx-auto px-8">
          <div className="bg-[#111111] p-10 md:p-16 border border-[#ff3131]/30 shadow-[0_0_40px_rgba(255,49,49,0.15)] relative lp-reveal">
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[#ff3131] text-white px-10 py-3 font-['Space_Grotesk'] font-bold text-sm uppercase tracking-widest shadow-[0_0_20px_rgba(255,49,49,0.4)]">
              Simulador de Preço
            </div>

            <h2 className="font-['Space_Grotesk'] text-3xl md:text-4xl font-bold text-white mb-14 text-center">{cfg.simulator.title}</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-12">
              {cfg.simulator.items.map((item) => (
                <SliderField
                  key={item.key}
                  label={item.label}
                  value={simValues[item.key] || 0}
                  onChange={(v) => setSimValues((prev) => ({ ...prev, [item.key]: v }))}
                  min={item.min}
                  max={item.max}
                />
              ))}
            </div>

            <div className="mt-16 pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-10">
              <div className="text-center md:text-left">
                <p className="text-white/50 text-[10px] uppercase font-bold tracking-[0.3em] mb-2">Total Estimado</p>
                <p className="text-6xl font-black text-white tracking-tighter">
                  <span className="text-[#ff3131] mr-2">R$</span>
                  {total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <button onClick={goAuth} className="bg-[#ff3131] text-white px-16 py-6 font-['Space_Grotesk'] font-bold text-xl uppercase tracking-widest hover:shadow-[0_0_25px_rgba(255,49,49,0.6)] w-full md:w-auto transition-all duration-300 hover:scale-105 active:scale-95">
                FINALIZAR COMPRA
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="bg-[#030303] w-full py-16 px-8 border-t border-[#ff3131]/10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 max-w-7xl mx-auto">
          <div className="col-span-1 md:col-span-2">
            <span className="text-2xl font-black text-[#ff3131] mb-6 block italic">FBFLIX</span>
            <p className="text-sm text-white/50 max-w-sm mb-8 leading-relaxed">
              {cfg.footer.description}
            </p>
            <p className="text-xs text-white/50">CNPJ: {cfg.footer.cnpj}</p>
          </div>
          <div>
            <h3 className="text-white font-bold text-sm mb-6 uppercase tracking-widest">Links Rápidos</h3>
            <ul className="space-y-4 text-xs text-white/50">
              <li><a href="/termos" className="hover:text-[#ff3131] transition-colors">Termos de Uso</a></li>
              <li><a href="/privacidade" className="hover:text-[#ff3131] transition-colors">Política de Privacidade</a></li>
              <li><a href="/suporte" className="hover:text-[#ff3131] transition-colors">Suporte ao Cliente</a></li>
              <li><a href="/parceria" className="hover:text-[#ff3131] transition-colors">Programa de Afiliados</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-white font-bold text-sm mb-6 uppercase tracking-widest">Segurança</h3>
            <div className="flex gap-6">
              <span className="material-symbols-outlined text-white/20 text-5xl">verified</span>
              <span className="material-symbols-outlined text-white/20 text-5xl">encrypted</span>
            </div>
          </div>
        </div>
      </footer>

      {/* ===== FLOATING CHAT ===== */}
      <a
        href="https://wa.me/55000000000"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-8 right-8 z-[100] bg-[#ff3131] text-white w-14 h-14 rounded-full flex items-center justify-center shadow-[0_0_25px_rgba(255,49,49,0.5)] hover:scale-110 transition-transform duration-300 group"
      >
        <span className="material-symbols-outlined text-3xl group-hover:rotate-12 transition-transform" style={{ fontVariationSettings: "'FILL' 1" }}>chat</span>
        <span className="absolute right-full mr-4 bg-[#111111] px-4 py-2 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity border border-[#ff3131]/30 pointer-events-none">
          Fale com um Especialista
        </span>
      </a>

      {/* Reveal CSS */}
      <style>{`
        .lp-reveal {
          opacity: 0;
          transform: translateY(20px);
          transition: all 0.8s ease-out;
        }
        .lp-reveal.lp-active {
          opacity: 1;
          transform: translateY(0);
        }
        input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          background: #ff3131;
          cursor: pointer;
          border-radius: 50%;
          box-shadow: 0 0 15px rgba(255, 49, 49, 0.8);
          border: 2px solid white;
        }
      `}</style>
    </div>
  );
};

/* ---------- Slider sub-component ---------- */
function SliderField({ label, value, onChange, min, max }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number }) {
  const id = label.replace(/\s+/g, '-').toLowerCase();
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <label htmlFor={id} className="text-white font-bold uppercase text-[10px] tracking-[0.2em] opacity-70">{label}</label>
        <span className="text-[#ff3131] font-black text-2xl drop-shadow-[0_0_8px_rgba(255,49,49,0.5)]">{value}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer"
      />
    </div>
  );
}

export default Index;
