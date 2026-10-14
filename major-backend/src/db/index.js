import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async () => {
    try {
        

        const baseUri = (process.env.MONGODB_URI || "mongodb://127.0.0.1:27017").trim();
        let connectionUri;

        if (baseUri.includes(`/${DB_NAME}`)) {
            connectionUri = baseUri;
        } else if (baseUri.includes("?")) {
            const [hostPart, queryPart] = baseUri.split("?");
            connectionUri = `${hostPart.replace(/\/$/, "")}/${DB_NAME}?${queryPart}`;
        } else {
            connectionUri = `${baseUri.replace(/\/$/, "")}/${DB_NAME}`;
        }

        const connectionInstance = await mongoose.connect(connectionUri);

        console.log(
            `MongoDB connected successfully: ${connectionInstance.connection.host}`
        );

        return connectionInstance;
    } catch (error) {
        console.log("MONGODB CONNECTION ERROR:", error);
        throw error;
    }
};

export default connectDB;