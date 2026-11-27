import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type NoticeSettings = {
  enabled: boolean; message: string; activated_at: string | null;
  counts: Record<string, number | null>;
};
async function requestNotice(body: Record<string, unknown>): Promise<NoticeSettings> {
  const { data, error } = await supabase.functions.invoke("wa-new-contact-notice", { body });
  if (error || !data?.success) throw new Error(data?.error || error?.message || "Falha ao consultar o aviso.");
  return data;
}
export function WhatsAppNewContactNotice() {
  const qc = useQueryClient();
  const [message, setMessage] = useState("");
  const query = useQuery({
    queryKey: ["wa-new-contact-notice"],
    queryFn: () => requestNotice({ action: "get" }),
    refetchInterval: 30000,
  });
  useEffect(() => { if (query.data) setMessage(query.data.message); }, [query.data?.message]);
  const save = useMutation({
    mutationFn: (enabled: boolean) => requestNotice({ action: "save", enabled, message }),
    onSuccess: (data) => {
      qc.setQueryData(["wa-new-contact-notice"], data);
      toast.success(data.enabled ? "Aviso automático ativo." : "Aviso automático desativado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const settings = query.data;
  const canSave = !!settings && !!message.trim() && message.length <= 3000 && !save.isPending;
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2"><Bell className="size-4 text-amber-500" /> Aviso automático para novos contatos</CardTitle>
          {settings && <Badge variant={settings.enabled ? "default" : "secondary"}>{settings.enabled ? "Ativo" : "Desativado"}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">Responde uma única vez quando um número sem histórico no CRM envia uma nova mensagem individual. Não dispara para contatos antigos, grupos ou mensagens anteriores à ativação.</p>
        {query.isLoading ? <p className="text-xs text-muted-foreground">Carregando configuração...</p> : query.isError ? <p className="text-xs text-destructive">Não foi possível consultar o aviso. Verifique a conexão e as permissões administrativas.</p> : settings && <>
          <Textarea aria-label="Mensagem automática" value={message} maxLength={3000} rows={9} onChange={e => setMessage(e.target.value)} />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" disabled={!canSave || message === settings.message} onClick={() => save.mutate(settings.enabled)}>Salvar mensagem</Button>
            <Button size="sm" variant={settings.enabled ? "destructive" : "default"} disabled={save.isPending || (!settings.enabled && !canSave)} onClick={() => save.mutate(!settings.enabled)}>
              {save.isPending && <Loader2 className="size-4 animate-spin mr-1" />}{settings.enabled ? "Desativar aviso" : "Ativar aviso"}
            </Button>
          </div>
          {settings.activated_at && <p className="text-xs text-muted-foreground">Última ativação: {new Date(settings.activated_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {([["sent","Aceitos pela W-API"],["failed","Falhas"],["unknown","Sem confirmação"],["pending","Em processamento"]] as const).map(([key,label]) => <div key={key} className="rounded-lg border border-border p-2"><p className="text-xs text-muted-foreground">{label}</p><strong className="text-sm">{settings.counts?.[key] ?? "—"}</strong></div>)}
          </div>
          <p className="text-xs text-muted-foreground">Falhas e envios sem confirmação não são repetidos automaticamente, para evitar mensagens duplicadas.</p>
        </>}
      </CardContent>
    </Card>
  );
}
