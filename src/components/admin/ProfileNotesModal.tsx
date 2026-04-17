import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, StickyNote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  itemId: string | null;
  initialNotes: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (newNotes: string) => void;
}

export function ProfileNotesModal({ itemId, initialNotes, open, onOpenChange, onSaved }: Props) {
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNotes(initialNotes || "");
  }, [initialNotes, itemId]);

  const handleSave = async () => {
    if (!itemId) return;
    setSaving(true);
    try {
      // Fetch current data to preserve other fields
      const { data: current, error: fetchErr } = await supabase
        .from("stock_items")
        .select("data")
        .eq("id", itemId)
        .maybeSingle();
      if (fetchErr) throw fetchErr;

      const newData = { ...((current?.data as any) || {}), gestaoNotes: notes.trim() || undefined };

      const { error } = await supabase
        .from("stock_items")
        .update({ data: newData })
        .eq("id", itemId);
      if (error) throw error;

      toast.success("Observação salva!");
      onSaved(notes.trim());
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="size-4 text-amber-500" />
            Observações do Perfil
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anotações sobre este perfil..."
            className="min-h-[160px] resize-none"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
