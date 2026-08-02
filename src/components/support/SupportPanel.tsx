import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Send, Search, Home, MessageSquare, HelpCircle, CheckSquare, Ticket, ChevronRight, ChevronLeft, ChevronDown, Check } from "lucide-react";
import logoFbflix from "@/assets/logo-fbflix-white.png";
import whatsappIcon from "@/assets/brands/whatsapp.svg";
import atendenteAvatar from "@/assets/atendente-avatar.jpeg";
import agent2 from "@/assets/support-agent-2.jpg";
import agent3 from "@/assets/support-agent-3.jpg";
import agent4 from "@/assets/support-agent-4.jpg";
import { supabase } from "@/integrations/supabase/client";

const TEAM = [
  { src: atendenteAvatar, alt: "Atendente FBFlix" },
  { src: agent2, alt: "Especialista de suporte" },
  { src: agent3, alt: "Especialista de contas" },
  { src: agent4, alt: "Especialista de proxies" },
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

interface Article {
  title: string;
  body: string[];
  cta?: { label: string; to: string };
}

interface Collection {
  title: string;
  desc: string;
  articles: Article[];
}

const COLLECTIONS: Collection[] = [
  {
    title: "Primeiros Passos",
    desc: "Tudo o que você precisa saber para começar na FBFlix",
    articles: [
      {
        title: "Como criar e verificar sua conta",
        body: [
          "Cadastre-se com um e-mail válido e confirme seus dados pessoais em Meus Dados.",
          "Para liberar compras é necessário nome completo, CPF, data de nascimento e WhatsApp válido.",
          "Contas com dados incompletos ficam bloqueadas no checkout por segurança.",
        ],
        cta: { label: "Completar meus dados", to: "/meus-dados" },
      },
      {
        title: "Como fazer sua primeira compra",
        body: [
          "Escolha o produto na Loja, adicione ao carrinho e siga para o checkout.",
          "Você pode pagar via PIX, cartão ou saldo da carteira.",
          "Após a confirmação, o item é entregue automaticamente em Meus Pedidos.",
        ],
        cta: { label: "Ir para a loja", to: "/loja" },
      },
      {
        title: "Onde encontro o que comprei?",
        body: [
          "Todos os itens entregues ficam em Meus Pedidos, com credenciais e links de acesso.",
          "Assinaturas (proxies, Safe BM, Scale Pro) aparecem também na área de Assinaturas.",
        ],
        cta: { label: "Ver meus pedidos", to: "/orders" },
      },
    ],
  },
  {
    title: "Pagamentos & Cobrança",
    desc: "PIX, cartão, carteira e comprovantes",
    articles: [
      {
        title: "Como adicionar saldo na carteira",
        body: [
          "Acesse Carteira, informe o valor e gere um PIX.",
          "O saldo cai automaticamente em poucos segundos após o pagamento.",
          "Com saldo, o checkout fica instantâneo — sem esperar confirmação bancária.",
        ],
        cta: { label: "Abrir carteira", to: "/wallet" },
      },
      {
        title: "Paguei e o pedido continua pendente",
        body: [
          "Pagamentos PIX confirmam em até 2 minutos. Cartão pode levar alguns minutos a mais.",
          "Se passar disso, abra um chamado com o código do pedido (ORD-XXXX) que regularizamos na hora.",
        ],
        cta: { label: "Abrir chamado", to: "/suporte" },
      },
    ],
  },
  {
    title: "Proxies",
    desc: "Configuração, troca e renovação de proxies",
    articles: [
      {
        title: "Como configurar seu proxy",
        body: [
          "Em Assinaturas, copie o endereço no formato IP:PORTA:USUÁRIO:SENHA.",
          "Cole no seu navegador antidetect ou extensão de proxy.",
          "Use sempre o proxy designado para o perfil — trocar de IP gera checkpoint.",
        ],
        cta: { label: "Ver minhas assinaturas", to: "/subscriptions" },
      },
      {
        title: "Como renovar antes do vencimento",
        body: [
          "A renovação fica disponível a partir de 30 dias antes do vencimento.",
          "Após o vencimento existe um período de tolerância antes da liberação do IP.",
          "Renovações são cobradas sempre pelo preço cheio do plano.",
        ],
        cta: { label: "Renovar agora", to: "/subscriptions" },
      },
      {
        title: "Meu proxy parou de conectar",
        body: [
          "Confira usuário e senha — erro 407 normalmente é autenticação incorreta.",
          "Teste em outro navegador para descartar conflito de extensão.",
          "Persistindo, abra um chamado que fazemos a troca do IP.",
        ],
        cta: { label: "Falar com o suporte", to: "/suporte" },
      },
    ],
  },
  {
    title: "Assinaturas & Conta",
    desc: "Gerencie sua conta e suas assinaturas",
    articles: [
      {
        title: "Como cancelar a renovação automática",
        body: [
          "Em Assinaturas, abra o item e desative a renovação automática.",
          "O serviço continua ativo até a data final já paga.",
        ],
        cta: { label: "Gerenciar assinaturas", to: "/subscriptions" },
      },
      {
        title: "Como alterar minha senha",
        body: [
          "Acesse Perfil e use a opção de redefinir senha.",
          "Você receberá um link de confirmação no e-mail cadastrado.",
        ],
        cta: { label: "Abrir perfil", to: "/profile" },
      },
    ],
  },
  {
    title: "Garantia & Reposição",
    desc: "Prazos e regras de troca de itens",
    articles: [
      {
        title: "Qual é o prazo de garantia?",
        body: [
          "Cada produto tem o prazo informado na página do item e nos Termos.",
          "A garantia cobre falhas de acesso, não uso indevido do item.",
          "Solicite a reposição pelo chamado, anexando prints do erro.",
        ],
        cta: { label: "Ver termos e garantia", to: "/termos" },
      },
      {
        title: "Como solicitar uma troca",
        body: [
          "Abra um chamado com o código do pedido e o print do problema.",
          "Trocas dentro da cota são gratuitas; acima da cota há cobrança proporcional.",
        ],
        cta: { label: "Solicitar troca", to: "/suporte" },
      },
    ],
  },
  {
    title: "Segurança",
    desc: "Boas práticas para manter suas contas seguras",
    articles: [
      {
        title: "Como ativar o 2FA nos perfis",
        body: [
          "Use a ferramenta de 2FA para gerar os códigos a partir da chave fornecida.",
          "Nunca compartilhe a chave secreta com terceiros.",
        ],
        cta: { label: "Abrir ferramentas", to: "/ferramentas" },
      },
      {
        title: "Evitando bloqueios e checkpoints",
        body: [
          "Mantenha o mesmo IP/proxy por perfil e evite ações em massa.",
          "Aqueça o perfil gradualmente antes de subir campanhas.",
        ],
      },
    ],
  },
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

interface TaskStep {
  title: string;
  desc: string;
  cta: { label: string; to: string };
}

const TASKS: TaskStep[] = [
  {
    title: "Complete seu cadastro",
    desc: "Preencha nome completo, CPF, data de nascimento e WhatsApp para liberar as compras.",
    cta: { label: "Completar meus dados", to: "/meus-dados" },
  },
  {
    title: "Adicione saldo na carteira",
    desc: "Com saldo o checkout fica instantâneo, sem esperar confirmação bancária.",
    cta: { label: "Abrir carteira", to: "/wallet" },
  },
  {
    title: "Faça sua primeira compra",
    desc: "Escolha perfis, BMs ou proxies na loja e receba a entrega automática.",
    cta: { label: "Ir para a loja", to: "/loja" },
  },
  {
    title: "Configure seu proxy",
    desc: "Copie o endereço IP:PORTA:USUÁRIO:SENHA em Assinaturas e cole no seu antidetect.",
    cta: { label: "Ver assinaturas", to: "/subscriptions" },
  },
];

const TASKS_KEY = "fbflix_support_tasks_done";

export function SupportPanel({ userName, onClose, onWhatsApp }: SupportPanelProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"home" | "help" | "messages" | "tasks">("home");
  const [openStep, setOpenStep] = useState<number | null>(0);
  const [doneSteps, setDoneSteps] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem(TASKS_KEY) || "[]"); } catch { return []; }
  });
  const toggleDone = (i: number) => {
    setDoneSteps((prev) => {
      const next = prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i];
      try { localStorage.setItem(TASKS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };
  const [threads, setThreads] = useState<{ id: string; title: string; last: string; at: string }[]>([]);
  const [openThread, setOpenThread] = useState<{ id: string; title: string } | null>(null);
  const [threadMsgs, setThreadMsgs] = useState<{ id: string; content: string; sender: string; created_at: string }[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [openCollection, setOpenCollection] = useState<Collection | null>(null);
  const [openArticle, setOpenArticle] = useState<Article | null>(null);
  const [recent, setRecent] = useState<{ subject: string; body: string; at: string; ticketId: string } | null>(null);

  // Load ticket list for the Mensagens tab
  useEffect(() => {
    if (tab !== "messages" || openThread) return;
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: tickets } = await supabase
        .from("tickets")
        .select("id, title, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(20);
      if (!active || !tickets?.length) { if (active) setThreads([]); return; }
      const ids = tickets.map((t) => t.id);
      const { data: msgs } = await supabase
        .from("ticket_messages")
        .select("ticket_id, content, created_at")
        .in("ticket_id", ids)
        .order("created_at", { ascending: false });
      if (!active) return;
      const lastByTicket = new Map<string, { content: string; created_at: string }>();
      (msgs ?? []).forEach((m: any) => {
        if (!lastByTicket.has(m.ticket_id)) lastByTicket.set(m.ticket_id, m);
      });
      setThreads(
        tickets.map((t) => ({
          id: t.id,
          title: t.title ?? "Chamado de suporte",
          last: lastByTicket.get(t.id)?.content ?? "Abra para ver a conversa",
          at: lastByTicket.get(t.id)?.created_at ?? t.updated_at,
        })),
      );
    })();
    return () => { active = false; };
  }, [tab, openThread]);

  // Load messages of the opened thread
  useEffect(() => {
    if (!openThread) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("ticket_messages")
        .select("id, content, sender, created_at")
        .eq("ticket_id", openThread.id)
        .order("created_at", { ascending: true });
      if (active) setThreadMsgs((data as any) ?? []);
    })();
    return () => { active = false; };
  }, [openThread]);

  const sendReply = async () => {
    const text = reply.trim();
    if (!text || !openThread || sending) return;
    setSending(true);
    const { data, error } = await supabase
      .from("ticket_messages")
      .insert({ ticket_id: openThread.id, content: text, sender: "user" })
      .select("id, content, sender, created_at")
      .single();
    setSending(false);
    if (!error && data) {
      setThreadMsgs((prev) => [...prev, data as any]);
      setReply("");
    }
  };

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
      <button onClick={() => { setTab("messages"); setOpenThread(null); }} className={`flex flex-col items-center gap-1 py-3 transition-colors ${tab === "messages" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
        <MessageSquare className="size-5" />
        <span className="text-[11px] font-medium">Mensagens</span>
      </button>
      <button onClick={() => { setTab("help"); setOpenCollection(null); setOpenArticle(null); }} className={`flex flex-col items-center gap-1 py-3 transition-colors ${tab === "help" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
        {tab === "help" ? (
          <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">?</span>
        ) : (
          <HelpCircle className="size-5" />
        )}
        <span className="text-[11px] font-medium">Ajuda</span>
      </button>
      <button onClick={() => setTab("tasks")} className={`flex flex-col items-center gap-1 py-3 transition-colors ${tab === "tasks" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
        <CheckSquare className="size-5" />
        <span className="text-[11px] font-medium">Tarefas</span>
      </button>
    </div>
  );

  if (tab === "messages") {
    // rendered below
  }

  if (tab === "tasks") {
    const pct = Math.round((doneSteps.length / TASKS.length) * 100);
    return (
      <div className="absolute bottom-20 right-0 flex h-[660px] max-h-[calc(100vh-7rem)] w-[calc(100vw-3rem)] max-w-[430px] flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
        <div className="relative flex shrink-0 items-center justify-center border-b border-border px-4 py-4">
          <p className="text-lg font-bold text-foreground">Tarefas</p>
          <button onClick={onClose} aria-label="Fechar" className="absolute right-3 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted">
            <X className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">Vamos começar!</p>
            <p className="mt-1 text-sm text-muted-foreground">Alguns passos para você aproveitar tudo na FBFlix</p>
          </div>

          <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
            <span>{TASKS.length} etapas</span>
            <span>Cerca de 5 minutos</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>

          <div className="mt-5 space-y-3">
            {TASKS.map((t, i) => {
              const done = doneSteps.includes(i);
              const open = openStep === i;
              return (
                <div key={t.title} className="rounded-2xl border border-border bg-background shadow-sm">
                  <button
                    onClick={() => setOpenStep(open ? null : i)}
                    className="flex w-full items-center gap-3 px-4 py-4 text-left"
                  >
                    <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${done ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                      {done ? <Check className="size-4" /> : i + 1}
                    </span>
                    <span className={`min-w-0 flex-1 text-sm font-medium ${done ? "text-muted-foreground line-through" : "text-foreground"}`}>{t.title}</span>
                    <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
                  </button>
                  {open && (
                    <div className="space-y-3 border-t border-border px-4 py-4">
                      <p className="text-sm leading-relaxed text-muted-foreground">{t.desc}</p>
                      <button
                        onClick={() => go(t.cta.to)}
                        className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                      >
                        {t.cta.label}
                      </button>
                      <button
                        onClick={() => toggleDone(i)}
                        className="w-full rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
                      >
                        {done ? "Marcar como pendente" : "Marcar como concluída"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {navBar}
      </div>
    );
  }

  if (tab === "messages") {
    return (
      <div className="absolute bottom-20 right-0 flex h-[660px] max-h-[calc(100vh-7rem)] w-[calc(100vw-3rem)] max-w-[430px] flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
        <div className="relative flex shrink-0 items-center justify-center border-b border-border px-4 py-4">
          {openThread && (
            <button onClick={() => setOpenThread(null)} aria-label="Voltar" className="absolute left-3 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted">
              <ChevronLeft className="size-5" />
            </button>
          )}
          <p className="max-w-[70%] truncate text-lg font-bold text-foreground">{openThread ? openThread.title : "Mensagens"}</p>
          <button onClick={onClose} aria-label="Fechar" className="absolute right-3 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted">
            <X className="size-5" />
          </button>
        </div>

        {openThread ? (
          <>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {threadMsgs.length === 0 && (
                <p className="pt-6 text-center text-sm text-muted-foreground">Nenhuma mensagem ainda.</p>
              )}
              {threadMsgs.map((m) => (
                <div key={m.id} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${m.sender === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    <p className={`mt-1 text-[10px] ${m.sender === "user" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{timeAgo(m.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="shrink-0 border-t border-border p-3">
              <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-2.5">
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") sendReply(); }}
                  placeholder="Escreva sua mensagem..."
                  className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
                <button onClick={sendReply} disabled={sending || !reply.trim()} aria-label="Enviar" className="text-primary disabled:opacity-40">
                  <Send className="size-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {threads.length === 0 ? (
                <p className="px-6 pt-10 text-center text-sm text-muted-foreground">Você ainda não tem conversas por aqui.</p>
              ) : (
                <div className="divide-y divide-border">
                  {threads.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setOpenThread({ id: t.id, title: t.title })}
                      className="flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/40"
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary">
                        <Ticket className="size-5 text-primary-foreground" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-foreground">{t.title}</p>
                          <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(t.at)}</span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{t.last}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="shrink-0 px-4 pb-4">
              <button
                onClick={() => go("/suporte")}
                className="mx-auto flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Envie uma mensagem
                <Send className="size-4" />
              </button>
            </div>
          </>
        )}

        {navBar}
      </div>
    );
  }

  if (tab === "help") {
    const q = query.trim().toLowerCase();
    const searching = q.length > 0 && !openArticle;
    const searchHits = searching
      ? COLLECTIONS.flatMap((c) => c.articles.map((a) => ({ c, a }))).filter(
          ({ c, a }) => a.title.toLowerCase().includes(q) || c.title.toLowerCase().includes(q),
        )
      : [];

    const back = () => {
      if (openArticle) setOpenArticle(null);
      else if (openCollection) setOpenCollection(null);
      else setTab("home");
    };

    return (
      <div className="absolute bottom-20 right-0 flex h-[660px] max-h-[calc(100vh-7rem)] w-[calc(100vw-3rem)] max-w-[430px] flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
        <div className="relative flex shrink-0 items-center justify-center border-b border-border px-4 py-4">
          <button onClick={back} aria-label="Voltar" className="absolute left-3 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted">
            <ChevronLeft className="size-5" />
          </button>
          <p className="max-w-[70%] truncate text-lg font-bold text-foreground">
            {openArticle ? openArticle.title : openCollection ? openCollection.title : "Ajuda"}
          </p>
          <button onClick={onClose} aria-label="Fechar" className="absolute right-3 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted">
            <X className="size-5" />
          </button>
        </div>

        {!openArticle && (
        <div className="shrink-0 px-4 pt-4">
          <div className="flex items-center gap-2 rounded-xl bg-muted px-4 py-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar artigos de ajuda"
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <Search className="size-4 text-primary" />
          </div>
        </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-4">
          {openArticle ? (
            <div className="space-y-3 py-4">
              <p className="text-base font-bold text-foreground">{openArticle.title}</p>
              {openArticle.body.map((p, i) => (
                <p key={i} className="text-sm leading-relaxed text-muted-foreground">{p}</p>
              ))}
              {openArticle.cta && (
                <button
                  onClick={() => go(openArticle.cta!.to)}
                  className="mt-2 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  {openArticle.cta.label}
                </button>
              )}
              <button
                onClick={() => go("/suporte")}
                className="w-full rounded-xl border border-border px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
              >
                Ainda preciso de ajuda
              </button>
            </div>
          ) : searching ? (
            <>
              <p className="py-4 text-base font-bold text-foreground">{searchHits.length} artigos</p>
              <div className="divide-y divide-border">
                {searchHits.map(({ c, a }) => (
                  <button
                    key={c.title + a.title}
                    onClick={() => { setOpenCollection(c); setOpenArticle(a); }}
                    className="flex w-full items-center gap-3 py-4 text-left transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">{a.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{c.title}</p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-primary" />
                  </button>
                ))}
              </div>
            </>
          ) : openCollection ? (
            <>
              <p className="py-4 text-base font-bold text-foreground">{openCollection.articles.length} artigos</p>
              <div className="divide-y divide-border">
                {openCollection.articles.map((a) => (
                  <button
                    key={a.title}
                    onClick={() => setOpenArticle(a)}
                    className="flex w-full items-center gap-3 py-4 text-left transition-colors hover:bg-muted/40"
                  >
                    <p className="min-w-0 flex-1 text-sm font-semibold text-foreground">{a.title}</p>
                    <ChevronRight className="size-4 shrink-0 text-primary" />
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="py-4 text-base font-bold text-foreground">{COLLECTIONS.length} coleções</p>
              <div className="divide-y divide-border">
                {COLLECTIONS.map((c) => (
                  <button
                    key={c.title}
                    onClick={() => setOpenCollection(c)}
                    className="flex w-full items-center gap-3 py-4 text-left transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">{c.title}</p>
                      {c.desc && <p className="mt-1 text-sm text-muted-foreground">{c.desc}</p>}
                      <p className="mt-1 text-xs text-muted-foreground">{c.articles.length} artigos</p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-primary" />
                  </button>
                ))}
              </div>
            </>
          )}
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
          onClick={() => {
            if (recent) { setTab("messages"); setOpenThread({ id: recent.ticketId, title: recent.subject }); }
            else go("/suporte");
          }}
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
          <p className="text-sm font-semibold text-foreground">Dúvida rápida</p>
          <span className="flex size-8 items-center justify-center rounded-full bg-[#25D366]">
            <img src={whatsappIcon} alt="WhatsApp" className="size-5" />
          </span>
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
