import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import api from "../api/client";

const AuthContext = createContext(null);

const AUTH_STATUS = {
  LOADING: "loading",
  AUTHENTICATED: "authenticated",
  UNAUTHENTICATED: "unauthenticated",
};

function clearStoredSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

function saveStoredUser(user) {
  if (user) {
    localStorage.setItem(
      "user",
      JSON.stringify(user)
    );
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const [status, setStatus] =
    useState(AUTH_STATUS.LOADING);

  /*
  |--------------------------------------------------------------------------
  | GET CURRENT AUTHENTICATED USER
  |--------------------------------------------------------------------------
  */

  const fetchCurrentUser =
    useCallback(async () => {
      const response =
        await api.get("/auth/me");

      const currentUser =
        response.data?.user;

      if (!currentUser) {
        throw new Error(
          "Invalid /me response"
        );
      }

      saveStoredUser(currentUser);

      setUser(currentUser);

      setStatus(
        AUTH_STATUS.AUTHENTICATED
      );

      return currentUser;
    }, []);

  /*
  |--------------------------------------------------------------------------
  | LOAD EXISTING SESSION
  |--------------------------------------------------------------------------
  */

  const loadSession =
    useCallback(async () => {
      const token =
        localStorage.getItem("token");

      if (!token) {
        setUser(null);

        setStatus(
          AUTH_STATUS.UNAUTHENTICATED
        );

        return null;
      }

      try {
        return await fetchCurrentUser();
      } catch (error) {
        clearStoredSession();

        setUser(null);

        setStatus(
          AUTH_STATUS.UNAUTHENTICATED
        );

        return null;
      }
    }, [fetchCurrentUser]);

  /*
  |--------------------------------------------------------------------------
  | INITIAL SESSION CHECK
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    let mounted = true;

    const initialize =
      async () => {
        if (!mounted) {
          return;
        }

        await loadSession();
      };

    initialize();

    return () => {
      mounted = false;
    };
  }, [loadSession]);

  /*
  |--------------------------------------------------------------------------
  | EXPIRED / INVALID SESSION
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    const handleAuthExpired =
      () => {
        clearStoredSession();

        setUser(null);

        setStatus(
          AUTH_STATUS.UNAUTHENTICATED
        );
      };

    window.addEventListener(
      "auth-expired",
      handleAuthExpired
    );

    return () => {
      window.removeEventListener(
        "auth-expired",
        handleAuthExpired
      );
    };
  }, []);

  /*
  |--------------------------------------------------------------------------
  | MULTI-TAB LOGOUT
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    const handleStorage =
      (event) => {
        if (event.key !== "token") {
          return;
        }

        if (!event.newValue) {
          setUser(null);

          setStatus(
            AUTH_STATUS.UNAUTHENTICATED
          );
        }
      };

    window.addEventListener(
      "storage",
      handleStorage
    );

    return () => {
      window.removeEventListener(
        "storage",
        handleStorage
      );
    };
  }, []);

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
            "/auth/login",
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
        Store token first.
        The API interceptor then sends it to /me.
        */

        localStorage.setItem(
          "token",
          token
        );

        try {
          return await fetchCurrentUser();
        } catch (error) {
          clearStoredSession();

          setUser(null);

          setStatus(
            AUTH_STATUS.UNAUTHENTICATED
          );

          throw error;
        }
      },
      [fetchCurrentUser]
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
            "/auth/signup",
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
        Server logout is best effort.
        Browser session is always cleared.
        */

        if (token) {
          try {
            await api.post(
              "/logout"
            );
          } catch (_) {
            // Local logout still succeeds.
          }
        }

        clearStoredSession();

        setUser(null);

        setStatus(
          AUTH_STATUS.UNAUTHENTICATED
        );
      },
      []
    );

  /*
  |--------------------------------------------------------------------------
  | CONTEXT VALUE
  |--------------------------------------------------------------------------
  */

  const value =
    useMemo(
      () => ({
        user,

        status,

        isLoading:
          status ===
          AUTH_STATUS.LOADING,

        isAuthenticated:
          status ===
          AUTH_STATUS.AUTHENTICATED,

        login,

        signup,

        logout,

        reloadSession:
          loadSession,

        refreshUser:
          fetchCurrentUser,
      }),
      [
        user,
        status,
        login,
        signup,
        logout,
        loadSession,
        fetchCurrentUser,
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

/*
|--------------------------------------------------------------------------
| useAuth hook
|--------------------------------------------------------------------------
*/

export function useAuth() {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
}