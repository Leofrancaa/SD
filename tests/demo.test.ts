import assert from "node:assert/strict";
import { test } from "node:test";
import {
  productionOutcomes,
  rankProducts,
  weekdayAverages,
} from "../src/lib/analytics";
import {
  generateRecords,
  extendCatalog,
  inventorySummary,
  parseState,
  periodRecords,
  products,
  recommendations,
  summarize,
  toCsv,
  validateRecord,
  type DailyRecord,
} from "../src/lib/demo";

const records = generateRecords();
test("weekday averages normalize repeated weekdays and exclude missing days", () => {
  const row = {
    ...records[0],
    productId: products[0].id,
    produced: 100,
    sold: 10,
    discarded: 0,
    stockout: "",
  };
  const averages = weekdayAverages([
    { ...row, date: "2026-09-07" },
    { ...row, date: "2026-09-14", sold: 30 },
    { ...row, date: "2026-09-08", sold: 25 },
  ]);
  assert.equal(averages[0].days, 2);
  assert.equal(averages[0].average, 20 * products[0].price);
  assert.equal(averages[1].average, 25 * products[0].price);
  assert.equal(averages[2].days, 0);
});
test("product ranking distinguishes volume from revenue and retains negative returns", () => {
  const rows = [
    {
      ...records[0],
      productId: products[0].id,
      produced: 100,
      sold: 100,
      discarded: 0,
      stockout: "",
    },
    {
      ...records[0],
      productId: products[2].id,
      produced: 30,
      sold: 30,
      discarded: 0,
      stockout: "",
    },
  ];
  assert.equal(rankProducts(rows, "sold")[0].product.id, products[0].id);
  assert.equal(rankProducts(rows, "revenue")[0].product.id, products[2].id);
  const negative = rankProducts(
    [{ ...rows[0], sold: 0, discarded: 100 }],
    "return",
  ).find((item) => item.product.id === products[0].id)!;
  assert.equal(negative.return, -100 * products[0].cost);
  const outcomes = productionOutcomes(records);
  assert.equal(
    outcomes.sold + outcomes.retained + outcomes.discarded,
    outcomes.produced,
  );
  assert.equal(productionOutcomes([]).produced, 0);
});
test("synthetic history is deterministic and conserves every batch", () => {
  assert.deepEqual(records, generateRecords());
  assert.equal(records.length, products.length * 30);
  assert.equal(new Set(records.map((r) => r.date)).size, 30);
  for (const row of records) assert.equal(validateRecord(row), null);
});
test("loss uses discarded units at cost, not leftovers at selling price", () => {
  const row = {
    ...records[0],
    produced: 100,
    sold: 70,
    discarded: 10,
    stockout: "",
  };
  const totals = summarize([row]);
  const product = products[0];
  assert.equal(totals.loss, 10 * product.cost);
  assert.equal(totals.revenue, 70 * product.price);
  assert.equal(totals.leftover, 30);
  assert.equal(totals.discarded, 10);
});
test("rejects impossible batches, malformed dates and incompatible stockouts", () => {
  const row: DailyRecord = {
    ...records[0],
    produced: 100,
    sold: 70,
    discarded: 10,
    stockout: "",
  };
  for (const override of [
    { sold: 101 },
    { discarded: 31 },
    { produced: -1 },
    { produced: 2.5 },
    { stockout: "17:30" },
    { date: "2026-09-31" },
    { date: "2026-10-06" },
    { stockout: "25:00" },
  ])
    assert.ok(validateRecord({ ...row, ...override }));
  assert.equal(
    validateRecord({
      ...row,
      produced: 70,
      sold: 70,
      discarded: 0,
      stockout: "17:30",
    }),
    null,
  );
});
test("date filters preserve complete ranges and do not silently compare partial months", () => {
  assert.equal(periodRecords(records, 7).length, products.length * 7);
  assert.equal(periodRecords(records, 14, 14).length, products.length * 14);
  assert.equal(periodRecords(records, 30).length, products.length * 30);
});
test("stored data rejects corrupt schema and duplicate product/date keys", () => {
  const state = { version: 1, records, decisions: {} };
  assert.deepEqual(parseState(JSON.stringify(state)), state);
  assert.throws(() => parseState(JSON.stringify({ ...state, version: 2 })));
  assert.throws(() =>
    parseState(JSON.stringify({ ...state, records: [records[0], records[0]] })),
  );
  assert.throws(() =>
    parseState(JSON.stringify({ ...state, decisions: { test: "invalid" } })),
  );
});
test("suggestions derive shortage and waste claims from the selected records", () => {
  assert.equal(recommendations([]).length, 0);
  const items = recommendations(records);
  assert.ok(items.find((r) => r.id === "coxinha-tuesday"));
  assert.ok(items.find((r) => r.id === "cheese-stockout"));
});
test("CSV includes BOM and separately exports remaining and discarded units", () => {
  const csv = toCsv([
    { ...records[0], produced: 100, sold: 70, discarded: 10 },
  ]);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"100";"70";"30";"10";"20"'));
  assert.ok(csv.includes("Perda ao custo"));
  assert.ok(csv.includes("Destino da sobra não descartada"));
});

test("retail stocks carry forward, use one closing snapshot and preserve legacy edits", () => {
  const retail = products.filter((p) => p.operation === "retail");
  for (const product of retail) {
    const history = records.filter((r) => r.productId === product.id);
    for (let day = 1; day < history.length; day++)
      assert.equal(
        history[day].openingStock,
        history[day - 1].produced -
          history[day - 1].sold -
          history[day - 1].discarded,
      );
    const item = inventorySummary(records).find(
      (item) => item.product.id === product.id,
    )!;
    const last = history.at(-1)!;
    assert.equal(item.stock, last.produced - last.sold - last.discarded);
    assert.equal(item.stockAtCost, item.stock! * product.cost);
    assert.ok(validateRecord({ ...last, received: last.received! + 1 }));
  }
  const bakery = records.filter(
    (r) => !products.find((p) => p.id === r.productId)?.operation,
  );
  bakery[0] = { ...bakery[0], sold: 1, discarded: 0, stockout: "" };
  const state = {
    version: 1 as const,
    records: bakery,
    decisions: { test: "approved" as const },
  };
  const upgraded = extendCatalog(state);
  assert.deepEqual(upgraded.records[0], bakery[0]);
  assert.deepEqual(upgraded.decisions, state.decisions);
  assert.equal(upgraded.records.length, products.length * 30);
  assert.equal(extendCatalog(upgraded), upgraded);
  const outcomes = productionOutcomes(records);
  assert.equal(outcomes.produced, summarize(bakery).produced);
  const strawberry = inventorySummary(records).find(
    (item) => item.product.id === "frozen-strawberry",
  )!;
  assert.equal(strawberry.daysWithoutSale, 25);
  assert.equal(strawberry.status, "Sem giro recente");
});
