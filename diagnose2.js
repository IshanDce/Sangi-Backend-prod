// Detailed StaffProfile diagnostic
require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const staffProfiles = await db.collection('staffprofiles').find({}).toArray();
  console.log(`📋 Total StaffProfiles: ${staffProfiles.length}\n`);

  const DEFAULT_LOC = [77.0266, 28.4595]; // Gurugram center

  staffProfiles.forEach((p, i) => {
    const loc = p.location?.coordinates;
    const isDefault = loc && loc[0] === DEFAULT_LOC[0] && loc[1] === DEFAULT_LOC[1];
    console.log(`#${i + 1} userId=${p.userId}`);
    console.log(`   services:  ${JSON.stringify(p.services)}`);
    console.log(`   kycStatus: ${p.kycStatus}`);
    console.log(`   location:  ${JSON.stringify(loc)} ${isDefault ? '⚠️ DEFAULT (no real GPS push)' : '✅ REAL'}`);
    console.log(`   rating:    ${p.rating} (${p.reviewCount} reviews)`);
    console.log('');
  });

  // Also check bookings that reference these staff
  console.log('\n📅 Bookings count:', await db.collection('bookings').countDocuments({}));

  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });