import React from 'react';
import ReactDOM from 'react-dom/client';
import "./index.css";

import Home from './Pages/Home/Home.js';
import About from './Pages/About/About.js';
import Pricing from './Pages/Pricing/Pricing.js';
import Product from './Pages/Product/Product.js';
import Support from './Pages/Support/Support.js';
import Dashboard from './Pages/Dashboard/Dashboard.js';

import {BrowserRouter, Routes, Route} from 'react-router-dom';

import Signup from './Boiler/Signup';
import Navbar from './Boiler/Navbar';
import Footer from './Boiler/Footer';


const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <BrowserRouter>
    <Navbar />
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/home" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/product" element={<Product />} />
      <Route path="/support" element={<Support />} />
      <Route path="/dashboard/*" element={<Dashboard />} />
    </Routes>
    <Footer />
  </BrowserRouter>
);