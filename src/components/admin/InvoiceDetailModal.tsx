import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, CheckCircle, Clock, XCircle, ExternalLink, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface InvoiceData {
  id: string;
  code: string;
  client_name: string | null;
  client_email: string | null;
  product_name: string;
  amount: number;
  description: string | null;
  status: string;
  created_at: string;
  expires_at: string;
  paid_at: string | null;
  qr_code: string | null;
  qr_code_base64: string | null;
  reference_date?: string;
}

interface Props {
  invoice: InvoiceData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function InvoiceDetailModal({ invoice, open, onOpenChange }: Props) {
  const [copiedPix, setCopiedPix] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);

  if (!invoice) return null;

  const isExpired = new Date(invoice.expires_at) < new Date() && invoice.status !== "paid";
  const isPaid = invoice.status === "paid";
  const isPending = !isPaid && !isExpired;

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "mxnlerkeygfvdnznoxld";
  const shareLink = `https://${projectId}.supabase.co/functions/v1/invoice-og?code=${invoice.code}`;
  const directLink = `${window.location.origin}/pagar/${invoice.code}`;

  const whatsappMessage = `Olá ${invoice.client_name || ""}! 👋\n\nVocê tem uma cobrança pendente na *FBFLIX*:\n\n📦 *${invoice.product_name}*\n💰 *R$ ${Number(invoice.amount).toFixed(2)}*\n${invoice.description ? `📝 ${invoice.description}\n` : ""}\nAcesse o link abaixo para efetuar o pagamento via PIX:\n🔗 ${publicLink}\n\nQualquer dúvida, estamos à disposição! ✅`;

  const copyPixCode = () => {
    if (invoice.qr_code) {
      navigator.clipboard.writeText(invoice.qr_code);
      setCopiedPix(true);
      toast.success("Código PIX copiado!");
      setTimeout(() => setCopiedPix(false), 3000);
    }
  };

  const copyMessage = () => {
    navigator.clipboard.writeText(whatsappMessage);
    setCopiedMsg(true);
    toast.success("Mensagem copiada!");
    setTimeout(() => setCopiedMsg(false), 3000);
  };

  const openWhatsApp = () => {
    const encoded = encodeURIComponent(whatsappMessage);
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Cobrança {invoice.code}
            {isPaid && <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle className="size-3 mr-1" />Pago</Badge>}
            {isExpired && <Badge variant="destructive"><XCircle className="size-3 mr-1" />Expirado</Badge>}
            {isPending && <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><Clock className="size-3 mr-1" />Pendente</Badge>}
          </DialogTitle>
        </DialogHeader>

        {/* Card preview */}
        <div className="rounded-xl bg-gradient-to-br from-primary/10 via-background to-primary/5 border border-primary/20 p-5 space-y-3">
          <p className="text-sm text-muted-foreground">Olá,</p>
          <p className="text-xl font-bold text-foreground">{invoice.client_name || "Cliente"}</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Referente a:</span>
              <span className="font-medium text-foreground">{invoice.product_name}</span>
            </div>
            {invoice.description && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Detalhes:</span>
                <span className="text-foreground text-right max-w-[200px]">{invoice.description}</span>
              </div>
            )}
            <div className="border-t border-border pt-2 flex justify-between items-center">
              <span className="text-muted-foreground">Valor:</span>
              <span className="text-2xl font-bold text-green-400">R$ {Number(invoice.amount).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* QR Code */}
        {isPending && invoice.qr_code_base64 && (
          <div className="flex flex-col items-center gap-3">
            <div className="bg-white p-3 rounded-xl">
              <img
                src={`data:image/png;base64,${invoice.qr_code_base64}`}
                alt="QR Code PIX"
                className="w-40 h-40"
              />
            </div>
            <Button onClick={copyPixCode} variant="outline" className="gap-2 w-full">
              {copiedPix ? <CheckCircle className="size-4 text-green-400" /> : <Copy className="size-4" />}
              {copiedPix ? "Código PIX copiado!" : "Copiar Código PIX"}
            </Button>
          </div>
        )}

        {isPaid && invoice.paid_at && (
          <div className="text-center py-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <CheckCircle className="size-10 text-green-400 mx-auto mb-2" />
            <p className="font-bold text-green-400">Pagamento Confirmado</p>
            <p className="text-xs text-muted-foreground mt-1">
              {format(new Date(invoice.paid_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2 pt-2">
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={copyMessage} variant="outline" className="gap-2">
              {copiedMsg ? <CheckCircle className="size-4 text-green-400" /> : <Copy className="size-4" />}
              {copiedMsg ? "Copiado!" : "Copiar mensagem"}
            </Button>
            <Button onClick={openWhatsApp} className="gap-2 bg-green-600 hover:bg-green-700 text-white">
              <MessageCircle className="size-4" />
              Enviar WhatsApp
            </Button>
          </div>
          <Button
            onClick={() => window.open(publicLink, "_blank")}
            variant="outline"
            className="w-full gap-2"
          >
            <ExternalLink className="size-4" />
            Abrir página de pagamento
          </Button>
        </div>

        {/* Info */}
        <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border">
          <p>Criado em: {format(new Date(invoice.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
          <p>Expira em: {format(new Date(invoice.expires_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
          <p>Link: <span className="font-mono text-xs break-all">{publicLink}</span></p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
