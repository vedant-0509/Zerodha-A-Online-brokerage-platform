import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import api from "../../../../api/client";

const API_URL = "/mutual-funds/api/mutual-funds";
const PAGE_SIZE = 20;
const RISK_ORDER = [
  "Low",
  "Low to Moderate",
  "Moderate",
  "Moderately High",
  "High",
  "Very High",
];
const TYPE_LABELS = {
  EQUITY: "Equity",
  DEBT: "Debt",
  HYBRID: "Hybrid",
  COMMODITY: "Commodities",
};
const TYPE_ORDER = ["EQUITY", "DEBT", "HYBRID", "COMMODITY"];

const DEFAULT_FILTERS = {
  fundTypes: [],
  categories: [],
  risks: [],
  ratings: [],
  fundHouses: [],
  indexOnly: false,
  quickFilter: "",
  search: "",
  sortBy: "name",
  sortDirection: "asc",
};

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function displayName(value) {
  return String(value || "Unnamed Mutual Fund")
    .replace(/\s*-\s*Direct Plan\s*-\s*/gi, " - ")
    .replace(/\s*-\s*Regular Plan\s*-\s*/gi, " - ")
    .replace(/\s*-\s*Growth\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

const CATEGORY_LABEL_MAP = {
  INDEX_FUND: "Index Fund",
  SMALL_CAP: "Small Cap",
  MID_CAP: "Mid Cap",
  LARGE_CAP: "Large Cap",
  LARGE_AND_MID_CAP: "Large & Mid Cap",
  FLEXI_CAP: "Flexi Cap",
  MULTI_CAP: "Multi Cap",
  VALUE: "Value",
  CONTRA: "Contra",
  ELSS: "ELSS",
  DIVIDEND_YIELD: "Dividend Yield",
  FOCUSED: "Focused",
  THEMATIC: "Thematic",
  SECTORAL: "Sectoral",
  ESG: "ESG",
  BALANCED_HYBRID: "Balanced Hybrid",
  AGGRESSIVE_HYBRID: "Aggressive Hybrid",
  CONSERVATIVE_HYBRID: "Conservative Hybrid",
  DYNAMIC_ASSET_ALLOCATION: "Dynamic Asset Allocation",
  MULTI_ASSET_ALLOCATION: "Multi Asset Allocation",
  ARBITRAGE: "Arbitrage",
  EQUITY_SAVINGS: "Equity Savings",
  CONSERVATIVE: "Conservative",
  DYNAMIC_TERM: "Dynamic Term",
  BANKING_AND_PSU: "Banking & PSU",
  CREDIT_RISK: "Credit Risk",
  CORPORATE_BOND: "Corporate Bond",
  MEDIUM_DURATION: "Medium Duration",
  SHORT_DURATION: "Short Duration",
  LIQUID: "Liquid",
  OVERNIGHT: "Overnight",
  MONEY_MARKET: "Money Market",
  LOW_DURATION: "Low Duration",
  ULTRA_SHORT_DURATION: "Ultra Short Duration",
  GILT: "Gilt",
  GILT_10_YEAR: "Gilt 10 Year",
  DYNAMIC_BOND: "Dynamic Bond",
  FLOATER: "Floater",
  CREDIT_OPPORTUNITIES: "Credit Opportunities",
};

function categoryLabel(value) {
  const raw = String(value || "Other")
    .replace(/^Equity Scheme\s*-\s*/i, "")
    .replace(/^Debt Scheme\s*-\s*/i, "")
    .replace(/^Hybrid Scheme\s*-\s*/i, "")
    .replace(/^Other Scheme\s*-\s*/i, "")
    .replace(/^Solution Oriented Scheme\s*-\s*/i, "")
    .trim();

  if (!raw) return "Other";

  const normalized = raw
    .toUpperCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^A-Z0-9_]/g, "");

  if (CATEGORY_LABEL_MAP[normalized]) {
    return CATEGORY_LABEL_MAP[normalized];
  }

  return raw
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function displayCategory(fund) {
  const sub = categoryLabel(fund.fund_sub_category || fund.scheme_category);
  const type = TYPE_LABELS[fund.fund_type] || "";

  // The backend can return INDEX_FUND as a category.
  // Do not show "Equity Index Fund"; show simply "Equity".
  if (sub === "Index Fund") return type || "Index Fund";
  if (!sub || sub === "Other") return type || "Other";

  return type ? `${type} ${sub}` : sub;
}

function formatReturn(value) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    !Number.isFinite(Number(value))
  )
    return "--";
  const n = Number(value);
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function formatNav(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value)))
    return "--";
  return Number(value).toFixed(2);
}

function getInitials(name) {
  const words = displayName(name)
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .split(" ")
    .filter(Boolean);
  if (!words.length) return "MF";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function riskClass(risk) {
  return String(risk || "")
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function returnClass(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value)))
    return "";
  return Number(value) >= 0 ? "mf2-positive" : "mf2-negative";
}

function formatDate(value) {
  if (!value) return "--";
  const s = String(value).slice(0, 10);
  return s;
}

function Check({ checked }) {
  return (
    <span className={`mf-check ${checked ? "checked" : ""}`}>
      {checked ? "✓" : ""}
    </span>
  );
}

function Chevron({ direction = "right" }) {
  return <span className={`mf-chevron ${direction}`}>›</span>;
}

export default function DashboardSection2() {
  const [funds, setFunds] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState("");

  const [filterData, setFilterData] = useState({
    fundHouses: [],
    categoryGroups: { EQUITY: [], DEBT: [], HYBRID: [], COMMODITY: [] },
    risks: RISK_ORDER,
    ratings: [5, 4, 3, 2, 1],
  });

  const [applied, setApplied] = useState(DEFAULT_FILTERS);
  const [pending, setPending] = useState(DEFAULT_FILTERS);
  const [openMenu, setOpenMenu] = useState(null);
  const [categoryType, setCategoryType] = useState(null);
  const [fundHouseSearch, setFundHouseSearch] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const requestRef = useRef(null);
  const requestIdRef = useRef(0);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const pageRef = useRef(1);
  const tableScrollRef = useRef(null);
  const sentinelRef = useRef(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const value = searchInput.trim();
      setApplied((old) =>
        old.search === value ? old : { ...old, search: value },
      );
      setPending((old) => ({ ...old, search: value }));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const fetchFilters = useCallback(async () => {
    try {
      const res = await api.get(`${API_URL}/filters`, { timeout: 20000 });
      const d = res.data?.data || {};
      setFilterData({
        fundHouses: Array.isArray(d.fundHouses) ? d.fundHouses : [],
        categoryGroups: d.categoryGroups || {
          EQUITY: [],
          DEBT: [],
          HYBRID: [],
          COMMODITY: [],
        },
        // Keep the risk filter limited to the six user-facing risk labels.
        risks: RISK_ORDER,
        ratings:
          Array.isArray(d.ratings) && d.ratings.length
            ? d.ratings.map(Number)
            : [5, 4, 3, 2, 1],
      });
    } catch (err) {
      console.error("[MF] filter metadata error:", err);
    }
  }, []);

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  const buildParams = useCallback((filterState, pageNumber) => {
    const params = {
      page: pageNumber,
      limit: PAGE_SIZE,
      sortBy: filterState.sortBy,
      sortDirection: filterState.sortDirection,
    };
    if (filterState.search) params.search = filterState.search;
    if (filterState.fundTypes.length)
      params.fundType = filterState.fundTypes.join(",");
    if (filterState.categories.length)
      params.category = filterState.categories.join(",");
    if (filterState.risks.length) params.risk = filterState.risks.join(",");
    if (filterState.fundHouses.length)
      params.fundHouse = filterState.fundHouses.join(",");
    if (filterState.ratings.length)
      params.ratingMin = Math.min(...filterState.ratings);
    if (filterState.indexOnly) params.indexOnly = "true";
    if (filterState.quickFilter) params.quickFilter = filterState.quickFilter;
    return params;
  }, []);

  const fetchFunds = useCallback(
    async (pageNumber, reset = false, filterState = applied) => {
      if (loadingRef.current) return;
      if (!reset && !hasMoreRef.current) return;

      if (requestRef.current) requestRef.current.abort();
      const controller = new AbortController();
      requestRef.current = controller;
      const requestId = ++requestIdRef.current;
      loadingRef.current = true;
      setLoading(true);
      if (reset) setInitialLoading(true);
      setError("");

      try {
        const res = await api.get(API_URL, {
          params: buildParams(filterState, pageNumber),
          timeout: 30000,
          signal: controller.signal,
        });
        if (requestId !== requestIdRef.current) return;

        const data = res.data?.data || {};
        const rows = Array.isArray(data.funds) ? data.funds : [];
        const nextHasMore = Boolean(data.hasMore);
        const nextPage = Number(data.page || pageNumber);

        setTotal(Number(data.total || 0));
        setHasMore(nextHasMore);
        hasMoreRef.current = nextHasMore;
        setPage(nextPage);
        pageRef.current = nextPage;

        setFunds((old) => {
          if (reset) return rows;
          const seen = new Set(
            old.map((x) => String(x.scheme_code ?? x.schemeCode ?? x.id)),
          );
          return [
            ...old,
            ...rows.filter(
              (x) => !seen.has(String(x.scheme_code ?? x.schemeCode ?? x.id)),
            ),
          ];
        });
      } catch (err) {
        if (err?.code === "ERR_CANCELED" || err?.name === "CanceledError")
          return;
        console.error("[MF] API error:", err);
        if (requestId === requestIdRef.current) {
          setError(
            err?.response?.data?.message ||
            err.message ||
            "Unable to load mutual funds",
          );
          if (reset) {
            setFunds([]);
            setTotal(0);
          }
        }
      } finally {
        if (requestId === requestIdRef.current) {
          loadingRef.current = false;
          setLoading(false);
          setInitialLoading(false);
        }
      }
    },
    [applied, buildParams],
  );

  useEffect(() => {
    pageRef.current = 1;
    hasMoreRef.current = true;
    setPage(1);
    setFunds([]);
    fetchFunds(1, true, applied);
    return () => requestRef.current?.abort();
  }, [applied, fetchFunds]);

  useEffect(() => {
    const root = tableScrollRef.current;
    const target = sentinelRef.current;
    if (!root || !target) return undefined;

    // Do not keep re-creating the observer every time another batch is
    // appended. Recreating it while the sentinel is still visible can
    // immediately request page 2, 3, 4... without another user scroll.
    const hasUserScrolledRef = { current: false };

    const markUserScrolled = () => {
      hasUserScrolledRef.current = true;
    };

    root.addEventListener("scroll", markUserScrolled, { passive: true });

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          !hasUserScrolledRef.current ||
          !entries[0].isIntersecting ||
          loadingRef.current ||
          !hasMoreRef.current
        ) {
          return;
        }

        fetchFunds(pageRef.current + 1, false, applied);
      },
      {
        root,
        // Fetch the next 20 only when the user has actually reached the
        // bottom area of the table, not 500px before it.
        rootMargin: "80px 0px",
        threshold: 0,
      },
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
      root.removeEventListener("scroll", markUserScrolled);
    };
  }, [applied, fetchFunds]);

  const togglePendingArray = (key, value) => {
    setPending((old) => ({
      ...old,
      [key]: old[key].includes(value)
        ? old[key].filter((x) => x !== value)
        : [...old[key], value],
    }));
  };

  const selectType = (type) => {
    setCategoryType(type);
  };

  const toggleFundType = (type) => {
    setPending((old) => {
      const exists = old.fundTypes.includes(type);
      return {
        ...old,
        fundTypes: exists
          ? old.fundTypes.filter((x) => x !== type)
          : [...old.fundTypes, type],
      };
    });
  };

  const toggleAllCategoriesForType = (type) => {
    const values = filterData.categoryGroups[type] || [];
    setPending((old) => {
      const allSelected =
        values.length > 0 && values.every((v) => old.categories.includes(v));
      return {
        ...old,
        fundTypes: allSelected
          ? old.fundTypes.filter((x) => x !== type)
          : unique([...old.fundTypes, type]),
        categories: allSelected
          ? old.categories.filter((v) => !values.includes(v))
          : unique([...old.categories, ...values]),
      };
    });
  };

  const applyPending = () => {
    setApplied({ ...pending });
    setOpenMenu(null);
    setCategoryType(null);
  };

  const clearPending = () => setPending(DEFAULT_FILTERS);

  const clearAll = () => {
    setPending(DEFAULT_FILTERS);
    setApplied(DEFAULT_FILTERS);
    setSearchInput("");
    setOpenMenu(null);
    setCategoryType(null);
  };

  const updateSearch = (value) => {
    setSearchInput(value);
  };

  const filteredHouses = useMemo(() => {
    const q = fundHouseSearch.trim().toLowerCase();
    return filterData.fundHouses.filter(
      (x) => !q || x.toLowerCase().includes(q),
    );
  }, [filterData.fundHouses, fundHouseSearch]);

  const activeFilterCount =
    applied.fundTypes.length +
    applied.categories.length +
    applied.risks.length +
    applied.fundHouses.length +
    applied.ratings.length +
    (applied.indexOnly ? 1 : 0);

  const sort = (column) => {
    setApplied((old) => ({
      ...old,
      sortBy: column,
      sortDirection:
        old.sortBy === column && old.sortDirection === "desc" ? "asc" : "desc",
    }));
    setPending((old) => ({
      ...old,
      sortBy: column,
      sortDirection:
        old.sortBy === column && old.sortDirection === "desc" ? "asc" : "desc",
    }));
  };

  const quickFilter = (value) => {
    const next = { ...DEFAULT_FILTERS, ...applied, quickFilter: value };
    setApplied(next);
    setPending(next);
  };

  const toggleMenu = (name) => {
    setOpenMenu((old) => (old === name ? null : name));
    if (name !== "categories") setCategoryType(null);
  };

  return (
    <section className="mf2-page">
      <div className="mf2-heading-row">
        <div>
          <h2>All Mutual Funds</h2>
          <span>{total.toLocaleString("en-IN")} results</span>
        </div>
        <div className="mf2-search-box">
          <span>⌕</span>
          <input
            value={searchInput}
            onChange={(e) => updateSearch(e.target.value)}
            placeholder="Search mutual funds"
          />
          {searchInput && (
            <button type="button" onClick={() => updateSearch("")}>
              ×
            </button>
          )}
        </div>
      </div>

      <div className="mf2-toolbar">
        <FilterButton label="Categories" active={openMenu === "categories"} count={applied.fundTypes.length + applied.categories.length} onClick={() => toggleMenu("categories")} />

        <FilterButton label="Risk" active={openMenu === "risk"} count={applied.risks.length} onClick={() => toggleMenu("risk")} />

        <FilterButton label="Ratings" active={openMenu === "ratings"} count={applied.ratings.length} onClick={() => toggleMenu("ratings")} />

        <FilterButton label="Fund House" active={openMenu === "houses"} count={applied.fundHouses.length} onClick={() => toggleMenu("houses")} />

        <span className="mf2-divider" />

        <button type="button" className={`mf2-chip ${applied.indexOnly ? "active" : ""}`}
          onClick={() => {
            const next = { ...applied, indexOnly: !applied.indexOnly };
            setApplied(next);
            setPending(next);
          }}>
          Index only
        </button>

        <button type="button" className={`mf2-chip ${applied.quickFilter === "flexicap" ? "active" : ""}`}
          onClick={() =>
            quickFilter(applied.quickFilter === "flexicap" ? "" : "flexicap")
          }>
          Flexi Cap
        </button>

        <button type="button" className={`mf2-chip ${applied.quickFilter === "sectoral" ? "active" : ""}`}
          onClick={() =>
            quickFilter(applied.quickFilter === "sectoral" ? "" : "sectoral")
          }>
          Sectoral
        </button>

        <button type="button" className={`mf2-chip ${applied.quickFilter === "4plus" ? "active" : ""}`}
          onClick={() =>
            quickFilter(applied.quickFilter === "4plus" ? "" : "4plus")
          }>
          4+ ★
        </button>

        <button type="button" className={`mf2-chip ${applied.quickFilter === "largecap" ? "active" : ""}`}
          onClick={() =>
            quickFilter(applied.quickFilter === "largecap" ? "" : "largecap")
          }>
          Large Cap
        </button>

        <button type="button" className="mf2-clear-top"
          onClick={clearAll}
          disabled={!activeFilterCount && !applied.search}
        >
          Clear All
        </button>
      </div>

      {openMenu === "categories" && (
        <div className="mf2-popover mf2-category-popover">
          {categoryType ? (
            <>
              <button
                className="mf2-back"
                type="button"
                onClick={() => setCategoryType(null)}
              >
                <span>←</span>
                <strong>{TYPE_LABELS[categoryType]}</strong>
              </button>
              <div className="mf2-popover-scroll">
                {(filterData.categoryGroups[categoryType] || []).map(
                  (category) => (
                    <button
                      key={category}
                      type="button"
                      className="mf2-option"
                      onClick={() => togglePendingArray("categories", category)}
                    >
                      <Check checked={pending.categories.includes(category)} />
                      <span>{categoryLabel(category)}</span>
                    </button>
                  ),
                )}
              </div>
            </>
          ) : (
            <>
              <div className="mf2-index-toggle-row">
                <span>Index Funds only</span>
                <button
                  type="button"
                  className={`mf2-switch ${pending.indexOnly ? "on" : ""}`}
                  onClick={() =>
                    setPending((old) => ({ ...old, indexOnly: !old.indexOnly }))
                  }
                >
                  <span />
                </button>
              </div>
              <div className="mf2-popover-scroll">
                {TYPE_ORDER.map((type) => {
                  const values = filterData.categoryGroups[type] || [];
                  const selected =
                    values.length > 0 &&
                    values.every((v) => pending.categories.includes(v));
                  return (
                    <button
                      key={type}
                      type="button"
                      className="mf2-option"
                      onClick={() => selectType(type)}
                    >
                      <Check
                        checked={pending.fundTypes.includes(type) || selected}
                      />
                      <span>{TYPE_LABELS[type]}</span>
                      <Chevron />
                    </button>
                  );
                })}
              </div>
            </>
          )}
          <FilterFooter onClear={clearPending} onApply={applyPending} />
        </div>
      )}

      {openMenu === "risk" && (
        <div className="mf2-popover mf2-small-popover">
          <div className="mf2-popover-title">Risk</div>
          <div className="mf2-popover-scroll">
            {RISK_ORDER.map((risk) => (
              <button
                key={risk}
                type="button"
                className="mf2-option"
                onClick={() => togglePendingArray("risks", risk)}
              >
                <Check checked={pending.risks.includes(risk)} />
                <span>{risk}</span>
              </button>
            ))}
          </div>
          <FilterFooter
            onClear={() => setPending((old) => ({ ...old, risks: [] }))}
            onApply={applyPending}
          />
        </div>
      )}

      {openMenu === "ratings" && (
        <div className="mf2-popover mf2-small-popover">
          <div className="mf2-popover-title">Ratings</div>
          <div className="mf2-popover-scroll">
            {[5, 4, 3, 2, 1].map((rating) => (
              <button
                key={rating}
                type="button"
                className="mf2-option"
                onClick={() => togglePendingArray("ratings", rating)}
              >
                <Check checked={pending.ratings.includes(rating)} />
                <span>{rating} ★</span>
              </button>
            ))}
          </div>
          <FilterFooter
            onClear={() => setPending((old) => ({ ...old, ratings: [] }))}
            onApply={applyPending}
          />
        </div>
      )}

      {openMenu === "houses" && (
        <div className="mf2-popover mf2-house-popover">
          <div className="mf2-house-search">
            <span>⌕</span>
            <input
              value={fundHouseSearch}
              onChange={(e) => setFundHouseSearch(e.target.value)}
              placeholder="Search fund house"
            />
          </div>
          <div className="mf2-popover-scroll">
            {filteredHouses.map((house) => (
              <button
                key={house}
                type="button"
                className="mf2-option"
                onClick={() => togglePendingArray("fundHouses", house)}
              >
                <Check checked={pending.fundHouses.includes(house)} />
                <span>{house}</span>
              </button>
            ))}
          </div>
          <FilterFooter
            onClear={() => setPending((old) => ({ ...old, fundHouses: [] }))}
            onApply={applyPending}
          />
        </div>
      )}

      {error && (
        <div className="mf2-error">
          {error}
          <button type="button" onClick={() => fetchFunds(1, true, applied)}>
            Retry
          </button>
        </div>
      )}

      <div className="mf2-table-card">
        <div className="mf2-table-scroll" ref={tableScrollRef}>
          <table className="mf2-table">
            <thead>
              <tr>
                <th className="name-col">
                  <SortButton
                    label="Fund Name"
                    column="name"
                    applied={applied}
                    onSort={sort}
                  />
                </th>
                <th>Category</th>
                <th>
                  <SortButton
                    label="1Y"
                    column="1y"
                    applied={applied}
                    onSort={sort}
                  />
                </th>
                <th>
                  <SortButton
                    label="3Y"
                    column="3y"
                    applied={applied}
                    onSort={sort}
                  />
                </th>
                <th>
                  <SortButton
                    label="5Y"
                    column="5y"
                    applied={applied}
                    onSort={sort}
                  />
                </th>
                <th>
                  <SortButton
                    label="Rating"
                    column="rating"
                    applied={applied}
                    onSort={sort}
                  />
                </th>
                <th>Risk</th>
                <th>NAV</th>
              </tr>
            </thead>
            <tbody>
              {initialLoading ? (
                <tr>
                  <td colSpan="8" className="mf2-state">
                    Loading mutual funds...
                  </td>
                </tr>
              ) : null}
              {!initialLoading && !funds.length ? (
                <tr>
                  <td colSpan="8" className="mf2-state">
                    No mutual funds found.
                  </td>
                </tr>
              ) : null}
              {funds.map((fund) => (
                <tr key={fund.scheme_code}>
                  <td className="mf2-name-cell">
                    <span className="mf2-logo">
                      {getInitials(fund.fund_house || fund.scheme_name)}
                    </span>
                    <span className="mf2-name-text">
                      <strong>{displayName(fund.scheme_name)}</strong>
                      <small>{fund.fund_house || "--"}</small>
                    </span>
                  </td>
                  <td>{displayCategory(fund)}</td>
                  <td
                    className={`mf2-return ${returnClass(fund.return_1y)}`}
                    title={`Reference NAV date: ${formatDate(fund.return_1y_nav_date)}`}
                  >
                    {formatReturn(fund.return_1y)}
                  </td>
                  <td
                    className={`mf2-return ${returnClass(fund.return_3y)}`}
                    title={`Reference NAV date: ${formatDate(fund.return_3y_nav_date)}`}
                  >
                    {formatReturn(fund.return_3y)}
                  </td>
                  <td
                    className={`mf2-return ${returnClass(fund.return_5y)}`}
                    title={`Reference NAV date: ${formatDate(fund.return_5y_nav_date)}`}
                  >
                    {formatReturn(fund.return_5y)}
                  </td>
                  <td>
                    {fund.rating ? (
                      <span className="mf2-rating">{fund.rating} ★</span>
                    ) : (
                      "--"
                    )}
                  </td>
                  <td>
                    {fund.risk ? (
                      <span className={`mf2-risk ${riskClass(fund.risk)}`}>
                        {fund.risk}
                      </span>
                    ) : (
                      "--"
                    )}
                  </td>
                  <td className="mf2-nav">{formatNav(fund.current_nav)}</td>
                </tr>
              ))}
              <tr ref={sentinelRef}>
                <td colSpan="8" className="mf2-sentinel">
                  {loading && !initialLoading
                    ? "Loading more funds…"
                    : !hasMore && funds.length
                      ? `All ${total.toLocaleString("en-IN")} mutual funds loaded.`
                      : ""}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function FilterButton({ label, active, count, onClick }) {
  return (
    <button
      type="button"
      className={`mf2-filter-button ${active ? "active" : ""}`}
      onClick={onClick}
    >
      {label}
      {count > 0 ? <span className="mf2-filter-count">{count}</span> : null}
      <span className={`mf2-down ${active ? "up" : ""}`}>⌄</span>
    </button>
  );
}

function FilterFooter({ onClear, onApply }) {
  return (
    <div className="mf2-footer">
      <button type="button" onClick={onClear}>
        Clear All
      </button>
      <button type="button" className="apply" onClick={onApply}>
        Apply
      </button>
    </div>
  );
}

function SortButton({ label, column, applied, onSort }) {
  const active = applied.sortBy === column;
  return (
    <button type="button" className="mf2-sort" onClick={() => onSort(column)}>
      {label}
      <span
        className={
          active && applied.sortDirection === "desc"
            ? "sort-arrow down"
            : "sort-arrow"
        }
      >
        ⌄
      </span>
    </button>
  );
}
