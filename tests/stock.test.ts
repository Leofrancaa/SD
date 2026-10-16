import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEMO_END,
  generateRecords,
  inventorySummary,
  latestStockRecord,
  simulateSale,
  stockAlertLevel,
  stockAlerts,
} from "../src/lib/demo";

const records = generateRecords();

test("stock alert levels follow the minimum and the warning margin", () => {
  assert.equal(stockAlertLevel(0, 12), "out");
  assert.equal(stockAlertLevel(12, 12), "critical");
  assert.equal(stockAlertLevel(18, 12), "warning");
  assert.equal(stockAlertLevel(19, 12), null);
});

test("alerts list low stock per store, most urgent first, matching Repor estoque", () => {
  const alerts = stockAlerts(records, DEMO_END, 30);
  assert.ok(alerts.length > 0);
  const ranks = { out: 0, critical: 1, warning: 2 } as const;
  for (let i = 1; i < alerts.length; i++)
    assert.ok(ranks[alerts[i - 1].level] <= ranks[alerts[i].level]);
  const restock = inventorySummary(records, DEMO_END, 30).flatMap((item) =>
    item.byStore
      .filter((entry) => entry.status === "Repor estoque")
      .map((entry) => `${entry.storeId}:${item.product.id}`),
  );
  const critical = alerts
    .filter((item) => item.level !== "warning")
    .map((item) => item.key);
  assert.deepEqual([...critical].sort(), [...restock].sort());
});

test("a simulated sale lowers only the latest count and can push an item into the alerts", () => {
  const before = latestStockRecord(records, "avenida", "cheese")!;
  const stock = before.produced - before.sold - before.discarded;
  const minimum = 12;
  const quantity = stock - minimum;
  assert.ok(quantity > 0);
  const result = simulateSale(records, {
    storeId: "avenida",
    productId: "cheese",
    quantity,
  });
  assert.equal(result.stock, minimum);
  assert.equal(result.updated.sold, before.sold + quantity);
  assert.equal(result.updated.date, before.date);
  assert.equal(result.records.length, records.length);
  assert.equal(
    result.records.filter((row, index) => row !== records[index]).length,
    1,
  );
  const alert = stockAlerts(result.records, DEMO_END, 30).find(
    (item) => item.key === "avenida:cheese",
  );
  assert.equal(alert?.level, "critical");
  assert.equal(alert?.stock, minimum);
});

test("a simulated sale rejects invalid quantities and non-retail products", () => {
  const latest = latestStockRecord(records, "centro", "milk")!;
  const stock = latest.produced - latest.sold - latest.discarded;
  assert.throws(
    () =>
      simulateSale(records, {
        storeId: "centro",
        productId: "milk",
        quantity: stock + 1,
      }),
    /em estoque/,
  );
  assert.throws(
    () =>
      simulateSale(records, {
        storeId: "centro",
        productId: "milk",
        quantity: 1.5,
      }),
    /inteira/,
  );
  assert.throws(
    () =>
      simulateSale(records, {
        storeId: "centro",
        productId: "french-bread",
        quantity: 1,
      }),
    /revenda/,
  );
  const empty = simulateSale(records, {
    storeId: "centro",
    productId: "milk",
    quantity: stock,
  });
  assert.equal(empty.stock, 0);
  assert.equal(
    stockAlerts(empty.records, DEMO_END, 30).find(
      (item) => item.key === "centro:milk",
    )?.level,
    "out",
  );
  assert.throws(
    () =>
      simulateSale(empty.records, {
        storeId: "centro",
        productId: "milk",
        quantity: 1,
      }),
    /esgotado/,
  );
});
