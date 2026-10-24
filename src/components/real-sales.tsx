"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Clock3,
  CreditCard,
  Download,
  Lightbulb,
  Receipt,
  RefreshCw,
  Search,
  ShoppingBag,
  Trophy,
  TrendingUp,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { Select } from "./ui/select";
import { downloadFile } from "@/lib/download";
import {
  bucketSeries,
  daysBetween,
  faixaLabels,
  formatQuantity,
  highlights,
  hourGrid,
  isIsoDate,
  isPreset,
  isSituacao,
  presetLabels,
  presetRange,
  serieCsv,
  situacaoLabels,
  todayInStore,
  variation,
  weekdayLong,
  weekdayStats,
  type PainelVendas,
  type Ponto,
  type Preset,
  type Situacao,
} from "@/lib/vendas";

const REFRESH_MS = 5 * 60_000;

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value,
  );
const moneyShort = (value: number) =>
  value >= 1000
    ? `R$ ${(value / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`
    : money(value);
const integer = (value: number) => Math.round(value).toLocaleString("pt-BR");
const percent = (value: number, digits = 1) =>
  `${value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
const share = (part: number, total: number) =>
  total ? (part / total) * 100 : 0;
const dateBr = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("pt-BR", { ...options, timeZone: "UTC" }).format(
    new Date(`${date}T12:00:00Z`),
  );
const shortDate = (date: string) =>
  dateBr(date, { day: "2-digit", month: "2-digit" });

type Range = { ini: string; fim: string };

function readUrl(): {
  preset: Preset;
  custom: Range | null;
  situacao: Situacao;
} {
  const params = new URLSearchParams(window.location.search);
  const vp = params.get("vp");
  const vi = params.get("vi");
  const vf = params.get("vf");
  const vs = params.get("vs");
  const custom =
    isIsoDate(vi) && isIsoDate(vf) && vi <= vf ? { ini: vi, fim: vf } : null;
  return {
    preset: isPreset(vp) && (vp !== "personalizado" || custom) ? vp : "30d",
    custom,
    situacao: isSituacao(vs) ? vs : "todas",
  };
}

function writeUrl(preset: Preset, custom: Range | null, situacao: Situacao) {
  const params = new URLSearchParams(window.location.search);
  params.set("vp", preset);
  if (preset === "personalizado" && custom) {
    params.set("vi", custom.ini);
    params.set("vf", custom.fim);
  } else {
    params.delete("vi");
    params.delete("vf");
  }
  if (situacao === "todas") params.delete("vs");
  else params.set("vs", situacao);
  window.history.replaceState(window.history.state, "", `?${params}`);
}

export function RealSales({
  onMessage,
}: {
  onMessage: (text: string) => void;
}) {
  const router = useRouter();
  const [today, setToday] = useState(() => todayInStore());
  const [preset, setPreset] = useState<Preset>("30d");
  const [custom, setCustom] = useState<Range | null>(null);
  const [situacao, setSituacao] = useState<Situacao>("todas");
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<PainelVendas | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<{ text: string; config?: boolean } | null>(
    null,
  );
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const restore = () => {
      const state = readUrl();
      setPreset(state.preset);
      setCustom(state.custom);
      setSituacao(state.situacao);
      setReady(true);
    };
    restore();
  }, []);

  const range: Range = useMemo(() => {
    if (preset === "personalizado" && custom) return custom;
    return presetRange(preset === "personalizado" ? "30d" : preset, today);
  }, [preset, custom, today]);
  const requestKey = `${range.ini}|${range.fim}|${situacao}|${nonce}`;
  const loading = !ready || loadedKey !== requestKey;

  useEffect(() => {
    if (!ready) return;
    writeUrl(preset, custom, situacao);
  }, [ready, preset, custom, situacao]);

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ ...range, situacao });
    fetch(`/api/vendas?${params}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (response.status === 401) {
          router.push("/login");
          return;
        }
        if (!response.ok) {
          setError({
            text: body.error ?? "Não foi possível carregar as vendas.",
            config: body.code === "not_configured",
          });
          return;
        }
        setError(null);
        setData(body as PainelVendas);
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        console.error(reason);
        setError({ text: "Sem conexão com o servidor. Tente de novo." });
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedKey(requestKey);
      });
    return () => controller.abort();
  }, [ready, range, situacao, requestKey, router]);

  // Atualiza sozinho a cada 5 min com a aba visível (os dados chegam a cada ~30 min).
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setToday(todayInStore());
      setNonce((value) => value + 1);
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  const incompleteDay = range.fim === today;
  const compare = !(range.ini === range.fim && incompleteDay);
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

  const firstDay = data?.base.primeiro_dia ?? undefined;

  return (
    <div className="rs" aria-busy={loading}>
      <div className="rs-toolbar" role="group" aria-label="Filtros das vendas">
        <div className="period-field">
          <span aria-hidden="true">Período</span>
          <Select
            ariaLabel="Período"
            size="compact"
            value={preset}
            options={(Object.keys(presetLabels) as Preset[]).map((key) => ({
              value: key,
              label: presetLabels[key],
            }))}
            onValueChange={(value) => {
              const next = value as Preset;
              if (next === "personalizado" && !custom) setCustom(range);
              setPreset(next);
            }}
          />
        </div>
        {preset === "personalizado" && custom && (
          <div className="rs-dates">
            <label>
              <span>De</span>
              <input
                type="date"
                value={custom.ini}
                min={firstDay}
                max={custom.fim}
                onChange={(event) => {
                  const ini = event.target.value;
                  if (
                    isIsoDate(ini) &&
                    ini <= custom.fim &&
                    daysBetween(ini, custom.fim) <= 800
                  )
                    setCustom({ ...custom, ini });
                }}
              />
            </label>
            <label>
              <span>Até</span>
              <input
                type="date"
                value={custom.fim}
                min={custom.ini}
                max={today}
                onChange={(event) => {
                  const fim = event.target.value;
                  if (isIsoDate(fim) && fim >= custom.ini && fim <= today)
                    setCustom({ ...custom, fim });
                }}
              />
            </label>
          </div>
        )}
        <div className="period-field">
          <span aria-hidden="true">Pedidos</span>
          <Select
            ariaLabel="Situação dos pedidos"
            size="compact"
            value={situacao}
            options={(Object.keys(situacaoLabels) as Situacao[]).map((key) => ({
              value: key,
              label: situacaoLabels[key],
            }))}
            onValueChange={(value) => setSituacao(value as Situacao)}
          />
        </div>
        <span className="date-range">
          {range.ini === range.fim
            ? dateBr(range.ini, {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })
            : `${dateBr(range.ini, { day: "2-digit", month: "short" })} — ${dateBr(range.fim, { day: "2-digit", month: "short", year: "numeric" })}`}
        </span>
        <div className="rs-toolbar-actions">
          <button
            className="button secondary"
            onClick={() => {
              setToday(todayInStore());
              setNonce((value) => value + 1);
            }}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? "rs-spin" : ""} />
            Atualizar
          </button>
          <button
            className="button secondary"
            onClick={exportCsv}
            disabled={!data || loading}
          >
            <Download size={15} />
            Exportar
          </button>
        </div>
      </div>

      {data && <Freshness data={data} />}

      {error && (
        <div className="error-banner rs-error" role="alert">
          <strong>{error.text}</strong>
          {error.config ? (
            <span>
              Falta definir SUPABASE_URL, SUPABASE_SECRET_KEY e
              SUPABASE_EMPRESA_ID nas variáveis do servidor.
            </span>
          ) : (
            <button
              className="text-button"
              onClick={() => setNonce((v) => v + 1)}
            >
              Tentar de novo
            </button>
          )}
        </div>
      )}

      {!data && loading && !error && (
        <p className="rs-loading" role="status">
          Carregando as vendas da Superdeli…
        </p>
      )}

      {data && series && (
        <div className={`rs-content ${loading ? "rs-stale" : ""}`}>
          <Kpis data={data} compare={compare} incompleteDay={incompleteDay} />
          <SituacaoNote data={data} />
          {data.resumo.pedidos === 0 ? (
            <section className="panel rs-empty">
              <h2>Sem vendas nesse período</h2>
              <p>
                A base vai de{" "}
                {data.base.primeiro_dia
                  ? shortDate(data.base.primeiro_dia)
                  : "—"}{" "}
                a {data.base.ultimo_dia ? shortDate(data.base.ultimo_dia) : "—"}
                . Escolha outro período.
              </p>
            </section>
          ) : (
            <>
              <Highlights items={highlights(data, compare)} />
              <SeriesChart
                pontos={series.pontos}
                granularidade={series.granularidade}
              />
              <HourHeatmap data={data} />
              <div className="analytics-grid rs-grid">
                <WeekdayPanel data={data} />
                <TicketBands data={data} />
                <PaymentsPanel data={data} />
                <ProductsTop data={data} />
              </div>
              <ProductsTable data={data} />
            </>
          )}
        </div>
      )}
    </div>
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

function Highlights({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <section
      className="panel rs-highlights"
      aria-labelledby="rs-highlights-title"
    >
      <div className="inline-title">
        <Lightbulb size={19} />
        <h2 id="rs-highlights-title">O que os números mostram</h2>
      </div>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
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

function ProductsTop({ data }: { data: PainelVendas }) {
  const [metric, setMetric] = useState<"faturamento" | "vendas">("faturamento");
  const sorted = [...data.produtos]
    .sort((a, b) => b[metric] - a[metric])
    .slice(0, 6);
  const maximum = Math.max(...sorted.map((row) => row[metric]), 1);
  return (
    <section className="panel analytics-panel">
      <div className="panel-heading">
        <div className="inline-title">
          <Trophy size={19} />
          <h2>Os favoritos do balcão</h2>
        </div>
        <span className="analytics-caption">Top 6</span>
      </div>
      <div
        className="chart-toggle ranking-toggle"
        role="group"
        aria-label="Ordenar favoritos"
      >
        <button
          aria-pressed={metric === "faturamento"}
          className={metric === "faturamento" ? "selected" : ""}
          onClick={() => setMetric("faturamento")}
        >
          Faturamento
        </button>
        <button
          aria-pressed={metric === "vendas"}
          className={metric === "vendas" ? "selected" : ""}
          onClick={() => setMetric("vendas")}
        >
          Mais vendidos
        </button>
      </div>
      <RankList
        rows={sorted.map((row) => ({
          key: row.codigo,
          label: titleCase(row.produto),
          detail: `${formatQuantity(row.qtd, row.unidade)} · ${percent(share(row.faturamento, data.resumo.faturamento))} do faturamento`,
          value:
            metric === "faturamento"
              ? moneyShort(row.faturamento)
              : `${integer(row.vendas)} vendas`,
          width: (row[metric] / maximum) * 100,
        }))}
      />
    </section>
  );
}

function titleCase(text: string) {
  return text
    .toLocaleLowerCase("pt-BR")
    .replace(
      /(^|[\s/(-])(\p{L})/gu,
      (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase("pt-BR"),
    );
}

type SortKey = "faturamento" | "qtd" | "vendas" | "preco";

function ProductsTable({ data }: { data: PainelVendas }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("faturamento");
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const normalize = (text: string) =>
    text.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[̀-ͯ]/g, "");
  const rows = data.produtos
    .map((row) => ({ ...row, preco: row.qtd ? row.faturamento / row.qtd : 0 }))
    .filter(
      (row) =>
        !query ||
        normalize(`${row.produto} ${row.codigo}`).includes(normalize(query)),
    )
    .sort((a, b) => b[sort] - a[sort]);
  const visible = expanded || query ? rows : rows.slice(0, 15);
  const headers: { key: SortKey; label: string }[] = [
    { key: "faturamento", label: "Faturamento" },
    { key: "qtd", label: "Quantidade" },
    { key: "vendas", label: "Vendas" },
    { key: "preco", label: "Preço médio" },
  ];
  return (
    <section
      className="panel products-panel rs-products"
      aria-labelledby="rs-products-title"
    >
      <div className="panel-heading">
        <div>
          <h2 id="rs-products-title">Produtos</h2>
          <p className="section-description">
            Os {data.produtos.length} que mais faturaram, de{" "}
            {integer(data.produtos_distintos)} produtos vendidos no período.
            Clique no título da coluna para ordenar.
          </p>
        </div>
        <div className="search-field rs-search">
          <Search size={16} aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            placeholder="Buscar produto ou código"
            aria-label="Buscar produto"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button
              aria-label="Limpar busca"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Produto</th>
              {headers.map((header) => (
                <th
                  scope="col"
                  key={header.key}
                  aria-sort={sort === header.key ? "descending" : "none"}
                  className="rs-num"
                >
                  <button
                    className={`rs-sort ${sort === header.key ? "active" : ""}`}
                    onClick={() => setSort(header.key)}
                  >
                    {header.label}
                    {sort === header.key && (
                      <ArrowDownRight size={12} aria-hidden="true" />
                    )}
                  </button>
                </th>
              ))}
              <th scope="col" className="rs-num">
                % do faturamento
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.codigo}>
                <th scope="row">
                  {titleCase(row.produto)}
                  <small className="rs-code">
                    {row.codigo.replace(/^0+/, "")}
                  </small>
                </th>
                <td className="rs-num">{money(row.faturamento)}</td>
                <td className="rs-num">
                  {formatQuantity(row.qtd, row.unidade)}
                </td>
                <td className="rs-num">{integer(row.vendas)}</td>
                <td className="rs-num">
                  {money(row.preco)}
                  <small className="rs-code">
                    /{row.unidade.toLowerCase()}
                  </small>
                </td>
                <td className="rs-num">
                  {percent(share(row.faturamento, data.resumo.faturamento))}
                </td>
              </tr>
            ))}
            {!visible.length && (
              <tr>
                <td colSpan={6} className="rs-empty-row">
                  Nenhum produto encontrado entre os {data.produtos.length} que
                  mais faturaram.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="rs-table-footer">
        <span>
          Quantidade em kg recalculada pelo valor ÷ preço (o relatório arredonda
          o peso). Vendas = vezes que o item foi registrado.
        </span>
        {!query && rows.length > 15 && (
          <button
            className="text-button"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded
              ? "Mostrar só os 15 primeiros"
              : `Mostrar todos os ${rows.length}`}
          </button>
        )}
      </div>
    </section>
  );
}
