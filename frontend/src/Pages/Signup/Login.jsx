// import React, { useState } from "react";
// import axios from "axios";
// import { useNavigate } from "react-router-dom";

// export default function LoginSection1() {
//     const navigate = useNavigate();

//     const [form, setForm] = useState({
//         email: "",
//         password: "",
//     });

//     const handleChange = (e) => {
//         setForm({ ...form, [e.target.name]: e.target.value });
//     };

//     const login = async (e) => {
//         e.preventDefault();

//         if (!form.email || !form.password) {
//             alert("Please fill all fields");
//             return;
//         }

//         try {
//             const res = await axios.post("http://localhost:3010/login", {
//                 email: form.email,
//                 password: form.password,
//             });

//             localStorage.setItem("token", res.data.token);

//             localStorage.setItem("user", JSON.stringify(res.data.user));

//             alert("Login Successful");
//             navigate("/dashboard/stocks/explore");
//         } catch (err) {
//             alert(err.response?.data?.message || "Login Failed");
//         }
//     };

//     return (
//         <>
//             <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", }}>
//                 <div style={{ minWidth: "25rem", maxWidth: "40rem", }}>
//                     <h1 className="title" style={{ margin: 0 }}>
//                         Welcome Back
//                     </h1>

//                     <p className="subtitle" style={{ marginTop: ".75rem", marginBottom: "2rem", }}>
//                         Login to your Zerodha account
//                     </p>

//                     <form className="signup-form" onSubmit={login}>
//                         <div className="form-group">
//                             <label>Email address</label>

//                             <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="Enter Email" />
//                         </div>

//                         <div className="form-group">
//                             <label>Password</label>

//                             <input type="password" name="password" value={form.password} onChange={handleChange} placeholder="Enter Password" />
//                         </div>

//                         <div style={{ display: "flex", justifyContent: "space-between", gap: "1.5rem", }}>
//                             <button type="submit" className="signup-btn" style={{ width: "50%" }}>
//                                 Login
//                             </button>

//                             <button type="button" className="signup-btn" style={{ width: "50%" }} onClick={() => navigate("/signup")}>
//                                 Sign Up
//                             </button>
//                         </div>
//                     </form>

//                     <div className="divider">
//                         <span>or</span>
//                     </div>

//                     <button className="google-btn">
//                         <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" alt="Google" />

//                         <span>Continue with Google</span>
//                     </button>
//                 </div>

//                 <div style={{ height: "auto", width: "auto", overflow: "hidden", }}>
//                     <img src="./images/bg2.jpg" style={{ width: "50rem" }} alt="Login" />
//                 </div>
//             </div>
//         </>
//     );
// }






































import React, {
    useState,
} from "react";

import {
    useLocation,
    useNavigate,
} from "react-router-dom";

import {
    useAuth,
} from "../../context/AuthContext";


export default function Login() {

    const navigate =
        useNavigate();


    const location =
        useLocation();


    const {
        login,
    } = useAuth();


    const [
        form,
        setForm,
    ] = useState({
        email:
            location.state?.email ||
            "",

        password:
            "",
    });


    const [
        error,
        setError,
    ] = useState("");


    const [
        loading,
        setLoading,
    ] = useState(false);


    const handleChange =
        (event) => {

            setForm(
                (old) => ({
                    ...old,

                    [event.target.name]:
                        event.target.value,
                })
            );

            setError("");
        };


    const handleSubmit =
        async (event) => {

            event.preventDefault();

            setError("");


            const email =
                form.email.trim();


            if (
                !email ||
                !form.password
            ) {

                setError(
                    "Please enter email and password."
                );

                return;
            }


            try {

                setLoading(
                    true
                );


                await login({
                    email,
                    password:
                        form.password,
                });


                /*
                Redirect to the page the user originally
                requested, otherwise dashboard.
                */

                const from =
                    location.state?.from;


                const destination =
                    from &&
                    !from.startsWith(
                        "/login"
                    ) &&
                    !from.startsWith(
                        "/signup"
                    )
                        ? from
                        : "/dashboard/stocks/explore";


                navigate(
                    destination,
                    {
                        replace:
                            true,
                    }
                );

            } catch (err) {

                const message =
                    err.response?.data
                        ?.error?.message ||
                    err.response?.data
                        ?.message ||
                    "Login failed. Please check your credentials.";


                setError(
                    message
                );

            } finally {

                setLoading(
                    false
                );
            }
        };


    return (
        <div
            className="home"
        >
            <div
                style={{
                    display:
                        "flex",

                    alignItems:
                        "center",

                    justifyContent:
                        "space-between",
                }}
            >

                <div
                    style={{
                        minWidth:
                            "25rem",

                        maxWidth:
                            "40rem",
                    }}
                >

                    <h1
                        className="title"
                        style={{
                            margin: 0,
                        }}
                    >
                        Welcome Back
                    </h1>


                    <p
                        className="subtitle"
                        style={{
                            marginTop:
                                ".75rem",

                            marginBottom:
                                "2rem",
                        }}
                    >
                        Login to your Zerodha account
                    </p>


                    {error ? (
                        <div
                            style={{
                                marginBottom:
                                    "1rem",

                                padding:
                                    ".75rem 1rem",

                                borderRadius:
                                    "8px",

                                background:
                                    "#fff1f2",

                                color:
                                    "#be123c",
                            }}
                        >
                            {error}
                        </div>
                    ) : null}


                    <form
                        className="signup-form"
                        onSubmit={
                            handleSubmit
                        }
                    >

                        <div
                            className="form-group"
                        >
                            <label>
                                Email address
                            </label>

                            <input
                                type="email"
                                name="email"
                                value={
                                    form.email
                                }
                                onChange={
                                    handleChange
                                }
                                placeholder="Enter Email"
                                autoComplete="email"
                                disabled={
                                    loading
                                }
                            />
                        </div>


                        <div
                            className="form-group"
                        >
                            <label>
                                Password
                            </label>

                            <input
                                type="password"
                                name="password"
                                value={
                                    form.password
                                }
                                onChange={
                                    handleChange
                                }
                                placeholder="Enter Password"
                                autoComplete="current-password"
                                disabled={
                                    loading
                                }
                            />
                        </div>


                        <button
                            type="submit"
                            className="signup-btn"
                            style={{
                                width:
                                    "100%",
                            }}
                            disabled={
                                loading
                            }
                        >
                            {loading
                                ? "Logging in..."
                                : "Login"}
                        </button>


                        <button
                            type="button"
                            className="signup-btn"
                            style={{
                                width:
                                    "100%",
                                marginTop:
                                    ".75rem",
                            }}
                            onClick={() =>
                                navigate(
                                    "/signup"
                                )
                            }
                            disabled={
                                loading
                            }
                        >
                            Create Account
                        </button>

                    </form>


                    <div
                        className="divider"
                    >
                        <span>
                            or
                        </span>
                    </div>


                    <button
                        type="button"
                        className="google-btn"
                        disabled
                        title="Google authentication is not configured yet"
                    >
                        <span>
                            Continue with Google
                        </span>
                    </button>

                </div>


                <div
                    style={{
                        height:
                            "auto",

                        width:
                            "auto",

                        overflow:
                            "hidden",
                    }}
                >
                    <img
                        src="/images/bg2.jpg"
                        style={{
                            width:
                                "50rem",
                        }}
                        alt="Login"
                    />
                </div>

            </div>
        </div>
    );
}