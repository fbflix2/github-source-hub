import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ArrowRightLeft } from "lucide-react";

type Department = { id: string; name: string };
type Member = { user_id: string; full_name: string | null; department_id: string | null };

interface Props {
  open: boolean;
  onClose: () => void;
  kind: "ticket" | "whatsapp";
  ticketId?: string;
  conversationPhone?: string;
  currentAssignee?: string | null;
  currentDepartmentId?: string | null;
  onTransferred?: (toUserId: string | null, toDepartmentId: string | null) => void;
}

export function ConversationTransferModal({
  open,
  onClose,
  kind,
  ticketId,
  conversationPhone,
  currentAssignee,
  currentDepartmentId,
  onTransferred,
}: Props) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [toDepartmentId, setToDepartmentId] = useState<string>("__keep__");
  const [toUserId, setToUserId] = useState<string>("__keep__");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setToDepartmentId(currentDepartmentId ?? "__keep__");
    setToUserId(currentAssignee ?? "__keep__");
    setNote("");
    setLoading(true);
    (async () => {
      const [{ data: deps }, { data: roles }] = await Promise.all([
        supabase.from("departments" as any).select("id, name").order("sort_order"),
        supabase.from("user_roles").select("user_id").in("role", ["admin", "moderator"]),
      ]);
      const userIds = Array.from(new Set((roles ?? []).map((r: any) => r.user_id)));
      let profs: any[] = [];
      if (userIds.length > 0) {
        const { data } = await supabase
          .from("profiles")
          .select("user_id, full_name, department_id")
          .in("user_id", userIds);
        profs = data ?? [];
      }
      setDepartments((deps as any) ?? []);
      setMembers(profs);
      setLoading(false);
    })();
  }, [open, currentAssignee, currentDepartmentId]);

  const filteredMembers =
    toDepartmentId === "__keep__" || toDepartmentId === "__any__"
      ? members
      : members.filter((m) => m.department_id === toDepartmentId);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const finalUserId = toUserId === "__keep__" ? (currentAssignee ?? null) : toUserId === "__none__" ? null : toUserId;
      const finalDeptId =
        toDepartmentId === "__keep__"
          ? (currentDepartmentId ?? null)
          : toDepartmentId === "__any__"
            ? null
            : toDepartmentId;

      // 1) Log the transfer
      const { error: logErr } = await supabase.from("conversation_transfers" as any).insert({
        kind,
        ticket_id: kind === "ticket" ? ticketId ?? null : null,
        conversation_phone: kind === "whatsapp" ? conversationPhone ?? null : null,
        from_user_id: currentAssignee ?? null,
        to_user_id: finalUserId,
        from_department_id: currentDepartmentId ?? null,
        to_department_id: finalDeptId,
        note: note.trim() || null,
        created_by: user.id,
      });
      if (logErr) throw logErr;

      // 2) Update the target record
      if (kind === "ticket" && ticketId) {
        const { error } = await supabase
          .from("tickets")
          .update({ assigned_to: finalUserId, department_id: finalDeptId } as any)
          .eq("id", ticketId);
        if (error) throw error;
      } else if (kind === "whatsapp" && conversationPhone) {
        const { error } = await supabase
          .from("whatsapp_conversations")
          .update({ assigned_to: finalUserId, department_id: finalDeptId } as any)
          .eq("phone", conversationPhone);
        if (error) throw error;
      }

      toast.success("Atendimento transferido");
      onTransferred?.(finalUserId, finalDeptId);
      onClose();
    } catch (e: any) {
      toast.error("Erro: " + (e.message || e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="size-4 text-primary" />
            Transferir Atendimento
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Departamento</label>
              <Select value={toDepartmentId} onValueChange={(v) => { setToDepartmentId(v); setToUserId("__keep__"); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__keep__">Manter atual</SelectItem>
                  <SelectItem value="__any__">Sem departamento</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Atendente</label>
              <Select value={toUserId} onValueChange={setToUserId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__keep__">Manter atual</SelectItem>
                  <SelectItem value="__none__">Sem atribuição</SelectItem>
                  {filteredMembers.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.full_name || m.user_id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filteredMembers.length === 0 && toDepartmentId !== "__keep__" && toDepartmentId !== "__any__" && (
                <p className="text-[11px] text-amber-500 mt-1">
                  Nenhum atendente neste departamento.
                </p>
              )}
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Observação (opcional)</label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Motivo da transferência, contexto..."
                rows={3}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={submitting || loading}>
            {submitting && <Loader2 className="size-4 animate-spin mr-1" />}
            Transferir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}