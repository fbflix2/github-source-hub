import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, Search, X, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logoFbflix from "@/assets/logo-fbflix.webp";
import logoWhite from "@/assets/logo-fbflix-white.png";
import { useClientCount } from "@/hooks/useClientCount";
import { TestimonialsColumn, type Testimonial } from "@/components/ui/testimonials-columns-1";
import { motion } from "motion/react";

const TESTIMONIAL_TEXTS = [
  "Migrei toda a operação para a FBFlix e nunca mais tive campanha parada por bloqueio. Estrutura entregue na hora.",
  "Os perfis chegam prontos e os proxies são estáveis de verdade. Escalei sem medo de perder BM.",
  "Suporte responde em minutos. Já resolveram troca de perfil no mesmo dia, sem burocracia.",
  "As BMs aguentam tráfego pesado. Melhor custo-benefício que encontrei no mercado de contingência.",
  "O Safe BM salvou minha operação. Segurança e reposição garantida fazem toda a diferença.",
  "Painel simples, entrega automática e proxy residencial de qualidade. Recomendo de olhos fechados.",
  "Trabalho com volume alto e a FBFlix nunca me deixou na mão. Estrutura sempre disponível.",
  "Testei vários fornecedores, aqui é o único com padrão de qualidade constante em todo pedido.",
  "Contratei o Scale Pro e minha operação ficou muito mais previsível. Vale cada centavo.",
];

const TESTIMONIAL_ROLES = [
  "Gestor de Tráfego",
  "Media Buyer",
  "Infoprodutor",
  "Afiliado",
  "E-commerce",
  "Agência",
];

function shortName(full: string) {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1].charAt(0).toUpperCase()}.`;
}

function LpTestimonials() {
  const [items, setItems] = useState<Testimonial[]>([]);

  useEffect(() => {
    supabase.rpc("get_public_client_testimonials", { _limit: 9 }).then(({ data }) => {
      if (!Array.isArray(data)) return;
      const rows = data as { full_name: string | null; avatar_url: string | null }[];
      setItems(
        rows
          .filter((r) => r.avatar_url && r.full_name)
          .filter(
            (r) =>
              !/^fabr[íi]cio\b/i.test((r.full_name as string).trim())
          )
          .map((r, i) => ({
            text: TESTIMONIAL_TEXTS[i % TESTIMONIAL_TEXTS.length],
            image: r.avatar_url as string,
            name: shortName(r.full_name as string),
            role: TESTIMONIAL_ROLES[i % TESTIMONIAL_ROLES.length],
          }))
      );
    });
  }, []);

  if (items.length < 3) return null;

  const per = Math.ceil(items.length / 3);
  const c1 = items.slice(0, per);
  const c2 = items.slice(per, per * 2);
  const c3 = items.slice(per * 2);

  return (
    <section className="relative z-10 my-20 md:my-24">
      <div className="mx-auto max-w-[1240px] px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto flex max-w-[540px] flex-col items-center"
        >
          <span className="rounded-full border border-white/12 bg-white/[0.05] px-3 py-1 text-[12px] text-white/60 backdrop-blur-md">
            Depoimentos
          </span>
          <h2 className="mt-5 text-center text-[34px] font-medium leading-[1.1] tracking-[-0.035em] sm:text-[46px]">
            O que dizem nossos clientes
          </h2>
          <p className="mt-4 text-center text-[14.5px] leading-relaxed text-white/50">
            Operações reais que escalam com a nossa infraestrutura todos os dias.
          </p>
        </motion.div>

        <div className="mt-14 flex max-h-[640px] justify-center gap-6 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_18%,black_82%,transparent)]">
          <TestimonialsColumn testimonials={c1} duration={22} />
          <TestimonialsColumn testimonials={c2} className="hidden md:block" duration={28} />
          <TestimonialsColumn testimonials={c3} className="hidden lg:block" duration={25} />
        </div>
      </div>
    </section>
  );
}

const NAV = [
  { label: "Soluções", items: true },
  { label: "Produtos", items: true },
  { label: "Empresa", items: true },
  { label: "Ajuda", items: true },
  { label: "Docs", items: true },
  { label: "Preços", items: false },
];

const PARTNERS = [
  {
    name: "Echo Valley",
    mark: (
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="currentColor">
        <path d="M3 3l7 9-7 9h4l5-6.5L17 21h4l-7-9 7-9h-4l-5 6.5L7 3H3z" />
      </svg>
    ),
  },
  {
    name: "Celestial",
    mark: (
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="currentColor">
        <path d="M12 1l1.7 6.1L19 4l-3.1 5.3L22 11l-6.1 1.7L19 18l-5.3-3.1L12 21l-1.7-6.1L5 18l3.1-5.3L2 11l6.1-1.7L5 4l5.3 3.1L12 1z" />
      </svg>
    ),
  },
  {
    name: "Acme Corp",
    mark: (
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="currentColor">
        <path d="M12 2l10 20H2L12 2zm0 6L7 18h10L12 8z" />
      </svg>
    ),
  },
  {
    name: "Quantum",
    mark: (
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="currentColor">
        <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm-3.2 6.8a2.2 2.2 0 110 4.4 2.2 2.2 0 010-4.4zm6.4 0a2.2 2.2 0 110 4.4 2.2 2.2 0 010-4.4zM12 14.5a2.2 2.2 0 110 4.4 2.2 2.2 0 010-4.4z" />
      </svg>
    ),
  },
  {
    name: "2TWICE",
    mark: null,
  },
  {
    name: "Northwind",
    mark: (
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="currentColor">
        <path d="M4 20V4h3l10 11V4h3v16h-3L7 9v11H4z" />
      </svg>
    ),
  },
];

const STEPS = [
  {
    tag: "Passo 1",
    title: "Escolha sua estrutura",
    text: "Perfis, BMs ou proxies residenciais. Catálogo aberto, estoque real e entrega imediata após o pagamento.",
  },
  {
    tag: "Passo 2",
    title: "Ative em minutos",
    text: "Credenciais liberadas automaticamente no painel, com tutoriais e checagem de saúde de cada ativo.",
  },
  {
    tag: "Passo 3",
    title: "Escale com suporte",
    text: "Reposição garantida, monitoramento contínuo e time técnico acompanhando sua operação sem pausas.",
  },
];

const ECO_LEFT = ["Perfis", "BM", "Páginas", "Instagram"];
const ECO_RIGHT = ["Proxies", "Safe BM", "Scale Pro", "Meta Box"];
const ECO_Y = [40, 100, 160, 220];

/* rótulo da vitrine + como casar com o catálogo */
const ECO_MAP: Record<string, { word: string; slugs: string[]; terms: string[] }> = {
  Perfis: { word: "Perfis", slugs: ["perfis"], terms: ["perfil"] },
  BM: { word: "BM's", slugs: ["bm"], terms: ["bm", "business manager"] },
  Páginas: { word: "Páginas", slugs: ["página", "pagina"], terms: ["página", "pagina", "fanpage"] },
  Instagram: { word: "Instagram", slugs: ["instagram"], terms: ["instagram", "ig"] },
  Proxies: { word: "Proxies", slugs: ["proxy"], terms: ["proxy", "proxies"] },
  "Safe BM": { word: "Safe BM", slugs: ["safe-bm"], terms: ["safe bm", "safebm"] },
  "Scale Pro": { word: "Scale Pro", slugs: [], terms: ["scale pro", "scalepro", "scale"] },
  "Meta Box": { word: "Meta Box", slugs: [], terms: ["meta box", "metabox"] },
};

const norm = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

interface LpProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category_id: string | null;
  tags: string[] | null;
}

export default function Index() {
  const ref = useRef<HTMLDivElement>(null);
  const auroraRef = useRef<HTMLDivElement>(null);
  const clientCount = useClientCount(3850);
  const navigate = useNavigate();
  const [avatars, setAvatars] = useState<string[]>([]);

  useEffect(() => {
    supabase
      .rpc("get_public_client_avatars", { _limit: 3 })
      .then(({ data }) => {
        if (Array.isArray(data)) {
          setAvatars(
            (data as { avatar_url: string | null }[])
              .map((p) => p.avatar_url as string)
              .filter(Boolean)
          );
        }
      });
  }, []);
  const [products, setProducts] = useState<LpProduct[]>([]);
  const [cats, setCats] = useState<{ id: string; slug: string | null; name: string }[]>([]);
  const [activeEco, setActiveEco] = useState<string>("Perfis");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [p, c] = await Promise.all([
        supabase
          .from("products")
          .select("id,name,description,price,image_url,category_id,tags")
          .eq("status", "active")
          .order("created_at", { ascending: false }),
        supabase.from("product_categories").select("id,slug,name"),
      ]);
      if (!alive) return;
      if (p.data) setProducts(p.data as LpProduct[]);
      if (c.data) setCats(c.data as any);
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return;
    let raf = 0;
    let tx = 0;
    let ty = 0;
    const onMove = (e: MouseEvent) => {
      tx = (e.clientX / window.innerWidth - 0.5) * 2 * -14;
      ty = (e.clientY / window.innerHeight - 0.5) * 2 * -10;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (auroraRef.current) {
          auroraRef.current.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
        }
      });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const meta = ECO_MAP[activeEco] ?? ECO_MAP.Perfis;
  const catById = (id: string | null) => cats.find((c) => c.id === id);

  const searching = query.trim().length > 1;
  const results = (() => {
    if (searching) {
      const q = norm(query);
      return products.filter((p) => {
        const cat = catById(p.category_id);
        return norm(
          [p.name, p.description, cat?.name, cat?.slug, ...(p.tags || [])].join(" ")
        ).includes(q);
      });
    }
    const bySlug = products.filter((p) => {
      const slug = norm(catById(p.category_id)?.slug || "");
      return meta.slugs.some((s) => norm(s) === slug);
    });
    if (bySlug.length) return bySlug;
    return products.filter((p) => {
      const hay = norm([p.name, ...(p.tags || [])].join(" "));
      return meta.terms.some((t) => hay.includes(norm(t)));
    });
  })();

  const ordered = (() => {
    if (searching || activeEco !== "Perfis") return results;
    const rank = (n: string) => {
      const h = norm(n);
      const m = h.match(/ca\s*0*(\d+)/);
      if (h.includes("perfil") && m) return Number(m[1]);
      return 999;
    };
    return [...results].sort(
      (a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name, "pt-BR", { numeric: true })
    );
  })();

  const visible = showAll ? ordered : ordered.slice(0, 3);
  const wordLabel = searching ? "Busca" : meta.word;

  const selectEco = (label: string) => {
    setQuery("");
    setShowAll(false);
    setActiveEco(label);
    document.getElementById("lp-vitrine")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div ref={ref} className="lp-root relative min-h-screen w-full overflow-hidden bg-black text-white">
      {/* ══════ AURORA BACKGROUND ══════ */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* imagem de fundo do hero */}
        <div className="absolute inset-x-0 top-0 h-[115vh] overflow-hidden">
          <img
            src="/hero-bg-1280.jpg"
            srcSet="/hero-bg-800.jpg 800w, /hero-bg-1280.jpg 1280w"
            sizes="100vw"
            fetchPriority="high"
            decoding="async"
            alt=""
            aria-hidden="true"
            className="h-full w-full scale-105 object-cover opacity-70"
          />
          <div className="absolute inset-0 bg-black/45" />
          <div className="absolute inset-x-0 bottom-0 h-[45vh] bg-[linear-gradient(to_top,#000_0%,rgba(0,0,0,0.92)_25%,rgba(0,0,0,0.6)_55%,transparent_100%)]" />
        </div>

        <div
          ref={auroraRef}
          className="absolute inset-x-0 top-0 hidden h-[115vh] md:block"
          style={{
            transition: "transform 900ms cubic-bezier(0.16,1,0.3,1)",
            willChange: "transform",
            contain: "paint",
          }}
        >
        <svg
          className="h-full w-full scale-[1.06] opacity-70 mix-blend-screen"
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <linearGradient id="lp-a" x1="0" y1="0" x2="1" y2="0.4">
              <stop offset="0%" stopColor="#450a0a" stopOpacity="0" />
              <stop offset="28%" stopColor="#991b1b" stopOpacity="0.85" />
              <stop offset="58%" stopColor="#e50914" />
              <stop offset="82%" stopColor="#ff8a8a" />
              <stop offset="100%" stopColor="#ffffff" />
            </linearGradient>
            <linearGradient id="lp-b" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#310505" stopOpacity="0" />
              <stop offset="40%" stopColor="#b91c1c" stopOpacity="0.55" />
              <stop offset="75%" stopColor="#f87171" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#ffe9e9" />
            </linearGradient>
            <linearGradient id="lp-c" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#0b0b0b" stopOpacity="0" />
              <stop offset="60%" stopColor="#865a5a" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#ffd5d5" stopOpacity="0.7" />
            </linearGradient>
            <filter id="lp-blur-lg" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="34" />
            </filter>
            <filter id="lp-blur-md" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="16" />
            </filter>
            <filter id="lp-blur-sm" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="6" />
            </filter>
            <radialGradient id="lp-core" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="35%" stopColor="#ffd7d7" stopOpacity="0.9" />
              <stop offset="70%" stopColor="#f95a5a" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#a21c1c" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* deep purple wash */}
          <ellipse cx="820" cy="330" rx="760" ry="330" fill="url(#lp-b)" opacity="0.35" filter="url(#lp-blur-lg)" />

          {/* wide soft band */}
          <path
            d="M -140 120 C 380 120, 700 420, 1120 470 C 1320 494, 1440 470, 1560 430"
            stroke="url(#lp-c)"
            strokeWidth="150"
            fill="none"
            filter="url(#lp-blur-lg)"
            opacity="0.75"
          />

          {/* main sweep */}
          <path
            d="M -160 190 C 340 190, 660 430, 1080 470 C 1300 492, 1440 452, 1580 396"
            stroke="url(#lp-a)"
            strokeWidth="66"
            fill="none"
            filter="url(#lp-blur-md)"
            opacity="0.95"
          />

          {/* bright hairline */}
          <path
            d="M -160 205 C 340 205, 660 442, 1080 480 C 1300 500, 1440 462, 1580 408"
            stroke="url(#lp-a)"
            strokeWidth="8"
            fill="none"
            filter="url(#lp-blur-sm)"
          />

          {/* secondary lower sweep */}
          <path
            d="M -160 470 C 300 470, 620 610, 1040 606 C 1280 604, 1420 560, 1580 500"
            stroke="url(#lp-b)"
            strokeWidth="90"
            fill="none"
            filter="url(#lp-blur-lg)"
            opacity="0.7"
          />

          {/* magenta core */}
          <ellipse cx="1180" cy="470" rx="330" ry="230" fill="url(#lp-core)" opacity="0.95" />
          <ellipse cx="1290" cy="470" rx="150" ry="120" fill="url(#lp-core)" />
        </svg>
        </div>

        {/* fallback leve para mobile (sem filtros SVG) */}
        <div className="absolute inset-x-0 top-0 h-[100vh] md:hidden bg-[radial-gradient(60%_45%_at_78%_38%,rgba(229,9,20,0.45)_0%,rgba(229,9,20,0.12)_45%,transparent_75%),radial-gradient(50%_35%_at_20%_20%,rgba(185,28,28,0.28)_0%,transparent_70%)]" />
        {/* vignette + bottom fade */}
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_40%,transparent_35%,rgba(0,0,0,0.75)_100%)]" />
        <div className="absolute inset-x-0 top-[70vh] h-[70vh] bg-[linear-gradient(to_bottom,transparent_0%,rgba(0,0,0,0.55)_35%,rgba(0,0,0,0.9)_70%,#000_100%)]" />
        <div className="absolute inset-x-0 top-[130vh] bottom-0 bg-black" />
        {/* grain */}
        <div className="lp-grain absolute inset-x-0 top-0 hidden h-[115vh] opacity-[0.05] mix-blend-overlay md:block" />
      </div>

      {/* ══════ NAV ══════ */}
      <header className="relative z-20">
        <nav className="mx-auto flex max-w-[1240px] items-center justify-between px-6 py-6">
          <Link to="/" className="flex items-center gap-2">
            <img src={logoFbflix} alt="FBFlix" className="h-6 w-auto" />
            <span className="text-[17px] font-semibold tracking-[-0.02em]">FBFlix</span>
          </Link>

          <ul className="hidden items-center gap-7 lg:flex">
            {NAV.map((n) => (
              <li key={n.label}>
                <button className="flex items-center gap-1 text-[13.5px] text-white/65 transition-colors duration-300 hover:text-white">
                  {n.label}
                  {n.items && <ChevronDown className="size-3.5 opacity-60" strokeWidth={2} />}
                </button>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-4">
            <Link to="/auth" className="text-[13.5px] text-white/70 transition-colors hover:text-white">
              Entrar
            </Link>
            <Link
              to="/auth"
              className="rounded-md border border-white/20 bg-white/[0.06] px-4 py-1.5 text-[13.5px] font-medium text-white backdrop-blur-md transition-all duration-300 hover:bg-white/15"
            >
              Criar conta
            </Link>
          </div>
        </nav>
      </header>

      {/* ══════ HERO ══════ */}
      <section className="relative z-10 mx-auto flex max-w-[1240px] flex-col justify-center px-6 pb-12 pt-6 md:min-h-[calc(100vh-300px)] md:pb-14">
        <div className="lp-in max-w-2xl">
          <div className="mb-7 inline-flex items-center gap-3 rounded-full border border-white/12 bg-white/[0.05] py-1.5 pl-1.5 pr-4 backdrop-blur-md">
            <div className="flex -space-x-2">
              {["#f472b6", "#a78bfa", "#38bdf8"].map((c, i) =>
                avatars[i] ? (
                  <img
                    key={c}
                    src={avatars[i]}
                    alt="Cliente FBFlix"
                    loading="lazy"
                    className="size-6 rounded-full border-2 border-black/70 object-cover"
                  />
                ) : (
                  <span
                    key={c}
                    className="size-6 rounded-full border-2 border-black/70"
                    style={{ background: `linear-gradient(140deg, ${c}, #1e1b4b)` }}
                  />
                )
              )}
            </div>
            <span className="text-[12.5px] text-white/75">
              +{clientCount.toLocaleString("pt-BR")} usuários ativos
            </span>
          </div>

          <h1 className="text-[42px] font-medium leading-[1.06] tracking-[-0.035em] sm:text-[56px] md:text-[64px]">
            Infraestrutura de
            <br />
            contingência definitiva
          </h1>

          <p className="mt-6 max-w-md text-[15.5px] leading-relaxed text-white/55">
            Perfis, BMs e proxies residenciais de alta confiança para operações
            que não podem parar.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              to="/loja"
              className="rounded-lg bg-white px-6 py-2.5 text-[14px] font-medium text-black transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_40px_-10px_rgba(255,255,255,0.6)]"
            >
              Começar agora
            </Link>
            <a
              href="https://wa.me/5519989411105?text=Oi%20vim%20pelo%20site%20da%20fbflix"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-white/20 bg-white/[0.04] px-6 py-2.5 text-[14px] font-medium text-white backdrop-blur-md transition-all duration-300 hover:bg-white/12"
            >
              Falar com especialista
            </a>
          </div>
        </div>
      </section>

      {/* ══════ PARCEIROS — MARQUEE ══════ */}
      <section className="relative z-10 border-t border-white/[0.06] py-8">
        <p className="mb-6 text-center text-[12.5px] tracking-[0.01em] text-white/40">
          Confiado por líderes do mercado
        </p>

        <div className="lp-marquee relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
          <div className="lp-marquee-track">
            {[0, 1].map((dup) => (
              <div key={dup} className="flex shrink-0 items-center gap-16 pr-16" aria-hidden={dup === 1}>
                {PARTNERS.map((p) => (
                  <div
                    key={p.name}
                    className="flex items-center gap-2.5 whitespace-nowrap text-white/55 transition-colors duration-300 hover:text-white"
                  >
                    {p.mark}
                    <span className="text-[15px] font-semibold tracking-[-0.02em]">{p.name}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ COMO FUNCIONA ══════ */}
      <LpTestimonials />

      <section className="relative z-10 mx-auto max-w-[1240px] px-6 py-24 md:py-32">
        <h2 className="text-center text-[34px] font-medium leading-[1.1] tracking-[-0.035em] sm:text-[46px]">
          Como funciona
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-center text-[14.5px] leading-relaxed text-white/50">
          Três passos simples para colocar sua operação de contingência no ar.
        </p>

        <div className="relative mt-20">
          {/* linha */}
          <div className="pointer-events-none absolute left-0 right-0 top-[7px] hidden h-px md:block">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-[#e50914]/60 to-transparent" />
          </div>

          <div className="grid gap-14 md:grid-cols-3 md:gap-10">
            {STEPS.map((s, i) => (
              <div key={s.tag} className="lp-step relative" style={{ animationDelay: `${i * 0.12}s` }}>
                <span className="lp-node relative z-10 block size-[15px] rounded-full bg-[#e50914]" />
                <span className="mt-8 inline-flex rounded-md border border-[#e50914]/35 bg-[#e50914]/10 px-3 py-1 text-[11.5px] font-medium tracking-[-0.01em] text-white/85">
                  {s.tag}
                </span>
                <h3 className="mt-5 text-[19px] font-medium tracking-[-0.025em] text-white">{s.title}</h3>
                <p className="mt-3 max-w-xs text-[13.5px] leading-relaxed text-white/50">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ ECOSSISTEMA ══════ */}
      <section className="relative z-10 mx-auto max-w-[1240px] px-6 pb-28">
        {/* busca liquid glass */}
        <div className="mx-auto mb-10 max-w-[680px]">
          <div className="lp-glass-search flex items-center gap-3 rounded-full px-5 py-3.5">
            <Search className="size-[18px] shrink-0 text-white/60" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowAll(false);
              }}
              placeholder="Busque um ativo ou finalidade — perfil, BM, proxy, contingência…"
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                if (ordered.length > 0) {
                  navigate(`/loja?product=${ordered[0].id}`);
                } else {
                  document
                    .getElementById("lp-vitrine")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }}
              className="w-full bg-transparent text-[14px] tracking-[-0.015em] text-white placeholder:text-white/35 outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="grid size-6 shrink-0 place-items-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Limpar busca"
              >
                <X className="size-[14px]" />
              </button>
            )}
          </div>
        </div>

        <div className="lp-step relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#120306] to-[#08080a] p-6 sm:p-10">
          <div className="lp-eco-dots pointer-events-none absolute inset-0" />

          <div className="relative grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)_minmax(0,1fr)]">
            {/* coluna esquerda */}
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 backdrop-blur-sm">
              <div className="flex flex-col gap-3">
                {ECO_LEFT.map((l) => (
                  <button
                    key={l}
                    onClick={() => selectEco(l)}
                    className={`rounded-lg border px-4 py-2.5 text-center text-[13.5px] font-medium tracking-[-0.015em] shadow-[0_6px_24px_-14px_rgba(229,9,20,0.9)] transition-colors duration-300 hover:border-[#e50914]/40 hover:text-white ${
                      !searching && activeEco === l
                        ? "border-[#e50914]/55 bg-[#e50914]/10 text-white"
                        : "border-white/[0.09] bg-[#0d0d10] text-white/85"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* núcleo + conexões */}
            <div className="relative flex min-h-[260px] items-center justify-center">
              <svg
                viewBox="0 0 400 260"
                preserveAspectRatio="none"
                className="absolute inset-0 hidden h-full w-full md:block"
              >
                <defs>
                  <linearGradient id="lp-eco-l" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#e50914" stopOpacity="0.15" />
                    <stop offset="60%" stopColor="#ff2d3a" stopOpacity="0.75" />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0.9" />
                  </linearGradient>
                  <linearGradient id="lp-eco-r" x1="1" y1="0" x2="0" y2="0">
                    <stop offset="0%" stopColor="#e50914" stopOpacity="0.15" />
                    <stop offset="60%" stopColor="#ff2d3a" stopOpacity="0.75" />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0.9" />
                  </linearGradient>
                </defs>

                {ECO_Y.map((y, i) => (
                  <g key={`l-${y}`}>
                    <path
                      d={`M 6 ${y} C 110 ${y}, 140 130, 200 130`}
                      fill="none"
                      stroke="url(#lp-eco-l)"
                      strokeWidth="1.6"
                    />
                    <path
                      d={`M 6 ${y} C 110 ${y}, 140 130, 200 130`}
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="2.4"
                      className="lp-flow"
                      style={{ animationDelay: `${i * 0.45}s` }}
                    />
                  </g>
                ))}
                {ECO_Y.map((y, i) => (
                  <g key={`r-${y}`}>
                    <path
                      d={`M 394 ${y} C 290 ${y}, 260 130, 200 130`}
                      fill="none"
                      stroke="url(#lp-eco-r)"
                      strokeWidth="1.6"
                    />
                    <path
                      d={`M 394 ${y} C 290 ${y}, 260 130, 200 130`}
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="2.4"
                      className="lp-flow"
                      style={{ animationDelay: `${i * 0.45 + 0.22}s` }}
                    />
                  </g>
                ))}

                {ECO_Y.map((y, i) => (
                  <circle
                    key={`dl-${y}`}
                    cx="6"
                    cy={y}
                    r="5"
                    fill="#e50914"
                    className="lp-eco-dot"
                    style={{ animationDelay: `${i * 0.3}s` }}
                  />
                ))}
                {ECO_Y.map((y, i) => (
                  <circle
                    key={`dr-${y}`}
                    cx="394"
                    cy={y}
                    r="5"
                    fill="#e50914"
                    className="lp-eco-dot"
                    style={{ animationDelay: `${i * 0.3 + 0.15}s` }}
                  />
                ))}
              </svg>

              <div className="lp-eco-core relative z-10 grid size-[112px] place-items-center rounded-full border border-white/[0.12] bg-[#0b0b0e]">
                <img src={logoWhite} alt="FBFlix" className="h-[68px] w-auto object-contain" />
              </div>
            </div>

            {/* coluna direita */}
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 backdrop-blur-sm">
              <div className="flex flex-col gap-3">
                {ECO_RIGHT.map((l) => (
                  <button
                    key={l}
                    onClick={() => selectEco(l)}
                    className={`rounded-lg border px-4 py-2.5 text-center text-[13.5px] font-medium tracking-[-0.015em] shadow-[0_6px_24px_-14px_rgba(229,9,20,0.9)] transition-colors duration-300 hover:border-[#e50914]/40 hover:text-white ${
                      !searching && activeEco === l
                        ? "border-[#e50914]/55 bg-[#e50914]/10 text-white"
                        : "border-white/[0.09] bg-[#0d0d10] text-white/85"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════ VITRINE ══════ */}
      <section id="lp-vitrine" className="relative z-10 mx-auto max-w-[1240px] px-6 pb-32">
        <div className="relative">
          {/* palavra ao fundo */}
          <div className="pointer-events-none absolute inset-x-0 -top-6 flex overflow-visible justify-center">
            <span className="lp-word select-none whitespace-nowrap text-[22vw] sm:text-[20vw] md:text-[15.5vw] lg:text-[230px]">
              {wordLabel}
            </span>
          </div>

          <div className="relative pt-[11vw] md:pt-[130px]">
            {results.length === 0 ? (
              <div className="lp-shop-card rounded-2xl px-6 py-14 text-center text-[14px] text-white/50">
                Nenhum ativo encontrado {searching ? "para essa busca." : "nessa categoria."}
              </div>
            ) : (
              <>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {visible.map((p) => (
                    <article key={p.id} className="lp-shop-card flex flex-col rounded-2xl p-6">
                      <span className="inline-flex w-fit rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium tracking-[-0.01em] text-white/60">
                        {catById(p.category_id)?.name || wordLabel}
                      </span>
                      <h3 className="mt-5 text-[19px] font-medium leading-tight tracking-[-0.025em] text-white">
                        {p.name}
                      </h3>
                      {p.description && (
                        <p className="mt-3 line-clamp-3 text-[13.5px] leading-relaxed text-white/45">
                          {p.description}
                        </p>
                      )}
                      <div className="mt-7 flex flex-1 items-end justify-between gap-3 border-t border-white/[0.07] pt-5">
                        <p className="text-[26px] font-semibold tracking-[-0.03em] text-white">
                          R$ {Number(p.price || 0).toFixed(2).replace(".", ",")}
                        </p>
                        <Link
                          to={`/loja?product=${p.id}`}
                          className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[12.5px] font-medium tracking-[-0.01em] text-black transition-transform duration-300 hover:scale-[1.04]"
                        >
                          Comprar
                          <ArrowUpRight className="size-[14px]" />
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>

                {results.length > 3 && (
                  <div className="mt-10 flex justify-center">
                    <button
                      onClick={() => setShowAll((v) => !v)}
                      className="lp-glass-search inline-flex items-center gap-2 rounded-full px-6 py-3 text-[13px] font-medium tracking-[-0.015em] text-white/85 transition-colors hover:text-white"
                    >
                      {showAll ? "Ver menos" : `Ver mais (${results.length - 3})`}
                      <ChevronDown
                        className={`size-[15px] transition-transform duration-300 ${showAll ? "rotate-180" : ""}`}
                      />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
