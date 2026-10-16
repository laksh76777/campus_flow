import mongoose from "mongoose";

const MONGO_URI = process.env.MONGODB_URI || "";

async function purgeDrivesAndApplications() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log("Connected.");

  const drivesCountBefore = await mongoose.connection.collection("placementdrives").countDocuments();
  const appsCountBefore = await mongoose.connection.collection("applications").countDocuments();
  console.log(`Current state: ${drivesCountBefore} drives, ${appsCountBefore} applications.`);

  // 1. Delete all applications
  const delAppsRes = await mongoose.connection.collection("applications").deleteMany({});
  console.log(`✔ Deleted ${delAppsRes.deletedCount} applications.`);

  // 2. Delete all placement drives
  const delDrivesRes = await mongoose.connection.collection("placementdrives").deleteMany({});
  console.log(`✔ Deleted ${delDrivesRes.deletedCount} placement drives.`);

  // 3. Reset any students' placement state so their profile is completely fresh
  const updateProfilesRes = await mongoose.connection.collection("studentprofiles").updateMany(
    {},
    {
      $set: {
        isPlaced: false,
        placedCompany: "",
        placedPackage: null,
        placedAt: null,
        placedJobTitle: "",
      },
    }
  );
  console.log(`✔ Reset placement state on ${updateProfilesRes.matchedCount} student profiles.`);

  // 4. Verify clean slate
  const drivesAfter = await mongoose.connection.collection("placementdrives").countDocuments();
  const appsAfter = await mongoose.connection.collection("applications").countDocuments();
  console.log(`Final state: ${drivesAfter} drives, ${appsAfter} applications.`);

  await mongoose.disconnect();
  console.log("✔ Purge completed successfully. Workspace is completely clean.");
}

purgeDrivesAndApplications().catch((err) => {
  console.error("Purge error:", err);
  process.exit(1);
});
