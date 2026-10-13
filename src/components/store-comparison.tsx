"use client";

import { Lightbulb, Store as StoreIcon } from "lucide-react";
import {
  filterStore,
  money,
  monthLabel,
  number,
  periodBounds,
  periodLabel,
  periodRecords,
  products,
  stores,
  summarize,
  type DailyRecord,
  type Period,
} from "@/lib/demo";

const percent = (value: number) => `${value.toFixed(1).replace(".", ",")}%`;
const storeColor = (index: number) => `var(--store-${index})`;

type Totals = ReturnType<typeof summarize>;
type Metric = {
  label: string;
  value: (totals: Totals) => number;
  format: (value: number) => string;
  better: "higher" | "lower" | "none";
  hint?: string;
};

const metrics: Metric[] = [
  {
    label: "Faturamento",
    value: (t) => t.revenue,
    format: money,
    better: "higher",
  },
  {
    label: "Resultado bruto",
    value: (t) => t.revenue - t.cost - t.loss,
    format: money,
    better: "higher",
    hint: "Faturamento menos mercadorias vendidas e descartes",
  },
  {
    label: "Margem bruta",
    value: (t) =>
      t.revenue ? ((t.revenue - t.cost - t.loss) / t.revenue) * 100 : 0,
    format: percent,
    better: "higher",
  },
  {
    label: "Perda por descarte",
    value: (t) => t.loss,
    format: money,
    // Valor absoluto depende do tamanho da loja; o destaque fica na taxa abaixo.
    better: "none",
  },
  {
    label: "Descarte sobre o faturamento",
    value: (t) => (t.revenue ? (t.loss / t.revenue) * 100 : 0),
    format: percent,
    better: "lower",
  },
  {
    label: "Registros de falta",
    value: (t) => t.stockouts,
    format: number,
    better: "lower",
    hint: "Produto que acabou antes de fechar",
  },
];

/** Comparação lado a lado das lojas no período escolhido. */
export function StoreComparison({
  records,
  period,
}: {
  records: DailyRecord[];
  period: Period;
}) {
  const selected = periodRecords(records, period);
  const perStore = stores.map((store) => ({
    store,
    records: filterStore(selected, store.id),
    totals: summarize(filterStore(selected, store.id)),
  }));
  const total = summarize(selected);
  const days = new Set(selected.map((row) => row.date)).size || 1;
  const insights = buildInsights(perStore, total.revenue, days);
  return (
    <div className="store-comparison">
      <section className="panel compare-hero" aria-labelledby="compare-title">
        <div className="panel-heading">
          <div className="inline-title">
            <StoreIcon size={19} />
            <h2 id="compare-title">Suas lojas lado a lado</h2>
          </div>
          <span className="analytics-caption">
            {periodLabel(period).replace(/^./, (c) => c.toUpperCase())}
          </span>
        </div>
        <div className="compare-share" aria-label="Participação no faturamento">
          <div className="compare-share-bar">
            {perStore.map(({ store, totals }, index) => (
              <span
                key={store.id}
                style={{
                  width: `${total.revenue ? (totals.revenue / total.revenue) * 100 : 0}%`,
                  background: storeColor(index),
                }}
              />
            ))}
          </div>
          <ul className="compare-legend">
            {perStore.map(({ store, totals }, index) => (
              <li key={store.id}>
                <i style={{ background: storeColor(index) }} />
                <strong>{store.name}</strong>
                <span>
                  {percent(
                    total.revenue ? (totals.revenue / total.revenue) * 100 : 0,
                  )}{" "}
                  do faturamento
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="table-scroll">
          <table className="compare-table">
            <caption className="sr-only">
              Indicadores de cada loja no período
            </caption>
            <thead>
              <tr>
                <th>Indicador</th>
                {perStore.map(({ store }, index) => (
                  <th key={store.id} className="numeric">
                    <span
                      className="store-dot"
                      style={{ background: storeColor(index) }}
                      aria-hidden="true"
                    />
                    {store.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.map((metric) => {
                const values = perStore.map(({ totals }) =>
                  metric.value(totals),
                );
                const best =
                  metric.better === "higher"
                    ? Math.max(...values)
                    : Math.min(...values);
                const tie =
                  metric.better === "none" ||
                  values.every((value) => value === values[0]);
                return (
                  <tr key={metric.label}>
                    <th scope="row">
                      {metric.label}
                      {metric.hint && (
                        <span className="cell-detail">{metric.hint}</span>
                      )}
                    </th>
                    {values.map((value, index) => (
                      <td
                        key={perStore[index].store.id}
                        className={`numeric ${!tie && value === best ? "compare-best" : ""}`}
                      >
                        {metric.format(value)}
                        {!tie && value === best && (
                          <span className="compare-badge">Melhor</span>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {insights.length > 0 && (
        <section
          className="panel compare-insights"
          aria-labelledby="compare-insights-title"
        >
          <div className="inline-title">
            <Lightbulb size={19} />
            <h2 id="compare-insights-title">O que a comparação mostra</h2>
          </div>
          <ul>
            {insights.map((insight) => (
              <li key={insight.title}>
                <strong>{insight.title}</strong>
                <p>{insight.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <MonthlyBars records={records} period={period} />

      <section
        className="panel compare-products"
        aria-labelledby="compare-products-title"
      >
        <div className="panel-heading">
          <div>
            <h2 id="compare-products-title">Produção própria por loja</h2>
            <p className="section-description">
              Receita e descarte de cada produto. O descarte é medido sobre o
              que foi produzido.
            </p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <caption className="sr-only">
              Receita e descarte por produto em cada loja
            </caption>
            <thead>
              <tr>
                <th>Produto</th>
                {perStore.map(({ store }) => (
                  <th key={store.id} className="numeric">
                    {store.short}: receita
                  </th>
                ))}
                {perStore.map(({ store }) => (
                  <th key={`${store.id}-waste`} className="numeric">
                    {store.short}: descarte
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products
                .filter((product) => !product.operation)
                .map((product) => {
                  const rows = perStore.map(({ records: own }) =>
                    summarize(
                      own.filter((row) => row.productId === product.id),
                    ),
                  );
                  const rates = rows.map((row) =>
                    row.produced ? (row.discarded / row.produced) * 100 : 0,
                  );
                  const worst = Math.max(...rates);
                  const gap = worst - Math.min(...rates) >= 2;
                  return (
                    <tr key={product.id}>
                      <th scope="row">{product.name}</th>
                      {rows.map((row, index) => (
                        <td key={`r-${stores[index].id}`} className="numeric">
                          {money(row.revenue)}
                        </td>
                      ))}
                      {rates.map((rate, index) => (
                        <td
                          key={`w-${stores[index].id}`}
                          className={`numeric ${gap && rate === worst ? "compare-worse" : ""}`}
                        >
                          {percent(rate)}
                          <span className="cell-detail">
                            {money(rows[index].loss)} ao custo
                          </span>
                        </td>
                      ))}
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        <p className="table-footnote">
          Lojas, valores e diferenças são dados simulados para demonstração.
        </p>
      </section>
    </div>
  );
}

function buildInsights(
  perStore: {
    store: (typeof stores)[number];
    records: DailyRecord[];
    totals: Totals;
  }[],
  revenue: number,
  days: number,
) {
  const insights: { title: string; detail: string }[] = [];
  if (perStore.length < 2 || !revenue) return insights;
  const [leader, other] = [...perStore].sort(
    (a, b) => b.totals.revenue - a.totals.revenue,
  );
  insights.push({
    title: `${leader.store.name} responde por ${percent((leader.totals.revenue / revenue) * 100)} do faturamento`,
    detail: `Média de ${money(leader.totals.revenue / days)} por dia, contra ${money(other.totals.revenue / days)} na ${other.store.name}.`,
  });
  // Maior diferença de descarte entre lojas, com a economia se a pior igualasse a melhor.
  let biggest: {
    product: string;
    worse: string;
    better: string;
    rateWorse: number;
    rateBetter: number;
    saving: number;
  } | null = null;
  for (const product of products.filter((item) => !item.operation)) {
    const rows = perStore.map(({ store, records }) => ({
      store,
      totals: summarize(records.filter((row) => row.productId === product.id)),
    }));
    const rated = rows
      .filter((row) => row.totals.produced > 0)
      .map((row) => ({
        ...row,
        rate: row.totals.discarded / row.totals.produced,
      }));
    if (rated.length < 2) continue;
    rated.sort((a, b) => b.rate - a.rate);
    const [worse, better] = rated;
    const excessUnits = (worse.rate - better.rate) * worse.totals.produced;
    const saving = excessUnits * product.cost;
    if (!biggest || saving > biggest.saving)
      biggest = {
        product: product.name,
        worse: worse.store.name,
        better: better.store.name,
        rateWorse: worse.rate * 100,
        rateBetter: better.rate * 100,
        saving,
      };
  }
  if (biggest && biggest.saving > 0) {
    const perMonth = (biggest.saving / days) * 30;
    insights.push({
      title: `${biggest.product}: a ${biggest.worse} descarta ${percent(biggest.rateWorse)} da produção`,
      detail: `Na ${biggest.better}, o descarte é de ${percent(biggest.rateBetter)}. Se a ${biggest.worse} chegasse a esse nível, economizaria cerca de ${money(perMonth)} por mês ao custo.`,
    });
  }
  const [moreStockouts, fewer] = [...perStore].sort(
    (a, b) => b.totals.stockouts - a.totals.stockouts,
  );
  if (moreStockouts.totals.stockouts > fewer.totals.stockouts) {
    const top = products
      .map((product) => ({
        product,
        count: moreStockouts.records.filter(
          (row) => row.productId === product.id && row.stockout,
        ).length,
      }))
      .sort((a, b) => b.count - a.count)[0];
    insights.push({
      title: `${moreStockouts.store.name} fica mais vezes sem produto`,
      detail: `${number(moreStockouts.totals.stockouts)} registros de falta, contra ${number(fewer.totals.stockouts)} na ${fewer.store.name}${top?.count ? `. O que mais falta é ${top.product.name.toLowerCase()} (${number(top.count)} vezes)` : ""}. Vale revisar a fornada antes de cortar produção.`,
    });
  }
  return insights;
}

function MonthlyBars({
  records,
  period,
}: {
  records: DailyRecord[];
  period: Period;
}) {
  const year = { year: period.year, month: null };
  const { start, end } = periodBounds(year);
  const months: string[] = [];
  for (
    let month = Number(start.slice(5, 7));
    month <= Number(end.slice(5, 7));
    month++
  )
    months.push(`${period.year}-${String(month).padStart(2, "0")}`);
  const series = months.map((month) => ({
    month,
    values: stores.map(
      (store) =>
        summarize(
          records.filter(
            (row) => row.storeId === store.id && row.date.startsWith(month),
          ),
        ).revenue,
    ),
  }));
  const peak = Math.max(1, ...series.flatMap((item) => item.values));
  const magnitude = 10 ** Math.floor(Math.log10(peak));
  const step = magnitude * (peak / magnitude > 5 ? 1 : 0.5);
  const max = Math.ceil(peak / step) * step;
  return (
    <section className="panel chart-panel compare-monthly">
      <div className="panel-heading">
        <div>
          <h2>Faturamento mês a mês</h2>
          <p className="section-description">
            {periodLabel(year)}, por loja, em reais
          </p>
        </div>
        <ul className="compare-legend inline">
          {stores.map((store, index) => (
            <li key={store.id}>
              <i style={{ background: storeColor(index) }} />
              {store.name}
            </li>
          ))}
        </ul>
      </div>
      <div
        className="chart"
        role="img"
        aria-label={`Faturamento mensal por loja: ${series
          .map(
            (item) =>
              `${monthLabel(Number(item.month.slice(5)))}: ${stores.map((store, index) => `${store.short} ${money(item.values[index])}`).join(", ")}`,
          )
          .join("; ")}`}
      >
        <div className="chart-axis">
          {[max, max * 0.75, max * 0.5, max * 0.25, 0].map((value) => (
            <span key={value}>{number(Math.round(value))}</span>
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
              gridTemplateColumns: `repeat(${series.length}, minmax(0, 1fr))`,
            }}
          >
            {series.map((item) => {
              const month = Number(item.month.slice(5));
              const highlighted =
                period.month === null || period.month === month;
              return (
                <div
                  className={`bar-column grouped ${highlighted ? "" : "dimmed"}`}
                  key={item.month}
                >
                  <div className="bar-pair">
                    {item.values.map((value, index) => (
                      <div
                        key={stores[index].id}
                        className="bar store-bar"
                        style={{
                          height: `${Math.max(1, (value / max) * 100)}%`,
                          background: storeColor(index),
                        }}
                      >
                        <span className="chart-tooltip">
                          {stores[index].name} · {monthLabel(month, true)}
                          <strong>{money(value)}</strong>
                        </span>
                      </div>
                    ))}
                  </div>
                  <span className="bar-label">{monthLabel(month, true)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
