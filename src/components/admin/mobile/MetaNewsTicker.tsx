import { useState, useEffect, useRef } from "react";

interface NewsItem {
  title: string;
  url: string;
  source: string;
  date: string;
}

const CACHE_KEY = "meta_news_cache";
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

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

    try {
      // Use a public RSS-to-JSON proxy to fetch real Meta news
      const feedUrl = encodeURIComponent("https://about.fb.com/news/feed/");
      const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${feedUrl}&count=10`);
      
      if (res.ok) {
        const data = await res.json();
        if (data.status === "ok" && data.items?.length > 0) {
          const items: NewsItem[] = data.items.slice(0, 8).map((item: any) => ({
            title: item.title?.replace(/<[^>]*>/g, "").trim() || "",
            url: item.link || "",
            source: "Meta Newsroom",
            date: item.pubDate ? new Date(item.pubDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "",
          }));
          setNews(items);
          localStorage.setItem(CACHE_KEY, JSON.stringify({ items, timestamp: Date.now() }));
          setLoading(false);
          return;
        }
      }

      // Fallback: try TechCrunch Meta/Facebook news
      const tcUrl = encodeURIComponent("https://techcrunch.com/tag/meta/feed/");
      const tcRes = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${tcUrl}&count=10`);
      
      if (tcRes.ok) {
        const tcData = await tcRes.json();
        if (tcData.status === "ok" && tcData.items?.length > 0) {
          const items: NewsItem[] = tcData.items.slice(0, 8).map((item: any) => ({
            title: item.title?.replace(/<[^>]*>/g, "").trim() || "",
            url: item.link || "",
            source: "TechCrunch",
            date: item.pubDate ? new Date(item.pubDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "",
          }));
          setNews(items);
          localStorage.setItem(CACHE_KEY, JSON.stringify({ items, timestamp: Date.now() }));
          setLoading(false);
          return;
        }
      }

      // Final fallback: The Verge Meta news
      const vUrl = encodeURIComponent("https://www.theverge.com/rss/facebook/index.xml");
      const vRes = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${vUrl}&count=10`);
      
      if (vRes.ok) {
        const vData = await vRes.json();
        if (vData.status === "ok" && vData.items?.length > 0) {
          const items: NewsItem[] = vData.items.slice(0, 8).map((item: any) => ({
            title: item.title?.replace(/<[^>]*>/g, "").trim() || "",
            url: item.link || "",
            source: "The Verge",
            date: item.pubDate ? new Date(item.pubDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "",
          }));
          setNews(items);
          localStorage.setItem(CACHE_KEY, JSON.stringify({ items, timestamp: Date.now() }));
        }
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
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Notícias Meta</span>
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
            key={`${item.title}-${i}`}
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
