import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import logoFbflix from "@/assets/logo-fbflix.webp";
import logoWhite from "@/assets/logo-fbflix-white.png";
import heroVideo from "@/assets/hero-bg.mp4.asset.json";
import heroPoster from "@/assets/hero-poster.jpg.asset.json";

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

export default function Index() {
  const ref = useRef<HTMLDivElement>(null);
  const [m, setM] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      setM({
        x: (e.clientX / window.innerWidth - 0.5) * 2,
        y: (e.clientY / window.innerHeight - 0.5) * 2,
      });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div ref={ref} className="lp-root relative min-h-screen w-full overflow-hidden bg-black text-white">
      {/* ══════ AURORA BACKGROUND ══════ */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* vídeo de fundo do hero */}
        <div className="absolute inset-x-0 top-0 h-[115vh] overflow-hidden">
          <video
            src={heroVideo.url}
            poster={heroPoster.url}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            disablePictureInPicture
            className="h-full w-full scale-105 object-cover opacity-70 [will-change:transform]"
          />
          <div className="absolute inset-0 bg-black/45" />
          <div className="absolute inset-x-0 bottom-0 h-[45vh] bg-[linear-gradient(to_top,#000_0%,rgba(0,0,0,0.92)_25%,rgba(0,0,0,0.6)_55%,transparent_100%)]" />
        </div>

        <svg
          className="absolute inset-0 h-full w-full opacity-70 mix-blend-screen"
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
          style={{
            transform: `translate3d(${m.x * -14}px, ${m.y * -10}px, 0) scale(1.06)`,
            transition: "transform 900ms cubic-bezier(0.16,1,0.3,1)",
          }}
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
            className="lp-drift"
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
            className="lp-drift-slow"
          />

          {/* magenta core */}
          <ellipse cx="1180" cy="470" rx="330" ry="230" fill="url(#lp-core)" opacity="0.95" />
          <ellipse cx="1290" cy="470" rx="150" ry="120" fill="url(#lp-core)" />
        </svg>

        {/* vignette + bottom fade */}
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_40%,transparent_35%,rgba(0,0,0,0.75)_100%)]" />
        <div className="absolute inset-x-0 top-[70vh] h-[70vh] bg-[linear-gradient(to_bottom,transparent_0%,rgba(0,0,0,0.55)_35%,rgba(0,0,0,0.9)_70%,#000_100%)]" />
        <div className="absolute inset-x-0 top-[130vh] bottom-0 bg-black" />
        {/* grain */}
        <div className="lp-grain absolute inset-0 opacity-[0.05] mix-blend-overlay" />
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
      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-88px)] max-w-[1240px] flex-col justify-end px-6 pb-24 md:pb-28">
        <div className="lp-in max-w-2xl">
          <div className="mb-7 inline-flex items-center gap-3 rounded-full border border-white/12 bg-white/[0.05] py-1.5 pl-1.5 pr-4 backdrop-blur-md">
            <div className="flex -space-x-2">
              {["#f472b6", "#a78bfa", "#38bdf8"].map((c) => (
                <span
                  key={c}
                  className="size-6 rounded-full border-2 border-black/70"
                  style={{ background: `linear-gradient(140deg, ${c}, #1e1b4b)` }}
                />
              ))}
            </div>
            <span className="text-[12.5px] text-white/75">+10 mil operações rodando</span>
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
              href="#demo"
              className="rounded-lg border border-white/20 bg-white/[0.04] px-6 py-2.5 text-[14px] font-medium text-white backdrop-blur-md transition-all duration-300 hover:bg-white/12"
            >
              Falar com especialista
            </a>
          </div>
        </div>
      </section>

      {/* ══════ PARCEIROS — MARQUEE ══════ */}
      <section className="relative z-10 border-t border-white/[0.06] py-12">
        <p className="mb-8 text-center text-[12.5px] tracking-[0.01em] text-white/40">
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
        <div className="lp-step relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#120306] to-[#08080a] p-6 sm:p-10">
          <div className="lp-eco-dots pointer-events-none absolute inset-0" />

          <div className="relative grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)_minmax(0,1fr)]">
            {/* coluna esquerda */}
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 backdrop-blur-sm">
              <div className="flex flex-col gap-3">
                {ECO_LEFT.map((l) => (
                  <div
                    key={l}
                    className="rounded-lg border border-white/[0.09] bg-[#0d0d10] px-4 py-2.5 text-center text-[13.5px] font-medium tracking-[-0.015em] text-white/85 shadow-[0_6px_24px_-14px_rgba(229,9,20,0.9)] transition-colors duration-300 hover:border-[#e50914]/40 hover:text-white"
                  >
                    {l}
                  </div>
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

              <div className="lp-eco-core relative z-10 grid size-[74px] place-items-center rounded-2xl border border-white/[0.12] bg-[#0b0b0e]">
                <img src={logoWhite} alt="FBFlix" className="h-8 w-auto" />
              </div>
            </div>

            {/* coluna direita */}
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 backdrop-blur-sm">
              <div className="flex flex-col gap-3">
                {ECO_RIGHT.map((l) => (
                  <div
                    key={l}
                    className="rounded-lg border border-white/[0.09] bg-[#0d0d10] px-4 py-2.5 text-center text-[13.5px] font-medium tracking-[-0.015em] text-white/85 shadow-[0_6px_24px_-14px_rgba(229,9,20,0.9)] transition-colors duration-300 hover:border-[#e50914]/40 hover:text-white"
                  >
                    {l}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
