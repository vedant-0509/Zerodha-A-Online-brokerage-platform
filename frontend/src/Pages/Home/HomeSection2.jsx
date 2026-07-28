import React from "react";
import { Link } from "react-router-dom";

export default function HomeSection2() {
    return (
        <div className="home-section2">
            <div className="home-section2-div1">
                <h2>Trust with confidence</h2>
                <div className="subdiv1">
                    <h3>Customer-first always</h3>
                    <p>
                        That's why 1.6+ crore customers trust Zerodha with ~ ₹6 lakh crores
                        of equity investments, making us India’s largest broker;
                        contributing to 15% of daily retail exchange volumes in India.
                    </p>
                </div>
                <div className="subdiv1">
                    <h3>No spam or gimmicks</h3>
                    <p>
                        No gimmicks, spam, "gamification", or annoying push notifications.
                        High quality apps that you use at your pace, the way you like.{" "}
                        <Link>Our philosophies.</Link>
                    </p>
                </div>
                <div className="subdiv1">
                    <h3>The Zerodha universe</h3>
                    <p>
                        Not just an app, but a whole ecosystem. Our investments in 30+
                        fintech startups offer you tailored services specific to your needs.
                    </p>
                </div>
                <div className="subdiv1">
                    <h3>Do better with money</h3>
                    <p>
                        With initiatives like <Link>Nudge</Link> and{" "}
                        <Link>Kill Switch</Link>, we don't just facilitate transactions, but
                        actively help you do better with your money.
                    </p>
                </div>
            </div>
            <div className="home-section2-div2">
                <img src="./images/ecosystem.png" />
                <div>
                    <Link>Explore our Products</Link>
                    <i class="fa-solid fa-arrow-right"></i>
                    <Link>Try Kite demo</Link>
                    <i class="fa-solid fa-arrow-right"></i>
                </div>
            </div>
        </div>
    );
}
