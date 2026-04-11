import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { toast } from "sonner";

function MIcon({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

const defaultClientTasks: { title: string; description: string }[] = [
  { title: "Completar perfil", description: "Preencha foto, capa e bio do perfil." },
  { title: "Navegar organicamente", description: "Role o feed por 5-10 minutos, curta 3-5 posts." },
  { title: "Adicionar 5-10 amigos", description: "Envie solicitações de amizade para pessoas do seu nicho." },
  { title: "Engajar em grupos", description: "Comente em 2-3 grupos relacionados ao seu nicho." },
  { title: "Criar página", description: "Crie uma página comercial e publique 1-2 posts." },
  { title: "Ativar 2FA", description: "Configure autenticação de dois fatores para segurança." },
  { title: "Verificar restrições", description: "Verifique se a conta está sem restrições e pronta para uso." },
];

export default function AdminConfigEsteiras() {
  const [clientConfigTasks, setClientConfigTasks] = useState<{ title: string; description: string }[]>(defaultClientTasks);
  const [loading, setLoading] = useState(true);
  const clientConfigSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [clientDragIndex, setClientDragIndex] = useState<number | null>(null);
  const [clientDragOverIndex, setClientDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const { data } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "client_warming_track_config")
        .maybeSingle();
      if (data?.value) {
        try {
          const parsed = JSON.parse(data.value);
          if (Array.isArray(parsed)) {
            setClientConfigTasks(parsed);
          } else if (parsed?.["7_days"]) {
            setClientConfigTasks(parsed["7_days"]);
          }
        } catch {}
      }
    } catch {}
    setLoading(false);
  };

  const syncClientProfilesTasks = async (updatedTasks: { title: string; description: string }[]) => {
    try {
      const { data: activeProfiles } = await supabase
        .from("client_warming_profiles")
        .select("id")
        .eq("status", "ativo");

      if (!activeProfiles || activeProfiles.length === 0) return;

      for (const profile of activeProfiles) {
        const { data: existingTasks } = await supabase
          .from("client_warming_tasks")
          .select("*")
          .eq("profile_id", profile.id)
          .order("day_number", { ascending: true });

        const completionMap = new Map<number, { completed: boolean; completed_at: string | null }>();
        (existingTasks || []).forEach(t => {
          completionMap.set(t.day_number, { completed: t.completed, completed_at: t.completed_at });
        });

        await supabase.from("client_warming_tasks").delete().eq("profile_id", profile.id);

        const newTasks = updatedTasks.map((t, idx) => {
          const dayNum = idx + 1;
          const prev = completionMap.get(dayNum);
          return {
            profile_id: profile.id,
            day_number: dayNum,
            title: t.title,
            description: t.description,
            completed: prev?.completed ?? false,
            completed_at: prev?.completed_at ?? null,
          };
        });

        if (newTasks.length > 0) {
          await supabase.from("client_warming_tasks").insert(newTasks);
        }
      }

      toast.success(`Tarefas atualizadas para ${activeProfiles.length} perfil(is) ativo(s)`);
    } catch (err) {
      console.error("Erro ao sincronizar tarefas dos clientes:", err);
    }
  };

  const saveClientConfigToDB = (updatedTasks: { title: string; description: string }[]) => {
    if (clientConfigSaveTimer.current) clearTimeout(clientConfigSaveTimer.current);
    clientConfigSaveTimer.current = setTimeout(async () => {
      try {
        const jsonValue = JSON.stringify({ "7_days": updatedTasks });
        const { data: existing } = await supabase
          .from("site_settings")
          .select("id")
          .eq("key", "client_warming_track_config")
          .maybeSingle();
        if (existing) {
          await supabase.from("site_settings").update({ value: jsonValue }).eq("key", "client_warming_track_config");
        } else {
          await supabase.from("site_settings").insert({ key: "client_warming_track_config", value: jsonValue });
        }
        await syncClientProfilesTasks(updatedTasks);
      } catch (err) {
        console.error("Erro ao salvar config da esteira do cliente:", err);
      }
    }, 800);
  };

  const updateClientConfigTasks = (updater: (prev: { title: string; description: string }[]) => { title: string; description: string }[]) => {
    setClientConfigTasks(prev => {
      const next = updater(prev);
      saveClientConfigToDB(next);
      return next;
    });
  };

  const handleClientDragStart = (index: number) => setClientDragIndex(index);
  const handleClientDragOver = (e: React.DragEvent, index: number) => { e.preventDefault(); setClientDragOverIndex(index); };
  const handleClientDrop = (index: number) => {
    if (clientDragIndex === null || clientDragIndex === index) { setClientDragIndex(null); setClientDragOverIndex(null); return; }
    updateClientConfigTasks(prev => {
      const items = [...prev];
      const [moved] = items.splice(clientDragIndex!, 1);
      items.splice(index, 0, moved);
      return items;
    });
    setClientDragIndex(null);
    setClientDragOverIndex(null);
  };
  const handleClientDragEnd = () => { setClientDragIndex(null); setClientDragOverIndex(null); };

  return (
    <AdminLayout>
      <div className="flex-1 p-6 md:p-10 max-w-5xl mx-auto w-full space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <MIcon name="settings" className="text-orange-500 text-2xl" />
          <h1 className="text-xl font-bold dark:text-white">Config Esteiras</h1>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400">Carregando...</div>
        ) : (
          <section className="bg-white dark:bg-white/5 rounded-xl shadow-sm border border-orange-200 dark:border-orange-500/20 overflow-hidden">
            <div className="px-6 py-4 border-b border-orange-100 dark:border-orange-500/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MIcon name="local_fire_department" className="text-orange-500" />
                <div>
                  <h2 className="text-lg font-bold dark:text-white">Esteira do Cliente (7 Dias)</h2>
                  <p className="text-xs text-slate-500 dark:text-white/40">Tarefas que aparecem na esteira de aquecimento do cliente</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-3 max-h-[600px] overflow-y-auto">
              {clientConfigTasks.map((task, i) => (
                <div
                  key={`client-${i}`}
                  draggable
                  onDragStart={() => handleClientDragStart(i)}
                  onDragOver={(e) => handleClientDragOver(e, i)}
                  onDrop={() => handleClientDrop(i)}
                  onDragEnd={handleClientDragEnd}
                  className={`flex items-start gap-4 p-3 bg-slate-50 dark:bg-white/5 rounded-lg border transition-all ${
                    clientDragOverIndex === i ? "border-orange-500 bg-orange-50 dark:bg-orange-500/10" :
                    clientDragIndex === i ? "opacity-50 border-slate-100 dark:border-white/10" :
                    "border-slate-100 dark:border-white/10"
                  }`}
                >
                  <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-orange-100 dark:bg-orange-500/20 text-orange-600 font-bold text-xs rounded-full mt-1">
                    D{i + 1}
                  </span>
                  <div className="flex-1 space-y-1">
                    <input
                      className="w-full bg-transparent border-none p-0 text-sm font-bold focus:ring-0 outline-none dark:text-white"
                      type="text"
                      value={task.title}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateClientConfigTasks(prev => {
                          const updated = [...prev];
                          updated[i] = { ...updated[i], title: val };
                          return updated;
                        });
                      }}
                    />
                    <textarea
                      className="w-full bg-transparent border-none p-0 text-xs text-slate-500 dark:text-white/50 focus:ring-0 outline-none resize-none overflow-hidden"
                      placeholder="Descrição..."
                      rows={1}
                      value={task.description}
                      onChange={(e) => {
                        const val = e.target.value;
                        e.target.style.height = "auto";
                        e.target.style.height = e.target.scrollHeight + "px";
                        updateClientConfigTasks(prev => {
                          const updated = [...prev];
                          updated[i] = { ...updated[i], description: val };
                          return updated;
                        });
                      }}
                      onFocus={(e) => {
                        e.target.style.height = "auto";
                        e.target.style.height = e.target.scrollHeight + "px";
                      }}
                    />
                  </div>
                  <button
                    onClick={() => {
                      updateClientConfigTasks(prev => prev.filter((_, idx) => idx !== i));
                    }}
                    className="text-slate-300 hover:text-red-500 dark:text-white/20 dark:hover:text-red-400 transition-colors mt-1"
                  >
                    <MIcon name="close" className="text-base" />
                  </button>
                  <MIcon name="drag_indicator" className="text-slate-400 dark:text-white/40 text-sm cursor-grab active:cursor-grabbing mt-1" />
                </div>
              ))}
              <div className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-100 dark:border-white/10">
                <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-orange-100 dark:bg-orange-500/20 text-orange-600 font-bold text-xs rounded-full">
                  D{clientConfigTasks.length + 1}
                </span>
                <input
                  id="admin-new-client-track-action-config"
                  className="flex-1 bg-transparent border-none p-0 text-sm focus:ring-0 outline-none placeholder:text-slate-400 placeholder:italic dark:text-white"
                  type="text"
                  placeholder={`Adicionar tarefa para o Dia ${clientConfigTasks.length + 1}...`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
                      const newTitle = (e.target as HTMLInputElement).value.trim();
                      updateClientConfigTasks(prev => [...prev, { title: newTitle, description: "" }]);
                      (e.target as HTMLInputElement).value = "";
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const input = document.getElementById("admin-new-client-track-action-config") as HTMLInputElement;
                    if (input && input.value.trim()) {
                      const newTitle = input.value.trim();
                      updateClientConfigTasks(prev => [...prev, { title: newTitle, description: "" }]);
                      input.value = "";
                    }
                  }}
                  className="text-orange-500 hover:text-orange-600 transition-colors"
                >
                  <MIcon name="add_circle" className="text-xl" />
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </AdminLayout>
  );
}
