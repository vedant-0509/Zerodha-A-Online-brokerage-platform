import React from "react";
import { ErrorBoundary } from "../common/ErrorBoundary";
import { formatNumber } from "../../utils/formatters";

export function FinancialsSection({ isin, financialBarData, maxFinancialValue, getFinancialNumber }) {
  return (
    <ErrorBoundary resetKey={isin}>
      {(() => {
        const safeData = Array.isArray(financialBarData) ? financialBarData : [];
        const hasData = safeData.length > 0;
        const latestItem = hasData ? safeData[safeData.length - 1] : null;
        const prevItem = safeData.length > 1 ? safeData[safeData.length - 2] : null;

        const getQuarter = (item) => item?.quarter || item?.period || item?.Quarter || item?.quarterName || item?.quarter_name || item?.date || item?.label || "—";
        const getRevenue = (item) => getFinancialNumber(item?.revenue, item?.Revenue, item?.total_revenue, item?.totalRevenue, item?.sales, item?.income) ?? 0;
        const getProfit = (item) => getFinancialNumber(item?.profit, item?.Profit, item?.net_profit, item?.netProfit, item?.pat, item?.profitAfterTax) ?? 0;

        const autoMax = Math.max(...safeData.flatMap((d) => [getRevenue(d), getProfit(d)]), 1);
        const safeMaxVal = maxFinancialValue && !isNaN(maxFinancialValue) && maxFinancialValue > 0 ? maxFinancialValue : autoMax;

        return (
          <section className="content-section">
            <div className="section-heading">
              <h2>Financial performance</h2>
            </div>

            <div className="chart-card">
              <header className="chart-header">
                <div className="header-date">{getQuarter(latestItem)}</div>
                <div className="legend-row">
                  <div className="legend-group">
                    <div className="legend-title">
                      <span className="legend-badge bg-bar-revenue" />
                      <span className="legend-label">Revenue (CR)</span>
                    </div>
                    <div className="legend-metrics">
                      <span className="metric-value">{latestItem ? formatNumber(getRevenue(latestItem)) : "—"}</span>
                    </div>
                  </div>
                  <div className="legend-group">
                    <div className="legend-title">
                      <span className="legend-badge bg-bar-profit" />
                      <span className="legend-label">Profit (CR)</span>
                    </div>
                    <div className="legend-metrics">
                      <span className="metric-value">{latestItem ? formatNumber(getProfit(latestItem)) : "—"}</span>
                    </div>
                  </div>
                </div>
              </header>

              <div className="chart-area">
                {hasData ? (
                  <div style={{ display: "flex", alignItems: "flex-end", gap: "2rem", minHeight: "250px", padding: "2rem" }}>
                    {safeData.map((item, index) => {
                      const rev = getRevenue(item);
                      const prof = getProfit(item);
                      const quarterLabel = getQuarter(item);
                      const revPct = Math.min(100, Math.max(0, (rev / safeMaxVal) * 100));
                      const profPct = Math.min(100, Math.max(0, (prof / safeMaxVal) * 100));

                      return (
                        <div key={item.id || item.quarter || index} style={{ flex: 1, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: "0.4rem", height: "200px", position: "relative" }}>
                          <div style={{ width: "35%", height: `${revPct}%`, minHeight: rev > 0 ? "4px" : "0" }} className="bar-single bg-bar-revenue" title={`Revenue: ${formatNumber(rev)}`} />
                          <div style={{ width: "35%", height: `${profPct}%`, minHeight: prof > 0 ? "4px" : "0" }} className="bar-single bg-bar-profit" title={`Profit: ${formatNumber(prof)}`} />
                          <span style={{ position: "absolute", bottom: "-25px", fontSize: "0.85rem" }}>{quarterLabel}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ padding: "2rem" }}>Financial data unavailable</div>
                )}
              </div>
            </div>

            <div className="growth-container">
              <div className="growth-flex">
                <div className="growth-section growth-section-left">
                  <div className="growth-header">
                    <h3 className="growth-title">Revenue Growth</h3>
                    <span className="growth-title">Value</span>
                  </div>
                  <div className="growth-rows">
                    <div className="growth-row">
                      <span className="growth-label">Latest period</span>
                      <span className="text-accent-green">{latestItem ? formatNumber(getRevenue(latestItem)) : "—"}</span>
                    </div>
                    <div className="growth-row">
                      <span className="growth-label">Previous period</span>
                      <span className="text-accent-green">{prevItem ? formatNumber(getRevenue(prevItem)) : "—"}</span>
                    </div>
                  </div>
                </div>

                <div className="divider" />

                <div className="growth-section growth-section-right">
                  <div className="growth-header">
                    <h3 className="growth-title">Profit Growth</h3>
                    <span className="growth-title">Value</span>
                  </div>
                  <div className="growth-rows">
                    <div className="growth-row">
                      <span className="growth-label">Latest period</span>
                      <span className="text-accent-green">{latestItem ? formatNumber(getProfit(latestItem)) : "—"}</span>
                    </div>
                    <div className="growth-row">
                      <span className="growth-label">Previous period</span>
                      <span className="text-accent-green">{prevItem ? formatNumber(getProfit(prevItem)) : "—"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      })()}
    </ErrorBoundary>
  );
}