import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface ImportClientsModalProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

interface ParsedClient {
  name: string;
  email: string;
  phone: string;
}

export default function ImportClientsModal({ open, onClose, onImported }: ImportClientsModalProps) {
  const [parsedClients, setParsedClients] = useState<ParsedClient[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setParsedClients([]);
    setFileName("");
    setImportResult(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        const clients: ParsedClient[] = [];
        for (const row of rows) {
          const name = String(row[0] || "").trim();
          const email = String(row[1] || "").trim();
          const phone = String(row[2] || "").trim();
          if (name && email) {
            clients.push({ name, email, phone });
          }
        }
        setParsedClients(clients);
      } catch {
        toast.error("Erro ao ler o arquivo. Verifique o formato.");
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset file input
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleImport = async () => {
    if (parsedClients.length === 0) return;
    setImporting(true);
    let success = 0;
    let failed = 0;

    const { data: { session } } = await supabase.auth.getSession();

    for (const client of parsedClients) {
      try {
        // Create user via edge function or directly sign up
        const { data, error } = await supabase.auth.admin?.createUser?.({
          email: client.email,
          password: Math.random().toString(36).slice(-10) + "A1!",
          email_confirm: true,
          user_metadata: { full_name: client.name },
        }) ?? { data: null, error: new Error("Admin API not available") };

        if (error) {
          // Try signUp as fallback
          const { error: signUpError } = await supabase.auth.signUp({
            email: client.email,
            password: Math.random().toString(36).slice(-10) + "A1!",
            options: { data: { full_name: client.name } },
          });
          if (signUpError) {
            failed++;
            continue;
          }
        }

        // Update phone if we have it - profile is created by trigger
        if (client.phone) {
          // Small delay for trigger to create profile
          await new Promise(r => setTimeout(r, 300));
          await supabase
            .from("profiles")
            .update({ phone: client.phone })
            .eq("full_name", client.name);
        }

        success++;
      } catch {
        failed++;
      }
    }

    setImportResult({ success, failed });
    setImporting(false);
    if (success > 0) onImported();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[#1a0a0a] border-white/10 text-white max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            Importar Clientes
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5 mt-2">
          {/* Instructions */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-white/60">
            <p className="font-semibold text-white/80 mb-2">Formato esperado do arquivo (.xlsx ou .csv):</p>
            <div className="flex gap-6 text-xs">
              <span className="bg-white/10 px-3 py-1 rounded-full">Coluna A: Nome</span>
              <span className="bg-white/10 px-3 py-1 rounded-full">Coluna B: Email</span>
              <span className="bg-white/10 px-3 py-1 rounded-full">Coluna C: Telefone</span>
            </div>
            <p className="mt-2 text-white/40 text-xs">Sem cabeçalho. Cada linha é um cliente.</p>
          </div>

          {/* File Input */}
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFile}
              className="hidden"
            />
            <Button
              onClick={() => fileRef.current?.click()}
              variant="outline"
              className="w-full h-20 border-dashed border-2 border-white/20 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex flex-col gap-1"
            >
              <FileSpreadsheet className="w-6 h-6" />
              <span className="text-sm">{fileName || "Clique para selecionar arquivo"}</span>
            </Button>
          </div>

          {/* Preview */}
          {parsedClients.length > 0 && !importResult && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white/80">
                  {parsedClients.length} clientes encontrados
                </p>
                <Button variant="ghost" size="sm" onClick={reset} className="text-white/40 hover:text-white h-7">
                  <X className="w-4 h-4 mr-1" /> Limpar
                </Button>
              </div>

              <div className="bg-white/5 rounded-xl border border-white/10 max-h-60 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-white/50 text-xs">
                      <th className="text-left p-3">#</th>
                      <th className="text-left p-3">Nome</th>
                      <th className="text-left p-3">Email</th>
                      <th className="text-left p-3">Telefone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedClients.slice(0, 50).map((c, i) => (
                      <tr key={i} className="border-b border-white/5 text-white/70">
                        <td className="p-3 text-white/30">{i + 1}</td>
                        <td className="p-3 font-medium text-white/90">{c.name}</td>
                        <td className="p-3">{c.email}</td>
                        <td className="p-3">{c.phone || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedClients.length > 50 && (
                  <p className="text-center text-xs text-white/30 py-2">
                    ... e mais {parsedClients.length - 50} clientes
                  </p>
                )}
              </div>

              <Button
                onClick={handleImport}
                disabled={importing}
                className="bg-primary hover:bg-primary/80 text-white font-bold py-3 h-auto rounded-xl"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importando... Aguarde
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Importar {parsedClients.length} Clientes
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Result */}
          {importResult && (
            <div className="flex flex-col gap-3 items-center py-4">
              <CheckCircle className="w-12 h-12 text-green-400" />
              <p className="text-lg font-bold text-white">Importação Concluída</p>
              <div className="flex gap-4 text-sm">
                <span className="text-green-400 font-semibold">{importResult.success} importados</span>
                {importResult.failed > 0 && (
                  <span className="text-red-400 font-semibold">{importResult.failed} falharam</span>
                )}
              </div>
              <Button variant="outline" onClick={handleClose} className="mt-2 border-white/20 text-white/70">
                Fechar
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
