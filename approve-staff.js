// Approve staff by name or phone number
// Usage: node approve-staff.js <name_or_phone>
// Example: node approve-staff.js "Sanjeev"
// Example: node approve-staff.js "9312121655"

require("dotenv").config();
const mongoose = require("mongoose");

const query = process.argv[2];

if (!query) {
  console.log("\nUsage: node approve-staff.js \"<name or phone>\"");
  console.log("Examples:");
  console.log("  node approve-staff.js \"Sanjeev\"");
  console.log("  node approve-staff.js \"9312121655\"");
  process.exit(1);
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const isPhone = /^\d+$/.test(query.trim());
  let searchQuery;
  if (isPhone) {
    searchQuery = { phone: query.trim(), role: "staff" };
  } else {
    searchQuery = { fullName: { $regex: query.trim(), $options: "i" }, role: "staff" };
  }

  const users = await db.collection("users").find(searchQuery).toArray();

  if (users.length === 0) {
    console.log("\nNo staff found matching: " + query);
    await mongoose.disconnect();
    return;
  }

  if (users.length > 1) {
    console.log("\nMultiple staff found matching \"" + query + "\":");
    users.forEach((u, i) => {
      console.log("  " + (i + 1) + ". " + u.fullName + " | Phone: " + u.phone + " | Email: " + u.email);
    });
    console.log("\nPlease be more specific (use full name or phone number).");
    await mongoose.disconnect();
    return;
  }

  const user = users[0];
  console.log("\nFound Staff: " + user.fullName);
  console.log("  Phone: " + user.phone);
  console.log("  Email: " + user.email);
  console.log("  _id:   " + user._id);

  const profile = await db.collection("staffprofiles").findOne({ userId: user._id });
  if (!profile) {
    console.log("\nStaffProfile NOT FOUND - registration is incomplete.");
    await mongoose.disconnect();
    return;
  }

  console.log("\nCurrent KYC Status: " + profile.kycStatus.toUpperCase());

  if (profile.kycStatus === "approved") {
    console.log("Already APPROVED! No changes needed.");
    await mongoose.disconnect();
    return;
  }

  await db.collection("staffprofiles").updateOne(
    { userId: user._id },
    { $set: { kycStatus: "approved", isKycVerified: true } }
  );

  console.log("\nSUCCESS! " + user.fullName + " has been APPROVED!");
  console.log("  kycStatus    -> approved");
  console.log("  isKycVerified -> true");
  console.log("\nStaff will now appear in customer search results.");

  await mongoose.disconnect();
})().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});