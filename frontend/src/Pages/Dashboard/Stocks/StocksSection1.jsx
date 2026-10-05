import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import SearchModal from "./SearchModal";

export default function StocksSection1() {
  const [openSearch, setOpenSearch] = useState(false);

  const navigate = useNavigate();

  function handleSelectStock(stock) {
    if (!stock?.symbol) {
      console.error("Cannot open stock: symbol missing", stock);
      return;
    }

    navigate(`/dashboard/stocks/explore/${encodeURIComponent(stock.symbol)}`, {
      state: {
        instrumentKey: stock.instrument_key,
        symbol: stock.symbol,
        companyName: stock.name,
        exchange:
          stock.exchange ||
          stock.instrument_key?.split("|")[0]?.replace("_EQ", ""),
      },
    });

    setOpenSearch(false);
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          className="StocksSection1-div"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "3rem",
            height: "3rem",
            fontWeight: "500",
            marginTop: ".75rem",
          }}
        >
          <NavLink
            to="/dashboard/stocks/explore"
            className={({ isActive }) =>
              isActive ? "navlink active-link" : "navlink"
            }
          >
            Explore
          </NavLink>

          <NavLink
            to="/dashboard/stocks/holdings"
            className={({ isActive }) =>
              isActive ? "navlink active-link" : "navlink"
            }
          >
            Holdings
          </NavLink>

          <NavLink
            to="/dashboard/stocks/orders"
            className={({ isActive }) =>
              isActive ? "navlink active-link" : "navlink"
            }
          >
            Orders
          </NavLink>

          <NavLink
            to="/dashboard/stocks/watchlist"
            className={({ isActive }) =>
              isActive ? "navlink active-link" : "navlink"
            }
          >
            Watchlist
          </NavLink>
        </div>

        <div style={{ marginTop: "5rem" }}>
          <SearchModal
            open={openSearch}
            onClose={() => setOpenSearch(false)}
            onSelectStock={handleSelectStock}
          />
        </div>

        <div className="searchbar" onClick={() => setOpenSearch(true)}>
          <div
            style={{
              border: "1px solid #ddd",
              padding: "12px",
              borderRadius: "8px",
              width: "350px",
              cursor: "pointer",
            }}
          >
            <i
              className="fa-solid fa-magnifying-glass"
              style={{
                marginRight: "10px",
                marginTop: ".2rem", color:"#616161"
              }}
            />
            Search Groww...
          </div>
        </div>
      </div>
    </>
  );
}
