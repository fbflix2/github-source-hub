import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Send, ShoppingBag, Wallet, Clock, StickyNote, Trash2, DollarSign, UserRound } from "lucide-react";
import AdjustBalanceModal from "./AdjustBalanceModal";

interface ClientHistoryModalProps {
  open: boolean;
  onClose: () => void;
  onBalanceUpdate?: () => void;
  client: {
    user_id: string;
    full_name: string | null;
    created_at: string;
    balance: number;
    avatar_url: string | null;
  } | null;
}

interface OrderItem {
  id: string;
  code: string;
  total: number;
  status: string;
  created_at: string;
  payment_method?: string | null;
}

interface WalletItem {
  id: string;
  title: string;
  amount: number;
  type: string;
  created_at: string;
}

interface NoteItem {
  id: string;
  content: string;
  created_at: string;
}

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const statusLabels: Record<string, string> = {
  completed: "Concluído",
  delivered: "Entregue",
  processing: "Processando",
  cancelled: "Cancelado",
  abandoned: "Abandonado",
};

export default function ClientHistoryModal({ open, onClose, onBalanceUpdate, client }: ClientHistoryModalProps) {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [walletTxs, setWalletTxs] = useState<WalletItem[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [totalSpent, setTotalSpent] = useState(0);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [activeTab, setActiveTab] = useState<"orders" | "wallet" | "notes">("orders");
  const [showAdjustBalance, setShowAdjustBalance] = useState(false);

  useEffect(() => {
    if (open && client) {
      fetchAll();
    }
  }, [open, client]);

  const fetchAll = async () => {
    if (!client) return;
    setLoading(true);
    const fetchAllOrders = async (): Promise<OrderItem[]> => {
      const result: OrderItem[] = [];
      const pageSize = 500;
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await supabase
          .from("orders")
          .select("id, code, total, status, created_at, payment_method")
          .eq("user_id", client.user_id)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(offset, offset + pageSize - 1);
        if (error) throw error;
        result.push(...(data ?? []));
        if (!data || data.length < pageSize) break;
      }
      return result;
    };
    const [allOrders, walletRes, notesRes, presenceRes] = await Promise.all([
      fetchAllOrders(),
      supabase
        .from("wallet_transactions")
        .select("id, title, amount, type, created_at")
        .eq("user_id", client.user_id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("client_notes")
        .select("id, content, created_at")
        .eq("user_id", client.user_id)
        .order("created_at", { ascending: false }),
      supabase
        .from("user_presence")
        .select("last_seen_at")
        .eq("user_id", client.user_id)
        .maybeSingle(),
    ]);

    const ords = allOrders;
    setOrders(ords);
    setTotalSpent(
      ords
        .filter((o) => ["completed", "delivered"].includes(o.status) && o.payment_method !== "cortesia")
        .reduce((s, o) => s + Number(o.total), 0)
    );
    setWalletTxs(walletRes.data ?? []);
    setNotes(notesRes.data ?? []);
    setLastSeenAt(presenceRes.data?.last_seen_at ?? null);
    setLoading(false);
  };

  const handleAddNote = async () => {
    if (!client || !newNote.trim()) return;
    setSavingNote(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { error } = await supabase.from("client_notes").insert({
        user_id: client.user_id,
        content: newNote.trim(),
        admin_id: user.id,
      });
      if (error) throw error;
      setNewNote("");
      toast.success("Anotação salva");
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar anotação");
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    const { error } = await supabase.from("client_notes").delete().eq("id", noteId);
    if (error) {
      toast.error("Erro ao excluir anotação");
    } else {
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    }
  };

  const clientSince = client
    ? (() => {
        const days = Math.floor((Date.now() - new Date(client.created_at).getTime()) / 86400000);
        if (days < 1) return "Hoje";
        if (days < 30) return `${days} dias`;
        if (days < 365) return `${Math.floor(days / 30)} meses`;
        return `${Math.floor(days / 365)} ano(s)`;
      })()
    : "";

  if (!client) return null;

  const tabs = [
    { key: "orders" as const, label: "Compras", icon: ShoppingBag, count: orders.length },
    { key: "wallet" as const, label: "Recargas", icon: Wallet, count: walletTxs.length },
    { key: "notes" as const, label: "Anotações", icon: StickyNote, count: notes.length },
  ];

  return (
    <>
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[100vw] max-w-[100vw] h-[100dvh] sm:h-auto sm:w-auto sm:max-w-2xl sm:max-h-[85vh] rounded-none sm:rounded-lg p-4 sm:p-6 overflow-hidden flex flex-col z-[100]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <UserRound className="size-5 text-primary" /> Perfil do Cliente
          </DialogTitle>
        </DialogHeader>

        {/* Client Summary */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl bg-muted/50 border border-border">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {client.avatar_url ? (
              <div
                className="size-14 rounded-xl bg-center bg-cover border border-border shrink-0"
                style={{ backgroundImage: `url(${client.avatar_url})` }}
              />
            ) : (
              <div className="size-14 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-xl font-bold text-primary border border-border shrink-0">
                <UserRound className="size-7 text-primary" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-foreground truncate">{client.full_name || "Sem nome"}</h3>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="size-3" /> Cliente há {clientSince}
                </span>
                <span className="flex items-center gap-1">
                  <Wallet className="size-3" /> Saldo: {formatCurrency(client.balance)}
                </span>
                <span className="flex items-center gap-1">
                  <ShoppingBag className="size-3" /> Total gasto: {formatCurrency(totalSpent)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="size-3" /> Último acesso: {lastSeenAt
                    ? new Date(lastSeenAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
                    : "Nunca"}
                </span>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAdjustBalance(true)}
            className="shrink-0 gap-1.5 w-full sm:w-auto"
          >
            <DollarSign className="size-3.5" />
            Ajustar Saldo
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="size-4" />
              {tab.label}
              <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full">{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto -mx-4 sm:-mx-6 px-4 sm:px-6 min-h-0 pb-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {activeTab === "orders" && (
                <div className="space-y-2 py-3">
                  {orders.length === 0 ? (
                    <p className="text-center text-muted-foreground text-sm py-8">Nenhuma compra encontrada.</p>
                  ) : (
                    orders.map((o) => (
                      <div key={o.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                        <div>
                          <p className="text-sm font-bold text-foreground">{o.code}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(o.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-foreground">{formatCurrency(o.total)}</p>
                          <p className={`text-[10px] font-medium uppercase ${
                            ["completed", "delivered"].includes(o.status) ? "text-green-500" :
                            o.status === "cancelled" ? "text-red-400" : "text-yellow-500"
                          }`}>
                            {statusLabels[o.status] || o.status}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === "wallet" && (
                <div className="space-y-2 py-3">
                  {walletTxs.length === 0 ? (
                    <p className="text-center text-muted-foreground text-sm py-8">Nenhuma transação encontrada.</p>
                  ) : (
                    walletTxs.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                        <div>
                          <p className="text-sm font-medium text-foreground">{tx.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(tx.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                          </p>
                        </div>
                        <span className={`text-sm font-bold ${tx.type === "credit" ? "text-green-500" : "text-red-400"}`}>
                          {tx.type === "credit" ? "+" : "-"}{formatCurrency(Math.abs(tx.amount))}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === "notes" && (
                <div className="space-y-3 py-3">
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Adicionar anotação sobre este cliente..."
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      className="min-h-[60px] text-sm resize-none"
                    />
                    <Button
                      size="icon"
                      onClick={handleAddNote}
                      disabled={savingNote || !newNote.trim()}
                      className="shrink-0 self-end"
                    >
                      {savingNote ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    </Button>
                  </div>
                  {notes.length === 0 ? (
                    <p className="text-center text-muted-foreground text-sm py-6">Nenhuma anotação ainda.</p>
                  ) : (
                    notes.map((n) => (
                      <div key={n.id} className="p-3 rounded-lg bg-muted/30 border border-border group">
                        <div className="flex justify-between items-start gap-2">
                          <p className="text-sm text-foreground whitespace-pre-wrap">{n.content}</p>
                          <button
                            onClick={() => handleDeleteNote(n.id)}
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all shrink-0"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {new Date(n.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>

    <AdjustBalanceModal
      open={showAdjustBalance}
      onClose={() => setShowAdjustBalance(false)}
      client={client}
      onUpdate={() => {
        fetchAll();
        onBalanceUpdate?.();
      }}
    />
    </>
  );
}
