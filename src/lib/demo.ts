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
  /** Fornecedor fictício, usado para agrupar os pedidos de reposição. */
  supplier?: string;
};
export type DailyRecord = {
  date: string;
  storeId: string;
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
export const DEMO_START = "2025-09-01";
export const DEMO_END = "2026-09-30";
export const DEMO_DAYS =
  Math.round((Date.parse(DEMO_END) - Date.parse(DEMO_START)) / 86400000) + 1;
export const STORAGE_KEY = "superdeli-demo-v3";
export type Store = { id: string; name: string; short: string };
/** Lojas fictícias do piloto. */
export const stores: Store[] = [
  { id: "centro", name: "Loja Centro", short: "Centro" },
  { id: "avenida", name: "Loja Avenida", short: "Avenida" },
];
export type StoreFilter = "all" | string;
export function storeName(id: string) {
  return stores.find((store) => store.id === id)?.name ?? id;
}
export function filterStore(records: DailyRecord[], storeId: StoreFilter) {
  return storeId === "all"
    ? records
    : records.filter((row) => row.storeId === storeId);
}
export function storeCount(records: DailyRecord[]) {
  return new Set(records.map((row) => row.storeId)).size || 1;
}
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
    supplier: "Distribuidora Recôncavo",
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
    supplier: "Laticínios Jacuípe",
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
    supplier: "Distribuidora Recôncavo",
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
    supplier: "Frio Bahia Congelados",
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
    supplier: "Gelo Cristal",
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
    supplier: "Frio Bahia Congelados",
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
    supplier: "Frio Bahia Congelados",
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
    supplier: "Laticínios Jacuípe",
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
    supplier: "Laticínios Jacuípe",
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
// Ruído determinístico por data/produto: o mesmo histórico em toda execução.
function noise(date: string, salt: number) {
  let hash = 2166136261 ^ salt;
  for (const char of date)
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0x5bd1e995);
  hash ^= hash >>> 15;
  return (hash >>> 0) / 4294967296;
}
// Jan a dez: férias fracas, São João e fim de ano fortes.
const monthFactor = [
  0.9, 0.94, 0.97, 0.99, 1, 1.08, 1.03, 1, 1, 1.02, 1.04, 1.16,
];
const specialDays: Record<string, number> = {
  "2025-12-24": 1.6,
  "2025-12-25": 0.55,
  "2025-12-31": 1.5,
  "2026-01-01": 0.5,
  "2026-02-14": 0.88,
  "2026-02-15": 0.85,
  "2026-02-16": 0.82,
  "2026-02-17": 0.82,
  "2026-04-03": 1.2,
  "2026-06-23": 1.35,
  "2026-06-24": 1.3,
};
const retailPlan: Record<
  string,
  { demand: number; target: number; summer?: number; deliveries: number[] }
> = {
  "ground-coffee": { demand: 3, target: 40, deliveries: [1] },
  milk: { demand: 5, target: 34, deliveries: [1, 4] },
  nescau: { demand: 2.4, target: 30, deliveries: [1] },
  "pre-baked": { demand: 3, target: 36, deliveries: [1] },
  ice: { demand: 3.5, target: 46, summer: 2, deliveries: [1, 4] },
  "frozen-strawberry": { demand: 1.5, target: 24, deliveries: [1] },
  "frozen-pizza": { demand: 2.6, target: 34, deliveries: [1] },
  cheese: { demand: 3, target: 32, deliveries: [1, 4] },
  ham: { demand: 2.6, target: 30, deliveries: [1, 4] },
};
// Perfil de cada loja: a Avenida é menor, vende mais lanche e produz coxinha com folga demais.
type StoreProfile = {
  scale: number;
  bakery: number[];
  weekend: number;
  buffer: (index: number, value: number) => number;
  retail: number;
  salt: number;
};
const storeProfiles: Record<string, StoreProfile> = {
  centro: {
    scale: 1,
    bakery: [1, 1, 1, 1, 1],
    weekend: 1.22,
    buffer: (index, value) =>
      index === 1 ? 1.02 + value * 0.08 : 1.06 + value * 0.08,
    retail: 1,
    salt: 0,
  },
  avenida: {
    scale: 0.72,
    bakery: [0.62, 1.12, 1.35, 0.85, 1.25],
    weekend: 1.04,
    buffer: (index, value) =>
      index === 2
        ? 1.16 + value * 0.1
        : index === 1
          ? 1.07 + value * 0.07
          : 1.05 + value * 0.08,
    retail: 0.7,
    salt: 101,
  },
};
function generateStoreRecords(storeId: string): DailyRecord[] {
  const profile = storeProfiles[storeId];
  const centro = storeId === "centro";
  const base = [520, 140, 100, 48, 72];
  const target = (id: string) =>
    Math.max(
      8,
      Math.round(
        (retailPlan[id]?.target ?? 30) * (centro || id === "milk" ? 1 : 0.8),
      ),
    );
  const inventory = new Map(
    products
      .filter((p) => p.operation === "retail")
      .map((p) => [p.id, Math.round(target(p.id) * 0.7)]),
  );
  return Array.from({ length: DEMO_DAYS }, (_, day) => {
    const date = addDays(DEMO_START, day);
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    const month = Number(date.slice(5, 7));
    const summer = month === 12 || month <= 3;
    const season = monthFactor[month - 1] * (specialDays[date] ?? 1);
    const trend = 1 + (0.06 * day) / 365;
    const salt = profile.salt;
    return products.map((product, index): DailyRecord => {
      if (product.operation === "retail") {
        const plan = retailPlan[product.id] ?? {
          demand: 2,
          target: 30,
          deliveries: [1],
        };
        const openingStock = inventory.get(product.id)!;
        const strawberry = product.id === "frozen-strawberry";
        let received = plan.deliveries.includes(weekday)
          ? Math.max(0, target(product.id) - openingStock)
          : 0;
        // Morango só é reposto na temporada; a última compra, em março, sobra no freezer.
        if (strawberry && !(summer || month === 11)) received = 0;
        if (strawberry && date.slice(0, 7) === "2026-03" && received)
          received = Math.max(0, (centro ? 52 : 34) - openingStock);
        // Entrega parcial de leite na última semana deixa o Centro abaixo do mínimo.
        if (centro && product.id === "milk" && date === "2026-09-28")
          received = Math.max(0, 30 - openingStock);
        const produced = openingStock + received;
        const expected =
          plan.demand *
          profile.retail *
          (summer && plan.summer ? plan.summer : 1) *
          (weekday === 0 || weekday === 6 ? 1.3 : 1) *
          season *
          trend;
        const lastSale = centro ? "2026-09-10" : "2026-08-27";
        const demand = strawberry
          ? date > lastSale
            ? 0
            : summer
              ? Math.round(
                  1.5 *
                    profile.retail *
                    (0.4 + noise(date, index * 7 + 3 + salt) * 1.2),
                )
              : date === lastSale || noise(date, index * 7 + 3 + salt) < 0.05
                ? 1
                : 0
          : Math.round(
              expected * (0.55 + noise(date, index * 7 + 3 + salt) * 0.9),
            );
        const sold = Math.min(produced, demand);
        const discarded =
          (product.id === "cheese" || product.id === "ham") &&
          produced > sold &&
          noise(date, index * 13 + 5 + salt) < 0.05
            ? 1
            : 0;
        inventory.set(product.id, produced - sold - discarded);
        return {
          date,
          storeId,
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
      const weekdayFactor =
        weekday === 0 || weekday === 6
          ? profile.weekend
          : weekday === 1
            ? 0.95
            : 1;
      let productFactor = 1;
      if (index === 3 && month === 6)
        productFactor =
          date === "2026-06-23" || date === "2026-06-24" ? 2.5 : 1.9;
      else if (index === 3 && month === 7) productFactor = 1.25;
      const usual =
        base[index] *
        profile.scale *
        profile.bakery[index] *
        weekdayFactor *
        season *
        trend *
        productFactor;
      // A produção de coxinha não acompanha a terça mais fraca: é a sobra que a análise aponta.
      const demandFactor = index === 2 && weekday === 2 ? 0.72 : 1;
      const demand = Math.round(
        usual *
          demandFactor *
          (0.9 + noise(date, index * 17 + 11 + salt) * 0.2),
      );
      const produced = Math.round(
        usual * profile.buffer(index, noise(date, index * 19 + 1 + salt)),
      );
      const sold = Math.min(produced, demand);
      const discarded = Math.round(
        (produced - sold) * (index === 0 ? 0.55 : 0.8),
      );
      return {
        date,
        storeId,
        productId: product.id,
        produced,
        sold,
        discarded,
        stockout:
          sold === produced && demand > produced
            ? index === 1
              ? "16:30"
              : "17:30"
            : "",
        leftoverDestination:
          index === 0 ? ("reuse" as const) : ("donation" as const),
      };
    });
  }).flat();
}
export function generateRecords(): DailyRecord[] {
  return stores.flatMap((store) => generateStoreRecords(store.id));
}
export function validateRecord(record: DailyRecord): string | null {
  if (!stores.some((store) => store.id === record.storeId))
    return "Selecione uma loja.";
  if (!products.some((p) => p.id === record.productId))
    return "Selecione um produto do piloto.";
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(record.date) ||
    !Number.isFinite(Date.parse(`${record.date}T12:00:00Z`)) ||
    new Date(`${record.date}T12:00:00Z`).toISOString().slice(0, 10) !==
      record.date
  )
    return "Informe uma data válida.";
  if (record.date < DEMO_START || record.date > DEMO_END)
    return "Escolha uma data entre 1º de setembro de 2025 e 30 de setembro de 2026, período desta demonstração.";
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
    const key = `${row.storeId}/${row.date}/${row.productId}`;
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
export type Period = { year: number; month: number | null };
const monthNames = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];
const shortMonths = monthNames.map((name) => name.slice(0, 3));
export const DEFAULT_PERIOD: Period = {
  year: Number(DEMO_END.slice(0, 4)),
  month: Number(DEMO_END.slice(5, 7)),
};
const pad = (value: number) => String(value).padStart(2, "0");
function lastDay(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
function rawBounds(period: Period) {
  return period.month === null
    ? { start: `${period.year}-01-01`, end: `${period.year}-12-31` }
    : {
        start: `${period.year}-${pad(period.month)}-01`,
        end: `${period.year}-${pad(period.month)}-${pad(lastDay(period.year, period.month))}`,
      };
}
/** Intervalo do período limitado à base de demonstração. */
export function periodBounds(period: Period) {
  const { start, end } = rawBounds(period);
  return {
    start: start < DEMO_START ? DEMO_START : start,
    end: end > DEMO_END ? DEMO_END : end,
  };
}
export function periodLength(period: Period) {
  const { start, end } = periodBounds(period);
  return Math.max(
    0,
    Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1,
  );
}
export function isPeriodAvailable(period: Period) {
  const { start, end } = rawBounds(period);
  return (
    Number.isInteger(period.year) &&
    (period.month === null ||
      (Number.isInteger(period.month) &&
        period.month >= 1 &&
        period.month <= 12)) &&
    end >= DEMO_START &&
    start <= DEMO_END
  );
}
/** O período inteiro está dentro da base (sem cortes no início ou no fim). */
export function isPeriodComplete(period: Period) {
  const raw = rawBounds(period);
  const clamped = periodBounds(period);
  return raw.start === clamped.start && raw.end === clamped.end;
}
export function previousPeriod(period: Period): Period | null {
  const previous =
    period.month === null
      ? { year: period.year - 1, month: null }
      : period.month === 1
        ? { year: period.year - 1, month: 12 }
        : { year: period.year, month: period.month - 1 };
  return isPeriodAvailable(previous) ? previous : null;
}
export function periodLabel(period: Period) {
  if (period.month !== null)
    return `${monthNames[period.month - 1]} de ${period.year}`;
  if (isPeriodComplete(period)) return String(period.year);
  const { start, end } = periodBounds(period);
  return `${period.year} (${shortMonths[Number(start.slice(5, 7)) - 1]}–${shortMonths[Number(end.slice(5, 7)) - 1]})`;
}
export function monthLabel(month: number, short = false) {
  return (short ? shortMonths : monthNames)[month - 1];
}
export function availableYears() {
  const years: number[] = [];
  for (
    let year = Number(DEMO_START.slice(0, 4));
    year <= Number(DEMO_END.slice(0, 4));
    year++
  )
    years.push(year);
  return years;
}
export function availableMonths(year: number) {
  return Array.from({ length: 12 }, (_, index) => index + 1).filter((month) =>
    isPeriodAvailable({ year, month }),
  );
}
export function periodKey(period: Period) {
  return period.month === null
    ? String(period.year)
    : `${period.year}-${pad(period.month)}`;
}
export function parsePeriod(value: string | null | undefined): Period {
  const match = /^(\d{4})(?:-(\d{2}))?$/.exec(value ?? "");
  if (!match) return DEFAULT_PERIOD;
  const period = {
    year: Number(match[1]),
    month: match[2] ? Number(match[2]) : null,
  };
  return isPeriodAvailable(period) ? period : DEFAULT_PERIOD;
}
export function periodRecords(records: DailyRecord[], period: Period) {
  const { start, end } = periodBounds(period);
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
  const tuesdayDates = new Set(tuesdays.map((r) => r.date)).size;
  const multiStore = storeCount(records) > 1;
  const average = tuesdayDates
    ? Math.round(
        tuesdays.reduce((sum, r) => sum + r.produced - r.sold, 0) /
          tuesdayDates,
      )
    : 0;
  const cheeseDays = new Set(cheese.map((r) => r.date)).size;
  return [
    ...(average > 0
      ? [
          {
            id: "coxinha-tuesday",
            tone: "warning",
            title: "Uma fornada menor na terça?",
            description: `${tuesdayDates === 1 ? "Na única terça registrada, sobraram" : `Nas ${tuesdayDates} terças registradas, sobraram em média`} ${average} coxinhas${multiStore ? ", somando as lojas" : ""}. Considere testar 10% menos, verificando encomendas e faltas.`,
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
            description: `O produto acabou antes do fechamento em ${cheeseDays} ${cheeseDays === 1 ? "dia" : "dias"}${multiStore ? " (em pelo menos uma loja)" : ""}. Avalie uma pequena fornada extra e acompanhe a procura.`,
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
            ? restockDetail(item)
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
/** Texto curto de reposição, apontando a loja quando há mais de uma. */
export function restockDetail(
  item: ReturnType<typeof inventorySummary>[number],
) {
  const low = item.byStore.filter((entry) => entry.status === "Repor estoque");
  const minimum = item.product.minimumStock;
  if (item.byStore.length > 1 && low.length)
    return `${low.map((entry) => `${storeName(entry.storeId)}: ${entry.stock} emb.`).join(" · ")} na última contagem; mínimo ilustrativo de ${minimum} por loja.`;
  return `${item.stock} embalagens na última contagem; mínimo ilustrativo de ${minimum}. Confira o saldo e as compras em andamento antes de repor.`;
}
export function toCsv(records: DailyRecord[]) {
  const rows = [
    [
      "Data",
      "Loja",
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
        storeName(r.storeId),
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
  const existing = new Set(
    state.records.map((row) => `${row.storeId}/${row.productId}`),
  );
  const additions = generateRecords().filter(
    (row) =>
      products.find((p) => p.id === row.productId)?.operation === "retail" &&
      existing.has(`${row.storeId}/french-bread`) &&
      !existing.has(`${row.storeId}/${row.productId}`),
  );
  return additions.length
    ? { ...state, records: [...state.records, ...additions] }
    : state;
}

/**
 * Estoque de revenda na data final. Cada loja usa a própria última contagem;
 * com mais de uma loja, os saldos são somados e a situação reflete a pior loja.
 */
export function inventorySummary(
  records: DailyRecord[],
  endDate = DEMO_END,
  days = 7,
) {
  const startDate = addDays(endDate, -(days - 1));
  return products
    .filter((p) => p.operation === "retail")
    .map((product) => {
      const history = records
        .filter((r) => r.productId === product.id && r.date <= endDate)
        .sort((a, b) => a.date.localeCompare(b.date));
      const storeIds = [...new Set(history.map((r) => r.storeId))].sort(
        (a, b) =>
          stores.findIndex((store) => store.id === a) -
          stores.findIndex((store) => store.id === b),
      );
      const byStore = storeIds.map((storeId) => {
        const own = history.filter((r) => r.storeId === storeId);
        const latest = own.at(-1)!;
        const lastSale = own.filter((r) => r.sold > 0).at(-1);
        const stock = latest.produced - latest.sold - latest.discarded;
        const window = own.filter((r) => r.date >= startDate);
        const averageSales = window.length
          ? window.reduce((sum, r) => sum + r.sold, 0) / window.length
          : 0;
        const daysWithoutSale = lastSale
          ? Math.round(
              (Date.parse(endDate) - Date.parse(lastSale.date)) / 86400000,
            )
          : null;
        const status =
          stock <= product.minimumStock!
            ? "Repor estoque"
            : daysWithoutSale !== null && daysWithoutSale >= 14
              ? "Sem giro recente"
              : "Em equilíbrio";
        return {
          storeId,
          stock,
          recordedDate: latest.date,
          lastSaleDate: lastSale?.date ?? null,
          daysWithoutSale,
          averageSales,
          status,
        };
      });
      if (!byStore.length)
        return {
          product,
          stock: null,
          recordedDate: null,
          lastSaleDate: null,
          daysWithoutSale: null,
          coverageDays: null,
          stockAtCost: 0,
          status: "Sem registro",
          byStore,
        };
      const stock = byStore.reduce((sum, item) => sum + item.stock, 0);
      const averageSales = byStore.reduce(
        (sum, item) => sum + item.averageSales,
        0,
      );
      const lastSaleDate =
        byStore
          .map((item) => item.lastSaleDate)
          .filter((date): date is string => date !== null)
          .sort()
          .at(-1) ?? null;
      const daysWithoutSale = lastSaleDate
        ? Math.round(
            (Date.parse(endDate) - Date.parse(lastSaleDate)) / 86400000,
          )
        : null;
      // A situação mais urgente entre as lojas define a linha consolidada.
      const status = byStore.some((item) => item.status === "Repor estoque")
        ? "Repor estoque"
        : byStore.every((item) => item.status === "Sem giro recente")
          ? "Sem giro recente"
          : "Em equilíbrio";
      return {
        product,
        stock,
        // Data da contagem mais antiga entre as lojas, para não esconder contagem atrasada.
        recordedDate: byStore.map((item) => item.recordedDate).sort()[0],
        lastSaleDate,
        daysWithoutSale,
        coverageDays: averageSales
          ? Math.round((stock / averageSales) * 10) / 10
          : null,
        stockAtCost: stock * product.cost,
        status,
        byStore,
      };
    });
}

export type StockAlertLevel = "out" | "critical" | "warning";
export const stockAlertLabels: Record<StockAlertLevel, string> = {
  out: "Esgotado",
  critical: "Abaixo do mínimo",
  warning: "Perto do mínimo",
};
/** Até 50% acima do mínimo a mercadoria já aparece como "perto do mínimo". */
export const STOCK_WARNING_FACTOR = 1.5;
const alertRank: Record<StockAlertLevel, number> = {
  out: 0,
  critical: 1,
  warning: 2,
};

/** Nível de alerta de um saldo. "Abaixo do mínimo" coincide com "Repor estoque". */
export function stockAlertLevel(
  stock: number,
  minimum: number,
): StockAlertLevel | null {
  if (stock <= 0) return "out";
  if (stock <= minimum) return "critical";
  if (stock <= minimum * STOCK_WARNING_FACTOR) return "warning";
  return null;
}

/** Mercadorias de revenda quase acabando, por loja, da mais urgente para a menos. */
export function stockAlerts(
  records: DailyRecord[],
  endDate = DEMO_END,
  days = 7,
) {
  return inventorySummary(records, endDate, days)
    .flatMap((item) =>
      item.byStore.flatMap((entry) => {
        const minimum = item.product.minimumStock!;
        const level = stockAlertLevel(entry.stock, minimum);
        if (!level) return [];
        return [
          {
            key: `${entry.storeId}:${item.product.id}`,
            storeId: entry.storeId,
            product: item.product,
            stock: entry.stock,
            minimum,
            averageSales: entry.averageSales,
            coverageDays: entry.averageSales
              ? Math.round((entry.stock / entry.averageSales) * 10) / 10
              : null,
            recordedDate: entry.recordedDate,
            level,
          },
        ];
      }),
    )
    .sort(
      (a, b) =>
        alertRank[a.level] - alertRank[b.level] ||
        (a.coverageDays ?? Infinity) - (b.coverageDays ?? Infinity) ||
        a.stock / a.minimum - b.stock / b.minimum,
    );
}

/** Última contagem de uma mercadoria em uma loja (a que define o estoque atual). */
export function latestStockRecord(
  records: DailyRecord[],
  storeId: string,
  productId: string,
) {
  return records
    .filter((row) => row.storeId === storeId && row.productId === productId)
    .reduce<DailyRecord | undefined>(
      (latest, row) => (!latest || row.date > latest.date ? row : latest),
      undefined,
    );
}

/**
 * Venda simulada de uma mercadoria de revenda: soma a quantidade às vendas da
 * última contagem da loja, reduzindo o estoque final. Não altera dias anteriores.
 */
export function simulateSale(
  records: DailyRecord[],
  sale: { storeId: string; productId: string; quantity: number },
) {
  const product = products.find((p) => p.id === sale.productId);
  if (!product || product.operation !== "retail")
    throw new Error("Escolha uma mercadoria de revenda.");
  if (!stores.some((store) => store.id === sale.storeId))
    throw new Error("Selecione uma loja.");
  const latest = latestStockRecord(records, sale.storeId, sale.productId);
  if (!latest)
    throw new Error("Esta mercadoria ainda não tem contagem nesta loja.");
  const available = latest.produced - latest.sold - latest.discarded;
  if (available <= 0)
    throw new Error(
      `${product.name} está esgotado na ${storeName(sale.storeId)}. Registre uma entrada antes de vender.`,
    );
  if (!Number.isSafeInteger(sale.quantity) || sale.quantity < 1)
    throw new Error("Informe uma quantidade inteira a partir de 1.");
  if (sale.quantity > available)
    throw new Error(
      `Há ${number(available)} ${product.unit} em estoque. Venda até essa quantidade.`,
    );
  const updated: DailyRecord = { ...latest, sold: latest.sold + sale.quantity };
  const issue = validateRecord(updated);
  if (issue) throw new Error(issue);
  return {
    records: records.map((row) => (row === latest ? updated : row)),
    previous: latest,
    updated,
    product,
    stock: available - sale.quantity,
  };
}
