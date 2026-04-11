import { useState, useEffect, useMemo, useRef } from "react";
import RequestAccessButton from "@/components/safebm/RequestAccessButton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import SecurityMonitor, { type SecurityMonitorHandle } from "@/components/safebm/SecurityMonitor";
import PricingModal from "@/components/safebm/PricingModal";
import SafeBMOnboarding from "@/components/safebm/SafeBMOnboarding";
import SafeBMVaultConfig from "@/components/safebm/SafeBMVaultConfig";

interface SafeBmVault {
  id: string;
  user_id: string;
  client_name: string | null;
  bm_name: string;
  bm_link: string;
  perfil_backup: string | null;
  purchase_date: string | null;
  protection_start: string;
  link_regenerations: number;
  status: string;
  subscription_price: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  bm_tracking_id: string | null;
  backup_link: string | null;
  link_health: string | null;
  bm_tracking?: {
    bm_link: string;
  } | null;
}

const MaterialIcon = ({ name, className = "" }: { name: string; className?: string }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
);

export default function SafeBMClient() {
  const [vaults, setVaults] = useState<SafeBmVault[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showPricing, setShowPricing] = useState(false);
  const monitorRef = useRef<SecurityMonitorHandle>(null);

  const GENERIC_BM_LINK = "https://business.facebook.com";

  const fetchVaults = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data, error } = await supabase
      .from("safe_bm_vaults" as any)
      .select("*, bm_tracking:bm_tracking_id(bm_link)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar cofre: " + error.message);
    setVaults((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchVaults(); }, []);

  const configuredVaults = useMemo(() => {
    // Only show vaults that have been fully configured (not generic link, or have tracking/backup)
    return vaults.filter(v => v.bm_link !== GENERIC_BM_LINK || !!v.bm_tracking_id || !!v.backup_link);
  }, [vaults]);

  const filtered = useMemo(() => {
    if (!search.trim()) return configuredVaults;
    const q = search.toLowerCase();
    return configuredVaults.filter(v =>
      v.bm_name.toLowerCase().includes(q) ||
      (v.perfil_backup || "").toLowerCase().includes(q)
    );
  }, [configuredVaults, search]);

  const activeVaults = vaults.filter(v => v.status === "active");
  const expiringVaults = vaults.filter(v => {
    if (v.status !== "active") return false;
    const daysSinceProtection = differenceInDays(new Date(), new Date(v.protection_start));
    return daysSinceProtection > 25;
  });

  if (loading) {
    return (
      <div className="p-4 max-w-7xl mx-auto w-full space-y-4 animate-pulse">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-44 rounded-xl bg-[#262a30]" />
          <div className="h-44 rounded-xl bg-[#1c2025]" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div className="h-48 rounded-xl bg-[#1c2025]" />
          <div className="h-48 rounded-xl bg-[#1c2025]" />
        </div>
      </div>
    );
  }

  const unconfiguredVaults = vaults.filter(v => v.bm_link === GENERIC_BM_LINK && !v.bm_tracking_id && !v.backup_link);

  if (!loading && vaults.length === 0) {
    return (
      <div className="p-3 md:p-4 max-w-7xl mx-auto w-full" style={{ fontFamily: "'Inter', sans-serif" }}>
        <SafeBMOnboarding />
      </div>
    );
  }

  if (!loading && unconfiguredVaults.length > 0 && unconfiguredVaults.length === vaults.length) {
    // All vaults are unconfigured — show only config screen
    return (
      <div className="p-3 md:p-4 max-w-7xl mx-auto w-full" style={{ fontFamily: "'Inter', sans-serif" }}>
        <SafeBMVaultConfig vaults={unconfiguredVaults} onConfigured={fetchVaults} />
      </div>
    );
  }

  return (
    <div className="p-3 md:p-4 max-w-7xl mx-auto w-full space-y-2.5" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* Show config UI if some vaults are unconfigured */}
      {unconfiguredVaults.length > 0 && (
        <SafeBMVaultConfig vaults={unconfiguredVaults} onConfigured={fetchVaults} />
      )}
      {/* ───── HERO STATUS SECTION ───── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">

        {/* Main Status Card */}
        <div className="lg:col-span-2 relative overflow-hidden rounded-xl bg-[#262a30]/40 border border-[#5d3f3b]/15 p-4 backdrop-blur-md">
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-[#ffb4aa]/10 blur-[100px] rounded-full" />
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold tracking-widest uppercase mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                Cofre Ativo
              </div>
              <h3 className="text-xl md:text-2xl font-black text-[#e0e2ea] leading-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Segurança Total em <span className="text-[#ffb4aa]">Tempo Real</span>
              </h3>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-3">
              <div>
                <p className="text-[10px] text-[#c6c6c7]/60 uppercase font-medium">Ativos Protegidos</p>
                <p className="text-lg font-bold text-[#e0e2ea]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{activeVaults.length}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#c6c6c7]/60 uppercase font-medium">Alertas Hoje</p>
                <p className="text-lg font-bold text-[#ffb4aa]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{String(expiringVaults.length).padStart(2, '0')}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#c6c6c7]/60 uppercase font-medium">Uptime Vault</p>
                <p className="text-lg font-bold text-[#68d3fc]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>99.9%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Alerts Panel */}
        <div className="rounded-xl bg-[#1c2025] border border-[#5d3f3b]/15 p-3 space-y-2">
          <div className="flex justify-between items-center">
            <h4 className="font-bold text-xs" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Alertas Críticos</h4>
            <MaterialIcon name="security" className="text-[#ffb4aa] !text-base" />
          </div>
          <div className="space-y-1.5">
            {expiringVaults.length > 0 ? (
              expiringVaults.slice(0, 2).map(v => (
                <div key={v.id} className="p-2 rounded-lg bg-[#31353b] border-l-4 border-[#ffb4aa]">
                  <p className="text-[10px] font-bold text-[#ffb4aa] mb-0.5">RENOVAÇÃO PRÓXIMA</p>
                  <p className="text-[11px] text-[#e0e2ea] font-medium leading-snug">
                    Sua BM "{v.bm_name}" expira em {Math.max(0, 30 - differenceInDays(new Date(), new Date(v.protection_start)))} dias.
                  </p>
                </div>
              ))
            ) : (
              <div className="p-2 rounded-lg bg-[#31353b] border-l-4 border-[#ffb4aa]">
                <p className="text-[10px] font-bold text-[#ffb4aa] mb-0.5">TUDO EM ORDEM</p>
                <p className="text-[11px] text-[#e0e2ea] font-medium leading-snug">
                  Todas as suas BMs estão protegidas e seguras.
                </p>
              </div>
            )}

            {vaults.some(v => v.link_regenerations > 0) && (
              <div className="p-2 rounded-lg bg-[#31353b] border-l-4 border-[#68d3fc]/50">
                <p className="text-[10px] font-bold text-[#68d3fc] mb-0.5">BACKUP CONCLUÍDO</p>
                <p className="text-[11px] text-[#e0e2ea] font-medium leading-snug">
                  Snapshot do cofre gerado com sucesso.
                </p>
              </div>
            )}
          </div>
          <button className="w-full text-center text-[10px] text-[#c6c6c7] hover:text-[#ffb4aa] transition-colors py-0.5">
            Ver todo o histórico
          </button>
        </div>
      </section>

      <section className={`grid grid-cols-1 ${activeVaults.length > 0 ? 'md:grid-cols-2' : ''} gap-2.5`} style={{ minHeight: 180 }}>
        <div className="rounded-xl bg-[#1C2025] border border-[#5d3f3b]/15 p-4 flex items-center gap-4" style={{ minHeight: 180 }}>
          <div className="flex-1 space-y-0.5">
            <h4 className="font-bold text-sm" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Precisa de mais proteção?</h4>
            <p className="text-[11px] text-[#c6c6c7]/60 leading-relaxed">
              Aumente seus limites de vault para proteger até 50 BMs simultaneamente.
            </p>
            <button onClick={() => setShowPricing(true)} className="inline-block pt-1 text-[#ffb4aa] font-bold text-xs hover:underline bg-transparent border-none cursor-pointer">
              Ver planos e preços →
            </button>
          </div>
          <div className="hidden sm:block opacity-20 rotate-12">
            <MaterialIcon name="add_moderator" className="!text-[60px] text-[#ffb4aa]" />
          </div>
        </div>

        {activeVaults.length > 0 && (
          <SecurityMonitor ref={monitorRef} bmNames={activeVaults.map(v => v.bm_name)} />
        )}
      </section>

      <PricingModal open={showPricing} onClose={() => setShowPricing(false)} />
      {/* ───── PROTECTED BMs GRID ───── */}
      <section className="space-y-2">
        <div>
          <h3 className="text-base font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>BMs Protegidas</h3>
          <p className="text-[#c6c6c7]/60 text-[11px]">Gerencie suas Business Managers blindadas</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {filtered.map(v => {
            const isActive = v.status === "active";
            const daysSinceProtection = differenceInDays(new Date(), new Date(v.protection_start));
            const isExpiringSoon = isActive && daysSinceProtection > 25;
            const progressPercent = Math.min(100, (daysSinceProtection / 30) * 100);
            const effectiveBmLink =
              v.backup_link ||
              (v.bm_link !== GENERIC_BM_LINK ? v.bm_link : "") ||
              v.bm_tracking?.bm_link ||
              v.bm_link;

            const bmIdMatch = effectiveBmLink.match(/(\d{10,})/);
            const bmId = bmIdMatch ? bmIdMatch[1] : v.id.slice(0, 12);

            const iconName = isExpiringSoon ? "warning" : isActive ? "verified_user" : "shield";
            const iconColor = isExpiringSoon ? "text-[#ffb4ab]" : "text-[#ffb4aa]";
            const borderHoverColor = isExpiringSoon ? "hover:border-[#ffb4ab]/30" : "hover:border-[#ffb4aa]/30";

            return (
              <div
                key={v.id}
                className={`group relative rounded-2xl overflow-hidden border border-[#ffb4aa]/20 ${borderHoverColor} bg-gradient-to-b from-[#1c2025] to-[#14171b] p-0 flex flex-col transition-all duration-300`}
              >
                {/* Vault door silhouette */}
                <div className="relative flex items-center justify-center pt-5 pb-3">
                  <div className={`relative w-20 h-20 rounded-full border-[3px] ${isExpiringSoon ? 'border-[#ffb4ab]/40' : 'border-[#ffb4aa]/30'} flex items-center justify-center bg-[#0a0e13]/60 shadow-[0_0_30px_rgba(255,180,170,0.08)]`}>
                    <div className="w-12 h-12 rounded-full border-2 border-[#ffb4aa]/20 flex items-center justify-center bg-[#1c2025]">
                      <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${isExpiringSoon ? 'from-[#ffb4ab] to-[#ff6b5a]' : 'from-[#ffb4aa] to-[#ff8a7a]'} flex items-center justify-center shadow-lg shadow-[#ffb4aa]/20`}>
                        <MaterialIcon name={isExpiringSoon ? "warning" : isActive ? "lock" : "shield"} className="!text-[14px] text-[#410001]" />
                      </div>
                    </div>
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[2px] h-2 bg-[#ffb4aa]/40 rounded-full" />
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[2px] h-2 bg-[#ffb4aa]/40 rounded-full" />
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 h-[2px] w-2 bg-[#ffb4aa]/40 rounded-full" />
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 h-[2px] w-2 bg-[#ffb4aa]/40 rounded-full" />
                  </div>
                  <div className="absolute left-2 top-4 w-1.5 h-5 rounded-full bg-[#ffb4aa]/15" />
                  <div className="absolute left-2 bottom-4 w-1.5 h-5 rounded-full bg-[#ffb4aa]/15" />
                </div>

                {/* Card content */}
                <div className="px-3 pb-3 flex flex-col flex-1 justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-1.5">
                      <h4 className="text-xs font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{v.bm_name}</h4>
                      {isExpiringSoon ? (
                        <div className="px-2 py-0.5 rounded-full bg-[#93000a] text-[#ffdad6] text-[9px] font-bold uppercase tracking-wider">
                          Crítico
                        </div>
                      ) : isActive ? (
                        <div className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[9px] font-bold uppercase tracking-wider">
                          Protegido
                        </div>
                      ) : (
                        <div className="px-2 py-0.5 rounded-full bg-[#c6c6c7]/10 text-[#c6c6c7] text-[9px] font-bold uppercase tracking-wider">
                          Inativo
                        </div>
                      )}
                    </div>
                    <p className="text-[9px] text-[#c6c6c7]/50 mb-2 font-mono">ID: {bmId}</p>

                    <div className="space-y-1 mb-2">
                      <div className="flex justify-between text-[10px]">
                        {isExpiringSoon ? (
                          <span className="text-[#ffb4ab] font-bold">Expira em {Math.max(0, 30 - daysSinceProtection)}d</span>
                        ) : (
                          <span className="text-[#c6c6c7]/60">Data de Expiração</span>
                        )}
                        <span className="text-[#e0e2ea] font-medium">
                          {format(new Date(v.protection_start), "dd MMM yyyy", { locale: ptBR })}
                        </span>
                      </div>
                      <div className="w-full bg-[#0a0e13] h-1 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${isExpiringSoon ? 'bg-[#ffb4ab]' : isActive ? 'bg-[#ffb4aa]' : 'bg-[#c6c6c7]/30'}`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {isExpiringSoon ? (
                    <button className="w-full py-2 bg-[#93000a] text-[#ffdad6] hover:bg-[#ffb4ab] hover:text-[#690005] transition-all duration-300 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2">
                      <MaterialIcon name="autorenew" className="!text-sm" />
                      Renovar Agora
                    </button>
                  ) : isActive ? (
                    <RequestAccessButton bmLink={effectiveBmLink} bmName={v.bm_name} monitorRef={monitorRef} />
                  ) : (
                    <button className="w-full py-2 bg-[#31353b] rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 text-[#c6c6c7]/50 cursor-not-allowed" disabled>
                      <MaterialIcon name="shield" className="!text-sm" />
                      Inativa
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

    </div>
  );
}
