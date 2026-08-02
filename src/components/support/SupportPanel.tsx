import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Send, Search, Home, MessageSquare, HelpCircle, CheckSquare, Ticket } from "lucide-react";
import logoFbflix from "@/assets/logo-fbflix.webp";
import atendenteAvatar from "@/assets/atendente-avatar.jpeg";
import agent2 from "@/assets/support-agent-2.jpg";
import agent3 from "@/assets/support-agent-3.jpg";
import { supabase } from "@/integrations/supabase/client";

const TEAM = [
  { src: atendenteAvatar, alt: "Atendente FBFlix" },
  { src: agent2, alt: "Especialista de suporte" },
  { src: agent3, alt: "Especialista de contas" },
];

interface SupportPanelProps {
  userName?: string;
  onClose: () => void;
  onWhatsApp: () => void;
}

const FAQS = [
  { q: "Como funciona a garantia dos perfis?", to: "/termos" },
  { q: "Meu pedido está pendente, e agora?", to: "/orders" },
  { q: "Como renovar meu proxy?", to: "/subscriptions" },
  { q: "Como adicionar saldo na carteira?", to: "/wallet" },
  { q: "Onde acompanho meus chamados?", to: "/suporte" },
];

function timeAgo(iso: string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function SupportPanel({ userName, onClose, onWhatsApp }: SupportPanelProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<{ subject: string; body: string; at: string; ticketId: string } | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: tickets } = await supabase
        .from("tickets")
        .select("id, title, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1);
      const t = tickets?.[0];
      if (!t || !active) return;
      const { data: msgs } = await supabase
        .from("ticket_messages")
        .select("content, created_at")
        .eq("ticket_id", t.id)
        .order("created_at", { ascending: false })
        .limit(1);
      const m = msgs?.[0] as any;
      if (!active) return;
      setRecent({
        subject: t.title ?? "Chamado de suporte",
        body: m?.content ?? "Abra para ver a conversa",
        at: m?.created_at ?? t.updated_at,
        ticketId: t.id,
      });
    })();
    return () => { active = false; };
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return FAQS.filter((f) => f.q.toLowerCase().includes(q));
  }, [query]);

  const firstName = (userName || "").split(" ")[0];

  const go = (to: string) => {
    navigate(to);
    onClose();
  };

  return (
    <div className="absolute bottom-20 right-0 flex h-[560px] max-h-[calc(100vh-8rem)] w-[calc(100vw-3rem)] max-w-[420px] flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
      {/* Header */}
      <div className="relative shrink-0 bg-gradient-to-br from-primary to-primary/70 px-6 pb-7 pt-6 text-primary-foreground">
        <div className="flex items-start justify-between">
          <img src={logoFbflix} alt="FBFlix" className="h-9 w-auto object-contain drop-shadow" />
          <div className="flex items-center gap-2">
            <div className="flex -space-x-3">
              {TEAM.map((m) => (
                <img
                  key={m.alt}
                  src={m.src}
                  alt={m.alt}
                  loading="lazy"
                  className="size-10 rounded-full border-2 border-primary-foreground/60 object-cover object-top shadow-md"
                />
              ))}
            </div>
            <button
              onClick={onClose}
              aria-label="Fechar"
              className="rounded-full p-1 transition-colors hover:bg-primary-foreground/15"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        <div className="mt-8">
          <p className="text-2xl font-semibold opacity-70">
            Olá{firstName ? ` ${firstName}` : ""} 👋
          </p>
          <p className="text-3xl font-bold leading-tight">Como podemos ajudar?</p>
        </div>
      </div>

      {/* Body */}
      <div className="-mt-5 flex-1 space-y-3 overflow-y-auto px-4 pb-4">
        {recent && (
          <button
            onClick={() => go("/suporte")}
            className="w-full rounded-2xl border border-border bg-background p-4 text-left shadow-xl transition-colors hover:bg-muted/50"
          >
            <p className="text-sm font-semibold text-foreground">Mensagem recente</p>
            <div className="mt-2 flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary">
                <Ticket className="size-5 text-primary-foreground" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{recent.subject}</p>
                <p className="truncate text-xs text-muted-foreground">{recent.body}</p>
              </div>
              <span className="text-xs text-muted-foreground">{timeAgo(recent.at)}</span>
            </div>
          </button>
        )}

        <button
          onClick={onWhatsApp}
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-background px-4 py-4 text-left shadow-sm transition-colors hover:bg-muted/50"
        >
          <p className="text-sm font-semibold text-foreground">Envie uma mensagem</p>
          <Send className="size-5 fill-primary text-primary" />
        </button>

        <div className="rounded-2xl border border-border bg-background shadow-sm">
          <div className="flex items-center gap-2 px-4 py-4">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Qual é a sua dúvida?"
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <Search className="size-4 text-primary" />
          </div>
          {results.length > 0 && (
            <div className="border-t border-border">
              {results.map((f) => (
                <button
                  key={f.q}
                  onClick={() => go(f.to)}
                  className="block w-full px-4 py-2.5 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                >
                  {f.q}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom nav */}
      <div className="grid grid-cols-4 border-t border-border bg-card">
        <button className="flex flex-col items-center gap-1 py-3 text-primary">
          <Home className="size-5" />
          <span className="text-[11px] font-medium">Início</span>
        </button>
        <button onClick={() => go("/suporte")} className="flex flex-col items-center gap-1 py-3 text-muted-foreground transition-colors hover:text-foreground">
          <MessageSquare className="size-5" />
          <span className="text-[11px] font-medium">Mensagens</span>
        </button>
        <button onClick={() => go("/termos")} className="flex flex-col items-center gap-1 py-3 text-muted-foreground transition-colors hover:text-foreground">
          <HelpCircle className="size-5" />
          <span className="text-[11px] font-medium">Ajuda</span>
        </button>
        <button onClick={() => go("/orders")} className="flex flex-col items-center gap-1 py-3 text-muted-foreground transition-colors hover:text-foreground">
          <CheckSquare className="size-5" />
          <span className="text-[11px] font-medium">Tarefas</span>
        </button>
      </div>
    </div>
  );
}
