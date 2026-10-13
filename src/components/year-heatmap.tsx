"use client";

import { CalendarDays } from "lucide-react";
import {
  addDays,
  dateLabel,
  money,
  monthLabel,
  periodBounds,
  periodLabel,
  products,
  type DailyRecord,
} from "@/lib/demo";

// Escala sequencial de um só tom (claro = vende pouco, escuro = vende muito).
const steps = ["#f7ece3", "#f0cfb2", "#e3a173", "#cc6c33", "#9c3c0a"];
const weekdays = ["Seg", "", "Qua", "", "Sex", "", "Dom"];

/** Calendário de calor: um quadrado por dia, colorido pelo faturamento. */
export function YearHeatmap({
  records,
  year,
  month,
}: {
  records: DailyRecord[];
  year: number;
  month: number | null;
}) {
  const { start, end } = periodBounds({ year, month: null });
  const price = new Map(products.map((product) => [product.id, product.price]));
  const revenue = new Map<string, number>();
  for (const row of records)
    if (row.date >= start && row.date <= end)
      revenue.set(
        row.date,
        (revenue.get(row.date) ?? 0) +
          row.sold * (price.get(row.productId) ?? 0),
      );
  const values = [...revenue.values()].sort((a, b) => a - b);
  if (!values.length) return null;
  // Faixas por quantis: cada cor cobre cerca de 20% dos dias.
  const cut = (q: number) =>
    values[Math.min(values.length - 1, Math.floor(q * values.length))];
  const thresholds = [cut(0.2), cut(0.4), cut(0.6), cut(0.8)];
  const level = (value: number) => thresholds.filter((t) => value >= t).length;
  // Grade começa na segunda-feira da primeira semana.
  const first = new Date(`${start}T12:00:00Z`);
  const offset = (first.getUTCDay() + 6) % 7;
  const gridStart = addDays(start, -offset);
  const totalDays =
    Math.round((Date.parse(end) - Date.parse(gridStart)) / 86400000) + 1;
  const weeks = Math.ceil(totalDays / 7);
  const cells = Array.from({ length: weeks * 7 }, (_, index) => {
    const date = addDays(gridStart, index);
    return {
      date,
      value: date >= start && date <= end ? revenue.get(date) : undefined,
    };
  });
  const monthStarts = cells
    .map((cell, index) => ({ ...cell, week: Math.floor(index / 7) }))
    .filter(
      (cell) =>
        cell.date.endsWith("-01") && cell.date >= start && cell.date <= end,
    );
  const ranked = [...revenue.entries()].sort((a, b) => b[1] - a[1]);
  const best = ranked.slice(0, 3);
  const worst = ranked.slice(-3).reverse();
  const label = (date: string) =>
    dateLabel(date, { weekday: "short", day: "2-digit", month: "short" });
  return (
    <section className="panel heatmap-panel" aria-labelledby="heatmap-title">
      <div className="panel-heading">
        <div>
          <div className="inline-title">
            <CalendarDays size={19} />
            <h2 id="heatmap-title">O calendário de vendas</h2>
          </div>
          <p className="section-description">
            Faturamento de cada dia em {periodLabel({ year, month: null })}.
            Quanto mais escuro, mais o caixa vendeu.
          </p>
        </div>
        <div className="heatmap-legend" aria-hidden="true">
          <span>Menos</span>
          {steps.map((color) => (
            <i key={color} style={{ background: color }} />
          ))}
          <span>Mais</span>
        </div>
      </div>
      <div className="heatmap-scroll">
        <div
          className="heatmap"
          style={{ gridTemplateColumns: `28px repeat(${weeks}, 13px)` }}
          role="img"
          aria-label={`Calendário de faturamento diário de ${periodLabel({ year, month: null })}. Melhores dias: ${best.map(([date, value]) => `${label(date)} ${money(value)}`).join("; ")}.`}
        >
          {monthStarts.map((cell) => (
            <span
              key={cell.date}
              className="heatmap-month"
              style={{ gridColumn: cell.week + 2, gridRow: 1 }}
            >
              {monthLabel(Number(cell.date.slice(5, 7)), true)}
            </span>
          ))}
          {weekdays.map((name, row) => (
            <span
              key={`w-${row}`}
              className="heatmap-weekday"
              style={{ gridRow: row + 2, gridColumn: 1 }}
            >
              {name}
            </span>
          ))}
          {cells.map((cell, index) => {
            const inMonth =
              month === null || Number(cell.date.slice(5, 7)) === month;
            return (
              <span
                key={cell.date}
                className={`heatmap-cell ${cell.value === undefined ? "empty" : ""} ${inMonth ? "" : "dimmed"}`}
                style={{
                  gridColumn: Math.floor(index / 7) + 2,
                  gridRow: (index % 7) + 2,
                  background:
                    cell.value === undefined
                      ? undefined
                      : steps[level(cell.value)],
                }}
                title={
                  cell.value === undefined
                    ? undefined
                    : `${label(cell.date)}: ${money(cell.value)}`
                }
              />
            );
          })}
        </div>
      </div>
      <div className="heatmap-extremes">
        <div>
          <span className="small-label">DIAS MAIS FORTES</span>
          <ol>
            {best.map(([date, value]) => (
              <li key={date}>
                <span>{label(date)}</span>
                <strong>{money(value)}</strong>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <span className="small-label">DIAS MAIS FRACOS</span>
          <ol>
            {worst.map(([date, value]) => (
              <li key={date}>
                <span>{label(date)}</span>
                <strong>{money(value)}</strong>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
