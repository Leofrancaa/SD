export type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  unit: string;
  initials: string;
};
export type DailyRecord = {
  date: string;
  productId: string;
  produced: number;
  sold: number;
  discarded: number;
  stockout: string;
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
  return Array.from({ length: 30 }, (_, day) => {
    const date = addDays(DEMO_END, day - 29);
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    return products.map((product, index) => {
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
  if (record.sold + record.discarded > record.produced)
    return "Vendas e descartes não podem superar a produção. Corrija as quantidades.";
  if (record.stockout && !/^([01]\d|2[0-3]):[0-5]\d$/.test(record.stockout))
    return "Informe um horário válido para a falta.";
  if (record.stockout && record.sold !== record.produced)
    return "Para registrar falta, todas as unidades produzidas devem ter sido vendidas.";
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
export function recommendations(records: DailyRecord[]) {
  const tuesdays = records.filter(
    (r) =>
      r.productId === "coxinha" &&
      new Date(`${r.date}T12:00:00Z`).getUTCDay() === 2,
  );
  const cheese = records.filter(
    (r) => r.productId === "cheese-bread" && r.stockout,
  );
  const waste = products
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
      "Produzido",
      "Vendido",
      "Sobra",
      "Descartado",
      "Sobra não descartada",
      "Destino da sobra não descartada",
      "Horário da falta",
      "Receita simulada (BRL)",
      "Perda ao custo (BRL)",
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
