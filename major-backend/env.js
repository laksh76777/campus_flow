import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const envPath = path.resolve(__dirname, ".env");

export const reloadEnv = () => {
    dotenv.config({
        path: envPath,
        override: true,
    });
};

reloadEnv();