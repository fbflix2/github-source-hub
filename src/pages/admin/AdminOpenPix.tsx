import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Wallet, TrendingUp, AlertCircle, Building2, Undo2, History, Download } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
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
    charges: Array<{
      value: number; fee: number; paidAt: string; comment: string; customer?: string;
      correlationID?: string; identifier?: string; transactionID?: string; endToEndId?: string; status?: string;
    }>;
  };
}

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

type HistoryCharge = {
  value: number; fee: number; paidAt: string; createdAt?: string; comment: string;
  customer?: string; correlationID?: string; identifier?: string;
  transactionID?: string; endToEndId?: string; status?: string;
};

type Period = "7d" | "30d" | "month" | "lastMonth" | "year" | "custom";

const computeRange = (period: Period, month: string, year: string, from: string, to: string) => {
  const now = new Date();
  let start: Date, end: Date;
  if (period === "7d") {
    end = new Date(); start = new Date(); start.setDate(end.getDate() - 7);
  } else if (period === "30d") {
    end = new Date(); start = new Date(); start.setDate(end.getDate() - 30);
  } else if (period === "month") {
    const [y, m] = month.split("-").map(Number);
    start = new Date(y, m - 1, 1, 0, 0, 0);
    end = new Date(y, m, 1, 0, 0, 0);
  } else if (period === "lastMonth") {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (period === "year") {
    const y = Number(year);
    start = new Date(y, 0, 1); end = new Date(y + 1, 0, 1);
  } else {
    start = from ? new Date(from + "T00:00:00") : new Date(now.getFullYear(), now.getMonth(), 1);
    end = to ? new Date(to + "T23:59:59") : new Date();
  }
  return { start: start.toISOString(), end: end.toISOString() };
};

export default function AdminOpenPix() {
  const [data, setData] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [refundCharge, setRefundCharge] = useState<BalanceData["today"]["charges"][number] | null>(null);
  const [refundValue, setRefundValue] = useState("");
  const [refundComment, setRefundComment] = useState("");
  const [refundUpdateOrder, setRefundUpdateOrder] = useState(true);
  const [refundLoading, setRefundLoading] = useState(false);

  // Histórico
  const today = new Date();
  const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const [period, setPeriod] = useState<Period>("month");
  const [filterMonth, setFilterMonth] = useState(ym);
  const [filterYear, setFilterYear] = useState(String(today.getFullYear()));
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [history, setHistory] = useState<{ count: number; total: number; fees: number; net: number; charges: HistoryCharge[] } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [search, setSearch] = useState("");

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

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const { start, end } = computeRange(period, filterMonth, filterYear, filterFrom, filterTo);
      const { data: res, error: err } = await supabase.functions.invoke("openpix-charges", {
        body: { start, end },
      });
      if (err) throw err;
      if (res?.error) throw new Error(res.error);
      setHistory(res);
    } catch (e: any) {
      toast.error(e.message || "Erro ao buscar histórico");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    load();
    const i = setInterval(load, 60000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => { loadHistory(); /* eslint-disable-next-line */ }, []);

  const filteredCharges = (history?.charges || []).filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (c.comment || "").toLowerCase().includes(q) ||
      (c.customer || "").toLowerCase().includes(q) ||
      (c.correlationID || "").toLowerCase().includes(q) ||
      (c.endToEndId || "").toLowerCase().includes(q)
    );
  });

  const exportCsv = () => {
    if (!history) return;
    const rows = [
      ["Data", "Cliente", "Descrição", "Valor", "Taxa", "Líquido", "EndToEndId"],
      ...filteredCharges.map((c) => [
        c.paidAt ? format(new Date(c.paidAt), "dd/MM/yyyy HH:mm") : "",
        c.customer || "",
        (c.comment || "").replace(/[\r\n;]/g, " "),
        c.value.toFixed(2).replace(".", ","),
        c.fee.toFixed(2).replace(".", ","),
        (c.value - c.fee).toFixed(2).replace(".", ","),
        c.endToEndId || "",
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `openpix-recebimentos-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const openRefund = (c: BalanceData["today"]["charges"][number]) => {
    setRefundCharge(c);
    setRefundValue(c.value.toFixed(2).replace(".", ","));
    setRefundComment(`Estorno: ${c.comment || ""}`.slice(0, 140));
    setRefundUpdateOrder(true);
  };

  const submitRefund = async () => {
    if (!refundCharge) return;
    const valNum = Number(refundValue.replace(",", "."));
    if (!valNum || valNum <= 0 || valNum > refundCharge.value) {
      toast.error("Valor inválido");
      return;
    }
    setRefundLoading(true);
    try {
      const { data: res, error: err } = await supabase.functions.invoke("openpix-refund", {
        body: {
          chargeId: refundCharge.identifier || refundCharge.correlationID,
          correlationID: refundCharge.correlationID,
          value: Math.round(valNum * 100),
          comment: refundComment,
          updateOrder: refundUpdateOrder,
        },
      });
      if (err) throw err;
      if (res?.error) throw new Error(res.error);
      toast.success(
        res?.orderUpdated
          ? "Estorno enviado e pedido marcado como reembolsado"
          : "Estorno enviado para a OpenPix"
      );
      setRefundCharge(null);
      load();
    } catch (e: any) {
      toast.error(e.message || "Falha no estorno");
    } finally {
      setRefundLoading(false);
    }
  };

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
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-3"
                      onClick={() => openRefund(c)}
                      disabled={!c.identifier && !c.correlationID}
                    >
                      <Undo2 className="h-3 w-3 mr-1" /> Estornar
                    </Button>
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

      {/* Histórico de Recebimentos */}
      <Card className="glass-panel p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-blue-400" />
            <h2 className="font-semibold">Histórico de Recebimentos</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!history?.charges?.length}>
              <Download className="h-3 w-3 mr-1" /> CSV
            </Button>
            <Button size="sm" onClick={loadHistory} disabled={historyLoading}>
              <RefreshCw className={`h-3 w-3 mr-1 ${historyLoading ? "animate-spin" : ""}`} />
              Aplicar
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
          <div>
            <Label className="text-xs">Período</Label>
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="month">Mês específico</SelectItem>
                <SelectItem value="lastMonth">Mês passado</SelectItem>
                <SelectItem value="year">Ano</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {period === "month" && (
            <div>
              <Label className="text-xs">Mês</Label>
              <Input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} />
            </div>
          )}
          {period === "year" && (
            <div>
              <Label className="text-xs">Ano</Label>
              <Input type="number" value={filterYear} onChange={(e) => setFilterYear(e.target.value)} min="2020" max="2099" />
            </div>
          )}
          {period === "custom" && (
            <>
              <div>
                <Label className="text-xs">De</Label>
                <Input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Até</Label>
                <Input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
              </div>
            </>
          )}
          <div className="md:col-span-2">
            <Label className="text-xs">Buscar (cliente, descrição, ID)</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filtrar resultados..." />
          </div>
        </div>

        {history && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="p-3 rounded-lg bg-secondary/30">
              <p className="text-xs text-muted-foreground">Qtd. PIX</p>
              <p className="text-xl font-bold">{filteredCharges.length}</p>
            </div>
            <div className="p-3 rounded-lg bg-secondary/30">
              <p className="text-xs text-muted-foreground">Total Bruto</p>
              <p className="text-xl font-bold text-green-400">
                {formatBRL(filteredCharges.reduce((s, c) => s + c.value, 0))}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-secondary/30">
              <p className="text-xs text-muted-foreground">Taxas</p>
              <p className="text-xl font-bold text-red-400">
                -{formatBRL(filteredCharges.reduce((s, c) => s + c.fee, 0))}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-secondary/30">
              <p className="text-xs text-muted-foreground">Líquido</p>
              <p className="text-xl font-bold text-emerald-400">
                {formatBRL(filteredCharges.reduce((s, c) => s + (c.value - c.fee), 0))}
              </p>
            </div>
          </div>
        )}

        {historyLoading ? (
          <div className="py-10 text-center">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : filteredCharges.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum recebimento no período</p>
        ) : (
          <div className="space-y-1 max-h-[500px] overflow-y-auto">
            {filteredCharges.map((c, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-secondary/20 text-sm hover:bg-secondary/30">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{c.comment || "Sem descrição"}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {c.customer && `${c.customer} • `}
                    {c.paidAt && format(new Date(c.paidAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <div className="text-right ml-3 shrink-0">
                  <p className="font-semibold text-green-400">{formatBRL(c.value)}</p>
                  {c.fee > 0 && (
                    <p className="text-xs text-muted-foreground">taxa {formatBRL(c.fee)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {loading && !data && (
        <Card className="glass-panel p-12 text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-3">Carregando saldo...</p>
        </Card>
      )}

      <Dialog open={!!refundCharge} onOpenChange={(o) => !o && setRefundCharge(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Estornar PIX</DialogTitle>
            <DialogDescription>
              O valor será debitado do saldo OpenPix e enviado de volta ao pagador.
            </DialogDescription>
          </DialogHeader>
          {refundCharge && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-secondary/30 text-sm">
                <p className="font-medium">{refundCharge.comment || "Sem descrição"}</p>
                <p className="text-xs text-muted-foreground">
                  {refundCharge.customer && `${refundCharge.customer} • `}
                  Recebido: {formatBRL(refundCharge.value)}
                </p>
              </div>
              <div>
                <Label>Valor a estornar (R$)</Label>
                <Input
                  value={refundValue}
                  onChange={(e) => setRefundValue(e.target.value)}
                  placeholder="0,00"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Máx: {formatBRL(refundCharge.value)}. Pode ser parcial.
                </p>
              </div>
              <div>
                <Label>Motivo (opcional)</Label>
                <Input
                  value={refundComment}
                  onChange={(e) => setRefundComment(e.target.value.slice(0, 140))}
                  placeholder="Motivo do estorno"
                />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={refundUpdateOrder}
                  onCheckedChange={(v) => setRefundUpdateOrder(!!v)}
                />
                <span>
                  Marcar pedido como <strong>reembolsado</strong> (cancela comissão de parceiro,
                  devolve estoque, etc.)
                </span>
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundCharge(null)} disabled={refundLoading}>
              Cancelar
            </Button>
            <Button onClick={submitRefund} disabled={refundLoading}>
              {refundLoading ? "Enviando..." : "Confirmar Estorno"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}