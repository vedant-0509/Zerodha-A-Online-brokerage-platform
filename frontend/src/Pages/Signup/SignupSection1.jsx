import React, { useState } from "react";
import axios from "axios";

export default function SignupSection1() {
    const [form, setForm] = useState({
        full_name: "",
        phone: "",
        email: "",
        password: "",
        confirmPassword: "",
    });

    const handleChange = (e) => {
        setForm({
            ...form,
            [e.target.name]: e.target.value,
        });
    };

    const signup = async (e) => {
        e.preventDefault();

        if (!form.full_name || !form.phone || !form.email || !form.password) {
            alert("Please fill all fields");
            return;
        }

        if (form.password !== form.confirmPassword) {
            alert("Passwords do not match");
            return;
        }

        try {
            const res = await axios.post("http://localhost:3010/signup", {
                full_name: form.full_name,
                phone: form.phone,
                email: form.email,
                password: form.password,
            });

            alert(res.data.message);

            setForm({
                full_name: "",
                phone: "",
                email: "",
                password: "",
                confirmPassword: "",
            });
        } catch (err) {
            alert(err.response?.data?.message || "Signup Failed");
        }
    };

    return (
        <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", }}>
                <div style={{ minWidth: "25rem", maxWidth: "40rem", }}>
                    <h1 className="title" style={{ margin: 0 }}>Create a Demat Account</h1>

                    <p className="subtitle" style={{ marginTop: ".75rem", marginBottom: "2rem", }}>
                        Create a free account
                    </p>

                    <form className="signup-form" onSubmit={signup}>
                        <div className="form-group">
                            <label>Full Name</label>

                            <input type="text" name="full_name" value={form.full_name} onChange={handleChange} placeholder="Enter Full Name" />
                        </div>

                        <div className="form-group">
                            <label>Phone Number</label>

                            <input type="text" name="phone" value={form.phone} onChange={handleChange} placeholder="Phone Number" />
                        </div>

                        <div className="form-group">
                            <label>Email address</label>

                            <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="Email Address" />
                        </div>

                        <div className="form-group">
                            <label>Password</label>

                            <input type="password" name="password" value={form.password} onChange={handleChange} placeholder="Password" />
                        </div>

                        <div className="form-group">
                            <label>Repeat Password</label>

                            <input type="password" name="confirmPassword" value={form.confirmPassword} onChange={handleChange} placeholder="Repeat Password" />
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", gap: "1.5rem", }}>
                            <button type="submit" className="signup-btn" style={{ width: "50%" }}>
                                Sign Up
                            </button>

                            <button type="button" className="signup-btn" style={{ width: "50%" }}>
                                Login
                            </button>
                        </div>
                    </form>

                    <div className="divider">
                        <span>or</span>
                    </div>

                    <button className="google-btn">
                        <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" alt="Google" />

                        <span>Sign up with Google</span>
                    </button>
                </div>

                <div style={{ height: "auto", width: "auto", overflow: "hidden", }} >
                    <img src="./images/bg2.jpg" style={{ width: "50rem" }} alt="Signup" />
                </div>
            </div>
        </>
    );
}
