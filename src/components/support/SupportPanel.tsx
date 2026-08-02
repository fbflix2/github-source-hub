import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Send, Search, Home, MessageSquare, HelpCircle, CheckSquare, Ticket, ChevronRight } from "lucide-react";
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

const COLLECTIONS = [
  { title: "Primeiros Passos", desc: "Tudo o que você precisa saber para começar na FBFlix", count: 8, to: "/como-funciona" },
  { title: "Produtos & Recursos", desc: "", count: 39, to: "/loja" },
  { title: "Assinaturas & Conta", desc: "Gerencie sua conta e suas assinaturas", count: 12, to: "/subscriptions" },
  { title: "Pagamentos & Cobrança", desc: "", count: 7, to: "/wallet" },
  { title: "Integrações", desc: "", count: 8, to: "/api-docs" },
  { title: "Proxies", desc: "Configuração, troca e renovação de proxies", count: 10, to: "/subscriptions" },
  { title: "Garantia & Reposição", desc: "", count: 6, to: "/termos" },
  { title: "Segurança", desc: "", count: 5, to: "/termos" },
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
  const [tab, setTab] = useState<"home" | "help">("home");
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

  const navBar = (
    <div className="grid grid-cols-4 border-t border-border bg-card">
      <button onClick={() => setTab("home")} className={`flex flex-col items-center gap-1 py-3 transition-colors ${tab === "home" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
        <Home className="size-5" />
        <span className="text-[11px] font-medium">Início</span>
      </button>
      <button onClick={() => go("/suporte")} className="flex flex-col items-center gap-1 py-3 text-muted-foreground transition-colors hover:text-foreground">
        <MessageSquare className="size-5" />
        <span className="text-[11px] font-medium">Mensagens</span>
      </button>
      <button onClick={() => setTab("help")} className={`flex flex-col items-center gap-1 py-3 transition-colors ${tab === "help" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
        {tab === "help" ? (
          <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">?</span>
        ) : (
          <HelpCircle className="size-5" />
        )}
        <span className="text-[11px] font-medium">Ajuda</span>
      </button>
      <button onClick={() => go("/orders")} className="flex flex-col items-center gap-1 py-3 text-muted-foreground transition-colors hover:text-foreground">
        <CheckSquare className="size-5" />
        <span className="text-[11px] font-medium">Tarefas</span>
      </button>
    </div>
  );

  if (tab === "help") {
    const filtered = query.trim()
      ? COLLECTIONS.filter((c) => c.title.toLowerCase().includes(query.trim().toLowerCase()))
      : COLLECTIONS;
    return (
      <div className="absolute bottom-20 right-0 flex h-[660px] max-h-[calc(100vh-7rem)] w-[calc(100vw-3rem)] max-w-[430px] flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
        <div className="relative flex shrink-0 items-center justify-center border-b border-border px-4 py-4">
          <p className="text-lg font-bold text-foreground">Ajuda</p>
          <button onClick={onClose} aria-label="Fechar" className="absolute right-3 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted">
            <X className="size-5" />
          </button>
        </div>

        <div className="shrink-0 px-4 pt-4">
          <div className="flex items-center gap-2 rounded-xl bg-muted px-4 py-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Qual é a sua dúvida?"
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <Search className="size-4 text-primary" />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4">
          <p className="py-4 text-base font-bold text-foreground">{filtered.length} coleções</p>
          <div className="divide-y divide-border">
            {filtered.map((c) => (
              <button
                key={c.title}
                onClick={() => go(c.to)}
                className="flex w-full items-center gap-3 py-4 text-left transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{c.title}</p>
                  {c.desc && <p className="mt-1 text-sm text-muted-foreground">{c.desc}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">{c.count} artigos</p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-primary" />
              </button>
            ))}
          </div>
        </div>

        {navBar}
      </div>
    );
  }

  return (
    <div className="absolute bottom-20 right-0 flex h-[660px] max-h-[calc(100vh-7rem)] w-[calc(100vw-3rem)] max-w-[430px] flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
      {/* Header */}
      <div className="relative shrink-0 bg-gradient-to-b from-primary via-primary/75 to-card px-6 pb-10 pt-6 text-primary-foreground">
        <div className="relative">
        <div className="flex items-start justify-between">
          <img src={logoFbflix} alt="FBFlix" className="h-11 w-auto object-contain drop-shadow" />
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

        <div className="mt-10">
          <p className="text-2xl font-semibold opacity-70">
            Olá{firstName ? ` ${firstName}` : ""} 👋
          </p>
          <p className="text-3xl font-bold leading-tight">Como podemos ajudar?</p>
        </div>
        </div>
      </div>

      {/* Recent message shortcut — always visible above the actions */}
      <div className="shrink-0 px-4 pt-2">
        <button
          onClick={() => go("/suporte")}
          className="relative z-10 min-h-[104px] w-full rounded-2xl border border-border bg-background p-4 text-left shadow-2xl transition-colors hover:bg-muted/50"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">Mensagem recente</p>
            <span className="text-xs text-muted-foreground">{recent ? timeAgo(recent.at) : "agora"}</span>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary">
              <Ticket className="size-5 text-primary-foreground" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {recent?.subject ?? "Suporte FBFlix"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {recent?.body ?? "Se ainda precisar de ajuda com o problema, fale com a gente"}
              </p>
            </div>
            <Send className="size-4 shrink-0 text-primary" />
          </div>
        </button>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-6 pt-2">
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
      {navBar}
    </div>
  );
}
