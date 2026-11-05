import express from "express";
import { jwtVerify, createRemoteJWKSet } from "jose";

const router = express.Router();

const BETTER_AUTH_URL = process.env.BETTER_AUTH_URL;

const JWKS = createRemoteJWKSet(
    new URL(`${BETTER_AUTH_URL}/api/auth/jwks`)
);

// Login-এর পর JWT নিয়ে HTTPOnly Cookie সেট করবে
router.post("/set-cookie", async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: "Token is required.",
            });
        }

        await jwtVerify(token, JWKS, {
            issuer: BETTER_AUTH_URL,
            audience: BETTER_AUTH_URL,
        });

        res.cookie("studioToken", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 15 * 60 * 1000,
            path: "/",
        });

        return res.status(200).json({
            success: true,
            message: "Authentication cookie set successfully.",
        });

    } catch (error) {
        console.error("Set cookie error:", error.message);

        return res.status(401).json({
            success: false,
            message: "Invalid token.",
        });
    }
});

// Logout-এর সময় Cookie মুছে ফেলবে
router.post("/logout", (req, res) => {
    res.clearCookie("studioToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
    });

    return res.status(200).json({
        success: true,
        message: "Logged out successfully.",
    });
});

export default router;