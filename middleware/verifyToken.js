import { jwtVerify, createRemoteJWKSet } from "jose";

const BETTER_AUTH_URL = process.env.BETTER_AUTH_URL;

let JWKS;

const verifyToken = async (req, res, next) => {
    try {
        const token = req.cookies?.studioToken;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized access. Please login.",
            });
        }

        if (!JWKS) {
            JWKS = createRemoteJWKSet(
                new URL(`${BETTER_AUTH_URL}/api/auth/jwks`)
            );
        }

        const { payload } = await jwtVerify(token, JWKS, {
            issuer: BETTER_AUTH_URL,
            audience: BETTER_AUTH_URL,
        });

        req.user = {
            id: payload.sub,
            email: payload.email,
            name: payload.name,
        };

        next();
    } catch (error) {
        console.error("JWT verification failed:", error.message);

        return res.status(401).json({
            success: false,
            message: "Invalid or expired token.",
        });
    }
};

export default verifyToken;