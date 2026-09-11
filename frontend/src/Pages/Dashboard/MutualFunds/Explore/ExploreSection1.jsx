import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API = "http://localhost:3001";

const POPULAR_FUNDS = [
    {
        id: "sbi-gold",
        name: "SBI Gold Direct Plan-Growth",
        returns: "+36.00%",
        icon: (
            <svg viewBox="0 0 24 24" className="fund-svg">
                <circle cx="12" cy="7.5" r="3.2" />
                <circle cx="7.5" cy="14" r="3.2" />
                <circle cx="16.5" cy="14" r="3.2" />
                <path d="M11 11.5h2V20h-2z" />
            </svg>
        ),
        iconClass: "sbi-icon",
    },
    {
        id: "bandhan-small",
        name: "Bandhan Small Cap Fund",
        returns: "+25.44%",
        icon: (
            <svg viewBox="0 0 24 24" className="fund-svg flame-svg">
                <path d="M12 2.5C11.5 6 7 9.5 7 14c0 2.8 2.2 5 5 5s5-2.2 5-5c0-4.5-4.5-8-5-11.5zm0 15c-1.7 0-3-1.3-3-3 0-1.8 1.8-3.4 3-5.2 1.2 1.8 3 3.4 3 5.2 0 1.7-1.3 3-3 3z" />
            </svg>
        ),
        iconClass: "bandhan-icon",
    },
    {
        id: "hdfc-mid",
        name: "HDFC Mid Cap Fund",
        returns: "+18.33%",
        icon: (
            <div className="hdfc-symbol">
                <div></div>
                <div></div>
                <div></div>
                <div></div>
            </div>
        ),
        iconClass: "hdfc-icon",
    },
    {
        id: "parag-parikh",
        name: "Parag Parikh Flexi Cap Fund",
        returns: "+13.33%",
        icon: (
            <svg viewBox="0 0 24 24" className="fund-svg parag-svg">
                <path d="M19 12c.6 0 1-.4 1-1s-.4-1-1-1h-1.1c-.5-2.8-2.6-5-5.4-5.7V3.5c0-.8-.7-1.5-1.5-1.5S9.5 2.7 9.5 3.5v.8C6.7 5 4.6 7.2 4.1 10H3c-.6 0-1 .4-1 1s.4 1 1 1h.6c.2 1.8 1 3.4 2.3 4.5l-1.6 1.6c-.4.4-.4 1 0 1.4.2.2.5.3.7.3s.5-.1.7-.3l1.8-1.8c1.3.8 2.8 1.3 4.5 1.3s3.2-.5 4.5-1.3l1.8 1.8c.2.2.5.3.7.3s.5-.1.7-.3c.4-.4.4-1 0-1.4L18.4 16.5c1.3-1.1 2.1-2.7 2.3-4.5H19zm-7 4c-2.8 0-5-2.2-5-5s2.2-5 5-5 5 2.2 5 5-2.2 5-5 5z" />
            </svg>
        ),
        iconClass: "parag-icon",
    },
    {
        id: "nippon-small",
        name: "Nippon India Small Cap Fund",
        returns: "+31.20%",
        iconText: "N",
        iconClass: "nippon-icon",
    },
    {
        id: "icici-tech",
        name: "ICICI Prudential Technology Fund",
        returns: "+22.15%",
        iconText: "ICICI",
        iconClass: "icici-icon",
    },
    {
        id: "axis-bluechip",
        name: "Axis Bluechip Fund",
        returns: "+16.80%",
        icon: (
            <svg viewBox="0 0 24 24" className="fund-svg">
                <path d="M12 4L3 20h6l3-6 3 6h6z" />
            </svg>
        ),
        iconClass: "axis-icon",
    },
    {
        id: "mirae-large",
        name: "Mirae Asset Large Cap Fund",
        returns: "+14.50%",
        iconText: "MA",
        iconClass: "mirae-icon",
    },
];

export default function ExploreSection1() {
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState("Gainers");
    const [stocks, setStocks] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchMovers = async () => {
            try {
                setLoading(true);

                // Replace this endpoint with your existing endpoint if required.
                const response = await axios.get(`${API}/api/top-movers`, {
                    params: {
                        type: activeTab,
                    },
                });

                const data = Array.isArray(response.data)
                    ? response.data
                    : response.data?.data || [];

                setStocks(data);
            } catch (error) {
                console.error("Failed to fetch top movers:", error);
                setStocks([]);
            } finally {
                setLoading(false);
            }
        };

        fetchMovers();
    }, [activeTab]);

    const openStock = (stock) => {
        if (!stock) return;

        const symbol = stock.symbol || stock.trading_symbol || stock.instrument_key;

        if (symbol) {
            navigate(`/stock/${encodeURIComponent(symbol)}`);
        }
    };

    const getPrice = (stock) => {
        const value =
            stock.price ?? stock.last_price ?? stock.ltp ?? stock.close ?? 0;

        return Number(value) || 0;
    };

    const getChangePercent = (stock) => {
        const value =
            stock.changePercent ??
            stock.change_percent ??
            stock.change_percentage ??
            stock.pChange ??
            0;

        return Number(value) || 0;
    };

    const getChangePoints = (stock) => {
        const value =
            stock.changePoints ?? stock.change_points ?? stock.change ?? 0;

        return Number(value) || 0;
    };

    const getVolume = (stock) => {
        const value =
            stock.volume ?? stock.totalTradedVolume ?? stock.total_traded_volume ?? 0;

        return Number(value) || 0;
    };

    return (
        <div className="explore-section-wrapper">
            <main className="explore-dashboard">
                {/* ==========================================
                    POPULAR FUNDS + YOUR INVESTMENTS
                =========================================== */}
                <div className="dashboard-layout">
                    {/* LEFT COLUMN */}
                    <section className="popular-funds-section">
                        <h2 className="section-title">Popular Funds</h2>

                        <div className="funds-grid">
                            {POPULAR_FUNDS.map((fund) => (
                                <article key={fund.id} className="fund-card">
                                    <div>
                                        <div className={`fund-icon ${fund.iconClass}`}>
                                            {fund.icon ?? fund.iconText}
                                        </div>

                                        <h3 className="fund-name">{fund.name}</h3>
                                    </div>

                                    <div className="fund-bottom">
                                        <span className="fund-return">{fund.returns}</span>

                                        <span className="fund-period">3Y</span>
                                    </div>
                                </article>
                            ))}
                        </div>

                        <a href="#all-mutual-funds" className="all-funds-link">
                            <span>All Mutual Funds</span>
                            <span className="all-funds-arrow">›</span>
                        </a>
                    </section>

                    {/* RIGHT COLUMN */}
                    <aside className="investments-section">
                        <h2 className="section-title">Your Investments</h2>

                        <div className="investment-card">
                            <div>
                                <span className="current-label">Current</span>

                                <div className="current-value">₹72,127</div>
                            </div>

                            <hr className="investment-divider" />

                            <div className="investment-stats">
                                <div className="investment-row">
                                    <span className="investment-label">1D returns</span>

                                    <span className="investment-value loss-value">
                                        -135.62 (0.19%)
                                    </span>
                                </div>

                                <div className="investment-row">
                                    <span className="investment-label">Total returns</span>

                                    <span className="investment-value gain-value">
                                        +2,130 (3.04%)
                                    </span>
                                </div>

                                <div className="investment-row">
                                    <span className="investment-label">Invested</span>

                                    <span className="investment-value dark-value">₹69,997</span>
                                </div>

                                <div className="investment-row">
                                    <span className="investment-label">XIRR</span>

                                    <span className="investment-value dark-value">4.71%</span>
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>
            </main>
        </div>
    );
}
