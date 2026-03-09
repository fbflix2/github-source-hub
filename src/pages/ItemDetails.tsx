import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { PlatformFeedback } from "@/components/PlatformFeedback";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";

interface StockData {
  emailAcesso?: string;
  emailAlternativo?: string;
  senha?: string;
  senhaEmail?: string;
  token2fa?: string;
  cookies?: string;
  descricao?: string;
  nomePerfil?: string;
  dataNascimento?: string;
  genero?: string;
  linkDocumento?: string;
  tempoPlataforma?: string;
  statusAtual?: string;
  foto_url?: string;
  linkPerfil?: string;
  idPerfil?: string;
}

export default function ItemDetails() {
  const navigate = useNavigate();
  const { orderId, itemId } = useParams();
  const [showPassword, setShowPassword] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [itemStatus, setItemStatus] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isConfirmedOk, setIsConfirmedOk] = useState(false);
  const [loading, setLoading] = useState(true);
  const [acceptedDisclaimer, setAcceptedDisclaimer] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [disclaimerChecked, setDisclaimerChecked] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [stockItemId, setStockItemId] = useState<string | null>(null);

  const [order, setOrder] = useState<any>(null);
  const [orderItem, setOrderItem] = useState<any>(null);
  const [stockData, setStockData] = useState<StockData>({});
  const [product, setProduct] = useState<any>(null);
  const [bmLinks, setBmLinks] = useState<string[]>([]);
  const [profileLinks, setProfileLinks] = useState<string[]>(['']);
  const [allOnOneProfile, setAllOnOneProfile] = useState(false);
  const [pageRequested, setPageRequested] = useState(false);
  const [pageConfirmedByAdmin, setPageConfirmedByAdmin] = useState(false);
  const [pageName, setPageName] = useState<string | null>(null);
  const [pageReceivedByClient, setPageReceivedByClient] = useState(false);
  const [confirmingReceipt, setConfirmingReceipt] = useState(false);
  const [requestingPage, setRequestingPage] = useState(false);
  const [clientFullName, setClientFullName] = useState<string | null>(null);
  // Countdown from order created_at + 24h
  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0, seconds: 0 });
  // Warranty countdown from order created_at + 7 days
  const [warrantyCountdown, setWarrantyCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    async function fetchData() {
      if (!orderId || !itemId) { setLoading(false); return; }

      const decodedCode = decodeURIComponent(orderId);

      // Fetch order by code
      const { data: orderData } = await supabase
        .from("orders")
        .select("*")
        .eq("code", decodedCode)
        .single();

      if (!orderData) { setLoading(false); return; }
      setOrder(orderData);

      // Fetch order item
      const { data: itemData } = await supabase
        .from("order_items")
        .select("*")
        .eq("id", itemId)
        .eq("order_id", orderData.id)
        .single();

      if (!itemData) { setLoading(false); return; }
      setOrderItem(itemData);

      // Check delivery_data on order_item first
      if (itemData.delivery_data && typeof itemData.delivery_data === "object") {
        setStockData(itemData.delivery_data as StockData);
        const dd = itemData.delivery_data as any;
        if (dd.pageRequestedAt) {
          setPageRequested(true);
          if (dd.pageProfileLinks) setProfileLinks(dd.pageProfileLinks);
          if (dd.allOnOneProfile) setAllOnOneProfile(dd.allOnOneProfile);
        }
        if (dd.pageConfirmedAt) {
          setPageConfirmedByAdmin(true);
          if (dd.pageName) setPageName(dd.pageName);
        }
        if (dd.pageReceivedByClient) {
          setPageReceivedByClient(true);
        }
        // Restore disclaimer from DB
        if (dd._credentials_accessed_at) {
          setAcceptedDisclaimer(true);
        }
      }
      // Also check localStorage as fallback
      if (!acceptedDisclaimer && orderId && localStorage.getItem(`disclaimer_accepted_${decodedCode}`) === "true") {
        setAcceptedDisclaimer(true);
      }

      // Double-check page_requests table as fallback
      const { data: existingReq } = await supabase
        .from("page_requests")
        .select("id, status")
        .eq("order_item_id", itemId)
        .limit(1);
      if (existingReq && existingReq.length > 0) {
        setPageRequested(true);
        if (existingReq[0].status === 'confirmed') {
          setPageConfirmedByAdmin(true);
        }
      }

      // Fetch linked stock_item
      const { data: stockItem } = await supabase
        .from("stock_items")
        .select("*")
        .eq("order_item_id", itemId)
        .maybeSingle();

      if (stockItem) {
        setStockItemId(stockItem.id);
        if (stockItem.status === "bloqueado") setIsBlocked(true);
        if (stockItem.status === "ok") setIsConfirmedOk(true);
        const baseData = (stockItem.data && typeof stockItem.data === "object") ? stockItem.data as StockData : {} as StockData;
        // Merge top-level stock_items fields into stockData for template replacement
        if (stockItem.identification_link) baseData.linkPerfil = stockItem.identification_link;
        if (stockItem.identification) baseData.idPerfil = stockItem.identification;
        setStockData(baseData);
      }

      // Fetch product info
      if (itemData.product_id) {
        const { data: prod } = await supabase
          .from("products")
          .select("*")
          .eq("id", itemData.product_id)
          .single();
        if (prod) {
          setProduct(prod);

          // If product is BM type, fetch all BM links for this order
          if (prod.icon_type === "bm") {
            const collectedLinks: string[] = [];

            // 1. Check delivery_data.bmLinks array (new fulfillment format)
            const { data: allOrderItems } = await supabase
              .from("order_items")
              .select("id, delivery_data")
              .eq("order_id", orderData.id);

            if (allOrderItems?.length) {
              allOrderItems.forEach((oi: any) => {
                const dd = oi.delivery_data;
                if (dd && typeof dd === "object") {
                  // New format: bmLinks array
                  if (Array.isArray(dd.bmLinks)) {
                    dd.bmLinks.forEach((link: string) => {
                      const trimmed = link.trim();
                      if (trimmed) collectedLinks.push(trimmed);
                    });
                  }
                }
              });

              // 2. Fallback: fetch from stock_items identification_link
              if (collectedLinks.length === 0) {
                const itemIds = allOrderItems.map((oi: any) => oi.id);
                const { data: bmStockItems } = await supabase
                  .from("stock_items")
                  .select("identification_link")
                  .in("order_item_id", itemIds)
                  .eq("type", "bm");

                if (bmStockItems?.length) {
                  bmStockItems.forEach((s: any) => {
                    if (s.identification_link) {
                      s.identification_link.split("\n").forEach((line: string) => {
                        const trimmed = line.trim();
                        if (trimmed) collectedLinks.push(trimmed);
                      });
                    }
                  });
                }
              }

              // 3. Fallback: check delivery_data.linkPerfil
              if (collectedLinks.length === 0) {
                allOrderItems.forEach((oi: any) => {
                  const dd = oi.delivery_data;
                  if (dd && typeof dd === "object" && dd.linkPerfil) {
                    dd.linkPerfil.split("\n").forEach((line: string) => {
                      const trimmed = line.trim();
                      if (trimmed) collectedLinks.push(trimmed);
                    });
                  }
                });
              }
            }

            const unique = [...new Set(collectedLinks)];
            if (unique.length > 0) setBmLinks(unique);
          }
        }
      }

      // Calculate countdown (24h from order creation)
      const deadline = new Date(orderData.created_at).getTime() + 24 * 60 * 60 * 1000;
      const remaining = Math.max(0, deadline - Date.now());
      const totalSec = Math.floor(remaining / 1000);
      setCountdown({
        hours: Math.floor(totalSec / 3600),
        minutes: Math.floor((totalSec % 3600) / 60),
        seconds: totalSec % 60,
      });

      // Calculate warranty countdown (7 days from order creation)
      const warrantyDeadline = new Date(orderData.created_at).getTime() + 7 * 24 * 60 * 60 * 1000;
      const warrantyRemaining = Math.max(0, warrantyDeadline - Date.now());
      const wTotalSec = Math.floor(warrantyRemaining / 1000);
      setWarrantyCountdown({
        days: Math.floor(wTotalSec / 86400),
        hours: Math.floor((wTotalSec % 86400) / 3600),
        minutes: Math.floor((wTotalSec % 3600) / 60),
        seconds: wTotalSec % 60,
      });

      // Fetch client name for feedback
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profileData } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle();
        if (profileData?.full_name) setClientFullName(profileData.full_name);
      }

      setLoading(false);
    }
    fetchData();
  }, [orderId, itemId]);

  // Realtime: listen for delivery_data updates (admin confirming page)
  useEffect(() => {
    if (!itemId) return;
    const channel = supabase
      .channel(`order-item-${itemId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "order_items", filter: `id=eq.${itemId}` }, (payload) => {
        const dd = (payload.new as any).delivery_data;
        if (dd && typeof dd === "object") {
          if (dd.pageConfirmedAt && !pageConfirmedByAdmin) {
            setPageConfirmedByAdmin(true);
            if (dd.pageName) setPageName(dd.pageName);
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [itemId, pageConfirmedByAdmin]);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        let { hours, minutes, seconds } = prev;
        if (seconds > 0) seconds--;
        else if (minutes > 0) { minutes--; seconds = 59; }
        else if (hours > 0) { hours--; minutes = 59; seconds = 59; }
        return { hours, minutes, seconds };
      });
      setWarrantyCountdown(prev => {
        let { days, hours, minutes, seconds } = prev;
        if (seconds > 0) seconds--;
        else if (minutes > 0) { minutes--; seconds = 59; }
        else if (hours > 0) { hours--; minutes = 59; seconds = 59; }
        else if (days > 0) { days--; hours = 23; minutes = 59; seconds = 59; }
        return { days, hours, minutes, seconds };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const requireDisclaimer = useCallback((action: () => void) => {
    if (acceptedDisclaimer) {
      action();
    } else {
      setPendingAction(() => action);
      setShowDisclaimer(true);
    }
  }, [acceptedDisclaimer]);

  const handleDisclaimerConfirm = async () => {
    setAcceptedDisclaimer(true);
    if (orderId) {
      localStorage.setItem(`disclaimer_accepted_${orderId}`, "true");
    }
    // Persist credential access timestamp in delivery_data
    if (itemId && orderItem) {
      try {
        const currentData = (orderItem.delivery_data && typeof orderItem.delivery_data === "object")
          ? orderItem.delivery_data as Record<string, any>
          : {};
        await supabase.from("order_items").update({
          delivery_data: { ...currentData, _credentials_accessed_at: new Date().toISOString() },
        }).eq("id", itemId);
      } catch (err) {
        console.error("Failed to persist credential access:", err);
      }
    }
    setShowDisclaimer(false);
    setDisclaimerChecked(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  const totalSeconds = countdown.hours * 3600 + countdown.minutes * 60 + countdown.seconds;
  const progressPercent = (totalSeconds / (24 * 3600)) * 100;

  const formatDate = (d: string) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

  const itemName = orderItem?.name || product?.name || "Item";
  const email = stockData.emailAcesso || "—";
  const senha = stockData.senha || "—";
  const token2fa = stockData.token2fa || "—";
  const descricao = stockData.descricao || product?.description || "";
  const tags = product?.tags || [];
  const isBM = product?.icon_type === "bm";
  const isPage = product?.icon_type === "page";
  const itemQuantity = orderItem?.quantity || 1;

  const downloadBmBloco = () => {
    const content = bmLinks.map((link, i) => `BM #${i + 1}: ${link}`).join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${order?.code || "bm-links"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCookies = () => {
    if (!stockData.cookies) return;
    const blob = new Blob([stockData.cookies], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cookies_${orderItem?.id || "backup"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadBloco = async () => {
    let finalContent = "";

    // Try to fetch default template
    const { data: tpl } = await supabase
      .from("block_templates" as any)
      .select("content")
      .eq("is_default", true)
      .maybeSingle();

    if (tpl && (tpl as any).content) {
      // Use template with placeholder replacement
      const replacements: Record<string, string> = {
        "{{nomePerfil}}": stockData.nomePerfil || "—",
        "{{emailAcesso}}": email,
        "{{emailAlternativo}}": stockData.emailAlternativo || "—",
        "{{senha}}": senha,
        "{{senhaEmail}}": stockData.senhaEmail || "—",
        "{{token2fa}}": token2fa,
        "{{dataNascimento}}": stockData.dataNascimento || "—",
        "{{genero}}": stockData.genero || "—",
        "{{tempoPlataforma}}": stockData.tempoPlataforma || "—",
        "{{statusAtual}}": stockData.statusAtual || "—",
        "{{descricao}}": descricao || "—",
        "{{cookies}}": stockData.cookies || "—",
        "{{linkDocumento}}": stockData.linkDocumento || "—",
        "{{linkPerfil}}": stockData.linkPerfil || "—",
        "{{idPerfil}}": stockData.idPerfil || "—",
        "{{pedido}}": order?.code || "—",
        "{{data}}": order?.created_at ? formatDate(order.created_at) : "—",
        "{{nomeProduto}}": itemName,
      };
      finalContent = (tpl as any).content;
      for (const [key, val] of Object.entries(replacements)) {
        finalContent = finalContent.split(key).join(val);
      }
    } else {
      // Fallback to hardcoded format
      const lines = [
        `=== ${itemName} ===`,
        `Pedido: ${order?.code || "—"}`,
        `Data: ${order?.created_at ? formatDate(order.created_at) : "—"}`,
        "",
        "--- Dados de Acesso ---",
        `Login / Email: ${email}`,
        `Senha: ${senha}`,
        `Código 2FA: ${token2fa}`,
      ];
      if (stockData.emailAlternativo) lines.push(`Email Alternativo: ${stockData.emailAlternativo}`);
      if (stockData.nomePerfil) lines.push(`Nome do Perfil: ${stockData.nomePerfil}`);
      if (stockData.dataNascimento) lines.push(`Data de Nascimento: ${stockData.dataNascimento}`);
      if (stockData.genero) lines.push(`Gênero: ${stockData.genero}`);
      if (stockData.tempoPlataforma) lines.push(`Tempo de Plataforma: ${stockData.tempoPlataforma}`);
      if (stockData.statusAtual) lines.push(`Status Atual: ${stockData.statusAtual}`);
      if (descricao) { lines.push("", "--- Descrição ---", descricao); }
      if (stockData.cookies) { lines.push("", "--- Cookies ---", stockData.cookies); }
      finalContent = lines.join("\n");
    }

    const blob = new Blob([finalContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${order?.code || orderItem?.id || "item"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleToggleBlocked = async () => {
    if (!stockItemId) return;
    const newStatus = isBlocked ? "vendido" : "bloqueado";
    await supabase.from("stock_items").update({ status: newStatus }).eq("id", stockItemId);
    setIsBlocked(!isBlocked);
  };

  const handleConfirmOk = async () => {
    if (!stockItemId) return;
    await supabase.from("stock_items").update({ status: "ok" }).eq("id", stockItemId);
    setIsConfirmedOk(true);
  };

  const handleToggleStatus = async () => {
    if (!stockItemId) return;
    const newStatus = itemStatus ? "aguardando" : "revisado";
    await supabase.from("stock_items").update({ status: newStatus }).eq("id", stockItemId);
    setItemStatus(!itemStatus);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!order || !orderItem) {
    return (
      <div className="text-center py-20 space-y-4">
        <span className="material-symbols-outlined text-[48px] text-muted-foreground">error</span>
        <p className="text-muted-foreground text-lg">Item não encontrado.</p>
        <button onClick={() => navigate("/orders")} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold">
          Voltar para Pedidos
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-text-secondary mb-0.5">
            <a onClick={() => navigate("/orders")} className="hover:text-foreground transition-colors cursor-pointer">Meus Pedidos</a>
            <span className="material-symbols-outlined text-[12px]">chevron_right</span>
            <span className="text-foreground">Detalhes do Item</span>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-foreground tracking-tight">{itemName}</h1>
            {isBlocked && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-destructive/20 text-destructive border border-destructive/30 text-[10px] font-bold uppercase">
                <span className="material-symbols-outlined text-[12px]">block</span>
                Bloqueado
              </span>
            )}
          </div>
        </div>
        <button onClick={() => navigate("/orders")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-panel text-foreground hover:bg-muted/50 transition-all text-sm group">
          <span className="material-symbols-outlined text-[16px] group-hover:-translate-x-1 transition-transform">arrow_back</span>
          <span>Voltar</span>
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column */}
        <div className="lg:col-span-8 flex flex-col gap-3">
          {/* Item Details Card */}
          <div className="glass-panel rounded-xl p-4 relative overflow-hidden">
            <div className="flex justify-between items-center mb-3 pb-3 border-b border-border">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-text-secondary font-bold">Pedido</span>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-mono font-bold text-foreground">{order.code}</h2>
                  <button 
                    onClick={() => copyToClipboard(order.code, 'orderCode')} 
                    className="p-1 rounded bg-muted/50 hover:bg-muted transition-colors text-text-secondary hover:text-foreground"
                    title="Copiar código"
                  >
                    <span className="material-symbols-outlined text-[14px]">{copied === 'orderCode' ? 'check' : 'content_copy'}</span>
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-green-500/10 text-green-400 border border-green-500/20 text-[10px] font-bold uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                  {order.status === "completed" ? "Entregue" : order.status}
                </span>
                {isConfirmedOk && (
                  <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase">
                    <span className="material-symbols-outlined text-[12px]">check_circle</span>
                    Funcionando
                  </span>
                )}
                <span className="text-xs text-text-secondary">{formatDate(order.created_at)}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Description */}
              <div>
                <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-[16px]">description</span>
                  Detalhes do Item
                </h3>
                {descricao && (
                  <p className="text-text-secondary text-xs leading-relaxed mb-2 whitespace-pre-line max-h-32 overflow-y-auto">{descricao}</p>
                )}
                {tags.length > 0 && (
                  <ul className="space-y-1">
                    {tags.map((tag: string, i: number) => (
                      <li key={i} className="flex items-center gap-1.5 text-xs text-text-secondary">
                        <span className="material-symbols-outlined text-primary text-[14px]">check_circle</span>
                        <span>{tag}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Access Data */}
              <div className="bg-muted/30 rounded-lg p-3 border border-border">
                {isBM ? (
                  <>
                    <h3 className="text-[10px] font-bold text-foreground mb-2 uppercase tracking-wider">Links das BMs</h3>
                    {bmLinks.length === 0 ? (
                      <p className="text-text-secondary text-xs">Nenhum link disponível ainda.</p>
                    ) : bmLinks.length <= 3 ? (
                      <div className="space-y-2">
                        {bmLinks.map((link, i) => (
                          <div key={i}>
                            <label className="text-[10px] text-text-secondary mb-0.5 block">BM #{i + 1}</label>
                            <div className="flex items-center gap-1">
                              <code className="flex-1 bg-background/50 px-2 py-1.5 rounded border border-border text-xs font-mono text-green-400 truncate">
                                {link}
                              </code>
                              <button onClick={() => copyToClipboard(link, `bm-${i}`)} className="p-1.5 rounded bg-muted/50 hover:bg-muted transition-colors text-text-secondary hover:text-foreground">
                                <span className="material-symbols-outlined text-[14px]">{copied === `bm-${i}` ? 'check' : 'content_copy'}</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-text-secondary text-xs">{bmLinks.length} BMs neste pedido</p>
                        <button onClick={downloadBmBloco} className="w-full py-2 bg-muted/50 border border-border text-foreground font-semibold rounded-lg hover:bg-muted transition-all flex items-center justify-center gap-1.5 text-xs">
                          <span className="material-symbols-outlined text-[14px]">download</span>
                          Baixar todas as BMs ({bmLinks.length})
                        </button>
                      </div>
                    )}
                  </>
                ) : isPage ? (
                  <>
                    {pageRequested ? (
                      pageReceivedByClient ? (
                        <div className="text-center py-4 space-y-2">
                          <span className="material-symbols-outlined text-green-500 text-[32px]">verified</span>
                          <h3 className="text-sm font-bold text-foreground">Página Recebida!</h3>
                          <p className="text-xs text-muted-foreground">Você confirmou o recebimento da página{pageName ? ` "${pageName}"` : ''}. Obrigado!</p>
                        </div>
                      ) : pageConfirmedByAdmin ? (
                        <div className="space-y-3">
                          {/* Success header */}
                          <div className="text-center py-3 space-y-1">
                            <span className="material-symbols-outlined text-green-500 text-[28px]">send</span>
                            <h3 className="text-sm font-bold text-foreground">Página Enviada!</h3>
                            <p className="text-xs text-muted-foreground">
                              {pageName ? (
                                <>A página <strong className="text-foreground">"{pageName}"</strong> foi enviada para o perfil informado.</>
                              ) : (
                                <>Sua página foi enviada para o perfil informado.</>
                              )}
                            </p>
                          </div>

                          {/* Tutorial to accept */}
                          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                            <div className="flex items-start gap-2">
                              <span className="material-symbols-outlined text-primary text-[18px] mt-0.5 shrink-0">school</span>
                              <div>
                                <h3 className="text-xs font-bold text-foreground mb-1.5">Como aceitar sua página</h3>
                                <ol className="text-[11px] text-muted-foreground space-y-1.5 list-decimal list-inside">
                                  <li>Acesse o <strong className="text-foreground">Facebook</strong> e verifique o <strong className="text-foreground">sino de notificações</strong> 🔔. Procure por um convite da página{pageName ? ` "${pageName}"` : ''} e clique para aceitar.</li>
                                  <li>Se não encontrar na notificação, vá em <strong className="text-foreground">Páginas → Convites</strong> e verifique se o convite aparece lá.</li>
                                  <li>Após aceitar o convite, volte aqui e clique em <strong className="text-foreground">"Confirmar Recebimento"</strong>.</li>
                                </ol>
                              </div>
                            </div>
                          </div>

                          {/* Warning */}
                          <div className="p-2.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                            <div className="flex items-start gap-2">
                              <span className="material-symbols-outlined text-yellow-500 text-[16px] mt-0.5 shrink-0">warning</span>
                              <p className="text-[11px] text-muted-foreground">
                                Se não encontrar o convite em nenhum dos locais acima, abra um <strong className="text-foreground">chamado de suporte</strong> pelo botão no canto inferior direito.
                              </p>
                            </div>
                          </div>

                          {/* Confirm receipt button */}
                          <button
                            onClick={async () => {
                              setConfirmingReceipt(true);
                              try {
                                const { data: item } = await supabase
                                  .from("order_items")
                                  .select("delivery_data")
                                  .eq("id", itemId)
                                  .single();
                                await supabase
                                  .from("order_items")
                                  .update({
                                    delivery_data: {
                                      ...(item?.delivery_data as any || {}),
                                      pageReceivedByClient: true,
                                      pageReceivedAt: new Date().toISOString(),
                                    },
                                  })
                                  .eq("id", itemId);

                                // Mark page_request as completed so floating button disappears
                                await supabase
                                  .from("page_requests")
                                  .update({ status: "completed" })
                                  .eq("order_item_id", itemId);

                                // Notify admin via notifications table
                                const { data: { user } } = await supabase.auth.getUser();
                                const { data: profile } = await supabase
                                  .from("profiles")
                                  .select("full_name")
                                  .eq("user_id", user?.id || '')
                                  .maybeSingle();
                                const clientName = profile?.full_name || 'Cliente';
                                await supabase.from("notifications").insert({
                                  title: "✅ Página recebida pelo cliente",
                                  message: `${clientName} confirmou o recebimento da página${pageName ? ` "${pageName}"` : ''} no pedido ${order?.code || ''}.`,
                                  type: "success",
                                  global: true,
                                });

                                setPageReceivedByClient(true);
                                toast.success("Recebimento confirmado! Obrigado.");
                              } catch (err) {
                                toast.error("Erro ao confirmar recebimento.");
                              } finally {
                                setConfirmingReceipt(false);
                              }
                            }}
                            disabled={confirmingReceipt}
                            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                          >
                            {confirmingReceipt ? (
                              <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                            ) : (
                              <span className="material-symbols-outlined text-[18px]">check_circle</span>
                            )}
                            Confirmar Recebimento da Página
                          </button>
                        </div>
                      ) : (
                        <div className="text-center py-4 space-y-2">
                          <span className="material-symbols-outlined text-primary text-[32px] animate-pulse">hourglass_top</span>
                          <h3 className="text-sm font-bold text-foreground">Solicitação Enviada!</h3>
                          <p className="text-xs text-muted-foreground">Sua página está sendo preparada. Você será notificado quando a transferência for concluída.</p>
                        </div>
                      )
                    ) : (
                      <>
                        {/* Tutorial */}
                        <div className="mb-3 p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                          <div className="flex items-start gap-2">
                            <span className="material-symbols-outlined text-primary text-[18px] mt-0.5 shrink-0">school</span>
                            <div>
                              <h3 className="text-xs font-bold text-foreground mb-1">Como receber sua página</h3>
                              <ol className="text-[11px] text-text-secondary space-y-1 list-decimal list-inside">
                                <li>Informe abaixo o <strong className="text-foreground">link do perfil</strong> que deseja receber a página.</li>
                                <li>Clique em <strong className="text-foreground">"Solicitar Página"</strong> para enviar.</li>
                                <li>Aguarde a transferência — você será notificado quando concluída.</li>
                              </ol>
                            </div>
                          </div>
                        </div>

                        {/* Multiple pages option */}
                        {itemQuantity > 1 && (
                          <div className="mb-3 flex items-center gap-2">
                            <Checkbox
                              id="allOnOne"
                              checked={allOnOneProfile}
                              onCheckedChange={(v) => {
                                setAllOnOneProfile(!!v);
                                if (v) setProfileLinks([profileLinks[0] || '']);
                                else setProfileLinks(Array.from({ length: itemQuantity }, (_, i) => profileLinks[i] || ''));
                              }}
                            />
                            <label htmlFor="allOnOne" className="text-[11px] text-text-secondary cursor-pointer">
                              Receber todas as {itemQuantity} páginas em um único perfil
                            </label>
                          </div>
                        )}

                        {/* Profile link inputs */}
                        <div className="space-y-2">
                          {(itemQuantity > 1 && !allOnOneProfile ? Array.from({ length: itemQuantity }) : [0]).map((_, i) => (
                            <div key={i}>
                              <label className="text-[10px] text-text-secondary mb-0.5 block">
                                {itemQuantity > 1 && !allOnOneProfile ? `Link do Perfil — Página ${i + 1}` : 'Link do Perfil'}
                              </label>
                              <input
                                type="url"
                                placeholder="https://facebook.com/seu-perfil"
                                value={profileLinks[i] || ''}
                                onChange={(e) => {
                                  const newLinks = [...profileLinks];
                                  newLinks[i] = e.target.value;
                                  setProfileLinks(newLinks);
                                }}
                                className="w-full bg-background/50 px-2 py-1.5 rounded border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                            </div>
                          ))}
                        </div>

                        <button
                          onClick={async () => {
                            const links = profileLinks.filter(l => l.trim());
                            if (links.length === 0) return;
                            setRequestingPage(true);
                            try {
                              // Save profile links to delivery_data on order_item
                              const deliveryUpdate = {
                                ...(orderItem.delivery_data || {}),
                                pageProfileLinks: links,
                                allOnOneProfile,
                                pageRequestedAt: new Date().toISOString(),
                              };
                              await supabase.from("order_items").update({ delivery_data: deliveryUpdate }).eq("id", itemId);

                              // Get current user profile for client name
                              const { data: { user } } = await supabase.auth.getUser();
                              let clientName = null;
                              if (user) {
                                const { data: profile } = await supabase
                                  .from("profiles")
                                  .select("full_name")
                                  .eq("user_id", user.id)
                                  .maybeSingle();
                                clientName = profile?.full_name || null;
                              }

                              // Create page request for admin notification
                              await supabase.from("page_requests" as any).insert({
                                order_item_id: itemId,
                                order_code: order.code,
                                user_id: user?.id,
                                client_name: clientName,
                                product_name: itemName,
                                profile_links: links,
                                all_on_one_profile: allOnOneProfile,
                                quantity: itemQuantity,
                              });

                              setPageRequested(true);
                            } catch (err) {
                              console.error("Error requesting page:", err);
                            } finally {
                              setRequestingPage(false);
                            }
                          }}
                          disabled={requestingPage || profileLinks.every(l => !l.trim())}
                          className="w-full mt-3 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-all flex items-center justify-center gap-1.5 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {requestingPage ? (
                            <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                          ) : (
                            <span className="material-symbols-outlined text-[14px]">send</span>
                          )}
                          {requestingPage ? 'Enviando...' : 'Solicitar Página'}
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <h3 className="text-[10px] font-bold text-foreground mb-2 uppercase tracking-wider">Dados de Acesso</h3>
                    <div className="space-y-2">
                      <div>
                        <label className="text-[10px] text-text-secondary mb-0.5 block">Login / Email</label>
                        <div className="flex items-center gap-1">
                          <code className="flex-1 bg-background/50 px-2 py-1.5 rounded border border-border text-xs font-mono text-foreground truncate">{email}</code>
                          <button onClick={() => copyToClipboard(email, 'email')} className="p-1.5 rounded bg-muted/50 hover:bg-muted transition-colors text-text-secondary hover:text-foreground">
                            <span className="material-symbols-outlined text-[14px]">{copied === 'email' ? 'check' : 'content_copy'}</span>
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-text-secondary mb-0.5 block">Senha</label>
                        <div className="flex items-center gap-1">
                          <code className="flex-1 bg-background/50 px-2 py-1.5 rounded border border-border text-xs font-mono text-foreground">{showPassword ? senha : "•••••••••"}</code>
                          <button onClick={() => setShowPassword(!showPassword)} className="p-1.5 rounded bg-muted/50 hover:bg-muted transition-colors text-text-secondary hover:text-foreground">
                            <span className="material-symbols-outlined text-[14px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                          </button>
                          <button onClick={() => copyToClipboard(senha, 'password')} className="p-1.5 rounded bg-muted/50 hover:bg-muted transition-colors text-text-secondary hover:text-foreground">
                            <span className="material-symbols-outlined text-[14px]">{copied === 'password' ? 'check' : 'content_copy'}</span>
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-text-secondary mb-0.5 block">Código 2FA</label>
                        <div className="flex items-center gap-1">
                          <code className="flex-1 bg-background/50 px-2 py-1.5 rounded border border-border text-xs font-mono text-foreground">
                            {showToken ? token2fa : "•••••••••"}
                          </code>
                          <button onClick={() => requireDisclaimer(() => setShowToken(!showToken))} className="p-1.5 rounded bg-muted/50 hover:bg-muted transition-colors text-text-secondary hover:text-foreground">
                            <span className="material-symbols-outlined text-[14px]">{showToken ? 'visibility_off' : 'visibility'}</span>
                          </button>
                          <button onClick={() => requireDisclaimer(() => copyToClipboard(token2fa, '2fa'))} className="p-1.5 rounded bg-muted/50 hover:bg-muted transition-colors text-text-secondary hover:text-foreground">
                            <span className="material-symbols-outlined text-[14px]">{copied === '2fa' ? 'check' : 'content_copy'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-border flex gap-2">
                      {stockData.cookies && (
                        <button onClick={() => requireDisclaimer(() => { navigator.clipboard.writeText(stockData.cookies!); setCopied('cookies'); setTimeout(() => setCopied(null), 2000); })} className="flex-1 py-1.5 bg-muted/50 border border-border text-foreground font-semibold rounded-lg hover:bg-muted transition-all flex items-center justify-center gap-1.5 text-xs">
                          <span className="material-symbols-outlined text-[14px]">{copied === 'cookies' ? 'check' : 'cookie'}</span>
                          {copied === 'cookies' ? 'Copiado!' : 'Copiar Cookies'}
                        </button>
                      )}
                      <button onClick={() => requireDisclaimer(downloadBloco)} className="flex-1 py-1.5 bg-muted/50 border border-border text-foreground font-semibold rounded-lg hover:bg-muted transition-all flex items-center justify-center gap-1.5 text-xs">
                        <span className="material-symbols-outlined text-[14px]">download</span>
                        Baixar Bloco
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Item Management */}
          <div className="glass-panel rounded-xl p-4">
            <h3 className="text-sm font-bold text-foreground mb-3">Gerenciamento do Item</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="block text-foreground text-xs font-medium">Status do Item</span>
                    <span className="text-[10px] text-text-secondary">Marcar como bloqueado</span>
                  </div>
                  <button 
                    onClick={handleToggleBlocked} 
                    className={`relative w-10 h-5 rounded-full transition-colors ${isBlocked ? 'bg-destructive' : 'bg-muted-foreground/30'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-foreground rounded-full transition-all ${isBlocked ? 'right-0.5' : 'left-0.5'}`}></span>
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                <div>
                  <span className="block text-foreground text-xs font-medium">Funcionando?</span>
                  <span className="text-[10px] text-text-secondary">Confirme que está OK</span>
                </div>
                <button 
                  onClick={handleConfirmOk} 
                  disabled={isConfirmedOk}
                  className={`px-3 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1 text-xs ${
                    isConfirmedOk 
                      ? 'bg-green-500/30 text-green-400 border border-green-500/40 cursor-default' 
                      : 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">{isConfirmedOk ? 'check_circle' : 'thumb_up'}</span>
                  {isConfirmedOk ? 'Confirmado' : 'OK'}
                </button>
              </div>
              {/* Feedback Timer or Thank You */}
              {isConfirmedOk ? (
                <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <span className="material-symbols-outlined text-emerald-400 text-[28px] mb-1">sentiment_very_satisfied</span>
                  <p className="text-emerald-400 text-sm font-bold">Obrigado pelo feedback!</p>
                  <p className="text-emerald-400/70 text-[10px] mt-1">Você confirmou que o item está funcionando corretamente.</p>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-gradient-to-br from-muted/30 to-primary/5 border border-primary/20">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-primary text-[16px]">timer</span>
                    <span className="text-foreground text-xs font-bold">Tempo de Feedback</span>
                  </div>
                  <p className="text-[10px] text-text-secondary mb-2">24h para testar e reportar problemas.</p>
                  <div className="flex justify-center gap-2 mb-2">
                    {[
                      { val: countdown.hours, label: 'Horas' },
                      { val: countdown.minutes, label: 'Min' },
                      { val: countdown.seconds, label: 'Seg' },
                    ].map((t) => (
                      <div key={t.label} className="flex flex-col items-center">
                        <div className="w-10 h-10 rounded-lg bg-background/50 border border-border flex items-center justify-center text-base font-mono font-bold text-foreground">
                          {t.val.toString().padStart(2, '0')}
                        </div>
                        <span className="text-[8px] uppercase text-text-secondary mt-0.5">{t.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full shadow-glow transition-all duration-1000" style={{ width: `${progressPercent}%` }}></div>
                  </div>
                </div>
              )}
            </div>
            {isBlocked && (
              <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/20 border border-destructive/30 mt-2">
                <span className="material-symbols-outlined text-white text-[14px] mt-0.5 shrink-0">info</span>
                <p className="text-[10px] text-white leading-relaxed">
                  Perfis marcados como bloqueados desaparecerão da sua lista de pedidos em 7 dias, para manter tudo organizado.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-4 flex flex-col gap-3">
          {/* Warranty Timer (7 days) */}
          <div className="glass-panel rounded-xl p-4 bg-gradient-to-br from-muted/30 to-blue-500/5 border-blue-500/20">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-blue-400 text-lg">verified_user</span>
              <h3 className="text-sm font-bold text-foreground">Garantia de 7 Dias</h3>
            </div>
            <p className="text-xs text-text-secondary mb-3">Período de cobertura para reposição.</p>
            <div className="flex justify-center gap-2 mb-3">
              {[
                { val: warrantyCountdown.days, label: 'Dias' },
                { val: warrantyCountdown.hours, label: 'Horas' },
                { val: warrantyCountdown.minutes, label: 'Min' },
                { val: warrantyCountdown.seconds, label: 'Seg' },
              ].map((t) => (
                <div key={t.label} className="flex flex-col items-center">
                  <div className="w-11 h-11 rounded-lg bg-background/50 border border-border flex items-center justify-center text-lg font-mono font-bold text-foreground">
                    {t.val.toString().padStart(2, '0')}
                  </div>
                  <span className="text-[9px] uppercase text-text-secondary mt-0.5">{t.label}</span>
                </div>
              ))}
            </div>
            <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-blue-400 rounded-full transition-all duration-1000" style={{ width: `${(warrantyCountdown.days * 86400 + warrantyCountdown.hours * 3600 + warrantyCountdown.minutes * 60 + warrantyCountdown.seconds) / (7 * 86400) * 100}%` }}></div>
            </div>
          </div>

          {/* Warranty Info */}
          <div className="glass-panel rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-blue-400 text-lg">shield</span>
              <h3 className="text-sm font-bold text-foreground">Garantia de Reposição</h3>
            </div>
            <p className="text-xs text-text-secondary mb-1">Cobrimos bloqueios imediatos, falhas no login ou itens fora da descrição.</p>
            <p className="text-[10px] italic text-text-secondary/70 mb-3">Não cobrimos mau uso ou bloqueios após atividade publicitária.</p>
            <button 
              onClick={() => navigate("/tutorials")}
              className="w-full py-2 rounded-lg border border-border hover:bg-muted/50 text-foreground text-xs font-medium flex items-center justify-center gap-1.5 transition-all group"
            >
              <span className="material-symbols-outlined text-[16px] group-hover:text-primary transition-colors">play_circle</span>
              Assistir Termos de Garantia
            </button>
          </div>

          {/* Support */}
          <div className="glass-panel rounded-xl p-4">
            <h3 className="text-foreground text-sm font-bold mb-1">Precisa de Ajuda?</h3>
            <p className="text-xs text-text-secondary mb-2">Suporte online para este item.</p>
            <button 
              onClick={() => navigate(`/suporte?pedido=${encodeURIComponent(order?.code || '')}&item=${encodeURIComponent(itemName)}`)}
              className="w-full py-2 rounded-lg bg-muted/50 hover:bg-muted text-foreground border border-border transition-colors flex items-center justify-center gap-1.5 text-xs"
            >
              <span className="material-symbols-outlined text-[16px]">support_agent</span>
              Abrir Chat de Suporte
            </button>
          </div>

          {/* Platform Feedback */}
          <PlatformFeedback userName={clientFullName || undefined} />
        </div>
      </div>
      {/* Disclaimer Modal */}
      <AlertDialog open={showDisclaimer} onOpenChange={(open) => { if (!open) { setShowDisclaimer(false); setPendingAction(null); setDisclaimerChecked(false); } }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">shield</span>
              Aviso Importante
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed">
              Ao revelar o código 2FA, copiar cookies ou baixar os dados deste item, você reconhece que teve acesso completo às credenciais do perfil adquirido. A partir deste momento, estornos não serão aceitos, exceto em casos de problemas técnicos com o item que não possam ser resolvidos pelo suporte. Ao prosseguir, você declara estar ciente e de acordo com estes termos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-start gap-2 py-2">
            <Checkbox
              id="disclaimer-check"
              checked={disclaimerChecked}
              onCheckedChange={(checked) => setDisclaimerChecked(checked === true)}
            />
            <label htmlFor="disclaimer-check" className="text-xs text-muted-foreground cursor-pointer leading-relaxed">
              Li e estou ciente dos termos acima. Entendo que ao acessar estas informações, não poderei solicitar estorno.
            </label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <button
              disabled={!disclaimerChecked}
              onClick={handleDisclaimerConfirm}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Concordo e Desejo Continuar
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
