import React from "react";
import { ErrorBoundary } from "../common/ErrorBoundary";

export function ShareholdingSection({ isin, shareholdingPeriods, selectedShareholdingPeriod, setSelectedShareholdingPeriod, selectedShareholding }) {
  return (
    <ErrorBoundary resetKey={isin}>
      <section className="content-section">
        <div className="section-heading">
          <h2>Shareholding Pattern</h2>
        </div>

        <div className="shareholding-card">
          {shareholdingPeriods.length > 0 && (
            <div className="shareholding-periods">
              {shareholdingPeriods.map((period) => (
                <button
                  key={period}
                  className={selectedShareholdingPeriod === period ? "active" : ""}
                  onClick={() => setSelectedShareholdingPeriod(period)}
                >
                  {period}
                </button>
              ))}
            </div>
          )}

          <div className="shareholding-list">
            {selectedShareholding.length > 0 ? (
              selectedShareholding.map((item) => (
                <div className="shareholding-row" key={item.key}>
                  <div className="shareholding-label">
                    <span>{item.label}</span>
                    <p style={{ color: "black", margin: 0, fontWeight: 500, fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}>
                      {item.percentage.toFixed(2)}%
                      {item.change !== null && Math.abs(item.change) >= 0.01 && (
                        <span style={{ fontSize: 12, fontWeight: 600, color: item.change > 0 ? "#00b28e" : "#e5484d" }}>
                          {item.change > 0 ? "▲" : "▼"} {Math.abs(item.change).toFixed(2)}%
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="shareholding-bar">
                    <div style={{ width: `${Math.min(100, Math.max(0, item.percentage))}%` }} />
                  </div>
                </div>
              ))
            ) : (
              <div>Shareholding data unavailable</div>
            )}
          </div>
        </div>
      </section>
    </ErrorBoundary>
  );
}