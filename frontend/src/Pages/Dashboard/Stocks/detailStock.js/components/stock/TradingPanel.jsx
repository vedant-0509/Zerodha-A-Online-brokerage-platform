import React from "react";
import { formatCurrency, formatPercent } from "../../utils/formatters";

export function TradingPanel({
  symbol,
  exchange,
  ltp,
  bsePrice,
  isPositive,
  displayChangePercent,
  orderType,
  setOrderType,
  handlePlaceOrder,
  quantity,
  setQuantity,
  priceLimit,
  setPriceLimit,
  approximateRequired,
  orderMessage,
  marketOpen,
  orderSubmitting,
  numberValue,
}) {
  return (
    <div style={{ height: "fit-content", width: "21.5rem", minWidth: "20rem", position: "sticky", top: "140px", }}>
      <div className="trading-panel">
        <div className="trading-header">
          <p style={{ margin: 0, fontSize: "1rem", fontWeight: 500 }}>
            {symbol}
          </p>

          <div className="trading-market-info">
            <span>{exchange}</span>
            <span>{ltp !== null ? formatCurrency(ltp) : "—"}</span>
            <span className={isPositive ? "positive" : "negative"}>
              {formatPercent(displayChangePercent)}
            </span>
          </div>
        </div>

        <div className="order-tabs">
          <button className={orderType === "BUY" ? "active buy" : ""} onClick={() => setOrderType("BUY")}>
            BUY
          </button>
          <button className={orderType === "SELL" ? "active sell" : ""} onClick={() => setOrderType("SELL")}>
            SELL
          </button>
        </div>

        <form onSubmit={handlePlaceOrder} className="trading-body">
          <div style={{ borderBottom: "1px solid #e2e6ea", paddingBottom: ".5rem", }}>
            <div className="order-field">
              <div className="order-label">
                <span>Units</span>
              </div>
              <input style={{ fontSize: ".85rem" }} type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" />
            </div>

            <div className="order-field">
              <div className="order-label">
                <span>Price Limit</span>
              </div>
              <input style={{ fontSize: ".85rem" }} type="number" min="0" step="0.05" value={priceLimit} placeholder={ltp !== null ? String(ltp) : ""} onChange={(e) => setPriceLimit(e.target.value)} />
            </div>
          </div>

          <div className="order-summary">
            <span>Balance : ₹0</span>
            <div>
              <p style={{ margin: 0 }}>Approx</p>
              <p style={{ margin: 0 }}>{formatCurrency(approximateRequired)}</p>
            </div>
          </div>

          {/* {orderMessage && (
            <div style={{ fontSize: ".8rem", marginTop: "0.5rem", color: orderMessage.startsWith("Success") ? "#00b28e" : "#e5484d", }}>
              {orderMessage}
            </div>
          )} */}

          {orderMessage && (
            <div
              style={{
                borderRadius: "8px",
                padding: "10px 12px",
                marginBottom: "14px",
                fontSize: "14px",
                background: orderMessage.startsWith("Success") ? "#edf9f3" : "#fff0f0",
                border: orderMessage.startsWith("Success") ? "1px solid #c9efda" : "none",
                color: orderMessage.startsWith("Success") ? "#079447" : "#d33",
              }}
            >
              {orderMessage.replace(/^Success:\s*/i, "")}
            </div>
          )}

          <button
            type="submit"
            className={`place-order ${orderType === "BUY" ? "buy-button" : "sell-button"}`}
            disabled={!marketOpen || !quantity || numberValue(quantity) <= 0 || orderSubmitting}
          >
            {orderSubmitting ? "PROCESSING..." : marketOpen ? orderType : "MARKET CLOSED"}
          </button>
        </form>
      </div>
    </div>
  );
}
