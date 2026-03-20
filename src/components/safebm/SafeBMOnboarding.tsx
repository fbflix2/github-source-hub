import { useState } from "react";
import { toast } from "sonner";

const MaterialIcon = ({ name, className = "" }: { name: string; className?: string }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
);

const SAFE_EMAIL = "equipefbflix@gmail.com";

export default function SafeBMOnboarding() {
  const [bmName, setBmName] = useState("");
  const [bmInviteLink, setBmInviteLink] = useState("");

  const copyEmail = () => {
    navigator.clipboard.writeText(SAFE_EMAIL);
    toast.success("E-mail copiado!");
  };

  const handleSubmit = () => {
    if (!bmName.trim()) return toast.error("Digite o nome da BM");
    if (!bmInviteLink.trim()) return toast.error("Cole o link de convite da BM");
    toast.success("BM enviada para proteção! Em breve ela aparecerá no seu cofre.");
    setBmName("");
    setBmInviteLink("");
  };

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
            <h4 className="font-bold text-sm text-[#e0e2ea]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Informe os dados da BM</h4>
          </div>

          <div className="space-y-2">
            <div>
              <label className="text-[10px] uppercase font-bold text-[#c6c6c7]/60 mb-1 block">Nome da BM</label>
              <input
                type="text"
                value={bmName}
                onChange={e => setBmName(e.target.value)}
                placeholder="Ex: BM Principal - Campanhas"
                className="w-full bg-[#0a0e13] border border-[#ffb4aa]/20 rounded-lg px-3 py-2 text-sm text-[#e0e2ea] placeholder:text-[#c6c6c7]/30 focus:outline-none focus:border-[#ffb4aa]/50"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-[#c6c6c7]/60 mb-1 block">Link de convite da BM</label>
              <input
                type="url"
                value={bmInviteLink}
                onChange={e => setBmInviteLink(e.target.value)}
                placeholder="https://business.facebook.com/..."
                className="w-full bg-[#0a0e13] border border-[#ffb4aa]/20 rounded-lg px-3 py-2 text-sm text-[#e0e2ea] placeholder:text-[#c6c6c7]/30 focus:outline-none focus:border-[#ffb4aa]/50"
              />
            </div>
          </div>

          <button
            onClick={handleSubmit}
            className="w-full py-2.5 bg-[#ffb4aa] hover:bg-[#ff8a7a] text-[#410001] rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
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
