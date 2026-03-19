import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";

const MaterialIcon = ({ name, className = "" }: { name: string; className?: string }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
);

type Phase = "idle" | "accessing" | "decrypting" | "generating" | "ready";

const PHASE_LABELS: Record<Phase, string> = {
  idle: "Solicitar Novo Acesso",
  accessing: "Acessando BM Safe...",
  decrypting: "Descriptografando...",
  generating: "Gerando novo acesso...",
  ready: "Copiar Novo Acesso",
};

const PHASE_ICONS: Record<Phase, string> = {
  idle: "vpn_key",
  accessing: "sync",
  decrypting: "enhanced_encryption",
  generating: "autorenew",
  ready: "content_copy",
};

interface Props {
  bmLink: string;
}

export default function RequestAccessButton({ bmLink }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const startFlow = async () => {
    if (phase !== "idle") return;

    setPhase("accessing");
    await delay(1200);
    setPhase("decrypting");
    await delay(1500);
    setPhase("generating");
    await delay(1300);
    setPhase("ready");

    // Auto-reset after 5 minutes
    timerRef.current = setTimeout(() => {
      setPhase("idle");
    }, 5 * 60 * 1000);
  };

  const handleCopy = () => {
    if (!bmLink) return;
    navigator.clipboard.writeText(bmLink);
    toast.success("Link copiado com sucesso!");
  };

  const isAnimating = phase === "accessing" || phase === "decrypting" || phase === "generating";
  const isReady = phase === "ready";

  const bgClass = isReady
    ? "bg-emerald-600 hover:bg-emerald-500 text-white"
    : isAnimating
    ? "bg-[#31353b] text-[#ffb4aa] cursor-wait"
    : "bg-[#31353b] hover:bg-[#ffb4aa] hover:text-[#690003] text-[#e0e2ea]";

  return (
    <button
      className={`w-full py-2 transition-all duration-300 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 ${bgClass}`}
      onClick={isReady ? handleCopy : startFlow}
      disabled={isAnimating}
    >
      <MaterialIcon
        name={PHASE_ICONS[phase]}
        className={`!text-sm ${isAnimating ? "animate-spin" : ""}`}
      />
      {PHASE_LABELS[phase]}
    </button>
  );
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
