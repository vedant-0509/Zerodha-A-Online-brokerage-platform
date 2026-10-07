import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import socket from "../../indexWebSocketConnection.js/marketIndexSocketConnection";

export default function DashboardSection2() {
    const [market, setMarket] = useState({});
    const [connected, setConnected] = useState(socket.connected);
    const location = useLocation();

    useEffect(() => {
        const handleConnect = () => {
            console.log("🟢 Index Market Socket Connected:", socket.id);
            setConnected(true);

            // Always refresh from the latest backend cache after connect/reconnect.
            socket.emit("get_snapshot");
        };

        const handleDisconnect = (reason) => {
            console.log("🔴 Index Market Socket Disconnected:", reason);
            setConnected(false);
        };

        const handleError = (err) => {
            console.error("❌ Index Market Socket Error:", err?.message || err);
        };

        const handleSnapshot = (snapshot) => {
            console.log("📸 Index Market Snapshot Received");
            setMarket(snapshot && typeof snapshot === "object" ? snapshot : {});
        };

        const handleMarketUpdate = ({ symbol, data }) => {
            if (!symbol || !data) return;

            setMarket((prev) => {
                const previous = prev[symbol];

                // Do not allow an older websocket packet to overwrite a newer one.
                if (
                    previous?.updatedAt &&
                    data?.updatedAt &&
                    Number(data.updatedAt) < Number(previous.updatedAt)
                ) {
                    return prev;
                }

                return {
                    ...prev,
                    [symbol]: data,
                };
            });
        };

        socket.on("connect", handleConnect);
        socket.on("disconnect", handleDisconnect);
        socket.on("connect_error", handleError);
        socket.on("market_snapshot", handleSnapshot);
        socket.on("market_update", handleMarketUpdate);

        if (socket.connected) {
            socket.emit("get_snapshot");
        }

        return () => {
            socket.off("connect", handleConnect);
            socket.off("disconnect", handleDisconnect);
            socket.off("connect_error", handleError);
            socket.off("market_snapshot", handleSnapshot);
            socket.off("market_update", handleMarketUpdate);
        };
    }, []);

    useEffect(() => {
        if (location.pathname === "/dashboard" && socket.connected) {
            socket.emit("get_snapshot");
        }
    }, [location.pathname]);

    const indices = [
        { key: "NSE_INDEX|Nifty 50", name: "NIFTY 50" },
        { key: "BSE_INDEX|SENSEX", name: "SENSEX" },
        { key: "NSE_INDEX|Nifty Bank", name: "BANK NIFTY" },
        { key: "NSE_INDEX|India VIX", name: "INDIA VIX" },
        { key: "NSE_INDEX|Nifty Auto", name: "NIFTY AUTO" },
        { key: "NSE_INDEX|Nifty FMCG", name: "NIFTY FMCG" },
        { key: "NSE_INDEX|Nifty Metal", name: "NIFTY METAL" },
        { key: "BSE_INDEX|BANKEX", name: "BANKEX" },
        { key: "BSE_INDEX|FOCIT", name: "FOCIT" },
        { key: "BSE_INDEX|SML250", name: "BSE SMALLCAP 250" },
        { key: "NSE_INDEX|Nifty Pharma", name: "NIFTY PHARMA" },
        { key: "NSE_INDEX|Nifty PSU Bank", name: "NIFTY PSU BANK" },
        { key: "NSE_INDEX|Nifty IT", name: "NIFTY IT" },
        { key: "NSE_INDEX|Nifty Next 50", name: "NEXT 50" },
        { key: "NSE_INDEX|Nifty 100", name: "NIFTY 100" },
        { key: "NSE_INDEX|Nifty 500", name: "NIFTY 500" },
        { key: "NSE_INDEX|NIFTY MID SELECT", name: "NIFTY MID SELECT" },
        { key: "NSE_INDEX|NIFTY SMLCAP 100", name: "NIFTY SMALLCAP 100" },
        { key: "NSE_INDEX|Nifty Commodities", name: "NIFTY COMMODITIES" },
        { key: "BSE_INDEX|BSE100", name: "BSE 100" },
        { key: "BSE_INDEX|BSEIPO", name: "BSE IPO" },
    ];

    const marketData = useMemo(() => {
        return indices
            .map((item) => {
                const d = market[item.key];

                if (!d || d.ltp == null || d.close == null) {
                    return null;
                }

                const price = Number(d.ltp);
                const close = Number(d.close);

                if (!Number.isFinite(price) || !Number.isFinite(close)) {
                    return null;
                }

                const change = price - close;
                const changePercent = close === 0 ? 0 : (change / close) * 100;

                return {
                    name: item.name,
                    price,
                    close,
                    change,
                    changePercent,
                    updatedAt: d.updatedAt,
                };
            })
            .filter(Boolean);
    }, [market]);

    return (
        <div
            className="home-section3"
            style={{
                backgroundColor: "white",
                marginTop: 0,
                marginBottom: 0,
                fontSize: "1.2rem",
                height: "3.5rem",
                borderBottom: ".25px solid rgba(0,0,0,.1)",
                borderTop: ".25px solid rgba(0,0,0,.1)",
                cursor: "pointer",
            }}
        >
            <div className="container" style={{ height: "3.5rem" }}>
                <div className="nav-div scroll-container">
                    <div className="scroll-content">
                        {marketData.length === 0 ? (
                            <div style={{ padding: "12px", fontWeight: 500 }}>
                                Loading Market Data...
                            </div>
                        ) : (
                            marketData.map((item) => (
                                <div
                                    className="scroll-content-div"
                                    key={item.name}
                                    style={{ fontSize: ".93rem" }}
                                >
                                    <p style={{ fontWeight: 500, marginLeft: ".5rem" }}>
                                        {item.name}
                                    </p>

                                    <p style={{ opacity: 0.95 }}>
                                        ₹{" "}
                                        {item.price.toLocaleString("en-IN", {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                        })}
                                    </p>

                                    <div
                                        style={{
                                            marginRight: ".5rem",
                                            color: item.change >= 0 ? "#00B386" : "#EF4444",
                                        }}
                                    >
                                        <p style={{ fontWeight: "500" }}>
                                            {item.change.toFixed(2)} ( {item.changePercent.toFixed(2)}
                                            %)
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
