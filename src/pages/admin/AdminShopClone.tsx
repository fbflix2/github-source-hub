import { useState, useEffect, useCallback } from "react";
import { useShopCloneProducts, useShopCloneBalance, ShopCloneCategory, ShopCloneProduct, buyShopCloneResource, SupplierKey } from "@/hooks/useShopClone";
import { Loader2, Store, DollarSign, Package, RefreshCw, ExternalLink, Eye, Search, Clock, ShoppingCart, X, Copy, CheckCircle, Heart } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

// VND to USD rate (accface prices are in VND)
const VND_TO_USD = 1 / 25800;

/** Simple EN→PT-BR translation map for common accface product terms */
const TRANSLATIONS: [RegExp, string][] = [
  [/\bbuy\b/gi, "comprar"],
  [/\baccount\b/gi, "conta"],
  [/\baccounts\b/gi, "contas"],
  [/\bfacebook ads\b/gi, "anúncios Facebook"],
  [/\bads\b/gi, "anúncios"],
  [/\breal users\b/gi, "usuários reais"],
  [/\bfriends\b/gi, "amigos"],
  [/\brandom\b/gi, "aleatório"],
  [/\bcountry\b/gi, "país"],
  [/\bchange\b/gi, "alterar"],
  [/\bpassword\b/gi, "senha"],
  [/\bchanged\b/gi, "alterada"],
  [/\bcan be changed\b/gi, "pode ser alterado"],
  [/\bexchange currency\b/gi, "converter moeda"],
  [/\bconvertible currency\b/gi, "moeda conversível"],
  [/\bconvert currency and time zone\b/gi, "converter moeda e fuso horário"],
  [/\btime zone\b/gi, "fuso horário"],
  [/\blimit\b/gi, "limite"],
  [/\bregistration\b/gi, "registro"],
  [/\bregistered\b/gi, "registrado"],
  [/\bmonths? ago\b/gi, "meses atrás"],
  [/\bcreated\b/gi, "criado"],
  [/\bpersonal\b/gi, "pessoal"],
  [/\badvertising\b/gi, "publicidade"],
  [/\bcombo\b/gi, "combo"],
  [/\bhave\b/gi, "com"],
  [/\bday\b/gi, "dia"],
  [/\blive\b/gi, "ativo"],
  [/\bempty\b/gi, "vazio"],
  [/\bsoaked?\b/gi, "maturado"],
  [/\bsoak\b/gi, "maturar"],
  [/\bpage\b/gi, "página"],
  [/\bnew\b/gi, "novo"],
  [/\bold\b/gi, "antigo"],
  [/\bname\b/gi, "nome"],
  [/\benglish\b/gi, "inglês"],
  [/\bwarranty\b/gi, "garantia"],
  [/\bpayment required\b/gi, "pagamento necessário"],
  [/\bhidden\b/gi, "oculto"],
  [/\bappeal\b/gi, "recurso"],
  [/\breinstated\b/gi, "restabelecido"],
  [/\bdown limit\b/gi, "limite reduzido"],
  [/\btext me\b/gi, "me envie mensagem"],
  [/\blink\b/gi, "link"],
  [/\breceive\b/gi, "receber"],
  [/\border\b/gi, "pedido"],
  [/\bjust\b/gi, "acabou de"],
  [/\bhotmail\b/gi, "Hotmail"],
  [/\bclone\b/gi, "clone"],
  [/\bfarming\b/gi, "aquecimento"],
  [/\bvirtual card\b/gi, "cartão virtual"],
  [/\bkey\b/gi, "chave"],
  [/\bbest seller\b/gi, "mais vendido"],
  [/\bhot\b/gi, "quente"],
  [/\btrust\b/gi, "confiável"],
  [/\bAll money\b/gi, "todo valor"],
  [/\bChange All\b/gi, "alterar tudo"],
];

function translateText(text: string): string {
  let translated = text;
  for (const [pattern, replacement] of TRANSLATIONS) {
    translated = translated.replace(pattern, replacement);
  }
  return translated;
}

function useTimezoneComparison() {
  const [times, setTimes] = useState({ vietnam: "", brazil: "", isOpen: false });
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const vnTime = new Intl.DateTimeFormat("pt-BR", {
        timeZone: "Asia/Ho_Chi_Minh",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
      }).format(now);
      const brTime = new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
      }).format(now);
      const vnHour = parseInt(vnTime.split(":")[0]);
      setTimes({ vietnam: vnTime, brazil: brTime, isOpen: vnHour >= 9 && vnHour < 20 });
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);
  return times;
}

function useUsdToBrl() {
  const [rate, setRate] = useState(5.5);
  useEffect(() => {
    fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL")
      .then(r => r.json())
      .then(d => {
        const bid = parseFloat(d?.USDBRL?.bid);
        if (bid > 0) setRate(bid);
      })
      .catch(() => {});
  }, []);
  return rate;
}

interface BuyResult {
  raw_accounts: string[];
  saved_count: number;
  folder: string;
  productName: string;
}

const FAVORITES_KEY = "shopclone_favorites";

function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(FAVORITES_KEY);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const toggle = useCallback((id: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem(FAVORITES_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);
  return { favorites, toggle };
}

const SUPPLIER_CONFIG: Record<SupplierKey, { label: string; site: string; folderDefault: string }> = {
  accface: { label: "AccFace", site: "https://accface.com", folderDefault: "AccFace Import" },
  via17: { label: "VIA17", site: "https://via17.com", folderDefault: "VIA17 Import" },
};

export default function AdminShopClone() {
  const [supplier, setSupplier] = useState<SupplierKey>("accface");
  const config = SUPPLIER_CONFIG[supplier];

  return (
    <div className="space-y-4">
      {/* Supplier Tabs */}
      <Tabs value={supplier} onValueChange={(v) => setSupplier(v as SupplierKey)} className="w-full">
        <TabsList className="w-auto">
          <TabsTrigger value="accface" className="text-xs gap-1.5">
            <Store className="size-3.5" /> AccFace
          </TabsTrigger>
          <TabsTrigger value="via17" className="text-xs gap-1.5">
            <Store className="size-3.5" /> VIA17
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <SupplierPanel key={supplier} supplier={supplier} config={config} />
    </div>
  );
}

function SupplierPanel({ supplier, config }: { supplier: SupplierKey; config: { label: string; site: string; folderDefault: string } }) {
  const { data: categories, isLoading, error, refetch } = useShopCloneProducts(supplier);
  const { data: balance, isLoading: balanceLoading, refetch: refetchBalance } = useShopCloneBalance(supplier);
  const usdToBrl = useUsdToBrl();
  const tz = useTimezoneComparison();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [buyResult, setBuyResult] = useState<BuyResult | null>(null);
  const [viewTab, setViewTab] = useState<"all" | "favorites">("all");
  const [filter2fa, setFilter2fa] = useState<"all" | "with" | "without" | "friends">("all");
  const { favorites, toggle: toggleFavorite } = useFavorites();

  const filteredCategories = (categories || []).map((cat) => {
    let products = cat.accounts;
    if (viewTab === "favorites") {
      products = products.filter(p => favorites.has(p.id));
    }
    if (filter2fa === "with") {
      products = products.filter(p => {
        const n = p.name.toUpperCase();
        return (n.includes("2FA") && !n.includes("NO 2FA") && !n.includes("NO2FA") && !n.includes("WITHOUT 2FA"));
      });
    } else if (filter2fa === "without") {
      products = products.filter(p => {
        const n = p.name.toUpperCase();
        return n.includes("NO 2FA") || n.includes("NO2FA") || n.includes("WITHOUT 2FA") || !n.includes("2FA");
      });
    } else if (filter2fa === "friends") {
      products = products.filter(p => {
        const n = p.name.toUpperCase();
        return n.includes("FRIEND") || n.includes("AMIGO");
      });
    }
    if (search) {
      const q = search.toLowerCase();
      products = products.filter(p => p.name.toLowerCase().includes(q));
    }
    return { ...cat, accounts: products };
  }).filter(cat => {
    if (selectedCategory && cat.id !== selectedCategory) return false;
    return cat.accounts.length > 0;
  });

  const totalProducts = (categories || []).reduce((sum, c) => sum + c.accounts.length, 0);
  const totalStock = (categories || []).reduce(
    (sum, c) => sum + c.accounts.reduce((s, p) => s + (Number(p.amount) || 0), 0),
    0
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Store className="size-5 text-primary" />
            Central {config.label}
          </h1>
          <p className="text-sm text-muted-foreground">Catálogo do fornecedor {config.label}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={async () => {
            await Promise.all([refetch(), refetchBalance()]);
            toast.success("Dados atualizados com sucesso!");
          }} disabled={isLoading}>
            <RefreshCw className={`size-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <a
            href={config.site}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="size-3" />
            {config.site.replace("https://", "")}
          </a>
        </div>
      </div>

      {/* Timezone */}
      <Card className="border-dashed">
        <CardContent className="p-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Fuso Horário do Fornecedor</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">🇻🇳 Vietnã (GMT+7):</span>
              <span className="font-mono font-semibold">{tz.vietnam}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">🇧🇷 Brasil (GMT-3):</span>
              <span className="font-mono font-semibold">{tz.brazil}</span>
            </div>
            <Badge variant={tz.isOpen ? "default" : "destructive"} className="text-xs">
              {tz.isOpen ? "🟢 Atendimento aberto (9h–20h)" : "🔴 Fora do horário (9h–20h)"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <DollarSign className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Saldo no fornecedor</p>
              <p className="text-lg font-bold">
                {balanceLoading ? <Loader2 className="size-4 animate-spin" /> : balance || "—"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Package className="size-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Categorias / Produtos</p>
              <p className="text-lg font-bold">
                {isLoading ? <Loader2 className="size-4 animate-spin" /> : `${categories?.length || 0} / ${totalProducts}`}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <Eye className="size-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Itens em Estoque Total</p>
              <p className="text-lg font-bold">
                {isLoading ? <Loader2 className="size-4 animate-spin" /> : totalStock.toLocaleString("pt-BR")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View Tabs */}
      <Tabs value={viewTab} onValueChange={(v) => setViewTab(v as "all" | "favorites")} className="w-full">
        <TabsList className="w-auto">
          <TabsTrigger value="all" className="text-xs gap-1.5">
            <Package className="size-3.5" /> Todos
          </TabsTrigger>
          <TabsTrigger value="favorites" className="text-xs gap-1.5">
            <Heart className="size-3.5" /> Favoritos
            {favorites.size > 0 && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-1">{favorites.size}</Badge>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produto ou categoria..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          className="border rounded-md px-3 py-2 text-sm bg-background"
          value={filter2fa}
          onChange={(e) => setFilter2fa(e.target.value as "all" | "with" | "without" | "friends")}
        >
          <option value="all">2FA: Todos</option>
          <option value="with">Com 2FA</option>
          <option value="without">Sem 2FA</option>
          <option value="friends">Com Amigos</option>
        </select>
        <select
          className="border rounded-md px-3 py-2 text-sm bg-background"
          value={selectedCategory || ""}
          onChange={(e) => setSelectedCategory(e.target.value || null)}
        >
          <option value="">Todas categorias</option>
          {(categories || []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.accounts.length})
            </option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-lg p-3 text-sm">
          Erro ao carregar: {(error as Error).message}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      )}

      {/* Categories & Products */}
      {!isLoading && filteredCategories.map((cat) => (
        <CategorySection key={cat.id} category={cat} searchQuery={search} usdToBrl={usdToBrl} onBuyResult={setBuyResult} favorites={favorites} onToggleFavorite={toggleFavorite} supplier={supplier} folderDefault={config.folderDefault} />
      ))}

      {!isLoading && filteredCategories.length === 0 && !error && (
        <div className="text-center py-12">
          {viewTab === "favorites" ? (
            <div className="space-y-2">
              <Heart className="size-10 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground">Nenhum produto favoritado ainda.</p>
              <p className="text-xs text-muted-foreground">Clique no ❤️ ao lado de um produto para adicioná-lo aos favoritos.</p>
            </div>
          ) : (
            <p className="text-muted-foreground">Nenhum produto encontrado</p>
          )}
        </div>
      )}

      {/* Buy Result Modal */}
      <BuyResultModal result={buyResult} onClose={() => setBuyResult(null)} />
    </div>
  );
}

function BuyResultModal({ result, onClose }: { result: BuyResult | null; onClose: () => void }) {
  if (!result) return null;

  const copyAll = () => {
    navigator.clipboard.writeText(result.raw_accounts.join("\n"));
    toast.success("Dados copiados!");
  };

  return (
    <Dialog open={!!result} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="size-5 text-green-500" />
            Compra Realizada — {result.productName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 flex-1 overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-sm">
              <Badge variant="default">{result.raw_accounts.length} contas recebidas</Badge>
              <Badge variant="secondary">{result.saved_count} salvas na Blocagem</Badge>
              <span className="text-muted-foreground">Pasta: <strong>{result.folder}</strong></span>
            </div>
            <Button variant="outline" size="sm" onClick={copyAll}>
              <Copy className="size-3 mr-1" /> Copiar tudo
            </Button>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 overflow-y-auto max-h-[50vh] font-mono text-xs space-y-1">
            {result.raw_accounts.map((acc, i) => (
              <div key={i} className="flex items-start gap-2 py-1 border-b border-border/50 last:border-0">
                <span className="text-muted-foreground w-6 text-right shrink-0">{i + 1}.</span>
                <span className="break-all">{typeof acc === "string" ? acc : JSON.stringify(acc)}</span>
              </div>
            ))}
            {result.raw_accounts.length === 0 && (
              <p className="text-muted-foreground text-center py-4">Nenhuma conta retornada pela API</p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            As contas foram salvas automaticamente na pasta "<strong>{result.folder}</strong>" da Blocagem com status "aguardando" para revisão.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CategorySection({ category, searchQuery, usdToBrl, onBuyResult, favorites, onToggleFavorite, supplier, folderDefault }: { category: ShopCloneCategory; searchQuery: string; usdToBrl: number; onBuyResult: (r: BuyResult) => void; favorites: Set<string>; onToggleFavorite: (id: string) => void; supplier: SupplierKey; folderDefault: string }) {
  const [expanded, setExpanded] = useState(true);
  const q = searchQuery.toLowerCase();

  const products = q
    ? category.accounts.filter((p) => p.name.toLowerCase().includes(q))
    : category.accounts;

  if (products.length === 0 && q) return null;

  return (
    <Card>
      <CardHeader
        className="cursor-pointer py-3 px-4"
        onClick={() => setExpanded(!expanded)}
      >
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            {category.image && (
              <img src={category.image} alt="" className="size-6 rounded object-cover" />
            )}
            {category.name}
            <Badge variant="secondary" className="text-xs">{products.length} produtos</Badge>
          </span>
          <span className="text-xs text-muted-foreground">{expanded ? "▲" : "▼"}</span>
        </CardTitle>
      </CardHeader>
      {expanded && (
        <CardContent className="px-4 pb-4 pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium w-6"></th>
                  <th className="pb-2 font-medium">ID</th>
                  <th className="pb-2 font-medium">Nome</th>
                  <th className="pb-2 font-medium">País</th>
                  <th className="pb-2 font-medium text-right">Preço (USD)</th>
                  <th className="pb-2 font-medium text-right">Preço (BRL)</th>
                  <th className="pb-2 font-medium text-right">Estoque</th>
                  <th className="pb-2 font-medium text-center">Ação</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <ProductRow key={p.id} product={p} usdToBrl={usdToBrl} onBuyResult={onBuyResult} isFavorite={favorites.has(p.id)} onToggleFavorite={onToggleFavorite} supplier={supplier} folderDefault={folderDefault} />
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function ProductRow({ product, usdToBrl, onBuyResult, isFavorite, onToggleFavorite, supplier, folderDefault }: { product: ShopCloneProduct; usdToBrl: number; onBuyResult: (r: BuyResult) => void; isFavorite: boolean; onToggleFavorite: (id: string) => void; supplier: SupplierKey; folderDefault: string }) {
  const priceVnd = Number(product.price) || 0;
  const priceUsd = priceVnd * VND_TO_USD;
  const priceBrl = priceUsd * usdToBrl;
  const stock = Number(product.amount) || 0;
  const [buyQty, setBuyQty] = useState(1);
  const [buying, setBuying] = useState(false);
  const [showBuy, setShowBuy] = useState(false);

  const handleBuy = async () => {
    if (buyQty < 1 || buyQty > stock) {
      toast.error("Quantidade inválida");
      return;
    }
    setBuying(true);
    try {
      const result = await buyShopCloneResource(product.id, buyQty, product.name, folderDefault, undefined, priceBrl, supplier);
      if (result?.error || result?.status === "error") {
        toast.error("Erro na compra: " + (result.msg || result.error || result.raw || "Erro desconhecido"));
      } else {
        toast.success(`Compra realizada! ${result.saved_count || 0} contas salvas na Blocagem`);
        onBuyResult({
          raw_accounts: result.raw_accounts || [],
          saved_count: result.saved_count || 0,
          folder: result.folder || folderDefault,
          productName: product.name,
        });
      }
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || "Falha na compra"));
    } finally {
      setBuying(false);
      setShowBuy(false);
    }
  };
  
  return (
    <tr className="border-b last:border-0 hover:bg-muted/50 transition-colors">
      <td className="py-2">
        <button onClick={() => onToggleFavorite(product.id)} className="transition-colors hover:scale-110">
          <Heart className={`size-4 ${isFavorite ? "fill-red-500 text-red-500" : "text-muted-foreground hover:text-red-400"}`} />
        </button>
      </td>
      <td className="py-2 font-mono text-xs text-muted-foreground">{product.id}</td>
      <td className="py-2 max-w-xs">
        <span className="text-xs leading-tight line-clamp-2">{product.name}</span>
        <span className="text-[10px] text-primary/70 block line-clamp-2 mt-0.5 italic">
          {translateText(product.name)}
        </span>
        {product.description && product.description !== product.name && (
          <span className="text-[10px] text-muted-foreground block line-clamp-1 mt-0.5">
            {product.description}
          </span>
        )}
      </td>
      <td className="py-2">
        {product.country ? (
          <img
            src={`https://flagicons.lipis.dev/flags/4x3/${product.country.toLowerCase()}.svg`}
            alt={product.country}
            className="size-4 rounded-sm"
          />
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="py-2 text-right font-mono text-xs font-semibold">
        ${priceUsd.toFixed(2)}
      </td>
      <td className="py-2 text-right font-mono text-xs font-semibold text-primary">
        R$ {priceBrl.toFixed(2)}
      </td>
      <td className="py-2 text-right">
        <Badge
          variant={stock > 0 ? "default" : "destructive"}
          className="text-xs"
        >
          {stock.toLocaleString("pt-BR")}
        </Badge>
      </td>
      <td className="py-2 text-center">
        {!showBuy ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={stock === 0}
            onClick={() => setShowBuy(true)}
          >
            <ShoppingCart className="size-3 mr-1" />
            Comprar
          </Button>
        ) : (
          <div className="flex items-center gap-1 justify-center">
            <Input
              type="number"
              min={1}
              max={stock}
              value={buyQty}
              onChange={(e) => setBuyQty(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-14 h-7 text-xs text-center"
            />
            <Button
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={handleBuy}
              disabled={buying}
            >
              {buying ? <Loader2 className="size-3 animate-spin" /> : "OK"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-1"
              onClick={() => setShowBuy(false)}
              disabled={buying}
            >
              <X className="size-3" />
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}
