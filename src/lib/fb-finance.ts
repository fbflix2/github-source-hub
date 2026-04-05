export const FB_FINANCE_NON_OPERATIONAL_CATEGORIES = ["Aporte Pessoal", "Transferência", "Capital de Giro", "Distribuição PJ"] as const;

export interface FbFinanceLancamentoLike {
  caixa_destino_id?: string | null;
  categoria?: string | null;
  entrada?: number | string | null;
  saida?: number | string | null;
  data?: string | null;
}

export interface FbFinanceCaixaLike {
  id: string;
  tipo?: string | null;
  saldo_atual?: number | string | null;
}

const toAmount = (value: number | string | null | undefined) => Number(value || 0);

export const filterOperationalLancamentos = <T extends { categoria?: string | null }>(lancamentos: T[]) =>
  lancamentos.filter((lancamento) => !FB_FINANCE_NON_OPERATIONAL_CATEGORIES.includes((lancamento.categoria || "") as any));

export const getLancamentoTotals = <T extends { entrada?: number | string | null; saida?: number | string | null }>(lancamentos: T[]) => {
  const totalEntradas = lancamentos.reduce((sum, lancamento) => sum + toAmount(lancamento.entrada), 0);
  const totalSaidas = lancamentos.reduce((sum, lancamento) => sum + toAmount(lancamento.saida), 0);

  return {
    totalEntradas,
    totalSaidas,
    saldo: totalEntradas - totalSaidas,
  };
};

export const getOperationalTotals = <T extends { categoria?: string | null; entrada?: number | string | null; saida?: number | string | null; data?: string | null }>(lancamentos: T[]) => {
  const operacionais = filterOperationalLancamentos(lancamentos);
  const { totalEntradas, totalSaidas, saldo } = getLancamentoTotals(operacionais);
  const uniqueDays = new Set(operacionais.map((lancamento) => lancamento.data).filter(Boolean)).size;

  return {
    lancamentos: operacionais,
    totalEntradas,
    totalSaidas,
    saldo,
    uniqueDays,
  };
};

export const buildDisplayCaixaBalanceMap = <C extends FbFinanceCaixaLike, L extends FbFinanceLancamentoLike>(caixas: C[], lancamentos: L[]) => {
  const lancamentoMap = lancamentos.reduce<Record<string, number>>((acc, lancamento) => {
    if (!lancamento.caixa_destino_id) return acc;
    acc[lancamento.caixa_destino_id] = (acc[lancamento.caixa_destino_id] || 0) + toAmount(lancamento.entrada) - toAmount(lancamento.saida);
    return acc;
  }, {});

  return caixas.reduce<Record<string, number>>((acc, caixa) => {
    const saldoLancamentos = lancamentoMap[caixa.id];
    acc[caixa.id] = caixa.tipo === "pessoal" && saldoLancamentos !== undefined
      ? saldoLancamentos
      : toAmount(caixa.saldo_atual);
    return acc;
  }, {});
};
