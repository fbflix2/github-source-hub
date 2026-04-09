import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_PROFILE_QUALITY_DATA,
  type ProfileQualityData,
} from "@/lib/warming-ready";

function MIcon({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

const FRIEND_RANGES = [
  { value: "0-5", label: "0 a 5", score: 0 },
  { value: "5-19", label: "5 a 19", score: 1 },
  { value: "20-50", label: "20 a 50", score: 2 },
  { value: "50-100+", label: "50 a +100", score: 3 },
];

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
  const max = 6;
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

export default function ProfileQuickInfo({ profileId }: { profileId: string }) {
  const [data, setData] = useState<ProfileQualityData>(DEFAULT_PROFILE_QUALITY_DATA);
  const [loaded, setLoaded] = useState(false);

  const loadData = (pid: string) => {
    const key = `warming_quality_${pid}`;
    supabase
      .from("site_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle()
      .then(({ data: row }) => {
        if (row?.value) {
          try { setData({ ...DEFAULT_PROFILE_QUALITY_DATA, ...JSON.parse(row.value) }); } catch {}
        }
        setLoaded(true);
      });
  };

  useEffect(() => {
    setData(DEFAULT_PROFILE_QUALITY_DATA);
    setLoaded(false);
    loadData(profileId);
  }, [profileId]);

  const saveFriendRange = async (range: string) => {
    const newData = { ...data, friendRange: range };
    setData(newData);
    const key = `warming_quality_${profileId}`;
    const jsonValue = JSON.stringify(newData);
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
  };

  if (!loaded) return null;

  const score = calcScore(data);
  const tier = getTierForScore(score);
  const friendLabel = FRIEND_RANGES.find(f => f.value === data.friendRange)?.label || "?";

  return (
    <div className="bg-white dark:bg-white/5 rounded-xl shadow-sm border border-slate-200 dark:border-white/10 overflow-hidden">
      <div className="p-4 space-y-3">
        {/* Friend count */}
        <div>
          <p className="text-[11px] font-bold text-slate-700 dark:text-white/70 mb-2 flex items-center gap-1.5">
            <MIcon name="group" className="text-sm text-[#1876f2]" />
            Quantidade de Amigos
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {FRIEND_RANGES.map((range) => {
              const isActive = data.friendRange === range.value;
              return (
                <div
                  key={range.value}
                  className={`py-1.5 px-1 rounded-lg border text-[10px] font-bold text-center ${
                    isActive
                      ? "bg-[#1876f2] text-white border-[#1876f2]"
                      : "bg-white dark:bg-white/5 text-slate-500 dark:text-white/50 border-slate-200 dark:border-white/10"
                  }`}
                >
                  {range.label}
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary */}
        <div className="flex items-center gap-2.5 p-2.5 rounded-lg border border-dashed border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-white/5">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-black shrink-0"
            style={{ backgroundColor: tier.color }}
          >
            {score}%
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-slate-900 dark:text-white leading-tight">{tier.level} — {tier.criteria}</p>
            <p className="text-[10px] text-slate-500 dark:text-white/50 mt-0.5">
              {data.has2FA ? "✅ 2FA" : "❌ 2FA"} • {data.hasBM ? "✅ BM" : "❌ BM"} • {data.hasPage ? "✅ Página" : "❌ Página"} • 👥 {friendLabel} amigos
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
