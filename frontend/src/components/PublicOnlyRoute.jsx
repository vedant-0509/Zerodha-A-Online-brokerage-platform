// import React from "react";

// import {
//     Navigate,
//     Outlet,
//     useLocation,
// } from "react-router-dom";

// import { useAuth } from "../context/AuthContext";


// export default function PublicOnlyRoute() {

//     const {
//         status,
//     } = useAuth();


//     const location =
//         useLocation();


//     if (
//         status ===
//         "loading"
//     ) {

//         return (
//             <div
//                 style={{
//                     minHeight:
//                         "60vh",

//                     display:
//                         "flex",

//                     alignItems:
//                         "center",

//                     justifyContent:
//                         "center",
//                 }}
//             >
//                 Loading...
//             </div>
//         );
//     }


//     if (
//         status ===
//         "authenticated"
//     ) {

//         const requested =
//             location.state?.from;


//         return (
//             <Navigate
//                 to={
//                     requested &&
//                     requested !==
//                         "/login" &&
//                     requested !==
//                         "/signup"
//                         ? requested
//                         : "/dashboard/stocks/explore"
//                 }
//                 replace
//             />
//         );
//     }


//     return (
//         <Outlet />
//     );
// }






















import React from "react";

import {
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";

import {
  useAuth,
} from "../context/AuthContext";

export default function PublicOnlyRoute() {
  const {
    status,
  } = useAuth();

  const location =
    useLocation();

  /*
  |--------------------------------------------------------------------------
  | AUTH STATE LOADING
  |--------------------------------------------------------------------------
  */

  if (
    status === "loading"
  ) {
    return (
      <div
        style={{
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        Loading...
      </div>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | AUTHENTICATED USER
  |--------------------------------------------------------------------------
  |
  | Logged-in users should not see /login or /signup.
  |
  */

  if (
    status === "authenticated"
  ) {
    const requested =
      location.state?.from;

    /*
    Only allow internal application paths.
    */

    const isSafeInternalPath =
      typeof requested === "string" &&
      requested.startsWith("/") &&
      !requested.startsWith("//") &&
      !requested.startsWith("/login") &&
      !requested.startsWith("/signup");

    return (
      <Navigate
        to={
          isSafeInternalPath
            ? requested
            : "/dashboard/stocks/explore"
        }
        replace
      />
    );
  }

  /*
  |--------------------------------------------------------------------------
  | NOT AUTHENTICATED
  |--------------------------------------------------------------------------
  */

  return <Outlet />;
}