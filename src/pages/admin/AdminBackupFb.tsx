import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  FolderArchive, Plus, ArrowLeft, Upload, Download, Trash2, FileText, Search, HardDrive,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import JSZip from "jszip";

interface BackupFolder {
  id: string;
  client_name: string;
  description: string | null;
  created_at: string;
  file_count?: number;
  total_value?: number;
  purchase_date?: string | null;
  unit_price?: number | null;
}

interface BackupFile {
  id: string;
  folder_id: string;
  file_name: string;
  storage_path: string;
  size_bytes: number | null;
  created_at: string;
  purchase_date: string | null;
  unit_price: number | null;
}

const BUCKET = "fb-backups";

function formatBytes(n: number | null): string {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function sanitizeName(s: string): string {
  return (s || "sem-nome").replace(/[\/\\:*?"<>|]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 80) || "sem-nome";
}

async function fetchFileBlob(storagePath: string): Promise<Blob | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 120);
  if (error || !data) return null;
  try {
    const r = await fetch(data.signedUrl);
    if (!r.ok) return null;
    return await r.blob();
  } catch {
    return null;
  }
}

// Detecta tipos de perfil/conta a partir do texto da descrição
const TYPE_PATTERNS: { label: string; regex: RegExp }[] = [
  { label: "CA5", regex: /\bca[\s-]?5\b/i },
  { label: "CA3", regex: /\bca[\s-]?3\b/i },
  { label: "Perfil AP", regex: /\bperfil\s*ap\b|\bap\b/i },
  { label: "Premium", regex: /\bpremium\b/i },
  { label: "Antigo", regex: /\bantig[oa]s?\b/i },
  { label: "BM", regex: /\bbm(\s*\d+(\.\d+)?[kK]?)?\b/i },
  { label: "Página", regex: /\bp[áa]gina(s)?\b|\bfanpage\b/i },
  { label: "Gerenciador", regex: /\bgerenciador(es)?\b/i },
  { label: "Business", regex: /\bbusiness\b/i },
];

function detectTypes(desc: string | null): string[] {
  if (!desc) return [];
  const found = new Set<string>();
  for (const t of TYPE_PATTERNS) {
    if (t.regex.test(desc)) found.add(t.label);
  }
  return Array.from(found);
}

export default function AdminBackupFb() {
  const [folders, setFolders] = useState<BackupFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPurchaseDate, setNewPurchaseDate] = useState("");
  const [newUnitPrice, setNewUnitPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<BackupFolder | null>(null);
  const [files, setFiles] = useState<BackupFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<BackupFolder | null>(null);
  const [fileToDelete, setFileToDelete] = useState<BackupFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [zipping, setZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState<{ done: number; total: number } | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [ageFilter, setAgeFilter] = useState<string>("all");

  const fetchFolders = useCallback(async () => {
    setLoading(true);
    const { data: foldersData, error } = await supabase
      .from("fb_backup_folders")
      .select("id, client_name, description, created_at, purchase_date, unit_price")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar pastas: " + error.message);
      setLoading(false);
      return;
    }
    // Get file counts
    const ids = (foldersData || []).map((f) => f.id);
    const counts: Record<string, number> = {};
    const sums: Record<string, number> = {};
    if (ids.length > 0) {
      const { data: fileRows } = await supabase
        .from("fb_backup_files")
        .select("folder_id, unit_price")
        .in("folder_id", ids);
      (fileRows || []).forEach((r: any) => {
        counts[r.folder_id] = (counts[r.folder_id] || 0) + 1;
        sums[r.folder_id] = (sums[r.folder_id] || 0) + (Number(r.unit_price) || 0);
      });
    }
    setFolders((foldersData || []).map((f) => ({
      ...f,
      file_count: counts[f.id] || 0,
      total_value: sums[f.id] || 0,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { fetchFolders(); }, [fetchFolders]);

  const fetchFiles = useCallback(async (folderId: string) => {
    setLoadingFiles(true);
    const { data, error } = await supabase
      .from("fb_backup_files")
      .select("*")
      .eq("folder_id", folderId)
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar arquivos: " + error.message);
    setFiles((data || []) as BackupFile[]);
    setLoadingFiles(false);
  }, []);

  useEffect(() => {
    if (selectedFolder) fetchFiles(selectedFolder.id);
  }, [selectedFolder, fetchFiles]);

  // Realtime: refresh totals when files or folders change
  useEffect(() => {
    const channel = supabase
      .channel("fb-backup-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "fb_backup_files" }, () => {
        fetchFolders();
        if (selectedFolder) fetchFiles(selectedFolder.id);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "fb_backup_folders" }, () => {
        fetchFolders();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchFolders, fetchFiles, selectedFolder]);

  const handleCreateFolder = async () => {
    if (!newName.trim()) {
      toast.error("Informe o nome do cliente");
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("fb_backup_folders").insert({
      client_name: newName.trim(),
      description: newDesc.trim() || null,
      purchase_date: newPurchaseDate ? parsePastedDate(newPurchaseDate) : null,
      unit_price: newUnitPrice ? Number(newUnitPrice.replace(",", ".")) || null : null,
      created_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) {
      toast.error("Erro ao criar pasta: " + error.message);
      return;
    }
    toast.success("Pasta criada");
    setNewName(""); setNewDesc(""); setNewPurchaseDate(""); setNewUnitPrice(""); setCreateOpen(false);
    fetchFolders();
  };

  const handleUpload = async (fileList: FileList | File[]) => {
    if (!selectedFolder) return;
    const arr = Array.from(fileList);
    const txtFiles = arr.filter((f) => f.name.toLowerCase().endsWith(".txt"));
    if (txtFiles.length === 0) {
      toast.error("Somente arquivos .txt são permitidos");
      return;
    }
    if (txtFiles.length !== arr.length) {
      toast.warning(`${arr.length - txtFiles.length} arquivo(s) ignorado(s) (apenas .txt)`);
    }
    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    let ok = 0;
    for (const file of txtFiles) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${selectedFolder.id}/${Date.now()}_${safeName}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: "text/plain",
        upsert: false,
      });
      if (upErr) {
        toast.error(`Falha ao enviar ${file.name}: ${upErr.message}`);
        continue;
      }
      const { error: insErr } = await supabase.from("fb_backup_files").insert({
        folder_id: selectedFolder.id,
        file_name: file.name,
        storage_path: path,
        size_bytes: file.size,
        uploaded_by: user?.id ?? null,
        purchase_date: selectedFolder.purchase_date ?? null,
        unit_price: selectedFolder.unit_price ?? null,
      });
      if (insErr) {
        toast.error(`Erro ao registrar ${file.name}: ${insErr.message}`);
        await supabase.storage.from(BUCKET).remove([path]);
        continue;
      }
      ok++;
    }
    setUploading(false);
    if (ok > 0) toast.success(`${ok} arquivo(s) enviado(s)`);
    fetchFiles(selectedFolder.id);
    fetchFolders();
  };

  const handleDownload = async (file: BackupFile) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(file.storage_path, 60);
    if (error || !data) {
      toast.error("Erro ao gerar link: " + (error?.message || ""));
      return;
    }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = file.file_name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleDownloadFolderZip = async (folder: BackupFolder, folderFiles?: BackupFile[]) => {
    setZipping(true);
    try {
      let list = folderFiles;
      if (!list) {
        const { data, error } = await supabase
          .from("fb_backup_files")
          .select("*")
          .eq("folder_id", folder.id);
        if (error) throw error;
        list = (data || []) as BackupFile[];
      }
      if (!list || list.length === 0) {
        toast.info("Nenhum arquivo nessa pasta");
        return;
      }
      setZipProgress({ done: 0, total: list.length });
      const zip = new JSZip();
      let i = 0;
      for (const f of list) {
        const blob = await fetchFileBlob(f.storage_path);
        if (blob) {
          const name = f.purchase_date
            ? `${f.purchase_date}_${sanitizeName(f.file_name)}`
            : sanitizeName(f.file_name);
          zip.file(name, blob);
        }
        i++;
        setZipProgress({ done: i, total: list.length });
      }
      const out = await zip.generateAsync({ type: "blob" });
      downloadBlob(out, `${sanitizeName(folder.client_name)}.zip`);
      toast.success("ZIP gerado");
    } catch (e: any) {
      toast.error("Erro ao gerar ZIP: " + (e?.message || ""));
    } finally {
      setZipping(false);
      setZipProgress(null);
    }
  };

  const handleDownloadAllZip = async () => {
    setZipping(true);
    try {
      const { data: allFiles, error } = await supabase
        .from("fb_backup_files")
        .select("*");
      if (error) throw error;
      if (!allFiles || allFiles.length === 0) {
        toast.info("Nenhum arquivo para baixar");
        return;
      }
      const folderMap = new Map(folders.map((f) => [f.id, f]));
      setZipProgress({ done: 0, total: allFiles.length });
      const zip = new JSZip();
      let i = 0;
      for (const f of allFiles as BackupFile[]) {
        const folder = folderMap.get(f.folder_id);
        const folderName = folder ? sanitizeName(folder.client_name) : "sem-pasta";
        const blob = await fetchFileBlob(f.storage_path);
        if (blob) {
          const name = f.purchase_date
            ? `${f.purchase_date}_${sanitizeName(f.file_name)}`
            : sanitizeName(f.file_name);
          zip.folder(folderName)!.file(name, blob);
          if (folder?.description) {
            zip.folder(folderName)!.file("_descricao.txt", folder.description);
          }
        }
        i++;
        setZipProgress({ done: i, total: allFiles.length });
      }
      const out = await zip.generateAsync({ type: "blob" });
      const stamp = format(new Date(), "yyyy-MM-dd_HHmm");
      downloadBlob(out, `backup-fb_${stamp}.zip`);
      toast.success("ZIP geral gerado");
    } catch (e: any) {
      toast.error("Erro ao gerar ZIP geral: " + (e?.message || ""));
    } finally {
      setZipping(false);
      setZipProgress(null);
    }
  };

  const handleDeleteFile = async () => {
    if (!fileToDelete) return;
    await supabase.storage.from(BUCKET).remove([fileToDelete.storage_path]);
    const { error } = await supabase.from("fb_backup_files").delete().eq("id", fileToDelete.id);
    if (error) toast.error("Erro ao excluir: " + error.message);
    else toast.success("Arquivo excluído");
    setFileToDelete(null);
    if (selectedFolder) fetchFiles(selectedFolder.id);
    fetchFolders();
  };

  const handleUpdatePurchaseDate = async (fileId: string, date: string | null) => {
    const { error } = await supabase
      .from("fb_backup_files")
      .update({ purchase_date: date })
      .eq("id", fileId);
    if (error) {
      toast.error("Erro ao salvar data: " + error.message);
      return;
    }
    setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, purchase_date: date } : f)));
    toast.success("Data de compra atualizada");
  };

  const handleUpdateUnitPrice = async (fileId: string, raw: string) => {
    const parsed = raw.trim() === "" ? null : Number(raw.replace(",", "."));
    if (parsed !== null && Number.isNaN(parsed)) {
      toast.error("Valor inválido");
      return;
    }
    const { error } = await supabase
      .from("fb_backup_files")
      .update({ unit_price: parsed })
      .eq("id", fileId);
    if (error) {
      toast.error("Erro ao salvar valor: " + error.message);
      return;
    }
    setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, unit_price: parsed } : f)));
    toast.success("Valor atualizado");
  };

  // Aceita formatos colados: dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd, dd.mm.yyyy, com ou sem espaços
  const parsePastedDate = (raw: string): string | null => {
    const s = raw.trim();
    if (!s) return null;
    // ISO yyyy-mm-dd
    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (m) {
      const [_, y, mo, d] = m;
      return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    // dd/mm/yyyy ou dd-mm-yyyy ou dd.mm.yyyy
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
    if (m) {
      let [_, d, mo, y] = m;
      if (y.length === 2) y = (parseInt(y) > 50 ? "19" : "20") + y;
      return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    return null;
  };

  const handlePastedDate = (fileId: string, raw: string) => {
    if (!raw.trim()) {
      handleUpdatePurchaseDate(fileId, null);
      return;
    }
    const iso = parsePastedDate(raw);
    if (!iso) {
      toast.error("Data inválida. Use dd/mm/aaaa");
      return;
    }
    handleUpdatePurchaseDate(fileId, iso);
  };

  const handleDeleteFolder = async () => {
    if (!folderToDelete) return;
    // List & remove all storage files in folder prefix
    const { data: list } = await supabase.storage.from(BUCKET).list(folderToDelete.id);
    if (list && list.length > 0) {
      const paths = list.map((o) => `${folderToDelete.id}/${o.name}`);
      await supabase.storage.from(BUCKET).remove(paths);
    }
    const { error } = await supabase.from("fb_backup_folders").delete().eq("id", folderToDelete.id);
    if (error) toast.error("Erro ao excluir pasta: " + error.message);
    else toast.success("Pasta excluída");
    setFolderToDelete(null);
    if (selectedFolder?.id === folderToDelete.id) setSelectedFolder(null);
    fetchFolders();
  };

  const ageInMonths = (iso: string | null | undefined): number | null => {
    if (!iso) return null;
    const d = new Date(iso + "T00:00:00");
    if (isNaN(d.getTime())) return null;
    const now = new Date();
    return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  };

  const matchesAge = (f: BackupFolder): boolean => {
    if (ageFilter === "all") return true;
    const months = ageInMonths(f.purchase_date);
    if (months === null) return false;
    switch (ageFilter) {
      case "lt1m": return months < 1;
      case "lt3m": return months < 3;
      case "lt6m": return months < 6;
      case "lt12m": return months < 12;
      case "gt6m": return months >= 6;
      case "gt12m": return months >= 12;
      case "gt24m": return months >= 24;
      case "gt36m": return months >= 36;
      default: return true;
    }
  };

  const filteredFolders = folders.filter((f) => {
    const q = search.toLowerCase();
    const matchesSearch = !q ||
      f.client_name.toLowerCase().includes(q) ||
      (f.description || "").toLowerCase().includes(q);
    const types = detectTypes(f.description);
    const matchesType = typeFilter === "all" || types.includes(typeFilter);
    return matchesSearch && matchesType && matchesAge(f);
  });

  // Estatísticas: total de perfis (1 arquivo .txt = 1 perfil) e tipos detectados
  const totalProfiles = folders.reduce((acc, f) => acc + (f.file_count || 0), 0);
  const totalInvested = folders.reduce(
    (acc, f) => acc + (Number(f.total_value) || 0),
    0,
  );
  const typeCounts: Record<string, number> = {};
  for (const f of folders) {
    const types = detectTypes(f.description);
    const profileCount = f.file_count || 0;
    if (types.length === 0) {
      typeCounts["Sem tipo"] = (typeCounts["Sem tipo"] || 0) + profileCount;
    } else {
      for (const t of types) {
        typeCounts[t] = (typeCounts[t] || 0) + profileCount;
      }
    }
  }
  const sortedTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);

  // --- INSIDE A FOLDER ---
  if (selectedFolder) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => setSelectedFolder(null)} className="gap-2">
            <ArrowLeft className="size-4" /> Voltar
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FolderArchive className="size-6 text-primary" />
              {selectedFolder.client_name}
            </h1>
            {selectedFolder.description && (
              <p className="text-sm text-muted-foreground mt-0.5">{selectedFolder.description}</p>
            )}
          </div>
          <Button
            onClick={() => handleDownloadFolderZip(selectedFolder, files)}
            disabled={zipping || files.length === 0}
            className="gap-2"
          >
            <Download className="size-4" />
            {zipping && zipProgress
              ? `Gerando ZIP ${zipProgress.done}/${zipProgress.total}`
              : "Baixar tudo (.zip)"}
          </Button>
        </div>

        {files.length > 0 && (() => {
          const totalValue = files.reduce((acc, f) => acc + (Number(f.unit_price) || 0), 0);
          const withPrice = files.filter((f) => Number(f.unit_price) > 0).length;
          const avg = withPrice > 0 ? totalValue / withPrice : 0;
          return (
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-6">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText className="size-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Total de itens</p>
                      <p className="text-xl font-bold">{files.length}</p>
                    </div>
                  </div>
                  <div className="h-10 w-px bg-border" />
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <span className="text-primary font-bold text-sm">R$</span>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Valor total investido</p>
                      <p className="text-xl font-bold">
                        {totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </p>
                    </div>
                  </div>
                  {withPrice > 0 && (
                    <>
                      <div className="h-10 w-px bg-border" />
                      <div>
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Valor médio por item</p>
                        <p className="text-xl font-bold">
                          {avg.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {withPrice} de {files.length} com valor
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })()}

        <Card
          className={`border-2 border-dashed transition ${dragActive ? "border-primary bg-primary/5" : "border-border"}`}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            if (e.dataTransfer.files?.length) handleUpload(e.dataTransfer.files);
          }}
        >
          <CardContent className="p-10 text-center">
            <Upload className="size-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">Arraste arquivos .txt aqui</p>
            <p className="text-sm text-muted-foreground mb-4">ou clique para selecionar</p>
            <Button
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? "Enviando..." : "Selecionar arquivos"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,text/plain"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) handleUpload(e.target.files);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="size-4" /> Arquivos ({files.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingFiles ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : files.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum arquivo ainda. Arraste arquivos .txt acima para armazenar.
              </p>
            ) : (
              <div className="space-y-2">
                {files.map((f) => (
                  <div key={f.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition">
                    <FileText className="size-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{f.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(f.size_bytes)} • {format(new Date(f.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Data de compra</Label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="date"
                          value={f.purchase_date || ""}
                          onChange={(e) => handleUpdatePurchaseDate(f.id, e.target.value || null)}
                          className="h-8 w-[140px] text-xs"
                        />
                        <Input
                          type="text"
                          placeholder="dd/mm/aaaa"
                          defaultValue={
                            f.purchase_date
                              ? format(new Date(f.purchase_date + "T00:00:00"), "dd/MM/yyyy")
                              : ""
                          }
                          key={f.purchase_date || "empty"}
                          onPaste={(e) => {
                            const text = e.clipboardData.getData("text");
                            if (text) {
                              e.preventDefault();
                              (e.target as HTMLInputElement).value = text;
                              handlePastedDate(f.id, text);
                            }
                          }}
                          onBlur={(e) => {
                            const v = e.target.value;
                            const current = f.purchase_date
                              ? format(new Date(f.purchase_date + "T00:00:00"), "dd/MM/yyyy")
                              : "";
                            if (v !== current) handlePastedDate(f.id, v);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          }}
                          className="h-8 w-[110px] text-xs"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Valor pago (R$)</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="0,00"
                        defaultValue={f.unit_price != null ? String(f.unit_price).replace(".", ",") : ""}
                        key={`price-${f.unit_price ?? "empty"}`}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          const current = f.unit_price != null ? String(f.unit_price).replace(".", ",") : "";
                          if (v !== current) handleUpdateUnitPrice(f.id, v);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        }}
                        className="h-8 w-[90px] text-xs"
                      />
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleDownload(f)} className="gap-1.5">
                      <Download className="size-3.5" /> Baixar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setFileToDelete(f)} className="text-destructive">
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={!!fileToDelete} onOpenChange={(v) => !v && setFileToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir arquivo?</AlertDialogTitle>
              <AlertDialogDescription>
                {fileToDelete?.file_name} será removido permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteFile} className="bg-destructive text-destructive-foreground">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // --- FOLDER LIST ---
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HardDrive className="size-6 text-primary" /> Backup Fb
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Pastas de backup por cliente — armazene arquivos .txt para uso futuro
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleDownloadAllZip}
            disabled={zipping || folders.length === 0}
            className="gap-2"
          >
            <Download className="size-4" />
            {zipping && zipProgress
              ? `Gerando ${zipProgress.done}/${zipProgress.total}`
              : "Baixar tudo (.zip)"}
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="size-4" /> Nova pasta
          </Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por cliente ou descrição..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {!loading && folders.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="size-5 text-primary" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Total de perfis</p>
                  <p className="text-xl font-bold">{totalProfiles}</p>
                </div>
              </div>
              <div className="h-10 w-px bg-border" />
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-bold text-sm">R$</span>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Total em backup</p>
                  <p className="text-xl font-bold">
                    {totalInvested.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </p>
                </div>
              </div>
              <div className="h-10 w-px bg-border" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1.5">Tipos detectados</p>
                <div className="flex flex-wrap gap-1.5">
                  {sortedTypes.length === 0 ? (
                    <span className="text-xs text-muted-foreground">Nenhum tipo identificado</span>
                  ) : (
                    sortedTypes.map(([type, count]) => (
                      <Badge key={type} variant="secondary" className="text-xs">
                        {type} <span className="ml-1 font-bold text-primary">{count}</span>
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filteredFolders.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FolderArchive className="size-12 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">Nenhuma pasta ainda</p>
            <p className="text-sm text-muted-foreground">Crie sua primeira pasta para começar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filteredFolders.map((f) => (
            <Card
              key={f.id}
              className="cursor-pointer hover:border-primary/50 hover:shadow-md transition group"
              onClick={() => setSelectedFolder(f)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition">
                    <FolderArchive className="size-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{f.client_name}</p>
                    {f.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{f.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {f.file_count} arquivo{f.file_count === 1 ? "" : "s"}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(f.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </div>
                    {detectTypes(f.description).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {detectTypes(f.description).map((t) => (
                          <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0 border-primary/40 text-primary">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-destructive opacity-0 group-hover:opacity-100 transition"
                    onClick={(e) => { e.stopPropagation(); setFolderToDelete(f); }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova pasta de backup</DialogTitle>
            <DialogDescription>Crie uma pasta vinculada a um cliente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome do cliente *</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: João Silva" />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição (tipo de conta)</Label>
              <Textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Ex: Perfis CA5 com BM 1.3k"
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data de compra (cole ou digite)</Label>
              <Input
                value={newPurchaseDate}
                onChange={(e) => setNewPurchaseDate(e.target.value)}
                placeholder="Ex: 25/06/2026"
              />
              <p className="text-[11px] text-muted-foreground">
                Formatos aceitos: dd/mm/aaaa, dd-mm-aaaa ou aaaa-mm-dd
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Valor unitário pago (opcional)</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={newUnitPrice}
                onChange={(e) => setNewUnitPrice(e.target.value)}
                placeholder="Ex: 12.50"
              />
              <p className="text-[11px] text-muted-foreground">
                Use ponto ou vírgula como separador decimal.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateFolder} disabled={saving}>
              {saving ? "Criando..." : "Criar pasta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!folderToDelete} onOpenChange={(v) => !v && setFolderToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pasta?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{folderToDelete?.client_name}</strong> e todos os arquivos serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFolder} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}