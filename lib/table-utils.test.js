const test = require("node:test");
const assert = require("node:assert/strict");

const { getStableRowId } = require("./table-utils");

test("falls back to a unique index-based id when row data has no id", () => {
  const first = getStableRowId({ name: "Alpha" }, 0);
  const second = getStableRowId({ name: "Beta" }, 1);

  assert.equal(first, "row-0");
  assert.equal(second, "row-1");
  assert.notEqual(first, second);
});

test("uses the row id when present and keeps it unique", () => {
  const first = getStableRowId({ id: "customer-1" }, 0);
  const second = getStableRowId({ id: "customer-1" }, 1);

  assert.equal(first, "customer-1-0");
  assert.equal(second, "customer-1-1");
  assert.notEqual(first, second);
});

test("falls back when a row id resolves to undefined or empty", () => {
  const first = getStableRowId({ id: undefined }, 0);
  const second = getStableRowId({ id: "" }, 1);

  assert.equal(first, "row-0");
  assert.equal(second, "row-1");
  assert.notEqual(first, second);
});

test("treats the literal string 'undefined' as an invalid key source", () => {
  const id = getStableRowId({ id: "undefined" }, 2);

  assert.equal(id, "row-2");
});
