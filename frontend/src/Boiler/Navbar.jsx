import { Link } from "react-router-dom";
import { useState } from "react";

export default function Navbar() {

    const [active, setActive] = useState("");

    return(
        <>
            <div className="navbar">
                <div className="nav-section1">
                    <Link to="/home" onClick={() => setActive("home")} className={active === "home" ? "active-link" : ""}>
                        <img src="/images/logo.svg" alt="Logo" className="logo"/>
                    </Link>
                </div>

                <div className="nav-section2">
                    <Link to="/signup" onClick={() => setActive("signup")} className={active === "signup" ? "active-link" : ""}>Signup</Link>

                    <Link to="/product" onClick={() => setActive("product")} className={active === "product" ? "active-link" : ""}>Products</Link>
          
                    <Link to="/pricing" onClick={() => setActive("pricing")} className={active === "pricing" ? "active-link" : ""}>Pricing</Link>
          
                    <Link to="/about" onClick={() => setActive("about")} className={active === "about" ? "active-link" : ""}>About</Link>
          
                    <Link to="/support" onClick={() => setActive("support")} className={active === "support" ? "active-link" : ""}>Support</Link>

                    <Link to="/dashboard" onClick={() => setActive("dashboard")} className={active === "dashboard" ? "active-link" : ""}>Dashboard</Link>
          
                    <div className="menu-logo">
                        <i className="fa-solid fa-bars"></i>
                    </div>
                </div>
            </div>
        </>
    );
}