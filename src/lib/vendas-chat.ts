// Ferramenta do chat para vendas reais (BMWeb). Só roda no servidor.
import {
  daysBetween,
  faixaLabels,
  hourGrid,
  isIsoDate,
  presetLabels,
  presetRange,
  todayInStore,
  weekdayLong,
  weekdayStats,
  type Preset,
  type Situacao,
} from "@/lib/vendas";
import { painelVendas } from "@/lib/vendas-server";
import { supabaseConfigurado } from "@/lib/supabase-server";

export function realSalesAvailable() {
  return supabaseConfigurado() && Boolean(process.env.SUPABASE_EMPRESA_ID);
}

const round = (value: number) => Math.round(value * 100) / 100;

export const chatPeriods = [
  "hoje",
  "ontem",
  "7d",
  "30d",
  "mes",
  "mes-anterior",
  "ano",
  "personalizado",
] as const satisfies readonly Preset[];

/**
 * Converte o período pedido pela IA nas mesmas datas dos filtros da tela,
 * para os números do chat baterem com a visão geral.
 */
export function resolveChatPeriod(
  period: Preset,
  startDate?: string,
  endDate?: string,
  today = todayInStore(),
): { start: string; end: string; label: string } | { error: string } {
  if (period !== "personalizado") {
    const range = presetRange(period, today);
    return { start: range.ini, end: range.fim, label: presetLabels[period] };
  }
  if (!startDate || !endDate)
    return {
      error:
        "Para período personalizado, informe startDate e endDate (AAAA-MM-DD).",
    };
  return { start: startDate, end: endDate, label: "Personalizado" };
}

export async function realSalesReport(
  startDate: string,
  endDate: string,
  situacao: Situacao = "todas",
  periodLabel = "Personalizado",
) {
  const today = todayInStore();
  if (
    !isIsoDate(startDate) ||
    !isIsoDate(endDate) ||
    startDate > endDate ||
    endDate > today ||
    daysBetween(startDate, endDate) > 800
  )
    return {
      error: `Período inválido. Use datas AAAA-MM-DD até hoje (${today}), com no máximo 800 dias.`,
    };
  const data = await painelVendas(startDate, endDate, situacao);
  const { resumo, anterior } = data;
  const peaks = hourGrid(data)
    .linhas.flatMap((linha) =>
      linha.celulas.map((celula) => ({
        weekday: weekdayLong[linha.dia - 1],
        hour: `${celula.hora}h-${celula.hora + 1}h`,
        averageOrders: round(celula.pedidos),
      })),
    )
    .sort((a, b) => b.averageOrders - a.averageOrders)
    .slice(0, 5);
  return {
    source: "REAL point-of-sale data imported from the BMWeb ERP",
    period: {
      label: periodLabel,
      start: startDate,
      end: endDate,
      days: data.periodo.dias,
    },
    includesToday: endDate === today,
    statusFilter: situacao,
    availableData: data.base,
    importedAt: data.atualizado_em,
    totals: {
      revenue: round(resumo.faturamento),
      orders: resumo.pedidos,
      averageTicket: round(resumo.ticket_medio),
      itemsPerOrder: resumo.pedidos ? round(resumo.itens / resumo.pedidos) : 0,
      daysWithSales: resumo.dias_com_venda,
    },
    previousPeriod: {
      start: data.periodo.ant_ini,
      end: data.periodo.ant_fim,
      revenue: round(anterior.faturamento),
      orders: anterior.pedidos,
      averageTicket: round(anterior.ticket_medio),
    },
    orderStatus: data.situacoes,
    topProductsByRevenue: data.produtos.slice(0, 15).map((item) => ({
      name: item.produto,
      unit: item.unidade,
      quantity: round(item.qtd),
      revenue: round(item.faturamento),
      timesSold: item.vendas,
      shareOfRevenuePct: resumo.faturamento
        ? round((item.faturamento / resumo.faturamento) * 100)
        : 0,
    })),
    distinctProductsSold: data.produtos_distintos,
    paymentMethods: data.pagamentos.map((row) => ({
      method: row.forma,
      orders: row.pedidos,
      revenue: round(row.faturamento),
      averageTicket: row.pedidos ? round(row.faturamento / row.pedidos) : 0,
    })),
    weekdays: weekdayStats(data).map((day) => ({
      weekday: weekdayLong[day.dia - 1],
      occurrences: day.ocorrencias,
      averageRevenuePerDay: round(day.mediaFaturamento),
      averageOrdersPerDay: round(day.mediaPedidos),
      averageTicket: round(day.ticket),
    })),
    busiestHours: peaks,
    ticketBands: data.faixas_ticket.map((row) => ({
      band: faixaLabels[row.faixa],
      orders: row.pedidos,
      revenue: round(row.faturamento),
    })),
  };
}
