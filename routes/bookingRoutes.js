import express from "express";
import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";
import verifyToken from "../middleware/verifyToken.js";

const router = express.Router();


// ========================================
// Helper: Check Booking Time Conflict
// ========================================

const hasBookingConflict = async (
    db,
    studioId,
    bookingDate,
    startTime,
    endTime,
    excludeBookingId = null
) => {
    const query = {
        studioId: new ObjectId(studioId),
        bookingDate,
        status: "Confirmed",
        startTime: { $lt: endTime },
        endTime: { $gt: startTime }
    };

    if (excludeBookingId) {
        query._id = {
            $ne: new ObjectId(excludeBookingId)
        };
    }

    const conflictingBooking = await db
        .collection("bookings")
        .findOne(query);

    return Boolean(conflictingBooking);
};


// ========================================
// Create Booking (Protected)
// ========================================

router.post("/", verifyToken, async (req, res) => {
    try {
        const db = getDB();

        const {
            studioId,
            bookingDate,
            startTime,
            endTime,
            totalPrice
        } = req.body;

        // User information comes from verified JWT
        const userEmail = req.user.email;
        const userName = req.user.name || "";

        if (
            !studioId ||
            !bookingDate ||
            !startTime ||
            !endTime
        ) {
            return res.status(400).json({
                message: "Please provide all required fields"
            });
        }

        if (!userEmail) {
            return res.status(401).json({
                message: "Authenticated user email is missing"
            });
        }

        if (!ObjectId.isValid(studioId)) {
            return res.status(400).json({
                message: "Invalid studio ID"
            });
        }

        // Validate time range
        if (startTime >= endTime) {
            return res.status(400).json({
                message: "End time must be later than start time"
            });
        }

        const studio = await db.collection("studios").findOne({
            _id: new ObjectId(studioId)
        });

        if (!studio) {
            return res.status(404).json({
                message: "Studio not found"
            });
        }

        // Prevent users from booking their own studio
        if (studio.ownerEmail === userEmail) {
            return res.status(403).json({
                message: "You cannot book your own studio"
            });
        }

        // Check existing confirmed booking conflict
        const conflict = await hasBookingConflict(
            db,
            studioId,
            bookingDate,
            startTime,
            endTime
        );

        if (conflict) {
            return res.status(409).json({
                message: "This studio is already booked for the selected time."
            });
        }

        const booking = {
            studioId: new ObjectId(studioId),
            studioTitle: studio.title,

            userEmail,
            userName,

            bookingDate,
            startTime,
            endTime,

            totalPrice: Number(totalPrice || 0),

            status: "Pending",
            createdAt: new Date()
        };

        const result = await db
            .collection("bookings")
            .insertOne(booking);

        res.status(201).json({
            message: "Booking created successfully",
            insertedId: result.insertedId
        });

    } catch (error) {
        console.error("Create Booking Error:", error);

        res.status(500).json({
            message: "Failed to create booking",
            error: error.message
        });
    }
});


// ========================================
// Get Host Bookings (Protected)
// ========================================

router.get("/host", verifyToken, async (req, res) => {
    try {
        const db = getDB();

        // Host identity comes from JWT
        const email = req.user.email;

        if (!email) {
            return res.status(401).json({
                message: "Authenticated user email is missing"
            });
        }

        // Find all studios owned by this host
        const studios = await db
            .collection("studios")
            .find({ ownerEmail: email })
            .toArray();

        const studioIds = studios.map(studio => studio._id);

        if (studioIds.length === 0) {
            return res.status(200).json([]);
        }

        // Find bookings made for those studios
        const bookings = await db
            .collection("bookings")
            .find({
                studioId: { $in: studioIds }
            })
            .sort({ createdAt: -1 })
            .toArray();

        res.status(200).json(bookings);

    } catch (error) {
        console.error("Get Host Bookings Error:", error);

        res.status(500).json({
            message: "Failed to fetch host bookings",
            error: error.message
        });
    }
});


// ========================================
// Get My Bookings (Customer) (Protected)
// ========================================

router.get("/", verifyToken, async (req, res) => {
    try {
        const db = getDB();

        // Customer identity comes from JWT
        const email = req.user.email;

        if (!email) {
            return res.status(401).json({
                message: "Authenticated user email is missing"
            });
        }

        const bookings = await db
            .collection("bookings")
            .find({ userEmail: email })
            .sort({ createdAt: -1 })
            .toArray();

        res.status(200).json(bookings);

    } catch (error) {
        console.error("Get My Bookings Error:", error);

        res.status(500).json({
            message: "Failed to fetch bookings",
            error: error.message
        });
    }
});


// ========================================
// Update Booking Status (Host) (Protected)
// ========================================

router.patch("/:id/status", verifyToken, async (req, res) => {
    try {
        const db = getDB();

        const { id } = req.params;
        const { status } = req.body;

        // Host identity comes from JWT
        const hostEmail = req.user.email;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                message: "Invalid booking ID"
            });
        }

        if (!status || !hostEmail) {
            return res.status(400).json({
                message: "Host identity and status are required"
            });
        }

        const allowedStatuses = [
            "Confirmed",
            "Cancelled",
            "Completed"
        ];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                message: "Invalid booking status"
            });
        }

        const booking = await db.collection("bookings").findOne({
            _id: new ObjectId(id)
        });

        if (!booking) {
            return res.status(404).json({
                message: "Booking not found"
            });
        }

        // Verify studio ownership using authenticated host
        const studio = await db.collection("studios").findOne({
            _id: booking.studioId,
            ownerEmail: hostEmail
        });

        if (!studio) {
            return res.status(403).json({
                message: "You are not authorized to update this booking"
            });
        }

        // Validate status transitions
        const validTransition =
            (booking.status === "Pending" &&
                ["Confirmed", "Cancelled"].includes(status)) ||
            (booking.status === "Confirmed" &&
                status === "Completed");

        if (!validTransition) {
            return res.status(400).json({
                message: `Cannot change status from ${booking.status} to ${status}`
            });
        }

        // Check conflict before confirming
        if (status === "Confirmed") {
            const conflict = await hasBookingConflict(
                db,
                booking.studioId,
                booking.bookingDate,
                booking.startTime,
                booking.endTime,
                id
            );

            if (conflict) {
                return res.status(409).json({
                    message: "Cannot confirm this booking. Another confirmed booking already exists for this time."
                });
            }
        }

        const result = await db.collection("bookings").updateOne(
            {
                _id: new ObjectId(id),
                status: booking.status
            },
            {
                $set: {
                    status,
                    updatedAt: new Date()
                }
            }
        );

        if (result.modifiedCount === 0) {
            return res.status(409).json({
                message: "Booking status was already changed"
            });
        }

        res.status(200).json({
            message: `Booking ${status.toLowerCase()} successfully`
        });

    } catch (error) {
        console.error("Update Booking Status Error:", error);

        res.status(500).json({
            message: "Failed to update booking status",
            error: error.message
        });
    }
});


// ========================================
// Cancel Pending Booking (Customer) (Protected)
// ========================================

router.patch("/:id/cancel", verifyToken, async (req, res) => {
    try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                message: "Invalid booking ID"
            });
        }

        const db = getDB();

        // Customer can cancel only their own pending booking
        const result = await db.collection("bookings").updateOne(
            {
                _id: new ObjectId(id),
                userEmail: req.user.email,
                status: "Pending"
            },
            {
                $set: {
                    status: "Cancelled",
                    updatedAt: new Date()
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(400).json({
                message: "Booking not found or cannot be cancelled"
            });
        }

        res.status(200).json({
            message: "Booking cancelled successfully"
        });

    } catch (error) {
        console.error("Cancel Booking Error:", error);

        res.status(500).json({
            message: "Failed to cancel booking",
            error: error.message
        });
    }
});


export default router;