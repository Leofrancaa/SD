// Insights da Cifrai: pacote de dados reais → IA (Groq) → JSON validado → cache
// no banco. SÓ roda no servidor.
import { createGroq } from "@ai-sdk/groq";
import { generateText, Output } from "ai";
import { z } from "zod";
import {
  abc,
  daysBetween,
  hourGrid,
  movimentos,
  shiftDate,
  todayInStore,
  variation,
  weekdayLong,
  weekdayStats,
  type Cesta,
  type InsightsIA,
  type Situacao,
  comparisonName,
} from "@/lib/vendas";
import {
  cestasCompras,
  painelProdutos,
  painelVendas,
} from "@/lib/vendas-server";
import { supabaseRpc } from "@/lib/supabase-server";

const round = (value: number, digits = 2) =>
  Math.round(value * 10 ** digits) / 10 ** digits;
const pct = (value: number | null) => (value === null ? null : round(value, 1));

export const insightsSchema = z.object({
  manchete: z.string().min(10).max(180),
  resumo: z.string().min(40).max(700),
  insights: z
    .array(
      z.object({
        tipo: z.enum(["oportunidade", "alerta", "tendencia", "destaque"]),
        impacto: z.enum(["alto", "medio", "baixo"]),
        titulo: z.string().min(5).max(90),
        explicacao: z.string().min(20).max(420),
        evidencia: z.string().min(5).max(260),
        acao: z.string().min(10).max(260),
      }),
    )
    .min(4)
    .max(7),
  perguntas: z.array(z.string().min(8).max(120)).min(2).max(4),
});

/** Período usado para os pares de compra (a função limita a 120 dias). */
export function cestasRange(ini: string, fim: string) {
  return daysBetween(ini, fim) > 120
    ? { ini: shiftDate(fim, -89), fim }
    : { ini, fim };
}

export async function dataPack(ini: string, fim: string, situacao: Situacao) {
  const cr = cestasRange(ini, fim);
  const [vendas, produtos, cestas] = await Promise.all([
    painelVendas(ini, fim, situacao),
    painelProdutos(ini, fim, situacao),
    cestasCompras(cr.ini, cr.fim, situacao).catch(() => [] as Cesta[]),
  ]);
  const { resumo: r, anterior: a } = vendas;
  const curva = abc(produtos.produtos);
  const mov = movimentos(produtos.produtos, 6);
  const grid = hourGrid(vendas);
  const horas = grid.linhas
    .flatMap((linha) =>
      linha.celulas.map((celula) => ({
        diaSemana: weekdayLong[linha.dia - 1],
        hora: `${celula.hora}h`,
        mediaPedidos: round(celula.pedidos, 1),
      })),
    )
    .filter((item) => item.mediaPedidos > 0)
    .sort((x, y) => y.mediaPedidos - x.mediaPedidos);
  const dias = [...vendas.serie].sort((x, y) => y.faturamento - x.faturamento);
  const top = (items: typeof mov.alta) =>
    items.map((item) => ({
      produto: item.produto,
      faturamento: round(item.faturamento),
      faturamentoAnterior: round(item.faturamento_anterior),
      diferenca: round(item.diferenca),
      variacaoPct: pct(item.variacao),
    }));
  const pack = {
    hoje: todayInStore(),
    periodo: {
      inicio: ini,
      fim,
      dias: vendas.periodo.dias,
      incluiHojeParcial: fim === todayInStore(),
      periodoAnterior: {
        inicio: vendas.periodo.ant_ini,
        fim: vendas.periodo.ant_fim,
        ultimoDiaAteHorario: vendas.periodo.ant_corte ?? null,
        descricao: comparisonName(vendas.periodo),
      },
      filtroSituacao: situacao,
    },
    totais: {
      faturamento: round(r.faturamento),
      pedidos: r.pedidos,
      ticketMedio: round(r.ticket_medio),
      itensPorPedido: r.pedidos ? round(r.itens / r.pedidos) : 0,
      diasComVenda: r.dias_com_venda,
      faturamentoMedioPorDia: r.dias_com_venda
        ? round(r.faturamento / r.dias_com_venda)
        : 0,
    },
    periodoAnterior: {
      faturamento: round(a.faturamento),
      pedidos: a.pedidos,
      ticketMedio: round(a.ticket_medio),
      itensPorPedido: a.pedidos ? round(a.itens / a.pedidos) : 0,
    },
    variacoesPct: {
      faturamento: pct(variation(r.faturamento, a.faturamento)),
      pedidos: pct(variation(r.pedidos, a.pedidos)),
      ticketMedio: pct(variation(r.ticket_medio, a.ticket_medio)),
    },
    situacaoDosPedidos: vendas.situacoes.map((row) => ({
      situacao: row.situacao,
      pedidos: row.pedidos,
      faturamento: round(row.faturamento),
    })),
    melhoresDias: dias.slice(0, 3).map((d) => ({
      data: d.data,
      faturamento: round(d.faturamento),
      pedidos: d.pedidos,
    })),
    pioresDias: dias.slice(-3).map((d) => ({
      data: d.data,
      faturamento: round(d.faturamento),
      pedidos: d.pedidos,
    })),
    diasDaSemana: weekdayStats(vendas).map((d) => ({
      dia: weekdayLong[d.dia - 1],
      faturamentoMedio: round(d.mediaFaturamento),
      pedidosMedios: round(d.mediaPedidos, 1),
      ticketMedio: round(d.ticket),
    })),
    horariosDePico: horas.slice(0, 6),
    horariosMaisFracos: horas.slice(-4),
    faixasDeTicket: vendas.faixas_ticket.map((row) => ({
      faixa: [
        "",
        "até R$10",
        "R$10-20",
        "R$20-30",
        "R$30-50",
        "R$50-100",
        "acima de R$100",
      ][row.faixa],
      pedidos: row.pedidos,
      faturamento: round(row.faturamento),
    })),
    formasDePagamento: vendas.pagamentos.map((row) => ({
      forma: row.forma,
      pedidos: row.pedidos,
      faturamento: round(row.faturamento),
      ticketMedio: row.pedidos ? round(row.faturamento / row.pedidos) : 0,
    })),
    produtos: {
      vendidos: curva.vendidos,
      curvaABC: curva.resumo.map((c) => ({
        classe: c.classe,
        produtos: c.produtos,
        pctFaturamento: round(c.shareFaturamento, 1),
      })),
      top10PorFaturamento: produtos.produtos.slice(0, 10).map((item) => ({
        produto: item.produto,
        unidade: item.unidade,
        quantidade: round(item.qtd, 1),
        faturamento: round(item.faturamento),
        pctDoFaturamento: r.faturamento
          ? round((item.faturamento / r.faturamento) * 100, 1)
          : 0,
        variacaoPct: pct(
          variation(item.faturamento, item.faturamento_anterior),
        ),
      })),
      emAlta: top(mov.alta),
      emQueda: top(mov.queda),
      pararamDeVender: mov.parados.slice(0, 6).map((item) => ({
        produto: item.produto,
        faturamentoAnterior: round(item.faturamento_anterior),
      })),
      novidades: mov.novos.slice(0, 6).map((item) => ({
        produto: item.produto,
        faturamento: round(item.faturamento),
      })),
    },
    paresCompradosJuntos: {
      periodo: cr,
      pares: cestas.slice(0, 10).map((c) => ({
        a: c.a,
        b: c.b,
        pedidosJuntos: c.pedidos,
        pctDeQuemLevaA_TambemLevaB: round(c.conf_a_b * 100, 1),
        pctDeQuemLevaB_TambemLevaA: round(c.conf_b_a * 100, 1),
        lift: c.lift,
      })),
    },
    limitacoes:
      "Sem custos, margem, estoque, produção ou dados de clientes. PENDENTE = pedido não finalizado no BMWeb.",
  };
  return { pack, vendas, cestas, cestasPeriodo: cr };
}

const instructions = `Você é a Cifrai, analista de vendas da Superdeli (padaria e delicatessen em Conceição do Jacuípe, BA). Recebe um pacote JSON com dados REAIS do caixa (BMWeb) e escreve, em português do Brasil simples e direto para o dono, uma análise que conta a história do período e aponta o que fazer.
Regras:
- Use SOMENTE números presentes no pacote. Nunca invente, estime custos, margem, lucro, estoque ou dados de clientes (não existem). Pode fazer contas simples com os números do pacote (diferenças, porcentagens) e deve mostrar o resultado.
- Formato de números brasileiro: R$ 1.234,56; 12,5%. Datas como 24/10.
- "manchete": uma frase forte e verdadeira sobre o período (ex.: queda/alta de faturamento, ticket, destaque).
- "resumo": 2 a 4 frases contando a história: como foi o período em relação ao anterior, quando a loja vende, o que puxou o resultado.
- "insights": 4 a 7 itens, do mais importante para o menos importante, cobrindo assuntos diferentes (ex.: ticket médio e combos com base nos pares comprados juntos, horários/dias fortes e fracos, produtos em alta/queda/parados, formas de pagamento, pedidos pendentes). Cada item: titulo curto; explicacao do porquê importa; evidencia com os números exatos do pacote; acao concreta, pequena e testável (ex.: combo, exposição, horário de fornada, promoção em horário fraco); tipo (oportunidade, alerta, tendencia, destaque) e impacto (alto, medio, baixo).
- Se incluiHojeParcial for true, hoje ainda está em andamento. O período anterior já foi cortado no mesmo horário (ultimoDiaAteHorario), então a comparação é justa: diga isso com a descricao do período anterior (ex.: "contra o domingo passado até as 8h36"). Nunca compare um dia parcial com um dia inteiro.
- Se houver muitos pedidos PENDENTE, gere um alerta pedindo para o dono confirmar se contam como venda.
- "perguntas": 2 a 4 perguntas curtas que o dono poderia fazer ao chat para aprofundar.
- Tom: consultor de confiança, sem jargão, sem exageros, sem prometer resultados.`;

export async function gerarInsights(
  pack: unknown,
  { signal }: { signal?: AbortSignal } = {},
): Promise<{ conteudo: InsightsIA; modelo: string }> {
  const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
  const primary = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";
  const attempt = async (modelId: string) => {
    const result = await generateText({
      model: groq(modelId),
      instructions,
      prompt: `PACOTE DE DADOS (JSON):\n${JSON.stringify(pack)}`,
      output: Output.object({ schema: insightsSchema, name: "insights" }),
      temperature: 0.3,
      maxOutputTokens: 2600,
      maxRetries: 0,
      abortSignal: signal ?? AbortSignal.timeout(50_000),
      providerOptions: { groq: { reasoningEffort: "low" } },
    });
    return { conteudo: insightsSchema.parse(result.output), modelo: modelId };
  };
  try {
    return await attempt(primary);
  } catch (error) {
    if (primary === "openai/gpt-oss-20b") throw error;
    console.error(
      "insights: tentativa com modelo menor",
      (error as Error)?.name,
    );
    return attempt("openai/gpt-oss-20b");
  }
}

type Salvo = { conteudo: InsightsIA; modelo: string; gerado_em: string } | null;

export function insightsUltimo(ini: string, fim: string, situacao: Situacao) {
  return supabaseRpc<Salvo>("insights_ultimo", {
    p_empresa: process.env.SUPABASE_EMPRESA_ID,
    p_ini: ini,
    p_fim: fim,
    p_situacao: situacao,
  });
}

export function insightsSalvar(
  ini: string,
  fim: string,
  situacao: Situacao,
  modelo: string,
  conteudo: InsightsIA,
) {
  return supabaseRpc<void>("insights_salvar", {
    p_empresa: process.env.SUPABASE_EMPRESA_ID,
    p_ini: ini,
    p_fim: fim,
    p_situacao: situacao,
    p_modelo: modelo,
    p_conteudo: conteudo,
  });
}

/** Insight salvo ainda vale? Períodos fechados valem sempre; com hoje, 3 h. */
export function aindaValido(salvo: Salvo, fim: string, now = Date.now()) {
  if (!salvo) return false;
  if (fim < todayInStore()) return true;
  // com o dia em andamento, a análise envelhece rápido: refaz a cada hora
  return now - Date.parse(salvo.gerado_em) < 3600_000;
}
