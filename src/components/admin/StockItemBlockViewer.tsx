import { useState, useEffect, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StockItem {
  id: string;
  type: string;
  name: string;
  identification: string | null;
  identification_link: string | null;
  status: string;
  data: any;
  created_at: string;
}

interface Props {
  item: StockItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

function buildBlockText(item: StockItem): string {
  const d = item.data ?? {};
  const lines: string[] = [];

  if (item.type === "bm") {
    if (item.name) lines.push(`Nome: ${item.name}`);
    if (item.identification_link) lines.push(`Link: ${item.identification_link}`);
    if (d.notes) lines.push(`Notas: ${d.notes}`);
  } else {
    if (d.nomePerfil) lines.push(`Nome: ${d.nomePerfil}`);
    if (item.identification_link) lines.push(`Link: ${item.identification_link}`);
    if (item.identification) lines.push(`ID: ${item.identification}`);
    if (d.emailAcesso) lines.push(`Email: ${d.emailAcesso}`);
    if (d.senhaEmail) lines.push(`Senha Email: ${d.senhaEmail}`);
    if (d.emailAlternativo) lines.push(`Email Alt: ${d.emailAlternativo}`);
    if (d.senha) lines.push(`Senha FB: ${d.senha}`);
    if (d.token2fa) lines.push(`2FA: ${d.token2fa}`);
    if (d.dataNascimento) lines.push(`Nascimento: ${d.dataNascimento}`);
    if (d.genero) lines.push(`Gênero: ${d.genero}`);
    if (d.tempoPlataforma) lines.push(`Tempo: ${d.tempoPlataforma}`);
    if (d.statusAtual) lines.push(`Status: ${d.statusAtual}`);
    if (d.linkDocumento) lines.push(`Documento: ${d.linkDocumento}`);
    if (d.cookies) lines.push(`\nCookies:\n${d.cookies}`);
    if (d.descricao) lines.push(`\nDescrição:\n${d.descricao}`);
  }

  if (d.preco) lines.push(`Preço: R$ ${Number(d.preco).toFixed(2).replace(".", ",")}`);

  return lines.join("\n");
}

export function StockItemBlockViewer({ item, open, onOpenChange, onSaved }: Props) {
  const [status, setStatus] = useState("aguardando");
  const [qualityNotes, setQualityNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!item) return;
    setStatus(item.status);
    setQualityNotes(item.data?.quality_notes ?? "");
    setCopied(false);
    setSaved(false);
  }, [item]);

  const handleCopy = () => {
    if (!item) return;
    navigator.clipboard.writeText(buildBlockText(item));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveStatus = useCallback(async (newStatus: string) => {
    if (!item) return;
    setStatus(newStatus);
    const { error } = await supabase.from("stock_items").update({ status: newStatus }).eq("id", item.id);
    if (error) toast.error("Erro ao atualizar status");
    else onSaved();
  }, [item, onSaved]);

  // Auto-save quality notes with debounce
  useEffect(() => {
    if (!item) return;
    setSaved(false);
    const timeout = setTimeout(async () => {
      const currentData = item.data ?? {};
      if (qualityNotes === (currentData.quality_notes ?? "")) {
        if (qualityNotes) setSaved(true);
        return;
      }
      setSaving(true);
      const { error } = await supabase
        .from("stock_items")
        .update({ data: { ...currentData, quality_notes: qualityNotes } })
        .eq("id", item.id);
      setSaving(false);
      if (error) {
        toast.error("Erro ao salvar anotação");
      } else {
        setSaved(true);
        // Update item data in memory so subsequent comparisons work
        item.data = { ...currentData, quality_notes: qualityNotes };
      }
    }, 800);
    return () => clearTimeout(timeout);
  }, [qualityNotes, item]);

  if (!item) return null;

  const blockText = buildBlockText(item);

  const statusStyles: Record<string, string> = {
    aguardando: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    revisado: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    erro: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-zinc-900 border-zinc-800 text-white">
        <DialogHeader>
          <DialogTitle className="text-lg text-white flex items-center gap-3">
            {item.type === "bm" ? "BM" : "Perfil"} — {item.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Status selector */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-400">Status:</span>
            <Select value={status} onValueChange={saveStatus}>
              <SelectTrigger className="w-44 bg-black/30 border-white/5 text-white text-xs h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aguardando">Aguardando</SelectItem>
                <SelectItem value="revisado">Revisado</SelectItem>
                <SelectItem value="erro">Erro</SelectItem>
              </SelectContent>
            </Select>
            <Badge className={`text-xs ${statusStyles[status] || statusStyles.aguardando}`}>{status}</Badge>
          </div>

          {/* Block content */}
          <div className="relative">
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 p-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors z-10"
              title="Copiar bloco"
            >
              {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            </button>
            <pre className="bg-black/50 border border-white/5 rounded-xl p-4 text-sm text-zinc-200 font-mono whitespace-pre-wrap break-all min-h-[120px] select-all">
              {blockText}
            </pre>
          </div>

          {/* Quality notes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                📝 Anotações de Qualidade
              </label>
              <div className="flex items-center gap-1.5">
                {saving && (
                  <span className="flex items-center gap-1 text-xs text-amber-400 animate-pulse">
                    <Loader2 className="h-3 w-3 animate-spin" /> Salvando...
                  </span>
                )}
                {!saving && saved && (
                  <span className="flex items-center gap-1 text-xs text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" /> Salvo
                  </span>
                )}
              </div>
            </div>
            <textarea
              value={qualityNotes}
              onChange={(e) => setQualityNotes(e.target.value)}
              placeholder="Observações sobre a qualidade deste item... (ex: perfil com 2FA, BM ativa, sem restrições...)"
              className="w-full min-h-[100px] p-3 rounded-xl bg-black/30 border border-white/5 text-sm text-zinc-200 placeholder:text-zinc-600 resize-none outline-none focus:border-primary/30 transition-colors"
            />
            <p className="text-[10px] text-zinc-600">As anotações são salvas automaticamente.</p>
          </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
