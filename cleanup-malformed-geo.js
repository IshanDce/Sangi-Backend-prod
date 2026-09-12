// Find and clean up StaffProfiles with malformed geo docs
// (e.g. { location: { type: "Point" } } without coordinates)
require('dotenv').config();
const mongoose = require('mongoose');

const APPLY = process.argv.includes('--apply');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  // Find docs where location exists but coordinates is missing/empty
  const malformed = await db.collection('staffprofiles').find({
    location: { $exists: true },
    $or: [
      { 'location.coordinates': { $exists: false } },
      { 'location.coordinates': { $size: 0 } },
      { 'location.type': { $exists: false } },
    ],
  }).toArray();

  console.log(APPLY ? '⚠️  APPLY MODE\n' : '🔍 DRY RUN — pass --apply to commit\n');
  console.log(`📋 Malformed StaffProfiles found: ${malformed.length}`);
  malformed.forEach((p, i) => {
    console.log(`  #${i + 1} _id=${p._id} location=${JSON.stringify(p.location)} services=${JSON.stringify(p.services)}`);
  });

  if (APPLY && malformed.length) {
    const ids = malformed.map(p => p._id);
    const result = await db.collection('staffprofiles').updateMany(
      { _id: { $in: ids } },
      { $unset: { location: '', lastLocationUpdateAt: '' } }
    );
    console.log(`\n✅ Fixed ${result.modifiedCount} profiles`);
  } else if (malformed.length) {
    console.log(`\n→ would fix ${malformed.length} profiles (pass --apply)`);
  }

  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });