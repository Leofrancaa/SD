import assert from "node:assert/strict";
import { test } from "node:test";
import {
  generateRecords,
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
test("synthetic history is deterministic and conserves every batch", () => {
  assert.deepEqual(records, generateRecords());
  assert.equal(records.length, 150);
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
  assert.equal(periodRecords(records, 7).length, 35);
  assert.equal(periodRecords(records, 14, 14).length, 70);
  assert.equal(periodRecords(records, 30).length, 150);
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
