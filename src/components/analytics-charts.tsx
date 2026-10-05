"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  BarChart3,
  Leaf,
  PackageCheck,
  Trophy,
} from "lucide-react";
import { money, number, type DailyRecord } from "@/lib/demo";
import {
  productionOutcomes,
  rankProducts,
  weekdayAverages,
  type RankingMetric,
} from "@/lib/analytics";

const metricLabels: Record<RankingMetric, string> = {
  sold: "Quantidade",
  revenue: "Receita",
  return: "Retorno",
};
const percentage = (value: number, total: number) =>
  `${(total ? (value / total) * 100 : 0).toFixed(1).replace(".", ",")}%`;

export function AnalyticsCharts({ records }: { records: DailyRecord[] }) {
  return (
    <section
      className="analytics-section"
      aria-label="Análises de produtos e produção"
    >
      <div className="analytics-section-heading">
        <h2>O que os números contam</h2>
        <p>Mais detalhes para escolher a próxima fornada.</p>
      </div>
      <div className="analytics-grid">
        <BestSellers records={records} />
        <WeekdayChart records={records} />
        <ProductionChart records={records} />
        <WasteChart records={records} />
      </div>
    </section>
  );
}

function BestSellers({ records }: { records: DailyRecord[] }) {
  const [metric, setMetric] = useState<RankingMetric>("sold");
  const ranked = rankProducts(records, metric);
  const maximum = Math.max(...ranked.map((item) => Math.abs(item[metric])), 1);
  const total = ranked.reduce((sum, item) => sum + item[metric], 0);
  return (
    <section className="panel analytics-panel">
      <div className="panel-heading">
        <div className="inline-title">
          <Trophy size={19} />
          <h2>Os favoritos do balcão</h2>
        </div>
        <span className="analytics-caption">Top 5</span>
      </div>
      <p className="section-description">
        {metric === "sold"
          ? "Ranking de unidades vendidas no período."
          : metric === "revenue"
            ? "Quem mais contribui para a receita de vendas."
            : "Vendas menos custo das unidades vendidas e descartadas."}
      </p>
      <div
        className="chart-toggle ranking-toggle"
        role="group"
        aria-label="Ordenar ranking de produtos"
      >
        {(Object.keys(metricLabels) as RankingMetric[]).map((key) => (
          <button
            key={key}
            aria-pressed={metric === key}
            className={metric === key ? "selected" : ""}
            onClick={() => setMetric(key)}
          >
            {metricLabels[key]}
          </button>
        ))}
      </div>
      <ol className="ranking-list">
        {ranked.slice(0, 5).map((item, index) => (
          <li key={item.product.id}>
            <span className={`rank-number ${index === 0 ? "first" : ""}`}>
              {index + 1}
            </span>
            <div className="ranking-content">
              <div className="ranking-label">
                <span>{item.product.name}</span>
                <strong>
                  {metric === "sold"
                    ? `${number(item.sold)} ${item.product.unit}`
                    : money(item[metric])}
                </strong>
              </div>
              <div className="ranking-track" aria-hidden="true">
                <span
                  className={`${index === 0 ? "leading" : ""} ${item[metric] < 0 ? "negative" : ""}`}
                  style={{
                    width: `${(Math.abs(item[metric]) / maximum) * 100}%`,
                  }}
                />
              </div>
            </div>
          </li>
        ))}
      </ol>
      <div className="analytics-footer">
        <span>
          {metric === "return"
            ? "Retorno estimado · não inclui despesas fixas"
            : `O primeiro representa ${percentage(ranked[0][metric], total)} do total`}
        </span>
        <span className="analytics-footer-icon">
          <Trophy size={13} />
          {metricLabels[metric]}
        </span>
      </div>
    </section>
  );
}

function WeekdayChart({ records }: { records: DailyRecord[] }) {
  const values = weekdayAverages(records);
  const maximum = Math.max(...values.map((day) => day.average), 1);
  const best = [...values].sort((a, b) => b.average - a.average)[0];
  return (
    <section className="panel analytics-panel">
      <div className="panel-heading">
        <div className="inline-title">
          <BarChart3 size={19} />
          <h2>Cada dia tem seu ritmo</h2>
        </div>
        <span className="tag">Média diária</span>
      </div>
      <p className="section-description">
        Receita média por dia da semana, em reais.
      </p>
      <div className="weekday-highlight">
        <strong>{best.days ? best.label : "Sem dados"}</strong>
        <div>
          <span>
            {best.days
              ? "maior média de vendas"
              : "Registre vendas para comparar"}
          </span>
          <b>{money(best.average)}</b>
        </div>
        <ArrowUpRight size={24} />
      </div>
      <div
        className="weekday-chart"
        role="img"
        aria-label={`Média de vendas por dia da semana: ${values.map((day) => `${day.label}: ${money(day.average)}, ${day.days} dias registrados`).join("; ")}`}
      >
        {values.map((day) => (
          <div className="weekday-column" key={day.label}>
            <span className="weekday-amount">
              {number(Math.round(day.average))}
            </span>
            <div className="weekday-track">
              <span
                className={day.label === best.label && day.days ? "best" : ""}
                style={{ height: `${(day.average / maximum) * 100}%` }}
              />
            </div>
            <strong>{day.label}</strong>
            <span className="weekday-count">
              {day.days} {day.days === 1 ? "dia" : "dias"}
            </span>
          </div>
        ))}
      </div>
      <div className="analytics-footer">
        <span>Média por dia registrado, sem estimar dias ausentes</span>
      </div>
    </section>
  );
}

function ProductionChart({ records }: { records: DailyRecord[] }) {
  const totals = productionOutcomes(records);
  const segments = [
    { label: "Vendidas", value: totals.sold, className: "outcome-sold" },
    {
      label: "Outras sobras",
      value: totals.retained,
      className: "outcome-retained",
    },
    {
      label: "Descartadas",
      value: totals.discarded,
      className: "outcome-discarded",
    },
  ];
  const circumference = 2 * Math.PI * 70;
  let offset = 0;
  return (
    <section className="panel analytics-panel">
      <div className="panel-heading">
        <div className="inline-title">
          <PackageCheck size={19} />
          <h2>O destino de cada fornada</h2>
        </div>
      </div>
      <p className="section-description">Da produção ao balcão, em unidades.</p>
      <div className="production-breakdown">
        <div
          className="outcome-donut"
          role="img"
          aria-label={`${number(totals.produced)} unidades produzidas. ${segments.map((item) => `${item.label}: ${number(item.value)}, ${percentage(item.value, totals.produced)}`).join(". ")}`}
        >
          <svg viewBox="0 0 180 180" aria-hidden="true">
            <circle cx="90" cy="90" r="70" className="outcome-base" />
            {segments.map((item) => {
              const length = totals.produced
                ? (item.value / totals.produced) * circumference
                : 0;
              const currentOffset = offset;
              offset += length;
              return (
                <circle
                  key={item.label}
                  cx="90"
                  cy="90"
                  r="70"
                  className={item.className}
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={-currentOffset}
                  transform="rotate(-90 90 90)"
                />
              );
            })}
          </svg>
          <div className="donut-center">
            <strong>{number(totals.produced)}</strong>
            <span>produzidas</span>
          </div>
        </div>
        <dl className="outcome-legend">
          {segments.map((item) => (
            <div key={item.label}>
              <dt>
                <i className={item.className} />
                {item.label}
              </dt>
              <dd>
                <strong>{number(item.value)}</strong>
                <span>{percentage(item.value, totals.produced)}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="analytics-footer">
        <span>Outras sobras incluem doação, reaproveitamento e estoque</span>
      </div>
    </section>
  );
}

function WasteChart({ records }: { records: DailyRecord[] }) {
  const ranked = rankProducts(records, "sold").sort(
    (a, b) => b.loss - a.loss || a.product.id.localeCompare(b.product.id),
  );
  const maximum = Math.max(...ranked.map((item) => item.loss), 1);
  const loss = ranked.reduce((sum, item) => sum + item.loss, 0);
  return (
    <section className="panel analytics-panel">
      <div className="panel-heading">
        <div className="inline-title">
          <Leaf size={19} />
          <h2>Onde o desperdício pesa</h2>
        </div>
        <span className="analytics-caption">Ao custo</span>
      </div>
      <p className="section-description">
        Valor dos descartes por produto no período.
      </p>
      <div className="waste-summary">
        <strong>{money(loss)}</strong>
        <span>em perdas por descarte</span>
      </div>
      <ul className="waste-list">
        {ranked.slice(0, 5).map((item) => (
          <li key={item.product.id}>
            <div className="ranking-label">
              <span>{item.product.name}</span>
              <strong>{money(item.loss)}</strong>
            </div>
            <div className="waste-row">
              <div className="ranking-track" aria-hidden="true">
                <span style={{ width: `${(item.loss / maximum) * 100}%` }} />
              </div>
              <span>{number(item.discarded)} descartadas</span>
            </div>
          </li>
        ))}
      </ul>
      <div className="analytics-footer">
        <span>Preço de venda não entra no cálculo das perdas</span>
      </div>
    </section>
  );
}
