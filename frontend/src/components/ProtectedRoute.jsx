// import React from "react";

// import {
//     Navigate,
//     Outlet,
//     useLocation,
// } from "react-router-dom";

// import { useAuth } from "../context/AuthContext";


// export default function ProtectedRoute() {

//     const {
//         status,
//     } = useAuth();


//     const location =
//         useLocation();


//     /*
//     |--------------------------------------------------------------------------
//     | WAIT FOR /me
//     |--------------------------------------------------------------------------
//     */

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

//                     fontSize:
//                         "1rem",
//                 }}
//             >
//                 Checking your session...
//             </div>
//         );
//     }


//     /*
//     |--------------------------------------------------------------------------
//     | NOT AUTHENTICATED
//     |--------------------------------------------------------------------------
//     */

//     if (
//         status !==
//         "authenticated"
//     ) {

//         const from =
//             `${location.pathname}${location.search}${location.hash}`;


//         return (
//             <Navigate
//                 to="/login"
//                 replace
//                 state={{
//                     from,
//                 }}
//             />
//         );
//     }


//     /*
//     |--------------------------------------------------------------------------
//     | AUTHENTICATED
//     |--------------------------------------------------------------------------
//     */

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

export default function ProtectedRoute() {
  const {
    status,
  } = useAuth();

  const location =
    useLocation();

  /*
  |--------------------------------------------------------------------------
  | AUTH STATE STILL LOADING
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
          fontSize: "1rem",
        }}
      >
        Checking your session...
      </div>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | NOT AUTHENTICATED
  |--------------------------------------------------------------------------
  */

  if (
    status !== "authenticated"
  ) {
    const from =
      `${location.pathname}${location.search}${location.hash}`;

    return (
      <Navigate
        to="/login"
        replace
        state={{
          from,
        }}
      />
    );
  }

  /*
  |--------------------------------------------------------------------------
  | AUTHENTICATED
  |--------------------------------------------------------------------------
  */

  return <Outlet />;
}