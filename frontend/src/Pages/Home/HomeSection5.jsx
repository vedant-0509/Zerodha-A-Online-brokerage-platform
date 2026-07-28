import React from "react";
import { Link } from "react-router-dom";

export default function HomeSection5() {
    return (
        <div className="home-section5">
            <div className="home-section5-div1">
                <img src="./images/education.svg" />
            </div>
            <div className="home-section5-div2">
                <h2>Free and open market education</h2>
                <p>
                    Varsity, the largest online stock market education book in the world
                    covering everything from the basics to advanced trading.
                </p>
                <Link>
                    Varsity <i class="fa-solid fa-arrow-right"></i>
                </Link>
                <p>
                    TradingQ&A, the most active trading and investment community in India
                    for all your market related queries.
                </p>
                <Link>
                    TradingQ&A <i class="fa-solid fa-arrow-right"></i>
                </Link>
            </div>
        </div>
    );
}
