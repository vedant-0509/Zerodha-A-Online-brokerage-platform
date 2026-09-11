import React from "react";
import { ErrorBoundary } from "../common/ErrorBoundary";
import { RANGES, CHART_WIDTH, CHART_HEIGHT } from "../../config/stockConfig";
import { formatCurrency } from "../../utils/formatters";

export function StockChart({ resetKey, historyLoading, lineChartPreparedData, marketOpen, hoverData, onMouseMove, onMouseLeave, lineChartSvg, chartColor, chartRange, onRangeChange }) {
  return (
    <ErrorBoundary resetKey={resetKey} fallback={<div className="chart-wrapper"><div style={{ padding: "1rem", color: "#64748b" }}>Chart unavailable right now.</div></div>}>
      <div className="chart-wrapper">
        <div className="chart-area" onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}>
          {historyLoading && <div className="chart-loading">Updating chart…</div>}

          {!historyLoading && !lineChartPreparedData.length && (
            <div className="chart-loading">{marketOpen ? "Waiting for market data…" : "Market data unavailable"}</div>
          )}

          {hoverData && (
            <div className="chart-hover-tooltip" style={{ left: `${hoverData.percentX}%`, transform: `translateX(${hoverData.transformX || "-50%"})` }}>
              <span className="tooltip-price">{formatCurrency(hoverData.price)}</span>
              <span className="tooltip-divider">|</span>
              <span className="tooltip-time">{hoverData.time}</span>
            </div>
          )}

          <svg className="stock-chart" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} preserveAspectRatio="none">
            <defs>
              <linearGradient id="stockGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartColor} stopOpacity="0.22" />
                <stop offset="100%" stopColor={chartColor} stopOpacity="0" />
              </linearGradient>
            </defs>

            {lineChartSvg.baselineY !== null && (
              <line x1="0" y1={lineChartSvg.baselineY} x2="1000" y2={lineChartSvg.baselineY} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="6 6" vectorEffect="non-scaling-stroke" />
            )}

            {lineChartSvg.area && <path d={lineChartSvg.area} fill="url(#stockGradient)" />}

            {lineChartSvg.line && <polyline points={lineChartSvg.line} fill="none" stroke={chartColor} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}

            {lineChartSvg.lastPoint && (
              <g>
                <circle cx={lineChartSvg.lastPoint.x} cy={lineChartSvg.lastPoint.y} r="8" fill={chartColor} fillOpacity="0.25" />
                <circle cx={lineChartSvg.lastPoint.x} cy={lineChartSvg.lastPoint.y} r="4.5" fill={chartColor} />
              </g>
            )}

            {hoverData && (
              <g>
                <line x1={hoverData.x} y1="0" x2={hoverData.x} y2="300" stroke="#cbd5e1" strokeWidth="1.5" />
                <circle cx={hoverData.x} cy={hoverData.y} r="6" fill="#ffffff" stroke={chartColor} strokeWidth="3" />
              </g>
            )}
          </svg>

          {chartRange === "1D" && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "0 10px", fontSize: "0.75rem", color: "#64748b", marginTop: "4px" }}>
              <span>09:15 AM</span>
              <span>03:30 PM</span>
            </div>
          )}
        </div>
      </div>

      <div className="chart-footer" style={{ marginTop: "1.5rem" }}>
        <div className="chart-periods">
          {RANGES.map((range) => (
            <button key={range} className={chartRange === range ? "active" : ""} onClick={() => onRangeChange(range)} disabled={historyLoading}>
              {range}
            </button>
          ))}
        </div>
      </div>
    </ErrorBoundary>
  );
}