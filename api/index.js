import app from "../index.js";
import { connectDB } from "../config/db.js";

export default async function handler(req, res) {
    try {
        await connectDB();
        return app(req, res);
    } catch (error) {
        console.error("Server error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
        });
    }
}