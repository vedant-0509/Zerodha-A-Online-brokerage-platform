import React from "react";

export function MutualFundsSection({ mutualFunds }) {
  return (
    <section className="content-section">
      <div className="section-heading">
        <h2>Mutual Funds Invested ({mutualFunds.length})</h2>
      </div>

      <div className="mf-table-card">
        <div className="mf-table-header">
          <span className="mf-col-name">Fund name</span>
          <span className="mf-col-aum">AUM%</span>
        </div>

        <div className="mf-table-body">
          {mutualFunds.length > 0 ? (
            mutualFunds.map((fund, index) => (
              <div className="mf-row" key={`${fund.name}-${index}`}>
                <div className="mf-left-group">
                  <div className="mf-logo-wrapper">
                    {fund.logo ? (
                      <img
                        src={fund.logo}
                        alt={fund.name}
                        className="mf-logo-img"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          if (e.currentTarget.nextSibling) {
                            e.currentTarget.nextSibling.style.display = "flex";
                          }
                        }}
                      />
                    ) : null}

                    <div className="mf-logo-fallback" style={{ display: fund.logo ? "none" : "flex" }}>
                      {fund.name?.[0]}
                    </div>
                  </div>

                  <span className="mf-fund-name">{fund.name}</span>
                </div>

                <div className="mf-aum-value">
                  {fund.percentage !== null ? `${fund.percentage.toFixed(2)}%` : "—"}
                </div>
              </div>
            ))
          ) : (
            <div className="mf-row">Mutual fund ownership data unavailable</div>
          )}
        </div>
      </div>
    </section>
  );
}