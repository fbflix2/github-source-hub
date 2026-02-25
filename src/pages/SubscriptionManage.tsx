import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useProxyBRSubscriptions, useExchangeProxy, useRenewSubscription } from "@/hooks/useProxyBR";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { differenceInDays, parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { ProxySubscription } from "@/pages/Subscriptions";

function getStatusInfo(sub: ProxySubscription) {
  if (!sub.end_date) return { status: "active" as const, label: "Ativo", color: "green" };
  const now = new Date();
  const endDate = parseISO(sub.end_date);
  const daysLeft = differenceInDays(endDate, now);
  if (sub.status === "cancelled") return { status: "cancelled" as const, label: "Cancelado", color: "gray" };
  if (daysLeft < 0) return { status: "expired" as const, label: "Expirado", color: "gray" };
  if (daysLeft <= 3) return { status: "expiring" as const, label: "Vencendo", color: "red" };
  return { status: "active" as const, label: "Ativo", color: "green" };
}

export default function SubscriptionManage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { data: subscriptions, isLoading } = useProxyBRSubscriptions();
  const exchangeMutation = useExchangeProxy();
  const renewMutation = useRenewSubscription();

  const [newProxyId, setNewProxyId] = useState("");
  const [note, setNote] = useState("");
  const [notes, setNotes] = useState<{ text: string; date: string }[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const sub = (subscriptions as ProxySubscription[] | undefined)?.find((s) => s.code === code);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in py-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[400px] w-full rounded-2xl" />
      </div>
    );
  }

  if (!sub) {
    return (
      <div className="flex flex-col items-center justify-center py-24 animate-fade-in">
        <span className="material-symbols-outlined text-[48px] text-text-secondary mb-4">search_off</span>
        <p className="text-foreground font-bold text-lg">Assinatura não encontrada</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/subscriptions")}>
          Voltar
        </Button>
      </div>
    );
  }

  const { status, label, color } = getStatusInfo(sub);
  const endDate = sub.end_date ? parseISO(sub.end_date) : new Date();
  const startDate = sub.start_date ? parseISO(sub.start_date) : new Date();
  const daysLeft = Math.max(0, differenceInDays(endDate, new Date()));
  const totalDays = differenceInDays(endDate, startDate);
  const elapsed = totalDays - daysLeft;
  const progress = totalDays > 0 ? Math.min(100, Math.max(0, (elapsed / totalDays) * 100)) : 0;

  const handleExchange = () => {
    const id = parseInt(newProxyId);
    if (isNaN(id)) return;
    exchangeMutation.mutate(
      { subscriptionCode: sub.code, proxy_id: id },
      { onSuccess: () => setNewProxyId("") }
    );
  };

  const handleAddNote = () => {
    if (!note.trim()) return;
    setNotes((prev) => [{ text: note.trim(), date: new Date().toISOString() }, ...prev]);
    setNote("");
    toast.success("Nota adicionada!");
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copiado!");
    setTimeout(() => setCopiedField(null), 2000);
  };

  const statusBadge = {
    active: "bg-green-500/10 text-green-500 border-green-500/20",
    expiring: "bg-danger/10 text-danger border-danger/20",
    expired: "bg-muted text-text-secondary border-border",
    cancelled: "bg-muted text-text-secondary border-border",
  }[status];

  return (
    <div className="space-y-3 animate-fade-in pb-4">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/subscriptions")}
          className="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center text-text-secondary hover:text-foreground hover:border-foreground transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        </button>
        <div className="flex-1 flex items-center gap-3 flex-wrap">
          <h1 className="text-lg font-black text-foreground tracking-tight">{sub.name || sub.code}</h1>
          <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-md border ${statusBadge}`}>
            {label}
          </span>
          {sub.product_name && (
            <span className="text-text-secondary text-xs flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">dns</span>
              {sub.product_name}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-3">
          {/* Period */}
          <div className="glass-card rounded-xl p-4 space-y-3">
            <h2 className="text-foreground font-bold text-sm flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-base">schedule</span>
              Período da Assinatura
            </h2>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Início", value: format(startDate, "dd MMM yyyy", { locale: ptBR }) },
                { label: "Vencimento", value: format(endDate, "dd MMM yyyy", { locale: ptBR }) },
                { label: "Dias Restantes", value: String(daysLeft), highlight: true },
                { label: "Progresso", value: `${Math.round(progress)}%` },
              ].map((item) => (
                <div key={item.label} className="bg-muted/50 rounded-lg p-2.5 border border-border">
                  <p className="text-text-secondary text-[10px] uppercase tracking-wider font-semibold">{item.label}</p>
                  <p className={`font-bold text-sm mt-0.5 ${item.highlight ? (status === "expiring" ? "text-danger" : "text-green-500") : "text-foreground"}`}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
            <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${status === "expiring" ? "bg-danger" : "bg-green-500"}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            {(status === "expiring" || status === "expired") && (
              <Button size="sm" onClick={() => renewMutation.mutate(sub.code)} disabled={renewMutation.isPending} className="bg-primary hover:bg-[#00c968] text-background font-bold text-xs">
                <span className="material-symbols-outlined mr-1 text-sm">replay</span>
                {renewMutation.isPending ? "Renovando..." : "Renovar"}
              </Button>
            )}
          </div>

          {/* Proxy Details */}
          {sub.proxy && (
            <div className="glass-card rounded-xl p-4 space-y-3">
              <h2 className="text-foreground font-bold text-sm flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-base">vpn_key</span>
                Dados do Proxy
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { label: "Endereço IP", value: sub.proxy.ip, key: "ip" },
                  { label: "Porta", value: String(sub.proxy.port), key: "port" },
                  { label: "Usuário", value: sub.proxy.username || "—", key: "user" },
                  { label: "Senha", value: sub.proxy.password || "—", key: "pass" },
                  { label: "Protocolo", value: sub.proxy.protocol || "SOCKS5", key: "proto" },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border border-border group">
                    <div className="min-w-0">
                      <p className="text-text-secondary text-[9px] uppercase tracking-wider font-semibold">{item.label}</p>
                      <p className="text-foreground font-mono font-medium text-xs mt-0.5 truncate">{item.value}</p>
                    </div>
                    {item.value !== "—" && (
                      <button onClick={() => copyToClipboard(item.value, item.key)} className="opacity-0 group-hover:opacity-100 transition-opacity text-text-secondary hover:text-foreground ml-1 shrink-0">
                        <span className="material-symbols-outlined text-sm">{copiedField === item.key ? "check" : "content_copy"}</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="glass-card rounded-xl p-4 space-y-2">
            <h2 className="text-foreground font-bold text-sm flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-base">sticky_note_2</span>
              Notas
            </h2>
            <div className="flex gap-2">
              <Input placeholder="Adicionar uma nota..." value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddNote()} className="bg-muted border-border text-foreground h-8 text-xs" />
              <Button size="sm" onClick={handleAddNote} disabled={!note.trim()} className="bg-primary hover:bg-[#00c968] text-background font-bold shrink-0 text-xs h-8">Salvar</Button>
            </div>
            {notes.length === 0 ? (
              <p className="text-text-secondary text-xs text-center py-3">Nenhuma nota adicionada ainda.</p>
            ) : (
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {notes.map((n, i) => (
                  <div key={i} className="p-2 rounded-lg bg-muted/50 border border-border group/note">
                    {editingIndex === i ? (
                      <div className="flex gap-1.5">
                        <Input value={editText} onChange={(e) => setEditText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { setNotes(prev => prev.map((x, j) => j === i ? { ...x, text: editText } : x)); setEditingIndex(null); toast.success("Nota atualizada!"); } if (e.key === "Escape") setEditingIndex(null); }} className="bg-muted border-border text-foreground h-7 text-xs flex-1" autoFocus />
                        <Button size="sm" className="h-7 text-[10px] bg-primary text-background" onClick={() => { setNotes(prev => prev.map((x, j) => j === i ? { ...x, text: editText } : x)); setEditingIndex(null); toast.success("Nota atualizada!"); }}>OK</Button>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-foreground text-xs">{n.text}</p>
                          <p className="text-text-secondary text-[9px] mt-0.5">{format(parseISO(n.date), "dd/MM/yyyy HH:mm")}</p>
                        </div>
                        <button onClick={() => { setEditingIndex(i); setEditText(n.text); }} className="opacity-0 group-hover/note:opacity-100 transition-opacity text-text-secondary hover:text-foreground shrink-0 mt-0.5">
                          <span className="material-symbols-outlined text-sm">edit</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-3">
          {/* Info */}
          <div className="glass-card rounded-xl p-4 space-y-2">
            <h2 className="text-foreground font-bold text-sm flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-base">info</span>
              Informações
            </h2>
            <div className="space-y-1.5">
              {[
                { label: "Código", value: sub.code, mono: true },
                { label: "Status", value: label, className: status === "active" ? "text-green-500 font-bold" : status === "expiring" ? "text-danger font-bold" : "text-text-secondary" },
                ...(sub.product_name ? [{ label: "Produto", value: sub.product_name }] : []),
                ...(sub.proxy?.protocol ? [{ label: "Protocolo", value: sub.proxy.protocol }] : []),
              ].map((item) => (
                <div key={item.label} className="flex justify-between text-xs">
                  <span className="text-text-secondary">{item.label}</span>
                  <span className={`${'mono' in item && item.mono ? 'font-mono' : ''} ${'className' in item ? item.className : 'text-foreground font-medium'} text-right max-w-[160px]`}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Exchange */}
          <div className="glass-card rounded-xl p-4 space-y-2">
            <h2 className="text-foreground font-bold text-sm flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-base">swap_horiz</span>
              Trocar Proxy
            </h2>
            <p className="text-text-secondary text-[10px]">Insira o ID do novo proxy. A troca é imediata.</p>
            <div className="flex gap-2">
              <Input placeholder="ID do novo proxy" value={newProxyId} onChange={(e) => setNewProxyId(e.target.value)} className="bg-muted border-border text-foreground h-8 text-xs" />
              <Button size="sm" onClick={handleExchange} disabled={!newProxyId || exchangeMutation.isPending} className="bg-primary hover:bg-[#00c968] text-background font-bold shrink-0 text-xs h-8">
                {exchangeMutation.isPending ? "..." : "Trocar"}
              </Button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="glass-card rounded-xl p-4 space-y-1.5">
            <h2 className="text-foreground font-bold text-sm flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-base">bolt</span>
              Ações Rápidas
            </h2>
            {sub.proxy && (
              <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs h-8" onClick={() => copyToClipboard(`${sub.proxy!.ip}:${sub.proxy!.port}:${sub.proxy!.username || ""}:${sub.proxy!.password || ""}`, "quick-conn")}>
                <span className="material-symbols-outlined text-sm">content_copy</span>Copiar String de Conexão
              </Button>
            )}
            <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs h-8" onClick={() => navigate("/suporte")}>
              <span className="material-symbols-outlined text-sm">support_agent</span>Abrir Suporte
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs h-8" onClick={() => navigate("/loja?filter=Proxy")}>
              <span className="material-symbols-outlined text-sm">shopping_cart</span>Contratar Mais Proxies
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
