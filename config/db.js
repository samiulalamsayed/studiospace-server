import { MongoClient } from "mongodb";
import "dotenv/config";

const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME;

if (!uri) {
    throw new Error("MONGODB_URI is missing!");
}

if (!dbName) {
    throw new Error("DB_NAME is missing!");
}

const options = {};

const getClientPromise = () => {
    if (!globalThis._mongoClientPromise) {
        const client = new MongoClient(uri, options);
        globalThis._mongoClientPromise = client.connect();
    }

    return globalThis._mongoClientPromise;
};

let db;

export const connectDB = async () => {
    try {
        const connectedClient = await getClientPromise();

        db = connectedClient.db(dbName);

        return db;
    } catch (error) {
        console.error("MongoDB Connection Failed:", error);
        throw error;
    }
};

export const getDB = () => {
    if (!db) {
        throw new Error("Database is not connected!");
    }

    return db;
};