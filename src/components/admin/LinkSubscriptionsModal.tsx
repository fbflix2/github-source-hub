import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, FileSpreadsheet, CheckCircle, Loader2, AlertCircle, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface Props {
  open: boolean;
  onClose: () => void;
  onLinked: () => void;
}

interface ParsedRow {
  email: string;
  client_name: string;
  codigo: string;
  status?: string;
  produto?: string;
}

interface CredentialRow {
  email: string;
  password: string;
  name: string;
}

// Normalize header to match known columns
function normalizeHeader(h: string): string {
  return h.toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "");
}

const HEADER_MAP: Record<string, string> = {
  email: "email",
  "e-mail": "email",
  cliente: "client_name",
  client: "client_name",
  nome: "client_name",
  codigo: "codigo",
  code: "codigo",
  status: "status",
  produto: "produto",
  product: "produto",
};

export default function LinkSubscriptionsModal({ open, onClose, onLinked }: Props) {
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [credentials, setCredentials] = useState<CredentialRow[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setParsedRows([]);
    setFileName("");
    setResult(null);
    setCredentials([]);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setCredentials([]);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (rawRows.length < 2) {
          toast.error("Arquivo vazio ou sem dados.");
          return;
        }

        // Map headers
        const headers = rawRows[0].map((h: any) => normalizeHeader(String(h || "")));
        const colMap: Record<string, number> = {};
        headers.forEach((h: string, i: number) => {
          const mapped = HEADER_MAP[h];
          if (mapped) colMap[mapped] = i;
        });

        if (colMap.email === undefined || colMap.codigo === undefined) {
          toast.error("Colunas 'Email' e 'Código' são obrigatórias no arquivo.");
          return;
        }

        const rows: ParsedRow[] = [];
        for (let i = 1; i < rawRows.length; i++) {
          const row = rawRows[i];
          const email = String(row[colMap.email] || "").trim();
          const codigo = String(row[colMap.codigo] || "").trim();
          if (!email || !codigo) continue;

          rows.push({
            email,
            client_name: colMap.client_name !== undefined ? String(row[colMap.client_name] || "").trim() : "",
            codigo,
            status: colMap.status !== undefined ? String(row[colMap.status] || "").trim() : undefined,
            produto: colMap.produto !== undefined ? String(row[colMap.produto] || "").trim() : undefined,
          });
        }

        setParsedRows(rows);
        if (rows.length === 0) toast.error("Nenhuma linha válida encontrada.");
      } catch {
        toast.error("Erro ao ler o arquivo.");
      }
    };
    reader.readAsArrayBuffer(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleProcess = async () => {
    if (parsedRows.length === 0) return;
    setImporting(true);

    try {
      const { data, error } = await supabase.functions.invoke("link-subscriptions", {
        body: { rows: parsedRows.map(r => ({ email: r.email, client_name: r.client_name, codigo: r.codigo })) },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      setResult(data);
      if (data.credentials?.length) setCredentials(data.credentials);
      if (data.linked > 0) onLinked();
      toast.success(`${data.linked} assinaturas vinculadas!`);
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const handleExportCredentials = () => {
    if (credentials.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(
      credentials.map(c => ({ Nome: c.name, Email: c.email, "Senha Primeiro Acesso": c.password }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Credenciais");
    XLSX.writeFile(wb, "credenciais_novos_clientes.xlsx");
    toast.success("Credenciais exportadas!");
  };

  const uniqueEmails = new Set(parsedRows.map(r => r.email.toLowerCase())).size;
  const activeRows = parsedRows.filter(r => r.status?.toUpperCase() === "ATIVO" || !r.status);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[#1a0a0a] border-white/10 text-white max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            Vincular Proxies a Clientes
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5 mt-2">
          {/* Instructions */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-white/60">
            <p className="font-semibold text-white/80 mb-2">Envie a planilha da ProxyBR com as colunas:</p>
            <div className="flex flex-wrap gap-2 text-xs">
              {["Status", "Código", "Cliente", "Email", "Produto"].map(l => (
                <span key={l} className="bg-white/10 px-3 py-1 rounded-full">{l}</span>
              ))}
            </div>
            <p className="mt-2 text-white/40 text-xs">
              O sistema cria contas para clientes novos e vincula cada proxy ao cliente pelo email.
            </p>
          </div>

          {/* File Input */}
          <div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
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
          {parsedRows.length > 0 && !result && !importing && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white/80">
                    {parsedRows.length} proxies · {uniqueEmails} clientes únicos
                  </p>
                  <p className="text-xs text-white/40">{activeRows.length} ativos</p>
                </div>
                <Button variant="ghost" size="sm" onClick={reset} className="text-white/40 hover:text-white h-7">
                  Limpar
                </Button>
              </div>

              <div className="bg-white/5 rounded-xl border border-white/10 max-h-60 overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-white/50 text-xs">
                      <th className="text-left p-3">Código</th>
                      <th className="text-left p-3">Cliente</th>
                      <th className="text-left p-3">Email</th>
                      <th className="text-left p-3">Produto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 30).map((r, i) => (
                      <tr key={i} className="border-b border-white/5 text-white/70">
                        <td className="p-3 font-mono text-xs">{r.codigo}</td>
                        <td className="p-3">{r.client_name || "—"}</td>
                        <td className="p-3">{r.email}</td>
                        <td className="p-3 text-white/40">{r.produto || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedRows.length > 30 && (
                  <p className="text-center text-xs text-white/30 py-2">... e mais {parsedRows.length - 30}</p>
                )}
              </div>

              <Button
                onClick={handleProcess}
                className="bg-primary hover:bg-primary/80 text-white font-bold py-3 h-auto rounded-xl"
              >
                <Upload className="w-4 h-4 mr-2" />
                Vincular {parsedRows.length} Proxies
              </Button>
            </div>
          )}

          {/* Progress */}
          {importing && (
            <div className="flex flex-col gap-3 py-4 items-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-white/70">Processando {parsedRows.length} proxies...</p>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="flex flex-col gap-3 items-center py-4">
              <CheckCircle className="w-12 h-12 text-green-400" />
              <p className="text-lg font-bold text-white">Vinculação Concluída</p>
              <div className="flex gap-4 text-sm flex-wrap justify-center">
                <span className="text-green-400 font-semibold">{result.linked} vinculadas</span>
                <span className="text-blue-400 font-semibold">{result.created} contas criadas</span>
                {result.not_found > 0 && (
                  <span className="text-yellow-400 font-semibold">{result.not_found} não encontradas</span>
                )}
              </div>

              {credentials.length > 0 && (
                <div className="w-full bg-primary/10 border border-primary/20 rounded-xl p-4 flex flex-col gap-2">
                  <p className="text-sm font-semibold text-primary flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    {credentials.length} novas contas criadas
                  </p>
                  <p className="text-xs text-white/50">
                    Baixe as credenciais de primeiro acesso para enviar aos novos clientes.
                  </p>
                  <Button
                    onClick={handleExportCredentials}
                    className="bg-primary hover:bg-primary/80 text-white font-bold rounded-xl mt-1"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Baixar Credenciais (.xlsx)
                  </Button>
                </div>
              )}

              {result.errors?.length > 0 && (
                <div className="w-full bg-red-500/10 border border-red-500/20 rounded-xl p-3 max-h-40 overflow-y-auto">
                  <p className="text-xs font-semibold text-red-400 mb-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Detalhes:
                  </p>
                  {result.errors.slice(0, 20).map((err: string, i: number) => (
                    <p key={i} className="text-xs text-red-300/70">{err}</p>
                  ))}
                  {result.errors.length > 20 && (
                    <p className="text-xs text-red-300/50 mt-1">... e mais {result.errors.length - 20}</p>
                  )}
                </div>
              )}

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
