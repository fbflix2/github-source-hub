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

  // Poll payment status via edge function
  useEffect(() => {
    if (!invoice || invoice.status !== "pending") return;
    const interval = setInterval(async () => {
      try {
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/invoice-lookup?code=${code}&action=status`
        );
        const statusData = await res.json();
        if (statusData?.status === "paid") {
          setInvoice(prev => prev ? { ...prev, status: "paid", paid_at: statusData.paid_at } : prev);
        }
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [invoice?.status, code]);

  const loadInvoice = async () => {
    if (!code) { setNotFound(true); setLoading(false); return; }
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/invoice-lookup?code=${encodeURIComponent(code)}`
      );
      if (!res.ok) { setNotFound(true); setLoading(false); return; }
      const data = await res.json();
      if (data?.error) { setNotFound(true); } else { setInvoice(data); }
    } catch {
      setNotFound(true);
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
          <img src={logoFbflix} alt="FBFLIX" className="w-16 h-16" />
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
          <img src={logoFbflix} alt="FBFLIX" className="w-20 h-20 mx-auto" />
          <h1 className="text-xl font-black text-white tracking-tighter italic uppercase">
            FBFLIX <span className="text-primary">— PAGAMENTO</span>
          </h1>
        </div>

        <Card className="bg-[#111111] border-white/10 shadow-2xl overflow-hidden relative">
          {/* Glow effect */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 blur-[100px] pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-emerald-500/10 blur-[100px] pointer-events-none" />

          <CardContent className="pt-6 space-y-5 relative z-10">
            {/* Greeting */}
            {invoice.client_name && (
              <div className="text-center">
                <p className="text-sm text-gray-400">Olá,</p>
                <p className="text-lg font-bold text-white">{invoice.client_name}</p>
              </div>
            )}

            {/* Invoice details */}
            <div className="space-y-3 bg-white/[0.03] border border-white/5 rounded-2xl p-5">
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
              <div className="border-t border-white/5 pt-4 flex justify-between items-center">
                <span className="text-gray-400 text-sm font-medium">Valor total:</span>
                <span className="text-3xl font-black text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]">
                  R$ {Number(invoice.amount).toFixed(2).replace('.', ',')}
                </span>
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
                        src={
                          invoice.qr_code_base64.startsWith('http')
                            ? invoice.qr_code_base64
                            : invoice.qr_code_base64.startsWith('data:')
                              ? invoice.qr_code_base64
                              : `data:image/png;base64,${invoice.qr_code_base64}`
                        }
                        alt="QR Code PIX"
                        className="w-48 h-48 object-contain"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {/* PIX Copy & Paste Input */}
                  {invoice.qr_code && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest ml-1">Código Copia e Cola</label>
                      <div className="relative group">
                        <input
                          type="text"
                          readOnly
                          value={invoice.qr_code}
                          className="w-full bg-white/[0.02] border border-white/10 rounded-xl py-3 px-4 pr-12 text-xs text-gray-400 font-mono truncate focus:outline-none focus:border-emerald-500/50 transition-colors"
                        />
                        <button
                          onClick={copyPixCode}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-emerald-400 transition-colors"
                        >
                          {copied ? <CheckCircle className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Copy PIX Button (Large) */}
                  {invoice.qr_code && (
                    <Button
                      onClick={copyPixCode}
                      className="w-full gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-14 rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                    >
                      {copied ? <CheckCircle className="size-5" /> : <Copy className="size-5" />}
                      {copied ? "Copiar PIX" : "Copiar Código PIX"}
                    </Button>
                  )}

                  {/* Support Action */}
                  <Button
                    variant="outline"
                    onClick={() => {
                      const msg = encodeURIComponent(`Olá! Estou com uma dúvida sobre a cobrança ${invoice.code} de R$ ${Number(invoice.amount).toFixed(2)}.`);
                      window.open(`https://wa.me/5511999999999?text=${msg}`, "_blank");
                    }}
                    className="w-full border-white/10 hover:bg-white/5 text-gray-400 h-12 rounded-xl"
                  >
                    Dúvidas? Falar com suporte
                  </Button>
                </div>

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
              <span>Pagamento seguro via PIX</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
