import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

import api from "../api/client";


const AuthContext =
    createContext(null);


function clearStoredSession() {
    localStorage.removeItem(
        "token"
    );

    localStorage.removeItem(
        "user"
    );
}


export function AuthProvider({
    children,
}) {
    const [
        user,
        setUser,
    ] = useState(null);


    const [
        status,
        setStatus,
    ] = useState("loading");


    /*
    |--------------------------------------------------------------------------
    | LOAD EXISTING SESSION
    |--------------------------------------------------------------------------
    */

    const loadSession =
        useCallback(
            async () => {

                const token =
                    localStorage.getItem(
                        "token"
                    );


                if (!token) {

                    setUser(null);
                    setStatus(
                        "unauthenticated"
                    );

                    return;
                }


                try {

                    const response =
                        await api.get(
                            "/me"
                        );


                    const currentUser =
                        response.data?.user;


                    if (!currentUser) {
                        throw new Error(
                            "Invalid /me response"
                        );
                    }


                    /*
                    Save the authoritative
                    database user.
                    */

                    localStorage.setItem(
                        "user",
                        JSON.stringify(
                            currentUser
                        )
                    );


                    setUser(
                        currentUser
                    );

                    setStatus(
                        "authenticated"
                    );

                } catch (error) {

                    clearStoredSession();

                    setUser(null);

                    setStatus(
                        "unauthenticated"
                    );
                }
            },
            []
        );


    /*
    |--------------------------------------------------------------------------
    | INITIAL SESSION CHECK
    |--------------------------------------------------------------------------
    */

    useEffect(
        () => {

            let mounted =
                true;


            async function initialize() {

                if (!mounted) {
                    return;
                }

                await loadSession();
            }


            initialize();


            return () => {
                mounted = false;
            };

        },
        [loadSession]
    );


    /*
    |--------------------------------------------------------------------------
    | AUTH EXPIRED EVENT
    |--------------------------------------------------------------------------
    */

    useEffect(
        () => {

            const handleExpired =
                () => {

                    clearStoredSession();

                    setUser(null);

                    setStatus(
                        "unauthenticated"
                    );
                };


            window.addEventListener(
                "auth-expired",
                handleExpired
            );


            return () => {

                window.removeEventListener(
                    "auth-expired",
                    handleExpired
                );
            };

        },
        []
    );


    /*
    |--------------------------------------------------------------------------
    | LOGIN
    |--------------------------------------------------------------------------
    */

    const login =
        useCallback(
            async ({
                email,
                password,
            }) => {

                const response =
                    await api.post(
                        "/login",
                        {
                            email,
                            password,
                        }
                    );


                const token =
                    response.data?.token;


                if (!token) {

                    throw new Error(
                        "Login response did not contain a token."
                    );
                }


                /*
                Save token first so /me
                automatically receives it.
                */

                localStorage.setItem(
                    "token",
                    token
                );


                /*
                Use /me as the authoritative
                session/user response.
                */

                try {

                    const meResponse =
                        await api.get(
                            "/me"
                        );


                    const currentUser =
                        meResponse.data?.user;


                    if (!currentUser) {
                        throw new Error(
                            "Unable to load authenticated user."
                        );
                    }


                    localStorage.setItem(
                        "user",
                        JSON.stringify(
                            currentUser
                        )
                    );


                    setUser(
                        currentUser
                    );

                    setStatus(
                        "authenticated"
                    );


                    return currentUser;

                } catch (error) {

                    clearStoredSession();

                    setUser(null);

                    setStatus(
                        "unauthenticated"
                    );

                    throw error;
                }
            },
            []
        );


    /*
    |--------------------------------------------------------------------------
    | SIGNUP
    |--------------------------------------------------------------------------
    */

    const signup =
        useCallback(
            async (payload) => {

                const response =
                    await api.post(
                        "/signup",
                        payload
                    );


                return response.data;
            },
            []
        );


    /*
    |--------------------------------------------------------------------------
    | LOGOUT
    |--------------------------------------------------------------------------
    */

    const logout =
        useCallback(
            async () => {

                const token =
                    localStorage.getItem(
                        "token"
                    );


                /*
                Acknowledge logout on the server
                when possible.
                */

                if (token) {

                    try {

                        await api.post(
                            "/logout"
                        );

                    } catch (_) {
                        /*
                        Even if the server call fails,
                        the browser session must still
                        be cleared.
                        */
                    }
                }


                clearStoredSession();

                setUser(null);

                setStatus(
                    "unauthenticated"
                );
            },
            []
        );


    const value =
        useMemo(
            () => ({
                user,

                status,

                isLoading:
                    status ===
                    "loading",

                isAuthenticated:
                    status ===
                    "authenticated",

                login,

                signup,

                logout,

                reloadSession:
                    loadSession,
            }),

            [
                user,
                status,
                login,
                signup,
                logout,
                loadSession,
            ]
        );


    return (
        <AuthContext.Provider
            value={value}
        >
            {children}
        </AuthContext.Provider>
    );
}


export function useAuth() {

    const context =
        useContext(
            AuthContext
        );


    if (!context) {

        throw new Error(
            "useAuth must be used inside AuthProvider"
        );
    }


    return context;
}