import React from "react";

import ProductSection1 from "./ProductSection1.jsx";
import ProductSection2 from "./ProductSection2.jsx";
import LeftDiv from "./LeftDiv.jsx";
import RightDiv from "./RightDiv.jsx";


export default function ProductWrapper() {
    return (
        <>
            <div className="home">
                <ProductSection1 />
                
                <LeftDiv url="kite.png" desc="Our ultra-fast flagship trading platform with streaming market data, advanced charts, an elegant UI, and more. Enjoy the Kite experience seamlessly on your Android and iOS devices." name="Kite" gplay="googlePlayBadge.svg" appStore="appstoreBadge.svg" />
                
                <RightDiv url="console.png" desc="The central dashboard for your Zerodha account. Gain insights into your trades and investments with in-depth reports and visualisations." name="Console" gplay="" appStore="" margin="-3rem"/>

                <LeftDiv url="coin.png" desc="Buy direct mutual funds online, commission-free, delivered directly to your Demat account. Enjoy the investment experience on your Android and iOS devices." name="Coin" gplay="googlePlayBadge.svg" appStore="appstoreBadge.svg" />

                <RightDiv url="kiteconnect.png" desc="Build powerful trading platforms and experiences with our super simple HTTP/JSON APIs. If you are a startup, build your investment app and showcase it to our clientbase." name="Kite Connect API" gplay="" appStore=""/>

                <LeftDiv url="varsity.png" desc="An easy to grasp, collection of stock market lessons with in-depth coverage and illustrations. Content is broken down into bite-size cards to help you learn on the go." name="Varsity mobile" gplay="googlePlayBadge.svg" appStore="appstoreBadge.svg" height="36rem" width="35rem" />

                <ProductSection2 />
            </div>
        </>
    );
}
