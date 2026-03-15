import { useState, useEffect, useRef } from "react";

interface NewsItem {
  title: string;
  url: string;
  source: string;
  date: string;
}

const CACHE_KEY = "meta_news_cache_v2";
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

const RSS_PROXY = "https://api.rss2json.com/v1/api.json";

// Multiple Google News RSS queries in Portuguese focused on the business
const GOOGLE_NEWS_QUERIES = [
  "Meta Facebook anúncios política mudança",
  "Facebook Business Manager BM bloqueio",
  "Meta ads perfil verificação",
  "Facebook contas publicidade atualização",
  "Instagram Meta mudanças anunciantes",
];

// Brazilian tech sources with Meta-related feeds
const BR_SOURCES = [
  { url: "https://tecnoblog.net/tema/facebook/feed/", source: "Tecnoblog" },
  { url: "https://tecnoblog.net/tema/instagram/feed/", source: "Tecnoblog" },
  { url: "https://tecnoblog.net/tema/meta/feed/", source: "Tecnoblog" },
  { url: "https://www.techtudo.com.br/rssfeeds/tudo-sobre-facebook.xml", source: "TechTudo" },
];

// Keywords relevant to the business
const BUSINESS_KEYWORDS = [
  "meta", "facebook", "instagram", "whatsapp", "zuckerberg", "threads",
  "anúncio", "anuncio", "ads", "publicidade", "business manager", "bm",
  "perfil", "conta", "bloqueio", "verificação", "verificacao", "política",
  "politica", "proxy", "api", "plataforma", "moderação", "moderacao",
  "restrição", "restricao", "suspensão", "suspensao", "banimento",
];

async function fetchRSS(rssUrl: string): Promise<any[]> {
  // 1) Try rss2json free mode (without count/api_key)
  try {
    const res = await fetch(`${RSS_PROXY}?rss_url=${encodeURIComponent(rssUrl)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.status === "ok" && data.items?.length > 0) {
        return data.items;
      }
    }
  } catch {}

  // 2) Fallback: fetch raw RSS via allorigins and parse XML client-side
  try {
    const rawRes = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(rssUrl)}`);
    if (!rawRes.ok) return [];

    const xmlText = await rawRes.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");

    const nodes = Array.from(xmlDoc.querySelectorAll("item, entry"));
    return nodes.map((node) => {
      const title = node.querySelector("title")?.textContent?.trim() || "";
      const linkNode = node.querySelector("link");
      const link = linkNode?.getAttribute("href") || linkNode?.textContent?.trim() || "";
      const pubDate =
        node.querySelector("pubDate")?.textContent?.trim() ||
        node.querySelector("published")?.textContent?.trim() ||
        node.querySelector("updated")?.textContent?.trim() ||
        "";
      const description =
        node.querySelector("description")?.textContent?.trim() ||
        node.querySelector("summary")?.textContent?.trim() ||
        "";
      const categories = Array.from(node.querySelectorAll("category")).map((c) => c.textContent?.trim() || "").filter(Boolean);

      return {
        title,
        link,
        pubDate,
        description,
        categories,
      };
    }).filter((item) => item.title && item.link);
  } catch {}

  return [];
}

function isRelevant(item: any): boolean {
  const text = ((item.title || "") + " " + (item.description || "") + " " + (item.categories?.join(" ") || "")).toLowerCase();
  return BUSINESS_KEYWORDS.some(kw => text.includes(kw));
}

function parseItem(item: any, source: string): NewsItem {
  return {
    title: (item.title || "").replace(/<[^>]*>/g, "").trim(),
    url: item.link || "",
    source,
    date: item.pubDate
      ? new Date(item.pubDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
      : "",
  };
}

export function MetaNewsTicker() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNews();
  }, []);

  // Auto-scroll animation
  useEffect(() => {
    if (!scrollRef.current || news.length === 0) return;
    const el = scrollRef.current;
    let animId: number;
    let pos = 0;
    const speed = 0.5;

    const animate = () => {
      pos += speed;
      if (pos >= el.scrollWidth / 2) pos = 0;
      el.scrollLeft = pos;
      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);
    
    const handleTouch = () => cancelAnimationFrame(animId);
    const handleTouchEnd = () => { animId = requestAnimationFrame(animate); };
    
    el.addEventListener("touchstart", handleTouch);
    el.addEventListener("touchend", handleTouchEnd);

    return () => {
      cancelAnimationFrame(animId);
      el.removeEventListener("touchstart", handleTouch);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [news]);

  const fetchNews = async () => {
    // Check cache first
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { items, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL && items?.length > 0) {
          setNews(items);
          setLoading(false);
          return;
        }
      }
    } catch {}

    const allItems: NewsItem[] = [];
    const seenTitles = new Set<string>();

    const addUnique = (item: NewsItem) => {
      const key = item.title.toLowerCase().slice(0, 50);
      if (!seenTitles.has(key) && item.title.length > 10) {
        seenTitles.add(key);
        allItems.push(item);
      }
    };

    try {
      // Strategy 1: Fetch from Brazilian tech sources in parallel
      const brResults = await Promise.allSettled(
        BR_SOURCES.map(src => fetchRSS(src.url).then(items => ({ items, source: src.source })))
      );

      for (const result of brResults) {
        if (result.status === "fulfilled" && result.value.items.length > 0) {
          const relevant = result.value.items.filter(isRelevant);
          relevant.forEach((item: any) => addUnique(parseItem(item, result.value.source)));
        }
      }

      // Strategy 2: Google News RSS in Portuguese (multiple queries in parallel)
      if (allItems.length < 6) {
        const gnQueries = GOOGLE_NEWS_QUERIES.slice(0, 3); // limit to avoid rate-limiting
        const gnResults = await Promise.allSettled(
          gnQueries.map(q => {
            const gnUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
            return fetchRSS(gnUrl);
          })
        );

        for (const result of gnResults) {
          if (result.status === "fulfilled") {
            result.value.forEach((item: any) => {
              // Google News titles often have " - Source" at the end
              const rawTitle = (item.title || "").replace(/<[^>]*>/g, "").trim();
              const parts = rawTitle.split(" - ");
              const source = parts.length > 1 ? parts.pop()! : "Google News";
              const title = parts.join(" - ");
              addUnique({
                title: title || rawTitle,
                url: item.link || "",
                source,
                date: item.pubDate
                  ? new Date(item.pubDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
                  : "",
              });
            });
          }
        }
      }

      // Strategy 3: If still nothing, try about.fb.com (English fallback)
      if (allItems.length < 3) {
        const metaItems = await fetchRSS("https://about.fb.com/news/feed/");
        metaItems.slice(0, 5).forEach((item: any) => addUnique(parseItem(item, "Meta Newsroom")));
      }

      const finalItems = allItems.slice(0, 10);
      if (finalItems.length > 0) {
        setNews(finalItems);
        localStorage.setItem(CACHE_KEY, JSON.stringify({ items: finalItems, timestamp: Date.now() }));
      }
    } catch (err) {
      console.error("Failed to fetch Meta news:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-mobile-glass p-3 flex items-center gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <span className="material-symbols-outlined text-base" style={{ color: '#1877F2' }}>newsmode</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Meta News</span>
        </div>
        <div className="h-3 w-32 bg-white/5 rounded animate-pulse" />
      </div>
    );
  }

  if (news.length === 0) return null;

  // Duplicate items for seamless infinite scroll
  const duplicated = [...news, ...news];

  return (
    <section className="admin-mobile-glass overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <span className="material-symbols-outlined text-base" style={{ color: '#1877F2' }}>newsmode</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Notícias Meta & Ads</span>
        <div className="flex-1 h-px bg-white/5" />
        <span className="text-[9px] text-zinc-600 font-medium">Em tempo real</span>
      </div>

      {/* Scrolling ticker */}
      <div
        ref={scrollRef}
        className="flex gap-4 px-4 pb-3 overflow-x-auto no-scrollbar"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {duplicated.map((item, i) => (
          <a
            key={`${item.title.slice(0, 20)}-${i}`}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 max-w-[260px] p-3 rounded-xl transition-all active:scale-95"
            style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
          >
            <p className="text-[11px] font-semibold text-white leading-tight line-clamp-2 mb-2">
              {item.title}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold uppercase" style={{ color: '#1877F2' }}>{item.source}</span>
              {item.date && (
                <>
                  <span className="text-zinc-700">·</span>
                  <span className="text-[9px] text-zinc-600">{item.date}</span>
                </>
              )}
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
