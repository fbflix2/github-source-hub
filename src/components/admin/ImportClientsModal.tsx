import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, FileSpreadsheet, CheckCircle, Loader2, X, AlertCircle, Download, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface ImportClientsModalProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

interface ClientRow {
  email: string;
  full_name?: string;
  phone?: string;
  cpf?: string;
  cep?: string;
  address?: string;
  rua?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  birth_date?: string;
}

// Column synonym mapping
const COLUMN_MAP: Record<string, keyof ClientRow> = {
  nome: "full_name",
  name: "full_name",
  "nome completo": "full_name",
  "full name": "full_name",
  "full_name": "full_name",
  email: "email",
  "e-mail": "email",
  "e mail": "email",
  telefone: "phone",
  phone: "phone",
  fone: "phone",
  celular: "phone",
  cel: "phone",
  whatsapp: "phone",
  cpf: "cpf",
  documento: "cpf",
  doc: "cpf",
  "numero do documento": "cpf",
  "número do documento": "cpf",
  cep: "cep",
  zip: "cep",
  "codigo postal": "cep",
  endereco: "address",
  endereço: "address",
  address: "address",
  "endereço completo": "address",
  rua: "rua",
  street: "rua",
  numero: "numero",
  número: "numero",
  number: "numero",
  num: "numero",
  bairro: "bairro",
  neighborhood: "bairro",
  cidade: "cidade",
  city: "cidade",
  estado: "estado",
  state: "estado",
  uf: "estado",
  nascimento: "birth_date",
  birth: "birth_date",
  "data nascimento": "birth_date",
  "data_nascimento": "birth_date",
  "birth_date": "birth_date",
  "data de nascimento": "birth_date",
  aniversario: "birth_date",
  aniversário: "birth_date",
};

const FIELD_LABELS: Record<keyof ClientRow, string> = {
  email: "Email",
  full_name: "Nome",
  phone: "Telefone",
  cpf: "CPF",
  cep: "CEP",
  address: "Endereço",
  rua: "Rua",
  numero: "Número",
  bairro: "Bairro",
  cidade: "Cidade",
  estado: "Estado",
  birth_date: "Nascimento",
};

function normalize(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 _]/g, "");
}

function detectColumns(firstRow: any[]): { mapping: (keyof ClientRow | null)[]; isHeader: boolean } {
  const normalized = firstRow.map((cell) => normalize(String(cell || "")));
  let matches = 0;
  const mapping: (keyof ClientRow | null)[] = [];

  for (const cell of normalized) {
    const mapped = COLUMN_MAP[cell] || null;
    if (mapped) matches++;
    mapping.push(mapped);
  }

  // If at least 2 columns match known headers, treat as header row
  if (matches >= 2) {
    return { mapping, isHeader: true };
  }

  // Default: assume Nome, Email, Telefone
  const defaultMapping: (keyof ClientRow | null)[] = [
    "full_name",
    "email",
    "phone",
    ...Array(Math.max(0, firstRow.length - 3)).fill(null),
  ];
  return { mapping: defaultMapping, isHeader: false };
}

interface CredentialRow {
  email: string;
  password: string;
  full_name: string;
}

export default function ImportClientsModal({ open, onClose, onImported }: ImportClientsModalProps) {
  const [parsedClients, setParsedClients] = useState<ClientRow[]>([]);
  const [detectedFields, setDetectedFields] = useState<(keyof ClientRow)[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [importResult, setImportResult] = useState<{ success: number; updated: number; failed: number; errors: string[] } | null>(null);
  const [allCredentials, setAllCredentials] = useState<CredentialRow[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const PLATFORM_URL = "https://fbflix.com.br/auth";

  const buildCredentialMessage = (cred: CredentialRow) =>
    `Olá${cred.full_name ? ` ${cred.full_name.split(" ")[0]}` : ""}! 🎉\n\nSua conta na FBFlix está pronta.\n\n🔗 Acesse: ${PLATFORM_URL}\n📧 Email: ${cred.email}\n🔑 Senha: ${cred.password}\n\n⚠️ Essa é uma senha de acesso único. Após o login, você será solicitado a criar uma nova senha.\n\nQualquer dúvida, estamos à disposição!`;

  const handleCopyMessage = (index: number) => {
    const msg = buildCredentialMessage(allCredentials[index]);
    navigator.clipboard.writeText(msg);
    setCopiedIndex(index);
    toast.success("Mensagem copiada!");
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleCopyAll = () => {
    const all = allCredentials.map(c => buildCredentialMessage(c)).join("\n\n---\n\n");
    navigator.clipboard.writeText(all);
    setCopiedAll(true);
    toast.success("Todas as mensagens copiadas!");
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const reset = () => {
    setParsedClients([]);
    setDetectedFields([]);
    setFileName("");
    setImportResult(null);
    setAllCredentials([]);
    setCopiedIndex(null);
    setCopiedAll(false);
    setProgress({ current: 0, total: 0 });
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
    setAllCredentials([]);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (rows.length === 0) {
          toast.error("Arquivo vazio.");
          return;
        }

        const { mapping, isHeader } = detectColumns(rows[0]);
        const dataRows = isHeader ? rows.slice(1) : rows;

        const fields = mapping.filter((m): m is keyof ClientRow => m !== null);
        const uniqueFields = [...new Set(fields)];
        setDetectedFields(uniqueFields);

        const clients: ClientRow[] = [];
        for (const row of dataRows) {
          const client: Partial<ClientRow> = {};
          for (let i = 0; i < mapping.length; i++) {
            const field = mapping[i];
            if (field && row[i] !== undefined && row[i] !== null) {
              const val = String(row[i]).trim();
              if (val) {
                (client as any)[field] = val;
              }
            }
          }
          if (client.email) {
            clients.push(client as ClientRow);
          }
        }

        setParsedClients(clients);
        if (clients.length === 0) {
          toast.error("Nenhum cliente com email válido encontrado.");
        }
      } catch {
        toast.error("Erro ao ler o arquivo. Verifique o formato.");
      }
    };
    reader.readAsArrayBuffer(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleImport = async () => {
    if (parsedClients.length === 0) return;
    setImporting(true);
    setProgress({ current: 0, total: parsedClients.length });

    const batchSize = 20;
    let totalSuccess = 0;
    let totalUpdated = 0;
    let totalFailed = 0;
    const allErrors: string[] = [];
    const creds: CredentialRow[] = [];

    for (let i = 0; i < parsedClients.length; i += batchSize) {
      const batch = parsedClients.slice(i, i + batchSize);

      try {
        const { data, error } = await supabase.functions.invoke("import-clients", {
          body: { clients: batch },
        });

        if (error) {
          console.error("[ImportClients] Batch error:", error);
          // Try to extract the real error from the response
          let errorMsg = error.message || "Erro desconhecido";
          if (typeof error === "object" && (error as any).context?.body) {
            try {
              const body = await (error as any).context.json();
              if (body?.error) errorMsg = body.error;
            } catch {}
          }
          totalFailed += batch.length;
          allErrors.push(`Lote ${Math.floor(i / batchSize) + 1}: ${errorMsg}`);
        } else {
          totalSuccess += data.success || 0;
          totalUpdated += data.updated || 0;
          totalFailed += data.failed || 0;
          if (data.errors?.length) allErrors.push(...data.errors);
          if (data.credentials?.length) creds.push(...data.credentials);
        }
      } catch (e) {
        totalFailed += batch.length;
        allErrors.push(`Lote ${Math.floor(i / batchSize) + 1}: Erro de conexão`);
      }

      setProgress({ current: Math.min(i + batchSize, parsedClients.length), total: parsedClients.length });
    }

    setImportResult({ success: totalSuccess, updated: totalUpdated, failed: totalFailed, errors: allErrors });
    setAllCredentials(creds);
    setImporting(false);
    if (totalSuccess > 0) onImported();
  };

  const handleExportCredentials = () => {
    if (allCredentials.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(
      allCredentials.map((c) => ({
        Nome: c.full_name,
        Email: c.email,
        "Senha Primeiro Acesso": c.password,
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Credenciais");
    XLSX.writeFile(wb, "credenciais_clientes.xlsx");
    toast.success("Arquivo de credenciais exportado!");
  };

  const progressPercent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[#1a0a0a] border-white/10 text-white max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            Importar Clientes
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5 mt-2">
          {/* Instructions */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-white/60">
            <p className="font-semibold text-white/80 mb-2">O sistema detecta automaticamente as colunas do arquivo (.xlsx ou .csv):</p>
            <div className="flex flex-wrap gap-2 text-xs">
              {Object.values(FIELD_LABELS).map((label) => (
                <span key={label} className="bg-white/10 px-3 py-1 rounded-full">{label}</span>
              ))}
            </div>
            <p className="mt-2 text-white/40 text-xs">
              A primeira linha pode ser cabeçalho (nome, email, telefone, cpf...) ou dados diretos.
              Contas importadas ficam <strong className="text-green-400">ativas imediatamente</strong>.
            </p>
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

          {/* Detected fields badge */}
          {detectedFields.length > 0 && !importResult && (
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-white/40">Colunas detectadas:</span>
              {detectedFields.map((f) => (
                <span key={f} className="bg-primary/20 text-primary text-xs px-2 py-0.5 rounded-full">
                  {FIELD_LABELS[f]}
                </span>
              ))}
            </div>
          )}

          {/* Preview */}
          {parsedClients.length > 0 && !importResult && !importing && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white/80">
                  {parsedClients.length} clientes encontrados
                </p>
                <Button variant="ghost" size="sm" onClick={reset} className="text-white/40 hover:text-white h-7">
                  <X className="w-4 h-4 mr-1" /> Limpar
                </Button>
              </div>

              <div className="bg-white/5 rounded-xl border border-white/10 max-h-60 overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-white/50 text-xs">
                      <th className="text-left p-3">#</th>
                      {detectedFields.map((f) => (
                        <th key={f} className="text-left p-3">{FIELD_LABELS[f]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedClients.slice(0, 50).map((c, i) => (
                      <tr key={i} className="border-b border-white/5 text-white/70">
                        <td className="p-3 text-white/30">{i + 1}</td>
                        {detectedFields.map((f) => (
                          <td key={f} className="p-3">{(c as any)[f] || "—"}</td>
                        ))}
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
                className="bg-primary hover:bg-primary/80 text-white font-bold py-3 h-auto rounded-xl"
              >
                <Upload className="w-4 h-4 mr-2" />
                Importar {parsedClients.length} Clientes
              </Button>
            </div>
          )}

          {/* Progress */}
          {importing && (
            <div className="flex flex-col gap-3 py-4">
              <div className="flex items-center gap-2 text-sm text-white/70">
                <Loader2 className="w-4 h-4 animate-spin" />
                Importando... {progress.current} de {progress.total}
              </div>
              <Progress value={progressPercent} className="h-2" />
              <p className="text-xs text-white/40">{progressPercent}% concluído</p>
            </div>
          )}

          {/* Result */}
          {importResult && (
            <div className="flex flex-col gap-3 items-center py-4">
              <CheckCircle className="w-12 h-12 text-green-400" />
              <p className="text-lg font-bold text-white">Importação Concluída</p>
              <div className="flex gap-4 text-sm">
                <span className="text-green-400 font-semibold">{importResult.success} processados</span>
                {importResult.updated > 0 && (
                  <span className="text-blue-400 font-semibold">{importResult.updated} atualizados</span>
                )}
                {allCredentials.length > 0 && (
                  <span className="text-yellow-400 font-semibold">{allCredentials.length} novos</span>
                )}
                {importResult.failed > 0 && (
                  <span className="text-red-400 font-semibold">{importResult.failed} falharam</span>
                )}
              </div>

              {allCredentials.length > 0 && allCredentials.length <= 3 && (
                <div className="w-full space-y-3">
                  <p className="text-sm font-semibold text-primary text-center">Credenciais de Acesso</p>
                  {allCredentials.map((cred, i) => (
                    <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-white/90">{cred.full_name || cred.email}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyMessage(i)}
                          className="h-7 text-xs text-primary hover:text-primary/80"
                        >
                          {copiedIndex === i ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                          {copiedIndex === i ? "Copiado!" : "Copiar Mensagem"}
                        </Button>
                      </div>
                      <div className="bg-black/30 rounded-lg p-3 text-xs text-white/60 whitespace-pre-line font-mono leading-relaxed">
                        {buildCredentialMessage(cred)}
                      </div>
                    </div>
                  ))}
                  {allCredentials.length > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyAll}
                      className="w-full border-white/20 text-white/70 text-xs"
                    >
                      {copiedAll ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                      {copiedAll ? "Todas copiadas!" : "Copiar Todas as Mensagens"}
                    </Button>
                  )}
                </div>
              )}

              {allCredentials.length > 3 && (
                <div className="w-full bg-primary/10 border border-primary/20 rounded-xl p-4 flex flex-col gap-2">
                  <p className="text-sm font-semibold text-primary flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    {allCredentials.length} credenciais de primeiro acesso geradas
                  </p>
                  <p className="text-xs text-white/50">
                    Baixe o arquivo e envie a senha de primeiro acesso para cada cliente. Após o login, eles poderão trocar a senha.
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

              {importResult.errors.length > 0 && (
                <div className="w-full bg-red-500/10 border border-red-500/20 rounded-xl p-3 max-h-40 overflow-y-auto">
                  <p className="text-xs font-semibold text-red-400 mb-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Detalhes dos erros:
                  </p>
                  {importResult.errors.slice(0, 20).map((err, i) => (
                    <p key={i} className="text-xs text-red-300/70">{err}</p>
                  ))}
                  {importResult.errors.length > 20 && (
                    <p className="text-xs text-red-300/50 mt-1">... e mais {importResult.errors.length - 20} erros</p>
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
