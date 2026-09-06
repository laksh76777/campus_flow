import "../env.js"
import connectDB from "./db/index.js";
import {app} from "./app.js";
console.log("Envirnment variables loaded successgfully.");
connectDB().then(()=>{
    app.on("error", (error) => {
      console.log("The application is unable to talk with the database", error);
      throw error;
    });

    const port = process.env.PORT || 8000;

    app.listen(port, "0.0.0.0", () => {
        console.log(`Server is running on port ${port}`);
    });
})
.catch((err)=>{
    console.log("Mongodb connection failed !!!",err);
});














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

 