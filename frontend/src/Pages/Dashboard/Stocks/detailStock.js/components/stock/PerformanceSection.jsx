import React from "react";
import { formatCurrency, formatCompact } from "../../utils/formatters";

export function PerformanceSection({ low, high, ltp, calculated52WeekLow, calculated52WeekHigh, getRangePosition, open, previousClose, volume, upperCircuit, lowerCircuit }) {
  return (
    <section className="content-section">
      <div className="section-heading">
        <h2>Performance</h2>
      </div>

      <div className="performance-card">
        <div className="range-block">
          <div className="range-title">
            <p>Today's low</p>
            <p>Today's high</p>
          </div>
          <div className="range-values">
            <p>{low !== null ? formatCurrency(low) : "—"}</p>
            <p>{high !== null ? formatCurrency(high) : "—"}</p>
          </div>
          <div className="range-line">
            <div className="range-marker" style={{ left: getRangePosition(ltp, low, high) }} />
          </div>
        </div>

        <div className="range-block">
          <div className="range-title">
            <p>52 week low</p>
            <p>52 week high</p>
          </div>
          <div className="range-values">
            <p>{calculated52WeekLow !== null ? formatCurrency(calculated52WeekLow) : "—"}</p>
            <p>{calculated52WeekHigh !== null ? formatCurrency(calculated52WeekHigh) : "—"}</p>
          </div>
          <div className="range-line">
            <div className="range-marker" style={{ left: getRangePosition(ltp, calculated52WeekLow, calculated52WeekHigh) }} />
          </div>
        </div>

        <div className="performance-stats">
          <div><span>Open price</span><p>{open !== null ? formatCurrency(open) : "—"}</p></div>
          <div><span>Previous close</span><p>{previousClose !== null ? formatCurrency(previousClose) : "—"}</p></div>
          <div><span>Live volume</span><p>{volume !== null ? formatCompact(volume) : "—"}</p></div>
          <div><span>Upper circuit</span><p>{upperCircuit !== null ? formatCurrency(upperCircuit) : "—"}</p></div>
          <div><span>Lower circuit</span><p>{lowerCircuit !== null ? formatCurrency(lowerCircuit) : "—"}</p></div>
        </div>
      </div>
    </section>
  );
}