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
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Back + Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/subscriptions")}
          className="w-10 h-10 rounded-xl bg-muted border border-border flex items-center justify-center text-text-secondary hover:text-foreground hover:border-foreground transition-all"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">{sub.name || sub.code}</h1>
            <span className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-md border ${statusBadge}`}>
              {label}
            </span>
          </div>
          {sub.product_name && (
            <p className="text-text-secondary text-sm mt-1 flex items-center gap-2">
              <span className="material-symbols-outlined text-base">dns</span>
              {sub.product_name}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status & Progress */}
          <div className="glass-card rounded-2xl p-6 space-y-5">
            <h2 className="text-foreground font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">schedule</span>
              Período da Assinatura
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-muted/50 rounded-xl p-4 border border-border">
                <p className="text-text-secondary text-xs uppercase tracking-wider font-semibold">Início</p>
                <p className="text-foreground font-bold mt-1">{format(startDate, "dd MMM yyyy", { locale: ptBR })}</p>
              </div>
              <div className="bg-muted/50 rounded-xl p-4 border border-border">
                <p className="text-text-secondary text-xs uppercase tracking-wider font-semibold">Vencimento</p>
                <p className="text-foreground font-bold mt-1">{format(endDate, "dd MMM yyyy", { locale: ptBR })}</p>
              </div>
              <div className="bg-muted/50 rounded-xl p-4 border border-border">
                <p className="text-text-secondary text-xs uppercase tracking-wider font-semibold">Dias Restantes</p>
                <p className={`font-bold text-xl mt-1 ${status === "expiring" ? "text-danger" : "text-green-500"}`}>
                  {daysLeft}
                </p>
              </div>
              <div className="bg-muted/50 rounded-xl p-4 border border-border">
                <p className="text-text-secondary text-xs uppercase tracking-wider font-semibold">Progresso</p>
                <p className="text-foreground font-bold text-xl mt-1">{Math.round(progress)}%</p>
              </div>
            </div>

            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${status === "expiring" ? "bg-danger" : "bg-green-500"}`}
                style={{ width: `${progress}%` }}
              />
            </div>

            {(status === "expiring" || status === "expired") && (
              <Button
                onClick={() => renewMutation.mutate(sub.code)}
                disabled={renewMutation.isPending}
                className="bg-primary hover:bg-[#00c968] text-background font-bold"
              >
                <span className="material-symbols-outlined mr-1">replay</span>
                {renewMutation.isPending ? "Renovando..." : "Renovar Assinatura"}
              </Button>
            )}
          </div>

          {/* Proxy Details */}
          {sub.proxy && (
            <div className="glass-card rounded-2xl p-6 space-y-4">
              <h2 className="text-foreground font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">vpn_key</span>
                Dados do Proxy
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: "Endereço IP", value: sub.proxy.ip, key: "ip" },
                  { label: "Porta", value: String(sub.proxy.port), key: "port" },
                  { label: "Usuário", value: sub.proxy.username || "—", key: "user" },
                  { label: "Senha", value: sub.proxy.password || "—", key: "pass" },
                  { label: "Protocolo", value: sub.proxy.protocol || "SOCKS5", key: "proto" },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border group"
                  >
                    <div>
                      <p className="text-text-secondary text-[11px] uppercase tracking-wider font-semibold">{item.label}</p>
                      <p className="text-foreground font-mono font-medium text-sm mt-0.5">{item.value}</p>
                    </div>
                    {item.value !== "—" && (
                      <button
                        onClick={() => copyToClipboard(item.value, item.key)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-text-secondary hover:text-foreground"
                      >
                        <span className="material-symbols-outlined text-lg">
                          {copiedField === item.key ? "check" : "content_copy"}
                        </span>
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Full connection string */}
              <div className="p-3 rounded-xl bg-muted/50 border border-border group">
                <p className="text-text-secondary text-[11px] uppercase tracking-wider font-semibold mb-1">String de Conexão</p>
                <div className="flex items-center justify-between gap-2">
                  <code className="text-foreground font-mono text-xs break-all">
                    {sub.proxy.ip}:{sub.proxy.port}:{sub.proxy.username || ""}:{sub.proxy.password || ""}
                  </code>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `${sub.proxy!.ip}:${sub.proxy!.port}:${sub.proxy!.username || ""}:${sub.proxy!.password || ""}`,
                        "conn"
                      )
                    }
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-text-secondary hover:text-foreground shrink-0"
                  >
                    <span className="material-symbols-outlined text-lg">
                      {copiedField === "conn" ? "check" : "content_copy"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="glass-card rounded-2xl p-6 space-y-4">
            <h2 className="text-foreground font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">sticky_note_2</span>
              Notas
            </h2>

            <div className="flex gap-2">
              <Input
                placeholder="Adicionar uma nota sobre este proxy..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
                className="bg-muted border-border text-foreground"
              />
              <Button
                onClick={handleAddNote}
                disabled={!note.trim()}
                className="bg-primary hover:bg-[#00c968] text-background font-bold shrink-0"
              >
                Salvar
              </Button>
            </div>

            {notes.length === 0 ? (
              <div className="text-center py-8">
                <span className="material-symbols-outlined text-[32px] text-text-secondary mb-2">note_stack</span>
                <p className="text-text-secondary text-sm">Nenhuma nota adicionada ainda.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {notes.map((n, i) => (
                  <div key={i} className="p-3 rounded-xl bg-muted/50 border border-border">
                    <p className="text-foreground text-sm">{n.text}</p>
                    <p className="text-text-secondary text-[10px] mt-1">
                      {format(parseISO(n.date), "dd/MM/yyyy HH:mm")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Actions */}
        <div className="space-y-6">
          {/* Quick Info */}
          <div className="glass-card rounded-2xl p-6 space-y-4">
            <h2 className="text-foreground font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">info</span>
              Informações
            </h2>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Código</span>
                <span className="text-foreground font-mono font-medium">{sub.code}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Status</span>
                <span className={`font-bold ${status === "active" ? "text-green-500" : status === "expiring" ? "text-danger" : "text-text-secondary"}`}>
                  {label}
                </span>
              </div>
              {sub.product_name && (
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Produto</span>
                  <span className="text-foreground font-medium text-right max-w-[180px]">{sub.product_name}</span>
                </div>
              )}
              {sub.proxy?.protocol && (
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Protocolo</span>
                  <span className="text-foreground font-medium">{sub.proxy.protocol}</span>
                </div>
              )}
            </div>
          </div>

          {/* Exchange Proxy */}
          <div className="glass-card rounded-2xl p-6 space-y-4">
            <h2 className="text-foreground font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">swap_horiz</span>
              Trocar Proxy
            </h2>
            <p className="text-text-secondary text-xs">
              Insira o ID do novo proxy para realizar a troca. A troca é imediata e o proxy anterior será liberado.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="ID do novo proxy"
                value={newProxyId}
                onChange={(e) => setNewProxyId(e.target.value)}
                className="bg-muted border-border text-foreground"
              />
              <Button
                onClick={handleExchange}
                disabled={!newProxyId || exchangeMutation.isPending}
                className="bg-primary hover:bg-[#00c968] text-background font-bold shrink-0"
              >
                {exchangeMutation.isPending ? "..." : "Trocar"}
              </Button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="glass-card rounded-2xl p-6 space-y-3">
            <h2 className="text-foreground font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">bolt</span>
              Ações Rápidas
            </h2>

            {sub.proxy && (
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => {
                  const str = `${sub.proxy!.ip}:${sub.proxy!.port}:${sub.proxy!.username || ""}:${sub.proxy!.password || ""}`;
                  copyToClipboard(str, "quick-conn");
                }}
              >
                <span className="material-symbols-outlined text-base">content_copy</span>
                Copiar String de Conexão
              </Button>
            )}

            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => navigate("/suporte")}
            >
              <span className="material-symbols-outlined text-base">support_agent</span>
              Abrir Suporte
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => navigate("/loja?filter=Proxy")}
            >
              <span className="material-symbols-outlined text-base">shopping_cart</span>
              Contratar Mais Proxies
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
