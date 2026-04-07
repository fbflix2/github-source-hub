import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

function MIcon({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

interface Props {
  profileId: string;
}

export default function ProfileQuickNotes({ profileId }: Props) {
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setNotes("");
    setLoaded(false);
    const key = `warming_notes_${profileId}`;
    supabase
      .from("site_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle()
      .then(({ data: row }) => {
        if (row?.value) setNotes(row.value);
        setLoaded(true);
      });
  }, [profileId]);

  const save = useCallback(async (value: string) => {
    setSaving(true);
    const key = `warming_notes_${profileId}`;
    try {
      const { data: existing } = await supabase
        .from("site_settings")
        .select("id")
        .eq("key", key)
        .maybeSingle();
      if (existing) {
        await supabase.from("site_settings").update({ value }).eq("key", key);
      } else {
        await supabase.from("site_settings").insert({ key, value });
      }
    } catch (err) {
      console.error("Erro ao salvar nota:", err);
    }
    setSaving(false);
  }, [profileId]);

  // Debounce auto-save
  useEffect(() => {
    if (!loaded) return;
    const timeout = setTimeout(() => {
      save(notes);
    }, 800);
    return () => clearTimeout(timeout);
  }, [notes, loaded, save]);

  if (!loaded) return null;

  return (
    <div className="w-full bg-white dark:bg-white/5 rounded-xl shadow-sm border border-slate-200 dark:border-white/10 overflow-hidden flex flex-col">
      <div className="px-3 py-2.5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <MIcon name="sticky_note_2" className="text-sm text-amber-500" />
          <h4 className="text-[11px] font-bold text-slate-900 dark:text-white uppercase tracking-wider">Anotações</h4>
        </div>
        {saving && <MIcon name="sync" className="text-xs text-slate-400 animate-spin" />}
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Observações sobre este perfil..."
        className="flex-1 p-3 text-xs text-slate-700 dark:text-white/80 bg-transparent resize-none outline-none placeholder:text-slate-400 dark:placeholder:text-white/30 min-h-[120px]"
      />
    </div>
  );
}
