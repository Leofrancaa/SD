import { products, productSummary, summarize, type DailyRecord } from "./demo";

export type RankingMetric = "sold" | "revenue" | "return";

export function rankProducts(records: DailyRecord[], metric: RankingMetric) {
  return products
    .map((product) => {
      const totals = productSummary(records, product.id);
      return {
        product,
        ...totals,
        return: totals.revenue - totals.cost - totals.loss,
      };
    })
    .sort(
      (a, b) =>
        b[metric] - a[metric] || a.product.id.localeCompare(b.product.id),
    );
}

export function weekdayAverages(records: DailyRecord[]) {
  const labels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  const daily = new Map<string, number>();
  for (const row of records) {
    const product = products.find((p) => p.id === row.productId)!;
    daily.set(row.date, (daily.get(row.date) ?? 0) + row.sold * product.price);
  }
  return labels.map((label, index) => {
    const weekday = (index + 1) % 7;
    const values = [...daily]
      .filter(([date]) => new Date(`${date}T12:00:00Z`).getUTCDay() === weekday)
      .map(([, revenue]) => revenue);
    return {
      label,
      days: values.length,
      average: values.length
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : 0,
    };
  });
}

export function productionOutcomes(records: DailyRecord[]) {
  const totals = summarize(
    records.filter(
      (row) => !products.find((p) => p.id === row.productId)?.operation,
    ),
  );
  return {
    produced: totals.produced,
    sold: totals.sold,
    retained: totals.leftover - totals.discarded,
    discarded: totals.discarded,
  };
}
