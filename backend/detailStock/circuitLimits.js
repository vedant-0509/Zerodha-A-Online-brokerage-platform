function normalizeCircuitValue(value, fallback = null) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function validCircuitLimit(value) {
  return normalizeCircuitValue(value) !== null;
}

function firstCircuitLimit(...values) {
  for (const value of values) {
    const number = normalizeCircuitValue(value);
    if (number !== null) {
      return number;
    }
  }

  return null;
}

function withCircuitLimits(snapshot, quote = null, context = null, previous = null) {
  const row = context?.marketRow || {};

  const upperCircuit = firstCircuitLimit(
    quote?.upperCircuit,
    quote?.upperCircuitLimit,
    quote?.upper_circuit,
    quote?.upper_circuit_limit,
    snapshot?.upperCircuit,
    snapshot?.upperCircuitLimit,
    snapshot?.upper_circuit,
    snapshot?.upper_circuit_limit,
    previous?.upperCircuit,
    previous?.upperCircuitLimit,
    previous?.upper_circuit,
    previous?.upper_circuit_limit,
    row.upperCircuit,
    row.upperCircuitLimit,
    row.upper_circuit,
    row.upper_circuit_limit,
  );

  const lowerCircuit = firstCircuitLimit(
    quote?.lowerCircuit,
    quote?.lowerCircuitLimit,
    quote?.lower_circuit,
    quote?.lower_circuit_limit,
    snapshot?.lowerCircuit,
    snapshot?.lowerCircuitLimit,
    snapshot?.lower_circuit,
    snapshot?.lower_circuit_limit,
    previous?.lowerCircuit,
    previous?.lowerCircuitLimit,
    previous?.lower_circuit,
    previous?.lower_circuit_limit,
    row.lowerCircuit,
    row.lowerCircuitLimit,
    row.lower_circuit,
    row.lower_circuit_limit,
  );

  return {
    ...snapshot,
    upperCircuit,
    upperCircuitLimit: upperCircuit,
    lowerCircuit,
    lowerCircuitLimit: lowerCircuit,
  };
}

module.exports = {
  normalizeCircuitValue,
  validCircuitLimit,
  withCircuitLimits,
};
