import { useState, useMemo, useEffect, useCallback } from "react";
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

function pickEmail(vaultId: string, index: number, usedIndices: Set<number>): { email: string; emailIndex: number } {
  let hash = 0;
  for (let i = 0; i < vaultId.length; i++) {
    hash = ((hash << 5) - hash + vaultId.charCodeAt(i)) | 0;
  }
  let idx = Math.abs(hash) % SAFE_EMAILS.length;
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

// ─── Processing animation steps ───
const PROCESSING_STEPS = [
  { icon: "link", text: "Recebendo link do convite…" },
  { icon: "enhanced_encryption", text: "Criptografando credenciais…" },
  { icon: "shield", text: "Adicionando camadas de proteção…" },
  { icon: "verified_user", text: "Finalizando configuração…" },
];

function VaultProcessingAnimation({ bmName }: { bmName: string }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (currentStep < PROCESSING_STEPS.length) {
      const timer = setTimeout(() => {
        setCurrentStep((s) => s + 1);
      }, 1800);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => setDone(true), 800);
      return () => clearTimeout(timer);
    }
  }, [currentStep]);

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center text-center px-3 py-4 space-y-3 animate-fade-in">
        <div className="w-14 h-14 rounded-full bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center">
          <MaterialIcon name="hourglass_top" className="!text-2xl text-amber-400 animate-pulse" />
        </div>
        <p className="text-sm font-semibold text-[#e0e2ea]">Configuração enviada!</p>
        <p className="text-xs text-[#c6c6c7]/60 leading-relaxed max-w-[220px]">
          Volte mais tarde, ainda estamos configurando a proteção da sua BM <strong className="text-amber-400">{bmName}</strong>. Avisaremos quando tudo estiver pronto.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center text-center px-3 py-4 space-y-4">
      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400/20 to-amber-600/20 border-2 border-amber-500/40 flex items-center justify-center">
        <MaterialIcon name="lock" className="!text-2xl text-amber-400 animate-pulse" />
      </div>
      <p className="text-sm font-semibold text-[#e0e2ea]">Muito obrigado!</p>
      <p className="text-[11px] text-[#c6c6c7]/60">Estamos configurando e protegendo sua BM.</p>

      <div className="w-full space-y-2">
        {PROCESSING_STEPS.map((step, i) => {
          const isActive = i === currentStep;
          const isDone = i < currentStep;
          return (
            <div
              key={i}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all duration-500 ${
                isDone
                  ? "bg-green-500/10 border border-green-500/20"
                  : isActive
                  ? "bg-amber-500/10 border border-amber-500/30 animate-pulse"
                  : "opacity-30"
              }`}
            >
              <MaterialIcon
                name={isDone ? "check_circle" : step.icon}
                className={`!text-sm ${isDone ? "text-green-400" : isActive ? "text-amber-400" : "text-[#c6c6c7]/40"}`}
              />
              <span className={`text-[10px] ${isDone ? "text-green-300" : isActive ? "text-amber-300" : "text-[#c6c6c7]/40"}`}>
                {step.text}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Card for vault already submitted but pending admin activation ───
function VaultPendingCard({ bmName }: { bmName: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-3 py-6 space-y-3">
      <div className="w-14 h-14 rounded-full bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center">
        <MaterialIcon name="hourglass_top" className="!text-2xl text-amber-400 animate-pulse" />
      </div>
      <p className="text-sm font-semibold text-[#e0e2ea]">Proteção em andamento</p>
      <p className="text-xs text-[#c6c6c7]/60 leading-relaxed max-w-[220px]">
        Ainda estamos configurando a proteção da sua BM <strong className="text-amber-400">{bmName}</strong>. Avisaremos quando tudo estiver pronto.
      </p>
    </div>
  );
}

export default function SafeBMVaultConfig({ vaults, onConfigured }: Props) {
  const unconfigured = vaults.filter(v => v.bm_link === GENERIC_BM_LINK);

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

  // Persist submitted vaults in localStorage so they stay locked after reload
  const SUBMITTED_KEY = "safebm_submitted_vaults";
  const [submittedVaults, setSubmittedVaults] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem(SUBMITTED_KEY) || "{}");
    } catch { return {}; }
  });
  // Track vaults currently showing the animation (just submitted this session)
  const [animatingVaults, setAnimatingVaults] = useState<Record<string, string>>({});

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

      // Show animation and persist so it stays locked after reload
      const bmNameTrimmed = form.bmName.trim();
      setAnimatingVaults(prev => ({ ...prev, [vaultId]: bmNameTrimmed }));
      setSubmittedVaults(prev => {
        const next = { ...prev, [vaultId]: bmNameTrimmed };
        localStorage.setItem(SUBMITTED_KEY, JSON.stringify(next));
        return next;
      });
    } catch (err: any) {
      toast.error(err.message || "Erro ao configurar cofre");
    } finally {
      updateForm(vaultId, { saving: false });
    }
  };

  if (unconfigured.length === 0) return null;

  return (
    <div className="space-y-2.5">
      {/* Instructions */}
      <div className="text-center py-3 space-y-1.5">
        <p className="text-sm text-[#c6c6c7]/70 leading-relaxed max-w-2xl mx-auto">
          O Safe BM protege sua Business Manager contra <strong className="text-[#e0e2ea]">phishing, scanners maliciosos e invasões</strong>, 
          garantindo a <strong className="text-[#e0e2ea]">recuperação do acesso</strong> caso o perfil de administrador seja comprometido. 
          A BM não pode estar com restrição para que a recuperação funcione.
        </p>
        <p className="text-sm text-amber-400/80 flex items-center justify-center gap-1.5">
          <MaterialIcon name="warning" className="!text-base" />
          <span>Ao enviar o convite, conceda <strong className="text-amber-400">todas as permissões de administrador total</strong>.</span>
        </p>
      </div>

      {/* Vault cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5">
        {unconfigured.map((v, idx) => {
          const email = vaultEmails.get(v.id) || SAFE_EMAILS[idx % SAFE_EMAILS.length];
          const form = getForm(v.id);
          const isAnimating = !!animatingVaults[v.id];
          const isSubmitted = !!submittedVaults[v.id];

          return (
            <div
              key={v.id}
              className="group relative rounded-2xl overflow-hidden border border-amber-500/20 hover:border-amber-500/40 bg-gradient-to-b from-[#1c2025] to-[#14171b] p-0 flex flex-col transition-all duration-300"
            >
              {isAnimating ? (
                <VaultProcessingAnimation bmName={animatingVaults[v.id]} />
              ) : isSubmitted ? (
                <VaultPendingCard bmName={submittedVaults[v.id]} />
              ) : (
                <>
                  {/* Vault door silhouette */}
                  <div className="relative flex items-center justify-center pt-5 pb-3">
                    <div className="relative w-20 h-20 rounded-full border-[3px] border-amber-500/30 flex items-center justify-center bg-[#0a0e13]/60 shadow-[0_0_30px_rgba(245,158,11,0.08)]">
                      <div className="w-12 h-12 rounded-full border-2 border-amber-500/20 flex items-center justify-center bg-[#1c2025]">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                          <MaterialIcon name="lock_open" className="!text-[14px] text-[#410001]" />
                        </div>
                      </div>
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[2px] h-2 bg-amber-500/40 rounded-full" />
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[2px] h-2 bg-amber-500/40 rounded-full" />
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 h-[2px] w-2 bg-amber-500/40 rounded-full" />
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 h-[2px] w-2 bg-amber-500/40 rounded-full" />
                    </div>
                    <div className="absolute left-2 top-4 w-1.5 h-5 rounded-full bg-amber-500/15" />
                    <div className="absolute left-2 bottom-4 w-1.5 h-5 rounded-full bg-amber-500/15" />
                  </div>

                  {/* Card content */}
                  <div className="px-3 pb-3 flex flex-col flex-1 justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-1.5">
                        <h4 className="text-xs font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{v.bm_name}</h4>
                        <div className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[9px] font-bold uppercase tracking-wider">
                          Pendente
                        </div>
                      </div>
                      <p className="text-[9px] text-[#c6c6c7]/50 mb-2 font-mono truncate">Cofre {idx + 1}</p>

                      {/* Email */}
                      <div className="flex items-center gap-1.5 bg-[#0a0e13] rounded-lg px-2.5 py-2 border border-amber-500/20 mb-1">
                        <MaterialIcon name="email" className="text-[#ffb4aa] !text-sm" />
                        <span className="text-[11px] font-mono text-[#e0e2ea] flex-1 select-all truncate">{email}</span>
                        <button onClick={() => copyEmail(email)} className="p-0.5 rounded bg-[#31353b] hover:bg-amber-500 hover:text-[#410001] text-[#c6c6c7] transition-all shrink-0">
                          <MaterialIcon name="content_copy" className="!text-[10px]" />
                        </button>
                      </div>
                    </div>

                    {/* Name input + Save */}
                    <div className="space-y-1.5">
                      <input
                        type="text"
                        value={form.bmName}
                        onChange={(e) => updateForm(v.id, { bmName: e.target.value })}
                        placeholder="Nome da BM"
                        className="w-full bg-[#0a0e13] border border-[#ffb4aa]/20 rounded-xl px-2.5 py-1.5 text-[10px] text-[#e0e2ea] placeholder:text-[#c6c6c7]/30 focus:outline-none focus:border-[#ffb4aa]/50"
                      />
                      <button
                        onClick={() => handleSubmit(v.id)}
                        disabled={form.saving}
                        className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-[#410001] transition-all duration-300 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {form.saving ? (
                          <div className="w-3 h-3 border-2 border-[#410001] border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <MaterialIcon name="shield" className="!text-sm" />
                            Configurar Cofre
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
