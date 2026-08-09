import React from "react";

import SignupSection1 from "./SignupSection1.jsx";
import Login from "../Signup/Login.jsx";



export default function SignupWrapper() {
    return (
        <>
            <div className="home">
                <SignupSection1 />
                <Login />
            </div>
        </>
    );
}
    