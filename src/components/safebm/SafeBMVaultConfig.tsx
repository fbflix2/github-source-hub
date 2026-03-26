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
    <div className="space-y-4">
      {/* Header */}
      <div className="relative overflow-hidden rounded-xl bg-[#262a30]/40 border border-[#5d3f3b]/15 p-5 backdrop-blur-md">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-[#ffb4aa]/10 blur-[100px] rounded-full" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold tracking-widest uppercase mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            Configuração Pendente
          </div>
          <h3 className="text-xl md:text-2xl font-black text-[#e0e2ea] leading-tight mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {unconfigured.length === 1
              ? "1 cofre precisa ser configurado"
              : `${unconfigured.length} cofres precisam ser configurados`}
          </h3>
          <p className="text-[#c6c6c7]/60 text-xs max-w-xl">
            Para ativar a proteção, envie o convite de administrador da sua BM para o nosso e-mail e preencha as informações abaixo.
          </p>
        </div>
      </div>

      {/* Step 1: Email */}
      <div className="rounded-xl bg-[#1c2025] border border-[#5d3f3b]/15 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[#ffb4aa] text-[#410001] flex items-center justify-center text-xs font-black">1</div>
          <h4 className="font-bold text-sm text-[#e0e2ea]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Copie o e-mail de acesso</h4>
        </div>
        <p className="text-[11px] text-[#c6c6c7]/60 leading-relaxed">
          Na sua BM, vá em <strong className="text-[#e0e2ea]">Configurações → Pessoas</strong> e envie um convite de administrador para:
        </p>
        <div className="flex items-center gap-2 bg-[#0a0e13] rounded-lg p-2.5 border border-[#ffb4aa]/20">
          <MaterialIcon name="email" className="text-[#ffb4aa] !text-lg" />
          <span className="text-sm font-mono text-[#e0e2ea] flex-1 select-all">{SAFE_EMAIL}</span>
          <button onClick={copyEmail} className="p-1.5 rounded-lg bg-[#31353b] hover:bg-[#ffb4aa] hover:text-[#410001] text-[#c6c6c7] transition-all" title="Copiar e-mail">
            <MaterialIcon name="content_copy" className="!text-sm" />
          </button>
        </div>
      </div>

      {/* Step 2: Configure each vault */}
      <div className="rounded-xl bg-[#1c2025] border border-[#5d3f3b]/15 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[#ffb4aa] text-[#410001] flex items-center justify-center text-xs font-black">2</div>
          <h4 className="font-bold text-sm text-[#e0e2ea]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Configure seus cofres</h4>
        </div>

        <div className="space-y-2">
          {unconfigured.map((v) => (
            <div key={v.id} className="rounded-lg border border-amber-500/20 bg-[#0a0e13] p-3">
              {configuring === v.id ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-[#c6c6c7]/60 mb-1 block">Nome da BM</label>
                    <input
                      type="text"
                      value={bmName}
                      onChange={(e) => setBmName(e.target.value)}
                      placeholder="Ex: BM Principal - Campanhas"
                      className="w-full bg-[#1c2025] border border-[#ffb4aa]/20 rounded-lg px-3 py-2 text-sm text-[#e0e2ea] placeholder:text-[#c6c6c7]/30 focus:outline-none focus:border-[#ffb4aa]/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-[#c6c6c7]/60 mb-1 block">Link de Convite da BM</label>
                    <input
                      type="text"
                      value={bmLink}
                      onChange={(e) => setBmLink(e.target.value)}
                      placeholder="https://business.facebook.com/settings/..."
                      className="w-full bg-[#1c2025] border border-[#ffb4aa]/20 rounded-lg px-3 py-2 text-sm text-[#e0e2ea] placeholder:text-[#c6c6c7]/30 focus:outline-none focus:border-[#ffb4aa]/50"
                    />
                    <p className="text-[10px] text-[#c6c6c7]/40 mt-1">
                      Cole o link de convite de admin que você enviou para {SAFE_EMAIL}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfiguring(null)}
                      className="px-4 py-2 bg-[#31353b] text-[#c6c6c7] rounded-xl text-xs font-bold transition-all hover:bg-[#3d4149]"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={saving}
                      className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {saving ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <MaterialIcon name="shield" className="!text-sm" />
                          Salvar Configuração
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                      <MaterialIcon name="settings" className="!text-lg text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#e0e2ea]">{v.bm_name}</p>
                      <p className="text-[10px] text-amber-400">Aguardando configuração</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleConfigure(v)}
                    className="px-3 py-1.5 bg-[#ffb4aa] text-[#410001] rounded-lg text-xs font-bold hover:bg-[#ffc8c0] transition-all flex items-center gap-1"
                  >
                    <MaterialIcon name="edit" className="!text-sm" />
                    Configurar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Warning */}
      <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-4 space-y-2">
        <div className="flex items-start gap-2.5">
          <MaterialIcon name="warning" className="text-amber-400 !text-xl mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-xs text-amber-400 uppercase tracking-wider mb-1">Importante — Nível de Acesso</h4>
            <p className="text-[11px] text-[#c6c6c7]/80 leading-relaxed">
              Ao enviar o convite, marque <strong className="text-[#e0e2ea]">todos os níveis de acesso de administrador total</strong> para que a proteção funcione corretamente.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
