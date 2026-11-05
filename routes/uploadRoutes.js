import express from "express";
import multer from "multer";

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024,
    },
});

router.post("/", upload.single("image"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send({
                message: "Please select an image.",
            });
        }

        if (!process.env.IMGBB_API_KEY) {
            return res.status(500).send({
                message: "ImgBB API key is missing.",
            });
        }

        const formData = new FormData();

        formData.append(
            "image",
            req.file.buffer.toString("base64")
        );

        const response = await fetch(
            `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`,
            {
                method: "POST",
                body: formData,
            }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            return res.status(400).send({
                message: "Image upload failed.",
            });
        }

        res.send({
            message: "Image uploaded successfully!",
            imageUrl: result.data.url,
            displayUrl: result.data.display_url,
        });

    } catch (error) {
        console.error("Image Upload Error:", error);

        res.status(500).send({
            message: "Something went wrong during image upload.",
        });
    }
});

export default router;