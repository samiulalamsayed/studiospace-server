import express from "express";
import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";
import verifyToken from "../middleware/verifyToken.js";

const router = express.Router();

// ==========================================
// GET: All Studios (Category & Owner Filter)
// ==========================================

router.get("/", async (req, res) => {
    try {
        const db = getDB();
        const { category, ownerEmail } = req.query;

        const query = {};

        if (category) {
            query.category = category;
        }

        if (ownerEmail) {
            query.ownerEmail = ownerEmail;
        }

        const studios = await db
            .collection("studios")
            .find(query)
            .sort({ createdAt: -1 })
            .toArray();

        res.status(200).json(studios);

    } catch (error) {
        console.error("Get Studios Error:", error);

        res.status(500).json({
            message: "Failed to fetch studios",
            error: error.message
        });
    }
});


// ==========================================
// GET: Featured Studios (Latest 6)
// ==========================================

router.get("/featured", async (req, res) => {
    try {
        const db = getDB();

        const studios = await db
            .collection("studios")
            .find()
            .sort({ createdAt: -1 })
            .limit(6)
            .toArray();

        res.status(200).json(studios);

    } catch (error) {
        console.error("Featured Studios Error:", error);

        res.status(500).json({
            message: "Failed to fetch featured studios"
        });
    }
});


// ==========================================
// GET: Single Studio
// ==========================================

router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                message: "Invalid studio ID"
            });
        }

        const db = getDB();

        const studio = await db
            .collection("studios")
            .findOne({
                _id: new ObjectId(id)
            });

        if (!studio) {
            return res.status(404).json({
                message: "Studio not found"
            });
        }

        res.status(200).json(studio);

    } catch (error) {
        console.error("Single Studio Error:", error);

        res.status(500).json({
            message: "Failed to fetch studio"
        });
    }
});


// ==========================================
// POST: Add New Studio (Protected)
// ==========================================

router.post("/", verifyToken, async (req, res) => {
    try {
        const db = getDB();

        const {
            title,
            category,
            hourlyRate,
            securityDeposit,
            maxCapacity,
            location,
            imageUrl,
            imageUrls,
            amenities,
            overview
        } = req.body;

        // Owner information comes from verified JWT
        const ownerEmail = req.user.email;
        const ownerName = req.user.name || "";

        // Support both single and multiple images
        const finalImageUrls =
            Array.isArray(imageUrls) && imageUrls.length > 0
                ? imageUrls
                : imageUrl
                    ? [imageUrl]
                    : [];

        if (
            !title ||
            !category ||
            hourlyRate === undefined ||
            !location ||
            finalImageUrls.length === 0
        ) {
            return res.status(400).json({
                message: "Please provide all required fields"
            });
        }

        const newStudio = {
            title,
            category,
            hourlyRate: Number(hourlyRate),
            securityDeposit: Number(securityDeposit || 0),
            maxCapacity: Number(maxCapacity || 1),
            location,

            imageUrl: finalImageUrls[0],
            imageUrls: finalImageUrls,

            amenities: amenities || [],
            overview: overview || "",

            ownerEmail,
            ownerName,

            rating: 0,
            createdAt: new Date()
        };

        const result = await db
            .collection("studios")
            .insertOne(newStudio);

        res.status(201).json({
            message: "Studio added successfully",
            insertedId: result.insertedId
        });

    } catch (error) {
        console.error("Add Studio Error:", error);

        res.status(500).json({
            message: "Failed to add studio",
            error: error.message
        });
    }
});


// ==========================================
// PUT: Update Studio (Protected + Owner Check)
// ==========================================

router.put("/:id", verifyToken, async (req, res) => {
    try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                message: "Invalid studio ID"
            });
        }

        const db = getDB();

        // Find studio and verify ownership
        const existingStudio = await db
            .collection("studios")
            .findOne({
                _id: new ObjectId(id)
            });

        if (!existingStudio) {
            return res.status(404).json({
                message: "Studio not found"
            });
        }

        if (existingStudio.ownerEmail !== req.user.email) {
            return res.status(403).json({
                message: "You are not authorized to update this studio"
            });
        }

        const {
            title,
            category,
            hourlyRate,
            securityDeposit,
            maxCapacity,
            location,
            imageUrl,
            imageUrls,
            amenities,
            overview
        } = req.body;

        const finalImageUrls =
            Array.isArray(imageUrls) && imageUrls.length > 0
                ? imageUrls
                : imageUrl
                    ? [imageUrl]
                    : [];

        if (
            !title ||
            !category ||
            hourlyRate === undefined ||
            !location ||
            finalImageUrls.length === 0
        ) {
            return res.status(400).json({
                message: "Please provide all required fields"
            });
        }

        const updatedData = {
            title,
            category,
            hourlyRate: Number(hourlyRate),
            securityDeposit: Number(securityDeposit || 0),
            maxCapacity: Number(maxCapacity || 1),
            location,

            imageUrl: finalImageUrls[0],
            imageUrls: finalImageUrls,

            amenities: amenities || [],
            overview: overview || ""
        };

        const result = await db
            .collection("studios")
            .updateOne(
                {
                    _id: new ObjectId(id),
                    ownerEmail: req.user.email
                },
                {
                    $set: updatedData
                }
            );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                message: "Studio not found"
            });
        }

        res.status(200).json({
            message: "Studio updated successfully"
        });

    } catch (error) {
        console.error("Update Studio Error:", error);

        res.status(500).json({
            message: "Failed to update studio",
            error: error.message
        });
    }
});


// ==========================================
// DELETE: Delete Studio (Protected + Owner Check)
// ==========================================

router.delete("/:id", verifyToken, async (req, res) => {
    try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                message: "Invalid studio ID"
            });
        }

        const db = getDB();

        const result = await db
            .collection("studios")
            .deleteOne({
                _id: new ObjectId(id),
                ownerEmail: req.user.email
            });

        if (result.deletedCount === 0) {
            return res.status(404).json({
                message: "Studio not found or you are not the owner"
            });
        }

        res.status(200).json({
            message: "Studio deleted successfully"
        });

    } catch (error) {
        console.error("Delete Studio Error:", error);

        res.status(500).json({
            message: "Failed to delete studio"
        });
    }
});

export default router;