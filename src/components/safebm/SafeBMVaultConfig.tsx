import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const MaterialIcon = ({ name, className = "" }: { name: string; className?: string }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
);

const SAFE_EMAIL = "equipefbflix@gmail.com";
const GENERIC_BM_LINK = "https://business.facebook.com";

interface UnconfiguredVault {
  id: string;
  bm_name: string;
  bm_link: string;
}

interface Props {
  vaults: UnconfiguredVault[];
  onConfigured: () => void;
}

export default function SafeBMVaultConfig({ vaults, onConfigured }: Props) {
  const [configuring, setConfiguring] = useState<string | null>(null);
  const [bmName, setBmName] = useState("");
  const [bmLink, setBmLink] = useState("");
  const [saving, setSaving] = useState(false);

  const copyEmail = () => {
    navigator.clipboard.writeText(SAFE_EMAIL);
    toast.success("E-mail copiado!");
  };

  const handleConfigure = (vault: UnconfiguredVault) => {
    setConfiguring(vault.id);
    setBmName("");
    setBmLink("");
  };

  const handleSubmit = async () => {
    if (!bmName.trim()) return toast.error("Digite o nome da BM");
    if (!bmLink.trim()) return toast.error("Cole o link de convite da BM");

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-fix-duplicate", {
        body: {
          action: "configure_vault",
          vault_id: configuring,
          bm_name: bmName.trim(),
          bm_link: bmLink.trim(),
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Erro ao configurar");
      }

      toast.success("Cofre configurado com sucesso!");
      setConfiguring(null);
      onConfigured();
    } catch (err: any) {
      toast.error(err.message || "Erro ao configurar cofre");
    } finally {
      setSaving(false);
    }
  };

  const unconfigured = vaults.filter(v => v.bm_link === GENERIC_BM_LINK);
  if (unconfigured.length === 0) return null;

  return (
    <div className="space-y-2">
      {/* Header compacto */}
      <div className="relative overflow-hidden rounded-lg bg-[#262a30]/40 border border-[#5d3f3b]/15 px-4 py-3 backdrop-blur-md">
        <div className="absolute -right-16 -top-16 w-48 h-48 bg-[#ffb4aa]/10 blur-[80px] rounded-full" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
            <MaterialIcon name="shield" className="!text-lg text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-bold tracking-widest uppercase">
                <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                Pendente
              </div>
              <h3 className="text-sm font-bold text-[#e0e2ea]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {unconfigured.length === 1 ? "1 cofre precisa ser configurado" : `${unconfigured.length} cofres precisam ser configurados`}
              </h3>
            </div>
            <p className="text-[10px] text-[#c6c6c7]/50 mt-0.5">
              Envie o convite de admin e preencha os dados abaixo.
            </p>
          </div>
        </div>
      </div>

      {/* Steps em grid lado a lado */}
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-2">
        {/* Step 1: Email - sidebar compacto */}
        <div className="rounded-lg bg-[#1c2025] border border-[#5d3f3b]/15 p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-[#ffb4aa] text-[#410001] flex items-center justify-center text-[10px] font-black">1</div>
            <h4 className="font-bold text-xs text-[#e0e2ea]">E-mail de acesso</h4>
          </div>
          <p className="text-[10px] text-[#c6c6c7]/50 leading-relaxed">
            BM → <strong className="text-[#c6c6c7]/80">Configurações → Pessoas</strong> → convite admin:
          </p>
          <div className="flex items-center gap-1.5 bg-[#0a0e13] rounded-md p-2 border border-[#ffb4aa]/20">
            <MaterialIcon name="email" className="text-[#ffb4aa] !text-sm" />
            <span className="text-[11px] font-mono text-[#e0e2ea] flex-1 select-all truncate">{SAFE_EMAIL}</span>
            <button onClick={copyEmail} className="p-1 rounded bg-[#31353b] hover:bg-[#ffb4aa] hover:text-[#410001] text-[#c6c6c7] transition-all shrink-0">
              <MaterialIcon name="content_copy" className="!text-xs" />
            </button>
          </div>
          <div className="flex items-start gap-1.5 pt-1">
            <MaterialIcon name="warning" className="text-amber-400 !text-xs mt-0.5 shrink-0" />
            <p className="text-[9px] text-amber-400/80 leading-snug">
              Marque <strong className="text-amber-400">todos os acessos de admin total</strong>.
            </p>
          </div>
        </div>

        {/* Step 2: Configure vaults */}
        <div className="rounded-lg bg-[#1c2025] border border-[#5d3f3b]/15 p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-[#ffb4aa] text-[#410001] flex items-center justify-center text-[10px] font-black">2</div>
            <h4 className="font-bold text-xs text-[#e0e2ea]">Configure seus cofres</h4>
          </div>

          <div className="space-y-1.5">
            {unconfigured.map((v) => (
              <div key={v.id} className="rounded-md border border-amber-500/20 bg-[#0a0e13] p-2.5">
                {configuring === v.id ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] uppercase font-bold text-[#c6c6c7]/50 mb-0.5 block">Nome da BM</label>
                        <input
                          type="text"
                          value={bmName}
                          onChange={(e) => setBmName(e.target.value)}
                          placeholder="Ex: BM Principal"
                          className="w-full bg-[#1c2025] border border-[#ffb4aa]/20 rounded-md px-2.5 py-1.5 text-xs text-[#e0e2ea] placeholder:text-[#c6c6c7]/30 focus:outline-none focus:border-[#ffb4aa]/50"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] uppercase font-bold text-[#c6c6c7]/50 mb-0.5 block">Link de Convite</label>
                        <input
                          type="text"
                          value={bmLink}
                          onChange={(e) => setBmLink(e.target.value)}
                          placeholder="https://business.facebook.com/settings/..."
                          className="w-full bg-[#1c2025] border border-[#ffb4aa]/20 rounded-md px-2.5 py-1.5 text-xs text-[#e0e2ea] placeholder:text-[#c6c6c7]/30 focus:outline-none focus:border-[#ffb4aa]/50"
                        />
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setConfiguring(null)}
                        className="px-3 py-1.5 bg-[#31353b] text-[#c6c6c7] rounded-md text-[10px] font-bold transition-all hover:bg-[#3d4149]"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSubmit}
                        disabled={saving}
                        className="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-md text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        {saving ? (
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <MaterialIcon name="shield" className="!text-xs" />
                            Salvar
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-amber-500/20 flex items-center justify-center">
                        <MaterialIcon name="settings" className="!text-sm text-amber-400" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-[#e0e2ea]">{v.bm_name}</p>
                        <p className="text-[9px] text-amber-400">Aguardando configuração</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleConfigure(v)}
                      className="px-2.5 py-1 bg-[#ffb4aa] text-[#410001] rounded-md text-[10px] font-bold hover:bg-[#ffc8c0] transition-all flex items-center gap-1"
                    >
                      <MaterialIcon name="edit" className="!text-xs" />
                      Configurar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
