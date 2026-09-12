// Quick DB diagnostic — run from backend dir: node diagnose.js
require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

(async () => {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected\n');

  // 1. Show all StaffProfile documents with location
  const db = mongoose.connection.db;
  const staffProfiles = await db.collection('staffprofiles').find({}).toArray();
  console.log(`📋 Total StaffProfiles in DB: ${staffProfiles.length}`);
  staffProfiles.forEach((p, i) => {
    console.log(`\n--- Staff #${i + 1} ---`);
    console.log('  userId:        ', p.userId);
    console.log('  services:      ', p.services);
    console.log('  kycStatus:     ', p.kycStatus);
    console.log('  location:      ', JSON.stringify(p.location));
    console.log('  updatedAt:     ', p.updatedAt);
  });

  // 2. Show all Users with lastKnownLat/Lng
  const users = await db.collection('users').find({}).toArray();
  console.log(`\n\n👥 Total Users in DB: ${users.length}`);
  users.forEach((u, i) => {
    console.log(`\n--- User #${i + 1} ---`);
    console.log('  _id:           ', u._id);
    console.log('  fullName:      ', u.fullName);
    console.log('  role:          ', u.role);
    console.log('  phone:         ', u.phone);
    console.log('  lastKnownLat:  ', u.lastKnownLat);
    console.log('  lastKnownLng:  ', u.lastKnownLng);
    console.log('  lastLocationUpdateAt: ', u.lastLocationUpdateAt);
  });

  // 3. Check for orphan StaffProfiles (no matching User)
  console.log('\n\n🔗 Orphan StaffProfiles (no matching User):');
  for (const p of staffProfiles) {
    const u = await db.collection('users').findOne({ _id: p.userId });
    if (!u) {
      console.log('  ❌ ORPHAN: userId =', p.userId, ' services=', p.services, ' location=', JSON.stringify(p.location));
    }
  }
  console.log('  (none above = all linked correctly)');

  await mongoose.disconnect();
})().catch(err => { console.error(err); process.exit(1); });