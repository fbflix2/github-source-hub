import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import logoFbflix from "@/assets/logo-fbflix.webp";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * FBFLIX Marketplace Premium — standalone landing page.
 * Intentionally does NOT use the app's shadcn/tailwind design system.
 * All styling is inline / scoped via a <style> block below.
 */

type BM = {
  id: string;
  name: string;
  country: string;
  flag: string;
  code: string;
  bmId: string;
  verification: string;
  limit: string;
  accounts: number;
  createdAt: string;
  risk: string;
  method: string;
  gastoTotal: number;
  price: number;
  details?: string[];
};

const genBmId = () => {
  let s = "";
  for (let i = 0; i < 15; i++) s += Math.floor(Math.random() * 10);
  return s;
};

const BMS_FALLBACK: BM[] = [
  { id: "1",  name: "Dentista O Sane",     country: "Brasil", code: "BR", flag: "🇧🇷", bmId: genBmId(), verification: "Rodada",            limit: "R$ 2.241 / dia", accounts: 5,  createdAt: "2024", risk: "BAIXO",         method: "Cartão",           gastoTotal: 16853.61, price: 2000 },
  { id: "2",  name: "Dra. Ingrid",         country: "Brasil", code: "BR", flag: "🇧🇷", bmId: genBmId(), verification: "Rodada",            limit: "R$ 1.309 / dia", accounts: 5,  createdAt: "2024", risk: "BAIXO",         method: "Cartão",           gastoTotal: 14276.59, price: 1800 },
  { id: "3",  name: "Refrigera Max 1",     country: "Brasil", code: "BR", flag: "🇧🇷", bmId: genBmId(), verification: "Rodada",            limit: "R$ 1.310 / dia", accounts: 5,  createdAt: "2025", risk: "BAIXO",         method: "Cartão",           gastoTotal: 12883.26, price: 1600 },
  { id: "4",  name: "BM 2022",             country: "Brasil", code: "BR", flag: "🇧🇷", bmId: genBmId(), verification: "Rodada Verificada", limit: "R$ 4.973 / dia", accounts: 19, createdAt: "2022", risk: "ALTO HISTÓRICO", method: "Cartão",           gastoTotal: 80099.94, price: 3000 },
  { id: "5",  name: "Debo M",              country: "Brasil", code: "BR", flag: "🇧🇷", bmId: genBmId(), verification: "Rodada",            limit: "R$ 1.264 / dia", accounts: 5,  createdAt: "2025", risk: "BAIXO",         method: "Cartão",           gastoTotal: 18222.93, price: 2000 },
  { id: "6",  name: "Agência Karina",      country: "Brasil", code: "BR", flag: "🇧🇷", bmId: genBmId(), verification: "Rodada",            limit: "R$ 1.264 / dia", accounts: 5,  createdAt: "2023", risk: "BAIXO",         method: "Cartão",           gastoTotal: 13385.93, price: 1800 },
  { id: "7",  name: "DC Estratégico",      country: "Brasil", code: "BR", flag: "🇧🇷", bmId: genBmId(), verification: "Rodada",            limit: "R$ 1.307 / dia", accounts: 5,  createdAt: "2020", risk: "BAIXO",         method: "Cartão",           gastoTotal: 2298.74,  price: 1200 },
  { id: "8",  name: "BM Live",             country: "Brasil", code: "BR", flag: "🇧🇷", bmId: genBmId(), verification: "Rodada",            limit: "R$ 1.307 / dia", accounts: 5,  createdAt: "2023", risk: "BAIXO",         method: "Cartão",           gastoTotal: 7746.70,  price: 1800 },
  { id: "9",  name: "Alpha Anúncios",      country: "Brasil", code: "BR", flag: "🇧🇷", bmId: genBmId(), verification: "Rodada",            limit: "R$ 1.294 / dia", accounts: 5,  createdAt: "2021", risk: "BAIXO",         method: "Cartão",           gastoTotal: 30.01,    price: 600  },
  { id: "10", name: "BM Mariana",          country: "Brasil", code: "BR", flag: "🇧🇷", bmId: genBmId(), verification: "Rodada Verificada", limit: "R$ 2.109 / dia", accounts: 5,  createdAt: "2024", risk: "VERIFICADA",    method: "Cartão",           gastoTotal: 18645.87, price: 2000 },
  { id: "11", name: "JOAB Vieira Feitosa", country: "Brasil", code: "BR", flag: "🇧🇷", bmId: genBmId(), verification: "Rodada Verificada", limit: "R$ 2.287 / dia", accounts: 5,  createdAt: "2026", risk: "VERIFICADA",    method: "Cartão",           gastoTotal: 4185.12,  price: 1200 },
  { id: "12", name: "RUMA",                country: "Brasil", code: "BR", flag: "🇧🇷", bmId: genBmId(), verification: "Rodada",            limit: "R$ 1.289 / dia", accounts: 5,  createdAt: "2020", risk: "BAIXO",         method: "Cartão",           gastoTotal: 3161.49,  price: 1200 },
  { id: "13", name: "BALLI",               country: "Brasil", code: "BR", flag: "🇧🇷", bmId: genBmId(), verification: "Rodada",            limit: "No Limit",       accounts: 5,  createdAt: "2021", risk: "PREMIUM",       method: "Cartão / Pré-paga", gastoTotal: 25424.29, price: 600  },
];

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

export default function MarketplacePremium() {
  const [copied, setCopied] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("");
  const [method, setMethod] = useState("");
  const [verification, setVerification] = useState("");
  const [limitBucket, setLimitBucket] = useState("");
  const [priceSort, setPriceSort] = useState("");
  const [mouse, setMouse] = useState({ x: 0.5, y: 0.5 });
  const [bms, setBms] = useState<BM[]>(BMS_FALLBACK);
  const [sellOpen, setSellOpen] = useState(false);
  const [detailsBm, setDetailsBm] = useState<BM | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("marketplace_bms")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error || !data || data.length === 0) return;
      setBms(
        data.map((r: any) => ({
          id: r.id,
          name: r.name,
          country: r.country || "Brasil",
          code: r.code || "BR",
          flag: "🇧🇷",
          bmId: r.bm_id || genBmId(),
          verification: r.verification || "Rodada",
          limit: r.limit_daily || "",
          accounts: r.accounts ?? 5,
          createdAt: r.created_year || "2024",
          risk: r.risk || "BAIXO",
          method: r.method || "Cartão",
          gastoTotal: Number(r.gasto_total || 0),
          price: Number(r.price || 0),
          details: Array.isArray(r.details) ? r.details : [],
        }))
      );
    })();
  }, []);

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
    const parseLimit = (s: string): number | null => {
      if (!s) return null;
      if (/no\s*limit|ilimitad/i.test(s)) return Infinity;
      const m = s.replace(/\./g, "").match(/([0-9]+(?:,[0-9]+)?)/);
      return m ? parseFloat(m[1].replace(",", ".")) : null;
    };
    const filtered = bms.filter(b => {
      if (country && b.code !== country) return false;
      if (method && b.method !== method) return false;
      if (verification) {
        const v = b.verification.toLowerCase();
        if (verification === "verificada" && !v.includes("verificada")) return false;
        if (verification === "rodada" && v.includes("verificada")) return false;
      }
      if (limitBucket) {
        const n = parseLimit(b.limit);
        if (n === null) return false;
        if (limitBucket === "low" && !(n < 1500)) return false;
        if (limitBucket === "mid" && !(n >= 1500 && n < 3000)) return false;
        if (limitBucket === "high" && !(n >= 3000)) return false;
      }
      if (search && !`${b.name} ${b.country} ${b.bmId} ${b.code}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    if (priceSort === "asc") filtered.sort((a, b) => a.price - b.price);
    else if (priceSort === "desc") filtered.sort((a, b) => b.price - a.price);
    return filtered;
  }, [country, method, verification, limitBucket, priceSort, search, bms]);

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
          <span className="mkt-brand-mark mkt-brand-mark-img">
            <img src={logoFbflix} alt="FBFLIX" />
          </span>
          <span className="mkt-brand-text">
            <b>FBFLIX</b>
            <em>BMs Selecionadas</em>
          </span>
        </Link>
        <button className="mkt-nav-cta" type="button" onClick={() => setSellOpen(true)}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Vender BM
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
              {[...new Set(bms.map(b => b.code))].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <select className="mkt-select" value={verification} onChange={e => setVerification(e.target.value)}>
              <option value="">Tipo de Verificação</option>
              <option value="verificada">Verificada</option>
              <option value="rodada">Rodada</option>
            </select>

            <select className="mkt-select" value={limitBucket} onChange={e => setLimitBucket(e.target.value)}>
              <option value="">Limite de Gasto</option>
              <option value="low">Até R$ 1.500 / dia</option>
              <option value="mid">R$ 1.500 – R$ 3.000 / dia</option>
              <option value="high">R$ 3.000+ / dia</option>
            </select>

            <select className="mkt-select" value={priceSort} onChange={e => setPriceSort(e.target.value)}>
              <option value="">Preço</option>
              <option value="asc">Menor</option>
              <option value="desc">Maior</option>
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
                    <span className="mkt-flag" aria-label={bm.country} title={bm.country}>
                      <img
                        src={`https://flagcdn.com/w160/${bm.code.toLowerCase() === "uk" ? "gb" : bm.code.toLowerCase()}.png`}
                        srcSet={`https://flagcdn.com/w320/${bm.code.toLowerCase() === "uk" ? "gb" : bm.code.toLowerCase()}.png 2x`}
                        alt={bm.country}
                        loading="lazy"
                      />
                    </span>
                    <div>
                      <div className="mkt-card-country">{bm.name}</div>
                      <div className="mkt-card-sub">{bm.country}</div>
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
                  <Row label="Gasto Total" value={<span className="mkt-method">{fmtBRL(bm.gastoTotal)}</span>} icon="bolt" />
                </div>

                <footer className="mkt-card-foot">
                  <div className="mkt-price">{fmtBRL(bm.price)}</div>
                  {bm.details && bm.details.length > 0 && (
                    <button className="mkt-more-btn" type="button" onClick={() => setDetailsBm(bm)} title="Ver mais detalhes">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 8v.01M11 12h1v4h1"/></svg>
                      Ver mais
                    </button>
                  )}
                  <button
                    className="mkt-buy"
                    type="button"
                    onClick={() => {
                      const msg =
                        `Olá! Tenho interesse na BM do marketplace FBFlix:\n\n` +
                        `*${bm.name}*\n` +
                        `País: ${bm.country}\n` +
                        (bm.bm_id ? `ID: ${bm.bm_id}\n` : "") +
                        (bm.code ? `Código: ${bm.code}\n` : "") +
                        `Verificação: ${bm.verification}\n` +
                        `Limite: ${bm.limit_daily}\n` +
                        `Método: ${bm.method}\n` +
                        `Preço: ${fmtBRL(bm.price)}\n\n` +
                        `Podem me passar mais informações?`;
                      window.open(`https://wa.me/5519989411105?text=${encodeURIComponent(msg)}`, "_blank");
                    }}
                  >
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

      {sellOpen && <SellBmModal onClose={() => setSellOpen(false)} />}
      {detailsBm && (
        <div className="mkt-modal-backdrop" onClick={() => setDetailsBm(null)}>
          <div className="mkt-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="mkt-modal-head">
              <div>
                <div style={{ fontSize: 11, letterSpacing: 2, color: "#D4A64F", textTransform: "uppercase" }}>Detalhes adicionais</div>
                <h3 style={{ margin: "4px 0 0", fontSize: 20 }}>{detailsBm.name}</h3>
                <div style={{ fontSize: 12, opacity: 0.6 }}>{detailsBm.country}</div>
              </div>
              <button className="mkt-modal-close" onClick={() => setDetailsBm(null)} aria-label="Fechar">×</button>
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: "18px 0 0", display: "grid", gap: 10 }}>
              {(detailsBm.details || []).map((d, i) => (
                <li key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "rgba(212,166,79,0.06)", border: "1px solid rgba(212,166,79,0.18)", borderRadius: 10, fontSize: 13, color: "#E9E6DF" }}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#D4A64F" strokeWidth="2"><path d="m5 12 5 5 9-11"/></svg>
                  {d}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function SellBmModal({ onClose }: { onClose: () => void }) {
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    seller_name: "",
    seller_whatsapp: "",
    bm_name: "",
    country: "Brasil",
    verification: "Rodada",
    limit_daily: "",
    accounts: "5",
    created_year: "2024",
    risk: "BAIXO",
    method: "Cartão",
    gasto_total: "",
    asking_price: "",
    notes: "",
  });
  const up = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.seller_name.trim() || !f.seller_whatsapp.trim() || !f.bm_name.trim() || !f.asking_price) {
      toast.error("Preencha nome, WhatsApp, nome da BM e preço.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("marketplace_bm_leads").insert({
      seller_name: f.seller_name.trim(),
      seller_whatsapp: f.seller_whatsapp.trim(),
      bm_name: f.bm_name.trim(),
      country: f.country,
      verification: f.verification,
      limit_daily: f.limit_daily,
      accounts: Number(f.accounts) || null,
      created_year: f.created_year,
      risk: f.risk,
      method: f.method,
      gasto_total: f.gasto_total ? Number(f.gasto_total) : null,
      asking_price: Number(f.asking_price),
      notes: f.notes || null,
    });
    setSaving(false);
    if (error) {
      toast.error("Erro ao enviar. Tente novamente.");
      return;
    }
    toast.success("BM enviada! Entraremos em contato pelo WhatsApp.");
    onClose();
  };

  return (
    <div className="mkt-modal-backdrop" onClick={onClose}>
      <div className="mkt-modal" onClick={e => e.stopPropagation()}>
        <button className="mkt-modal-close" onClick={onClose} aria-label="Fechar">×</button>
        <div className="mkt-modal-head">
          <span className="mkt-eyebrow" style={{ marginBottom: 8 }}>VENDA SUA BM</span>
          <h3>Envie os dados da sua BM</h3>
          <p>Nossa equipe analisa e retorna via WhatsApp com a proposta.</p>
        </div>
        <form className="mkt-form" onSubmit={submit}>
          <div className="mkt-form-grid">
            <label>Seu nome
              <input value={f.seller_name} onChange={e => up("seller_name", e.target.value)} required />
            </label>
            <label>WhatsApp
              <input value={f.seller_whatsapp} onChange={e => up("seller_whatsapp", e.target.value)} placeholder="(11) 99999-9999" required />
            </label>
            <label>Nome da BM
              <input value={f.bm_name} onChange={e => up("bm_name", e.target.value)} required />
            </label>
            <label>País
              <input value={f.country} onChange={e => up("country", e.target.value)} />
            </label>
            <label>Tipo de Verificação
              <select value={f.verification} onChange={e => up("verification", e.target.value)}>
                <option>Rodada</option>
                <option>Rodada Verificada</option>
                <option>Verificada</option>
                <option>Alta Confiança</option>
              </select>
            </label>
            <label>Limite de Gasto (diário)
              <input value={f.limit_daily} onChange={e => up("limit_daily", e.target.value)} placeholder="R$ 1.300 / dia" />
            </label>
            <label>Contas de Anúncio
              <input type="number" min="0" value={f.accounts} onChange={e => up("accounts", e.target.value)} />
            </label>
            <label>Conta Criada em
              <input value={f.created_year} onChange={e => up("created_year", e.target.value)} placeholder="2024" />
            </label>
            <label>Perfil de Risco
              <select value={f.risk} onChange={e => up("risk", e.target.value)}>
                <option>BAIXO</option>
                <option>VERIFICADA</option>
                <option>ALTO HISTÓRICO</option>
                <option>PREMIUM</option>
              </select>
            </label>
            <label>Método de Pagamento
              <input value={f.method} onChange={e => up("method", e.target.value)} />
            </label>
            <label>Gasto Total (R$)
              <input type="number" step="0.01" value={f.gasto_total} onChange={e => up("gasto_total", e.target.value)} placeholder="10000.00" />
            </label>
            <label>Quanto pede pela BM (R$) *
              <input type="number" step="0.01" value={f.asking_price} onChange={e => up("asking_price", e.target.value)} placeholder="1500.00" required />
            </label>
            <label className="mkt-form-full">Observações
              <textarea value={f.notes} onChange={e => up("notes", e.target.value)} rows={3} />
            </label>
          </div>
          <div className="mkt-form-foot">
            <button type="button" className="mkt-btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="mkt-cta" disabled={saving}>{saving ? "Enviando..." : "Enviar BM"}</button>
          </div>
        </form>
      </div>
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
.mkt-brand-mark{display:inline-flex; align-items:center; justify-content:center; width:56px; height:56px; border-radius:10px; background:linear-gradient(135deg,#131822,#0b0e14); border:1px solid var(--line); color:var(--gold); box-shadow:inset 0 1px 0 rgba(255,255,255,.05)}
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
.mkt-flag{
  width:40px; height:40px; border-radius:50%; overflow:hidden;
  display:inline-flex; align-items:center; justify-content:center;
  background:#0b0e14; border:1px solid rgba(255,255,255,.12);
  box-shadow:0 6px 18px -6px rgba(0,0,0,.6), inset 0 0 0 2px rgba(255,255,255,.03);
  flex-shrink:0;
}
.mkt-flag img{width:100%; height:100%; object-fit:cover; display:block}
.mkt-card-country{font-size:15px; font-weight:600; letter-spacing:-.01em}
.mkt-card-sub{font-size:11px; color:var(--mute); letter-spacing:.04em; margin-top:2px}
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
.mkt-card-foot{gap:8px; flex-wrap:wrap}
.mkt-price{font-size:22px; font-weight:600; letter-spacing:-.02em; color:var(--gold)}
.mkt-more-btn{
  display:inline-flex; align-items:center; gap:6px; padding:8px 12px; border-radius:9px;
  background:transparent; border:1px solid rgba(255,255,255,.12); color:#B8B4AA;
  font-size:11.5px; font-weight:500; letter-spacing:.02em; transition:all .2s ease; cursor:pointer;
}
.mkt-more-btn:hover{border-color:rgba(212,166,79,.4); color:#F5E7C6; background:rgba(212,166,79,.06)}
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

.mkt-brand-mark-img{background:transparent !important; border:0 !important; padding:0; overflow:visible; box-shadow:none !important; width:64px; height:64px}
.mkt-brand-mark-img img{width:100%; height:100%; object-fit:contain; display:block; filter:drop-shadow(0 4px 12px rgba(212,166,79,.25))}

.mkt-modal-backdrop{position:fixed; inset:0; background:rgba(3,4,7,.75); backdrop-filter:blur(10px); z-index:100; display:flex; align-items:center; justify-content:center; padding:20px; animation:fadeIn .2s ease}
.mkt-modal{position:relative; width:100%; max-width:680px; max-height:90vh; overflow-y:auto; background:linear-gradient(180deg, #0F131A, #0B0E14); border:1px solid rgba(212,166,79,.25); border-radius:24px; padding:32px; box-shadow:0 40px 100px -20px rgba(0,0,0,.8); animation:fadeUp .35s cubic-bezier(.2,.7,.2,1)}
.mkt-modal-close{position:absolute; top:16px; right:16px; width:32px; height:32px; border-radius:50%; background:rgba(255,255,255,.05); border:1px solid var(--line); color:#fff; font-size:20px; line-height:1; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; transition:all .2s}
.mkt-modal-close:hover{background:rgba(212,166,79,.15); border-color:var(--gold); color:var(--gold)}
.mkt-modal-head h3{font-size:26px; font-weight:600; letter-spacing:-.02em; margin:6px 0 8px}
.mkt-modal-head p{color:var(--mute); font-size:13px; margin:0 0 20px}
.mkt-form-grid{display:grid; grid-template-columns:1fr 1fr; gap:14px}
.mkt-form label{display:flex; flex-direction:column; gap:6px; font-size:11px; letter-spacing:.14em; color:var(--mute); text-transform:uppercase; font-weight:600}
.mkt-form-full{grid-column:1/-1}
.mkt-form input, .mkt-form select, .mkt-form textarea{background:rgba(255,255,255,.03); border:1px solid var(--line); color:#fff; border-radius:10px; padding:11px 14px; font-size:13.5px; outline:none; transition:all .25s ease; font-family:inherit; letter-spacing:normal; text-transform:none; font-weight:400}
.mkt-form input:focus, .mkt-form select:focus, .mkt-form textarea:focus{border-color:rgba(212,166,79,.5); background:rgba(212,166,79,.04)}
.mkt-form textarea{resize:vertical; min-height:70px}
.mkt-form-foot{display:flex; gap:12px; justify-content:flex-end; margin-top:24px; padding-top:20px; border-top:1px solid var(--line)}
.mkt-btn-ghost{padding:12px 22px; border-radius:12px; background:transparent; border:1px solid var(--line); color:var(--mute); font-size:13px; cursor:pointer; transition:all .2s}
.mkt-btn-ghost:hover{color:#fff; border-color:rgba(255,255,255,.2)}
@media (max-width:560px){ .mkt-form-grid{grid-template-columns:1fr} .mkt-modal{padding:22px} }
`;