// Cleanup script — wipes the default Gurugram coords from existing staff
// profiles and removes profiles for users that look like test accounts
// (no services, no rating, default location, no bookings).
//
// Usage: node cleanup-staff-locations.js            # dry run
//        node cleanup-staff-locations.js --apply    # actually update DB
require('dotenv').config();
const mongoose = require('mongoose');

const APPLY = process.argv.includes('--apply');
const DEFAULT_COORDS = [77.0266, 28.4595];

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  console.log(APPLY ? '⚠️  APPLY MODE — changes will be written\n' : '🔍 DRY RUN — pass --apply to commit changes\n');

  // 1. Find profiles with the default coords (and matching type)
  const profilesWithDefault = await db.collection('staffprofiles').find({
    'location.type': 'Point',
    'location.coordinates': { $all: DEFAULT_COORDS },
  }).toArray();

  console.log(`📋 Profiles with default Gurugram coords: ${profilesWithDefault.length}`);
  for (const p of profilesWithDefault) {
    console.log(`   userId=${p.userId} services=${JSON.stringify(p.services)} rating=${p.rating}`);
  }

  // 2. Clear their location + timestamp
  if (APPLY && profilesWithDefault.length) {
    const ids = profilesWithDefault.map(p => p._id);
    const result = await db.collection('staffprofiles').updateMany(
      { _id: { $in: ids } },
      {
        $unset: { location: '', lastLocationUpdateAt: '' },
      }
    );
    console.log(`\n✅ Cleared location on ${result.modifiedCount} staff profiles`);
  } else if (profilesWithDefault.length) {
    console.log(`\n→ would clear location on ${profilesWithDefault.length} profiles (pass --apply)`);
  }

  // 3. Optional: list profiles with NO services (likely junk)
  const noServices = await db.collection('staffprofiles').find({
    $or: [{ services: { $exists: false } }, { services: { $size: 0 } }],
  }).toArray();
  console.log(`\n🗑️  Profiles with empty/missing services: ${noServices.length}`);
  for (const p of noServices) {
    console.log(`   userId=${p.userId}`);
  }

  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });