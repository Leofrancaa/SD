import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addDays,
  DEMO_END,
  generateRecords,
  inventorySummary,
  periodRecords,
  products,
  summarize,
} from "../src/lib/demo";
import { ownerSummary, purchaseCsv, purchasePlan } from "../src/lib/operations";

const records = generateRecords();

test("purchase plan uses the latest snapshot, daily demand, safety stock and acquisition cost", () => {
  const milk = purchasePlan(records, 7).find(
    (item) => item.product.id === "milk",
  )!;
  const history = records.filter(
    (row) => row.productId === "milk" && row.date >= addDays(DEMO_END, -27),
  );
  assert.equal(history.length, 28);
  const average =
    history.reduce((sum, row) => sum + row.sold, 0) / history.length;
  const last = history.at(-1)!;
  const stock = last.produced - last.sold - last.discarded;
  assert.equal(milk.stock, stock);
  assert.ok(stock < milk.product.minimumStock!);
  assert.equal(milk.averageDailySales, average);
  assert.equal(
    milk.quantity,
    Math.ceil(average * 7 + milk.product.minimumStock! - stock),
  );
  assert.equal(milk.estimatedCost, milk.quantity * milk.product.cost);
  assert.equal(
    purchasePlan(records, 7).find(
      (item) => item.product.id === "frozen-strawberry",
    )!.quantity,
    0,
  );
  assert.ok(
    purchasePlan(records, 14).find((item) => item.product.id === "milk")!
      .quantity > milk.quantity,
  );
  assert.throws(() => purchasePlan(records, 10));
});

test("purchase plan does not infer demand or replenish with stale or missing stock counts", () => {
  const stale = records.filter(
    (row) => !(row.productId === "milk" && row.date === DEMO_END),
  );
  const milk = purchasePlan(stale, 7).find(
    (item) => item.product.id === "milk",
  )!;
  assert.equal(milk.stale, true);
  assert.equal(milk.quantity, 0);
  assert.ok(
    purchasePlan([], 7).every(
      (item) => item.quantity === 0 && item.stock === null,
    ),
  );
});

test("owner summary keeps estimated return, idle capital and discarded losses separate", () => {
  const september = { year: 2026, month: 9 };
  const summary = ownerSummary(records, september);
  const totals = summarize(periodRecords(records, september));
  assert.equal(
    summary.estimatedReturn,
    totals.revenue - totals.cost - totals.loss,
  );
  assert.equal(summary.coveragePercent, 100);
  assert.equal(summary.recordedDates, 30);
  assert.equal(summary.idleStock[0].product.id, "frozen-strawberry");
  const strawberry = inventorySummary(records).find(
    (item) => item.product.id === "frozen-strawberry",
  )!;
  assert.equal(summary.idleStockAtCost, strawberry.stock! * 17);
  assert.ok(summary.bestReturn);
  assert.ok(summary.largestLoss);
  assert.equal(ownerSummary([], september).coveragePercent, 0);
  assert.equal(ownerSummary([], september).estimatedReturn, 0);
});

test("comparisons require complete matched periods and do not manufacture a monthly baseline", () => {
  const september = { year: 2026, month: 9 };
  assert.ok(ownerSummary(records, september).previous);
  assert.ok(ownerSummary(records, { year: 2025, month: 10 }).previous);
  // Primeiro mês da base e anos parciais não têm base de comparação.
  assert.equal(ownerSummary(records, { year: 2025, month: 9 }).previous, null);
  assert.equal(
    ownerSummary(records, { year: 2026, month: null }).previous,
    null,
  );
  assert.equal(
    ownerSummary(
      records.filter(
        (row) => !(row.date === "2026-08-28" && row.productId === "milk"),
      ),
      september,
    ).previous,
    null,
  );
  assert.equal(
    ownerSummary(
      records.filter((row) => row.productId !== "milk"),
      september,
    ).previous,
    null,
  );
});

test("purchase CSV exports reviewed quantities with the simulation and draft boundary", () => {
  const rows = [
    {
      product: products.find((product) => product.id === "milk")!,
      stock: 14,
      quantity: 12,
    },
  ];
  const csv = purchaseCsv(rows, 7);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes("Dados simulados"));
  assert.ok(csv.includes("não é um pedido"));
  assert.ok(csv.includes('"14";"12";"emb.";"4.70";"56.40"'));
});
