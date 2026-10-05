import {
  addDays,
  DEMO_END,
  inventorySummary,
  periodRecords,
  products,
  summarize,
  type DailyRecord,
} from "./demo";
import { rankProducts } from "./analytics";

export function purchasePlan(
  records: DailyRecord[],
  days: number,
  targetDays = 7,
) {
  if (![3, 7, 14].includes(targetDays))
    throw new Error("Invalid purchase horizon");
  return inventorySummary(records, DEMO_END, days).map((item) => {
    const history = periodRecords(records, days).filter(
      (row) => row.productId === item.product.id,
    );
    const sold = history.reduce((sum, row) => sum + row.sold, 0);
    const averageDailySales = history.length ? sold / history.length : 0;
    const stale = item.recordedDate !== DEMO_END;
    const quantity =
      item.stock === null ||
      stale ||
      averageDailySales === 0 ||
      item.status === "Sem giro recente"
        ? 0
        : Math.max(
            0,
            Math.ceil(
              averageDailySales * targetDays +
                item.product.minimumStock! -
                item.stock,
            ),
          );
    return {
      ...item,
      recordedDays: history.length,
      sold,
      averageDailySales,
      quantity,
      estimatedCost: quantity * item.product.cost,
      stale,
    };
  });
}

export function ownerSummary(records: DailyRecord[], days: number) {
  const selected = periodRecords(records, days);
  const totals = summarize(selected);
  const inventory = inventorySummary(records, DEMO_END, days);
  const largestLoss =
    rankProducts(selected, "return")
      .filter((item) => item.loss > 0)
      .sort((a, b) => b.loss - a.loss)[0] ?? null;
  const bestReturn =
    rankProducts(selected, "return").find((item) => item.sold > 0) ?? null;
  const previousRecords = periodRecords(records, days, days);
  const previousKeys = new Set(
    previousRecords.map((row) => `${row.productId}/${row.date}`),
  );
  const complete =
    days <= 14 &&
    selected.length === products.length * days &&
    previousRecords.length === selected.length &&
    selected.every((row) =>
      previousKeys.has(`${row.productId}/${addDays(row.date, -days)}`),
    );
  const previous = complete ? summarize(previousRecords) : null;
  return {
    totals,
    estimatedReturn: totals.revenue - totals.cost - totals.loss,
    largestLoss,
    bestReturn,
    lowStock: inventory.filter((item) => item.status === "Repor estoque"),
    idleStock: inventory.filter((item) => item.status === "Sem giro recente"),
    stockAtCost: inventory.reduce((sum, item) => sum + item.stockAtCost, 0),
    idleStockAtCost: inventory
      .filter((item) => item.status === "Sem giro recente")
      .reduce((sum, item) => sum + item.stockAtCost, 0),
    recordedDates: new Set(selected.map((row) => row.date)).size,
    coveragePercent: Math.round(
      (selected.length / (products.length * days)) * 100,
    ),
    previous,
    revenueChange:
      previous && previous.revenue > 0
        ? ((totals.revenue - previous.revenue) / previous.revenue) * 100
        : null,
    lossChange:
      previous && previous.loss > 0
        ? ((totals.loss - previous.loss) / previous.loss) * 100
        : null,
  };
}

export function purchaseCsv(
  rows: {
    product: (typeof products)[number];
    stock: number | null;
    quantity: number;
  }[],
  targetDays: number,
) {
  const cells = [
    [
      "Dados simulados da Superdeli",
      DEMO_END,
      "Planejamento para revisão, não é um pedido",
      `${targetDays} dias de cobertura + estoque mínimo`,
    ],
    [
      "Produto",
      "Estoque contado",
      "Quantidade planejada",
      "Unidade",
      "Custo unitário ilustrativo (BRL)",
      "Compra estimada (BRL)",
    ],
    ...rows.map((row) => [
      row.product.name,
      row.stock ?? "",
      row.quantity,
      row.product.unit,
      row.product.cost.toFixed(2),
      (row.quantity * row.product.cost).toFixed(2),
    ]),
  ];
  return (
    "\uFEFF" +
    cells
      .map((row) =>
        row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(";"),
      )
      .join("\r\n")
  );
}
