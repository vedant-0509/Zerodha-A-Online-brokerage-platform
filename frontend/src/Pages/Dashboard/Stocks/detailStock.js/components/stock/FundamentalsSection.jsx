import React from "react";
import { formatNumber } from "../../utils/formatters";

export function FundamentalsSection({ loading, error, fundamentals }) {
  return (
    <section className="content-section">
      <div className="section-heading">
        <h2>Fundamentals</h2>
      </div>

      <div className="fundamentals-card">
        {loading && <div>Loading fundamentals…</div>}
        {!loading && error && <div>Unable to load fundamentals: {error}</div>}
        {!loading && !error && fundamentals.map(([label, value]) => (
          <div className="fundamental-row" key={label}>
            <span>{label}</span>
            <p>
              {value !== null && value !== undefined && value !== ""
                ? typeof value === "number" ? formatNumber(value) : value
                : "N/A"}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}