// Vendas reais (BMWeb → Supabase). Tipos e cálculos puros, usados no navegador
// e no servidor. Sem segredos aqui.

export type Situacao = "todas" | "finalizado" | "pendente";

export type Totais = {
  faturamento: number;
  pedidos: number;
  ticket_medio: number;
  itens: number;
};

export type PainelVendas = {
  periodo: {
    ini: string;
    fim: string;
    dias: number;
    ant_ini: string;
    ant_fim: string;
    /** Quando o período inclui hoje: a comparação vai só até este horário ("08:36"). */
    ant_corte?: string | null;
    situacao: Situacao;
  };
  base: {
    primeiro_dia: string | null;
    ultimo_dia: string | null;
    ultimo_pedido: string | null; // "AAAA-MM-DDTHH:MM:SS", horário local da loja
  };
  atualizado_em: string | null; // ISO com fuso
  resumo: Totais & { dias_com_venda: number };
  anterior: Totais;
  situacoes: { situacao: string; pedidos: number; faturamento: number }[];
  serie: { data: string; pedidos: number; faturamento: number }[];
  semana_hora: {
    dia_semana: number; // 1 = segunda … 7 = domingo
    hora: number;
    pedidos: number;
    faturamento: number;
    ocorrencias: number; // quantas vezes esse dia da semana aparece no período
  }[];
  dias_semana: { dia_semana: number; ocorrencias: number }[];
  produtos: {
    codigo: string;
    produto: string;
    unidade: string;
    qtd: number;
    faturamento: number;
    vendas: number;
  }[];
  produtos_distintos: number;
  pagamentos: { forma: string; pedidos: number; faturamento: number }[];
  faixas_ticket: { faixa: number; pedidos: number; faturamento: number }[];
};

export const situacaoLabels: Record<Situacao, string> = {
  todas: "Todos os pedidos",
  finalizado: "Só finalizados",
  pendente: "Só pendentes",
};

export function isSituacao(value: unknown): value is Situacao {
  return value === "todas" || value === "finalizado" || value === "pendente";
}

export const faixaLabels: Record<number, string> = {
  1: "Até R$ 10",
  2: "R$ 10 a 20",
  3: "R$ 20 a 30",
  4: "R$ 30 a 50",
  5: "R$ 50 a 100",
  6: "Acima de R$ 100",
};

export const weekdayShort = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
export const weekdayLong = [
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
  "domingo",
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

/** Data de hoje no fuso da loja (America/Sao_Paulo), em AAAA-MM-DD. */
export function todayInStore(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(now);
}

export function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function daysBetween(start: string, end: string) {
  return (
    Math.round(
      (Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) /
        86400000,
    ) + 1
  );
}

export type FixedPreset =
  | "hoje"
  | "ontem"
  | "7d"
  | "30d"
  | "mes"
  | "mes-anterior"
  | "ano"
  | "personalizado";

/** Ano fechado (ou o ano atual até hoje): "ano-2025". */
export type YearPreset = `ano-${number}`;
export type Preset = FixedPreset | YearPreset;

/** Primeiro ano com dados importados do BMWeb. */
export const FIRST_YEAR = 2025;

export const presetLabels: Record<FixedPreset, string> = {
  hoje: "Hoje",
  ontem: "Ontem",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  mes: "Este mês",
  "mes-anterior": "Mês passado",
  ano: "Este ano",
  personalizado: "Personalizado",
};

export function isPreset(value: unknown): value is Preset {
  if (typeof value !== "string") return false;
  if (value in presetLabels) return true;
  return /^ano-\d{4}$/.test(value) && Number(value.slice(4)) >= FIRST_YEAR;
}

/** Opções do filtro: períodos fixos e cada ano desde FIRST_YEAR (mais recente primeiro). */
export function presetOptions(
  today: string,
): { value: Preset; label: string }[] {
  const year = Number(today.slice(0, 4));
  const years: { value: Preset; label: string }[] = [];
  for (let y = year; y >= FIRST_YEAR; y--)
    years.push({
      value: y === year ? "ano" : `ano-${y}`,
      label: y === year ? `${y} (até hoje)` : String(y),
    });
  const fixed = (
    ["hoje", "ontem", "7d", "30d", "mes", "mes-anterior"] as const
  ).map((value) => ({ value, label: presetLabels[value] }));
  return [
    ...fixed,
    ...years,
    { value: "personalizado", label: presetLabels.personalizado },
  ];
}

export function presetRange(
  preset: Exclude<Preset, "personalizado">,
  today: string,
): { ini: string; fim: string } {
  switch (preset) {
    case "hoje":
      return { ini: today, fim: today };
    case "ontem": {
      const day = shiftDate(today, -1);
      return { ini: day, fim: day };
    }
    case "7d":
      return { ini: shiftDate(today, -6), fim: today };
    case "30d":
      return { ini: shiftDate(today, -29), fim: today };
    case "mes":
      return { ini: `${today.slice(0, 7)}-01`, fim: today };
    case "mes-anterior": {
      const first = `${today.slice(0, 7)}-01`;
      const last = shiftDate(first, -1);
      return { ini: `${last.slice(0, 7)}-01`, fim: last };
    }
    case "ano":
      return { ini: `${today.slice(0, 4)}-01-01`, fim: today };
    default: {
      const year = preset.slice(4);
      const fim = `${year}-12-31`;
      return { ini: `${year}-01-01`, fim: fim < today ? fim : today };
    }
  }
}

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const DIA_PASSADO = [
  "a segunda-feira passada",
  "a terça-feira passada",
  "a quarta-feira passada",
  "a quinta-feira passada",
  "a sexta-feira passada",
  "o sábado passado",
  "o domingo passado",
];

/** "08:36" → "8h36". */
export function horaCurta(hhmm: string) {
  const [h, m] = hhmm.split(":");
  return `${Number(h)}h${m}`;
}

/**
 * Nome do período de comparação escolhido pelo banco (staging.periodo_anterior):
 * mesmo dia da semana passada, mesmos dias do mês passado, mesmo período do ano
 * passado ou os N dias antes. Se o período inclui hoje, a comparação vai só até
 * o mesmo horário de agora (ant_corte).
 */
export function comparisonName(periodo: {
  ini: string;
  fim: string;
  ant_ini: string;
  ant_fim: string;
  ant_corte?: string | null;
}) {
  const corte = periodo.ant_corte
    ? ` até as ${horaCurta(periodo.ant_corte)}`
    : "";
  return comparisonBase(periodo) + corte;
}

function comparisonBase(periodo: {
  ini: string;
  fim: string;
  ant_ini: string;
}) {
  const { ini, fim, ant_ini } = periodo;
  if (ini === fim && ant_ini === shiftDate(ini, -7)) {
    const dow = new Date(`${ini}T12:00:00Z`).getUTCDay(); // 0 = domingo
    return DIA_PASSADO[(dow + 6) % 7];
  }
  if (
    ini !== fim &&
    ini.endsWith("-01-01") &&
    ant_ini === `${Number(ini.slice(0, 4)) - 1}-01-01`
  )
    return `o mesmo período de ${ant_ini.slice(0, 4)}`;
  if (
    ini !== fim &&
    ini.endsWith("-01") &&
    ant_ini.endsWith("-01") &&
    ant_ini.slice(0, 7) === shiftDate(ini, -1).slice(0, 7)
  )
    return `os mesmos dias de ${MESES[Number(ant_ini.slice(5, 7)) - 1]}`;
  const dias = daysBetween(ini, fim);
  return dias === 1 ? "o dia anterior" : `os ${dias} dias anteriores`;
}

/** Variação percentual; null quando não há base de comparação. */
export function variation(current: number, previous: number) {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

export type Granularidade = "dia" | "semana" | "mes";

export type Ponto = {
  key: string;
  start: string;
  end: string;
  faturamento: number;
  pedidos: number;
  ticket: number;
  dias: number;
};

/**
 * Agrupa a série diária em dia/semana/mês conforme o tamanho do período.
 * Dias sem venda entram como zero (até o último dia com dados), para o
 * gráfico não esconder dias fechados.
 */
export function bucketSeries(
  serie: PainelVendas["serie"],
  ini: string,
  fim: string,
  ultimoDia: string | null,
): { granularidade: Granularidade; pontos: Ponto[] } {
  const dias = daysBetween(ini, fim);
  const granularidade: Granularidade =
    dias <= 45 ? "dia" : dias <= 200 ? "semana" : "mes";
  const end = ultimoDia && ultimoDia < fim ? ultimoDia : fim;
  const byDate = new Map(serie.map((row) => [row.data, row]));
  const buckets = new Map<string, Ponto>();
  for (let date = ini; date <= end; date = shiftDate(date, 1)) {
    let key = date;
    if (granularidade === "semana") {
      const weekday = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
      key = shiftDate(date, -weekday);
    } else if (granularidade === "mes") key = date.slice(0, 7);
    const row = byDate.get(date);
    const bucket = buckets.get(key) ?? {
      key,
      start: date,
      end: date,
      faturamento: 0,
      pedidos: 0,
      ticket: 0,
      dias: 0,
    };
    bucket.end = date;
    bucket.dias += 1;
    bucket.faturamento += row?.faturamento ?? 0;
    bucket.pedidos += row?.pedidos ?? 0;
    buckets.set(key, bucket);
  }
  const pontos = [...buckets.values()].map((bucket) => ({
    ...bucket,
    faturamento: Math.round(bucket.faturamento * 100) / 100,
    ticket: bucket.pedidos ? bucket.faturamento / bucket.pedidos : 0,
  }));
  return { granularidade, pontos };
}

/** Médias por dia da semana, divididas pelas ocorrências reais no período. */
export function weekdayStats(data: PainelVendas) {
  return weekdayShort.map((label, index) => {
    const dia = index + 1;
    const rows = data.semana_hora.filter((row) => row.dia_semana === dia);
    const ocorrencias =
      data.dias_semana.find((row) => row.dia_semana === dia)?.ocorrencias ?? 0;
    const faturamento = rows.reduce((sum, row) => sum + row.faturamento, 0);
    const pedidos = rows.reduce((sum, row) => sum + row.pedidos, 0);
    return {
      dia,
      label,
      ocorrencias,
      faturamento,
      pedidos,
      mediaFaturamento: ocorrencias ? faturamento / ocorrencias : 0,
      mediaPedidos: ocorrencias ? pedidos / ocorrencias : 0,
      ticket: pedidos ? faturamento / pedidos : 0,
    };
  });
}

/** Grade dia da semana × hora com médias por ocorrência do dia. */
export function hourGrid(data: PainelVendas) {
  const hours = data.semana_hora.map((row) => row.hora);
  if (!hours.length) return { horas: [] as number[], linhas: [] };
  const min = Math.min(...hours);
  const max = Math.max(...hours);
  const horas = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const linhas = weekdayShort.map((label, index) => {
    const dia = index + 1;
    const ocorrencias =
      data.dias_semana.find((row) => row.dia_semana === dia)?.ocorrencias ?? 0;
    return {
      dia,
      label,
      celulas: horas.map((hora) => {
        const row = data.semana_hora.find(
          (item) => item.dia_semana === dia && item.hora === hora,
        );
        return {
          hora,
          pedidos: ocorrencias && row ? row.pedidos / ocorrencias : 0,
          faturamento: ocorrencias && row ? row.faturamento / ocorrencias : 0,
        };
      }),
    };
  });
  return { horas, linhas };
}

const pct = (value: number) => `${value.toFixed(1).replace(".", ",")}%`;
const brl = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value,
  );

/** Frases curtas e factuais sobre o período (sem previsões). */
export function highlights(data: PainelVendas, comparar: boolean): string[] {
  const out: string[] = [];
  const { resumo, anterior } = data;
  if (!resumo.pedidos) return out;

  const ticketVar = variation(resumo.ticket_medio, anterior.ticket_medio);
  out.push(
    comparar && ticketVar !== null
      ? `Ticket médio de ${brl(resumo.ticket_medio)}, ${pct(Math.abs(ticketVar))} ${ticketVar >= 0 ? "acima" : "abaixo"} de ${comparisonName(data.periodo)} (${brl(anterior.ticket_medio)}).`
      : `Ticket médio de ${brl(resumo.ticket_medio)} em ${resumo.pedidos.toLocaleString("pt-BR")} pedidos.`,
  );

  const grid = hourGrid(data);
  let peak = { dia: 0, hora: 0, pedidos: 0 };
  for (const linha of grid.linhas)
    for (const celula of linha.celulas)
      if (celula.pedidos > peak.pedidos)
        peak = { dia: linha.dia, hora: celula.hora, pedidos: celula.pedidos };
  if (peak.pedidos > 0)
    out.push(
      `Horário de maior movimento: ${weekdayLong[peak.dia - 1]}, das ${peak.hora}h às ${peak.hora + 1}h (média de ${Math.round(peak.pedidos)} pedidos nessa hora).`,
    );

  const top = data.produtos.slice(0, 10);
  if (top.length >= 3 && resumo.faturamento > 0) {
    const share =
      (top.reduce((sum, item) => sum + item.faturamento, 0) /
        resumo.faturamento) *
      100;
    out.push(
      `Os ${top.length} produtos que mais faturam somam ${pct(share)} do faturamento, entre ${data.produtos_distintos.toLocaleString("pt-BR")} produtos vendidos.`,
    );
  }

  const small = data.faixas_ticket
    .filter((row) => row.faixa <= 2)
    .reduce((sum, row) => sum + row.pedidos, 0);
  if (resumo.pedidos >= 20)
    out.push(
      `${pct((small / resumo.pedidos) * 100)} dos pedidos ficam abaixo de R$ 20, uma oportunidade para combos e itens de acompanhamento.`,
    );
  return out;
}

export function formatQuantity(qtd: number, unidade: string) {
  const unit = unidade.toUpperCase();
  if (unit === "KG")
    return `${qtd.toLocaleString("pt-BR", { maximumFractionDigits: qtd >= 100 ? 0 : 1 })} kg`;
  return `${Math.round(qtd).toLocaleString("pt-BR")} ${unit.toLowerCase()}`;
}

export function serieCsv(pontos: Ponto[]) {
  const lines = ["inicio;fim;pedidos;faturamento;ticket_medio"];
  for (const ponto of pontos)
    lines.push(
      [
        ponto.start,
        ponto.end,
        ponto.pedidos,
        ponto.faturamento.toFixed(2).replace(".", ","),
        ponto.ticket.toFixed(2).replace(".", ","),
      ].join(";"),
    );
  return `﻿${lines.join("\n")}\n`;
}

// ---------------------------------------------------------------------------
// Produtos
// ---------------------------------------------------------------------------
export type ProdutoLinha = {
  codigo: string;
  produto: string;
  unidade: string;
  qtd: number;
  faturamento: number;
  vendas: number;
  dias_vendidos: number;
  ultima_venda: string | null;
  qtd_anterior: number;
  faturamento_anterior: number;
};

export type PainelProdutos = {
  periodo: {
    ini: string;
    fim: string;
    dias: number;
    ant_ini: string;
    ant_fim: string;
    /** Quando o período inclui hoje: a comparação vai só até este horário ("08:36"). */
    ant_corte?: string | null;
    situacao: Situacao;
  };
  totais: {
    faturamento: number;
    faturamento_anterior: number;
    pedidos: number;
    pedidos_anterior: number;
  };
  produtos: ProdutoLinha[];
};

export type ProdutoDetalhe = {
  codigo: string;
  produto: string | null;
  unidade: string | null;
  periodo: { ini: string; fim: string; dias: number; situacao: Situacao };
  resumo: {
    faturamento: number;
    qtd: number;
    vendas: number;
    pedidos_com: number;
    total_pedidos: number;
    preco_min: number | null;
    preco_max: number | null;
    primeira_venda: string | null;
    ultima_venda: string | null;
  };
  ticket: { com: number | null; sem: number | null };
  serie: { data: string; qtd: number; faturamento: number; vendas: number }[];
  semana_hora: {
    dia_semana: number;
    hora: number;
    vendas: number;
    qtd: number;
  }[];
  precos: { preco: number; vendas: number; de: string; ate: string }[];
  juntos: {
    codigo: string;
    produto: string;
    pedidos: number;
    confianca: number;
    lift: number | null;
  }[];
};

export type Cesta = {
  a: string;
  b: string;
  pedidos: number;
  suporte: number;
  conf_a_b: number;
  conf_b_a: number;
  lift: number;
};

export type Classe = "A" | "B" | "C";

/** Curva ABC por faturamento: A até 80%, B até 95%, C o resto. */
export function abc(produtos: ProdutoLinha[]) {
  const vendidos = produtos
    .filter((item) => item.faturamento > 0)
    .sort((a, b) => b.faturamento - a.faturamento);
  const total = vendidos.reduce((sum, item) => sum + item.faturamento, 0);
  const classes = new Map<string, Classe>();
  let acumulado = 0;
  for (const item of vendidos) {
    const antes = total ? acumulado / total : 0;
    classes.set(item.codigo, antes < 0.8 ? "A" : antes < 0.95 ? "B" : "C");
    acumulado += item.faturamento;
  }
  const resumo = (["A", "B", "C"] as Classe[]).map((classe) => {
    const itens = vendidos.filter(
      (item) => classes.get(item.codigo) === classe,
    );
    const faturamento = itens.reduce((sum, item) => sum + item.faturamento, 0);
    return {
      classe,
      produtos: itens.length,
      faturamento,
      shareFaturamento: total ? (faturamento / total) * 100 : 0,
      shareProdutos: vendidos.length
        ? (itens.length / vendidos.length) * 100
        : 0,
    };
  });
  return { classes, resumo, vendidos: vendidos.length };
}

export type Movimento = ProdutoLinha & {
  diferenca: number;
  variacao: number | null;
};

/**
 * Produtos que mais cresceram/caíram em reais. Ignora itens pequenos
 * (menos de R$ 150 nos dois períodos) para não destacar ruído.
 */
export function movimentos(produtos: ProdutoLinha[], limite = 8) {
  const relevantes: Movimento[] = produtos
    .filter(
      (item) => Math.max(item.faturamento, item.faturamento_anterior) >= 150,
    )
    .map((item) => ({
      ...item,
      diferenca: item.faturamento - item.faturamento_anterior,
      variacao: variation(item.faturamento, item.faturamento_anterior),
    }));
  const alta = relevantes
    .filter((item) => item.diferenca > 0 && item.faturamento_anterior > 0)
    .sort((a, b) => b.diferenca - a.diferenca)
    .slice(0, limite);
  const queda = relevantes
    .filter((item) => item.diferenca < 0 && item.faturamento > 0)
    .sort((a, b) => a.diferenca - b.diferenca)
    .slice(0, limite);
  const parados = produtos
    .filter(
      (item) => item.faturamento === 0 && item.faturamento_anterior >= 100,
    )
    .sort((a, b) => b.faturamento_anterior - a.faturamento_anterior);
  const novos = produtos
    .filter(
      (item) => item.faturamento_anterior === 0 && item.faturamento >= 100,
    )
    .sort((a, b) => b.faturamento - a.faturamento);
  return { alta, queda, parados, novos };
}

// ---------------------------------------------------------------------------
// Insights da IA
// ---------------------------------------------------------------------------
export type InsightTipo = "oportunidade" | "alerta" | "tendencia" | "destaque";

export type Insight = {
  tipo: InsightTipo;
  impacto: "alto" | "medio" | "baixo";
  titulo: string;
  explicacao: string;
  evidencia: string;
  acao: string;
};

export type InsightsIA = {
  manchete: string;
  resumo: string;
  insights: Insight[];
  perguntas: string[];
};

export type RespostaInsights = {
  conteudo: InsightsIA;
  modelo: string;
  gerado_em: string;
  periodo: { ini: string; fim: string; situacao: Situacao };
  base: { pedidos: number; faturamento: number };
  cestas: Cesta[];
  cestasPeriodo: { ini: string; fim: string };
  podeGerar: boolean;
};
