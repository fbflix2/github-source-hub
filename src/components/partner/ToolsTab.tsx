import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Link2, QrCode, Plus, Trash2, Loader2, Sparkles, Activity, ImageIcon } from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  short_code: string;
  destination_url: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  clicks: number;
  conversions: number;
  status: string;
  created_at: string;
}

interface Pixel {
  id: string;
  platform: string;
  pixel_id: string;
  access_token: string | null;
  status: string;
}

interface Creative {
  id: string;
  title: string;
  description: string | null;
  type: string;
  media_url: string | null;
  copy_text: string | null;
}

const randomCode = () => Math.random().toString(36).slice(2, 8);

export default function ToolsTab({ partnerId, partnerSlug }: { partnerId: string; partnerSlug: string }) {
  const [section, setSection] = useState<"links" | "pixels" | "creatives">("links");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [pixels, setPixels] = useState<Pixel[]>([]);
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [loading, setLoading] = useState(true);

  // New campaign form
  const [newCamp, setNewCamp] = useState({
    name: "",
    destination_url: `${window.location.origin}/parceiro/${partnerSlug}`,
    utm_source: "facebook",
    utm_medium: "cpc",
    utm_campaign: "",
    utm_content: "",
  });

  // New pixel form
  const [newPixel, setNewPixel] = useState({ platform: "facebook", pixel_id: "", access_token: "" });

  const loadAll = async () => {
    setLoading(true);
    const [c, p, cr] = await Promise.all([
      supabase.from("partner_campaigns" as any).select("*").eq("partner_id", partnerId).order("created_at", { ascending: false }),
      supabase.from("partner_pixels" as any).select("*").eq("partner_id", partnerId).order("created_at", { ascending: false }),
      supabase.from("partner_creatives" as any).select("*").eq("status", "active").order("created_at", { ascending: false }),
    ]);
    setCampaigns((c.data as any) || []);
    setPixels((p.data as any) || []);
    setCreatives((cr.data as any) || []);
    setLoading(false);
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [partnerId]);

  const createCampaign = async () => {
    if (!newCamp.name.trim() || !newCamp.destination_url.trim()) {
      toast.error("Informe nome e destino");
      return;
    }
    const short_code = randomCode();
    const { error } = await supabase.from("partner_campaigns" as any).insert({
      partner_id: partnerId,
      name: newCamp.name.trim(),
      destination_url: newCamp.destination_url.trim(),
      short_code,
      utm_source: newCamp.utm_source || null,
      utm_medium: newCamp.utm_medium || null,
      utm_campaign: newCamp.utm_campaign || null,
      utm_content: newCamp.utm_content || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Campanha criada!");
    setNewCamp({ ...newCamp, name: "", utm_campaign: "", utm_content: "" });
    loadAll();
  };

  const deleteCampaign = async (id: string) => {
    if (!confirm("Excluir campanha?")) return;
    await supabase.from("partner_campaigns" as any).delete().eq("id", id);
    loadAll();
  };

  const createPixel = async () => {
    if (!newPixel.pixel_id.trim()) { toast.error("Informe o ID do pixel"); return; }
    const { error } = await supabase.from("partner_pixels" as any).insert({
      partner_id: partnerId,
      platform: newPixel.platform,
      pixel_id: newPixel.pixel_id.trim(),
      access_token: newPixel.access_token.trim() || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Pixel salvo");
    setNewPixel({ platform: "facebook", pixel_id: "", access_token: "" });
    loadAll();
  };

  const deletePixel = async (id: string) => {
    if (!confirm("Remover pixel?")) return;
    await supabase.from("partner_pixels" as any).delete().eq("id", id);
    loadAll();
  };

  const shortUrl = (code: string) => `${window.location.origin}/c/${code}`;

  const copy = (txt: string) => {
    navigator.clipboard.writeText(txt);
    toast.success("Copiado!");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b border-[#2A2A2A]">
        {([
          { key: "links", label: "Encurtador + UTM", icon: Link2 },
          { key: "pixels", label: "Pixels de rastreio", icon: Activity },
          { key: "creatives", label: "Criativos & Copys", icon: Sparkles },
        ] as const).map(s => (
          <button
            key={s.key}
            onClick={() => setSection(s.key)}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 -mb-px ${
              section === s.key ? "text-primary border-primary" : "text-slate-500 border-transparent hover:text-slate-300"
            }`}
          >
            <s.icon className="size-4" />
            {s.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-slate-400 text-sm"><Loader2 className="size-4 animate-spin" /> Carregando…</div>
      )}

      {!loading && section === "links" && (
        <div className="space-y-5">
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-5">
            <h3 className="font-bold text-white text-sm uppercase tracking-wider mb-4">Nova campanha</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <input className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white" placeholder="Nome (ex: Insta Bio)" value={newCamp.name} onChange={e => setNewCamp({ ...newCamp, name: e.target.value })} />
              <input className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white" placeholder="Destino (URL)" value={newCamp.destination_url} onChange={e => setNewCamp({ ...newCamp, destination_url: e.target.value })} />
              <input className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white" placeholder="utm_source" value={newCamp.utm_source} onChange={e => setNewCamp({ ...newCamp, utm_source: e.target.value })} />
              <input className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white" placeholder="utm_medium" value={newCamp.utm_medium} onChange={e => setNewCamp({ ...newCamp, utm_medium: e.target.value })} />
              <input className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white" placeholder="utm_campaign" value={newCamp.utm_campaign} onChange={e => setNewCamp({ ...newCamp, utm_campaign: e.target.value })} />
              <input className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white" placeholder="utm_content (opcional)" value={newCamp.utm_content} onChange={e => setNewCamp({ ...newCamp, utm_content: e.target.value })} />
            </div>
            <button onClick={createCampaign} className="mt-4 inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-black font-bold uppercase text-xs tracking-wider px-4 py-2 rounded-lg">
              <Plus className="size-4" /> Criar link curto
            </button>
          </div>

          <div className="bg-[#12141A] border border-[#2A2A2A] rounded-xl p-5 text-sm text-slate-300 space-y-3">
            <h3 className="font-bold text-white text-sm uppercase tracking-wider flex items-center gap-2">
              <Link2 className="size-4 text-primary" /> Como usar o encurtador + UTM
            </h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              UTMs são "etiquetas" coladas no final do seu link. Elas dizem para o painel <strong className="text-white">de onde</strong> veio cada clique e cada venda — assim você sabe qual post, anúncio ou story está realmente faturando.
            </p>
            <ol className="space-y-2 text-xs text-slate-300 list-decimal list-inside">
              <li><strong className="text-white">Nome</strong>: apelido só para você (ex: "Bio Insta", "Story 25/06", "Anúncio FB BM").</li>
              <li><strong className="text-white">Destino (URL)</strong>: cole o link do produto ou da loja que quer divulgar (ex: <span className="font-mono text-primary">https://fbflix.com.br/loja</span>).</li>
              <li><strong className="text-white">utm_source</strong>: <em>onde</em> o link foi postado. Ex: <span className="font-mono">instagram</span>, <span className="font-mono">facebook</span>, <span className="font-mono">whatsapp</span>, <span className="font-mono">youtube</span>.</li>
              <li><strong className="text-white">utm_medium</strong>: <em>tipo</em> de tráfego. Ex: <span className="font-mono">bio</span>, <span className="font-mono">story</span>, <span className="font-mono">cpc</span> (anúncio pago), <span className="font-mono">grupo</span>.</li>
              <li><strong className="text-white">utm_campaign</strong>: nome da campanha. Ex: <span className="font-mono">black-friday</span>, <span className="font-mono">lancamento-bm</span>.</li>
              <li><strong className="text-white">utm_content</strong> (opcional): para diferenciar criativos. Ex: <span className="font-mono">video-1</span>, <span className="font-mono">banner-vermelho</span>.</li>
            </ol>
            <div className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg p-3 text-[11px] text-slate-400">
              <p className="text-white font-semibold mb-1">Exemplo prático</p>
              <p>Você vai postar na bio do Instagram um link para a loja:</p>
              <ul className="mt-1 space-y-0.5">
                <li>• <strong>Nome</strong>: Bio Insta Junho</li>
                <li>• <strong>Destino</strong>: https://fbflix.com.br/loja</li>
                <li>• <strong>utm_source</strong>: instagram</li>
                <li>• <strong>utm_medium</strong>: bio</li>
                <li>• <strong>utm_campaign</strong>: junho-2026</li>
              </ul>
              <p className="mt-2">Clique em <strong className="text-primary">Criar link curto</strong> → copie o link gerado → cole na sua bio. Pronto: todo clique e venda vai aparecer rastreado em <strong className="text-white">Jornada</strong>.</p>
            </div>
            <p className="text-[11px] text-slate-500">💡 Dica: crie um link diferente para cada lugar onde divulgar. Assim você descobre o que mais converte e foca seu esforço lá.</p>
          </div>

          {campaigns.length === 0 && (
            <p className="text-slate-500 text-sm">Nenhuma campanha criada ainda.</p>
          )}

          <div className="grid gap-3">
            {campaigns.map(c => (
              <div key={c.id} className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-white text-sm truncate">{c.name}</span>
                      <span className="text-[10px] uppercase tracking-wider bg-primary/15 text-primary px-2 py-0.5 rounded">{c.utm_source || "—"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Link2 className="size-3 shrink-0" />
                      <span className="font-mono truncate">{shortUrl(c.short_code)}</span>
                      <button onClick={() => copy(shortUrl(c.short_code))} className="text-primary hover:text-primary/80 shrink-0"><Copy className="size-3" /></button>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-1">→ {c.destination_url}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs text-slate-500 uppercase tracking-wider">Cliques</p>
                      <p className="font-bold text-white">{c.clicks}</p>
                    </div>
                    <a target="_blank" rel="noreferrer" href={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(shortUrl(c.short_code))}`} className="size-10 rounded-lg bg-[#0A0A0A] border border-[#2A2A2A] flex items-center justify-center text-primary hover:border-primary/40" title="QR Code">
                      <QrCode className="size-4" />
                    </a>
                    <button onClick={() => deleteCampaign(c.id)} className="size-10 rounded-lg bg-[#0A0A0A] border border-[#2A2A2A] flex items-center justify-center text-red-400 hover:border-red-500/40"><Trash2 className="size-4" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && section === "pixels" && (
        <div className="space-y-5">
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-5">
            <h3 className="font-bold text-white text-sm uppercase tracking-wider mb-4">Adicionar pixel</h3>
            <div className="grid sm:grid-cols-3 gap-3">
              <select className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white" value={newPixel.platform} onChange={e => setNewPixel({ ...newPixel, platform: e.target.value })}>
                <option value="facebook">Facebook / Meta</option>
                <option value="google">Google Tag</option>
                <option value="tiktok">TikTok</option>
              </select>
              <input className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white" placeholder="ID do pixel" value={newPixel.pixel_id} onChange={e => setNewPixel({ ...newPixel, pixel_id: e.target.value })} />
              <input className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white" placeholder="Token de API (opcional)" value={newPixel.access_token} onChange={e => setNewPixel({ ...newPixel, access_token: e.target.value })} />
            </div>
            <button onClick={createPixel} className="mt-4 inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-black font-bold uppercase text-xs tracking-wider px-4 py-2 rounded-lg">
              <Plus className="size-4" /> Salvar pixel
            </button>
          </div>

          {pixels.length === 0 && <p className="text-slate-500 text-sm">Nenhum pixel cadastrado.</p>}
          <div className="grid gap-3">
            {pixels.map(p => (
              <div key={p.id} className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider bg-primary/15 text-primary px-2 py-0.5 rounded">{p.platform}</span>
                    <span className="font-mono text-white text-sm">{p.pixel_id}</span>
                  </div>
                  {p.access_token && <p className="text-[11px] text-slate-500 mt-1">Token API configurado</p>}
                </div>
                <button onClick={() => deletePixel(p.id)} className="size-10 rounded-lg bg-[#0A0A0A] border border-[#2A2A2A] flex items-center justify-center text-red-400 hover:border-red-500/40"><Trash2 className="size-4" /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && section === "creatives" && (
        <div>
          {creatives.length === 0 && (
            <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-8 text-center">
              <ImageIcon className="size-10 mx-auto text-slate-600 mb-3" />
              <p className="text-slate-400 text-sm">Em breve nossa biblioteca de criativos e copys prontas estará disponível aqui.</p>
            </div>
          )}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {creatives.map(cr => (
              <div key={cr.id} className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl overflow-hidden">
                {cr.media_url && cr.type === "image" && (
                  <div className="w-full bg-[#0A0A0A] flex items-center justify-center">
                    <img src={cr.media_url} alt={cr.title} className="w-full h-auto object-contain" />
                  </div>
                )}
                <div className="p-4">
                  <p className="font-bold text-white text-sm">{cr.title}</p>
                  {cr.description && <p className="text-xs text-slate-400 mt-1">{cr.description}</p>}
                  {cr.copy_text && (
                    <div className="mt-3">
                      <p className="text-[10px] uppercase text-slate-500 tracking-wider mb-1">Copy</p>
                      <p className="text-xs text-slate-300 whitespace-pre-wrap bg-[#0A0A0A] border border-[#2A2A2A] rounded p-2">{cr.copy_text}</p>
                      <button onClick={() => copy(cr.copy_text!)} className="mt-2 inline-flex items-center gap-1 text-primary text-xs font-bold uppercase"><Copy className="size-3" /> Copiar</button>
                    </div>
                  )}
                  {cr.media_url && (
                    <a href={cr.media_url} download className="mt-3 inline-flex items-center gap-1 text-primary text-xs font-bold uppercase">Baixar mídia</a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}