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

  const getForm = (id: string): VaultFormState => forms[id] || { bmName: "", saving: false };
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

    updateForm(vaultId, { saving: true });
    try {
      const { data, error } = await supabase.functions.invoke("admin-fix-duplicate", {
        body: {
          action: "configure_vault",
          vault_id: vaultId,
          bm_name: form.bmName.trim(),
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
    <div className="space-y-1.5">
      {/* Header */}
      <div className="relative overflow-hidden rounded-lg bg-[#262a30]/40 border border-[#5d3f3b]/15 px-3 py-2 backdrop-blur-md">
        <div className="relative z-10 flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-amber-500/20 flex items-center justify-center shrink-0">
            <MaterialIcon name="shield" className="!text-sm text-amber-400" />
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[8px] font-bold tracking-widest uppercase">
              <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
              Pendente
            </div>
            <span className="text-xs font-bold text-[#e0e2ea]">
              {unconfigured.length === 1 ? "1 cofre pendente" : `${unconfigured.length} cofres pendentes`}
            </span>
          </div>
        </div>
      </div>

      {/* Vault cards */}
      {unconfigured.map((v, idx) => {
        const email = vaultEmails.get(v.id) || SAFE_EMAILS[idx % SAFE_EMAILS.length];
        const form = getForm(v.id);

        return (
          <div key={v.id} className="rounded-lg bg-[#1c2025] border border-[#5d3f3b]/15 px-3 py-2 space-y-1.5">
            {/* Title row */}
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-amber-500/20 flex items-center justify-center">
                <MaterialIcon name="shield" className="!text-xs text-amber-400" />
              </div>
              <span className="text-[11px] font-bold text-[#e0e2ea]">Cofre {idx + 1} — {v.bm_name}</span>
              <span className="text-[8px] text-amber-400 ml-auto">Pendente</span>
            </div>

            {/* Email row */}
            <div className="flex items-center gap-1.5 bg-[#0a0e13] rounded px-2 py-1.5 border border-[#ffb4aa]/20">
              <MaterialIcon name="email" className="text-[#ffb4aa] !text-xs" />
              <span className="text-[10px] font-mono text-[#e0e2ea] flex-1 select-all truncate">{email}</span>
              <button onClick={() => copyEmail(email)} className="p-0.5 rounded bg-[#31353b] hover:bg-[#ffb4aa] hover:text-[#410001] text-[#c6c6c7] transition-all shrink-0">
                <MaterialIcon name="content_copy" className="!text-[10px]" />
              </button>
            </div>
            <p className="text-[8px] text-amber-400/70 flex items-center gap-1">
              <MaterialIcon name="warning" className="!text-[10px]" />
              Marque <strong>todos os acessos de admin total</strong>.
            </p>

            {/* Name + Save inline */}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-[8px] uppercase font-bold text-[#c6c6c7]/50 mb-0.5 block">Nome da BM</label>
                <input
                  type="text"
                  value={form.bmName}
                  onChange={(e) => updateForm(v.id, { bmName: e.target.value })}
                  placeholder="Ex: BM Principal"
                  className="w-full bg-[#0a0e13] border border-[#ffb4aa]/20 rounded px-2 py-1 text-[11px] text-[#e0e2ea] placeholder:text-[#c6c6c7]/30 focus:outline-none focus:border-[#ffb4aa]/50"
                />
              </div>
              <button
                onClick={() => handleSubmit(v.id)}
                disabled={form.saving}
                className="px-4 py-1 bg-emerald-500 hover:bg-emerald-400 text-white rounded text-[9px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 disabled:opacity-50 shrink-0"
              >
                {form.saving ? (
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <MaterialIcon name="shield" className="!text-[10px]" />
                    Salvar
                  </>
                )}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
