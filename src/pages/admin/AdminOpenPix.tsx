import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Wallet, TrendingUp, AlertCircle, Building2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BalanceData {
  account: {
    accountId: string;
    officialName: string;
    tradeName: string;
    branch: string;
    account: string;
    accountName: string;
    balance: { total: number; available: number; blocked: number };
  } | null;
  today: {
    count: number;
    total: number;
    fees: number;
    charges: Array<{ value: number; fee: number; paidAt: string; comment: string; customer?: string }>;
  };
}

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export default function AdminOpenPix() {
  const [data, setData] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: res, error: err } = await supabase.functions.invoke("openpix-balance");
      if (err) throw err;
      if (res?.error) throw new Error(res.error);
      setData(res);
      setLastUpdate(new Date());
    } catch (e: any) {
      setError(e.message || "Erro ao buscar saldo");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const i = setInterval(load, 60000);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Saldo OpenPix</h1>
          <p className="text-sm text-muted-foreground">
            Saldo em tempo real da sua conta Woovi/OpenPix
            {lastUpdate && ` • Atualizado ${format(lastUpdate, "HH:mm:ss", { locale: ptBR })}`}
          </p>
        </div>
        <Button onClick={load} disabled={loading} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {error && (
        <Card className="glass-panel p-4 border-red-500/30 bg-red-500/5">
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        </Card>
      )}

      {data?.account && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="glass-panel p-6 border-green-500/30 bg-gradient-to-br from-green-500/10 to-emerald-500/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Saldo Disponível</span>
                <Wallet className="h-5 w-5 text-green-400" />
              </div>
              <div className="text-3xl font-bold text-green-400">
                {formatBRL(data.account.balance.available)}
              </div>
              <p className="text-xs text-muted-foreground mt-2">Pronto para saque/transferência</p>
            </Card>

            <Card className="glass-panel p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Saldo Total</span>
                <Wallet className="h-5 w-5 text-blue-400" />
              </div>
              <div className="text-3xl font-bold">{formatBRL(data.account.balance.total)}</div>
              <p className="text-xs text-muted-foreground mt-2">Disponível + bloqueado</p>
            </Card>

            <Card className="glass-panel p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Saldo Bloqueado</span>
                <AlertCircle className="h-5 w-5 text-yellow-400" />
              </div>
              <div className="text-3xl font-bold text-yellow-400">
                {formatBRL(data.account.balance.blocked)}
              </div>
              <p className="text-xs text-muted-foreground mt-2">Em análise/retido</p>
            </Card>
          </div>

          <Card className="glass-panel p-6">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <h2 className="font-semibold">Dados da Conta</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Razão Social</p>
                <p className="font-medium">{data.account.officialName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Nome Fantasia</p>
                <p className="font-medium">{data.account.tradeName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Agência / Conta</p>
                <p className="font-medium">{data.account.branch} / {data.account.account}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Conta</p>
                <p className="font-medium">{data.account.accountName}</p>
              </div>
            </div>
          </Card>

          <Card className="glass-panel p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-400" />
                <h2 className="font-semibold">Recebido Hoje (OpenPix)</h2>
              </div>
              <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">
                {data.today.count} PIX
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="p-4 rounded-lg bg-secondary/30">
                <p className="text-xs text-muted-foreground">Total Recebido</p>
                <p className="text-2xl font-bold text-green-400">{formatBRL(data.today.total)}</p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/30">
                <p className="text-xs text-muted-foreground">Taxas OpenPix</p>
                <p className="text-2xl font-bold text-red-400">-{formatBRL(data.today.fees)}</p>
              </div>
            </div>

            {data.today.charges.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground mb-2">Cobranças pagas hoje:</p>
                {data.today.charges.map((c, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-secondary/20 text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{c.comment || "Sem descrição"}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.customer && `${c.customer} • `}
                        {c.paidAt && format(new Date(c.paidAt), "HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="text-right ml-3">
                      <p className="font-semibold text-green-400">{formatBRL(c.value)}</p>
                      {c.fee > 0 && (
                        <p className="text-xs text-muted-foreground">taxa {formatBRL(c.fee)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum PIX recebido hoje ainda
              </p>
            )}
          </Card>
        </>
      )}

      {loading && !data && (
        <Card className="glass-panel p-12 text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-3">Carregando saldo...</p>
        </Card>
      )}
    </div>
  );
}