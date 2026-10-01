const {
    extractBearerToken,
    verifyAccessToken,
} = require("../auth/jwt");


function authenticateToken(
    req,
    res,
    next
) {
    const token =
        extractBearerToken(
            req.headers.authorization
        );


    /*
    |--------------------------------------------------------------------------
    | No token
    |--------------------------------------------------------------------------
    */

    if (!token) {
        return res.status(401).json({
            success: false,

            error: {
                code:
                    "AUTHENTICATION_REQUIRED",

                message:
                    "Authentication required",
            },
        });
    }


    try {
        const decoded =
            verifyAccessToken(token);


        /*
        ----------------------------------------------------------------------
        | Validate JWT payload
        ----------------------------------------------------------------------
        */

        if (
            !decoded ||
            typeof decoded.userId !==
                "string" ||
            !decoded.userId.trim()
        ) {
            return res.status(401).json({
                success: false,

                error: {
                    code:
                        "INVALID_TOKEN",

                    message:
                        "Invalid authentication token",
                },
            });
        }


        /*
        ----------------------------------------------------------------------
        | Attach authenticated identity
        ----------------------------------------------------------------------
        */

        req.userId =
            decoded.userId;

        req.user =
            decoded;


        return next();

    } catch (error) {

        return res.status(401).json({
            success: false,

            error: {
                code:
                    "INVALID_TOKEN",

                message:
                    "Invalid or expired authentication token",
            },
        });
    }
}


module.exports =
    authenticateToken;