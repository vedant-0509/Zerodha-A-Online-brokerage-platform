import { Link, useNavigate } from "react-router-dom";

import { useState } from "react";

import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const [active, setActive] = useState("");

  const { isAuthenticated, user, logout } = useAuth();

  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();

    setActive("");

    navigate("/login", {
      replace: true,
    });
  };

  return (
    <div className="navbar">
      <div className="nav-section1">
        <Link to="/home" onClick={() => setActive("home")} className={active === "home" ? "active-link" : ""}>
          <img src="/images/logo.svg" alt="Logo" className="logo" />
        </Link>
      </div>

      <div className="nav-section2">
        <Link to="/product" onClick={() => setActive("product")} className={active === "product" ? "active-link" : ""}>
          Products
        </Link>

        <Link to="/pricing" onClick={() => setActive("pricing")} className={active === "pricing" ? "active-link" : ""}>
          Pricing
        </Link>

        <Link to="/about" onClick={() => setActive("about")} className={active === "about" ? "active-link" : ""}>
          About
        </Link>

        <Link to="/support" onClick={() => setActive("support")} className={active === "support" ? "active-link" : ""}>
          Support
        </Link>

        {!isAuthenticated ? (
          <>
            <Link to="/login" onClick={() => setActive("login")} className={active === "login" ? "active-link" : ""}            >
              Login
            </Link>

            <Link to="/signup" onClick={() => setActive("signup")} className={active === "signup" ? "active-link" : ""}            >
              Signup
            </Link>
          </>
        ) : (
          <>
            <Link to="/dashboard/stocks/explore" onClick={() => setActive("dashboard")} className={active === "dashboard" ? "active-link" : ""}>
              Dashboard
            </Link>

            <button type="button" onClick={handleLogout} style={{ border: 0, background: "transparent", cursor: "pointer", font: "inherit", }}>
              <div className="logouthov">
                <i style={{color:"#474747"}} class="fa-solid fa-right-from-bracket"></i>
              </div>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
