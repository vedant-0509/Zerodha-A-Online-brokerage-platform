import React from "react";
import { Link } from "react-router-dom";

export default function HomeSection3() {
    return (
        <div className="home-section3">
            <div className="container">
                <img src="./images/kc-logo-landing.svg" />
                <p>Need more? Build your own trading and investing experience with Kite Connect, simple HTTP APIs to place orders, stream market data, manage your account, and more. <Link>Explore <i class="fa-solid fa-arrow-right"></i></Link></p>
                <img src="./images/kc-banner-image.svg" />
            </div>
        </div>
    );
}