import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Plus, Trash2, Pencil, Save, Clock, Image as ImageIcon, 
  Type, Music, Play, Send, Loader2, ChevronDown, ChevronUp 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function WhatsAppFlows() {
  const queryClient = useQueryClient();
  const [isAddingFlow, setIsAddingFlow] = useState(false);
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);
  const [newFlowName, setNewFlowName] = useState("");
  const [newFlowDesc, setNewFlowDesc] = useState("");

  const { data: flows, isLoading } = useQuery({
    queryKey: ["whatsapp-flows"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_flows")
        .select("*, steps:whatsapp_flow_steps(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createFlow = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      
      const { data, error } = await supabase
        .from("whatsapp_flows")
        .insert({
          name: newFlowName,
          description: newFlowDesc,
          user_id: user.id
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-flows"] });
      setIsAddingFlow(false);
      setNewFlowName("");
      setNewFlowDesc("");
      toast.success("Fluxo criado com sucesso!");
    },
    onError: (err: any) => toast.error("Erro ao criar fluxo: " + err.message),
  });

  const deleteFlow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("whatsapp_flows").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-flows"] });
      toast.success("Fluxo excluído!");
    },
  });

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Fluxos de Mensagens</h3>
        <Button onClick={() => setIsAddingFlow(true)} size="sm" className="bg-green-600 hover:bg-green-700">
          <Plus className="size-4 mr-2" /> Novo Fluxo
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {flows?.map((flow) => (
          <FlowCard key={flow.id} flow={flow} onDelete={() => deleteFlow.mutate(flow.id)} />
        ))}
        {flows?.length === 0 && (
          <div className="col-span-full py-12 text-center border border-dashed rounded-xl border-border">
            <p className="text-muted-foreground">Nenhum fluxo criado ainda.</p>
          </div>
        )}
      </div>

      <Dialog open={isAddingFlow} onOpenChange={setIsAddingFlow}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Novo Fluxo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome do Fluxo</label>
              <Input 
                placeholder="Ex: Funil de Vendas - Proxy" 
                value={newFlowName}
                onChange={(e) => setNewFlowName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Descrição (Opcional)</label>
              <Textarea 
                placeholder="Descreva o objetivo deste fluxo..." 
                value={newFlowDesc}
                onChange={(e) => setNewFlowDesc(e.target.value)}
              />
            </div>
            <Button 
              className="w-full bg-green-600" 
              onClick={() => createFlow.mutate()}
              disabled={!newFlowName || createFlow.isPending}
            >
              Criar Fluxo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FlowCard({ flow, onDelete }: { flow: any; onDelete: () => void }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showAddStep, setShowAddStep] = useState(false);
  const queryClient = useQueryClient();

  // Test Flow
  const [testPhone, setTestPhone] = useState("");
  const [isTesting, setIsTesting] = useState(false);

  const steps = (flow.steps || []).sort((a: any, b: any) => a.step_order - b.step_order);

  const deleteStep = useMutation({
    mutationFn: async (stepId: string) => {
      const { error } = await supabase.from("whatsapp_flow_steps").delete().eq("id", stepId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-flows"] });
      toast.success("Passo excluído!");
    },
  });

  const handleTestFlow = async () => {
    if (!testPhone) return toast.error("Informe um número");
    setIsTesting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/wapi-send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ 
          action: "trigger-flow", 
          flow_id: flow.id, 
          phone: testPhone,
          user_id: session?.user?.id
        }),
      });
      
      if (!res.ok) throw new Error("Erro ao disparar fluxo");
      
      toast.success("Fluxo disparado! As mensagens serão enviadas conforme os atrasos configurados.");
      setTestPhone("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card className="overflow-hidden border-border/40 hover:border-primary/30 transition-all">
      <CardHeader className="p-4 bg-muted/30">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-sm font-bold truncate">{flow.name}</CardTitle>
            <p className="text-[10px] text-muted-foreground truncate">{flow.description || "Sem descrição"}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setIsExpanded(!isExpanded)}>
              {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400" onClick={() => {
              if (confirm("Excluir este fluxo?")) onDelete();
            }}>
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="p-4 space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Passos do Fluxo</span>
              <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => setShowAddStep(true)}>
                <Plus className="size-3 mr-1" /> Add Passo
              </Button>
            </div>
            
            <div className="space-y-2">
              {steps.map((step: any, idx: number) => (
                <div key={step.id} className="group relative flex gap-3 p-3 rounded-lg bg-black/20 border border-border/20">
                  <div className="flex flex-col items-center gap-1">
                    <div className="size-6 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">
                      {idx + 1}
                    </div>
                    {step.delay_minutes > 0 && (
                      <div className="flex flex-col items-center">
                         <div className="w-0.5 h-4 bg-border/20" />
                         <span className="text-[9px] text-muted-foreground font-medium">+{step.delay_minutes}min</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {step.message_type === 'text' && <Type className="size-3 text-blue-400" />}
                      {step.message_type === 'image' && <ImageIcon className="size-3 text-green-400" />}
                      {step.message_type === 'audio' && <Music className="size-3 text-purple-400" />}
                      <span className="text-[10px] font-bold uppercase text-muted-foreground">
                        {step.message_type === 'text' ? 'Texto' : step.message_type === 'image' ? 'Imagem' : 'Áudio'}
                      </span>
                    </div>
                    <p className="text-xs text-foreground line-clamp-3 whitespace-pre-wrap">
                      {step.content}
                    </p>
                  </div>
                  
                  <button 
                    onClick={() => deleteStep.mutate(step.id)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-400"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              ))}
              
              {steps.length === 0 && (
                <p className="text-center py-4 text-[11px] text-muted-foreground">Nenhum passo configurado.</p>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-border/40 space-y-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Testar Fluxo</span>
            <div className="flex gap-2">
              <Input 
                placeholder="WhatsApp (ex: 55...)" 
                className="h-8 text-xs" 
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
              />
              <Button 
                size="sm" 
                className="h-8 bg-blue-600 hover:bg-blue-700"
                onClick={handleTestFlow}
                disabled={isTesting}
              >
                {isTesting ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3 mr-1" />}
                Disparar
              </Button>
            </div>
          </div>
        </CardContent>
      )}

      <AddStepDialog 
        open={showAddStep} 
        onOpenChange={setShowAddStep} 
        flowId={flow.id} 
        nextOrder={steps.length + 1} 
      />
    </Card>
  );
}

function AddStepDialog({ open, onOpenChange, flowId, nextOrder }: { open: boolean, onOpenChange: (o: boolean) => void, flowId: string, nextOrder: number }) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<"text" | "image" | "audio">("text");
  const [content, setContent] = useState("");
  const [delay, setDelay] = useState(0);

  const addStep = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("whatsapp_flow_steps")
        .insert({
          flow_id: flowId,
          step_order: nextOrder,
          message_type: type,
          content: content,
          delay_minutes: delay
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-flows"] });
      onOpenChange(false);
      setContent("");
      setDelay(0);
      toast.success("Passo adicionado!");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar Passo ao Fluxo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Tipo de Mensagem</label>
            <Select value={type} onValueChange={(v: any) => setType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Texto</SelectItem>
                <SelectItem value="image">Imagem (URL)</SelectItem>
                <SelectItem value="audio">Áudio (URL)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {type === 'text' ? 'Mensagem' : type === 'image' ? 'URL da Imagem' : 'URL do Áudio'}
            </label>
            {type === 'text' ? (
              <Textarea 
                placeholder="Digite a mensagem..." 
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[100px]"
              />
            ) : (
              <Input 
                placeholder="https://..." 
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            )}
            <p className="text-[10px] text-muted-foreground">
              Você pode usar {"{{nome}}"} para personalizar com o nome do cliente.
            </p>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Atraso após passo anterior (minutos)</label>
            <Input 
              type="number" 
              value={delay}
              onChange={(e) => setDelay(Number(e.target.value))}
            />
            <p className="text-[10px] text-muted-foreground">
              0 significa envio imediato após o passo anterior.
            </p>
          </div>
          
          <Button 
            className="w-full bg-green-600" 
            onClick={() => addStep.mutate()}
            disabled={!content || addStep.isPending}
          >
            Adicionar Passo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
