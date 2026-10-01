// import React, { useState } from "react";
// import axios from "axios";

// export default function SignupSection1() {
//     const [form, setForm] = useState({
//         full_name: "",
//         phone: "",
//         email: "",
//         password: "",
//         confirmPassword: "",
//     });

//     const handleChange = (e) => {
//         setForm({
//             ...form,
//             [e.target.name]: e.target.value,
//         });
//     };

//     const signup = async (e) => {
//         e.preventDefault();

//         if (!form.full_name || !form.phone || !form.email || !form.password) {
//             alert("Please fill all fields");
//             return;
//         }

//         if (form.password !== form.confirmPassword) {
//             alert("Passwords do not match");
//             return;
//         }

//         try {
//             const res = await axios.post("http://localhost:3010/signup", {
//                 full_name: form.full_name,
//                 phone: form.phone,
//                 email: form.email,
//                 password: form.password,
//             });

//             alert(res.data.message);

//             setForm({
//                 full_name: "",
//                 phone: "",
//                 email: "",
//                 password: "",
//                 confirmPassword: "",
//             });
//         } catch (err) {
//             alert(err.response?.data?.message || "Signup Failed");
//         }
//     };

//     return (
//         <>
//             <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", }}>
//                 <div style={{ minWidth: "25rem", maxWidth: "40rem", }}>
//                     <h1 className="title" style={{ margin: 0 }}>Create a Demat Account</h1>

//                     <p className="subtitle" style={{ marginTop: ".75rem", marginBottom: "2rem", }}>
//                         Create a free account
//                     </p>

//                     <form className="signup-form" onSubmit={signup}>
//                         <div className="form-group">
//                             <label>Full Name</label>

//                             <input type="text" name="full_name" value={form.full_name} onChange={handleChange} placeholder="Enter Full Name" />
//                         </div>

//                         <div className="form-group">
//                             <label>Phone Number</label>

//                             <input type="text" name="phone" value={form.phone} onChange={handleChange} placeholder="Phone Number" />
//                         </div>

//                         <div className="form-group">
//                             <label>Email address</label>

//                             <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="Email Address" />
//                         </div>

//                         <div className="form-group">
//                             <label>Password</label>

//                             <input type="password" name="password" value={form.password} onChange={handleChange} placeholder="Password" />
//                         </div>

//                         <div className="form-group">
//                             <label>Repeat Password</label>

//                             <input type="password" name="confirmPassword" value={form.confirmPassword} onChange={handleChange} placeholder="Repeat Password" />
//                         </div>

//                         <div style={{ display: "flex", justifyContent: "space-between", gap: "1.5rem", }}>
//                             <button type="submit" className="signup-btn" style={{ width: "50%" }}>
//                                 Sign Up
//                             </button>

//                             <button type="button" className="signup-btn" style={{ width: "50%" }}>
//                                 Login
//                             </button>
//                         </div>
//                     </form>

//                     <div className="divider">
//                         <span>or</span>
//                     </div>

//                     <button className="google-btn">
//                         <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" alt="Google" />

//                         <span>Sign up with Google</span>
//                     </button>
//                 </div>

//                 <div style={{ height: "auto", width: "auto", overflow: "hidden", }} >
//                     <img src="./images/bg2.jpg" style={{ width: "50rem" }} alt="Signup" />
//                 </div>
//             </div>
//         </>
//     );
// }


























import React, {
    useState,
} from "react";

import {
    useNavigate,
} from "react-router-dom";

import {
    useAuth,
} from "../../context/AuthContext";


export default function SignupSection1() {

    const navigate =
        useNavigate();


    const {
        signup,
    } = useAuth();


    const [
        form,
        setForm,
    ] = useState({
        full_name:
            "",

        phone:
            "",

        email:
            "",

        password:
            "",

        confirmPassword:
            "",
    });


    const [
        error,
        setError,
    ] = useState("");


    const [
        success,
        setSuccess,
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
            setSuccess("");
        };


    const handleSubmit =
        async (event) => {

            event.preventDefault();

            setError("");
            setSuccess("");


            const fullName =
                form.full_name.trim();

            const phone =
                form.phone.trim();

            const email =
                form.email.trim()
                    .toLowerCase();


            if (
                !fullName ||
                !phone ||
                !email ||
                !form.password ||
                !form.confirmPassword
            ) {

                setError(
                    "Please fill all fields."
                );

                return;
            }


            if (
                form.password !==
                form.confirmPassword
            ) {

                setError(
                    "Passwords do not match."
                );

                return;
            }


            if (
                form.password.length <
                8
            ) {

                setError(
                    "Password must be at least 8 characters."
                );

                return;
            }


            try {

                setLoading(
                    true
                );


                await signup({
                    full_name:
                        fullName,

                    phone:
                        phone,

                    email:
                        email,

                    password:
                        form.password,
                });


                setSuccess(
                    "Account created successfully. Redirecting to login..."
                );


                setForm({
                    full_name:
                        "",

                    phone:
                        "",

                    email:
                        "",

                    password:
                        "",

                    confirmPassword:
                        "",
                });


                setTimeout(
                    () => {

                        navigate(
                            "/login",
                            {
                                replace:
                                    true,

                                state: {
                                    email,
                                },
                            }
                        );

                    },
                    800
                );

            } catch (err) {

                const message =
                    err.response?.data
                        ?.error?.message ||
                    err.response?.data
                        ?.message ||
                    "Signup failed.";


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
                    Create a Demat Account
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
                    Create a free account
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


                {success ? (
                    <div
                        style={{
                            marginBottom:
                                "1rem",

                            padding:
                                ".75rem 1rem",

                            borderRadius:
                                "8px",

                            background:
                                "#f0fdf4",

                            color:
                                "#166534",
                        }}
                    >
                        {success}
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
                            Full Name
                        </label>

                        <input
                            type="text"
                            name="full_name"
                            value={
                                form.full_name
                            }
                            onChange={
                                handleChange
                            }
                            placeholder="Enter Full Name"
                            autoComplete="name"
                            disabled={
                                loading
                            }
                        />
                    </div>


                    <div
                        className="form-group"
                    >
                        <label>
                            Phone Number
                        </label>

                        <input
                            type="tel"
                            name="phone"
                            value={
                                form.phone
                            }
                            onChange={
                                handleChange
                            }
                            placeholder="Phone Number"
                            autoComplete="tel"
                            disabled={
                                loading
                            }
                        />
                    </div>


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
                            placeholder="Email Address"
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
                            placeholder="Password"
                            autoComplete="new-password"
                            disabled={
                                loading
                            }
                        />
                    </div>


                    <div
                        className="form-group"
                    >
                        <label>
                            Repeat Password
                        </label>

                        <input
                            type="password"
                            name="confirmPassword"
                            value={
                                form.confirmPassword
                            }
                            onChange={
                                handleChange
                            }
                            placeholder="Repeat Password"
                            autoComplete="new-password"
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
                            ? "Creating account..."
                            : "Sign Up"}
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
                                "/login"
                            )
                        }
                        disabled={
                            loading
                        }
                    >
                        Already have an account? Login
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
                        Sign up with Google
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
                    alt="Signup"
                />
            </div>

        </div>
    );
}