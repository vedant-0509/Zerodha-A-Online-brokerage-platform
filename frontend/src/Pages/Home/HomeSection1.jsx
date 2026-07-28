import React from "react";
import { Link } from "react-router-dom";


export default function HomeSection1() {
    return (
        <div className="home-section1">
            <img src="./images/homeHero.png" alt="photo" />
            <h1>Invest in everything</h1>
            <p>Online platform to invest in stocks, derivatives, mutual funds, ETFs, bonds, and more.</p>
            <button>Sign up for free</button>
        </div>
    );
}