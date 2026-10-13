import {
  addDays,
  DEMO_END,
  inventorySummary,
  isPeriodComplete,
  periodBounds,
  periodLength,
  periodRecords,
  previousPeriod,
  products,
  storeCount,
  storeName,
  stores,
  summarize,
  type DailyRecord,
  type Period,
} from "./demo";

/** Janela de vendas recentes usada para planejar compras, independente do filtro. */
export const PURCHASE_HISTORY_DAYS = 28;
import { rankProducts } from "./analytics";

/** Sugestão de compra por loja e mercadoria (cada loja recebe a própria entrega). */
export function purchasePlan(records: DailyRecord[], targetDays = 7) {
  if (![3, 7, 14].includes(targetDays))
    throw new Error("Invalid purchase horizon");
  const start = addDays(DEMO_END, -(PURCHASE_HISTORY_DAYS - 1));
  const storeIds = stores
    .map((store) => store.id)
    .filter((id) => records.some((row) => row.storeId === id));
  return (storeIds.length ? storeIds : [stores[0].id]).flatMap((storeId) =>
    inventorySummary(
      records.filter((row) => row.storeId === storeId),
      DEMO_END,
      PURCHASE_HISTORY_DAYS,
    ).map((item) => {
      const history = records.filter(
        (row) =>
          row.storeId === storeId &&
          row.productId === item.product.id &&
          row.date >= start &&
          row.date <= DEMO_END,
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
        storeId,
        key: `${storeId}:${item.product.id}`,
        recordedDays: history.length,
        sold,
        averageDailySales,
        quantity,
        estimatedCost: quantity * item.product.cost,
        stale,
      };
    }),
  );
}

export function ownerSummary(records: DailyRecord[], period: Period) {
  const selected = periodRecords(records, period);
  const totals = summarize(selected);
  const { end } = periodBounds(period);
  const days = periodLength(period);
  const inventory = inventorySummary(records, end, days);
  const largestLoss =
    rankProducts(selected, "return")
      .filter((item) => item.loss > 0)
      .sort((a, b) => b.loss - a.loss)[0] ?? null;
  const bestReturn =
    rankProducts(selected, "return").find((item) => item.sold > 0) ?? null;
  const before = previousPeriod(period);
  const previousRecords = before ? periodRecords(records, before) : [];
  // Só compara períodos inteiros e totalmente registrados.
  const complete =
    before !== null &&
    isPeriodComplete(period) &&
    isPeriodComplete(before) &&
    selected.length === products.length * days * storeCount(records) &&
    previousRecords.length ===
      products.length * periodLength(before) * storeCount(records);
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
      (selected.length / (products.length * days * storeCount(records))) * 100,
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
    storeId?: string;
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
      "Loja",
      "Produto",
      "Estoque contado",
      "Quantidade planejada",
      "Unidade",
      "Custo unitário ilustrativo (BRL)",
      "Compra estimada (BRL)",
    ],
    ...rows.map((row) => [
      row.storeId ? storeName(row.storeId) : "",
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

export const STORE_SIGNATURE = "Superdeli, em Conceição do Jacuípe";

/**
 * Monta o texto de um pedido para o fornecedor. O envio é sempre feito pelo
 * dono (WhatsApp, e-mail ou cópia); o sistema nunca envia nada sozinho.
 */
export function supplierMessage({
  supplier,
  items,
  delivery,
}: {
  supplier: string;
  items: { name: string; quantity: number; unit: string; store?: string }[];
  delivery?: string;
}) {
  const line = (item: (typeof items)[number]) =>
    `• ${item.quantity} ${item.unit} — ${item.name}`;
  const storeNames = [...new Set(items.map((item) => item.store ?? ""))];
  // Com mais de uma loja, separa os itens pelo endereço de entrega.
  const lines =
    storeNames.length > 1
      ? storeNames.flatMap((name, index) => [
          ...(index ? [""] : []),
          `*${name}*`,
          ...items.filter((item) => (item.store ?? "") === name).map(line),
        ])
      : items.map(line);
  const when = delivery?.trim();
  return [
    `Olá, ${supplier}! Tudo bem?`,
    `Aqui é da ${STORE_SIGNATURE}. Gostaria de fazer o seguinte pedido${storeNames.length === 1 && storeNames[0] ? ` para a ${storeNames[0]}` : ""}:`,
    "",
    ...lines,
    "",
    ...(when ? [`Entrega desejada: ${when}.`] : []),
    "Pode confirmar a disponibilidade, os valores e o prazo de entrega?",
    "Obrigado!",
  ].join("\n");
}

export function groupBySupplier<T extends { product: { supplier?: string } }>(
  items: T[],
) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const supplier = item.product.supplier ?? "Fornecedor não cadastrado";
    groups.set(supplier, [...(groups.get(supplier) ?? []), item]);
  }
  return [...groups.entries()].map(([supplier, list]) => ({
    supplier,
    items: list,
  }));
}
