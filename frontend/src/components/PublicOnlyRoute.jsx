import React from "react";

import {
    Navigate,
    Outlet,
    useLocation,
} from "react-router-dom";

import { useAuth } from "../context/AuthContext";


export default function PublicOnlyRoute() {

    const {
        status,
    } = useAuth();


    const location =
        useLocation();


    if (
        status ===
        "loading"
    ) {

        return (
            <div
                style={{
                    minHeight:
                        "60vh",

                    display:
                        "flex",

                    alignItems:
                        "center",

                    justifyContent:
                        "center",
                }}
            >
                Loading...
            </div>
        );
    }


    if (
        status ===
        "authenticated"
    ) {

        const requested =
            location.state?.from;


        return (
            <Navigate
                to={
                    requested &&
                    requested !==
                        "/login" &&
                    requested !==
                        "/signup"
                        ? requested
                        : "/dashboard/stocks/explore"
                }
                replace
            />
        );
    }


    return (
        <Outlet />
    );
}