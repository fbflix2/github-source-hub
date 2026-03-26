import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const MaterialIcon = ({ name, className = "" }: { name: string; className?: string }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
);

const SAFE_EMAILS = [
  "safe1@rercoverfbflix.com.br",
  "safe2@recoverfbflix.com.br",
  "safe3@recoverfbflix.com.br",
  "safe4@recoverfbflix.com.br",
  "safe5@recoverfbflix.com.br",
  "safe6@recoverfbflix.com.br",
  "safe7@recoverfbflix.com.br",
  "safe8@recoverfbflix.com.br",
  "safe9@recoverfbflix.com.br",
  "safe10@recoverfbflix.com.br",
];

const GENERIC_BM_LINK = "https://business.facebook.com";

/** Deterministic email pick based on vault ID so it stays consistent across renders */
function pickEmail(vaultId: string, index: number, usedIndices: Set<number>): { email: string; emailIndex: number } {
  // Hash vault ID to get a starting index
  let hash = 0;
  for (let i = 0; i < vaultId.length; i++) {
    hash = ((hash << 5) - hash + vaultId.charCodeAt(i)) | 0;
  }
  let idx = Math.abs(hash) % SAFE_EMAILS.length;

  // If already used, find next available
  let attempts = 0;
  while (usedIndices.has(idx) && attempts < SAFE_EMAILS.length) {
    idx = (idx + 1) % SAFE_EMAILS.length;
    attempts++;
  }

  return { email: SAFE_EMAILS[idx], emailIndex: idx };
}

interface UnconfiguredVault {
  id: string;
  bm_name: string;
  bm_link: string;
}

interface Props {
  vaults: UnconfiguredVault[];
  onConfigured: () => void;
}

interface VaultFormState {
  bmName: string;
  bmLink: string;
  saving: boolean;
}

export default function SafeBMVaultConfig({ vaults, onConfigured }: Props) {
  const unconfigured = vaults.filter(v => v.bm_link === GENERIC_BM_LINK);

  // Assign a unique email to each vault deterministically
  const vaultEmails = useMemo(() => {
    const map = new Map<string, string>();
    const usedIndices = new Set<number>();
    unconfigured.forEach((v, i) => {
      const { email, emailIndex } = pickEmail(v.id, i, usedIndices);
      usedIndices.add(emailIndex);
      map.set(v.id, email);
    });
    return map;
  }, [unconfigured.map(v => v.id).join(",")]);

  const [forms, setForms] = useState<Record<string, VaultFormState>>({});

  const getForm = (id: string): VaultFormState => forms[id] || { bmName: "", bmLink: "", saving: false };
  const updateForm = (id: string, patch: Partial<VaultFormState>) => {
    setForms(prev => ({ ...prev, [id]: { ...getForm(id), ...patch } }));
  };

  const copyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    toast.success("E-mail copiado!");
  };

  const handleSubmit = async (vaultId: string) => {
    const form = getForm(vaultId);
    if (!form.bmName.trim()) return toast.error("Digite o nome da BM");
    if (!form.bmLink.trim()) return toast.error("Cole o link de convite da BM");

    updateForm(vaultId, { saving: true });
    try {
      const { data, error } = await supabase.functions.invoke("admin-fix-duplicate", {
        body: {
          action: "configure_vault",
          vault_id: vaultId,
          bm_name: form.bmName.trim(),
          bm_link: form.bmLink.trim(),
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Erro ao configurar");
      }

      toast.success("Cofre configurado com sucesso!");
      onConfigured();
    } catch (err: any) {
      toast.error(err.message || "Erro ao configurar cofre");
    } finally {
      updateForm(vaultId, { saving: false });
    }
  };

  if (unconfigured.length === 0) return null;

  return (
    <div className="space-y-2">
      {/* Header */}
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
              Envie o convite de admin para cada e-mail abaixo e preencha os dados.
            </p>
          </div>
        </div>
      </div>

      {/* Each vault gets its own card with unique email + form */}
      <div className="space-y-2">
        {unconfigured.map((v, idx) => {
          const email = vaultEmails.get(v.id) || SAFE_EMAILS[idx % SAFE_EMAILS.length];
          const form = getForm(v.id);

          return (
            <div key={v.id} className="rounded-lg bg-[#1c2025] border border-[#5d3f3b]/15 p-3 space-y-3">
              {/* Vault header */}
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-amber-500/20 flex items-center justify-center">
                  <MaterialIcon name="shield" className="!text-sm text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[#e0e2ea]">
                    Cofre {idx + 1} — {v.bm_name}
                  </p>
                  <p className="text-[9px] text-amber-400">Aguardando configuração</p>
                </div>
              </div>

              {/* Step 1: Email for this vault */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-full bg-[#ffb4aa] text-[#410001] flex items-center justify-center text-[8px] font-black">1</div>
                  <span className="text-[10px] font-bold text-[#c6c6c7]/70">
                    Envie convite de admin para:
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-[#0a0e13] rounded-md p-2 border border-[#ffb4aa]/20">
                  <MaterialIcon name="email" className="text-[#ffb4aa] !text-sm" />
                  <span className="text-[11px] font-mono text-[#e0e2ea] flex-1 select-all truncate">{email}</span>
                  <button onClick={() => copyEmail(email)} className="p-1 rounded bg-[#31353b] hover:bg-[#ffb4aa] hover:text-[#410001] text-[#c6c6c7] transition-all shrink-0">
                    <MaterialIcon name="content_copy" className="!text-xs" />
                  </button>
                </div>
                <div className="flex items-start gap-1.5">
                  <MaterialIcon name="warning" className="text-amber-400 !text-xs mt-0.5 shrink-0" />
                  <p className="text-[9px] text-amber-400/80 leading-snug">
                    Marque <strong className="text-amber-400">todos os acessos de admin total</strong>.
                  </p>
                </div>
              </div>

              {/* Step 2: Configure form */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-full bg-[#ffb4aa] text-[#410001] flex items-center justify-center text-[8px] font-black">2</div>
                  <span className="text-[10px] font-bold text-[#c6c6c7]/70">Preencha os dados</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] uppercase font-bold text-[#c6c6c7]/50 mb-0.5 block">Nome da BM</label>
                    <input
                      type="text"
                      value={form.bmName}
                      onChange={(e) => updateForm(v.id, { bmName: e.target.value })}
                      placeholder="Ex: BM Principal"
                      className="w-full bg-[#0a0e13] border border-[#ffb4aa]/20 rounded-md px-2.5 py-1.5 text-xs text-[#e0e2ea] placeholder:text-[#c6c6c7]/30 focus:outline-none focus:border-[#ffb4aa]/50"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] uppercase font-bold text-[#c6c6c7]/50 mb-0.5 block">Link de Convite</label>
                    <input
                      type="text"
                      value={form.bmLink}
                      onChange={(e) => updateForm(v.id, { bmLink: e.target.value })}
                      placeholder="https://business.facebook.com/settings/..."
                      className="w-full bg-[#0a0e13] border border-[#ffb4aa]/20 rounded-md px-2.5 py-1.5 text-xs text-[#e0e2ea] placeholder:text-[#c6c6c7]/30 focus:outline-none focus:border-[#ffb4aa]/50"
                    />
                  </div>
                </div>
                <button
                  onClick={() => handleSubmit(v.id)}
                  disabled={form.saving}
                  className="w-full py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-md text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {form.saving ? (
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <MaterialIcon name="shield" className="!text-xs" />
                      Salvar Cofre {idx + 1}
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
