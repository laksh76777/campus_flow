import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

export const resolveMongoConnection = (mongoUri) => {
    if (typeof mongoUri !== "string" || !mongoUri.trim()) {
        throw new Error("MONGODB_URI must contain a MongoDB connection URI.");
    }

    let uri;
    try {
        uri = new URL(mongoUri.trim());
    } catch {
        throw new Error("MONGODB_URI is not a valid MongoDB connection URI.");
    }

    if (uri.protocol !== "mongodb:" && uri.protocol !== "mongodb+srv:") {
        throw new Error("MONGODB_URI must use mongodb:// or mongodb+srv://.");
    }

    if (!uri.pathname || uri.pathname === "/") {
        uri.pathname = `/${DB_NAME}`;
    }

    return {
        connectionUri: uri.toString(),
        databaseName: decodeURIComponent(uri.pathname.slice(1))
    };
};

const connectDB = async () => {
    const { connectionUri, databaseName } = resolveMongoConnection(
        process.env.MONGODB_URI
    );
    const connectionInstance = await mongoose.connect(connectionUri);

    console.log(
        `MongoDB connected successfully: ${connectionInstance.connection.host}/${databaseName}`
    );

    return connectionInstance;
};

export default connectDB;