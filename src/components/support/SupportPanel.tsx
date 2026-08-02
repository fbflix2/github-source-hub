import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Send, Search, Ticket, MessageCircleQuestion, LifeBuoy, ChevronRight } from "lucide-react";
import atendenteAvatar from "@/assets/atendente-avatar.jpeg";

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

export function SupportPanel({ userName, onClose, onWhatsApp }: SupportPanelProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

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
    <div className="absolute bottom-20 right-0 w-[calc(100vw-3rem)] max-w-[380px] overflow-hidden rounded-3xl border border-border bg-card shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-primary to-primary/70 px-5 pb-8 pt-5 text-primary-foreground">
        <div className="flex items-start justify-between">
          <LifeBuoy className="size-7 opacity-90" />
          <div className="flex items-center gap-3">
            <img
              src={atendenteAvatar}
              alt="Atendente FBFlix"
              className="size-9 rounded-full border-2 border-primary-foreground/40 object-cover object-top"
            />
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
          <p className="text-xl font-semibold opacity-70">
            Olá{firstName ? ` ${firstName}` : ""} 👋
          </p>
          <p className="text-2xl font-bold">Como podemos ajudar?</p>
        </div>
      </div>

      {/* Body */}
      <div className="-mt-4 space-y-3 px-4 pb-5">
        <button
          onClick={onWhatsApp}
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-background px-4 py-3.5 text-left shadow-sm transition-colors hover:bg-muted/50"
        >
          <div className="flex items-center gap-3">
            <MessageCircleQuestion className="size-5 text-primary" />
            <div>
              <p className="text-sm font-semibold text-foreground">Dúvida rápida no WhatsApp</p>
              <p className="text-xs text-muted-foreground">Resposta em minutos</p>
            </div>
          </div>
          <Send className="size-4 text-primary" />
        </button>

        <button
          onClick={() => go("/suporte")}
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-background px-4 py-3.5 text-left shadow-sm transition-colors hover:bg-muted/50"
        >
          <div className="flex items-center gap-3">
            <Ticket className="size-5 text-primary" />
            <div>
              <p className="text-sm font-semibold text-foreground">Abrir chamado de suporte</p>
              <p className="text-xs text-muted-foreground">Acompanhe seus tickets</p>
            </div>
          </div>
          <ChevronRight className="size-4 text-muted-foreground" />
        </button>

        <div className="rounded-2xl border border-border bg-background shadow-sm">
          <div className="flex items-center gap-2 px-4 py-3">
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
    </div>
  );
}