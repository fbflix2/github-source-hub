import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export interface StripeConfirmResult {
  ok: boolean;
  paymentId?: string;
  error?: string;
}

export interface StripeCardFieldsHandle {
  confirm: (orderId?: string) => Promise<StripeConfirmResult>;
  isReady: boolean;
}

interface Props {
  amount: number;
  /** true quando a compra gera assinatura (salva o cartão para renovar) */
  subscription?: boolean;
  description?: string;
  onReadyChange?: (ready: boolean) => void;
}

const InnerForm = forwardRef<StripeCardFieldsHandle, { paymentId: string }>(({ paymentId }, ref) => {
  const stripe = useStripe();
  const elements = useElements();
  const [ready, setReady] = useState(false);

  useImperativeHandle(ref, () => ({
    isReady: ready && !!stripe && !!elements,
    async confirm(orderId?: string) {
      if (!stripe || !elements) return { ok: false, error: "Formulário de cartão ainda carregando." };

      const submitResult = await elements.submit();
      if (submitResult.error) {
        return { ok: false, error: submitResult.error.message || "Dados do cartão inválidos." };
      }

      if (orderId) {
        await supabase.functions.invoke("stripe-card-payment", {
          body: { action: "attach_order", payment_id: paymentId, order_id: orderId },
        });
      }

      // redirect: "if_required" mantém o cliente dentro do checkout da FBFLIX
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
        confirmParams: { return_url: `${window.location.origin}/orders` },
      });

      if (error) return { ok: false, paymentId, error: error.message || "Pagamento recusado." };
      if (paymentIntent?.status === "succeeded" || paymentIntent?.status === "processing") {
        return { ok: true, paymentId };
      }
      return { ok: false, paymentId, error: "Pagamento não autorizado pelo emissor do cartão." };
    },
  }), [stripe, elements, ready, paymentId]);

  return (
    <div className="space-y-3">
      <PaymentElement
        onReady={() => setReady(true)}
        options={{ layout: "tabs", fields: { billingDetails: "auto" } }}
      />
      {!ready && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" /> Carregando formulário seguro...
        </div>
      )}
    </div>
  );
});
InnerForm.displayName = "StripeInnerForm";

const StripeCardFields = forwardRef<StripeCardFieldsHandle, Props>(
  ({ amount, subscription, description, onReadyChange }, ref) => {
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [paymentId, setPaymentId] = useState<string | null>(null);
    const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const innerRef = useRef<StripeCardFieldsHandle>(null);
    const requestedAmount = useRef<number | null>(null);

    useImperativeHandle(ref, () => ({
      isReady: !!innerRef.current?.isReady,
      confirm: async (orderId?: string) => {
        if (!innerRef.current) return { ok: false, error: error || "Cartão indisponível no momento." };
        return innerRef.current.confirm(orderId);
      },
    }), [error]);

    useEffect(() => {
      let cancelled = false;
      const rounded = Math.round(amount * 100) / 100;
      if (!rounded || rounded < 5) {
        setLoading(false);
        setError("Cartão exige valor mínimo de R$ 5,00.");
        return;
      }
      if (requestedAmount.current === rounded) return;
      requestedAmount.current = rounded;

      (async () => {
        setLoading(true);
        setError(null);
        const { data, error: fnError } = await supabase.functions.invoke("stripe-card-payment", {
          body: { action: "create_intent", amount: rounded, subscription: !!subscription, description },
        });
        if (cancelled) return;

        const message = (data as any)?.error || fnError?.message;
        if (message || !(data as any)?.client_secret) {
          setError(message || "Não foi possível iniciar o pagamento com cartão.");
          setLoading(false);
          return;
        }

        const pk = (data as any).publishable_key || import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
        if (!pk) {
          setError("Chave pública da Stripe não configurada.");
          setLoading(false);
          return;
        }

        setStripePromise(loadStripe(pk));
        setClientSecret((data as any).client_secret);
        setPaymentId((data as any).payment_id);
        setLoading(false);
      })();

      return () => {
        cancelled = true;
      };
    }, [amount, subscription, description]);

    useEffect(() => {
      onReadyChange?.(!!clientSecret && !error);
    }, [clientSecret, error, onReadyChange]);

    const options = useMemo(
      () =>
        clientSecret
          ? {
              clientSecret,
              locale: "pt-BR" as const,
              appearance: {
                theme: "night" as const,
                variables: {
                  colorPrimary: "#22c55e",
                  colorBackground: "#0b0f14",
                  colorText: "#e6edf3",
                  borderRadius: "10px",
                  fontFamily: "Manrope, system-ui, sans-serif",
                },
              },
            }
          : null,
      [clientSecret],
    );

    if (loading) {
      return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
          <Loader2 className="w-4 h-4 animate-spin" /> Preparando pagamento seguro...
        </div>
      );
    }

    if (error || !options || !stripePromise || !paymentId) {
      return (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          {error || "Cartão indisponível no momento. Use Pix ou saldo."}
        </div>
      );
    }

    return (
      <Elements stripe={stripePromise} options={options}>
        <InnerForm ref={innerRef} paymentId={paymentId} />
      </Elements>
    );
  },
);
StripeCardFields.displayName = "StripeCardFields";

export default StripeCardFields;