import React, { useState } from "react";

import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [form, setForm] = useState({
    email: location.state?.email || "",
    password: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    setForm((old) => ({
      ...old,
      [event.target.name]: event.target.value,
    }));

    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");

    const email = form.email.trim();

    if (!email || !form.password) {
      setError("Please enter email and password.");
      return;
    }

    try {
      setLoading(true);
      await login({
        email,
        password: form.password,
      });

      const from = location.state?.from;
      const destination = from && !from.startsWith("/login") && !from.startsWith("/signup") ? from : "/dashboard/stocks/explore";
      navigate(destination, { replace: true, });
    } catch (err) {
      const message = err.response?.data?.error?.message || err.response?.data?.message || "Login failed. Please check your credentials.";

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="home">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", }}>
        <div style={{ minWidth: "25rem", maxWidth: "40rem", }}>
          <h1 className="title" style={{ margin: 0, }}>
            Welcome Back
          </h1>

          <p className="subtitle" style={{ marginTop: ".75rem", marginBottom: "2rem", }}>
            Login to your Zerodha account
          </p>

          {error ? (
            <div style={{ marginBottom: "1rem", padding: ".75rem 1rem", borderRadius: "8px", background: "#fff1f2", color: "#be123c", }}>
              {error}
            </div>
          ) : null}

          <form className="signup-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Email address</label>

              <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="Enter Email" autoComplete="email" disabled={loading} />
            </div>

            <div className="form-group">
              <label>Password</label>

              <input type="password" name="password" value={form.password} onChange={handleChange} placeholder="Enter Password" autoComplete="current-password" disabled={loading} />
            </div>

            <button type="submit" className="signup-btn" style={{ width: "100%", }} disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>

            <button
              type="button"
              className="signup-btn"
              style={{ width: "100%", marginTop:"-.3rem" }}
              onClick={() => navigate("/signup")}
              disabled={loading}
            >
              Create Account
            </button>
          </form>
        </div>

        <div style={{ height: "auto", width: "auto", overflow: "hidden", }}>
          <img src="/images/bg2.jpg" style={{ width: "50rem" }} alt="Login" />
        </div>
      </div>
    </div>
  );
}
