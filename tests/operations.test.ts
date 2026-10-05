import assert from "node:assert/strict";
import { test } from "node:test";
import {
  generateRecords,
  periodRecords,
  products,
  summarize,
} from "../src/lib/demo";
import { ownerSummary, purchaseCsv, purchasePlan } from "../src/lib/operations";

const records = generateRecords();

test("purchase plan uses the latest snapshot, daily demand, safety stock and acquisition cost", () => {
  const milk = purchasePlan(records, 7, 7).find(
    (item) => item.product.id === "milk",
  )!;
  const history = periodRecords(records, 7).filter(
    (row) => row.productId === "milk",
  );
  const average =
    history.reduce((sum, row) => sum + row.sold, 0) / history.length;
  assert.equal(milk.stock, 14);
  assert.equal(milk.averageDailySales, average);
  assert.equal(
    milk.quantity,
    Math.ceil(average * 7 + milk.product.minimumStock! - 14),
  );
  assert.equal(milk.estimatedCost, milk.quantity * milk.product.cost);
  assert.equal(
    purchasePlan(records, 7).find(
      (item) => item.product.id === "frozen-strawberry",
    )!.quantity,
    0,
  );
  assert.ok(
    purchasePlan(records, 7, 14).find((item) => item.product.id === "milk")!
      .quantity > milk.quantity,
  );
  assert.throws(() => purchasePlan(records, 7, 10));
});

test("purchase plan does not infer demand or replenish with stale or missing stock counts", () => {
  const stale = records.filter(
    (row) => !(row.productId === "milk" && row.date === "2026-10-05"),
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
  const summary = ownerSummary(records, 7);
  const totals = summarize(periodRecords(records, 7));
  assert.equal(
    summary.estimatedReturn,
    totals.revenue - totals.cost - totals.loss,
  );
  assert.equal(summary.coveragePercent, 100);
  assert.equal(summary.recordedDates, 7);
  assert.equal(summary.idleStock[0].product.id, "frozen-strawberry");
  assert.equal(summary.idleStockAtCost, 30 * 17);
  assert.ok(summary.bestReturn);
  assert.ok(summary.largestLoss);
  assert.equal(ownerSummary([], 7).coveragePercent, 0);
  assert.equal(ownerSummary([], 7).estimatedReturn, 0);
});

test("comparisons require complete matched periods and do not manufacture a monthly baseline", () => {
  assert.ok(ownerSummary(records, 7).previous);
  assert.ok(ownerSummary(records, 14).previous);
  assert.equal(ownerSummary(records, 30).previous, null);
  assert.equal(
    ownerSummary(
      records.filter(
        (row) => !(row.date === "2026-09-28" && row.productId === "milk"),
      ),
      7,
    ).previous,
    null,
  );
  assert.equal(
    ownerSummary(
      records.filter((row) => row.productId !== "milk"),
      7,
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
