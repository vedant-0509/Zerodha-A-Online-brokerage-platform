// import axios from "axios";

// const API_URL = (
//   process.env.REACT_APP_API_URL ||
//   process.env.REACT_APP_API_BASE_URL ||
//   ""
// ).replace(/\/$/, "");

// export const api = axios.create({
//   baseURL: API_URL,
//   timeout: Number(process.env.REACT_APP_REQUEST_TIMEOUT_MS || 15000),
//   headers: {
//     "Content-Type": "application/json",
//   },
// });

// api.interceptors.request.use((config) => {
//   const token = localStorage.getItem("token");

//   if (token) {
//     config.headers.Authorization = `Bearer ${token}`;
//   }

//   return config;
// });

// api.interceptors.response.use(
//   (response) => response,
//   (error) => {
//     const status = error.response?.status;

//     if (status === 401) {
//       localStorage.removeItem("token");
//       localStorage.removeItem("user");
//       window.dispatchEvent(new Event("auth-expired"));
//     }

//     if (status === 403) {
//       window.dispatchEvent(
//         new CustomEvent("api-forbidden", {
//           detail: error.response?.data,
//         })
//       );
//     }

//     if (status === 429) {
//       window.dispatchEvent(
//         new CustomEvent("api-rate-limited", {
//           detail: error.response?.data,
//         })
//       );
//     }

//     return Promise.reject(error);
//   }
// );

// export default api;
















import axios from "axios";


const API_URL = (
    process.env.REACT_APP_AUTH_API_URL ||
    process.env.REACT_APP_API_URL ||
    "http://localhost:3010"
)
    .replace(/\/$/, "");


const api = axios.create({
    baseURL:
        API_URL,

    timeout:
        Number(
            process.env.REACT_APP_REQUEST_TIMEOUT_MS ||
            15000
        ),

    headers: {
        "Content-Type":
            "application/json",
    },
});


/*
|--------------------------------------------------------------------------
| REQUEST INTERCEPTOR
|--------------------------------------------------------------------------
*/

api.interceptors.request.use(
    (config) => {

        const token =
            localStorage.getItem(
                "token"
            );


        if (token) {

            config.headers =
                config.headers || {};

            config.headers.Authorization =
                `Bearer ${token}`;
        }


        return config;
    },

    (error) =>
        Promise.reject(error)
);


/*
|--------------------------------------------------------------------------
| RESPONSE INTERCEPTOR
|--------------------------------------------------------------------------
*/

api.interceptors.response.use(

    (response) =>
        response,

    (error) => {

        const status =
            error.response?.status;

        const url =
            String(
                error.config?.url ||
                ""
            );


        /*
        ----------------------------------------------------------------------
        | Don't treat a failed login attempt as an expired existing session.
        ----------------------------------------------------------------------
        */

        const isAuthAttempt =
            url.endsWith(
                "/login"
            ) ||
            url.endsWith(
                "/signup"
            );


        if (
            status === 401 &&
            !isAuthAttempt
        ) {

            localStorage.removeItem(
                "token"
            );

            localStorage.removeItem(
                "user"
            );


            window.dispatchEvent(
                new Event(
                    "auth-expired"
                )
            );
        }


        if (
            status === 403
        ) {

            window.dispatchEvent(
                new CustomEvent(
                    "api-forbidden",
                    {
                        detail:
                            error.response?.data,
                    }
                )
            );
        }


        if (
            status === 429
        ) {

            window.dispatchEvent(
                new CustomEvent(
                    "api-rate-limited",
                    {
                        detail:
                            error.response?.data,
                    }
                )
            );
        }


        return Promise.reject(
            error
        );
    }
);


export default api;

export {
    api,
};