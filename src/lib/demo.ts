export type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  unit: string;
  initials: string;
  operation?: "retail";
  minimumStock?: number;
};
export type DailyRecord = {
  date: string;
  productId: string;
  produced: number;
  sold: number;
  discarded: number;
  stockout: string;
  openingStock?: number;
  received?: number;
  leftoverDestination?: keyof typeof leftoverDestinations;
};
export const leftoverDestinations = {
  unspecified: "Não informado",
  donation: "Doação",
  reuse: "Reaproveitamento",
  stock: "Em estoque",
} as const;
export type Decision = "approved" | "deferred";
export type DemoState = {
  version: 1;
  records: DailyRecord[];
  decisions: Record<string, Decision>;
};
export const DEMO_END = "2026-10-05";
export const STORAGE_KEY = "superdeli-demo-v1";
export const products: Product[] = [
  {
    id: "french-bread",
    name: "Pão francês",
    category: "Panificação",
    price: 0.85,
    cost: 0.32,
    unit: "un.",
    initials: "PF",
  },
  {
    id: "cheese-bread",
    name: "Pão de queijo",
    category: "Panificação",
    price: 2.5,
    cost: 0.95,
    unit: "un.",
    initials: "PQ",
  },
  {
    id: "coxinha",
    name: "Coxinha de frango",
    category: "Salgados",
    price: 6,
    cost: 2.2,
    unit: "un.",
    initials: "CF",
  },
  {
    id: "corn-cake",
    name: "Bolo de milho · fatia",
    category: "Confeitaria",
    price: 5,
    cost: 1.8,
    unit: "fatias",
    initials: "BM",
  },
  {
    id: "cheese-pastry",
    name: "Pastel de queijo",
    category: "Salgados",
    price: 5,
    cost: 1.7,
    unit: "un.",
    initials: "PQ",
  },
  {
    id: "ground-coffee",
    name: "Café em pó · 500 g",
    category: "Mercearia",
    price: 18.9,
    cost: 13.5,
    unit: "emb.",
    initials: "CA",
    operation: "retail",
    minimumStock: 12,
  },
  {
    id: "milk",
    name: "Leite · 1 L",
    category: "Mercearia",
    price: 6.5,
    cost: 4.7,
    unit: "emb.",
    initials: "LE",
    operation: "retail",
    minimumStock: 18,
  },
  {
    id: "nescau",
    name: "Nescau · 400 g",
    category: "Mercearia",
    price: 12.9,
    cost: 9.2,
    unit: "emb.",
    initials: "NE",
    operation: "retail",
    minimumStock: 8,
  },
  {
    id: "pre-baked",
    name: "Pré-assados · pacote",
    category: "Congelados",
    price: 16.9,
    cost: 11.5,
    unit: "emb.",
    initials: "PR",
    operation: "retail",
    minimumStock: 8,
  },
  {
    id: "ice",
    name: "Gelo · 5 kg",
    category: "Congelados",
    price: 10,
    cost: 6,
    unit: "emb.",
    initials: "GE",
    operation: "retail",
    minimumStock: 10,
  },
  {
    id: "frozen-strawberry",
    name: "Morango congelado · 1 kg",
    category: "Congelados",
    price: 24.9,
    cost: 17,
    unit: "emb.",
    initials: "MO",
    operation: "retail",
    minimumStock: 6,
  },
  {
    id: "frozen-pizza",
    name: "Pizza congelada",
    category: "Congelados",
    price: 22.9,
    cost: 15.5,
    unit: "emb.",
    initials: "PI",
    operation: "retail",
    minimumStock: 8,
  },
  {
    id: "cheese",
    name: "Queijo · embalagem 200 g",
    category: "Frios",
    price: 11.9,
    cost: 8,
    unit: "emb.",
    initials: "QU",
    operation: "retail",
    minimumStock: 12,
  },
  {
    id: "ham",
    name: "Presunto · embalagem 200 g",
    category: "Frios",
    price: 8.9,
    cost: 5.8,
    unit: "emb.",
    initials: "PR",
    operation: "retail",
    minimumStock: 12,
  },
];
export const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value,
  );
export const number = (value: number) =>
  new Intl.NumberFormat("pt-BR").format(value);
export function dateLabel(
  date: string,
  options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" },
) {
  return new Intl.DateTimeFormat("pt-BR", {
    ...options,
    timeZone: "America/Sao_Paulo",
  }).format(new Date(`${date}T12:00:00-03:00`));
}
export function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function generateRecords(): DailyRecord[] {
  const base = [520, 140, 100, 48, 72];
  const inventory = new Map(
    products.filter((p) => p.operation === "retail").map((p) => [p.id, 40]),
  );
  return Array.from({ length: 30 }, (_, day) => {
    const date = addDays(DEMO_END, day - 29);
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    return products.map((product, index) => {
      if (product.operation === "retail") {
        const openingStock = inventory.get(product.id)!;
        const received =
          day % 7 === 0 && product.id !== "frozen-strawberry" ? 24 : 0;
        const produced = openingStock + received;
        const demand =
          product.id === "frozen-strawberry"
            ? day < 5
              ? 2
              : 0
            : product.id === "milk"
              ? 5
              : 2 + ((day + index) % 3);
        const sold = Math.min(produced, demand);
        const discarded =
          (product.id === "cheese" || product.id === "ham") &&
          day % 11 === 0 &&
          produced > sold
            ? 1
            : 0;
        inventory.set(product.id, produced - sold - discarded);
        return {
          date,
          productId: product.id,
          openingStock,
          received,
          produced,
          sold,
          discarded,
          stockout: sold === produced && demand > sold ? "18:00" : "",
          leftoverDestination: "stock" as const,
        };
      }
      const produced = Math.round(
        base[index] * (weekday === 0 || weekday === 6 ? 1.22 : 1) +
          ((day * 7 + index * 11) % 19),
      );
      const ratio =
        index === 2 && weekday === 2
          ? 0.72
          : index === 1 && day % 4 === 0
            ? 1
            : 0.88 + ((day + index * 2) % 8) / 100;
      const sold = Math.min(produced, Math.round(produced * ratio));
      const discarded = Math.round(
        (produced - sold) * (index === 0 ? 0.55 : 0.8),
      );
      return {
        date,
        productId: product.id,
        produced,
        sold,
        discarded,
        stockout: sold === produced ? "17:30" : "",
        leftoverDestination:
          index === 0 ? ("reuse" as const) : ("donation" as const),
      };
    });
  }).flat();
}
export function validateRecord(record: DailyRecord): string | null {
  if (!products.some((p) => p.id === record.productId))
    return "Selecione um produto do piloto.";
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(record.date) ||
    !Number.isFinite(Date.parse(`${record.date}T12:00:00Z`)) ||
    new Date(`${record.date}T12:00:00Z`).toISOString().slice(0, 10) !==
      record.date
  )
    return "Informe uma data válida.";
  if (record.date < addDays(DEMO_END, -29) || record.date > DEMO_END)
    return "Escolha uma data entre 6 de setembro e 5 de outubro de 2026, período desta demonstração.";
  if (
    ![record.produced, record.sold, record.discarded].every(
      (n) => Number.isSafeInteger(n) && n >= 0 && n <= 100000,
    )
  )
    return "Use quantidades inteiras entre 0 e 100.000.";
  if (
    products.find((p) => p.id === record.productId)?.operation === "retail" &&
    (![record.openingStock, record.received].every(
      (n) => Number.isSafeInteger(n) && n! >= 0 && n! <= 100000,
    ) ||
      record.produced !== record.openingStock! + record.received!)
  )
    return "O disponível deve corresponder ao estoque inicial mais as entradas.";
  if (record.sold + record.discarded > record.produced)
    return "Vendas e descartes não podem superar a quantidade disponível. Corrija as quantidades.";
  if (record.stockout && !/^([01]\d|2[0-3]):[0-5]\d$/.test(record.stockout))
    return "Informe um horário válido para a falta.";
  if (record.stockout && record.sold !== record.produced)
    return "Para registrar falta, todas as unidades disponíveis devem ter sido vendidas.";
  if (
    record.leftoverDestination &&
    !Object.hasOwn(leftoverDestinations, record.leftoverDestination)
  )
    return "Escolha um destino válido para as sobras.";
  return null;
}
export function parseState(raw: string): DemoState {
  const value = JSON.parse(raw);
  if (
    value?.version !== 1 ||
    !Array.isArray(value.records) ||
    typeof value.decisions !== "object" ||
    !value.decisions ||
    Array.isArray(value.decisions)
  )
    throw new Error("Invalid demo data");
  const keys = new Set<string>();
  for (const row of value.records) {
    if (!row || typeof row.stockout !== "string" || validateRecord(row))
      throw new Error("Invalid production record");
    const key = `${row.date}/${row.productId}`;
    if (keys.has(key)) throw new Error("Duplicate production record");
    keys.add(key);
  }
  if (
    !Object.values(value.decisions).every(
      (v) => v === "approved" || v === "deferred",
    )
  )
    throw new Error("Invalid decision");
  return value;
}
export function periodRecords(
  records: DailyRecord[],
  days: number,
  offset = 0,
) {
  const end = addDays(DEMO_END, -offset);
  const start = addDays(end, -(days - 1));
  return records.filter((row) => row.date >= start && row.date <= end);
}
export function summarize(records: DailyRecord[]) {
  return records.reduce(
    (total, row) => {
      const product = products.find((p) => p.id === row.productId)!;
      total.revenue += row.sold * product.price;
      total.cost += row.sold * product.cost;
      total.loss += row.discarded * product.cost;
      total.sold += row.sold;
      total.produced += row.produced;
      total.discarded += row.discarded;
      total.leftover += row.produced - row.sold;
      total.stockouts += Number(Boolean(row.stockout));
      return total;
    },
    {
      revenue: 0,
      cost: 0,
      loss: 0,
      sold: 0,
      produced: 0,
      discarded: 0,
      leftover: 0,
      stockouts: 0,
    },
  );
}
export function productSummary(records: DailyRecord[], productId: string) {
  return summarize(records.filter((r) => r.productId === productId));
}
export function recommendations(
  records: DailyRecord[],
  inventoryRecords = records,
  endDate = DEMO_END,
) {
  const tuesdays = records.filter(
    (r) =>
      r.productId === "coxinha" &&
      new Date(`${r.date}T12:00:00Z`).getUTCDay() === 2,
  );
  const cheese = records.filter(
    (r) => r.productId === "cheese-bread" && r.stockout,
  );
  const waste = products
    .filter((p) => !p.operation)
    .map((p) => ({ product: p, ...productSummary(records, p.id) }))
    .sort((a, b) => b.loss - a.loss)[0];
  const average = tuesdays.length
    ? Math.round(
        tuesdays.reduce((sum, r) => sum + r.produced - r.sold, 0) /
          tuesdays.length,
      )
    : 0;
  return [
    ...(average > 0
      ? [
          {
            id: "coxinha-tuesday",
            tone: "warning",
            title: "Uma fornada menor na terça?",
            description: `Nas ${tuesdays.length} terças registradas, sobraram em média ${average} coxinhas. Considere testar 10% menos, verificando encomendas e faltas.`,
            productId: "coxinha",
            action: "Revisar produção",
          },
        ]
      : []),
    ...(cheese.length
      ? [
          {
            id: "cheese-stockout",
            tone: "info",
            title: "Pão de queijo merece atenção",
            description: `O produto acabou antes do fechamento em ${cheese.length} dias. Avalie uma pequena fornada extra e acompanhe a procura.`,
            productId: "cheese-bread",
            action: "Planejar reposição",
          },
        ]
      : []),
    ...inventorySummary(
      inventoryRecords,
      endDate,
      new Set(records.map((row) => row.date)).size || 7,
    )
      .filter((item) => item.stock !== null && item.status !== "Em equilíbrio")
      .map((item) => ({
        id: `inventory-${item.product.id}`,
        tone: "warning",
        title:
          item.status === "Repor estoque"
            ? `Reposição: ${item.product.name}`
            : `Confira o giro: ${item.product.name}`,
        description:
          item.status === "Repor estoque"
            ? `${item.stock} embalagens na última contagem; mínimo ilustrativo de ${item.product.minimumStock}. Confira o saldo e as compras em andamento antes de repor.`
            : `${item.stock} embalagens em estoque e ${item.daysWithoutSale} dias sem venda registrada. Confira validade e procura antes de planejar uma promoção.`,
        productId: item.product.id,
        action: "Revisar estoque",
      })),
    ...(waste.loss > 0
      ? [
          {
            id: "highest-waste",
            tone: "neutral",
            title: "Comece pelo maior descarte",
            description: `${waste.product.name} acumulou ${money(waste.loss)} em descarte ao custo. Confira os horários e o destino das sobras antes de mudar a produção.`,
            productId: waste.product.id,
            action: "Conferir registros",
          },
        ]
      : []),
  ];
}
export function toCsv(records: DailyRecord[]) {
  const rows = [
    [
      "Data",
      "Produto",
      "Produzido ou disponível",
      "Vendido",
      "Sobra",
      "Descartado",
      "Sobra não descartada",
      "Destino da sobra não descartada",
      "Horário da falta",
      "Receita simulada (BRL)",
      "Perda ao custo (BRL)",
      "Operação",
      "Estoque inicial",
      "Entradas",
      "Estoque final",
    ],
    ...records.map((r) => {
      const p = products.find((p) => p.id === r.productId)!;
      return [
        r.date,
        p.name,
        r.produced,
        r.sold,
        r.produced - r.sold,
        r.discarded,
        r.produced - r.sold - r.discarded,
        leftoverDestinations[r.leftoverDestination ?? "unspecified"],
        r.stockout,
        (r.sold * p.price).toFixed(2),
        (r.discarded * p.cost).toFixed(2),
        p.operation === "retail" ? "Revenda" : "Produção própria",
        r.openingStock ?? "",
        r.received ?? "",
        p.operation === "retail" ? r.produced - r.sold - r.discarded : "",
      ];
    }),
  ];
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(";"),
      )
      .join("\r\n")
  );
}

export function extendCatalog(state: DemoState): DemoState {
  const existing = new Set(state.records.map((row) => row.productId));
  const additions = generateRecords().filter(
    (row) =>
      products.find((p) => p.id === row.productId)?.operation === "retail" &&
      !existing.has(row.productId),
  );
  return additions.length
    ? { ...state, records: [...state.records, ...additions] }
    : state;
}

export function inventorySummary(
  records: DailyRecord[],
  endDate = DEMO_END,
  days = 7,
) {
  return products
    .filter((p) => p.operation === "retail")
    .map((product) => {
      const history = records
        .filter((r) => r.productId === product.id && r.date <= endDate)
        .sort((a, b) => a.date.localeCompare(b.date));
      const latest = history.at(-1);
      const lastSale = history.filter((r) => r.sold > 0).at(-1);
      const stock = latest
        ? latest.produced - latest.sold - latest.discarded
        : null;
      const startDate = addDays(endDate, -(days - 1));
      const selected = history.filter((r) => r.date >= startDate);
      const averageSales = selected.length
        ? selected.reduce((sum, r) => sum + r.sold, 0) / selected.length
        : 0;
      const daysWithoutSale = lastSale
        ? Math.round(
            (Date.parse(endDate) - Date.parse(lastSale.date)) / 86400000,
          )
        : null;
      const status =
        stock === null
          ? "Sem registro"
          : stock <= product.minimumStock!
            ? "Repor estoque"
            : daysWithoutSale !== null && daysWithoutSale >= 14
              ? "Sem giro recente"
              : "Em equilíbrio";
      return {
        product,
        stock,
        recordedDate: latest?.date ?? null,
        lastSaleDate: lastSale?.date ?? null,
        daysWithoutSale,
        coverageDays: averageSales
          ? Math.round((stock! / averageSales) * 10) / 10
          : null,
        stockAtCost: stock === null ? 0 : stock * product.cost,
        status,
      };
    });
}
