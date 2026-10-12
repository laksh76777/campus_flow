import dotenv from "dotenv";
import mongoose from "mongoose";
import { User } from "../models/user.models.js";
import { Admin } from "../models/admin.model.js";

dotenv.config();

const emailToPromote = process.argv[2];

if (!emailToPromote) {
  console.log("Usage: node src/scripts/promoteToAdmin.js <email>");
  process.exit(1);
}

async function promote() {
  try {
    const mongoUri = process.env.MONGODB_URI.endsWith("/Place-on")
      ? process.env.MONGODB_URI
      : `${process.env.MONGODB_URI}/Place-on`;

    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB.");

    const user = await User.findOne({ email: emailToPromote.toLowerCase().trim() });
    if (!user) {
      console.error(`User with email '${emailToPromote}' not found.`);
      process.exit(1);
    }

    user.role = "admin";
    await user.save({ validateBeforeSave: false });
    console.log(`Updated user ${user.email} role to 'admin'.`);

    let admin = await Admin.findOne({ user: user._id });
    if (!admin) {
      const randomEmpId = "EMP-" + Math.floor(1000 + Math.random() * 9000);
      admin = await Admin.create({
        user: user._id,
        employeeId: randomEmpId,
        designation: "Placement Officer",
        department: "Training & Placement",
        isPlacementOfficer: true,
      });
      console.log(`Created Admin profile with Employee ID: ${randomEmpId}`);
    } else {
      console.log(`Admin profile already exists for ${user.email}.`);
    }

    console.log(`SUCCESS: ${user.email} is now an Admin! You can log in via the Admin portal.`);
  } catch (err) {
    console.error("Error promoting user to admin:", err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

promote();
