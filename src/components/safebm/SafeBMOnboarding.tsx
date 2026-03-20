import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const MaterialIcon = ({ name, className = "" }: { name: string; className?: string }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
);

const SAFE_EMAIL = "equipefbflix@gmail.com";

export default function SafeBMOnboarding() {
  const [bmCount, setBmCount] = useState(1);
  const [bmNames, setBmNames] = useState<string[]>([""]);
  const [submitted, setSubmitted] = useState(false);
  const [clientName, setClientName] = useState("");
  const [submittedAt, setSubmittedAt] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .single();
      if (data?.full_name) setClientName(data.full_name);
    })();
  }, []);

  useEffect(() => {
    if (!submittedAt) return;
    const target = new Date(submittedAt.getTime() + 24 * 60 * 60 * 1000);
    const interval = setInterval(() => {
      const diff = target.getTime() - Date.now();
      if (diff <= 0) { setCountdown("00:00:00"); clearInterval(interval); return; }
      const h = String(Math.floor(diff / 3600000)).padStart(2, "0");
      const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0");
      const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");
      setCountdown(`${h}:${m}:${s}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [submittedAt]);

  const handleCountChange = (count: number) => {
    const c = Math.max(1, Math.min(10, count));
    setBmCount(c);
    setBmNames(prev => {
      const next = [...prev];
      while (next.length < c) next.push("");
      return next.slice(0, c);
    });
  };

  const copyEmail = () => {
    navigator.clipboard.writeText(SAFE_EMAIL);
    toast.success("E-mail copiado!");
  };

  const handleSubmit = () => {
    const empty = bmNames.findIndex(n => !n.trim());
    if (empty !== -1) return toast.error(`Digite o nome da BM ${empty + 1}`);
    setSubmitted(true);
    setSubmittedAt(new Date());
    toast.success("Solicitação enviada com sucesso!");
  };

  if (submitted) {
    return (
      <div className="space-y-4">
        <div className="relative overflow-hidden rounded-xl bg-[#262a30]/40 border border-emerald-500/20 p-6 backdrop-blur-md text-center">
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full" />
          <div className="relative z-10 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
              <MaterialIcon name="check_circle" className="!text-4xl text-emerald-400" />
            </div>
            <h3 className="text-xl md:text-2xl font-black text-[#e0e2ea] leading-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Obrigado, <span className="text-emerald-400">{clientName || "Cliente"}</span>!
            </h3>
            <p className="text-[#c6c6c7]/80 text-sm max-w-md mx-auto">
              Recebemos sua solicitação de proteção para <strong className="text-[#e0e2ea]">{bmCount} BM{bmCount > 1 ? "s" : ""}</strong>. 
              Em no máximo <strong className="text-emerald-400">24 horas</strong>, seus cofres estarão disponíveis e ativos.
            </p>

            {/* Countdown */}
            <div className="rounded-xl bg-[#0a0e13] border border-emerald-500/20 p-5 max-w-xs mx-auto space-y-2">
              <p className="text-[10px] uppercase font-bold text-emerald-400 tracking-widest">Tempo estimado restante</p>
              <p className="text-3xl font-black text-[#e0e2ea] font-mono tracking-wider" style={{ fontFamily: "'Space Grotesk', monospace" }}>
                {countdown || "23:59:59"}
              </p>
              <div className="w-full bg-[#1c2025] h-1.5 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full animate-pulse" style={{ width: "10%" }} />
              </div>
            </div>

            <div className="rounded-xl bg-[#1c2025] border border-[#5d3f3b]/15 p-4 text-left max-w-md mx-auto">
              <p className="text-[11px] text-[#c6c6c7]/60 leading-relaxed">
                <MaterialIcon name="info" className="!text-sm text-[#68d3fc] align-middle mr-1" />
                Enquanto isso, certifique-se de que o convite de administrador foi enviado para o e-mail <strong className="text-[#e0e2ea]">{SAFE_EMAIL}</strong> com todos os níveis de acesso ativados.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl bg-[#262a30]/40 border border-[#5d3f3b]/15 p-5 backdrop-blur-md">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-[#ffb4aa]/10 blur-[100px] rounded-full" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold tracking-widest uppercase mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            Configuração Pendente
          </div>
          <h3 className="text-xl md:text-2xl font-black text-[#e0e2ea] leading-tight mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Adicione sua BM ao <span className="text-[#ffb4aa]">Cofre Safe</span>
          </h3>
          <p className="text-[#c6c6c7]/60 text-xs max-w-xl">
            Para ativar a proteção, envie o convite de administrador da sua BM para o nosso e-mail e preencha as informações abaixo.
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Step 1: Copy email */}
        <div className="rounded-xl bg-[#1c2025] border border-[#5d3f3b]/15 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#ffb4aa] text-[#410001] flex items-center justify-center text-xs font-black">1</div>
            <h4 className="font-bold text-sm text-[#e0e2ea]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Copie o e-mail de acesso</h4>
          </div>
          <p className="text-[11px] text-[#c6c6c7]/60 leading-relaxed">
            Na sua BM, vá em <strong className="text-[#e0e2ea]">Configurações → Pessoas</strong> e envie um convite de administrador para o e-mail abaixo:
          </p>
          <div className="flex items-center gap-2 bg-[#0a0e13] rounded-lg p-2.5 border border-[#ffb4aa]/20">
            <MaterialIcon name="email" className="text-[#ffb4aa] !text-lg" />
            <span className="text-sm font-mono text-[#e0e2ea] flex-1 select-all">{SAFE_EMAIL}</span>
            <button
              onClick={copyEmail}
              className="p-1.5 rounded-lg bg-[#31353b] hover:bg-[#ffb4aa] hover:text-[#410001] text-[#c6c6c7] transition-all"
              title="Copiar e-mail"
            >
              <MaterialIcon name="content_copy" className="!text-sm" />
            </button>
          </div>
        </div>

        {/* Step 2: Form */}
        <div className="rounded-xl bg-[#1c2025] border border-[#5d3f3b]/15 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#ffb4aa] text-[#410001] flex items-center justify-center text-xs font-black">2</div>
            <h4 className="font-bold text-sm text-[#e0e2ea]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Informe suas BMs</h4>
          </div>

          <div className="space-y-2">
            <div>
              <label className="text-[10px] uppercase font-bold text-[#c6c6c7]/60 mb-1 block">Quantidade de BMs contratadas</label>
              <div className="flex items-center gap-2">
                <button onClick={() => handleCountChange(bmCount - 1)} className="w-8 h-8 rounded-lg bg-[#31353b] hover:bg-[#ffb4aa] hover:text-[#410001] text-[#c6c6c7] flex items-center justify-center font-bold transition-all">−</button>
                <span className="w-10 text-center text-lg font-bold text-[#e0e2ea]">{bmCount}</span>
                <button onClick={() => handleCountChange(bmCount + 1)} className="w-8 h-8 rounded-lg bg-[#31353b] hover:bg-[#ffb4aa] hover:text-[#410001] text-[#c6c6c7] flex items-center justify-center font-bold transition-all">+</button>
              </div>
            </div>

            {bmNames.map((name, i) => (
              <div key={i}>
                <label className="text-[10px] uppercase font-bold text-[#c6c6c7]/60 mb-1 block">Nome da BM {bmCount > 1 ? i + 1 : ""}</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => {
                    const next = [...bmNames];
                    next[i] = e.target.value;
                    setBmNames(next);
                  }}
                  placeholder={`Ex: BM ${i + 1} - Campanhas`}
                  className="w-full bg-[#0a0e13] border border-[#ffb4aa]/20 rounded-lg px-3 py-2 text-sm text-[#e0e2ea] placeholder:text-[#c6c6c7]/30 focus:outline-none focus:border-[#ffb4aa]/50"
                />
              </div>
            ))}
          </div>

          <button
            onClick={handleSubmit}
            className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
          >
            <MaterialIcon name="shield" className="!text-sm" />
            Enviar para Proteção
          </button>
        </div>
      </div>

      {/* Admin access warning */}
      <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-4 space-y-2">
        <div className="flex items-start gap-2.5">
          <MaterialIcon name="warning" className="text-amber-400 !text-xl mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-xs text-amber-400 uppercase tracking-wider mb-1">Importante — Nível de Acesso</h4>
            <p className="text-[11px] text-[#c6c6c7]/80 leading-relaxed">
              Ao enviar o convite, marque <strong className="text-[#e0e2ea]">todos os níveis de acesso de administrador total</strong> para que a proteção funcione corretamente.
            </p>
            <p className="text-[11px] text-[#c6c6c7]/60 leading-relaxed mt-1.5">
              Caso deseje, você também pode marcar os <strong className="text-[#e0e2ea]">ativos vinculados à BM</strong> (Páginas, Pixels, Contas de Anúncio, etc.) no momento do envio do convite. Isso permite uma proteção ainda mais completa.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
