import React from "react";
import { formatCurrency, formatNumber, formatPercent } from "../../utils/formatters";

export function StockHeader({ symbol, exchange, companyName, ltp, isPositive, displayChange, displayChangePercent, chartRange, marketError, stockError, isWatchlisted, onToggleWatchlist }) {
  return (
    <div className="stock-header">
      <div className="stock-main-info">
        <div>
          <div className="stock-meta">
            <span>{symbol}</span>
            <span className="stock-meta-dot" />
            <span>{exchange}</span>
          </div>

          <h1>{companyName}</h1>

          <div className="stock-price-row">
            <span className="stock-price">{ltp !== null ? formatCurrency(ltp) : "—"}</span>
            <span className={isPositive ? "stock-positive" : "stock-negative"}>
              {displayChange !== null ? `${displayChange >= 0 ? "+" : ""}${formatNumber(displayChange)} (${formatPercent(displayChangePercent)}) ${chartRange}` : "—"}
            </span>
          </div>

          {marketError && <div className="detail-stock-error">{marketError}</div>}
          {stockError && <div className="detail-stock-error">{stockError}</div>}
        </div>
      </div>

      <div className="stock-actions">
        <button className={isWatchlisted ? "watchlisted" : ""} onClick={onToggleWatchlist}>
          {isWatchlisted ? "★" : "☆"}
        </button>
      </div>
    </div>
  );
}