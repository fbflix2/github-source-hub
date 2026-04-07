import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DEFAULT_PROFILE_QUALITY_DATA,
  DEFAULT_READY_CRITERIA,
  isProfileReadyForSale,
  parseReadyCriteria,
  type ProfileQualityData,
} from "@/lib/warming-ready";

function MIcon({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

interface Props {
  profileId: string;
  profileCode: string;
}

const FRIEND_RANGES = [
  { value: "0-5", label: "0 a 5", score: 0 },
  { value: "5-19", label: "5 a 19", score: 1 },
  { value: "20-50", label: "20 a 50", score: 2 },
  { value: "50-100+", label: "50 a +100", score: 3 },
];

const DEFAULT_DATA: ProfileQualityData = DEFAULT_PROFILE_QUALITY_DATA;

// Trust tiers config from localStorage (same key as AdminEsteiraAdmin)
function getTrustTiers() {
  try {
    const saved = localStorage.getItem("warming_trust_tiers");
    if (saved) return JSON.parse(saved);
  } catch {}
  return [
    { level: "Nível 1", range: "0–30%", criteria: "Perfil novo, sem 2FA, sem BM", color: "#ef4444" },
    { level: "Nível 2", range: "31–70%", criteria: "2FA ativo, BM criada, amigos moderados", color: "#f59e0b" },
    { level: "Nível 3", range: "71–100%", criteria: "Perfil completo, alta confiança", color: "#10b981" },
  ];
}

function calcScore(data: ProfileQualityData): number {
  let score = 0;
  const max = 6; // 1 (2FA) + 1 (BM) + 1 (Page) + 3 (friends max)
  if (data.has2FA) score += 1;
  if (data.hasBM) score += 1;
  if (data.hasPage) score += 1;
  const friendObj = FRIEND_RANGES.find(f => f.value === data.friendRange);
  score += friendObj?.score ?? 0;
  return Math.round((score / max) * 100);
}

function getTierForScore(score: number) {
  const tiers = getTrustTiers();
  if (score >= 71) return tiers[2] || tiers[tiers.length - 1];
  if (score >= 31) return tiers[1] || tiers[0];
  return tiers[0];
}

export default function ProfileQualityMeter({ profileId, profileCode }: Props) {
  const [data, setData] = useState<ProfileQualityData>(DEFAULT_DATA);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [readyCriteria, setReadyCriteria] = useState(DEFAULT_READY_CRITERIA);

  // Reset state when profile changes
  useEffect(() => {
    setData(DEFAULT_DATA);
    setLoaded(false);
    const key = `warming_quality_${profileId}`;
    supabase
      .from("site_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle()
      .then(({ data: row }) => {
        if (row?.value) {
          try {
            setData({ ...DEFAULT_DATA, ...JSON.parse(row.value) });
          } catch {}
        }
        setLoaded(true);
      });
  }, [profileId]);

  useEffect(() => {
    supabase
      .from("site_settings")
      .select("value")
      .eq("key", "warming_ready_criteria")
      .maybeSingle()
      .then(({ data: row }) => {
        if (row?.value) {
          try {
            setReadyCriteria(parseReadyCriteria(JSON.parse(row.value)));
          } catch {}
        }
      });
  }, []);

  const save = async (newData: ProfileQualityData) => {
    setData(newData);
    setSaving(true);
    const key = `warming_quality_${profileId}`;
    const jsonValue = JSON.stringify(newData);
    try {
      const { data: existing } = await supabase
        .from("site_settings")
        .select("id")
        .eq("key", key)
        .maybeSingle();
      if (existing) {
        await supabase.from("site_settings").update({ value: jsonValue }).eq("key", key);
      } else {
        await supabase.from("site_settings").insert({ key, value: jsonValue });
      }

      const [{ data: profileRow }, { data: criteriaRow }] = await Promise.all([
        supabase.from("warming_profiles").select("id, created_at, start_date, status").eq("id", profileId).maybeSingle(),
        supabase.from("site_settings").select("value").eq("key", "warming_ready_criteria").maybeSingle(),
      ]);

      const criteria = criteriaRow?.value
        ? parseReadyCriteria(JSON.parse(criteriaRow.value))
        : readyCriteria;

      if (profileRow && isProfileReadyForSale(profileRow, newData, criteria) && profileRow.status !== "completed") {
        await supabase
          .from("warming_profiles")
          .update({ status: "completed", updated_at: new Date().toISOString() })
          .eq("id", profileId);
        toast.success(`Perfil ${profileCode} movido para Perfis Prontos.`);
      }
    } catch (err) {
      console.error("Erro ao salvar qualidade:", err);
    }
    setSaving(false);
  };

  if (!loaded) return null;

  const score = calcScore(data);
  const tier = getTierForScore(score);
  const tiers = getTrustTiers();

  return (
    <div className="bg-white dark:bg-white/5 rounded-xl shadow-sm border border-slate-200 dark:border-white/10 overflow-hidden mt-3">
      {/* Header */}
      <div className="px-5 py-3 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MIcon name="thermostat" className="text-lg text-amber-500" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Qualidade do Perfil</h3>
        </div>
        <div className="flex items-center gap-2">
          {saving && <MIcon name="sync" className="text-sm text-slate-400 animate-spin" />}
          <span
            className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider"
            style={{ backgroundColor: `${tier.color}20`, color: tier.color }}
          >
            {tier.level}
          </span>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Thermometer */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold text-slate-500 dark:text-white/50 uppercase tracking-wider">Nível de Confiança</span>
            <span className="text-sm font-black" style={{ color: tier.color }}>{score}%</span>
          </div>
          <div className="relative h-3 w-full bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${score}%`,
                background: `linear-gradient(90deg, #ef4444, #f59e0b, #10b981)`,
              }}
            />
          </div>
          {/* Tier markers */}
          <div className="flex justify-between mt-1.5">
            {tiers.map((t: any, i: number) => (
              <span
                key={i}
                className="text-[9px] font-bold"
                style={{ color: t.color }}
              >
                {t.level}
              </span>
            ))}
          </div>
        </div>

        {/* Checkboxes */}
        <div className="grid grid-cols-1 gap-2.5">
          {/* 2FA */}
          <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer">
            <input
              type="checkbox"
              checked={data.has2FA}
              onChange={(e) => save({ ...data, has2FA: e.target.checked })}
              className="w-4.5 h-4.5 rounded border-slate-300 text-[#1876f2] focus:ring-[#1876f2]"
            />
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-900 dark:text-white">Já possui 2FA?</p>
              <p className="text-[11px] text-slate-500 dark:text-white/50">Autenticação de dois fatores ativada no perfil</p>
            </div>
            <MIcon
              name={data.has2FA ? "verified_user" : "shield"}
              className={`text-lg ${data.has2FA ? "text-emerald-500" : "text-slate-300 dark:text-white/20"}`}
            />
          </label>

          {/* BM */}
          <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer">
            <input
              type="checkbox"
              checked={data.hasBM}
              onChange={(e) => save({ ...data, hasBM: e.target.checked })}
              className="w-4.5 h-4.5 rounded border-slate-300 text-[#1876f2] focus:ring-[#1876f2]"
            />
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-900 dark:text-white">BM Criada?</p>
              <p className="text-[11px] text-slate-500 dark:text-white/50">Business Manager criado neste perfil</p>
            </div>
            <MIcon
              name={data.hasBM ? "business_center" : "work_outline"}
              className={`text-lg ${data.hasBM ? "text-[#1876f2]" : "text-slate-300 dark:text-white/20"}`}
            />
          </label>

          {/* Page */}
          <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer">
            <input
              type="checkbox"
              checked={data.hasPage}
              onChange={(e) => save({ ...data, hasPage: e.target.checked })}
              className="w-4.5 h-4.5 rounded border-slate-300 text-[#1876f2] focus:ring-[#1876f2]"
            />
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-900 dark:text-white">Página Criada?</p>
              <p className="text-[11px] text-slate-500 dark:text-white/50">Página do Facebook criada neste perfil</p>
            </div>
            <MIcon
              name={data.hasPage ? "flag" : "outlined_flag"}
              className={`text-lg ${data.hasPage ? "text-purple-500" : "text-slate-300 dark:text-white/20"}`}
            />
          </label>
        </div>

        {/* Friend count */}
        <div>
          <p className="text-xs font-bold text-slate-700 dark:text-white/70 mb-2 flex items-center gap-1.5">
            <MIcon name="group" className="text-sm text-[#1876f2]" />
            Quantidade de Amigos
          </p>
          <div className="grid grid-cols-4 gap-2">
            {FRIEND_RANGES.map((range) => {
              const isActive = data.friendRange === range.value;
              return (
                <button
                  key={range.value}
                  onClick={() => save({ ...data, friendRange: range.value })}
                  className={`py-2.5 px-2 rounded-lg border text-xs font-bold transition-all ${
                    isActive
                      ? "bg-[#1876f2] text-white border-[#1876f2] shadow-sm"
                      : "bg-white dark:bg-white/5 text-slate-700 dark:text-white/70 border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20"
                  }`}
                >
                  {range.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Summary */}
        <div className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-white/5">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0"
            style={{ backgroundColor: tier.color }}
          >
            {score}%
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-900 dark:text-white">{tier.level} — {tier.criteria}</p>
            <p className="text-[11px] text-slate-500 dark:text-white/50 mt-0.5">
              {data.has2FA ? "✅ 2FA" : "❌ 2FA"} • {data.hasBM ? "✅ BM" : "❌ BM"} • {data.hasPage ? "✅ Página" : "❌ Página"} • 👥 {FRIEND_RANGES.find(f => f.value === data.friendRange)?.label || "?"} amigos
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
