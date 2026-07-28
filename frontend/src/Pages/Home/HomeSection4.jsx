import React from "react";
import { Link } from "react-router-dom";

export default function HomeSection4() {
    return (
        <div className="home-section4">
            <div className="home-section4-div1">
                <h2>Unbeatable pricing</h2>
                <p>We pioneered the concept of discount broking and price transparency in India. Flat fees and no hidden charges.</p>
                <Link>See pricing<i class="fa-solid fa-arrow-right"></i></Link>
            </div>
            <div className="home-section4-div2">
                <img src="./images/pricing.png" />
            </div>
        </div>
    );
}