import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function LoginSection1() {
    const navigate = useNavigate();

    const [form, setForm] = useState({
        email: "",
        password: "",
    });

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const login = async (e) => {
        e.preventDefault();

        if (!form.email || !form.password) {
            alert("Please fill all fields");
            return;
        }

        try {
            const res = await axios.post("http://localhost:3010/login", {
                email: form.email,
                password: form.password,
            });

            localStorage.setItem("token", res.data.token);

            localStorage.setItem("user", JSON.stringify(res.data.user));

            alert("Login Successful");
            navigate("/dashboard/stocks/explore");
        } catch (err) {
            alert(err.response?.data?.message || "Login Failed");
        }
    };

    return (
        <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", }}>
                <div style={{ minWidth: "25rem", maxWidth: "40rem", }}>
                    <h1 className="title" style={{ margin: 0 }}>
                        Welcome Back
                    </h1>

                    <p className="subtitle" style={{ marginTop: ".75rem", marginBottom: "2rem", }}>
                        Login to your Zerodha account
                    </p>

                    <form className="signup-form" onSubmit={login}>
                        <div className="form-group">
                            <label>Email address</label>

                            <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="Enter Email" />
                        </div>

                        <div className="form-group">
                            <label>Password</label>

                            <input type="password" name="password" value={form.password} onChange={handleChange} placeholder="Enter Password" />
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", gap: "1.5rem", }}>
                            <button type="submit" className="signup-btn" style={{ width: "50%" }}>
                                Login
                            </button>

                            <button type="button" className="signup-btn" style={{ width: "50%" }} onClick={() => navigate("/signup")}>
                                Sign Up
                            </button>
                        </div>
                    </form>

                    <div className="divider">
                        <span>or</span>
                    </div>

                    <button className="google-btn">
                        <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" alt="Google" />

                        <span>Continue with Google</span>
                    </button>
                </div>

                <div style={{ height: "auto", width: "auto", overflow: "hidden", }}>
                    <img src="./images/bg2.jpg" style={{ width: "50rem" }} alt="Login" />
                </div>
            </div>
        </>
    );
}
