import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Check, Copy, ExternalLink, Loader2, X, Bell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PageRequest {
  id: string;
  order_item_id: string;
  order_code: string;
  user_id: string;
  client_name: string | null;
  product_name: string;
  profile_links: string[];
  all_on_one_profile: boolean;
  quantity: number;
  status: string;
  created_at: string;
}

export function PageRequestNotification() {
  const [requests, setRequests] = useState<PageRequest[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<PageRequest | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [clientEmails, setClientEmails] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const fetchRequests = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("page_requests")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Error fetching page_requests:", error);
        return;
      }
      if (data) setRequests(data as unknown as PageRequest[]);
    } catch (err) {
      console.error("Error fetching page_requests:", err);
    }
  }, []);

  // Initial fetch + polling fallback every 15s
  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 15000);
    return () => clearInterval(interval);
  }, [fetchRequests]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel("page-requests-admin")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "page_requests" },
        (payload) => {
          const newReq = payload.new as unknown as PageRequest;
          setRequests(prev => [newReq, ...prev]);
          // Auto-open the modal with the new request
          setSelectedRequest(newReq);
          setOpen(true);
          // Play sound
          try {
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = "sine";
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.3);
            osc.onended = () => ctx.close();
          } catch {}
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "page_requests" },
        () => fetchRequests()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchRequests]);

  // Fetch email for selected request
  useEffect(() => {
    if (!selectedRequest) return;
    const userId = selectedRequest.user_id;
    if (clientEmails[userId]) return;
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("list-user-emails", {
          body: { user_ids: [userId] },
        });
        if (data?.emails) {
          setClientEmails(prev => ({ ...prev, ...data.emails }));
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRequest?.user_id]);

  const handleConfirm = async (req: PageRequest) => {
    setConfirming(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase
        .from("page_requests")
        .update({
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
          confirmed_by: user?.id || null,
        })
        .eq("id", req.id);

      // Update delivery_data on order_item to mark as confirmed
      const { data: item } = await supabase
        .from("order_items")
        .select("delivery_data")
        .eq("id", req.order_item_id)
        .single();

      if (item) {
        await supabase
          .from("order_items")
          .update({
            delivery_data: {
              ...(item.delivery_data as any || {}),
              pageConfirmedAt: new Date().toISOString(),
            },
          })
          .eq("id", req.order_item_id);
      }

      toast({ title: "Página confirmada!", description: `Pedido ${req.order_code} marcado como enviado.` });
      setRequests(prev => prev.filter(r => r.id !== req.id));
      setSelectedRequest(null);
      setOpen(false);
    } catch (err) {
      toast({ title: "Erro ao confirmar", variant: "destructive" });
    } finally {
      setConfirming(false);
    }
  };

  const copyLink = (link: string, key: string) => {
    navigator.clipboard.writeText(link);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  if (requests.length === 0) return null;

  return (
    <>
      {/* Floating badge */}
      <button
        onClick={() => { setOpen(true); setSelectedRequest(requests[0] || null); }}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/30 hover:scale-105 transition-transform animate-pulse"
      >
        <Bell className="size-5" />
        <span>{requests.length} Solicitação{requests.length > 1 ? "ões" : ""} de Página</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-5 text-primary" />
              Solicitações de Página ({requests.length})
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {requests.map((req) => {
              const isSelected = selectedRequest?.id === req.id;
              const email = clientEmails[req.user_id] || "";
              return (
                <div
                  key={req.id}
                  className={`rounded-lg border p-3 cursor-pointer transition-colors ${
                    isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => setSelectedRequest(req)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-primary">{req.order_code}</span>
                    <span className="text-[10px] text-muted-foreground">{formatDate(req.created_at)}</span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-16 shrink-0">Cliente:</span>
                      <span className="font-medium text-foreground">{req.client_name || "Sem nome"}</span>
                    </div>
                    {email && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground w-16 shrink-0">Email:</span>
                        <span className="text-foreground">{email}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-16 shrink-0">Produto:</span>
                      <span className="text-foreground">{req.product_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-16 shrink-0">Qtd:</span>
                      <span className="text-foreground">{req.quantity} página{req.quantity > 1 ? "s" : ""}</span>
                    </div>
                    {req.all_on_one_profile && (
                      <span className="text-[10px] text-yellow-400 font-medium">⚠ Todas em um único perfil</span>
                    )}
                  </div>

                  {/* Profile Links */}
                  <div className="mt-2 pt-2 border-t border-border space-y-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                      Links do Perfil
                    </span>
                    {req.profile_links.map((link, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <span className="text-[10px] text-muted-foreground w-20 shrink-0">
                          {req.profile_links.length > 1 ? `Página ${i + 1}:` : "Perfil:"}
                        </span>
                        <code className="flex-1 bg-muted/50 px-2 py-1 rounded text-[11px] font-mono text-foreground truncate">
                          {link}
                        </code>
                        <button
                          onClick={(e) => { e.stopPropagation(); copyLink(link, `${req.id}-${i}`); }}
                          className="p-1 rounded hover:bg-muted transition-colors"
                          title="Copiar link"
                        >
                          {copied === `${req.id}-${i}` ? <Check className="size-3 text-green-400" /> : <Copy className="size-3 text-muted-foreground" />}
                        </button>
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1 rounded hover:bg-muted transition-colors"
                          title="Abrir link"
                        >
                          <ExternalLink className="size-3 text-muted-foreground" />
                        </a>
                      </div>
                    ))}
                  </div>

                  {/* Confirm Button */}
                  <Button
                    onClick={(e) => { e.stopPropagation(); handleConfirm(req); }}
                    disabled={confirming}
                    className="w-full mt-3"
                    size="sm"
                  >
                    {confirming && selectedRequest?.id === req.id ? (
                      <Loader2 className="size-4 animate-spin mr-1" />
                    ) : (
                      <Check className="size-4 mr-1" />
                    )}
                    Confirmar Envio da Página
                  </Button>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
