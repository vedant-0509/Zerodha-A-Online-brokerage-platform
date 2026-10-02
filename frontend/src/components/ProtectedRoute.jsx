import React from "react";
import {
    Navigate,
    Outlet,
    useLocation,
} from "react-router-dom";

import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute() {
    const {
        user,
        status,
    } = useAuth();

    const location =
        useLocation();

    if (status === "loading") {
        return (
            <div
                style={{
                    padding: "40px",
                    textAlign: "center",
                }}
            >
                Loading...
            </div>
        );
    }

    if (
        status !==
            "authenticated" ||
        !user
    ) {
        return (
            <Navigate
                to="/login"
                replace
                state={{
                    from: location,
                }}
            />
        );
    }

    return <Outlet />;
}