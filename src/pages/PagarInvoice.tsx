import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, CheckCircle, Clock, XCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import logoFbflix from "@/assets/logo-fbflix.webp";

interface InvoiceData {
  id: string;
  code: string;
  client_name: string | null;
  product_name: string;
  amount: number;
  description: string | null;
  reference_date: string;
  status: string;
  qr_code: string | null;
  qr_code_base64: string | null;
  expires_at: string;
  paid_at: string | null;
  mp_payment_id: string | null;
  payment_id: string | null;
}

export default function PagarInvoice() {
  const { code } = useParams<{ code: string }>();
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadInvoice();
  }, [code]);

  // Poll payment status
  useEffect(() => {
    if (!invoice || invoice.status !== "pending") return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("invoice_links" as any)
        .select("status, paid_at")
        .eq("code", code)
        .single();
      if (data && (data as any).status === "paid") {
        setInvoice(prev => prev ? { ...prev, status: "paid", paid_at: (data as any).paid_at } : prev);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [invoice?.status, code]);

  const loadInvoice = async () => {
    if (!code) { setNotFound(true); setLoading(false); return; }
    const { data, error } = await supabase
      .from("invoice_links" as any)
      .select("*")
      .eq("code", code)
      .single();

    if (error || !data) {
      setNotFound(true);
    } else {
      setInvoice(data as any);
    }
    setLoading(false);
  };

  const copyPixCode = () => {
    if (invoice?.qr_code) {
      navigator.clipboard.writeText(invoice.qr_code);
      setCopied(true);
      toast.success("Código PIX copiado!");
      setTimeout(() => setCopied(false), 3000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#0a0a0a] to-[#1a0a0a]">
        <div className="flex items-center gap-2 animate-pulse">
          <img src={logoFbflix} alt="FBFLIX" className="w-10 h-10" />
          <span className="text-xl font-bold text-white">Carregando...</span>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#0a0a0a] to-[#1a0a0a] px-4">
        <Card className="max-w-md w-full bg-[#1a1a1a] border-red-500/20">
          <CardContent className="pt-6 text-center space-y-4">
            <XCircle className="size-12 text-red-400 mx-auto" />
            <h2 className="text-xl font-bold text-white">Cobrança não encontrada</h2>
            <p className="text-sm text-gray-400">O link informado é inválido ou expirou.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invoice) return null;

  const isExpired = new Date(invoice.expires_at) < new Date() && invoice.status !== "paid";
  const isPaid = invoice.status === "paid";

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0a] to-[#1a0a0a] flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <img src={logoFbflix} alt="FBFLIX" className="w-12 h-12 mx-auto" />
          <h1 className="text-lg font-bold text-white">FBFLIX — Pagamento</h1>
        </div>

        <Card className="bg-[#1a1a1a] border-white/10">
          <CardContent className="pt-6 space-y-5">
            {/* Greeting */}
            {invoice.client_name && (
              <div className="text-center">
                <p className="text-sm text-gray-400">Olá,</p>
                <p className="text-lg font-bold text-white">{invoice.client_name}</p>
              </div>
            )}

            {/* Invoice details */}
            <div className="space-y-3 bg-white/5 rounded-lg p-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Referente a:</span>
                <span className="text-white font-medium">{invoice.product_name}</span>
              </div>
              {invoice.description && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Detalhes:</span>
                  <span className="text-white text-right max-w-[200px]">{invoice.description}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Data ref.:</span>
                <span className="text-white">{format(new Date(invoice.reference_date), "dd/MM/yyyy")}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Código:</span>
                <span className="text-white font-mono text-xs">{invoice.code}</span>
              </div>
              <div className="border-t border-white/10 pt-3 flex justify-between items-center">
                <span className="text-gray-400 text-sm">Valor:</span>
                <span className="text-2xl font-bold text-green-400">R$ {Number(invoice.amount).toFixed(2)}</span>
              </div>
            </div>

            {/* Status */}
            {isPaid && (
              <div className="text-center space-y-3 py-4">
                <CheckCircle className="size-16 text-green-400 mx-auto" />
                <h3 className="text-xl font-bold text-green-400">Pagamento Confirmado!</h3>
                <p className="text-sm text-gray-400">
                  Pago em {invoice.paid_at ? format(new Date(invoice.paid_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "—"}
                </p>
              </div>
            )}

            {isExpired && (
              <div className="text-center space-y-3 py-4">
                <XCircle className="size-16 text-red-400 mx-auto" />
                <h3 className="text-xl font-bold text-red-400">Cobrança Expirada</h3>
                <p className="text-sm text-gray-400">Este link de pagamento expirou. Entre em contato para solicitar um novo.</p>
              </div>
            )}

            {!isPaid && !isExpired && (
              <>
                {/* QR Code */}
                {invoice.qr_code_base64 && (
                  <div className="flex justify-center">
                    <div className="bg-white p-3 rounded-xl">
                      <img
                        src={`data:image/png;base64,${invoice.qr_code_base64}`}
                        alt="QR Code PIX"
                        className="w-48 h-48"
                      />
                    </div>
                  </div>
                )}

                {/* Copy PIX */}
                {invoice.qr_code && (
                  <Button
                    onClick={copyPixCode}
                    className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
                    size="lg"
                  >
                    {copied ? <CheckCircle className="size-4" /> : <Copy className="size-4" />}
                    {copied ? "Copiado!" : "Copiar Código PIX"}
                  </Button>
                )}

                {/* Timer */}
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-yellow-400 text-xs">
                    <Clock className="size-3" />
                    <span>Expira em {format(new Date(invoice.expires_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                  </div>
                </div>
              </>
            )}

            {/* Security */}
            <div className="flex items-center justify-center gap-1.5 text-gray-500 text-xs pt-2 border-t border-white/5">
              <ShieldCheck className="size-3.5" />
              <span>Pagamento seguro via PIX — Mercado Pago</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
