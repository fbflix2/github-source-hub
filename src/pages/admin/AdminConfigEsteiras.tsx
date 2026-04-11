import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, GripVertical, X, Pencil, Trash2, Power, PowerOff, ChevronDown, ChevronUp, Flame, Save } from "lucide-react";

interface PipelineTask {
  title: string;
  description: string;
}

interface Pipeline {
  id: string;
  name: string;
  description: string | null;
  track_days: number;
  tasks: PipelineTask[];
  is_active: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export default function AdminConfigEsteiras() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDays, setNewDays] = useState(7);
  const [saving, setSaving] = useState(false);

  // Drag state for tasks
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const loadPipelines = useCallback(async () => {
    const { data } = await supabase
      .from("pipeline_templates")
      .select("*")
      .order("position", { ascending: true });
    if (data) {
      setPipelines(data.map(p => ({
        ...p,
        tasks: Array.isArray(p.tasks) ? p.tasks as PipelineTask[] : [],
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadPipelines(); }, [loadPipelines]);

  const createPipeline = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("pipeline_templates").insert({
      name: newName.trim(),
      description: newDesc.trim() || null,
      track_days: newDays,
      tasks: [],
      position: pipelines.length,
    });
    if (error) { toast.error("Erro ao criar esteira"); }
    else {
      toast.success("Esteira criada!");
      setNewName(""); setNewDesc(""); setNewDays(7); setShowNewForm(false);
      await loadPipelines();
    }
    setSaving(false);
  };

  const toggleActive = async (p: Pipeline) => {
    await supabase.from("pipeline_templates").update({ is_active: !p.is_active }).eq("id", p.id);
    toast.success(p.is_active ? "Esteira desativada" : "Esteira ativada");
    loadPipelines();
  };

  const deletePipeline = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta esteira?")) return;
    await supabase.from("pipeline_templates").delete().eq("id", id);
    toast.success("Esteira excluída");
    if (expandedId === id) setExpandedId(null);
    loadPipelines();
  };

  const updatePipelineField = async (id: string, field: string, value: any) => {
    await supabase.from("pipeline_templates").update({ [field]: value }).eq("id", id);
  };

  const updateTasks = async (id: string, tasks: PipelineTask[]) => {
    setPipelines(prev => prev.map(p => p.id === id ? { ...p, tasks } : p));
    await supabase.from("pipeline_templates").update({ tasks: tasks as any }).eq("id", id);
  };

  const addTask = (pipelineId: string, title: string) => {
    const pipeline = pipelines.find(p => p.id === pipelineId);
    if (!pipeline) return;
    const newTasks = [...pipeline.tasks, { title, description: "" }];
    updateTasks(pipelineId, newTasks);
  };

  const removeTask = (pipelineId: string, index: number) => {
    const pipeline = pipelines.find(p => p.id === pipelineId);
    if (!pipeline) return;
    updateTasks(pipelineId, pipeline.tasks.filter((_, i) => i !== index));
  };

  const updateTask = (pipelineId: string, index: number, field: "title" | "description", value: string) => {
    const pipeline = pipelines.find(p => p.id === pipelineId);
    if (!pipeline) return;
    const newTasks = [...pipeline.tasks];
    newTasks[index] = { ...newTasks[index], [field]: value };
    updateTasks(pipelineId, newTasks);
  };

  const handleDragDrop = (pipelineId: string, fromIndex: number, toIndex: number) => {
    const pipeline = pipelines.find(p => p.id === pipelineId);
    if (!pipeline || fromIndex === toIndex) return;
    const items = [...pipeline.tasks];
    const [moved] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, moved);
    updateTasks(pipelineId, items);
  };

  // debounced save for inline name/desc edits
  const [editTimers, setEditTimers] = useState<Record<string, ReturnType<typeof setTimeout>>>({});
  const debouncedUpdate = (id: string, field: string, value: any) => {
    if (editTimers[id + field]) clearTimeout(editTimers[id + field]);
    const timer = setTimeout(() => updatePipelineField(id, field, value), 800);
    setEditTimers(prev => ({ ...prev, [id + field]: timer }));
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="flex-1 p-6 md:p-10 max-w-5xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Flame className="h-6 w-6 text-orange-500" />
            <div>
              <h1 className="text-xl font-bold dark:text-white">Config Esteiras</h1>
              <p className="text-xs text-slate-500 dark:text-white/40">Gerencie todas as esteiras de produtos e aquecimento</p>
            </div>
          </div>
          <button
            onClick={() => setShowNewForm(!showNewForm)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nova Esteira
          </button>
        </div>

        {/* New Pipeline Form */}
        {showNewForm && (
          <div className="bg-white dark:bg-white/5 rounded-xl border border-orange-200 dark:border-orange-500/20 p-6 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <h3 className="font-bold text-sm dark:text-white">Criar Nova Esteira</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-500 dark:text-white/50 uppercase tracking-wider">Nome</label>
                <input
                  className="w-full mt-1 bg-slate-50 dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm dark:text-white"
                  placeholder="Ex: Esteira BM Premium"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-white/50 uppercase tracking-wider">Dias</label>
                <input
                  type="number"
                  min={1}
                  className="w-full mt-1 bg-slate-50 dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm dark:text-white"
                  value={newDays}
                  onChange={e => setNewDays(Number(e.target.value) || 7)}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-white/50 uppercase tracking-wider">Descrição (opcional)</label>
              <input
                className="w-full mt-1 bg-slate-50 dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm dark:text-white"
                placeholder="Breve descrição da esteira..."
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={createPipeline}
                disabled={saving || !newName.trim()}
                className="px-5 py-2 text-sm font-bold text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                {saving ? "Criando..." : "Criar Esteira"}
              </button>
              <button
                onClick={() => { setShowNewForm(false); setNewName(""); setNewDesc(""); setNewDays(7); }}
                className="px-5 py-2 text-sm font-bold text-slate-600 dark:text-white/60 bg-slate-100 dark:bg-white/10 rounded-lg hover:bg-slate-200 dark:hover:bg-white/20 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && <div className="text-center py-12 text-slate-400 dark:text-white/40">Carregando esteiras...</div>}

        {/* Pipeline List */}
        {!loading && pipelines.length === 0 && (
          <div className="text-center py-16 text-slate-400 dark:text-white/30">
            <Flame className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-bold">Nenhuma esteira criada</p>
            <p className="text-sm mt-1">Clique em "Nova Esteira" para começar</p>
          </div>
        )}

        {!loading && pipelines.map(pipeline => {
          const isExpanded = expandedId === pipeline.id;

          return (
            <div
              key={pipeline.id}
              className={`bg-white dark:bg-white/5 rounded-xl shadow-sm border transition-all ${
                pipeline.is_active
                  ? "border-orange-200 dark:border-orange-500/20"
                  : "border-slate-200 dark:border-white/10 opacity-60"
              }`}
            >
              {/* Pipeline Header */}
              <div
                className="px-6 py-4 flex items-center gap-4 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : pipeline.id)}
              >
                <Flame className={`h-5 w-5 flex-shrink-0 ${pipeline.is_active ? "text-orange-500" : "text-slate-400 dark:text-white/30"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm dark:text-white truncate">{pipeline.name}</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      pipeline.is_active
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                        : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-white/40"
                    }`}>
                      {pipeline.is_active ? "Ativa" : "Inativa"}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-white/30 font-mono">
                      {pipeline.track_days} dias · {pipeline.tasks.length} tarefas
                    </span>
                  </div>
                  {pipeline.description && (
                    <p className="text-xs text-slate-500 dark:text-white/40 truncate mt-0.5">{pipeline.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={e => { e.stopPropagation(); toggleActive(pipeline); }}
                    className={`p-1.5 rounded-lg transition-colors ${
                      pipeline.is_active
                        ? "text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                        : "text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
                    }`}
                    title={pipeline.is_active ? "Desativar" : "Ativar"}
                  >
                    {pipeline.is_active ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); deletePipeline(pipeline.id); }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </div>
              </div>

              {/* Expanded: Pipeline Editor */}
              {isExpanded && (
                <div className="border-t border-slate-100 dark:border-white/10">
                  {/* Inline name/desc/days edit */}
                  <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50/50 dark:bg-white/[0.02]">
                    <div className="md:col-span-2">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-white/40 uppercase tracking-wider">Nome</label>
                      <input
                        className="w-full mt-1 bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-sm dark:text-white"
                        value={pipeline.name}
                        onChange={e => {
                          const val = e.target.value;
                          setPipelines(prev => prev.map(p => p.id === pipeline.id ? { ...p, name: val } : p));
                          debouncedUpdate(pipeline.id, "name", val);
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 dark:text-white/40 uppercase tracking-wider">Dias</label>
                      <input
                        type="number"
                        min={1}
                        className="w-full mt-1 bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-sm dark:text-white"
                        value={pipeline.track_days}
                        onChange={e => {
                          const val = Number(e.target.value) || 7;
                          setPipelines(prev => prev.map(p => p.id === pipeline.id ? { ...p, track_days: val } : p));
                          debouncedUpdate(pipeline.id, "track_days", val);
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 dark:text-white/40 uppercase tracking-wider">Descrição</label>
                      <input
                        className="w-full mt-1 bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-sm dark:text-white"
                        placeholder="Opcional..."
                        value={pipeline.description || ""}
                        onChange={e => {
                          const val = e.target.value;
                          setPipelines(prev => prev.map(p => p.id === pipeline.id ? { ...p, description: val || null } : p));
                          debouncedUpdate(pipeline.id, "description", val || null);
                        }}
                      />
                    </div>
                  </div>

                  {/* Tasks */}
                  <div className="p-6 space-y-2 max-h-[500px] overflow-y-auto">
                    {pipeline.tasks.map((task, i) => (
                      <div
                        key={`${pipeline.id}-${i}`}
                        draggable
                        onDragStart={() => setDragIndex(i)}
                        onDragOver={e => { e.preventDefault(); setDragOverIndex(i); }}
                        onDrop={() => {
                          if (dragIndex !== null) handleDragDrop(pipeline.id, dragIndex, i);
                          setDragIndex(null); setDragOverIndex(null);
                        }}
                        onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                        className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                          dragOverIndex === i ? "border-orange-500 bg-orange-50 dark:bg-orange-500/10" :
                          dragIndex === i ? "opacity-50 border-slate-100 dark:border-white/10" :
                          "border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-white/5"
                        }`}
                      >
                        <span className="flex-shrink-0 w-7 h-7 flex items-center justify-center bg-orange-100 dark:bg-orange-500/20 text-orange-600 font-bold text-[10px] rounded-full mt-0.5">
                          D{i + 1}
                        </span>
                        <div className="flex-1 space-y-1 min-w-0">
                          <input
                            className="w-full bg-transparent border-none p-0 text-sm font-bold focus:ring-0 outline-none dark:text-white"
                            value={task.title}
                            onChange={e => updateTask(pipeline.id, i, "title", e.target.value)}
                          />
                          <textarea
                            className="w-full bg-transparent border-none p-0 text-xs text-slate-500 dark:text-white/50 focus:ring-0 outline-none resize-none overflow-hidden"
                            placeholder="Descrição..."
                            rows={1}
                            value={task.description}
                            onChange={e => {
                              e.target.style.height = "auto";
                              e.target.style.height = e.target.scrollHeight + "px";
                              updateTask(pipeline.id, i, "description", e.target.value);
                            }}
                            onFocus={e => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
                          />
                        </div>
                        <button
                          onClick={() => removeTask(pipeline.id, i)}
                          className="text-slate-300 hover:text-red-500 dark:text-white/20 dark:hover:text-red-400 transition-colors mt-0.5"
                        >
                          <X className="h-4 w-4" />
                        </button>
                        <GripVertical className="h-4 w-4 text-slate-300 dark:text-white/20 cursor-grab active:cursor-grabbing mt-0.5 flex-shrink-0" />
                      </div>
                    ))}

                    {/* Add new task */}
                    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-white/5 rounded-lg border border-dashed border-slate-200 dark:border-white/10">
                      <span className="flex-shrink-0 w-7 h-7 flex items-center justify-center bg-orange-100 dark:bg-orange-500/20 text-orange-600 font-bold text-[10px] rounded-full">
                        D{pipeline.tasks.length + 1}
                      </span>
                      <input
                        id={`new-task-${pipeline.id}`}
                        className="flex-1 bg-transparent border-none p-0 text-sm focus:ring-0 outline-none placeholder:text-slate-400 placeholder:italic dark:text-white"
                        placeholder={`Adicionar tarefa para o Dia ${pipeline.tasks.length + 1}...`}
                        onKeyDown={e => {
                          if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
                            addTask(pipeline.id, (e.target as HTMLInputElement).value.trim());
                            (e.target as HTMLInputElement).value = "";
                          }
                        }}
                      />
                      <button
                        onClick={() => {
                          const input = document.getElementById(`new-task-${pipeline.id}`) as HTMLInputElement;
                          if (input?.value.trim()) {
                            addTask(pipeline.id, input.value.trim());
                            input.value = "";
                          }
                        }}
                        className="text-orange-500 hover:text-orange-600 transition-colors"
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
