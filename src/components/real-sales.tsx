"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Clock3,
  CreditCard,
  Download,
  Receipt,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { ApiErrorBanner, SalesToolbar, filterQuery } from "./sales-filters";
import { Chapter } from "./products-view";
import { InsightCard, InsightsLoading, useInsights } from "./insights-view";
import { downloadFile } from "@/lib/download";
import {
  dateBr,
  integer,
  money,
  moneyShort,
  percent,
  share,
  shortDate,
  signedPercent,
  titleCase,
} from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { useSalesFilters } from "@/lib/use-sales-filters";
import {
  bucketSeries,
  faixaLabels,
  formatQuantity,
  hourGrid,
  serieCsv,
  variation,
  weekdayLong,
  weekdayStats,
  type PainelVendas,
  type Ponto,
  comparisonName,
} from "@/lib/vendas";

export type NavTarget = "produtos" | "insights" | "chat";

const capitalize = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);

export function RealSales({
  onMessage,
  onNavigate,
  onAsk,
  canInsights,
}: {
  onMessage: (text: string) => void;
  onNavigate: (view: NavTarget) => void;
  onAsk?: (question: string) => void;
  canInsights: boolean;
}) {
  const filters = useSalesFilters();
  const url = filters.ready ? `/api/vendas?${filterQuery(filters)}` : null;
  const { data, error, loading } = useApi<PainelVendas>(url, filters.nonce);
  const compare = !(
    filters.range.ini === filters.range.fim && filters.incompleteDay
  );
  const series = useMemo(
    () =>
      data
        ? bucketSeries(
            data.serie,
            data.periodo.ini,
            data.periodo.fim,
            data.base.ultimo_dia,
          )
        : null,
    [data],
  );

  function exportCsv() {
    if (!series || !data) return;
    downloadFile(
      serieCsv(series.pontos),
      `superdeli-vendas-${data.periodo.ini}-a-${data.periodo.fim}.csv`,
      "text/csv;charset=utf-8",
    );
    onMessage(
      `Vendas de ${shortDate(data.periodo.ini)} a ${shortDate(data.periodo.fim)} exportadas (por ${series.granularidade}).`,
    );
  }

  return (
    <div className="rs" aria-busy={loading}>
      <SalesToolbar
        filters={filters}
        loading={loading}
        firstDay={data?.base.primeiro_dia}
        label="Filtros das vendas"
      >
        <button
          className="button secondary"
          onClick={exportCsv}
          disabled={!data || loading}
        >
          <Download size={15} />
          Exportar
        </button>
      </SalesToolbar>

      {data && <Freshness data={data} />}
      {error && <ApiErrorBanner error={error} onRetry={filters.refresh} />}
      {!data && loading && !error && (
        <p className="rs-loading" role="status">
          Carregando as vendas da Superdeli…
        </p>
      )}

      {data && series && (
        <div className={`rs-content ${loading ? "rs-stale" : ""}`}>
          {data.resumo.pedidos === 0 ? (
            <>
              <Kpis
                data={data}
                compare={compare}
                incompleteDay={filters.incompleteDay}
              />
              <section className="panel rs-empty">
                <h2>Sem vendas nesse período</h2>
                <p>
                  A base vai de{" "}
                  {data.base.primeiro_dia
                    ? shortDate(data.base.primeiro_dia)
                    : "—"}{" "}
                  a{" "}
                  {data.base.ultimo_dia ? shortDate(data.base.ultimo_dia) : "—"}
                  . Escolha outro período.
                </p>
              </section>
            </>
          ) : (
            <Story
              data={data}
              series={series}
              compare={compare}
              incompleteDay={filters.incompleteDay}
              filters={filters}
              canInsights={canInsights}
              onNavigate={onNavigate}
              onAsk={onAsk}
            />
          )}
        </div>
      )}
    </div>
  );
}

function Story({
  data,
  series,
  compare,
  incompleteDay,
  filters,
  canInsights,
  onNavigate,
  onAsk,
}: {
  data: PainelVendas;
  series: ReturnType<typeof bucketSeries>;
  compare: boolean;
  incompleteDay: boolean;
  filters: ReturnType<typeof useSalesFilters>;
  canInsights: boolean;
  onNavigate: (view: NavTarget) => void;
  onAsk?: (question: string) => void;
}) {
  const { resumo, anterior } = data;
  const fatVar = compare
    ? variation(resumo.faturamento, anterior.faturamento)
    : null;
  const melhorDia = [...data.serie].sort(
    (a, b) => b.faturamento - a.faturamento,
  )[0];
  const semana = weekdayStats(data).filter((d) => d.pedidos);
  const diaForte = [...semana].sort(
    (a, b) => b.mediaFaturamento - a.mediaFaturamento,
  )[0];
  const diaFraco = [...semana].sort(
    (a, b) => a.mediaFaturamento - b.mediaFaturamento,
  )[0];
  let pico = { dia: 0, hora: 0, pedidos: 0 };
  for (const linha of hourGrid(data).linhas)
    for (const c of linha.celulas)
      if (c.pedidos > pico.pedidos)
        pico = { dia: linha.dia, hora: c.hora, pedidos: c.pedidos };
  const abaixo20 = data.faixas_ticket
    .filter((f) => f.faixa <= 2)
    .reduce((sum, f) => sum + f.pedidos, 0);
  const pag = data.pagamentos[0];
  const top10 = data.produtos
    .slice(0, 10)
    .reduce((sum, p) => sum + p.faturamento, 0);

  const c1 = `${money(resumo.faturamento)} em ${integer(resumo.pedidos)} pedidos${
    fatVar !== null
      ? `, ${signedPercent(fatVar)} contra ${comparisonName(data.periodo)}`
      : ""
  }.${melhorDia && data.serie.length > 1 ? ` Melhor dia: ${dateBr(melhorDia.data, { weekday: "long", day: "2-digit", month: "2-digit" })} (${moneyShort(melhorDia.faturamento)}).` : ""}${incompleteDay ? " Hoje ainda está em andamento." : ""}`;
  const c2 =
    diaForte && pico.pedidos
      ? `${capitalize(weekdayLong[diaForte.dia - 1])} é o dia mais forte (média de ${moneyShort(diaForte.mediaFaturamento)})${diaFraco && diaFraco.dia !== diaForte.dia ? ` e ${weekdayLong[diaFraco.dia - 1]} o mais fraco (${moneyShort(diaFraco.mediaFaturamento)})` : ""}. O pico é ${weekdayLong[pico.dia - 1]} às ${pico.hora}h.`
      : "Distribuição das vendas por dia da semana e horário.";
  const c3 = `Ticket médio de ${money(resumo.ticket_medio)}: ${percent(share(abaixo20, resumo.pedidos), 0)} dos pedidos ficam abaixo de R$ 20${pag ? ` e ${pag.forma.toLowerCase()} responde por ${percent(share(pag.faturamento, resumo.faturamento), 0)} do faturamento` : ""}.`;
  const c4 = `Os 10 produtos que mais faturam somam ${percent(share(top10, resumo.faturamento), 0)} do faturamento, entre ${integer(data.produtos_distintos)} produtos vendidos.`;

  return (
    <>
      {canInsights && (
        <AiSummary filters={filters} onNavigate={onNavigate} onAsk={onAsk} />
      )}

      <Chapter n={1} title="Como foi o período" caption={c1} />
      <Kpis data={data} compare={compare} incompleteDay={incompleteDay} />
      <SituacaoNote data={data} />
      <SeriesChart
        pontos={series.pontos}
        granularidade={series.granularidade}
      />

      <Chapter n={2} title="Quando a loja vende" caption={c2} />
      <HourHeatmap data={data} />
      <div className="rs-grid rs-grid-single">
        <WeekdayPanel data={data} />
      </div>

      <Chapter n={3} title="Como o cliente compra" caption={c3} />
      <div className="analytics-grid rs-grid">
        <TicketBands data={data} />
        <PaymentsPanel data={data} />
      </div>

      <Chapter n={4} title="O que mais vende" caption={c4} />
      <TopProductsStrip data={data} onMore={() => onNavigate("produtos")} />
    </>
  );
}

function AiSummary({
  filters,
  onNavigate,
  onAsk,
}: {
  filters: ReturnType<typeof useSalesFilters>;
  onNavigate: (view: NavTarget) => void;
  onAsk?: (question: string) => void;
}) {
  const { data, error, loading } = useInsights(filters);
  if (loading && !data) return <InsightsLoading />;
  if (error && !data)
    return (
      <p className="rs-note">
        <Sparkles size={13} /> Resumo da Cifrai indisponível agora: {error.text}
      </p>
    );
  if (!data) return null;
  const top = [...data.conteudo.insights]
    .sort(
      (a, b) =>
        ["alto", "medio", "baixo"].indexOf(a.impacto) -
        ["alto", "medio", "baixo"].indexOf(b.impacto),
    )
    .slice(0, 3);
  return (
    <>
      <section className="panel rs-ai-hero">
        <span className="rs-ai-label">
          <Sparkles size={16} />
          Resumo da Cifrai
        </span>
        <h2>{data.conteudo.manchete}</h2>
        <p>{data.conteudo.resumo}</p>
      </section>
      <div className="rs-insight-grid rs-insight-top3">
        {top.map((insight) => (
          <InsightCard key={insight.titulo} insight={insight} onAsk={onAsk} />
        ))}
      </div>
      <button
        type="button"
        className="rs-more"
        onClick={() => onNavigate("insights")}
      >
        Ver todos os insights e combos sugeridos
        <ArrowRight size={16} />
      </button>
    </>
  );
}

function TopProductsStrip({
  data,
  onMore,
}: {
  data: PainelVendas;
  onMore: () => void;
}) {
  const top = data.produtos.slice(0, 8);
  const max = Math.max(...top.map((p) => p.faturamento), 1);
  return (
    <section className="panel rs-top-strip">
      <ol>
        {top.map((p, i) => (
          <li key={p.codigo}>
            <span className={`rank-number ${i === 0 ? "first" : ""}`}>
              {i + 1}
            </span>
            <div>
              <div className="rs-top-line">
                <strong>{titleCase(p.produto)}</strong>
                <span>{money(p.faturamento)}</span>
              </div>
              <div className="ranking-track" aria-hidden="true">
                <span
                  className={i === 0 ? "leading" : ""}
                  style={{ width: `${(p.faturamento / max) * 100}%` }}
                />
              </div>
              <small>
                {formatQuantity(p.qtd, p.unidade)} ·{" "}
                {percent(share(p.faturamento, data.resumo.faturamento))} do
                faturamento
              </small>
            </div>
          </li>
        ))}
      </ol>
      <button type="button" className="rs-more" onClick={onMore}>
        Ver todos os produtos, curva ABC e o que está em alta
        <ArrowRight size={16} />
      </button>
    </section>
  );
}

function Freshness({ data }: { data: PainelVendas }) {
  const updated = data.atualizado_em
    ? new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(data.atualizado_em))
    : null;
  const last = data.base.ultimo_pedido;
  return (
    <p className="rs-freshness">
      <span className="rs-live-dot" aria-hidden="true" />
      Dados reais do BMWeb
      {updated && <> · importados em {updated.replace(",", " às")}</>}
      {last && (
        <>
          {" "}
          · último pedido em {shortDate(last.slice(0, 10))} às{" "}
          {last.slice(11, 16)}
        </>
      )}
    </p>
  );
}

function Kpis({
  data,
  compare,
  incompleteDay,
}: {
  data: PainelVendas;
  compare: boolean;
  incompleteDay: boolean;
}) {
  const { resumo, anterior, periodo } = data;
  const itensPorPedido = resumo.pedidos ? resumo.itens / resumo.pedidos : 0;
  const itensAnterior = anterior.pedidos
    ? anterior.itens / anterior.pedidos
    : 0;
  const previousLabel = `${shortDate(periodo.ant_ini)}${periodo.ant_ini === periodo.ant_fim ? "" : ` a ${shortDate(periodo.ant_fim)}`}`;
  const cards: {
    title: string;
    value: string;
    icon: LucideIcon;
    current: number;
    previous: number;
    previousText: string;
    featured?: boolean;
  }[] = [
    {
      title: "Faturamento",
      value: money(resumo.faturamento),
      icon: TrendingUp,
      current: resumo.faturamento,
      previous: anterior.faturamento,
      previousText: money(anterior.faturamento),
    },
    {
      title: "Pedidos",
      value: integer(resumo.pedidos),
      icon: Receipt,
      current: resumo.pedidos,
      previous: anterior.pedidos,
      previousText: integer(anterior.pedidos),
    },
    {
      title: "Ticket médio",
      value: money(resumo.ticket_medio),
      icon: Wallet,
      current: resumo.ticket_medio,
      previous: anterior.ticket_medio,
      previousText: money(anterior.ticket_medio),
      featured: true,
    },
    {
      title: "Itens por pedido",
      value: itensPorPedido.toLocaleString("pt-BR", {
        maximumFractionDigits: 2,
      }),
      icon: ShoppingBag,
      current: itensPorPedido,
      previous: itensAnterior,
      previousText: itensAnterior.toLocaleString("pt-BR", {
        maximumFractionDigits: 2,
      }),
    },
  ];
  return (
    <section
      className="metrics rs-metrics"
      aria-label="Resumo das vendas no período"
    >
      {cards.map((card) => {
        const change = compare ? variation(card.current, card.previous) : null;
        const Icon = card.icon;
        return (
          <article
            className={`metric ${card.featured ? "rs-featured" : ""}`}
            key={card.title}
          >
            <div className="metric-heading">
              <span>{card.title}</span>
              <Icon size={19} />
            </div>
            <strong>{card.value}</strong>
            <span
              className={`metric-footer ${change === null ? "" : change >= 0 ? "positive" : "caution"}`}
            >
              {change !== null &&
                (change >= 0 ? (
                  <ArrowUpRight size={14} />
                ) : (
                  <ArrowDownRight size={14} />
                ))}
              {change !== null
                ? `${percent(Math.abs(change))} vs. ${previousLabel} (${card.previousText})`
                : incompleteDay && !compare
                  ? "Dia em andamento · sem comparação"
                  : "Sem base de comparação"}
            </span>
          </article>
        );
      })}
    </section>
  );
}

function SituacaoNote({ data }: { data: PainelVendas }) {
  if (!data.situacoes.length) return null;
  const total = data.situacoes.reduce((sum, row) => sum + row.faturamento, 0);
  return (
    <p className="rs-situacao">
      {data.situacoes.map((row) => (
        <span key={row.situacao}>
          <b>
            {row.situacao === "FINALIZADO"
              ? "Finalizados"
              : row.situacao === "PENDENTE"
                ? "Pendentes"
                : row.situacao}
          </b>{" "}
          {integer(row.pedidos)} pedidos · {money(row.faturamento)} (
          {percent(share(row.faturamento, total), 0)})
        </span>
      ))}
      <em>
        Pendente = pedido ainda não finalizado no BMWeb. Confirme com a loja se
        deve contar como venda.
      </em>
    </p>
  );
}

type SeriesMetric = "faturamento" | "pedidos" | "ticket";

function SeriesChart({
  pontos,
  granularidade,
}: {
  pontos: Ponto[];
  granularidade: "dia" | "semana" | "mes";
}) {
  const [metric, setMetric] = useState<SeriesMetric>("faturamento");
  const format = metric === "pedidos" ? integer : money;
  const values = pontos.map((ponto) => ponto[metric]);
  const peak = Math.max(...values, 1);
  const magnitude = 10 ** Math.floor(Math.log10(peak));
  const step = magnitude * (peak / magnitude > 5 ? 1 : 0.5);
  const max = Math.ceil(peak / step) * step;
  const label = (ponto: Ponto) =>
    granularidade === "mes"
      ? dateBr(ponto.start, { month: "long", year: "numeric" })
      : granularidade === "semana"
        ? `Semana de ${shortDate(ponto.start)} a ${shortDate(ponto.end)}`
        : dateBr(ponto.start, {
            weekday: "short",
            day: "2-digit",
            month: "short",
          });
  const tick = (ponto: Ponto, index: number) => {
    if (granularidade === "mes")
      return dateBr(ponto.start, { month: "short" }).replace(".", "");
    const every = pontos.length > 30 ? 5 : pontos.length > 14 ? 3 : 1;
    if (index % every) return "";
    return granularidade === "semana"
      ? shortDate(ponto.start)
      : dateBr(ponto.start, { day: "2-digit" });
  };
  const totalPedidos = pontos.reduce((sum, ponto) => sum + ponto.pedidos, 0);
  const totalFat = pontos.reduce((sum, ponto) => sum + ponto.faturamento, 0);
  const summary =
    metric === "faturamento"
      ? money(totalFat)
      : metric === "pedidos"
        ? integer(totalPedidos)
        : money(totalPedidos ? totalFat / totalPedidos : 0);
  const unit = granularidade === "mes" ? "mês" : granularidade;
  const names: Record<SeriesMetric, string> = {
    faturamento: "Faturamento",
    pedidos: "Pedidos",
    ticket: "Ticket médio",
  };
  return (
    <section className="panel chart-panel rs-chart">
      <div className="panel-heading">
        <div>
          <h2>O ritmo das vendas</h2>
          <p className="section-description">
            {names[metric]} por {unit}
            {metric === "ticket" ? " (faturamento ÷ pedidos)" : ""}
          </p>
        </div>
        <div
          className="chart-toggle"
          role="group"
          aria-label="Métrica do gráfico"
        >
          {(Object.keys(names) as SeriesMetric[]).map((key) => (
            <button
              key={key}
              aria-pressed={metric === key}
              className={metric === key ? "selected" : ""}
              onClick={() => setMetric(key)}
            >
              {names[key]}
            </button>
          ))}
        </div>
      </div>
      <div className="chart-summary">
        <strong>{summary}</strong>
        <span>
          {metric === "ticket" ? "no período" : "no período selecionado"}
        </span>
      </div>
      <div
        className="chart"
        role="img"
        aria-label={`${names[metric]} por ${unit}: ${pontos.map((ponto) => `${label(ponto)}: ${format(ponto[metric])}`).join("; ")}`}
      >
        <div className="chart-axis">
          {[max, max * 0.75, max * 0.5, max * 0.25, 0].map((value) => (
            <span key={value}>
              {metric === "pedidos" ? integer(value) : integer(value)}
            </span>
          ))}
        </div>
        <div className="plot">
          <div className="grid-lines">
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
          <div
            className="bars"
            style={{
              gridTemplateColumns: `repeat(${Math.max(1, pontos.length)}, minmax(0, 1fr))`,
              gap: pontos.length > 14 ? "3px" : undefined,
            }}
          >
            {pontos.map((ponto, index) => (
              <div className="bar-column" key={ponto.key}>
                <div
                  className={`bar ${index === pontos.length - 1 ? "current" : ""}`}
                  style={{
                    height: `${Math.max(ponto[metric] ? 1 : 0, (ponto[metric] / max) * 100)}%`,
                  }}
                >
                  <span className="chart-tooltip">
                    {label(ponto)}
                    <strong>{format(ponto[metric])}</strong>
                    {metric !== "pedidos" && (
                      <em>{integer(ponto.pedidos)} pedidos</em>
                    )}
                    {metric !== "ticket" && ponto.pedidos > 0 && (
                      <em>ticket {money(ponto.ticket)}</em>
                    )}
                  </span>
                </div>
                <span className="bar-label">{tick(ponto, index)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="chart-bottom">
        <span>
          <i className="legend-marker" />
          {names[metric]}
        </span>
        <span>Dias sem venda aparecem zerados</span>
      </div>
    </section>
  );
}

const heatSteps = ["#f7ece3", "#f0cfb2", "#e3a173", "#cc6c33", "#9c3c0a"];

function HourHeatmap({ data }: { data: PainelVendas }) {
  const [metric, setMetric] = useState<"pedidos" | "faturamento">("pedidos");
  const grid = hourGrid(data);
  const values = grid.linhas
    .flatMap((linha) => linha.celulas.map((celula) => celula[metric]))
    .filter((value) => value > 0)
    .sort((a, b) => a - b);
  if (!values.length) return null;
  const cut = (q: number) =>
    values[Math.min(values.length - 1, Math.floor(q * values.length))];
  const thresholds = [cut(0.2), cut(0.4), cut(0.6), cut(0.8)];
  const level = (value: number) => thresholds.filter((t) => value >= t).length;
  const format = (value: number) =>
    metric === "pedidos"
      ? value.toLocaleString("pt-BR", {
          maximumFractionDigits: value < 10 ? 1 : 0,
        })
      : moneyShort(value);
  const peaks = grid.linhas
    .flatMap((linha) =>
      linha.celulas.map((celula) => ({ dia: linha.dia, ...celula })),
    )
    .sort((a, b) => b[metric] - a[metric])
    .slice(0, 3);
  return (
    <section className="panel rs-heat" aria-labelledby="rs-heat-title">
      <div className="panel-heading">
        <div>
          <div className="inline-title">
            <Clock3 size={19} />
            <h2 id="rs-heat-title">Movimento por dia e horário</h2>
          </div>
          <p className="section-description">
            Média de {metric === "pedidos" ? "pedidos" : "faturamento"} em cada
            hora, por dia da semana. Ajuda a escalar equipe e planejar fornadas.
          </p>
        </div>
        <div
          className="chart-toggle"
          role="group"
          aria-label="Métrica do mapa de calor"
        >
          <button
            aria-pressed={metric === "pedidos"}
            className={metric === "pedidos" ? "selected" : ""}
            onClick={() => setMetric("pedidos")}
          >
            Pedidos
          </button>
          <button
            aria-pressed={metric === "faturamento"}
            className={metric === "faturamento" ? "selected" : ""}
            onClick={() => setMetric("faturamento")}
          >
            Faturamento
          </button>
        </div>
      </div>
      <div className="rs-heat-scroll">
        <table
          className="rs-heat-table"
          aria-label={`Horários mais fortes: ${peaks.map((p) => `${weekdayLong[p.dia - 1]} às ${p.hora}h, média de ${format(p[metric])}`).join("; ")}`}
        >
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">Dia</span>
              </th>
              {grid.horas.map((hora) => (
                <th scope="col" key={hora}>
                  {hora}h
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.linhas.map((linha) => (
              <tr key={linha.dia}>
                <th scope="row">{linha.label}</th>
                {linha.celulas.map((celula) => {
                  const value = celula[metric];
                  const lvl = value > 0 ? level(value) : -1;
                  return (
                    <td
                      key={celula.hora}
                      className={lvl >= 3 ? "dark" : ""}
                      style={{
                        background: lvl >= 0 ? heatSteps[lvl] : undefined,
                      }}
                      title={`${weekdayLong[linha.dia - 1]}, ${celula.hora}h às ${celula.hora + 1}h: média de ${format(value)}${metric === "pedidos" ? " pedidos" : ""}`}
                    >
                      {value > 0 ? format(value) : ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="heatmap-legend rs-heat-legend" aria-hidden="true">
        <span>Menos</span>
        {heatSteps.map((color) => (
          <i key={color} style={{ background: color }} />
        ))}
        <span>Mais</span>
      </div>
    </section>
  );
}

function WeekdayPanel({ data }: { data: PainelVendas }) {
  const stats = weekdayStats(data);
  const maximum = Math.max(...stats.map((day) => day.mediaFaturamento), 1);
  const valid = stats.filter((day) => day.ocorrencias && day.pedidos);
  const best = [...valid].sort(
    (a, b) => b.mediaFaturamento - a.mediaFaturamento,
  )[0];
  const bestTicket = [...valid].sort((a, b) => b.ticket - a.ticket)[0];
  return (
    <section className="panel analytics-panel">
      <div className="panel-heading">
        <div className="inline-title">
          <BarChart3 size={19} />
          <h2>Cada dia tem seu ritmo</h2>
        </div>
        <span className="tag">Média por dia</span>
      </div>
      <p className="section-description">
        Faturamento médio por dia da semana e o ticket médio de cada dia.
      </p>
      {best && (
        <div className="weekday-highlight">
          <strong>{best.label}</strong>
          <div>
            <span>maior faturamento médio</span>
            <b>{money(best.mediaFaturamento)}</b>
          </div>
          <ArrowUpRight size={24} />
        </div>
      )}
      <div
        className="weekday-chart"
        role="img"
        aria-label={`Faturamento médio por dia da semana: ${stats.map((day) => `${day.label}: ${money(day.mediaFaturamento)}, ticket ${money(day.ticket)}`).join("; ")}`}
      >
        {stats.map((day) => (
          <div className="weekday-column" key={day.label}>
            <span className="weekday-amount">
              {moneyShort(day.mediaFaturamento).replace("R$ ", "")}
            </span>
            <div className="weekday-track">
              <span
                className={best && day.dia === best.dia ? "best" : ""}
                style={{ height: `${(day.mediaFaturamento / maximum) * 100}%` }}
              />
            </div>
            <strong>{day.label}</strong>
            <span className="weekday-count">
              {day.pedidos ? money(day.ticket) : "—"}
            </span>
          </div>
        ))}
      </div>
      <div className="analytics-footer">
        <span>
          Abaixo de cada dia: ticket médio.
          {bestTicket &&
            ` Maior ticket: ${weekdayLong[bestTicket.dia - 1]} (${money(bestTicket.ticket)}).`}
        </span>
      </div>
    </section>
  );
}

function RankList({
  rows,
}: {
  rows: {
    key: string;
    label: string;
    value: string;
    detail?: string;
    width: number;
  }[];
}) {
  return (
    <ol className="ranking-list rs-ranking">
      {rows.map((row, index) => (
        <li key={row.key}>
          <span className={`rank-number ${index === 0 ? "first" : ""}`}>
            {index + 1}
          </span>
          <div className="ranking-content">
            <div className="ranking-label">
              <span>
                {row.label}
                {row.detail && (
                  <small className="rs-rank-detail">{row.detail}</small>
                )}
              </span>
              <strong>{row.value}</strong>
            </div>
            <div className="ranking-track" aria-hidden="true">
              <span
                className={index === 0 ? "leading" : ""}
                style={{ width: `${Math.max(1, row.width)}%` }}
              />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function TicketBands({ data }: { data: PainelVendas }) {
  const total = data.resumo.pedidos;
  const maximum = Math.max(...data.faixas_ticket.map((row) => row.pedidos), 1);
  const rows = [1, 2, 3, 4, 5, 6].map((faixa) => {
    const row = data.faixas_ticket.find((item) => item.faixa === faixa);
    return {
      faixa,
      pedidos: row?.pedidos ?? 0,
      faturamento: row?.faturamento ?? 0,
    };
  });
  return (
    <section className="panel analytics-panel">
      <div className="panel-heading">
        <div className="inline-title">
          <Wallet size={19} />
          <h2>Quanto cada cliente gasta</h2>
        </div>
        <span className="analytics-caption">
          Ticket médio {money(data.resumo.ticket_medio)}
        </span>
      </div>
      <p className="section-description">
        Pedidos por faixa de valor e quanto cada faixa traz de faturamento.
      </p>
      <ul className="rs-bands">
        {rows.map((row) => (
          <li key={row.faixa}>
            <span className="rs-band-label">{faixaLabels[row.faixa]}</span>
            <div className="rs-band-track" aria-hidden="true">
              <span style={{ width: `${(row.pedidos / maximum) * 100}%` }} />
            </div>
            <span className="rs-band-value">
              <b>{percent(share(row.pedidos, total), 0)}</b> dos pedidos
              <small>
                {percent(share(row.faturamento, data.resumo.faturamento), 0)} do
                faturamento
              </small>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PaymentsPanel({ data }: { data: PainelVendas }) {
  const total = data.resumo.faturamento;
  const maximum = Math.max(...data.pagamentos.map((row) => row.faturamento), 1);
  return (
    <section className="panel analytics-panel">
      <div className="panel-heading">
        <div className="inline-title">
          <CreditCard size={19} />
          <h2>Como os clientes pagam</h2>
        </div>
        <span className="analytics-caption">
          {data.pagamentos.length} formas
        </span>
      </div>
      <p className="section-description">
        Participação no faturamento e ticket médio por forma de pagamento.
      </p>
      <RankList
        rows={data.pagamentos.slice(0, 6).map((row) => ({
          key: row.forma,
          label: row.forma.charAt(0) + row.forma.slice(1).toLowerCase(),
          detail: `${integer(row.pedidos)} pedidos · ticket ${money(row.pedidos ? row.faturamento / row.pedidos : 0)}`,
          value: `${percent(share(row.faturamento, total))} · ${moneyShort(row.faturamento)}`,
          width: (row.faturamento / maximum) * 100,
        }))}
      />
    </section>
  );
}
