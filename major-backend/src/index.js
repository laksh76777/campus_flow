import "../env.js";
import connectDB from "./db/index.js";
import { app } from "./app.js";
import { validateEnvironment } from "./config.js";

try {
    validateEnvironment();
    await connectDB();

    const port = Number(process.env.PORT) || 8000;
    app.listen(port, "0.0.0.0", () => {
        console.log(`Server is listening on port ${port}`);
    });
} catch (error) {
    const errorCode = error?.code || error?.name || "ConfigurationError";
    console.error(
        `Server startup failed (${errorCode}). Check required environment settings and MongoDB connectivity.`
    );
    process.exitCode = 1;
}














// import express from 'express';
// const app = express();
// (async ()=>{
//     try {
//         await mongoose.connect(`${process.env.MONGODV_URI}/${DB_NNAME}`)
//         app.on("error",(error)=>{
//             console.log("ERR",error);
//             throw error;
//         })
//         app.listen(process.env.PORT, () =>{
//             console.log(`app is listening on port ${process.env.PORT}`)
//         });
//     } catch (error) {
//         console.error("Error", error)
//         throw error
//     }
// })

 