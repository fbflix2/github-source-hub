import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Loader2, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface ExportClientsModalProps {
  open: boolean;
  onClose: () => void;
}

type ExportFormat = "xlsx" | "csv";

export default function ExportClientsModal({ open, onClose }: ExportClientsModalProps) {
  const [exporting, setExporting] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("xlsx");

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("full_name, phone, balance, status, created_at, user_id")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const rows = (profiles || []).map((p) => ({
        Nome: p.full_name || "Sem nome",
        Telefone: p.phone || "",
        Saldo: Number(p.balance || 0).toFixed(2),
        Status: p.status || "active",
        "Data de Cadastro": new Date(p.created_at).toLocaleDateString("pt-BR"),
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Clientes");

      const fileName = `clientes_${new Date().toISOString().slice(0, 10)}`;

      if (format === "xlsx") {
        XLSX.writeFile(wb, `${fileName}.xlsx`);
      } else {
        XLSX.writeFile(wb, `${fileName}.csv`, { bookType: "csv" });
      }

      toast.success(`${rows.length} clientes exportados com sucesso!`);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao exportar clientes");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#1a0a0a] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Download className="w-5 h-5 text-primary" />
            Exportar Clientes
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5 mt-2">
          <p className="text-sm text-white/60">
            Exporte toda a base de clientes com nome, telefone, saldo, status e data de cadastro.
          </p>

          {/* Format Selection */}
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-white/80">Formato</p>
            <div className="flex gap-3">
              {(["xlsx", "csv"] as ExportFormat[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-bold uppercase transition-all ${
                    format === f
                      ? "bg-primary/20 border-primary text-primary"
                      : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10"
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  .{f}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleExport}
            disabled={exporting}
            className="bg-primary hover:bg-primary/80 text-white font-bold py-3 h-auto rounded-xl"
          >
            {exporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Exportar Clientes
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
