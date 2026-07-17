import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

/**
 * FBFLIX Marketplace Premium — standalone landing page.
 * Intentionally does NOT use the app's shadcn/tailwind design system.
 * All styling is inline / scoped via a <style> block below.
 */

type BM = {
  id: string;
  country: string;
  flag: string;
  code: string;
  bmId: string;
  verification: "Verificada" | "Alta Confiança";
  limit: string;
  accounts: number;
  createdAt: string;
  risk: "BAIXO" | "MÉDIO";
  method: "VISA" | "MASTER" | "AMEX";
  price: number;
};

const BMS: BM[] = [
  { id: "1", country: "United States", code: "US", flag: "🇺🇸", bmId: "178392741892374", verification: "Verificada", limit: "$50K / dia", accounts: 15, createdAt: "12/03/2023", risk: "BAIXO", method: "VISA", price: 1890 },
  { id: "2", country: "United Kingdom", code: "UK", flag: "🇬🇧", bmId: "284736284736284", verification: "Verificada", limit: "£30K / dia", accounts: 10, createdAt: "18/07/2023", risk: "BAIXO", method: "MASTER", price: 2250 },
  { id: "3", country: "Canada", code: "CA", flag: "🇨🇦", bmId: "938475938475938", verification: "Verificada", limit: "$40K / dia", accounts: 12, createdAt: "22/05/2023", risk: "BAIXO", method: "VISA", price: 1750 },
  { id: "4", country: "Australia", code: "AU", flag: "🇦🇺", bmId: "736485736485736", verification: "Verificada", limit: "$35K / dia", accounts: 8, createdAt: "10/02/2023", risk: "BAIXO", method: "MASTER", price: 1650 },
  { id: "5", country: "Germany", code: "DE", flag: "🇩🇪", bmId: "837465837465837", verification: "Verificada", limit: "€25K / dia", accounts: 9, createdAt: "30/06/2023", risk: "BAIXO", method: "VISA", price: 2100 },
  { id: "6", country: "France", code: "FR", flag: "🇫🇷", bmId: "562938562938562", verification: "Verificada", limit: "€20K / dia", accounts: 7, createdAt: "05/04/2023", risk: "BAIXO", method: "MASTER", price: 1550 },
  { id: "7", country: "Spain", code: "ES", flag: "🇪🇸", bmId: "482037482037482", verification: "Alta Confiança", limit: "€18K / dia", accounts: 6, createdAt: "14/08/2023", risk: "BAIXO", method: "VISA", price: 1490 },
  { id: "8", country: "Netherlands", code: "NL", flag: "🇳🇱", bmId: "918273918273918", verification: "Verificada", limit: "€22K / dia", accounts: 8, createdAt: "02/09/2023", risk: "BAIXO", method: "AMEX", price: 1980 },
  { id: "9", country: "Brazil", code: "BR", flag: "🇧🇷", bmId: "374829374829374", verification: "Verificada", limit: "R$ 80K / dia", accounts: 11, createdAt: "20/01/2023", risk: "BAIXO", method: "VISA", price: 1390 },
];

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

export default function MarketplacePremium() {
  const [copied, setCopied] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("");
  const [method, setMethod] = useState("");
  const [mouse, setMouse] = useState({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      setMouse({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useEffect(() => {
    document.title = "FBFLIX Marketplace — BM Rodadas Selecionadas";
    const prev = document.body.style.background;
    document.body.style.background = "#06070A";
    return () => { document.body.style.background = prev; };
  }, []);

  const list = useMemo(() => {
    return BMS.filter(b => {
      if (country && b.code !== country) return false;
      if (method && b.method !== method) return false;
      if (search && !`${b.country} ${b.bmId} ${b.code}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [country, method, search]);

  const copyId = async (id: string) => {
    try { await navigator.clipboard.writeText(id); } catch {}
    setCopied(id);
    setTimeout(() => setCopied(null), 1400);
  };

  const toggleFav = (id: string) => {
    setFavorites(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  return (
    <div className="fbx-mkt">
      <style>{styles}</style>

      {/* Ambient background */}
      <div className="mkt-bg" aria-hidden>
        <div className="mkt-bg-grain" />
        <div
          className="mkt-bg-orb mkt-bg-orb-a"
          style={{ transform: `translate3d(${(mouse.x - 0.5) * 40}px, ${(mouse.y - 0.5) * 40}px, 0)` }}
        />
        <div
          className="mkt-bg-orb mkt-bg-orb-b"
          style={{ transform: `translate3d(${(0.5 - mouse.x) * 60}px, ${(0.5 - mouse.y) * 60}px, 0)` }}
        />
      </div>

      {/* Top bar */}
      <header className="mkt-nav">
        <Link to="/" className="mkt-brand" aria-label="FBFLIX Marketplace">
          <span className="mkt-brand-mark">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5v-7Z" />
              <path d="M12 12v8M4 8.5 12 12l8-3.5" />
            </svg>
          </span>
          <span className="mkt-brand-text">
            <b>FBFLIX</b>
            <em>Marketplace</em>
          </span>
        </Link>
        <button className="mkt-nav-cta" type="button">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 3l7 4v5c0 4.5-3 8.5-7 9-4-.5-7-4.5-7-9V7l7-4Z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
          Verificador de BM
        </button>
      </header>

      {/* Hero */}
      <section className="mkt-hero">
        <div className="mkt-hero-left">
          <span className="mkt-eyebrow">MARKETPLACE PREMIUM</span>
          <h1 className="mkt-headline">
            BM Rodadas <br /><span className="mkt-headline-alt">Selecionadas</span>
          </h1>
          <p className="mkt-sub">
            Business Managers verificadas, revisadas e prontas para escalar campanhas com máxima estabilidade.
          </p>

          <div className="mkt-hero-features">
            {[
              { icon: "shield", title: "VERIFICADAS", desc: "100% verificadas manualmente" },
              { icon: "bolt", title: "ENTREGA RÁPIDA", desc: "Acesso imediato após confirmação" },
              { icon: "gem", title: "ALTA QUALIDADE", desc: "BMs estáveis e com histórico limpo" },
            ].map(f => (
              <div key={f.title} className="mkt-feat">
                <span className="mkt-feat-icon">{renderIcon(f.icon)}</span>
                <div>
                  <div className="mkt-feat-title">{f.title}</div>
                  <div className="mkt-feat-desc">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <a href="#marketplace" className="mkt-cta">
            Ver todas as BM disponíveis
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </a>
        </div>

        <div className="mkt-hero-right" aria-hidden>
          <div className="mkt-cube-scene">
            <div className="mkt-cube-glow" />
            <div className="mkt-cube">
              <div className="mkt-cube-face mkt-cube-front">
                <svg viewBox="0 0 40 40" width="72" height="72" fill="#1877F2">
                  <path d="M20 3.33A16.67 16.67 0 003.33 20c0 8.32 6.09 15.22 14.06 16.47V24.84h-4.23V20h4.23v-3.67c0-4.18 2.49-6.48 6.29-6.48 1.82 0 3.73.32 3.73.32v4.1h-2.1c-2.07 0-2.71 1.28-2.71 2.6V20h4.62l-.74 4.84h-3.88v11.63C30.58 35.22 36.67 28.32 36.67 20A16.67 16.67 0 0020 3.33z"/>
                </svg>
              </div>
              <div className="mkt-cube-face mkt-cube-right" />
              <div className="mkt-cube-face mkt-cube-top" />
              <div className="mkt-cube-face mkt-cube-left" />
              <div className="mkt-cube-face mkt-cube-bottom" />
              <div className="mkt-cube-face mkt-cube-back" />
            </div>
            <div className="mkt-cube-floor" />
          </div>
        </div>
      </section>

      {/* Marketplace */}
      <section id="marketplace" className="mkt-shell">
        <div className="mkt-shell-inner">
          <div className="mkt-shell-head">
            <div className="mkt-shell-title">
              <span className="mkt-dot" />
              <h2>BM DISPONÍVEIS</h2>
              <span className="mkt-shell-sub">Encontre a BM ideal para suas campanhas</span>
            </div>
          </div>

          <div className="mkt-filters">
            <span className="mkt-filters-label">Filtrar por:</span>

            <select className="mkt-select" value={country} onChange={e => setCountry(e.target.value)}>
              <option value="">País</option>
              {[...new Set(BMS.map(b => b.code))].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <select className="mkt-select">
              <option>Tipo de Verificação</option>
              <option>Verificada</option>
              <option>Alta Confiança</option>
            </select>

            <select className="mkt-select">
              <option>Limite de Gasto</option>
              <option>Até $10K</option>
              <option>$10K–$30K</option>
              <option>$30K+</option>
            </select>

            <select className="mkt-select">
              <option>Preço</option>
              <option>Menor</option>
              <option>Maior</option>
            </select>

            <input
              className="mkt-search"
              placeholder="Buscar BM, país, ID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />

            <button className="mkt-more">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 6h16M7 12h10M10 18h4"/>
              </svg>
              Mais Filtros
            </button>
          </div>

          <div className="mkt-grid">
            {list.map((bm, i) => (
              <article
                key={bm.id}
                className="mkt-card"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <header className="mkt-card-head">
                  <div className="mkt-card-title">
                    <span className="mkt-flag">{bm.flag}</span>
                    <div>
                      <div className="mkt-card-country">{bm.code} – {bm.country}</div>
                      <div className="mkt-card-bmid">
                        BM ID: <span>{bm.bmId}</span>
                        <button className="mkt-icon-btn" onClick={() => copyId(bm.bmId)} title="Copiar ID">
                          {copied === bm.bmId ? (
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#2ECC71" strokeWidth="2"><path d="m5 12 5 5 9-11"/></svg>
                          ) : (
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                  <button className="mkt-fav" onClick={() => toggleFav(bm.id)} aria-label="Favoritar">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill={favorites.has(bm.id) ? "#D4A64F" : "none"} stroke={favorites.has(bm.id) ? "#D4A64F" : "currentColor"} strokeWidth="1.6">
                      <path d="m12 3 2.9 5.9 6.5.95-4.7 4.58 1.1 6.47L12 17.77 6.2 20.9l1.1-6.47L2.6 9.85l6.5-.95L12 3Z"/>
                    </svg>
                  </button>
                </header>

                <div className="mkt-card-rows">
                  <Row label="Tipo de Verificação" value={<Badge>{bm.verification.toUpperCase()}</Badge>} icon="check" />
                  <Row label="Limite de Gasto" value={bm.limit} icon="bolt" />
                  <Row label="Contas de Anúncio" value={String(bm.accounts)} icon="grid" />
                  <Row label="Conta Criada em" value={bm.createdAt} icon="calendar" />
                  <Row label="Perfil de Risco" value={<BadgeGreen>{bm.risk}</BadgeGreen>} icon="chart" />
                  <Row label="Método de Pagamento" value={<span className="mkt-method">{bm.method}</span>} icon="card" />
                </div>

                <footer className="mkt-card-foot">
                  <div className="mkt-price">{fmtBRL(bm.price)}</div>
                  <button className="mkt-buy">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 10V8a6 6 0 1 1 12 0v2"/><rect x="4" y="10" width="16" height="10" rx="2"/></svg>
                    Comprar agora
                  </button>
                </footer>
              </article>
            ))}

            {list.length === 0 && (
              <div className="mkt-empty">Nenhuma BM encontrada para os filtros selecionados.</div>
            )}
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="mkt-trust">
        {[
          { i: "shield", t: "Segurança Garantida", d: "Todas as contas passam por um processo rigoroso de verificação." },
          { i: "bolt", t: "Entrega Imediata", d: "Acesso entregue imediatamente após a confirmação do pagamento." },
          { i: "head", t: "Suporte Premium", d: "Suporte especializado para garantir seu sucesso." },
          { i: "refresh", t: "Reposição Garantida", d: "Em caso de qualquer problema, fazemos a reposição." },
        ].map(x => (
          <div key={x.t} className="mkt-trust-item">
            <span className="mkt-trust-icon">{renderIcon(x.i)}</span>
            <div>
              <div className="mkt-trust-title">{x.t}</div>
              <div className="mkt-trust-desc">{x.d}</div>
            </div>
          </div>
        ))}
      </section>

      <footer className="mkt-foot">
        <div>© {new Date().getFullYear()} FBFLIX Marketplace. Todos os direitos reservados.</div>
        <div className="mkt-foot-mute">Este site não é afiliado ao Facebook ou Meta.</div>
      </footer>
    </div>
  );
}

function Row({ label, value, icon }: { label: string; value: React.ReactNode; icon: string }) {
  return (
    <div className="mkt-row">
      <span className="mkt-row-l"><span className="mkt-row-icon">{renderIcon(icon)}</span>{label}</span>
      <span className="mkt-row-v">{value}</span>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="mkt-badge mkt-badge-blue">{children}</span>;
}
function BadgeGreen({ children }: { children: React.ReactNode }) {
  return <span className="mkt-badge mkt-badge-green">{children}</span>;
}

function renderIcon(name: string) {
  const p = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6 };
  switch (name) {
    case "shield": return <svg {...p}><path d="M12 3l8 4v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V7l8-4Z"/><path d="m9 12 2 2 4-4"/></svg>;
    case "bolt": return <svg {...p}><path d="M13 3 4 14h7l-1 7 9-11h-7l1-7Z"/></svg>;
    case "gem": return <svg {...p}><path d="M6 3h12l3 6-9 12L3 9l3-6Z"/><path d="M3 9h18M9 3l3 6 3-6"/></svg>;
    case "check": return <svg {...p}><path d="m5 12 5 5 9-11"/></svg>;
    case "grid": return <svg {...p}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>;
    case "calendar": return <svg {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>;
    case "chart": return <svg {...p}><path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/></svg>;
    case "card": return <svg {...p}><rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20"/></svg>;
    case "head": return <svg {...p}><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="2" y="14" width="5" height="6" rx="1.5"/><rect x="17" y="14" width="5" height="6" rx="1.5"/></svg>;
    case "refresh": return <svg {...p}><path d="M20 12a8 8 0 1 1-3-6.24"/><path d="M20 4v5h-5"/></svg>;
    default: return null;
  }
}

const styles = `
.fbx-mkt{
  --bg:#06070A; --card:#0D1015; --line:rgba(255,255,255,.06);
  --text:#FFFFFF; --mute:#9FA4AE; --gold:#D4A64F; --blue:#4E8DFF; --green:#2ECC71;
  min-height:100vh; color:var(--text); background:var(--bg);
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", "Neue Haas Grotesk", "Helvetica Neue", Arial, sans-serif;
  font-feature-settings: "ss01","cv11"; letter-spacing:-0.01em;
  position:relative; overflow-x:hidden;
}
.fbx-mkt *{box-sizing:border-box}
.fbx-mkt button{font:inherit; color:inherit; cursor:pointer}
.mkt-bg{position:fixed; inset:0; z-index:0; pointer-events:none; overflow:hidden}
.mkt-bg-grain{position:absolute; inset:-1px; opacity:.035; background-image:radial-gradient(rgba(255,255,255,.6) 1px, transparent 1px); background-size:3px 3px}
.mkt-bg-orb{position:absolute; border-radius:50%; filter:blur(120px); opacity:.35; transition:transform .8s cubic-bezier(.2,.7,.2,1)}
.mkt-bg-orb-a{width:520px; height:520px; left:-140px; top:-160px; background:radial-gradient(circle, #4E8DFF 0%, transparent 60%)}
.mkt-bg-orb-b{width:560px; height:560px; right:-160px; top:220px; background:radial-gradient(circle, #D4A64F 0%, transparent 60%); opacity:.22}

.mkt-nav{position:relative; z-index:5; display:flex; align-items:center; justify-content:space-between; padding:28px clamp(20px,4vw,56px)}
.mkt-brand{display:flex; align-items:center; gap:12px; color:#fff; text-decoration:none}
.mkt-brand-mark{display:inline-flex; align-items:center; justify-content:center; width:38px; height:38px; border-radius:10px; background:linear-gradient(135deg,#131822,#0b0e14); border:1px solid var(--line); color:var(--gold); box-shadow:inset 0 1px 0 rgba(255,255,255,.05)}
.mkt-brand-text{display:flex; flex-direction:column; line-height:1.05}
.mkt-brand-text b{font-size:15px; letter-spacing:.14em}
.mkt-brand-text em{font-style:normal; font-size:10px; letter-spacing:.28em; color:var(--gold); text-transform:uppercase}
.mkt-nav-cta{display:inline-flex; align-items:center; gap:8px; padding:10px 16px; background:rgba(255,255,255,.03); border:1px solid var(--line); color:#fff; border-radius:999px; font-size:13px; transition:all .25s ease}
.mkt-nav-cta:hover{background:rgba(255,255,255,.06); border-color:rgba(212,166,79,.35); color:var(--gold)}

.mkt-hero{position:relative; z-index:2; display:grid; grid-template-columns:1.05fr 1fr; gap:60px; align-items:center; padding:40px clamp(20px,4vw,56px) 80px; max-width:1440px; margin:0 auto}
.mkt-hero-left{animation:fadeUp .9s cubic-bezier(.2,.7,.2,1) both}
.mkt-eyebrow{display:inline-block; font-size:11px; letter-spacing:.32em; color:var(--gold); margin-bottom:22px}
.mkt-headline{font-size:clamp(48px, 6vw, 84px); line-height:1.02; font-weight:600; letter-spacing:-0.035em; margin:0}
.mkt-headline-alt{font-style:italic; font-weight:400; background:linear-gradient(180deg,#fff 0%, #b8bcc4 100%); -webkit-background-clip:text; background-clip:text; color:transparent; display:inline-block; padding-left:0.12em; padding-right:0.08em; margin-left:-0.04em}
.mkt-sub{color:var(--mute); font-size:16px; line-height:1.6; margin:20px 0 36px; max-width:520px}
.mkt-hero-features{display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:36px; max-width:560px}
.mkt-feat{display:flex; gap:12px; align-items:flex-start; padding:14px; border-left:1px solid rgba(212,166,79,.25)}
.mkt-feat-icon{width:28px; height:28px; display:inline-flex; align-items:center; justify-content:center; border-radius:8px; background:rgba(212,166,79,.08); color:var(--gold); flex-shrink:0}
.mkt-feat-title{font-size:11px; letter-spacing:.14em; font-weight:600; color:#fff; margin-bottom:4px}
.mkt-feat-desc{font-size:11px; color:var(--mute); line-height:1.45}

.mkt-cta{display:inline-flex; align-items:center; gap:10px; padding:16px 26px; border-radius:12px; background:linear-gradient(180deg, rgba(212,166,79,.14), rgba(212,166,79,.06)); border:1px solid rgba(212,166,79,.35); color:#F5E7C6; text-decoration:none; font-weight:500; font-size:14px; letter-spacing:.01em; transition:all .3s cubic-bezier(.2,.7,.2,1); box-shadow:0 10px 40px -20px rgba(212,166,79,.4)}
.mkt-cta:hover{transform:translateY(-1px); background:linear-gradient(180deg, rgba(212,166,79,.22), rgba(212,166,79,.1)); border-color:rgba(212,166,79,.55); color:#fff}

.mkt-hero-right{position:relative; height:520px; animation:fadeIn 1.2s ease .2s both}
.mkt-cube-scene{position:absolute; inset:0; perspective:1600px; display:flex; align-items:center; justify-content:center}
.mkt-cube-glow{position:absolute; width:420px; height:420px; border-radius:50%; background:radial-gradient(circle, rgba(78,141,255,.35) 0%, transparent 60%); filter:blur(60px); animation:pulse 6s ease-in-out infinite}
.mkt-cube{position:relative; width:280px; height:280px; transform-style:preserve-3d; transform:rotateX(-18deg) rotateY(-28deg); animation:cubeFloat 8s ease-in-out infinite}
.mkt-cube-face{position:absolute; width:280px; height:280px; background:linear-gradient(135deg, #0b0e14 0%, #131822 100%); border:1px solid rgba(78,141,255,.18); box-shadow:inset 0 0 60px rgba(78,141,255,.12)}
.mkt-cube-front{transform:translateZ(140px); display:flex; align-items:center; justify-content:center}
.mkt-cube-back{transform:translateZ(-140px) rotateY(180deg)}
.mkt-cube-right{transform:translateX(140px) rotateY(90deg); background:linear-gradient(135deg,#0e1219,#1a2030); box-shadow:inset 0 0 80px rgba(78,141,255,.25)}
.mkt-cube-left{transform:translateX(-140px) rotateY(-90deg); background:linear-gradient(135deg,#050609,#0a0d13)}
.mkt-cube-top{transform:translateY(-140px) rotateX(90deg); background:linear-gradient(135deg,#0c1017,#151b28)}
.mkt-cube-bottom{transform:translateY(140px) rotateX(-90deg); background:#04050a}
.mkt-cube-floor{position:absolute; bottom:60px; width:340px; height:60px; background:radial-gradient(ellipse, rgba(78,141,255,.25) 0%, transparent 70%); filter:blur(20px)}

@keyframes cubeFloat{ 0%,100%{transform:rotateX(-18deg) rotateY(-28deg) translateY(0)} 50%{transform:rotateX(-16deg) rotateY(-32deg) translateY(-14px)} }
@keyframes pulse{ 0%,100%{opacity:.7; transform:scale(1)} 50%{opacity:1; transform:scale(1.08)} }
@keyframes fadeUp{ from{opacity:0; transform:translateY(24px)} to{opacity:1; transform:none} }
@keyframes fadeIn{ from{opacity:0} to{opacity:1} }
@keyframes cardIn{ from{opacity:0; transform:translateY(16px)} to{opacity:1; transform:none} }

.mkt-shell{position:relative; z-index:2; padding:0 clamp(20px,4vw,56px) 80px; max-width:1440px; margin:0 auto}
.mkt-shell-inner{background:linear-gradient(180deg, rgba(13,16,21,.85), rgba(13,16,21,.6)); border:1px solid var(--line); border-radius:28px; padding:36px clamp(20px,3vw,40px); backdrop-filter:blur(20px); box-shadow:0 40px 100px -30px rgba(0,0,0,.6)}
.mkt-shell-head{margin-bottom:28px}
.mkt-shell-title{display:flex; align-items:center; gap:14px; flex-wrap:wrap}
.mkt-shell-title h2{font-size:14px; letter-spacing:.24em; font-weight:600; margin:0}
.mkt-shell-sub{color:var(--mute); font-size:13px; padding-left:14px; border-left:1px solid var(--line)}
.mkt-dot{width:8px; height:8px; border-radius:50%; background:var(--green); box-shadow:0 0 12px var(--green)}

.mkt-filters{display:flex; flex-wrap:wrap; gap:10px; align-items:center; padding:12px 14px; background:rgba(255,255,255,.02); border:1px solid var(--line); border-radius:14px; margin-bottom:28px}
.mkt-filters-label{font-size:12px; color:var(--mute); margin-right:6px}
.mkt-select, .mkt-search, .mkt-more{
  background:rgba(255,255,255,.02); border:1px solid var(--line); color:#fff; border-radius:10px; padding:9px 14px; font-size:12.5px;
  outline:none; transition:all .25s ease; appearance:none;
}
.mkt-select{padding-right:28px; background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none'><path d='M1 1l4 4 4-4' stroke='%239FA4AE' stroke-width='1.4'/></svg>"); background-repeat:no-repeat; background-position:right 10px center}
.mkt-select option{background:#0D1015}
.mkt-select:hover,.mkt-search:hover,.mkt-more:hover{border-color:rgba(255,255,255,.15)}
.mkt-search{min-width:180px; flex:1 1 200px}
.mkt-more{display:inline-flex; align-items:center; gap:8px; margin-left:auto}

.mkt-grid{display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:20px}
.mkt-empty{grid-column:1/-1; text-align:center; padding:60px 20px; color:var(--mute)}

.mkt-card{
  position:relative; background:linear-gradient(180deg, #0F131A 0%, #0B0E14 100%);
  border:1px solid var(--line); border-radius:24px; padding:22px;
  transition:transform .35s cubic-bezier(.2,.7,.2,1), border-color .3s, box-shadow .35s;
  animation:cardIn .7s cubic-bezier(.2,.7,.2,1) both;
  overflow:hidden;
}
.mkt-card::before{
  content:""; position:absolute; inset:0; border-radius:inherit;
  background:radial-gradient(600px circle at var(--mx,50%) var(--my,0%), rgba(212,166,79,.06), transparent 40%);
  opacity:0; transition:opacity .3s;
}
.mkt-card:hover{transform:translateY(-4px) scale(1.005); border-color:rgba(212,166,79,.22); box-shadow:0 30px 60px -30px rgba(0,0,0,.7), 0 0 0 1px rgba(212,166,79,.05)}
.mkt-card:hover::before{opacity:1}

.mkt-card-head{display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:18px}
.mkt-card-title{display:flex; gap:12px; align-items:flex-start}
.mkt-flag{font-size:26px; line-height:1; filter:drop-shadow(0 4px 8px rgba(0,0,0,.4))}
.mkt-card-country{font-size:15px; font-weight:600; letter-spacing:-.01em}
.mkt-card-bmid{display:flex; align-items:center; gap:6px; font-size:11px; color:var(--mute); margin-top:3px}
.mkt-card-bmid span{color:#c9cdd4; font-variant-numeric:tabular-nums}
.mkt-icon-btn{background:transparent; border:none; padding:2px; color:var(--mute); display:inline-flex; align-items:center; border-radius:4px; transition:color .2s}
.mkt-icon-btn:hover{color:var(--gold)}
.mkt-fav{background:transparent; border:none; padding:4px; color:var(--mute); transition:color .2s, transform .2s}
.mkt-fav:hover{color:var(--gold); transform:scale(1.1)}

.mkt-card-rows{display:flex; flex-direction:column; gap:10px; padding:14px 0; border-top:1px solid var(--line); border-bottom:1px solid var(--line); margin-bottom:18px}
.mkt-row{display:flex; justify-content:space-between; align-items:center; font-size:12.5px}
.mkt-row-l{display:inline-flex; align-items:center; gap:8px; color:var(--mute)}
.mkt-row-icon{color:var(--mute); display:inline-flex}
.mkt-row-v{color:#fff; font-weight:500; font-variant-numeric:tabular-nums}
.mkt-method{font-family:"SF Mono", ui-monospace, Menlo, monospace; font-size:11px; letter-spacing:.06em; color:#fff; opacity:.8}

.mkt-badge{display:inline-flex; align-items:center; padding:3px 10px; border-radius:999px; font-size:10px; letter-spacing:.08em; font-weight:600}
.mkt-badge-blue{background:rgba(78,141,255,.12); color:#7BA6FF; border:1px solid rgba(78,141,255,.25)}
.mkt-badge-green{background:rgba(46,204,113,.1); color:#4ADE80; border:1px solid rgba(46,204,113,.25)}

.mkt-card-foot{display:flex; justify-content:space-between; align-items:center}
.mkt-price{font-size:22px; font-weight:600; letter-spacing:-.02em; color:var(--gold)}
.mkt-buy{
  display:inline-flex; align-items:center; gap:8px; padding:10px 18px; border-radius:10px;
  background:linear-gradient(180deg, rgba(212,166,79,.22), rgba(212,166,79,.08));
  border:1px solid rgba(212,166,79,.35); color:#F5E7C6; font-weight:500; font-size:12.5px;
  transition:all .25s ease;
}
.mkt-buy:hover{background:linear-gradient(180deg, rgba(212,166,79,.32), rgba(212,166,79,.16)); border-color:rgba(212,166,79,.55); color:#fff}

.mkt-trust{position:relative; z-index:2; display:grid; grid-template-columns:repeat(4, 1fr); gap:24px; padding:36px clamp(20px,4vw,56px); max-width:1440px; margin:0 auto; border-top:1px solid var(--line)}
.mkt-trust-item{display:flex; gap:14px; align-items:flex-start}
.mkt-trust-icon{width:36px; height:36px; display:inline-flex; align-items:center; justify-content:center; border-radius:10px; background:rgba(212,166,79,.08); color:var(--gold); flex-shrink:0}
.mkt-trust-title{font-size:13px; font-weight:600; margin-bottom:4px}
.mkt-trust-desc{font-size:12px; color:var(--mute); line-height:1.5}

.mkt-foot{padding:36px clamp(20px,4vw,56px) 40px; text-align:center; color:var(--mute); font-size:12px; position:relative; z-index:2}
.mkt-foot-mute{margin-top:6px; opacity:.7}

@media (max-width: 900px){
  .mkt-hero{grid-template-columns:1fr; padding-bottom:40px}
  .mkt-hero-right{height:360px; order:-1}
  .mkt-cube, .mkt-cube-face{width:220px; height:220px}
  .mkt-cube-front{transform:translateZ(110px)}
  .mkt-cube-back{transform:translateZ(-110px) rotateY(180deg)}
  .mkt-cube-right{transform:translateX(110px) rotateY(90deg)}
  .mkt-cube-left{transform:translateX(-110px) rotateY(-90deg)}
  .mkt-cube-top{transform:translateY(-110px) rotateX(90deg)}
  .mkt-cube-bottom{transform:translateY(110px) rotateX(-90deg)}
  .mkt-hero-features{grid-template-columns:1fr}
  .mkt-trust{grid-template-columns:1fr 1fr}
  .mkt-more{margin-left:0}
}
@media (max-width: 560px){
  .mkt-headline{font-size:44px}
  .mkt-trust{grid-template-columns:1fr}
  .mkt-grid{grid-template-columns:1fr}
}
`;