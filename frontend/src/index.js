// import React from "react";
// import ReactDOM from "react-dom/client";
// import "./index.css";

// import Home from "./Pages/Home/Home.js";
// import About from "./Pages/About/About.js";
// import Pricing from "./Pages/Pricing/Pricing.js";
// import Product from "./Pages/Product/Product.js";
// import Support from "./Pages/Support/Support.js";
// import Dashboard from "./Pages/Dashboard/Dashboard.js";
// import Signup from "./Pages/Signup/Signup.js";
// import ProtectedRoute from "./components/ProtectedRoute.jsx"

// import { BrowserRouter, Routes, Route } from "react-router-dom";

// // import Signup from './Boiler/Signup';
// import Navbar from "./Boiler/Navbar";
// import Footer from "./Boiler/Footer";

// const root = ReactDOM.createRoot(document.getElementById("root"));
// root.render(
//   <BrowserRouter>
//     <Navbar />
//     <Routes>
//       <Route path="/" element={<Home />} />
//       <Route path="/home" element={<Home />} />
//       <Route path="/about" element={<About />} />
//       <Route path="/pricing" element={<Pricing />} />
//       <Route path="/product" element={<Product />} />
//       <Route path="/support" element={<Support />} />
//       {/* <Route path="/dashboard/*" element={<Dashboard />} /> */}
//       <Route element={<ProtectedRoute />}>
//         <Route path="/dashboard/*" element={<Dashboard />} />
//       </Route>
//       <Route path="/signup" element={<Signup />} />
//     </Routes>
//     <Footer />
//   </BrowserRouter>,
// );
















import React from "react";
import ReactDOM from "react-dom/client";

import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import "./index.css";

import Home from "./Pages/Home/Home.js";
import About from "./Pages/About/About.js";
import Pricing from "./Pages/Pricing/Pricing.js";
import Product from "./Pages/Product/Product.js";
import Support from "./Pages/Support/Support.js";

import Dashboard from "./Pages/Dashboard/Dashboard.js";

import Signup from "./Pages/Signup/Signup.js";
import Login from "./Pages/Signup/Login.jsx";

import ProtectedRoute from "./components/ProtectedRoute.jsx";
import PublicOnlyRoute from "./components/PublicOnlyRoute.jsx";

import { AuthProvider } from "./context/AuthContext";

import Navbar from "./Boiler/Navbar";
import Footer from "./Boiler/Footer";

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <BrowserRouter>
    <AuthProvider>
      <Navbar />

      <Routes>
        {/* ==================================================
                    PUBLIC PAGES
            ================================================== */}

        <Route path="/" element={<Home />} />

        <Route path="/home" element={<Home />} />

        <Route path="/about" element={<About />} />

        <Route path="/pricing" element={<Pricing />} />

        <Route path="/product" element={<Product />} />

        <Route path="/support" element={<Support />} />

        {/* ==================================================
                    LOGIN / SIGNUP
                    Authenticated users are redirected away.
            ================================================== */}

        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<Login />} />

          <Route path="/signup" element={<Signup />} />
        </Route>

        {/* ==================================================
                    PROTECTED APPLICATION
                    EVERYTHING under /dashboard/*
                    requires authentication.
            ================================================== */}

        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard/*" element={<Dashboard />} />
        </Route>

        {/* ==================================================
                    FALLBACK
            ================================================== */}

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Footer />
    </AuthProvider>
  </BrowserRouter>,
);
