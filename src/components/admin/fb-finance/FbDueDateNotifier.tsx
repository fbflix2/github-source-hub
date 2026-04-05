import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const NOTIFIED_KEY = "fb_finance_due_notified";

function getNotifiedSet(): Set<string> {
  try {
    const raw = sessionStorage.getItem(NOTIFIED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveNotifiedSet(s: Set<string>) {
  sessionStorage.setItem(NOTIFIED_KEY, JSON.stringify([...s]));
}

function playAlertSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    gain.gain.value = 0.3;

    // Two-tone alert
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch {}
}

const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function FbDueDateNotifier() {
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const check = async () => {
      const today = new Date();
      const todayDay = today.getDate();
      const tomorrowDay = todayDay + 1;
      const mesRef = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
      const notified = getNotifiedSet();
      let hasNew = false;

      // Fetch planned expenses for current month
      const { data: planejadas } = await supabase
        .from("fb_finance_despesas_planejadas")
        .select("*")
        .eq("mes_ref", mesRef)
        .eq("pago", false)
        .in("dia_vencimento", [todayDay, tomorrowDay]);

      // Fetch active personal costs with matching due days
      const { data: custos } = await supabase
        .from("fb_finance_custos_pessoais")
        .select("*")
        .eq("ativo", true)
        .in("dia_vencimento", [todayDay, tomorrowDay]);

      const items: { nome: string; valor: number; dia: number; key: string }[] = [];

      if (planejadas) {
        for (const p of planejadas as any[]) {
          items.push({ nome: p.nome, valor: p.valor, dia: p.dia_vencimento, key: `plan-${p.id}-${mesRef}` });
        }
      }
      if (custos) {
        for (const c of custos as any[]) {
          // Avoid duplicate if already in planejadas
          const dup = (planejadas || []).some(
            (p: any) => p.nome.toLowerCase().trim() === c.nome.toLowerCase().trim() && p.dia_vencimento === c.dia_vencimento
          );
          if (!dup) {
            items.push({ nome: c.nome, valor: c.valor, dia: c.dia_vencimento, key: `custo-${c.id}-${mesRef}` });
          }
        }
      }

      for (const item of items) {
        if (notified.has(item.key)) continue;
        notified.add(item.key);
        hasNew = true;

        const isToday = item.dia === todayDay;
        const prefix = isToday ? "🔴 Vence HOJE" : "⚠️ Vence AMANHÃ";

        toast({
          title: `${prefix}: ${item.nome}`,
          description: `Valor: ${formatBRL(Number(item.valor))} — Dia ${item.dia}`,
          duration: 8000,
        });
      }

      if (hasNew) {
        playAlertSound();
        saveNotifiedSet(notified);
      }
    };

    // Small delay to not block initial render
    const timer = setTimeout(check, 1500);
    return () => clearTimeout(timer);
  }, []);

  return null;
}
