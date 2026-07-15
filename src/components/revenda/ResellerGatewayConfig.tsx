import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  Loader2,
  Save,
  ShieldCheck,
  KeyRound,
  AlertTriangle,
  ExternalLink,
  Eye,
  EyeOff,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Provider = "openpix" | "mercadopago";

interface Props {
  resellerId: string;
}

interface GatewayRow {
  gateway_provider: Provider | null;
  gateway_openpix_app_id: string | null;
  gateway_mp_access_token: string | null;
  gateway_mp_public_key: string | null;
}

const mask = (v: string | null | undefined) => {
  if (!v) return "";
  if (v.length <= 8) return "•".repeat(v.length);
  return v.slice(0, 4) + "•".repeat(Math.max(4, v.length - 8)) + v.slice(-4);
};

export default function ResellerGatewayConfig({ resellerId }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Provider | null>(null);
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [initial, setInitial] = useState<GatewayRow | null>(null);
  const [form, setForm] = useState({
    openpix_app_id: "",
    mp_access_token: "",
    mp_public_key: "",
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("resellers")
        .select(
          "gateway_provider, gateway_openpix_app_id, gateway_mp_access_token, gateway_mp_public_key"
        )
        .eq("id", resellerId)
        .maybeSingle();
      if (error) toast.error(error.message);
      const row = (data || {}) as GatewayRow;
      setInitial(row);
      setSelected((row.gateway_provider as Provider) || null);
      setForm({
        openpix_app_id: row.gateway_openpix_app_id || "",
        mp_access_token: row.gateway_mp_access_token || "",
        mp_public_key: row.gateway_mp_public_key || "",
      });
      setLoading(false);
    })();
  }, [resellerId]);

  const save = async () => {
    if (!selected) {
      toast.error("Selecione um gateway");
      return;
    }
    if (selected === "openpix" && !form.openpix_app_id.trim()) {
      toast.error("Informe o AppID do OpenPix");
      return;
    }
    if (
      selected === "mercadopago" &&
      (!form.mp_access_token.trim() || !form.mp_public_key.trim())
    ) {
      toast.error("Informe Access Token e Public Key do Mercado Pago");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("resellers")
      .update({
        gateway_provider: selected,
        gateway_openpix_app_id:
          selected === "openpix" ? form.openpix_app_id.trim() : null,
        gateway_mp_access_token:
          selected === "mercadopago" ? form.mp_access_token.trim() : null,
        gateway_mp_public_key:
          selected === "mercadopago" ? form.mp_public_key.trim() : null,
      })
      .eq("id", resellerId);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success("Gateway configurado com sucesso");
    setInitial({
      gateway_provider: selected,
      gateway_openpix_app_id:
        selected === "openpix" ? form.openpix_app_id.trim() : null,
      gateway_mp_access_token:
        selected === "mercadopago" ? form.mp_access_token.trim() : null,
      gateway_mp_public_key:
        selected === "mercadopago" ? form.mp_public_key.trim() : null,
    });
  };

  const disconnect = async () => {
    if (!confirm("Desconectar o gateway atual? A loja ficará indisponível até você configurar outro.")) return;
    setSaving(true);
    const { error } = await supabase
      .from("resellers")
      .update({
        gateway_provider: null,
        gateway_openpix_app_id: null,
        gateway_mp_access_token: null,
        gateway_mp_public_key: null,
      })
      .eq("id", resellerId);
    setSaving(false);
    if (error) {
      toast.error("Erro ao desconectar: " + error.message);
      return;
    }
    toast.success("Gateway desconectado");
    setSelected(null);
    setForm({ openpix_app_id: "", mp_access_token: "", mp_public_key: "" });
    setInitial({
      gateway_provider: null,
      gateway_openpix_app_id: null,
      gateway_mp_access_token: null,
      gateway_mp_public_key: null,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const activeProvider = initial?.gateway_provider || null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center size-11 rounded-xl bg-gradient-to-br from-primary to-red-900 shadow-lg shadow-primary/20">
          <CreditCard className="text-primary-foreground size-5" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">Gateway de Pagamento</h1>
          <p className="text-xs text-muted-foreground">
            Conecte seu próprio gateway. Todo pagamento dos seus clientes cai
            direto na sua conta — a FBFlix apenas debita o custo dos proxies do
            seu saldo de créditos.
          </p>
        </div>
        {activeProvider ? (
          <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 gap-1.5">
            <CheckCircle2 className="size-3" />
            {activeProvider === "openpix" ? "OpenPix ativo" : "Mercado Pago ativo"}
          </Badge>
        ) : (
          <Badge className="bg-red-500/15 text-red-400 border border-red-500/30 gap-1.5">
            <AlertTriangle className="size-3" /> Nenhum gateway
          </Badge>
        )}
      </div>

      {/* Warning if none */}
      {!activeProvider && (
        <Card className="p-4 border-red-500/40 bg-red-500/5 flex items-start gap-3">
          <AlertTriangle className="size-5 text-red-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-bold text-red-300">Sua loja está bloqueada</p>
            <p className="text-xs text-red-300/80 mt-0.5">
              O checkout da sua loja de revenda não funciona enquanto nenhum
              gateway estiver configurado. Escolha OpenPix ou Mercado Pago abaixo.
            </p>
          </div>
        </Card>
      )}

      {/* Provider selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(["openpix", "mercadopago"] as Provider[]).map((prov) => {
          const active = selected === prov;
          const isSaved = activeProvider === prov;
          return (
            <button
              key={prov}
              type="button"
              onClick={() => setSelected(prov)}
              className={cn(
                "text-left p-5 rounded-xl border transition-all bg-card/60",
                active
                  ? "border-primary/60 shadow-lg shadow-primary/10 ring-1 ring-primary/40"
                  : "border-border/40 hover:border-border/70"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "size-9 rounded-lg flex items-center justify-center",
                      prov === "openpix"
                        ? "bg-[#03D69D]/15 text-[#03D69D]"
                        : "bg-[#009EE3]/15 text-[#009EE3]"
                    )}
                  >
                    <CreditCard className="size-4" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground">
                      {prov === "openpix" ? "OpenPix" : "Mercado Pago"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {prov === "openpix"
                        ? "PIX rápido e sem cadastro de PJ"
                        : "PIX + Cartão de crédito/débito"}
                    </p>
                  </div>
                </div>
                {isSaved && (
                  <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px]">
                    Salvo
                  </Badge>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Form */}
      {selected === "openpix" && (
        <Card className="p-6 bg-card/60 border-border/40 space-y-5">
          <div className="flex items-center gap-2">
            <KeyRound className="size-4 text-primary" />
            <h3 className="font-bold text-foreground">Credenciais OpenPix</h3>
          </div>
          <div>
            <Label htmlFor="openpix_app_id" className="text-xs">
              AppID <span className="text-red-400">*</span>
            </Label>
            <div className="relative mt-1">
              <Input
                id="openpix_app_id"
                type={reveal.op ? "text" : "password"}
                autoComplete="off"
                placeholder="Q2xpZW50X0lkX2Y..."
                value={form.openpix_app_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, openpix_app_id: e.target.value }))
                }
                className="pr-10 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setReveal((r) => ({ ...r, op: !r.op }))}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {reveal.op ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Encontre em <b>OpenPix → Aplicações → Nova aplicação</b>. Cole aqui
              o AppID gerado.{" "}
              <a
                href="https://app.openpix.com.br/home/applications"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Abrir OpenPix <ExternalLink className="size-3" />
              </a>
            </p>
          </div>
        </Card>
      )}

      {selected === "mercadopago" && (
        <Card className="p-6 bg-card/60 border-border/40 space-y-5">
          <div className="flex items-center gap-2">
            <KeyRound className="size-4 text-primary" />
            <h3 className="font-bold text-foreground">Credenciais Mercado Pago</h3>
          </div>
          <div>
            <Label htmlFor="mp_access_token" className="text-xs">
              Access Token <span className="text-red-400">*</span>
            </Label>
            <div className="relative mt-1">
              <Input
                id="mp_access_token"
                type={reveal.mp ? "text" : "password"}
                autoComplete="off"
                placeholder="APP_USR-... ou TEST-..."
                value={form.mp_access_token}
                onChange={(e) =>
                  setForm((f) => ({ ...f, mp_access_token: e.target.value }))
                }
                className="pr-10 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setReveal((r) => ({ ...r, mp: !r.mp }))}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {reveal.mp ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Chave privada usada no servidor. Nunca compartilhe.
            </p>
          </div>
          <div>
            <Label htmlFor="mp_public_key" className="text-xs">
              Public Key <span className="text-red-400">*</span>
            </Label>
            <Input
              id="mp_public_key"
              placeholder="APP_USR-..."
              value={form.mp_public_key}
              onChange={(e) =>
                setForm((f) => ({ ...f, mp_public_key: e.target.value }))
              }
              className="font-mono text-xs mt-1"
            />
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Usada no checkout para tokenizar cartão no navegador do cliente.{" "}
              <a
                href="https://www.mercadopago.com.br/developers/panel/app"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Painel do Mercado Pago <ExternalLink className="size-3" />
              </a>
            </p>
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          <ShieldCheck className="size-3.5 text-emerald-400" />
          Suas credenciais ficam privadas — só você e o servidor da FBFlix podem ler.
        </div>
        <div className="flex gap-2">
          {activeProvider && (
            <Button
              variant="outline"
              onClick={disconnect}
              disabled={saving}
              className="text-red-400 hover:text-red-300 border-red-500/40"
            >
              Desconectar
            </Button>
          )}
          <Button onClick={save} disabled={!selected || saving} className="gap-1.5">
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Salvar gateway
          </Button>
        </div>
      </div>

      {/* Current values (masked) */}
      {activeProvider && (
        <Card className="p-4 bg-muted/10 border-border/30 space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            Configuração ativa
          </p>
          {activeProvider === "openpix" && (
            <p className="text-xs font-mono text-foreground">
              AppID: {mask(initial?.gateway_openpix_app_id)}
            </p>
          )}
          {activeProvider === "mercadopago" && (
            <>
              <p className="text-xs font-mono text-foreground">
                Access Token: {mask(initial?.gateway_mp_access_token)}
              </p>
              <p className="text-xs font-mono text-foreground">
                Public Key: {initial?.gateway_mp_public_key || "—"}
              </p>
            </>
          )}
        </Card>
      )}
    </div>
  );
}