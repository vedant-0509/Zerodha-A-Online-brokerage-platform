// import axios from "axios";

// const API_URL = (
//     process.env.REACT_APP_API_URL ||
//     "http://localhost:3000/api"
// ).replace(/\/$/, "");

// const api = axios.create({
//     baseURL: API_URL,

//     timeout: Number(
//         process.env.REACT_APP_REQUEST_TIMEOUT_MS ||
//         15000
//     ),

//     headers: {
//         "Content-Type":
//             "application/json",
//     },
// });

// /*
// |--------------------------------------------------------------------------
// | REQUEST
// |--------------------------------------------------------------------------
// */

// api.interceptors.request.use(
//     (config) => {
//         const token =
//             localStorage.getItem(
//                 "token"
//             );

//         if (token) {
//             config.headers =
//                 config.headers || {};

//             config.headers.Authorization =
//                 `Bearer ${token}`;
//         }

//         return config;
//     },

//     (error) =>
//         Promise.reject(error)
// );

// /*
// |--------------------------------------------------------------------------
// | RESPONSE
// |--------------------------------------------------------------------------
// */

// api.interceptors.response.use(
//     (response) =>
//         response,

//     (error) => {
//         const status =
//             error.response?.status;

//         const url =
//             String(
//                 error.config?.url || ""
//             );

//         const isAuthAttempt =
//             url.endsWith("/login") ||
//             url.endsWith("/signup");

//         /*
//         | 401
//         */

//         if (
//             status === 401 &&
//             !isAuthAttempt
//         ) {
//             localStorage.removeItem(
//                 "token"
//             );

//             localStorage.removeItem(
//                 "user"
//             );

//             window.dispatchEvent(
//                 new Event(
//                     "auth-expired"
//                 )
//             );
//         }

//         /*
//         | 403
//         */

//         if (status === 403) {
//             window.dispatchEvent(
//                 new CustomEvent(
//                     "api-forbidden",
//                     {
//                         detail:
//                             error.response
//                                 ?.data,
//                     }
//                 )
//             );
//         }

//         /*
//         | 429
//         */

//         if (status === 429) {
//             window.dispatchEvent(
//                 new CustomEvent(
//                     "api-rate-limited",
//                     {
//                         detail:
//                             error.response
//                                 ?.data,
//                     }
//                 )
//             );
//         }

//         return Promise.reject(
//             error
//         );
//     }
// );

// export default api;

// export { api };

















import axios from "axios";

const API_URL = (
  process.env.REACT_APP_API_URL ||
  "http://localhost:3000/api"
).replace(/\/$/, "");

const api = axios.create({
  baseURL: API_URL,
  timeout: Number(
    process.env.REACT_APP_REQUEST_TIMEOUT_MS ||
    15000
  ),
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem("token");

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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status =
      error.response?.status;

    const url =
      String(
        error.config?.url || ""
      );

    const isAuthAttempt =
      url.endsWith("/login") ||
      url.endsWith("/signup");

    if (
      status === 401 &&
      !isAuthAttempt
    ) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");

      window.dispatchEvent(
        new Event("auth-expired")
      );
    }

    if (status === 403) {
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

    if (status === 429) {
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

    return Promise.reject(error);
  }
);

export default api;
export { api };