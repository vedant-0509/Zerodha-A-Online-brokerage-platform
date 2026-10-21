const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeCircuitValue,
  validCircuitLimit,
  withCircuitLimits,
} = require("../detailStock/circuitLimits");

test("missing and invalid circuit limits are not converted to zero", () => {
  for (const value of [null, undefined, "", 0, "0", "not-a-number", Infinity]) {
    assert.equal(validCircuitLimit(value), false, `expected ${String(value)} to be invalid`);
  }
});

test("positive numeric and numeric-string circuit limits are accepted", () => {
  assert.equal(validCircuitLimit(125.5), true);
  assert.equal(validCircuitLimit("125.5"), true);
});

test("provider parser never turns absent or zero circuit fields into zero", () => {
  assert.equal(normalizeCircuitValue(null), null);
  assert.equal(normalizeCircuitValue(""), null);
  assert.equal(normalizeCircuitValue(0), null);
  assert.equal(normalizeCircuitValue("0"), null);
  assert.equal(normalizeCircuitValue("132.75"), 132.75);
});

test("fresh provider circuit values take priority over cached values", () => {
  const result = withCircuitLimits(
    { price: 100, upperCircuit: 120, lowerCircuit: 80 },
    { upperCircuit: "130", lowerCircuit: "70" },
  );

  assert.equal(result.upperCircuit, 130);
  assert.equal(result.upperCircuitLimit, 130);
  assert.equal(result.lowerCircuit, 70);
  assert.equal(result.lowerCircuitLimit, 70);
});

test("missing provider values fall back to valid stored values, not zero", () => {
  const result = withCircuitLimits(
    { price: 100, upperCircuit: 0, upperCircuitLimit: 125, lowerCircuit: null },
    { upperCircuit: null, lowerCircuit: "" },
    null,
    { lowerCircuitLimit: "75" },
  );

  assert.equal(result.upperCircuit, 125);
  assert.equal(result.lowerCircuit, 75);
  assert.equal(result.upperCircuitLimit, 125);
  assert.equal(result.lowerCircuitLimit, 75);
});

test("missing provider and stored circuit values stay null", () => {
  const result = withCircuitLimits({ price: 100 }, {});
  assert.equal(result.upperCircuit, null);
  assert.equal(result.upperCircuitLimit, null);
  assert.equal(result.lowerCircuit, null);
  assert.equal(result.lowerCircuitLimit, null);
});

test("snake_case aliases on stored market rows are supported", () => {
  const result = withCircuitLimits(
    { price: 100 },
    null,
    { marketRow: { upper_circuit_limit: 120, lower_circuit: 80 } },
  );

  assert.equal(result.upperCircuit, 120);
  assert.equal(result.lowerCircuit, 80);
});
